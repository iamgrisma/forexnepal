-- Fix user_recover RLS policy to restrict to admins only
DROP POLICY IF EXISTS "Only admins can manage recovery" ON public.user_recover;

CREATE POLICY "Only admins can manage recovery"
  ON public.user_recover FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Add explicit deny policy to admin_credentials for defense-in-depth
CREATE POLICY "Admin credentials require function access"
  ON public.admin_credentials FOR ALL
  USING (false)
  WITH CHECK (false);