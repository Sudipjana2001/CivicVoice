import { supabase } from '@/integrations/supabase/client';

interface InboxMessage {
  id: string;
  senderType: 'ngo' | 'journalist' | 'moderator';
  senderLabel: string;
  subject: string;
  preview: string;
  content: string;
  relatedPostId?: string;
  timestamp: Date;
  read: boolean;
}

interface Alert {
  id: string;
  type: 'new_incident' | 'status_change' | 'follow_up';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  topic?: { type: 'location' | 'category'; value: string; label: string };
  incidentId?: string;
}

/**
 * InboxService - Handles inbox message and alert operations.
 * Uses the Singleton pattern.
 */
export class InboxService {
  private static instance: InboxService;

  private constructor() {}

  static getInstance(): InboxService {
    if (!InboxService.instance) {
      InboxService.instance = new InboxService();
    }
    return InboxService.instance;
  }

  // ── Inbox Messages ──────────────────────────────────────

  /** Fetch inbox messages for a given anonymous ID. */
  async fetchMessages(anonymousId: string): Promise<InboxMessage[]> {
    const { data, error } = await supabase
      .from('inbox_messages')
      .select('*')
      .eq('recipient_anonymous_id', anonymousId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      senderType: row.sender_type as InboxMessage['senderType'],
      senderLabel: row.sender_label,
      subject: row.subject,
      preview: row.preview,
      content: row.content,
      relatedPostId: row.related_post_id || undefined,
      timestamp: new Date(row.created_at),
      read: row.read,
    }));
  }

  /** Mark a message as read. */
  async markMessageRead(messageId: string): Promise<void> {
    await supabase
      .from('inbox_messages')
      .update({ read: true })
      .eq('id', messageId);
  }

  /** Delete a message. */
  async deleteMessage(messageId: string): Promise<void> {
    await supabase
      .from('inbox_messages')
      .delete()
      .eq('id', messageId);
  }

  // ── Alerts ──────────────────────────────────────────────

  /** Fetch alerts for a given anonymous ID. */
  async fetchAlerts(anonymousId: string): Promise<Alert[]> {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .eq('recipient_anonymous_id', anonymousId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      type: row.type as Alert['type'],
      title: row.title,
      description: row.description,
      timestamp: new Date(row.created_at),
      read: row.read,
      topic: row.topic_type ? {
        type: row.topic_type as 'location' | 'category',
        value: row.topic_value || '',
        label: row.topic_label || '',
      } : undefined,
      incidentId: row.incident_id || undefined,
    }));
  }

  /** Mark an alert as read. */
  async markAlertRead(alertId: string): Promise<void> {
    await supabase
      .from('alerts')
      .update({ read: true })
      .eq('id', alertId);
  }

  /** Mark multiple alerts as read. */
  async markAlertsRead(alertIds: string[]): Promise<void> {
    if (alertIds.length === 0) return;
    await supabase
      .from('alerts')
      .update({ read: true })
      .in('id', alertIds);
  }

  /** Delete an alert. */
  async deleteAlert(alertId: string): Promise<void> {
    await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId);
  }
}

export type { InboxMessage, Alert };
