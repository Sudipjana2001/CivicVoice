import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Mic,
  Search,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { GroupedSearchResults, SearchService, SearchResultItem } from '@/services/SearchService';

const searchService = SearchService.getInstance();

type SearchTab = 'all' | keyof GroupedSearchResults;
type PanelMode = 'desktop' | 'mobile';

const SEARCH_SECTIONS: Array<{
  key: keyof GroupedSearchResults;
  label: string;
  badgeLabel: string;
  itemType: SearchResultItem['type'];
  icon: LucideIcon;
  accentClass: string;
  bubbleClass: string;
  badgeClass: string;
  helperText: string;
}> = [
  {
    key: 'communities',
    label: 'Communities',
    badgeLabel: 'Community',
    itemType: 'community',
    icon: Users,
    accentClass: 'text-violet-600 dark:text-violet-300',
    bubbleClass: 'bg-violet-500/10',
    badgeClass: 'data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-700 dark:data-[state=active]:text-violet-200',
    helperText: 'Jump into city groups, neighborhoods, and community-led spaces.',
  },
  {
    key: 'voices',
    label: 'Voices',
    badgeLabel: 'Voice',
    itemType: 'voice',
    icon: Mic,
    accentClass: 'text-emerald-600 dark:text-emerald-300',
    bubbleClass: 'bg-emerald-500/10',
    badgeClass: 'data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-200',
    helperText: 'Surface local stories, eyewitness updates, and ongoing threads.',
  },
  {
    key: 'posts',
    label: 'Issues',
    badgeLabel: 'Issue',
    itemType: 'post',
    icon: FileText,
    accentClass: 'text-sky-600 dark:text-sky-300',
    bubbleClass: 'bg-sky-500/10',
    badgeClass: 'data-[state=active]:bg-sky-500/10 data-[state=active]:text-sky-700 dark:data-[state=active]:text-sky-200',
    helperText: 'Scan reports, incidents, and updates that need attention.',
  },
  {
    key: 'users',
    label: 'Users',
    badgeLabel: 'User',
    itemType: 'user',
    icon: User,
    accentClass: 'text-orange-600 dark:text-orange-300',
    bubbleClass: 'bg-orange-500/10',
    badgeClass: 'data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-200',
    helperText: 'Find people you have connected with or interacted with nearby.',
  },
];

const getSectionForType = (type: SearchResultItem['type']) =>
  SEARCH_SECTIONS.find((section) => section.itemType === type);

