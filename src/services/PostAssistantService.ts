import { supabase } from '@/integrations/supabase/client';
import type { ChatRequest, IndiaAssistantRequest, IndiaAssistantResponse } from '@/lib/postAssistant';

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

  async *chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Please sign in again to use the assistant.');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured.');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/post-assistant-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send message: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from assistant stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          const dataStr = line.replace('data: ', '').trim();
          if (dataStr === '[DONE]') {
            return;
          }
          try {
            const data = JSON.parse(dataStr);
            const content = data?.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Ignore incomplete chunks that slipped through
          }
        }
      }
    }
  }
}
