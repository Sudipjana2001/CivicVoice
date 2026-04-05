import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bot,
  ExternalLink,
  Loader2,
  MapPin,
  Phone,
  Scale,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  X,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Post } from '@/lib/anonymity';
import {
  getIndiaStateLabel,
  INDIA_STATE_OPTIONS,
  parseLocationFromPost,
  POST_ASSISTANT_STATE_STORAGE_KEY,
  type IndiaAssistantResponse,
  type ChatMessage,
} from '@/lib/postAssistant';
import { PostAssistantService } from '@/services/PostAssistantService';
import { toast } from 'sonner';

interface PostAssistantPanelProps {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const postAssistantService = PostAssistantService.getInstance();

function getUrgencyBadgeVariant(urgency: IndiaAssistantResponse['urgency']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (urgency) {
    case 'emergency': return 'destructive';
    case 'priority': return 'default';
    default: return 'secondary';
  }
}

/* ─────────────────────────── Result sections ─────────────────────────── */

function AssistantResult({ result, onQuestionClick }: { result: IndiaAssistantResponse; onQuestionClick: (q: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={getUrgencyBadgeVariant(result.urgency)}>{result.urgency}</Badge>
          {result.topicTags.map((tag) => (
            <Badge key={tag} variant="outline" className="font-normal">{tag}</Badge>
          ))}
        </div>
        <h3 className="mt-3 text-base font-semibold text-foreground">{result.headline}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.whatThisPostAppearsToDescribe}</p>
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{result.whyItMayMatterInIndia}</p>
      </div>

      {result.safetyNote && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">Safety note</p>
              <p className="mt-1 text-sm text-muted-foreground">{result.safetyNote}</p>
            </div>
          </div>
        </div>
      )}

      {result.possibleLegalRoutes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Possible legal routes</h4>
          </div>
          <div className="space-y-3">
            {result.possibleLegalRoutes.map((route) => (
              <div key={route.title} className="rounded-xl border border-border/60 p-4">
                <p className="text-sm font-semibold text-foreground">{route.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{route.whyItMayApply}</p>
                <p className="mt-2 text-xs italic text-muted-foreground">{route.caution}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Immediate next steps</h4>
        </div>
        <ul className="space-y-2">
          {result.immediateNextSteps.map((step) => (
            <li key={step} className="rounded-xl border border-border/60 px-4 py-3 text-sm text-foreground/90">{step}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Evidence checklist</h4>
        </div>
        <ul className="space-y-2">
          {result.evidenceChecklist.map((item) => (
            <li key={item} className="rounded-xl border border-border/60 px-4 py-3 text-sm text-foreground/90">{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Official reporting options</h4>
        </div>
        <div className="space-y-3">
          {result.officialReportingOptions.map((option) => (
            <div key={`${option.authority}-${option.url ?? option.phone ?? option.reason}`} className="rounded-xl border border-border/60 p-4">
              <p className="text-sm font-semibold text-foreground">{option.authority}</p>
              <p className="mt-2 text-sm text-muted-foreground">{option.reason}</p>
              {(option.phone || option.url) && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {option.phone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />{option.phone}
                    </span>
                  )}
                  {option.url && (
                    <a href={option.url} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline">
                      Official link <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">{option.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Questions to ask next</h4>
        </div>
        <div className="flex flex-col gap-2">
          {result.questionsToAskLawyerOrAuthority.map((question) => (
            <button
              key={question}
              onClick={() => onQuestionClick(question)}
              className="rounded-xl border border-border/60 px-4 py-3 text-sm text-left text-foreground/90 hover:bg-muted/50 transition-colors"
            >
              {question}
            </button>
          ))}
        </div>
      </section>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
      </div>
    </div>
  );
}

function AssistantSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

/* ─────────────────────── Shared panel body ───────────────────────────── */

interface PanelBodyProps {
  post: Post;
  stateCode: string;
  district: string;
  result: IndiaAssistantResponse | null;
  isPending: boolean;
  configOpen: boolean;
  messages: ChatMessage[];
  chatInput: string;
  isChatting: boolean;
  onConfigOpenChange: (v: boolean) => void;
  onStateCodeChange: (v: string) => void;
  onDistrictChange: (v: string) => void;
  onAnalyze: () => void;
  onQuestionClick: (q: string) => void;
  setChatInput: (v: string) => void;
  onSendChat: () => void;
}

function PanelBody({
  post,
  stateCode,
  district,
  result,
  isPending,
  configOpen,
  messages,
  chatInput,
  isChatting,
  onConfigOpenChange,
  onStateCodeChange,
  onDistrictChange,
  onAnalyze,
  onQuestionClick,
  setChatInput,
  onSendChat,
}: PanelBodyProps) {
  const stateLabel = useMemo(() => getIndiaStateLabel(stateCode), [stateCode]);
  const hasResult = Boolean(result);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  return (
    <>
      {/* Config section — collapses after first analysis */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out shrink-0 border-b border-border/60"
        style={{ maxHeight: configOpen ? '500px' : '0px', opacity: configOpen ? 1 : 0, borderBottomWidth: configOpen ? '1px' : '0px' }}
      >
        <div className="space-y-4 px-5 py-4 sm:px-6">
          {/* Post info pill */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
            <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{post.anonymousId}</span>
              {post.location ? ` · ${post.location}` : ''}
            </p>
          </div>

          {/* State selector */}
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">State or Union Territory</label>
            <Select value={stateCode} onValueChange={onStateCodeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select state or UT" />
              </SelectTrigger>
              <SelectContent>
                {INDIA_STATE_OPTIONS.map((option) => (
                  <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* District */}
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">District or city (optional)</label>
            <Input
              value={district}
              onChange={(e) => onDistrictChange(e.target.value)}
              placeholder="e.g. Kolkata, Pune, Ernakulam"
            />
          </div>

          {/* Hint */}
          {!stateCode ? (
            <p className="text-xs text-muted-foreground">Choose a state or UT first so guidance stays India-specific.</p>
          ) : stateLabel ? (
            <p className="text-xs text-muted-foreground">
              Guidance will be framed for <span className="font-medium text-foreground">{stateLabel}</span>
              {district.trim() ? `, ${district.trim()}` : ''}.
            </p>
          ) : null}

          {/* Analyze button */}
          <Button onClick={onAnalyze} disabled={isPending || !stateCode} className="w-full">
            {isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Analyzing post…</>
            ) : (
              <><Bot className="h-4 w-4" />{hasResult ? 'Refresh analysis' : 'Analyze this post'}</>
            )}
          </Button>
        </div>
      </div>

      {/* Collapsed location bar — shown after config is hidden */}
      {!configOpen && (
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-xs text-muted-foreground">
              {stateLabel ?? 'No state selected'}{district.trim() ? `, ${district.trim()}` : ''}
            </span>
          </div>
          <button
            onClick={() => onConfigOpenChange(true)}
            className="ml-3 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Change
          </button>
        </div>
      )}

      {/* Scrollable results area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 pb-8 sm:px-6 flex flex-col">
        {isPending ? (
          <AssistantSkeleton />
        ) : result ? (
          <div className="flex flex-col gap-6">
            <AssistantResult result={result} onQuestionClick={onQuestionClick} />
            
            {/* Chat Messages */}
            {messages.length > 0 && (
              <div className="flex flex-col gap-4 mt-4 pt-4 border-t border-border/60">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-5 text-sm text-muted-foreground">
            Choose your state and run the assistant to get India-specific legal context, evidence tips, and official reporting routes for this post.
          </div>
        )}
      </div>
    </>
  );
}

/* ─────────────────────── Custom desktop modal ────────────────────────── */

interface DesktopModalProps extends PanelBodyProps {
  onClose: () => void;
}

function DesktopModal({ onClose, ...bodyProps }: DesktopModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Post Assistant"
        className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border/60 px-6 py-5">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight text-foreground">
              <Bot className="h-4 w-4 text-primary" />
              Post Assistant
            </h2>
            <p className="text-sm text-muted-foreground">
              India-only guidance · legal context · official routes
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — overflow-hidden so the inner scroll div is the only scroll surface */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <PanelBody {...bodyProps} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────────────── Main export ─────────────────────────────── */

export function PostAssistantPanel({ post, open, onOpenChange }: PostAssistantPanelProps) {
  const isMobile = useIsMobile();
  const [stateCode, setStateCode] = useState('');
  const [district, setDistrict] = useState('');
  const [result, setResult] = useState<IndiaAssistantResponse | null>(null);
  const [configOpen, setConfigOpen] = useState(true);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);

  const CHAT_STORAGE_KEY = `civicvoice.post-assistant.chat.${post.id}`;

  // Seed location from the post whenever it changes
  useEffect(() => {
    const parsed = parseLocationFromPost(post.location);
    if (parsed.stateCode) {
      setStateCode(parsed.stateCode);
      setDistrict(parsed.district);
    } else {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(POST_ASSISTANT_STATE_STORAGE_KEY) ?? '';
        if (stored) setStateCode(stored);
      }
      setDistrict(parsed.district);
    }
    setResult(null);
    setConfigOpen(true);
    
    // Load chat cache if any
    if (typeof window !== 'undefined') {
      const storedChat = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (storedChat) {
        try {
          setMessages(JSON.parse(storedChat));
        } catch (e) {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  }, [post.id, post.location, CHAT_STORAGE_KEY]);

  // Persist chosen state
  useEffect(() => {
    if (typeof window === 'undefined' || !stateCode) return;
    window.localStorage.setItem(POST_ASSISTANT_STATE_STORAGE_KEY, stateCode);
  }, [stateCode]);

  // Persist chat to sessionStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (messages.length > 0) {
      window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } else {
      window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
    }
  }, [messages, CHAT_STORAGE_KEY]);

  const mutation = useMutation({
    mutationFn: () => postAssistantService.analyze({ postId: post.id, stateCode, district }),
    onSuccess: (response) => setResult(response),
    onError: (error) => {
      console.error('Post assistant failed:', error);
      toast.error(error instanceof Error ? error.message : 'The assistant could not analyze this post right now.');
    },
  });

  const handleAnalyze = () => {
    if (!stateCode) {
      toast.error('Choose a state or union territory first.');
      return;
    }
    setConfigOpen(false);
    mutation.mutate();
  };

  const handleSendChat = async (overrideMsg?: string) => {
    const text = overrideMsg || chatInput;
    if (!text.trim() || isChatting) return;

    setChatInput('');
    setIsChatting(true);

    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text.trim() }
    ];
    setMessages(updatedMessages);

    try {
      const stream = postAssistantService.chatStream({
        postId: post.id,
        stateCode,
        district,
        messages: updatedMessages,
      });

      let assistantReply = '';
      setMessages([...updatedMessages, { role: 'assistant', content: '' }]);

      for await (const chunk of stream) {
        assistantReply += chunk;
        setMessages([
          ...updatedMessages,
          { role: 'assistant', content: assistantReply }
        ]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Chat failed.');
      // Revert user message if it failed completely
      if (messages.length === 0) setMessages([]);
    } finally {
      setIsChatting(false);
    }
  };

  const bodyProps: PanelBodyProps = {
    post,
    stateCode,
    district,
    result,
    isPending: mutation.isPending,
    configOpen,
    messages,
    chatInput,
    isChatting,
    onConfigOpenChange: setConfigOpen,
    onStateCodeChange: setStateCode,
    onDistrictChange: setDistrict,
    onAnalyze: handleAnalyze,
    onQuestionClick: (q) => handleSendChat(q),
    setChatInput,
    onSendChat: () => handleSendChat()
  };

  if (!open) return null;

  /* Mobile — bottom drawer */
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[92vh] flex-col p-0">
          <DrawerHeader className="shrink-0 border-b border-border/60 px-5 pb-4 pt-5 text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Post Assistant
            </DrawerTitle>
            <DrawerDescription>
              India-only guidance · legal context · official routes
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col">
            <PanelBody {...bodyProps} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  /* Desktop — centered modal via portal */
  return <DesktopModal {...bodyProps} onClose={() => onOpenChange(false)} />;
}
