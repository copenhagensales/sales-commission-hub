-- Re-classify 5G rows that were incorrectly marked as correct_match
-- These have Subscription Name containing "5G" but target_product_name is a non-5G Eesy product
UPDATE cancellation_queue
SET upload_type = 'basket_difference'
WHERE status = 'pending'
  AND upload_type = 'correct_match'
  AND uploaded_data->>'Subscription Name' ILIKE '%5G%'
  AND target_product_name NOT ILIKE '%5G%';
