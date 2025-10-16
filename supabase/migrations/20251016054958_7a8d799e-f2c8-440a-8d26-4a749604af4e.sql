-- Create storage bucket for forex images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forex-images',
  'forex-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read images
CREATE POLICY "Public access to forex images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'forex-images');

-- Allow authenticated users to upload images (for the edge function)
CREATE POLICY "Allow uploads to forex images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'forex-images');

-- Allow updates to forex images
CREATE POLICY "Allow updates to forex images"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'forex-images');