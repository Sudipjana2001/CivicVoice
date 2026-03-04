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

  async uploadEvidence(file: File, uploadFile: File | Blob): Promise<string> {
    const fileName = `${crypto.randomUUID()}_${this.sanitizeFileName(file.name)}`;
    const { data, error } = await supabase.storage
      .from('evidence')
      .upload(fileName, uploadFile, {
        cacheControl: '3600',
        contentType: file.type || undefined,
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from('evidence').getPublicUrl(data.path);
    return urlData.publicUrl;
  }
}
