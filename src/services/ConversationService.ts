import { supabase } from '@/integrations/supabase/client';
import type {
  ConversationMessage,
  ConversationSummary,
} from '@/lib/civicSocial';

const socialClient = supabase as any;

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export class ConversationService {
  private static instance: ConversationService;

  private constructor() {}

  static getInstance(): ConversationService {
    if (!ConversationService.instance) {
      ConversationService.instance = new ConversationService();
    }

    return ConversationService.instance;
  }

  private mapConversation(row: any): ConversationSummary {
    return {
      id: row.id,
      conversationType: row.conversation_type,
      communityId: row.community_id ?? undefined,
      createdBy: row.created_by ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      lastMessageAt: new Date(row.last_message_at || row.created_at),
    };
  }

  private mapMessage(row: any): ConversationMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderUserId: row.sender_user_id,
      body: row.body,
      attachmentUrl: row.attachment_url ?? undefined,
      status: row.status,
      createdAt: new Date(row.created_at),
      deliveredAt: row.delivered_at ? new Date(row.delivered_at) : undefined,
      seenAt: row.seen_at ? new Date(row.seen_at) : undefined,
    };
  }

  async ensureDirectConversation(otherUserId: string): Promise<string> {
    const { data, error } = await socialClient.rpc('ensure_direct_conversation', {
      p_other_user_id: otherUserId,
    });

    if (error) throw error;

    if (!data) {
      throw new Error('Conversation creation returned no ID');
    }

    return data as string;
  }

  async listConversations(): Promise<ConversationSummary[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await socialClient
      .from('conversation_participants')
      .select('conversation_id, conversations(*)')
      .eq('user_id', user.id);

    if (error) throw error;

    return (data || [])
      .map((row: any) => row.conversations)
      .filter(Boolean)
      .map((row: any) => this.mapConversation(row))
      .sort((left, right) => right.lastMessageAt.getTime() - left.lastMessageAt.getTime());
  }

  async listMessages(conversationId: string, limit = 50): Promise<ConversationMessage[]> {
    const { data, error } = await socialClient
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => this.mapMessage(row));
  }

  async sendMessage(conversationId: string, body: string): Promise<ConversationMessage> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('Authentication required to send a conversation message');
    }

    const { data, error } = await socialClient
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_user_id: user.id,
        body: body.trim(),
      })
      .select('*')
      .single();

    if (error) throw error;

    return this.mapMessage(data);
  }

  async markConversationSeen(conversationId: string): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const timestamp = new Date().toISOString();

    const participantUpdate = await socialClient
      .from('conversation_participants')
      .update({
        last_read_at: timestamp,
      })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);

    if (participantUpdate.error) throw participantUpdate.error;

    const messageUpdate = await socialClient
      .from('conversation_messages')
      .update({
        status: 'seen',
        seen_at: timestamp,
      })
      .eq('conversation_id', conversationId)
      .neq('sender_user_id', user.id);

    if (messageUpdate.error) throw messageUpdate.error;
  }

  subscribeToConversation(
    conversationId: string,
    onMessage: (message: ConversationMessage) => void,
  ) {
    return socialClient
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload: any) => {
          onMessage(this.mapMessage(payload.new));
        },
      )
      .subscribe();
  }
}
