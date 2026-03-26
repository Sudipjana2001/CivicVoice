import { supabase } from '@/integrations/supabase/client';

export class EvidenceService {
  private static instance: EvidenceService;

  private constructor() {}

  static getInstance(): EvidenceService {
    if (!EvidenceService.instance) {
      EvidenceService.instance = new EvidenceService();
    }
    return EvidenceService.instance;
  }

  sanitizeFileName(name: string): string {
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

  async uploadEvidence(file: File, uploadFile: File | Blob): Promise<{ path: string; signedUrl: string }> {
    const fileName = `${crypto.randomUUID()}_${this.sanitizeFileName(file.name)}`;
    const { data, error } = await supabase.storage
      .from('evidence')
      .upload(fileName, uploadFile, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });

    if (error) throw error;

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('evidence')
      .createSignedUrl(data.path, 60 * 60);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw signedUrlError || new Error('Failed to create a signed evidence URL');
    }

    return {
      path: data.path,
      signedUrl: signedUrlData.signedUrl,
    };
  }

  async resolveEvidenceUrl(reference: string): Promise<string | null> {
    if (!reference) return null;

    if (/^https?:\/\//i.test(reference)) {
      const extractedPath = this.extractEvidencePath(reference);
      if (!extractedPath) {
        return null;
      }

      reference = extractedPath;
    }

    const { data, error } = await supabase.storage
      .from('evidence')
      .createSignedUrl(reference, 60 * 60);

    if (error) {
      throw error;
    }

    return data?.signedUrl || null;
  }
}
