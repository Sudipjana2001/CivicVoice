import { useState, useEffect, useCallback } from 'react';
import { 
  Inbox, 
  Mail, 
  MailOpen,
  Shield,
  Building2,
  Newspaper,
  Users,
  Lock,
  AlertTriangle,
  Trash2,
  Reply,
  Loader2,
  LogIn,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { InboxService } from '@/services/InboxService';
import type { InboxMessage } from '@/services/InboxService';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { getAnonymousSession } from '@/lib/anonymity';
import { Link } from 'react-router-dom';

type SenderType = 'ngo' | 'journalist' | 'moderator';

const inboxService = InboxService.getInstance();

const senderConfig: Record<SenderType, { icon: React.ElementType; color: string; bgColor: string }> = {
  ngo: { icon: Building2, color: 'text-credible', bgColor: 'bg-credible/10' },
  journalist: { icon: Newspaper, color: 'text-primary', bgColor: 'bg-primary/10' },
  moderator: { icon: Users, color: 'text-severity-medium', bgColor: 'bg-severity-medium/10' },
};

interface AnonymousInboxProps {
  className?: string;
}

export function AnonymousInbox({ className }: AnonymousInboxProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [replyEnabled, setReplyEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const session = getAnonymousSession();

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await inboxService.fetchMessages(session.id);
      setMessages(data);
    } catch (error) {
      console.error('Error fetching inbox messages:', error);
    }
    setLoading(false);
  }, [session.id]);

  useEffect(() => {
    if (user) fetchMessages();
    else setLoading(false);
  }, [user, fetchMessages]);

  const unreadCount = messages.filter(m => !m.read).length;

  const markAsRead = async (messageId: string) => {
    await inboxService.markMessageRead(messageId);
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
  };

  const deleteMessage = async (messageId: string) => {
    await inboxService.deleteMessage(messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
    if (selectedMessage?.id === messageId) setSelectedMessage(null);
  };

  const toggleReply = (messageId: string) => {
    setReplyEnabled(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const handleSelectMessage = (message: InboxMessage) => {
    setSelectedMessage(message);
    markAsRead(message.id);
  };

  // Auth gate
  if (!user) {
    return (
      <div className={className}>
        <Card className="glass-card overflow-hidden">
          <CardHeader className="border-b border-border/50">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Anonymous Inbox</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-8 text-center">
            <LogIn className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">Sign in to access your secure inbox</p>
            <Link to="/auth">
              <Button variant="outline" className="gap-2">
                <LogIn className="h-4 w-4" />
                Sign In
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render message detail (used in both mobile full-screen and desktop panel)
  const renderMessageDetail = () => {
    if (!selectedMessage) return null;
    const config = senderConfig[selectedMessage.senderType];
    const Icon = config.icon;

    return (
      <div className="h-full flex flex-col">
        <div className="p-3 sm:p-4 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center`}>
                  <Icon className={`h-3 w-3 ${config.color}`} />
                </div>
                <Badge variant="outline" className="text-xs">{selectedMessage.senderLabel}</Badge>
              </div>
              <h4 className="font-medium text-sm sm:text-base">{selectedMessage.subject}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDistanceToNow(selectedMessage.timestamp, { addSuffix: true })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => deleteMessage(selectedMessage.id)} className="text-muted-foreground hover:text-destructive h-8 w-8">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1 p-3 sm:p-4">
          <p className="text-sm text-foreground/90 leading-relaxed">{selectedMessage.content}</p>
          {selectedMessage.relatedPostId && (
            <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs text-muted-foreground">Related to incident:</p>
              <Button variant="link" size="sm" className="h-auto p-0 text-primary">
                View incident #{selectedMessage.relatedPostId.substring(0, 8)}
              </Button>
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-3 sm:p-4 bg-muted/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-severity-medium flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <Label htmlFor={`reply-${selectedMessage.id}`} className="text-sm font-medium">Enable replies</Label>
                <Switch id={`reply-${selectedMessage.id}`} checked={replyEnabled[selectedMessage.id] || false} onCheckedChange={() => toggleReply(selectedMessage.id)} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {replyEnabled[selectedMessage.id]
                  ? 'Replies enabled. Your identity remains protected.'
                  : 'Replies disabled to protect your anonymity.'}
              </p>
              {replyEnabled[selectedMessage.id] && (
                <Button size="sm" className="mt-2 gap-1" variant="outline"><Reply className="h-3 w-3" />Compose Reply</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render message list
  const renderMessageList = () => (
    <div className="divide-y divide-border/50">
      {messages.map((message) => {
        const config = senderConfig[message.senderType];
        const MsgIcon = config.icon;
        return (
          <button
            key={message.id}
            onClick={() => handleSelectMessage(message)}
            className={`w-full p-3 text-left hover:bg-muted/50 transition-colors ${
              selectedMessage?.id === message.id ? 'bg-muted/50' : ''
            } ${!message.read ? 'bg-primary/5' : ''}`}
          >
            <div className="flex items-start gap-2">
              <div className={`w-6 h-6 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                <MsgIcon className={`h-3 w-3 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!message.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                  <p className="text-xs text-muted-foreground truncate">{message.senderLabel}</p>
                </div>
                <p className={`text-sm truncate ${!message.read ? 'font-medium' : ''}`}>{message.subject}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{message.preview}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={className}>
      <Card className="glass-card overflow-hidden">
        <CardHeader className="border-b border-border/50 px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isMobile && selectedMessage && (
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-1" onClick={() => setSelectedMessage(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <Inbox className="h-5 w-5 text-primary" />
              <CardTitle className="text-base sm:text-lg">Anonymous Inbox</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-primary/20 text-primary text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
            <Lock className="h-3 w-3" />
            One-way secure messaging from verified organizations
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {/* Mobile: full-screen toggle between list and detail */}
          {isMobile ? (
            <div className="h-[400px]">
              {loading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No messages</p>
                </div>
              ) : selectedMessage ? (
                renderMessageDetail()
              ) : (
                <ScrollArea className="h-full">
                  {renderMessageList()}
                </ScrollArea>
              )}
            </div>
          ) : (
            /* Desktop: side-by-side layout */
            <div className="flex h-[400px]">
              <ScrollArea className="w-2/5 border-r border-border/50">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p className="text-sm">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No messages</p>
                  </div>
                ) : (
                  renderMessageList()
                )}
              </ScrollArea>
              <div className="w-3/5">
                {selectedMessage ? (
                  renderMessageDetail()
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <MailOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Select a message to read</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-3 border-t border-border/50 bg-muted/10">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
              <span>All messages are encrypted. Senders cannot identify you.</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
