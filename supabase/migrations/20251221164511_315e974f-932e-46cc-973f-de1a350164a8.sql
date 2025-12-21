-- Create storage bucket for onboarding videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('onboarding-videos', 'onboarding-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos
CREATE POLICY "Managers can upload onboarding videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'onboarding-videos' 
  AND is_teamleder_or_above(auth.uid())
);

-- Allow anyone to view onboarding videos
CREATE POLICY "Anyone can view onboarding videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'onboarding-videos');

-- Allow managers to delete videos
CREATE POLICY "Managers can delete onboarding videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'onboarding-videos' 
  AND is_teamleder_or_above(auth.uid())
);