export function GlobalSearch() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const navigate = useNavigate();
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchRef = useRef<HTMLDivElement>(null);

  const resetSearch = () => {
    setQuery('');
    setDebouncedQuery('');
    setActiveTab('all');
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!query.trim()) {
      setActiveTab('all');
    }
  }, [query]);

  useEffect(() => {
    if (mobileOpen) {
      setTimeout(() => mobileInputRef.current?.focus(), 50);
    } else if (isMobile) {
      resetSearch();
    }
  }, [isMobile, mobileOpen]);

  useEffect(() => {
    if (isMobile) {
      setDesktopOpen(false);
    } else {
      setMobileOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || !desktopOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!desktopSearchRef.current?.contains(event.target as Node)) {
        setDesktopOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [desktopOpen, isMobile]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();

        if (isMobile) {
          setMobileOpen(true);
          return;
        }

        setDesktopOpen(true);
        setTimeout(() => {
          desktopInputRef.current?.focus();
          desktopInputRef.current?.select();
        }, 0);
      }

      if (!isMobile && event.key === 'Escape' && desktopOpen) {
        setDesktopOpen(false);
        desktopInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [desktopOpen, isMobile]);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => searchService.searchAll(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 60000,
  });

  const closeSearch = () => {
    setDesktopOpen(false);
    setMobileOpen(false);
    resetSearch();
  };

  const handleSelect = (item: SearchResultItem) => {
    closeSearch();

    switch (item.type) {
      case 'post':
        navigate(`/comments/${item.id}`);
        break;
      case 'voice':
        navigate('/feed');
        break;
      case 'community':
        navigate(`/communities/${item.slug}`);
        break;
      case 'user':
        navigate('/connections');
        break;
      default:
        break;
    }
  };

  const visibleSections = useMemo(
    () => SEARCH_SECTIONS.filter((section) => (data?.[section.key].length ?? 0) > 0),
    [data],
  );

  const totalResults = useMemo(
    () => SEARCH_SECTIONS.reduce((sum, section) => sum + (data?.[section.key].length ?? 0), 0),
    [data],
  );

  const activeResults = useMemo(() => {
    if (!data) {
      return [];
    }

    if (activeTab === 'all') {
      return SEARCH_SECTIONS.flatMap((section) => data[section.key]);
    }

    return data[activeTab];
  }, [activeTab, data]);

  const hasQuery = debouncedQuery.trim().length >= 2;
  const hasResults = totalResults > 0;
  const activeSection = activeTab === 'all' ? null : SEARCH_SECTIONS.find((section) => section.key === activeTab);

  const renderResultItem = (item: SearchResultItem) => {
    const section = getSectionForType(item.type);
    const Icon = section?.icon ?? Search;

    return (
      <button
        type="button"
        key={item.id}
        onClick={() => handleSelect(item)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-transparent bg-background px-3 py-3 text-left transition-all hover:border-border hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', section?.bubbleClass ?? 'bg-muted')}>
          <Icon className={cn('h-4 w-4', section?.accentClass ?? 'text-muted-foreground')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            {section && (
              <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:inline-flex">
                {section.badgeLabel}
              </span>
            )}
          </div>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">{item.description}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-50 transition-transform group-hover:translate-x-0.5" />
      </button>
    );
  };

  const renderPanel = (mode: PanelMode) => {
    const isDesktopPanel = mode === 'desktop';

    return (
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SearchTab)} className="flex min-h-0 flex-1 flex-col">
        <div className={cn('border-b border-border/60 px-4 py-4', isDesktopPanel && 'bg-gradient-to-b from-primary/10 via-background to-background')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Search results</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isLoading && hasQuery
                  ? 'Searching across CivicVoice...'
                  : hasQuery
                    ? `${totalResults} result${totalResults === 1 ? '' : 's'} across ${visibleSections.length} ${visibleSections.length === 1 ? 'category' : 'categories'}`
                    : ''}
              </p>
            </div>
            {hasQuery && (
              <span className="rounded-full border border-border/70 bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                {totalResults} found
              </span>
            )}
          </div>

          <TabsList className="mt-4 h-auto w-full justify-start gap-2 overflow-x-auto bg-transparent p-0 scrollbar-hide">
            <TabsTrigger
              value="all"
              className="h-9 shrink-0 rounded-full px-4 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              All
            </TabsTrigger>
            {SEARCH_SECTIONS.map((section) => (
              <TabsTrigger
                key={section.key}
                value={section.key}
                className={cn('h-9 shrink-0 rounded-full px-4 text-xs', section.badgeClass)}
              >
                {section.label}
                {data?.[section.key] ? ` (${data[section.key].length})` : ''}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <ScrollArea className={cn('flex-1', isDesktopPanel && 'max-h-[28rem]')}>
          <div className="p-4">
            {!hasQuery && (
              <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 px-6 text-center text-muted-foreground">
                <Search className="mb-4 h-10 w-10 opacity-25" />
                <p className="text-base font-medium text-foreground">Search without leaving the page</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed">
                  Start typing right here and results will appear below the field instead of opening a new window.
                </p>
              </div>
            )}

            {hasQuery && isLoading && (
              <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 px-6 text-center text-muted-foreground">
                <Loader2 className="mb-4 h-8 w-8 animate-spin" />
                <p className="text-sm font-medium text-foreground">Searching for "{debouncedQuery}"</p>
              </div>
            )}

            {hasQuery && !isLoading && !hasResults && (
              <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 px-6 text-center text-muted-foreground">
                <p className="text-base font-medium text-foreground">No results found</p>
                <p className="mt-2 text-sm leading-relaxed">Try a broader location, topic, or keyword for "{debouncedQuery}".</p>
              </div>
            )}

            {hasQuery && !isLoading && activeTab === 'all' && hasResults && (
              <div className="space-y-6">
                {visibleSections.map((section) => {
                  const Icon = section.icon;
                  const sectionResults = data?.[section.key] ?? [];

                  return (
                    <section key={section.key} className="space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', section.bubbleClass)}>
                            <Icon className={cn('h-4 w-4', section.accentClass)} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{section.label}</p>
                            <p className="text-xs text-muted-foreground">{section.helperText}</p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{sectionResults.length} found</span>
                      </div>

                      <div className="space-y-2">{sectionResults.map(renderResultItem)}</div>
                    </section>
                  );
                })}
              </div>
            )}

            {hasQuery && !isLoading && activeTab !== 'all' && activeResults.length > 0 && activeSection && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{activeSection.label}</p>
                    <p className="text-xs text-muted-foreground">Focused results for "{debouncedQuery}"</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    {activeResults.length} result{activeResults.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-2">{activeResults.map(renderResultItem)}</div>
              </div>
            )}

            {hasQuery && !isLoading && activeTab !== 'all' && activeResults.length === 0 && activeSection && hasResults && (
              <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-border/70 bg-muted/20 px-6 text-center text-muted-foreground">
                <p className="text-base font-medium text-foreground">No {activeSection.label.toLowerCase()} matches</p>
                <p className="mt-2 text-sm leading-relaxed">Try the `All` tab to see results from other categories.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </Tabs>
    );
  };

  return (
    <>
      <div ref={desktopSearchRef} className="relative hidden lg:block">
        <div
          className={cn(
            'flex h-11 w-[21rem] items-center gap-3 rounded-full border border-border/70 bg-background/90 px-4 shadow-sm transition-all',
            desktopOpen && 'border-primary/40 shadow-md ring-2 ring-primary/10',
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            ref={desktopInputRef}
            type="search"
            value={query}
            onFocus={() => setDesktopOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setDesktopOpen(true);
            }}
            placeholder="Search CivicVoice"
            className="h-full border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:cursor-pointer"
          />
          {isLoading && hasQuery && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>

        {desktopOpen && (
          <div className="absolute right-0 top-full z-50 mt-3 w-[min(92vw,44rem)] overflow-hidden rounded-[1.5rem] border border-border bg-background shadow-2xl">
            {renderPanel('desktop')}
          </div>
        )}
      </div>

      <Dialog
        open={mobileOpen}
        onOpenChange={(nextOpen) => {
          setMobileOpen(nextOpen);
          if (!nextOpen) {
            resetSearch();
          }
        }}
      >
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground lg:hidden">
            <Search className="h-5 w-5" />
            <span className="sr-only">Search</span>
          </Button>
        </DialogTrigger>
        <DialogContent hideClose className="fixed left-0 top-0 flex h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 shadow-none sm:left-[50%] sm:top-[50%] sm:h-[min(85vh,42rem)] sm:w-[92vw] sm:max-w-[42rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.5rem] sm:border sm:border-border sm:shadow-2xl">
          <DialogTitle className="sr-only">Global Search</DialogTitle>
          <div className="border-b border-border/60 px-2 pb-3 pt-4 sm:px-4 sm:pt-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground outline-none transition-colors"
                aria-label="Go back"
              >
                <ChevronLeft className="h-6 w-6 shrink-0" />
              </button>
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-border/70 bg-muted/40 px-4 shadow-sm">
                <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
                <Input
                ref={mobileInputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search communities, voices, issues, and people..."
                className="h-14 flex-1 border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-search-cancel-button]:cursor-pointer"
              />
              {isLoading && hasQuery && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>

          {renderPanel('mobile')}
        </DialogContent>
      </Dialog>
    </>
  );
}
