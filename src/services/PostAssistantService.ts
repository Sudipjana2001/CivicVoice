import { supabase } from '@/integrations/supabase/client';
import type { IndiaAssistantRequest, IndiaAssistantResponse } from '@/lib/postAssistant';

export class PostAssistantService {
  private static instance: PostAssistantService;

  private constructor() {}

  static getInstance(): PostAssistantService {
    if (!PostAssistantService.instance) {
      PostAssistantService.instance = new PostAssistantService();
    }
    return PostAssistantService.instance;
  }

  async analyze(request: IndiaAssistantRequest): Promise<IndiaAssistantResponse> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Please sign in again to use the assistant.');
    }

    const { data, error } = await supabase.functions.invoke<IndiaAssistantResponse>('post-assistant', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: {
        postId: request.postId,
        stateCode: request.stateCode.trim().toUpperCase(),
        district: request.district?.trim() || undefined,
      },
    });

    if (error) {
      const functionContext = (error as { context?: Response }).context;

      if (functionContext instanceof Response) {
        try {
          const payload = await functionContext.clone().json() as { error?: string };
          if (payload?.error) {
            throw new Error(payload.error);
          }
        } catch {
          try {
            const text = await functionContext.text();
            if (text.trim()) {
              throw new Error(text);
            }
          } catch {
            // Fall through to the original function error.
          }
        }
      }

      throw new Error(error.message || 'The assistant request failed.');
    }

    if (!data) {
      throw new Error('The assistant did not return any analysis.');
    }

    return data;
  }
}
