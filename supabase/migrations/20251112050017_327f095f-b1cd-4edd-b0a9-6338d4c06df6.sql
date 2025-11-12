-- Add missing INSERT and DELETE policies for admin_credentials table
-- These are restrictive policies to prevent unauthorized account creation/deletion

CREATE POLICY "Only super admins can create admin credentials"
ON public.admin_credentials
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only super admins can delete admin credentials"
ON public.admin_credentials
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));