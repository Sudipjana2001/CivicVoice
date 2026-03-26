import type { EvidenceType, MediaAsset, MediaKind } from './anonymity';

const IMAGE_MIME_TYPE = 'image/webp';
const IMAGE_FULL_MAX_WIDTH = 1600;
const IMAGE_CARD_MAX_WIDTH = 960;
const IMAGE_THUMB_MAX_WIDTH = 320;
const IMAGE_LQIP_MAX_WIDTH = 24;

export interface PreparedEvidenceUpload extends MediaAsset {
  previewUrl?: string;
  uploadBlobs?: Record<string, Blob>;
}

export function mediaKindFromEvidenceType(evidenceType?: EvidenceType | ''): MediaKind {
  switch (evidenceType) {
    case 'photo':
      return 'image';
    case 'video':
      return 'video';
    case 'document':
      return 'document';
    default:
      return 'other';
  }
}

export function fileExtensionForMimeType(mimeType: string, fallbackName: string): string {
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/avif') return 'avif';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'video/mp4') return 'mp4';
  if (mimeType === 'video/webm') return 'webm';

  const candidate = fallbackName.split('.').pop()?.trim().toLowerCase();
  return candidate || 'bin';
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to decode image'));
    };

    image.src = url;
  });
}

function scaleDimensions(width: number, height: number, maxWidth: number) {
  if (!width || !height || width <= maxWidth) {
    return { width, height };
  }

  const ratio = maxWidth / width;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function canvasToBlob(
  image: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      reject(new Error('Cannot get image canvas context'));
      return;
    }

    ctx.drawImage(image, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to encode image'));
          return;
        }
        resolve(blob);
      },
      IMAGE_MIME_TYPE,
      quality,
    );
  });
}

function canvasToDataUrl(
  image: HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    return '';
  }

  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(IMAGE_MIME_TYPE, quality);
}

export async function prepareImageEvidence(file: File): Promise<PreparedEvidenceUpload> {
  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  const fullSize = scaleDimensions(width, height, IMAGE_FULL_MAX_WIDTH);
  const cardSize = scaleDimensions(width, height, IMAGE_CARD_MAX_WIDTH);
  const thumbSize = scaleDimensions(width, height, IMAGE_THUMB_MAX_WIDTH);
  const lqipSize = scaleDimensions(width, height, IMAGE_LQIP_MAX_WIDTH);

  const [fullBlob, cardBlob, thumbBlob] = await Promise.all([
    canvasToBlob(image, fullSize.width, fullSize.height, 0.84),
    canvasToBlob(image, cardSize.width, cardSize.height, 0.78),
    canvasToBlob(image, thumbSize.width, thumbSize.height, 0.68),
  ]);

  const lqipDataUrl = canvasToDataUrl(image, lqipSize.width, lqipSize.height, 0.42);
  const previewUrl = URL.createObjectURL(fullBlob);
  const assetId = crypto.randomUUID();

  return {
    kind: 'image',
    originalPath: `${assetId}/full.webp`,
    fullPath: `${assetId}/full.webp`,
    cardPath: `${assetId}/card.webp`,
    thumbPath: `${assetId}/thumb.webp`,
    width: fullSize.width,
    height: fullSize.height,
    mimeType: IMAGE_MIME_TYPE,
    lqipDataUrl,
    previewUrl,
    uploadBlobs: {
      full: fullBlob,
      card: cardBlob,
      thumb: thumbBlob,
    },
  };
}

export function prepareGenericEvidence(
  file: File,
  kind: Exclude<MediaKind, 'image'>,
): PreparedEvidenceUpload {
  const extension = fileExtensionForMimeType(file.type, file.name);
  const assetId = crypto.randomUUID();
  const storagePath = `${assetId}/original.${extension}`;

  return {
    kind,
    originalPath: storagePath,
    fullPath: storagePath,
    mimeType: file.type || undefined,
    previewUrl: URL.createObjectURL(file),
    uploadBlobs: {
      original: file,
    },
  };
}

export function revokePreparedEvidencePreview(prepared: PreparedEvidenceUpload | null | undefined) {
  if (prepared?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(prepared.previewUrl);
  }
}
