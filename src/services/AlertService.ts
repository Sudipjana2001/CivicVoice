import { supabase } from '@/integrations/supabase/client';
import type { CivicAlert } from '@/lib/civicSocial';

const socialClient = supabase as any;

export class AlertService {
  private static instance: AlertService;

  private constructor() {}

  static getInstance(): AlertService {
    if (!AlertService.instance) {
      AlertService.instance = new AlertService();
    }

    return AlertService.instance;
  }

  private mapAlert(row: any): CivicAlert {
    return {
      id: row.id,
      recipientUserId: row.recipient_user_id,
      type: row.type,
      title: row.title,
      description: row.description ?? '',
      read: row.read,
      createdAt: new Date(row.created_at),
      actionUrl: row.action_url ?? undefined,
      communityId: row.community_id ?? undefined,
      conversationId: row.conversation_id ?? undefined,
      voiceId: row.voice_id ?? undefined,
    };
  }

  async fetchAlerts(limit = 50): Promise<CivicAlert[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await socialClient
      .from('civic_alerts')
      .select('*')
      .eq('recipient_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).map((row: any) => this.mapAlert(row));
  }

  async markAsRead(alertId: string): Promise<void> {
    const { error } = await socialClient
      .from('civic_alerts')
      .update({ read: true })
      .eq('id', alertId);

    if (error) throw error;
  }

  async markAllAsRead(): Promise<void> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await socialClient
      .from('civic_alerts')
      .update({ read: true })
      .eq('recipient_user_id', user.id)
      .eq('read', false);

    if (error) throw error;
  }

  async deleteAlert(alertId: string): Promise<void> {
    const { error } = await socialClient
      .from('civic_alerts')
      .delete()
      .eq('id', alertId);

    if (error) throw error;
  }

  async getUnreadCount(): Promise<number> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return 0;

    const { count, error } = await socialClient
      .from('civic_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_user_id', user.id)
      .eq('read', false);

    if (error) throw error;

    return count ?? 0;
  }

  async fetchCountsByCategory(): Promise<Record<string, number>> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return {};

    const { data, error } = await socialClient
      .from('civic_alerts')
      .select('type')
      .eq('recipient_user_id', user.id)
      .eq('read', false);

    if (error) throw error;

    const counts: Record<string, number> = {
      voices: 0,
      communities: 0,
      conversations: 0,
      connections: 0,
    };

    for (const row of data || []) {
      const type = row.type as string;
      if (type === 'voice_supported' || type === 'voice_commented') {
        counts.voices++;
      } else if (type === 'community_join' || type === 'community_activity') {
        counts.communities++;
      } else if (type === 'conversation_message') {
        counts.conversations++;
      } else if (type === 'connection_request' || type === 'connection_accepted') {
        counts.connections++;
      }
    }

    return counts;
  }

  subscribeToAlerts(
    userId: string,
    onAlert: (alert: CivicAlert) => void,
  ) {
    return socialClient
      .channel(`civic-alerts:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'civic_alerts',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload: any) => {
          onAlert(this.mapAlert(payload.new));
        },
      )
      .subscribe();
  }
}
