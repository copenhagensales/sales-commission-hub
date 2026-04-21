ALTER TABLE public.booking_flow_enrollments
ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL;

UPDATE public.booking_flow_enrollments
SET approved_at = enrolled_at
WHERE approval_status = 'auto_approved' AND approved_at IS NULL;

UPDATE public.booking_flow_enrollments
SET approved_at = updated_at
WHERE approval_status = 'approved' AND approved_at IS NULL;