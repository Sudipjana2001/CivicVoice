-- Add user_id column to posts table so we can track post ownership
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);

-- Add delete policy for posts (owner only)
CREATE POLICY "Users can delete their own posts"
ON public.posts FOR DELETE USING (auth.uid() = user_id);
