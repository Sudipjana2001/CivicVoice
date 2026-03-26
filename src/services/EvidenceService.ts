import { supabase } from '@/integrations/supabase/client';
import type { EvidenceType, MediaAsset } from '@/lib/anonymity';
import {
  mediaKindFromEvidenceType,
  prepareGenericEvidence,
  prepareImageEvidence,
  type PreparedEvidenceUpload,
} from '@/lib/media';

interface ResolvedMediaUrls {
  originalUrl?: string | null;
  thumbUrl?: string | null;
  cardUrl?: string | null;
  fullUrl?: string | null;
  posterUrl?: string | null;
  previewUrl?: string | null;
}

interface CachedSignedUrl {
  expiresAt: number;
  url: string;
}

const MEDIA_SIGNED_URL_CACHE_KEY = 'civic_media_signed_urls_v1';
const MEDIA_SHORT_TTL_SECONDS = 60 * 60;
const MEDIA_FEED_TTL_SECONDS = 60 * 60 * 6;

export class EvidenceService {
  private static instance: EvidenceService;
  private cacheHydrated = false;
  private signedUrlCache = new Map<string, CachedSignedUrl>();

  private constructor() {}

  static getInstance(): EvidenceService {
    if (!EvidenceService.instance) {
      EvidenceService.instance = new EvidenceService();
    }
    return EvidenceService.instance;
  }

