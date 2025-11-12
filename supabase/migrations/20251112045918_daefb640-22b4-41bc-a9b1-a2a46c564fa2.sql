-- Fix security issues in Supabase database

-- 1. Add proper RLS policies for admin_credentials table
-- This table stores password hashes and should be heavily restricted
DROP POLICY IF EXISTS "Only super admins can access credentials" ON public.admin_credentials;

CREATE POLICY "Only super admins can read credentials"
ON public.admin_credentials
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only super admins can update credentials"
ON public.admin_credentials
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- No INSERT or DELETE policies - credentials should only be managed through migrations


-- 2. Fix the overly permissive user_recover policy
DROP POLICY IF EXISTS "Only admins can manage recovery" ON public.user_recover;

CREATE POLICY "Only admins can view recovery"
ON public.user_recover
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert recovery"
ON public.user_recover
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update recovery"
ON public.user_recover
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete recovery"
ON public.user_recover
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));


-- 3. Add restrictive policies for header_tags to prevent unauthorized modifications
CREATE POLICY "Only admins can insert header tags"
ON public.header_tags
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update header tags"
ON public.header_tags
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete header tags"
ON public.header_tags
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));