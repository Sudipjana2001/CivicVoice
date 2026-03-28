-- ============================================
-- CivicVoice Social Platform Extension
-- Social tables, RPCs, RLS, and indexes
-- ============================================

-- ==========================================
-- 1. CONNECTION REQUESTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.connection_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_connection CHECK (requester_user_id <> recipient_user_id),
  UNIQUE (requester_user_id, recipient_user_id)
);

ALTER TABLE public.connection_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their connection requests"
ON public.connection_requests FOR SELECT TO authenticated
USING (auth.uid() IN (requester_user_id, recipient_user_id));

CREATE POLICY "Authenticated users can insert connection requests"
ON public.connection_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requester_user_id);

CREATE POLICY "Users can update their connection requests"
ON public.connection_requests FOR UPDATE TO authenticated
USING (auth.uid() IN (requester_user_id, recipient_user_id));

CREATE INDEX IF NOT EXISTS idx_conn_req_requester ON public.connection_requests(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_conn_req_recipient ON public.connection_requests(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_conn_req_status ON public.connection_requests(status);

DROP TRIGGER IF EXISTS update_connection_requests_updated_at ON public.connection_requests;
CREATE TRIGGER update_connection_requests_updated_at
BEFORE UPDATE ON public.connection_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 2. USER CONNECTIONS (bidirectional pairs)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_request_id UUID REFERENCES public.connection_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_connection_uc CHECK (user_id <> connection_user_id),
  UNIQUE (user_id, connection_user_id)
);

ALTER TABLE public.user_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their connections"
ON public.user_connections FOR SELECT TO authenticated
USING (auth.uid() IN (user_id, connection_user_id));

CREATE INDEX IF NOT EXISTS idx_user_conn_user ON public.user_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_conn_connection ON public.user_connections(connection_user_id);

-- ==========================================
-- 3. CONVERSATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_type TEXT NOT NULL DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'community')),
  community_id UUID,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- NOTE: conversation SELECT policy is added AFTER conversation_participants table is created (see below)

DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
CREATE TRIGGER update_conversations_updated_at
BEFORE UPDATE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 4. CONVERSATION PARTICIPANTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_message_id UUID,
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversation participations"
ON public.conversation_participants FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their participation"
ON public.conversation_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_conv_part_conv ON public.conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_part_user ON public.conversation_participants(user_id);

-- NOW add the conversations SELECT policy (conversation_participants exists)
CREATE POLICY "Participants can view their conversations"
ON public.conversations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
  )
);

-- ==========================================
-- 5. CONVERSATION MESSAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'seen')),
  delivered_at TIMESTAMPTZ,
  seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages"
ON public.conversation_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Participants can insert messages"
ON public.conversation_messages FOR INSERT TO authenticated
WITH CHECK (
  sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Participants can update message status"
ON public.conversation_messages FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_conv_msg_conv ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_msg_created ON public.conversation_messages(created_at DESC);

-- Update conversation last_message_at on new message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_conversation_message_insert ON public.conversation_messages;
CREATE TRIGGER on_conversation_message_insert
AFTER INSERT ON public.conversation_messages
FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- ==========================================
-- 6. COMMUNITIES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.communities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  civic_focus TEXT,
  location TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- NOTE: communities SELECT/UPDATE policies referencing community_members are added AFTER that table is created (see below)

CREATE POLICY "Authenticated users can create communities"
ON public.communities FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_communities_slug ON public.communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_visibility ON public.communities(visibility);
CREATE INDEX IF NOT EXISTS idx_communities_member_count ON public.communities(member_count DESC);

DROP TRIGGER IF EXISTS update_communities_updated_at ON public.communities;
CREATE TRIGGER update_communities_updated_at
BEFORE UPDATE ON public.communities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 7. COMMUNITY MEMBERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.community_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (community_id, user_id)
);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Create helper function to break RLS infinite recursion
CREATE OR REPLACE FUNCTION public.check_is_community_member(c_id UUID, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = c_id AND user_id = u_id AND status = 'active'
  );
