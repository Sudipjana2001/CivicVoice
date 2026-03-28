import { supabase } from '@/integrations/supabase/client';

export interface SearchResultItem {
  id: string;
  title: string;
  description: string;
  type: 'post' | 'voice' | 'community' | 'user';
  slug?: string; // specific to community
  created_at: string;
}

export interface GroupedSearchResults {
  posts: SearchResultItem[];
  voices: SearchResultItem[];
  communities: SearchResultItem[];
  users: SearchResultItem[];
}

export class SearchService {
  private static instance: SearchService;

  private constructor() {}

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  async searchAll(query: string): Promise<GroupedSearchResults> {
    if (!query || query.trim().length < 2) {
      return { posts: [], voices: [], communities: [], users: [] };
    }

    const { data, error } = await supabase.rpc('global_search' as any, {
      p_query: query.trim(),
    });

    if (error) {
      console.error('Search error:', error);
      throw new Error('Failed to perform global search');
    }

    // The RPC returns a JSON object containing the grouped results
    return (data as unknown) as GroupedSearchResults;
  }
}
