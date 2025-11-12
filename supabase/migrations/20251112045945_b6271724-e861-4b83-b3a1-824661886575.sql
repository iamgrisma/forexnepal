-- Block all public (unauthenticated) access to sensitive tables

-- Block public access to admin_credentials
CREATE POLICY "Block public access to admin credentials"
ON public.admin_credentials
FOR SELECT
TO anon
USING (false);

-- Block public access to user_recover
CREATE POLICY "Block public access to recovery data"
ON public.user_recover
FOR SELECT
TO anon
USING (false);

-- Block public access to user_roles
CREATE POLICY "Block public access to user roles"
ON public.user_roles
FOR SELECT
TO anon
USING (false);