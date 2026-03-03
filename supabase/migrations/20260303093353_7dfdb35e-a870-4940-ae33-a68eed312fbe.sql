
-- Add photo_url column to vehicle_return_confirmation
ALTER TABLE public.vehicle_return_confirmation ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Create storage bucket for vehicle return photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle-return-photos', 'vehicle-return-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload vehicle return photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'vehicle-return-photos');

-- Allow public read access (for email links)
CREATE POLICY "Public read access for vehicle return photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'vehicle-return-photos');
