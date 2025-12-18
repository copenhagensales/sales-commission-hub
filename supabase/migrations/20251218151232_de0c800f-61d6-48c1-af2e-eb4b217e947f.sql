-- Add bookable_client_ids array to location table for dynamic client booking settings
ALTER TABLE public.location ADD COLUMN bookable_client_ids uuid[] DEFAULT '{}';

-- Migrate existing data: if can_book_eesy or can_book_yousee is true, we'll need to manually map later
-- For now just add the column