$$;



CREATE POLICY "Users can insert their membership"
ON public.community_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their membership"
ON public.community_members FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_comm_members_comm ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_comm_members_user ON public.community_members(user_id);

-- NOW add the communities SELECT/UPDATE policies (community_members exists)
CREATE POLICY "Anyone can view public communities"
ON public.communities FOR SELECT
USING (visibility = 'public' OR public.check_is_community_member(id, auth.uid()));

CREATE POLICY "Admins can update their communities"
ON public.communities FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.community_members cm
  WHERE cm.community_id = id AND cm.user_id = auth.uid() AND cm.role = 'admin' AND cm.status = 'active'
));

CREATE POLICY "Members can view community members"
ON public.community_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  public.check_is_community_member(community_id, auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = community_id AND c.visibility = 'public'
  )
);

-- ==========================================
-- 8. VOICES (Updates / Voices)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  linked_issue_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'voice' CHECK (kind IN ('voice', 'update')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'connections', 'community')),
  title TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  support_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  edited_at TIMESTAMPTZ
);

ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active public voices"
ON public.voices FOR SELECT
USING (status = 'active' AND (visibility = 'public' OR author_user_id = auth.uid()));

CREATE POLICY "Authenticated users can create voices"
ON public.voices FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_user_id);

CREATE POLICY "Authors can update their voices"
ON public.voices FOR UPDATE TO authenticated
USING (auth.uid() = author_user_id);

CREATE INDEX IF NOT EXISTS idx_voices_author ON public.voices(author_user_id);
CREATE INDEX IF NOT EXISTS idx_voices_community ON public.voices(community_id);
CREATE INDEX IF NOT EXISTS idx_voices_created ON public.voices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voices_support ON public.voices(support_count DESC);
CREATE INDEX IF NOT EXISTS idx_voices_status ON public.voices(status);

DROP TRIGGER IF EXISTS update_voices_updated_at ON public.voices;
CREATE TRIGGER update_voices_updated_at
BEFORE UPDATE ON public.voices
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- 9. VOICE SUPPORTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.voice_supports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voice_id UUID NOT NULL REFERENCES public.voices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (voice_id, user_id)
);

ALTER TABLE public.voice_supports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view supports"
ON public.voice_supports FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their support"
ON public.voice_supports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their support"
ON public.voice_supports FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_voice_supports_voice ON public.voice_supports(voice_id);
CREATE INDEX IF NOT EXISTS idx_voice_supports_user ON public.voice_supports(user_id);

-- ==========================================
-- 10. VOICE COMMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.voice_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voice_id UUID NOT NULL REFERENCES public.voices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.voice_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view voice comments"
ON public.voice_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments"
ON public.voice_comments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their comments"
ON public.voice_comments FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their comments"
ON public.voice_comments FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_voice_comments_voice ON public.voice_comments(voice_id);
CREATE INDEX IF NOT EXISTS idx_voice_comments_parent ON public.voice_comments(parent_comment_id);

DROP TRIGGER IF EXISTS update_voice_comments_updated_at ON public.voice_comments;
CREATE TRIGGER update_voice_comments_updated_at
BEFORE UPDATE ON public.voice_comments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update voice comment_count
CREATE OR REPLACE FUNCTION public.update_voice_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.voices SET comment_count = comment_count + 1 WHERE id = NEW.voice_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.voices SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.voice_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_voice_comment_change ON public.voice_comments;
CREATE TRIGGER on_voice_comment_change
AFTER INSERT OR DELETE ON public.voice_comments
FOR EACH ROW EXECUTE FUNCTION public.update_voice_comment_count();

