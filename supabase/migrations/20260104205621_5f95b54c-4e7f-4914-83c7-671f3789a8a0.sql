-- Add video_url column to coaching_feedback for optional training video links
ALTER TABLE public.coaching_feedback
ADD COLUMN video_url TEXT;

-- Add video_url_default to coaching_templates for template defaults
ALTER TABLE public.coaching_templates
ADD COLUMN video_url_default TEXT;