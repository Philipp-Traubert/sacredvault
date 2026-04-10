
-- Drop the existing overly broad videos SELECT policy
DROP POLICY IF EXISTS "Authenticated users with roles can view videos" ON public.videos;

-- Recreate with explicit role check
CREATE POLICY "Users with valid roles can view videos"
ON public.videos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'user'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);
