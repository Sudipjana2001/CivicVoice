-- ============================================
-- Fix for infinite recursion in Communities RLS
-- ============================================

-- 1. Create helper function to safely check membership bypassing RLS
CREATE OR REPLACE FUNCTION public.check_is_community_member(c_id UUID, u_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members
    WHERE community_id = c_id AND user_id = u_id AND status = 'active'
  );
$$;

-- 2. Drop the old recursive policies
DROP POLICY IF EXISTS "Anyone can view public communities" ON public.communities;
DROP POLICY IF EXISTS "Admins can update their communities" ON public.communities;
DROP POLICY IF EXISTS "Members can view community members" ON public.community_members;

-- 3. Recreate the policies using the safe helper function
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
