import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ConnectionRequestCard, ConnectionCard } from '@/components/ConnectionCard';
import { ConnectionService } from '@/services/ConnectionService';
import { ConversationService } from '@/services/ConversationService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Users, Clock, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const connectionService = ConnectionService.getInstance();
const conversationService = ConversationService.getInstance();

export function ConnectionsView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [recipientId, setRecipientId] = useState('');
  const [note, setNote] = useState('');

  const { data: requests = [], isLoading: loadingRequests } = useQuery({
    queryKey: ['connection-requests'],
    queryFn: () => connectionService.listRequests(),
    enabled: !!user,
  });

  const { data: connections = [], isLoading: loadingConnections } = useQuery({
    queryKey: ['connections'],
    queryFn: () => connectionService.listConnections(),
    enabled: !!user,
  });

  const sendMutation = useMutation({
    mutationFn: (params: { recipientId: string; note?: string }) =>
      connectionService.sendRequest(params.recipientId, params.note),
    onSuccess: () => {
      toast.success('Connection request sent!');
      setRecipientId('');
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send request');
    },
  });

  const respondMutation = useMutation({
    mutationFn: (params: { requestId: string; action: 'accepted' | 'rejected' | 'cancelled' }) =>
      connectionService.respondToRequest(params.requestId, params.action),
    onSuccess: (_, vars) => {
      toast.success(
        vars.action === 'accepted' ? 'Connection accepted!' :
        vars.action === 'rejected' ? 'Request declined' : 'Request cancelled'
      );
      queryClient.invalidateQueries({ queryKey: ['connection-requests'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
    onError: () => {
      toast.error('Action failed. Please try again.');
    },
  });

  const handleMessage = useCallback(async (userId: string) => {
    try {
      const conversationId = await conversationService.ensureDirectConversation(userId);
      navigate(`/conversations?active=${conversationId}`);
    } catch {
      toast.error('Could not start a conversation');
    }
  }, [navigate]);

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  if (!user) {
    return (
      <div className="text-center py-16">
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-lg font-semibold mb-2">Sign in to manage connections</h2>
        <p className="text-sm text-muted-foreground mb-6">Connect with fellow civic activists</p>
        <Button onClick={() => navigate('/auth')}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            My Connections
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {connections.length} connection{connections.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <Tabs defaultValue="connections" className="space-y-4">
        <TabsList className="bg-transparent border-b border-border w-full justify-start rounded-none h-auto p-0 space-x-6">
          <TabsTrigger 
            value="connections" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 data-[state=active]:shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground"
          >
            Connected
          </TabsTrigger>
          <TabsTrigger 
            value="requests" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 data-[state=active]:shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground relative"
          >
            Requests
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-3 h-[18px] min-w-[18px] rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger 
            value="add" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2 data-[state=active]:shadow-none font-medium text-muted-foreground data-[state=active]:text-foreground"
          >
            Add
          </TabsTrigger>
        </TabsList>

        {/* Connections Tab */}
        <TabsContent value="connections" className="pt-2 space-y-3">
          {loadingConnections ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <div className="text-center py-12 glass-card">
              <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No connections yet</p>
              <p className="text-xs text-muted-foreground mt-1">Start connecting with civic-minded people</p>
            </div>
          ) : (
            connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                onMessage={handleMessage}
              />
            ))
          )}
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="pt-2 space-y-3">
          {loadingRequests ? (
            <div className="text-center py-12">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="text-center py-12 glass-card">
              <Clock className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No pending requests</p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <ConnectionRequestCard
                key={req.id}
                request={req}
                currentUserId={user.id}
                onAccept={(id) => respondMutation.mutate({ requestId: id, action: 'accepted' })}
                onReject={(id) => respondMutation.mutate({ requestId: id, action: 'rejected' })}
                onCancel={(id) => respondMutation.mutate({ requestId: id, action: 'cancelled' })}
                isLoading={respondMutation.isPending}
              />
            ))
          )}
        </TabsContent>

        {/* Add Connection Tab */}
        <TabsContent value="add" className="pt-2 space-y-4">
          <div className="glass-card p-5 space-y-4 max-w-xl">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              Send Connection Request
            </h3>
            <div className="space-y-3">
              <Input
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                placeholder="Enter user ID to connect with..."
                className="h-10"
              />
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add a note (optional)..."
                className="h-10"
                maxLength={200}
              />
              <Button
                onClick={() => sendMutation.mutate({ recipientId, note: note || undefined })}
                disabled={!recipientId.trim() || sendMutation.isPending}
                className="w-full gap-2"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Request
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
