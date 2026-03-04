-- Security, consistency, and atomicity fixes

-- 1) Make comments.post_id strongly typed and enforce FK to posts
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'comments'
      AND column_name = 'post_id'
      AND data_type <> 'uuid'
  ) THEN
    ALTER TABLE public.comments
      ALTER COLUMN post_id TYPE uuid
      USING post_id::uuid;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'comments_post_id_fkey'
  ) THEN
    ALTER TABLE public.comments
      ADD CONSTRAINT comments_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2) Replace permissive write policies on posts with owner-only updates/deletes
DROP POLICY IF EXISTS "Anyone can update posts" ON public.posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON public.posts;
CREATE POLICY "Users can update their own posts"
ON public.posts FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON public.posts;
CREATE POLICY "Users can delete their own posts"
ON public.posts FOR DELETE
USING (auth.uid() = user_id);

-- 3) Lock down direct vote mutations; use RPC only
DROP POLICY IF EXISTS "Anyone can insert votes" ON public.votes;
DROP POLICY IF EXISTS "Anyone can update votes" ON public.votes;
DROP POLICY IF EXISTS "Anyone can delete votes" ON public.votes;

-- Keep read policy for analytics, but restrict writes through functions below.
DROP POLICY IF EXISTS "Anyone can view votes" ON public.votes;
CREATE POLICY "Anyone can view votes"
ON public.votes FOR SELECT
USING (true);

-- 4) Restrict inbox/alerts to owners of corresponding anonymous IDs
DROP POLICY IF EXISTS "Anyone can view their inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Anyone can update inbox messages" ON public.inbox_messages;
DROP POLICY IF EXISTS "Anyone can delete inbox messages" ON public.inbox_messages;

CREATE POLICY "Users can view their inbox messages"
ON public.inbox_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND p.anonymous_id = inbox_messages.recipient_anonymous_id
  )
);

CREATE POLICY "Users can update their inbox messages"
ON public.inbox_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND p.anonymous_id = inbox_messages.recipient_anonymous_id
  )
);

CREATE POLICY "Users can delete their inbox messages"
ON public.inbox_messages FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND p.anonymous_id = inbox_messages.recipient_anonymous_id
  )
);

DROP POLICY IF EXISTS "Anyone can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Anyone can update alerts" ON public.alerts;
DROP POLICY IF EXISTS "Anyone can delete alerts" ON public.alerts;

CREATE POLICY "Users can view their alerts"
ON public.alerts FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND p.anonymous_id = alerts.recipient_anonymous_id
  )
);

CREATE POLICY "Users can update their alerts"
ON public.alerts FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND p.anonymous_id = alerts.recipient_anonymous_id
  )
);

CREATE POLICY "Users can delete their alerts"
ON public.alerts FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.user_id = auth.uid()
      AND p.anonymous_id = alerts.recipient_anonymous_id
  )
);

-- 5) Atomic comment creation + post comment_count increment
CREATE OR REPLACE FUNCTION public.create_comment_and_increment(
  p_post_id uuid,
  p_content text
)
RETURNS public.comments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment public.comments;
BEGIN
  INSERT INTO public.comments (post_id, content)
  VALUES (p_post_id, trim(p_content))
  RETURNING * INTO v_comment;

  UPDATE public.posts
  SET comment_count = comment_count + 1
  WHERE id = p_post_id;

  RETURN v_comment;
END;
$$;

-- 6) Atomic vote toggle + count updates
CREATE OR REPLACE FUNCTION public.get_user_vote(
  p_post_id uuid,
  p_voter_id text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vote text;
BEGIN
  SELECT vote_type
  INTO v_vote
  FROM public.votes
  WHERE post_id = p_post_id
    AND voter_id = p_voter_id
  LIMIT 1;

  RETURN v_vote;
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_vote_and_update_counts(
  p_post_id uuid,
  p_voter_id text,
  p_vote_type text
)
RETURNS TABLE (
  new_vote text,
  credible_votes integer,
  suspicious_votes integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_vote text;
  v_credible integer;
  v_suspicious integer;
BEGIN
  IF p_vote_type NOT IN ('credible', 'suspicious') THEN
    RAISE EXCEPTION 'Invalid vote type: %', p_vote_type;
  END IF;

  SELECT vote_type INTO v_current_vote
  FROM public.votes
  WHERE post_id = p_post_id
    AND voter_id = p_voter_id
  LIMIT 1;

  SELECT p.credible_votes, p.suspicious_votes
  INTO v_credible, v_suspicious
  FROM public.posts p
  WHERE p.id = p_post_id
  FOR UPDATE;

  IF v_current_vote = p_vote_type THEN
    DELETE FROM public.votes
    WHERE post_id = p_post_id
      AND voter_id = p_voter_id;

    IF p_vote_type = 'credible' THEN
      v_credible := GREATEST(0, v_credible - 1);
    ELSE
      v_suspicious := GREATEST(0, v_suspicious - 1);
    END IF;

    new_vote := NULL;
  ELSE
    IF v_current_vote IS NULL THEN
      INSERT INTO public.votes (post_id, voter_id, vote_type)
      VALUES (p_post_id, p_voter_id, p_vote_type);
    ELSE
      UPDATE public.votes
      SET vote_type = p_vote_type
      WHERE post_id = p_post_id
        AND voter_id = p_voter_id;
    END IF;

    IF v_current_vote = 'credible' THEN
      v_credible := GREATEST(0, v_credible - 1);
    ELSIF v_current_vote = 'suspicious' THEN
      v_suspicious := GREATEST(0, v_suspicious - 1);
    END IF;

    IF p_vote_type = 'credible' THEN
      v_credible := v_credible + 1;
    ELSE
      v_suspicious := v_suspicious + 1;
    END IF;

    new_vote := p_vote_type;
  END IF;

  UPDATE public.posts
  SET credible_votes = v_credible,
      suspicious_votes = v_suspicious
  WHERE id = p_post_id;

  credible_votes := v_credible;
  suspicious_votes := v_suspicious;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_comment_and_increment(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_vote(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_vote_and_update_counts(uuid, text, text) TO anon, authenticated;
