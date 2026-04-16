
ALTER TABLE public.booking_page_content
ADD COLUMN social_links jsonb DEFAULT NULL;

UPDATE public.booking_page_content
SET social_links = '{
  "instagram": "https://instagram.com/copenhagensales",
  "linkedin": "https://linkedin.com/company/copenhagensales",
  "tiktok": "https://tiktok.com/@copenhagensales",
  "website": "https://copenhagensales.dk"
}'::jsonb
WHERE page_key = 'booking_success';
