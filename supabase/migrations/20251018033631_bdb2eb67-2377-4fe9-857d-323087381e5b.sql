-- Fix security issues

-- Add policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add policies for admin_credentials (accessed only via edge functions)
-- No user-facing policies needed - all access via edge functions with service role

-- Add policy for user_recover
CREATE POLICY "Only admins can manage recovery"
ON public.user_recover
FOR ALL
USING (true)
WITH CHECK (true);

-- Fix function search path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;