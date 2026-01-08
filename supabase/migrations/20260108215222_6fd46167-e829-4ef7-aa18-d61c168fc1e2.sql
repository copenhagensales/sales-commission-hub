-- Add dashboard_slugs column as array to support multiple dashboards per TV link
ALTER TABLE public.tv_board_access 
ADD COLUMN dashboard_slugs text[] DEFAULT NULL;

-- Migrate existing data: copy single dashboard_slug to array
UPDATE public.tv_board_access 
SET dashboard_slugs = ARRAY[dashboard_slug]
WHERE dashboard_slugs IS NULL AND dashboard_slug IS NOT NULL;