-- ==========================================
-- 11. CIVIC ALERTS (Social Notifications)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.civic_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'connection_request', 'connection_accepted',
    'conversation_message',
    'community_join', 'community_activity',
    'voice_supported', 'voice_commented'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  community_id UUID REFERENCES public.communities(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  voice_id UUID REFERENCES public.voices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.civic_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their alerts"
ON public.civic_alerts FOR SELECT TO authenticated
USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can update their alerts"
ON public.civic_alerts FOR UPDATE TO authenticated
USING (auth.uid() = recipient_user_id);

CREATE POLICY "Users can delete their alerts"
ON public.civic_alerts FOR DELETE TO authenticated
USING (auth.uid() = recipient_user_id);

CREATE POLICY "System can create alerts"
ON public.civic_alerts FOR INSERT TO authenticated
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_civic_alerts_recipient ON public.civic_alerts(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_civic_alerts_read ON public.civic_alerts(read);
CREATE INDEX IF NOT EXISTS idx_civic_alerts_created ON public.civic_alerts(created_at DESC);

-- ==========================================
-- 12. RPC FUNCTIONS
-- ==========================================

-- Send connection request
CREATE OR REPLACE FUNCTION public.send_connection_request(
  p_recipient_user_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS SETOF public.connection_requests
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request public.connection_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() = p_recipient_user_id THEN
    RAISE EXCEPTION 'Cannot send connection request to yourself';
  END IF;

  -- Check if already connected
  IF EXISTS (
    SELECT 1 FROM public.user_connections
    WHERE user_id = auth.uid() AND connection_user_id = p_recipient_user_id
  ) THEN
    RAISE EXCEPTION 'Already connected';
  END IF;

  INSERT INTO public.connection_requests (requester_user_id, recipient_user_id, note)
  VALUES (auth.uid(), p_recipient_user_id, p_note)
  ON CONFLICT (requester_user_id, recipient_user_id)
  DO UPDATE SET
    status = 'pending',
    note = EXCLUDED.note,
    responded_at = NULL,
    updated_at = now()
  WHERE connection_requests.status IN ('rejected', 'cancelled')
  RETURNING * INTO v_request;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Connection request already exists';
  END IF;

  -- Create alert for recipient
  INSERT INTO public.civic_alerts (recipient_user_id, type, title, description, action_url)
  VALUES (
    p_recipient_user_id,
    'connection_request',
    'New Connection Request',
    'Someone wants to connect with you',
    '/connections'
  );

  RETURN NEXT v_request;
END;
$$;

-- Respond to connection request
CREATE OR REPLACE FUNCTION public.respond_to_connection_request(
  p_request_id UUID,
  p_action TEXT
)
RETURNS SETOF public.connection_requests
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_request public.connection_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_action NOT IN ('accepted', 'rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  UPDATE public.connection_requests
  SET status = p_action, responded_at = now(), updated_at = now()
  WHERE id = p_request_id
    AND status = 'pending'
    AND (
      (p_action IN ('accepted', 'rejected') AND recipient_user_id = auth.uid())
      OR (p_action = 'cancelled' AND requester_user_id = auth.uid())
    )
  RETURNING * INTO v_request;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Request not found or action not allowed';
  END IF;

  -- If accepted, create bidirectional connections
  IF p_action = 'accepted' THEN
    INSERT INTO public.user_connections (user_id, connection_user_id, source_request_id)
    VALUES
      (v_request.requester_user_id, v_request.recipient_user_id, v_request.id),
      (v_request.recipient_user_id, v_request.requester_user_id, v_request.id)
    ON CONFLICT DO NOTHING;

    -- Alert the requester
    INSERT INTO public.civic_alerts (recipient_user_id, type, title, description, action_url)
    VALUES (
      v_request.requester_user_id,
      'connection_accepted',
      'Connection Accepted',
      'Your connection request was accepted',
      '/connections'
    );
  END IF;

  RETURN NEXT v_request;
END;
$$;

-- Ensure direct conversation exists between two users
CREATE OR REPLACE FUNCTION public.ensure_direct_conversation(
  p_other_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Look for existing direct conversation between the two users
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM public.conversation_participants cp1
  JOIN public.conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
  JOIN public.conversations c ON c.id = cp1.conversation_id
  WHERE cp1.user_id = auth.uid()
    AND cp2.user_id = p_other_user_id
    AND c.conversation_type = 'direct'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Create new conversation
  INSERT INTO public.conversations (conversation_type, created_by)
  VALUES ('direct', auth.uid())
  RETURNING id INTO v_conversation_id;

  -- Add participants
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES
    (v_conversation_id, auth.uid()),
    (v_conversation_id, p_other_user_id);

  RETURN v_conversation_id;
END;
$$;

-- Create community
CREATE OR REPLACE FUNCTION public.create_community(
  p_name TEXT,
  p_slug TEXT,
  p_description TEXT DEFAULT NULL,
  p_visibility TEXT DEFAULT 'public',
  p_civic_focus TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL
)
RETURNS SETOF public.communities
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_community public.communities;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.communities (name, slug, description, visibility, civic_focus, location, created_by, member_count)
  VALUES (p_name, p_slug, p_description, p_visibility, p_civic_focus, p_location, auth.uid(), 1)
  RETURNING * INTO v_community;

  -- Creator becomes admin
  INSERT INTO public.community_members (community_id, user_id, role, status, created_by)
  VALUES (v_community.id, auth.uid(), 'admin', 'active', auth.uid());

  RETURN NEXT v_community;
END;
$$;

-- Join community
CREATE OR REPLACE FUNCTION public.join_community(
  p_community_id UUID
)
RETURNS SETOF public.community_members
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_membership public.community_members;
  v_community public.communities;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_community FROM public.communities WHERE id = p_community_id;
  IF v_community.id IS NULL THEN
    RAISE EXCEPTION 'Community not found';
  END IF;

  INSERT INTO public.community_members (community_id, user_id, role, status, created_by)
  VALUES (
    p_community_id,
    auth.uid(),
    'member',
    CASE WHEN v_community.visibility = 'public' THEN 'active' ELSE 'pending' END,
    auth.uid()
  )
  ON CONFLICT (community_id, user_id) DO NOTHING
  RETURNING * INTO v_membership;

  IF v_membership.id IS NULL THEN
    RAISE EXCEPTION 'Already a member of this community';
  END IF;

  -- Update member count for public communities
  IF v_community.visibility = 'public' THEN
    UPDATE public.communities SET member_count = member_count + 1 WHERE id = p_community_id;
  END IF;

  RETURN NEXT v_membership;
END;
$$;

-- Leave community
CREATE OR REPLACE FUNCTION public.leave_community(
  p_community_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.community_members
  WHERE community_id = p_community_id AND user_id = auth.uid();

  UPDATE public.communities
  SET member_count = GREATEST(member_count - 1, 0)
  WHERE id = p_community_id;

  RETURN p_community_id::text;
END;
$$;

-- Set voice support state
CREATE OR REPLACE FUNCTION public.set_voice_support_state(
  p_voice_id UUID,
  p_support BOOLEAN
)
RETURNS TABLE (support_count INTEGER, supported BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_support THEN
    INSERT INTO public.voice_supports (voice_id, user_id)
    VALUES (p_voice_id, auth.uid())
    ON CONFLICT DO NOTHING;

    UPDATE public.voices
    SET support_count = (SELECT count(*) FROM public.voice_supports WHERE voice_id = p_voice_id)
    WHERE id = p_voice_id;
  ELSE
    DELETE FROM public.voice_supports
    WHERE voice_id = p_voice_id AND user_id = auth.uid();

    UPDATE public.voices
    SET support_count = (SELECT count(*) FROM public.voice_supports WHERE voice_id = p_voice_id)
    WHERE id = p_voice_id;
  END IF;

  SELECT v.support_count INTO v_count FROM public.voices v WHERE v.id = p_voice_id;

  RETURN QUERY SELECT v_count, p_support;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.send_connection_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_connection_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_direct_conversation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_community(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_community(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_community(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_voice_support_state(UUID, BOOLEAN) TO authenticated;

-- Enable Realtime for conversations and alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.civic_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voices;
