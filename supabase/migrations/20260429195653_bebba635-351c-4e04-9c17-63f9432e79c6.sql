-- Drop unused Some tables
DROP TABLE IF EXISTS public.some_weekly_metrics CASCADE;
DROP TABLE IF EXISTS public.some_default_goals CASCADE;

-- Promote Ekstraarbejde to top-level (place at end of sidebar for now)
UPDATE public.sidebar_menu_config
SET parent_key = NULL,
    sort_order = COALESCE((SELECT MAX(sort_order) FROM public.sidebar_menu_config WHERE parent_key IS NULL), 0) + 1
WHERE item_key = 'item_extra_work';

-- Remove Some menu rows
DELETE FROM public.sidebar_menu_config WHERE item_key IN ('item_some', 'section_some');