  private hydrateCache() {
    if (this.cacheHydrated) return;
    this.cacheHydrated = true;

    try {
      const raw = sessionStorage.getItem(MEDIA_SIGNED_URL_CACHE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, CachedSignedUrl>;
      const now = Date.now();

      for (const [path, entry] of Object.entries(parsed)) {
        if (entry?.url && typeof entry.expiresAt === 'number' && entry.expiresAt > now) {
          this.signedUrlCache.set(path, entry);
        }
      }
    } catch {
      sessionStorage.removeItem(MEDIA_SIGNED_URL_CACHE_KEY);
    }
  }

  private persistCache() {
    try {
      const serializable = Object.fromEntries(this.signedUrlCache.entries());
      sessionStorage.setItem(MEDIA_SIGNED_URL_CACHE_KEY, JSON.stringify(serializable));
    } catch {
      // Ignore storage cache failures.
    }
  }

  private getCachedSignedUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    this.hydrateCache();
    const cached = this.signedUrlCache.get(path);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.signedUrlCache.delete(path);
      this.persistCache();
      return null;
    }
    return cached.url;
  }

  private cacheSignedUrl(path: string, url: string, ttlSeconds: number) {
    this.hydrateCache();
    this.signedUrlCache.set(path, {
      url,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    this.persistCache();
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '');
  }

  private extractEvidencePath(reference: string): string | null {
    if (!reference) return null;

    if (!/^https?:\/\//i.test(reference)) {
      return reference;
    }

    try {
      const url = new URL(reference);
      const marker = '/storage/v1/object/';
      const markerIndex = url.pathname.indexOf(marker);

      if (markerIndex === -1) {
        return null;
      }

      const trailingPath = url.pathname.slice(markerIndex + marker.length);
      const pathParts = trailingPath.split('/').filter(Boolean);

      if (pathParts.length < 3) {
        return null;
      }

      const bucketIndex = pathParts[0] === 'sign' || pathParts[0] === 'public' ? 1 : -1;
      if (bucketIndex === -1 || pathParts[bucketIndex] !== 'evidence') {
        return null;
      }

      return pathParts.slice(bucketIndex + 1).join('/');
    } catch {
      return null;
    }
  }

  private async uploadBlob(path: string, blob: Blob, cacheControl: string, contentType?: string) {
    const { error } = await supabase.storage
      .from('evidence')
      .upload(path, blob, {
        cacheControl,
        contentType,
        upsert: true,
      });

    if (error) throw error;
  }

  async uploadEvidence(file: File, evidenceType?: EvidenceType | ''): Promise<PreparedEvidenceUpload> {
    const mediaKind = mediaKindFromEvidenceType(evidenceType);

    if (mediaKind === 'image') {
      const prepared = await prepareImageEvidence(file);
      const uploadBlobs = prepared.uploadBlobs ?? {};

      await Promise.all([
        prepared.fullPath
          ? this.uploadBlob(prepared.fullPath, uploadBlobs.full ?? file, '31536000', prepared.mimeType)
          : Promise.resolve(),
        prepared.cardPath
          ? this.uploadBlob(prepared.cardPath, uploadBlobs.card ?? file, '31536000', prepared.mimeType)
          : Promise.resolve(),
        prepared.thumbPath
          ? this.uploadBlob(prepared.thumbPath, uploadBlobs.thumb ?? file, '31536000', prepared.mimeType)
          : Promise.resolve(),
      ]);

      return prepared;
    }

    const fallbackName = this.sanitizeFileName(file.name);
    const generic = prepareGenericEvidence(
      new File([file], fallbackName, { type: file.type || undefined }),
      mediaKind,
    );
    const originalBlob = generic.uploadBlobs?.original ?? file;
    await this.uploadBlob(generic.originalPath, originalBlob, '86400', generic.mimeType);
    return generic;
  }

  async attachToPost(postId: string, prepared: PreparedEvidenceUpload): Promise<void> {
    const { error } = await supabase.rpc('upsert_post_media_asset', {
      p_post_id: postId,
      p_kind: prepared.kind,
      p_original_path: prepared.originalPath,
      p_thumb_path: prepared.thumbPath ?? null,
      p_card_path: prepared.cardPath ?? null,
      p_full_path: prepared.fullPath ?? null,
      p_poster_path: prepared.posterPath ?? null,
      p_preview_path: prepared.previewPath ?? null,
      p_width: prepared.width ?? null,
      p_height: prepared.height ?? null,
      p_duration_ms: prepared.durationMs ?? null,
      p_mime_type: prepared.mimeType ?? null,
      p_lqip_data_url: prepared.lqipDataUrl ?? null,
    });

    if (error) throw error;
  }

  private async createSignedUrls(paths: string[], ttlSeconds: number) {
    const uncachedPaths = paths.filter((path) => !this.getCachedSignedUrl(path));
    if (uncachedPaths.length === 0) return;

    const { data, error } = await supabase.storage
      .from('evidence')
      .createSignedUrls(uncachedPaths, ttlSeconds);

    if (error) throw error;

    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        this.cacheSignedUrl(item.path, item.signedUrl, ttlSeconds);
      }
    }
  }

  async resolveMediaAssetUrls(asset: MediaAsset, includeFull = false): Promise<ResolvedMediaUrls> {
    const feedPaths = [
      asset.thumbPath,
      asset.cardPath,
      asset.posterPath,
      asset.previewPath,
    ].filter((path): path is string => Boolean(path));

    if (feedPaths.length > 0) {
      await this.createSignedUrls(feedPaths, MEDIA_FEED_TTL_SECONDS);
    }

    const fullPaths = [
      asset.fullPath,
      asset.originalPath,
    ].filter((path): path is string => Boolean(path));

    if (includeFull && fullPaths.length > 0) {
      await this.createSignedUrls(fullPaths, MEDIA_SHORT_TTL_SECONDS);
    }

    return {
      thumbUrl: asset.thumbPath ? this.getCachedSignedUrl(asset.thumbPath) : null,
      cardUrl: asset.cardPath ? this.getCachedSignedUrl(asset.cardPath) : null,
      posterUrl: asset.posterPath ? this.getCachedSignedUrl(asset.posterPath) : null,
      previewUrl: asset.previewPath ? this.getCachedSignedUrl(asset.previewPath) : null,
      fullUrl: includeFull && asset.fullPath ? this.getCachedSignedUrl(asset.fullPath) : null,
      originalUrl: includeFull ? this.getCachedSignedUrl(asset.originalPath) : null,
    };
  }

  async prefetchMediaAsset(asset: MediaAsset): Promise<void> {
    const urls = await this.resolveMediaAssetUrls(asset);
    const imageUrl = urls.cardUrl ?? urls.thumbUrl ?? urls.posterUrl;

    if (imageUrl) {
      const image = new Image();
      image.decoding = 'async';
      image.src = imageUrl;
    }

    if (urls.previewUrl) {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = urls.previewUrl;
    }
  }

  async resolveEvidenceUrl(reference: string): Promise<string | null> {
    if (!reference) return null;

    let path = reference;
    if (/^https?:\/\//i.test(reference)) {
      const extractedPath = this.extractEvidencePath(reference);
      if (!extractedPath) {
        return null;
      }

      path = extractedPath;
    }

    const cached = this.getCachedSignedUrl(path);
    if (cached) return cached;

    const { data, error } = await supabase.storage
      .from('evidence')
      .createSignedUrl(path, MEDIA_SHORT_TTL_SECONDS);

    if (error) {
      throw error;
    }

    if (data?.signedUrl) {
      this.cacheSignedUrl(path, data.signedUrl, MEDIA_SHORT_TTL_SECONDS);
    }

    return data?.signedUrl || null;
  }
}
