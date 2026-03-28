import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, FileText, Users, Mic, User, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchService, SearchResultItem } from '@/services/SearchService';

const searchService = SearchService.getInstance();

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setActiveTab('all');
    }
  }, [open]);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchService.searchAll(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 60000,
  });

  const handleSelect = (item: SearchResultItem) => {
    setOpen(false);
    switch (item.type) {
      case 'post':
        navigate(`/comments/${item.id}`);
        break;
      case 'voice':
        // Navigate to the global feed for voices (or community feed if we had a dedicated voice detail page)
        // Currently we don't have a single voice page, so let's send them to the feed where they can find it
        navigate(`/feed`);
        break;
      case 'community':
        navigate(`/communities/${item.slug}`);
        break;
      case 'user':
        // You'd typically navigate to their profile, but we don't have public profiles yet so we send to connections
        navigate(`/connections`);
        break;
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'post': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'voice': return <Mic className="h-4 w-4 text-emerald-500" />;
      case 'community': return <Users className="h-4 w-4 text-purple-500" />;
      case 'user': return <User className="h-4 w-4 text-orange-500" />;
      default: return null;
    }
  };

  const renderResultItem = (item: SearchResultItem) => (
    <div
      key={item.id}
      onClick={() => handleSelect(item)}
      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0"
    >
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        {renderIcon(item.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate">{item.description}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-50" />
    </div>
  );

  const getActiveResults = () => {
    if (!data) return [];
    if (activeTab === 'all') {
      return [...data.communities, ...data.users, ...data.voices, ...data.posts];
    }
    return data[activeTab as keyof typeof data] || [];
  };

  const activeResults = getActiveResults();
  const hasQuery = debouncedQuery.length >= 2;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground">
          <Search className="h-5 w-5" />
          <span className="sr-only">Search</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="fixed p-0 gap-0 overflow-hidden bg-background border-border flex flex-col w-full max-w-none h-[100dvh] top-0 left-0 translate-x-0 translate-y-0 rounded-none sm:w-[600px] sm:max-w-[600px] sm:h-[600px] sm:top-[10%] sm:left-[50%] sm:-translate-x-1/2 sm:translate-y-0 sm:rounded-lg sm:border">
        <DialogTitle className="sr-only">Global Search</DialogTitle>
        <div className="flex items-center border-b border-border/50 px-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search communities, voices, posts..."
            className="flex-1 border-0 focus-visible:ring-0 shadow-none h-14 bg-transparent text-base pr-4"
          />
          {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <div className="border-b border-border/50 px-3 overflow-x-auto no-scrollbar py-2">
            <TabsList className="h-9 w-full justify-start bg-transparent p-0 space-x-2 flex-nowrap min-w-max">
              <TabsTrigger value="all" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-full px-4 h-8 text-xs shrink-0">
                All
              </TabsTrigger>
              <TabsTrigger value="communities" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-500 rounded-full px-4 h-8 text-xs shrink-0">
                Communities
                {data?.communities && ` (${data.communities.length})`}
              </TabsTrigger>
              <TabsTrigger value="voices" className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-500 rounded-full px-4 h-8 text-xs shrink-0">
                Voices
                {data?.voices && ` (${data.voices.length})`}
              </TabsTrigger>
              <TabsTrigger value="posts" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 rounded-full px-4 h-8 text-xs shrink-0">
                Issues
                {data?.posts && ` (${data.posts.length})`}
              </TabsTrigger>
              <TabsTrigger value="users" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-500 rounded-full px-4 h-8 text-xs shrink-0">
                Users
                {data?.users && ` (${data.users.length})`}
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2">
              {!hasQuery && (
                <div className="text-center py-14 text-muted-foreground flex flex-col items-center">
                  <Search className="h-10 w-10 mb-4 opacity-20" />
                  <p className="text-sm font-medium">Search CivicVoice</p>
                  <p className="text-xs opacity-70 mt-1">Find local communities, read voices, or discover ongoing issues.</p>
                </div>
              )}
              {hasQuery && !isLoading && activeResults.length === 0 && (
                <div className="text-center py-14 text-muted-foreground">
                  <p className="text-sm">No results found for "{debouncedQuery}"</p>
                </div>
              )}
              {hasQuery && activeResults.length > 0 && (
                <div className="flex flex-col">
                  {activeResults.map(renderResultItem)}
                </div>
              )}
            </div>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
