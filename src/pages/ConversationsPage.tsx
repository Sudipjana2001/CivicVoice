import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { ChatBubble } from '@/components/ChatBubble';
import { ConversationService } from '@/services/ConversationService';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, ArrowLeft, Loader2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ConversationMessage, ConversationSummary } from '@/lib/civicSocial';

const conversationService = ConversationService.getInstance();

export default function ConversationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeConversationId = searchParams.get('active');
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationService.listConversations(),
    enabled: !!user,
  });

  // Load messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoadingMessages(true);

    conversationService.listMessages(activeConversationId, 100).then((msgs) => {
      if (!cancelled) {
        setMessages(msgs);
        setLoadingMessages(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingMessages(false);
    });

    // Mark as seen
    conversationService.markConversationSeen(activeConversationId).catch(() => {});

    return () => { cancelled = true; };
  }, [activeConversationId]);

  // Subscribe to real-time messages
  useEffect(() => {
    if (!activeConversationId) return;

    const channel = conversationService.subscribeToConversation(
      activeConversationId,
      (newMessage) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
        conversationService.markConversationSeen(activeConversationId).catch(() => {});
      },
    );

    return () => {
      channel.unsubscribe();
    };
  }, [activeConversationId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!activeConversationId || !messageInput.trim() || sending) return;

    const body = messageInput.trim();
    setMessageInput('');
    setSending(true);

    try {
      const sent = await conversationService.sendMessage(activeConversationId, body);
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [...prev, sent];
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch {
      toast.error('Failed to send message');
      setMessageInput(body);
    } finally {
      setSending(false);
    }
  }, [activeConversationId, messageInput, sending, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container py-16 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-lg font-semibold mb-2">Sign in to view conversations</h2>
          <p className="text-sm text-muted-foreground mb-6">Message your connections securely</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-6">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Conversations</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[calc(100vh-14rem)]">
          {/* Conversation List */}
          <div className={cn(
            'border border-border/50 rounded-lg overflow-hidden',
            activeConversationId ? 'hidden md:block' : 'block'
          )}>
            <div className="p-3 border-b border-border/50 bg-muted/30">
              <h2 className="text-sm font-semibold">All Conversations</h2>
            </div>
            <ScrollArea className="h-[calc(100%-3rem)]">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Start from your connections</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <ConversationListItem
                    key={conv.id}
                    conversation={conv}
                    isActive={conv.id === activeConversationId}
                    onClick={() => setSearchParams({ active: conv.id })}
                  />
                ))
              )}
            </ScrollArea>
          </div>

          {/* Chat Area */}
          <div className={cn(
            'md:col-span-2 border border-border/50 rounded-lg flex flex-col overflow-hidden',
            !activeConversationId ? 'hidden md:flex' : 'flex'
          )}>
            {activeConversationId ? (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b border-border/50 bg-muted/30 flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearchParams({})}
                    className="h-8 w-8 md:hidden"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Conversation</span>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center">
                      <div>
                        <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-40" />
                        <p className="text-sm text-muted-foreground">No messages yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Start the conversation!</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messages.map((msg) => (
                        <ChatBubble
                          key={msg.id}
                          message={msg}
                          isOwn={msg.senderUserId === user.id}
                        />
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-3 border-t border-border/50 flex gap-2">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 h-9"
                    maxLength={1000}
                  />
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!messageInput.trim() || sending}
                    className="h-9 gap-1.5"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center p-8">
                <div>
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
                  <p className="text-sm text-muted-foreground">Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function ConversationListItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: ConversationSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 flex items-center gap-3 border-b border-border/30 transition-colors',
        isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
    >
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <User className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate capitalize">{conversation.conversationType} Chat</p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true })}
        </p>
      </div>
    </button>
  );
}
