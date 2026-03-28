import { supabase } from '@/integrations/supabase/client';
import type {
  CivicConnection,
  ConnectionRequest,
  ConnectionRequestAction,
} from '@/lib/civicSocial';

const socialClient = supabase as any;

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export class ConnectionService {
  private static instance: ConnectionService;

  private constructor() {}

  static getInstance(): ConnectionService {
    if (!ConnectionService.instance) {
      ConnectionService.instance = new ConnectionService();
    }

    return ConnectionService.instance;
  }

  private mapRequest(row: any): ConnectionRequest {
    return {
      id: row.id,
      requesterUserId: row.requester_user_id,
      recipientUserId: row.recipient_user_id,
      note: row.note ?? undefined,
      status: row.status,
      respondedAt: row.responded_at ? new Date(row.responded_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapConnection(row: any): CivicConnection {
    return {
      id: row.id,
      userId: row.user_id,
      connectionUserId: row.connection_user_id,
      sourceRequestId: row.source_request_id ?? undefined,
      createdAt: new Date(row.created_at),
    };
  }

  async listRequests(): Promise<ConnectionRequest[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await socialClient
      .from('connection_requests')
      .select('*')
      .or(`requester_user_id.eq.${user.id},recipient_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => this.mapRequest(row));
  }

  async listConnections(): Promise<CivicConnection[]> {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await socialClient
      .from('user_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => this.mapConnection(row));
  }

  async sendRequest(recipientUserId: string, note?: string): Promise<ConnectionRequest> {
    const { data, error } = await socialClient.rpc('send_connection_request', {
      p_recipient_user_id: recipientUserId,
      p_note: note?.trim() || null,
    });

    if (error) throw error;

    const row = firstRow(data);
    if (!row) {
      throw new Error('Connection request creation returned no data');
    }

    return this.mapRequest(row);
  }

  async respondToRequest(requestId: string, action: ConnectionRequestAction): Promise<ConnectionRequest> {
    const { data, error } = await socialClient.rpc('respond_to_connection_request', {
      p_request_id: requestId,
      p_action: action,
    });

    if (error) throw error;

    const row = firstRow(data);
    if (!row) {
      throw new Error('Connection request update returned no data');
    }

    return this.mapRequest(row);
  }
}
