-- ============================================
-- CivicVoice Global Search function
-- ============================================

CREATE OR REPLACE FUNCTION public.global_search(p_query TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_results JSON;
BEGIN
  -- Return empty structure if query is too short
  IF length(trim(p_query)) < 2 THEN
    RETURN '{"posts": [], "voices": [], "communities": [], "users": []}'::json;
  END IF;

  WITH 
  searched_posts AS (
    SELECT 
      id, 
      'Issue: ' || category as title, 
      content as description, 
      'post' as type, 
      created_at
    FROM public.posts
    WHERE status != 'closed'
      AND content ILIKE '%' || p_query || '%'
    ORDER BY created_at DESC
    LIMIT 5
  ),
  searched_voices AS (
    SELECT 
      id, 
      COALESCE(title, 'Voice') as title, 
      content as description, 
      'voice' as type, 
      created_at
    FROM public.voices
    WHERE status = 'active'
      AND (title ILIKE '%' || p_query || '%' OR content ILIKE '%' || p_query || '%')
    ORDER BY created_at DESC
    LIMIT 5
  ),
  searched_communities AS (
    SELECT 
      id, 
      name as title, 
      COALESCE(description, civic_focus) as description, 
      'community' as type, 
      slug,
      created_at
    FROM public.communities
    WHERE visibility = 'public'
      AND (name ILIKE '%' || p_query || '%' OR slug ILIKE '%' || p_query || '%' OR civic_focus ILIKE '%' || p_query || '%')
    ORDER BY member_count DESC, created_at DESC
    LIMIT 5
  ),
  searched_users AS (
    SELECT 
      p.user_id as id, 
      p.anonymous_id as title, 
      'Credibility: ' || p.credibility_level as description, 
      'user' as type, 
      p.created_at
    FROM public.profiles p
    WHERE p.anonymous_id ILIKE '%' || p_query || '%'
    ORDER BY p.credibility_score DESC, p.created_at DESC
    LIMIT 5
  )
  SELECT json_build_object(
    'posts', COALESCE((SELECT json_agg(row_to_json(searched_posts)) FROM searched_posts), '[]'::json),
    'voices', COALESCE((SELECT json_agg(row_to_json(searched_voices)) FROM searched_voices), '[]'::json),
    'communities', COALESCE((SELECT json_agg(row_to_json(searched_communities)) FROM searched_communities), '[]'::json),
    'users', COALESCE((SELECT json_agg(row_to_json(searched_users)) FROM searched_users), '[]'::json)
  ) INTO v_results;

  RETURN v_results;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.global_search(TEXT) TO authenticated;
