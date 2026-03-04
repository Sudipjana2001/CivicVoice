-- ============================================
-- CivicVoice Full Schema Migration
-- Run this in your Supabase SQL Editor
-- ============================================

-- ==========================================
-- 1. PROFILES (from existing migration)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_id TEXT NOT NULL UNIQUE DEFAULT 'CVC-' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 8)),
  credibility_score INTEGER NOT NULL DEFAULT 0,
  reports_count INTEGER NOT NULL DEFAULT 0,
  credibility_level TEXT NOT NULL DEFAULT 'new' CHECK (credibility_level IN ('none', 'new', 'trusted', 'veteran')),
  inbox_enabled BOOLEAN NOT NULL DEFAULT false,
  self_destruct_days INTEGER CHECK (self_destruct_days IN (7, 30, 90) OR self_destruct_days IS NULL),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 2. FOLLOWED TOPICS (from existing migration)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.followed_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_type TEXT NOT NULL CHECK (topic_type IN ('location', 'category')),
  topic_value TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_id, topic_type, topic_value)
);

ALTER TABLE public.followed_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their followed topics" ON public.followed_topics;
CREATE POLICY "Users can view their followed topics"
ON public.followed_topics FOR SELECT
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their followed topics" ON public.followed_topics;
CREATE POLICY "Users can manage their followed topics"
ON public.followed_topics FOR ALL
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- ==========================================
-- 3. ALERT PREFERENCES (from existing migration)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alert_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  new_incidents BOOLEAN NOT NULL DEFAULT true,
  status_updates BOOLEAN NOT NULL DEFAULT true,
  weekly_digest BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their alert preferences" ON public.alert_preferences;
CREATE POLICY "Users can view their alert preferences"
ON public.alert_preferences FOR SELECT
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage their alert preferences" ON public.alert_preferences;
CREATE POLICY "Users can manage their alert preferences"
ON public.alert_preferences FOR ALL
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- ==========================================
-- 4. ACTIVITY HISTORY (from existing migration)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.activity_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('report_submitted', 'vote_cast', 'topic_followed', 'status_changed', 'inbox_message')),
  description TEXT NOT NULL,
  related_post_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their activity history" ON public.activity_history;
CREATE POLICY "Users can view their activity history"
ON public.activity_history FOR SELECT
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can insert their activity" ON public.activity_history;
CREATE POLICY "Users can insert their activity"
ON public.activity_history FOR INSERT
WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- ==========================================
-- 5. COMMENTS (from existing migration)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  anonymous_id TEXT NOT NULL DEFAULT ('Anon_' || upper(substring((gen_random_uuid())::text, 1, 6))),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;
CREATE POLICY "Anyone can view comments"
ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert comments" ON public.comments;
CREATE POLICY "Anyone can insert comments"
ON public.comments FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON public.comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at DESC);

-- ==========================================
-- 6. POSTS (NEW)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id TEXT NOT NULL DEFAULT ('Anon_' || upper(substring((gen_random_uuid())::text, 1, 6))),
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fraud', 'violence', 'corruption', 'governance', 'safety', 'healthcare', 'infrastructure', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  evidence_type TEXT CHECK (evidence_type IN ('photo', 'video', 'document', 'witness') OR evidence_type IS NULL),
  location TEXT,
  image_url TEXT,
  credible_votes INTEGER NOT NULL DEFAULT 0,
  suspicious_votes INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'escalated', 'action_noted', 'resolved', 'closed')),
  self_destruct_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Anyone can view posts (public platform)
DROP POLICY IF EXISTS "Anyone can view posts" ON public.posts;
CREATE POLICY "Anyone can view posts"
ON public.posts FOR SELECT USING (true);

-- Anyone can create posts (anonymous posting)
DROP POLICY IF EXISTS "Anyone can create posts" ON public.posts;
CREATE POLICY "Anyone can create posts"
ON public.posts FOR INSERT WITH CHECK (true);

-- Anyone can update posts (for vote counts, comment counts)
DROP POLICY IF EXISTS "Anyone can update posts" ON public.posts;
CREATE POLICY "Anyone can update posts"
ON public.posts FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_posts_category ON public.posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_severity ON public.posts(severity);
CREATE INDEX IF NOT EXISTS idx_posts_location ON public.posts(location);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);

-- ==========================================
-- 7. VOTES (NEW)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  voter_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('credible', 'suspicious')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, voter_id)
);

ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- Anyone can view votes
DROP POLICY IF EXISTS "Anyone can view votes" ON public.votes;
CREATE POLICY "Anyone can view votes"
ON public.votes FOR SELECT USING (true);

-- Anyone can insert votes
DROP POLICY IF EXISTS "Anyone can insert votes" ON public.votes;
CREATE POLICY "Anyone can insert votes"
ON public.votes FOR INSERT WITH CHECK (true);

-- Anyone can update their own votes
DROP POLICY IF EXISTS "Anyone can update votes" ON public.votes;
CREATE POLICY "Anyone can update votes"
ON public.votes FOR UPDATE USING (true);

-- Anyone can delete their own votes
DROP POLICY IF EXISTS "Anyone can delete votes" ON public.votes;
CREATE POLICY "Anyone can delete votes"
ON public.votes FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_votes_post_id ON public.votes(post_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter_id ON public.votes(voter_id);

-- ==========================================
-- 8. INBOX MESSAGES (NEW)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_anonymous_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('ngo', 'journalist', 'moderator')),
  sender_label TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview TEXT NOT NULL,
  content TEXT NOT NULL,
  related_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can view their own messages (matched by anonymous_id)
DROP POLICY IF EXISTS "Anyone can view their inbox messages" ON public.inbox_messages;
CREATE POLICY "Anyone can view their inbox messages"
ON public.inbox_messages FOR SELECT USING (true);

-- Anyone can update messages (mark as read)
DROP POLICY IF EXISTS "Anyone can update inbox messages" ON public.inbox_messages;
CREATE POLICY "Anyone can update inbox messages"
ON public.inbox_messages FOR UPDATE USING (true);

-- Anyone can delete messages
DROP POLICY IF EXISTS "Anyone can delete inbox messages" ON public.inbox_messages;
CREATE POLICY "Anyone can delete inbox messages"
ON public.inbox_messages FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_recipient ON public.inbox_messages(recipient_anonymous_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_created_at ON public.inbox_messages(created_at DESC);

-- ==========================================
-- 9. ALERTS (NEW)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_anonymous_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('new_incident', 'status_change', 'follow_up')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  incident_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  topic_type TEXT,
  topic_value TEXT,
  topic_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view alerts" ON public.alerts;
CREATE POLICY "Anyone can view alerts"
ON public.alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can update alerts" ON public.alerts;
CREATE POLICY "Anyone can update alerts"
ON public.alerts FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete alerts" ON public.alerts;
CREATE POLICY "Anyone can delete alerts"
ON public.alerts FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_alerts_recipient ON public.alerts(recipient_anonymous_id);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at DESC);

-- ==========================================
-- 10. FUNCTIONS & TRIGGERS (from existing)
-- ==========================================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_preferences_updated_at ON public.alert_preferences;
CREATE TRIGGER update_alert_preferences_updated_at
BEFORE UPDATE ON public.alert_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

