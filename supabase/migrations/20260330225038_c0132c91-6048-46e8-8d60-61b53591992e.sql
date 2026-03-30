
UPDATE public.cancellation_queue
SET status = 'approved',
    reviewed_at = now()
WHERE upload_type = 'correct_match'
  AND status = 'pending';
