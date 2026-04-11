
ALTER TABLE public.booking_flow_enrollments 
ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'auto_approved',
ADD COLUMN IF NOT EXISTS segmentation_signals jsonb;

COMMENT ON COLUMN public.booking_flow_enrollments.approval_status IS 'auto_approved, pending_approval, approved, rejected';
COMMENT ON COLUMN public.booking_flow_enrollments.segmentation_signals IS 'Parsed NLP signals: age, experience, language_pct, motivation_score, keywords_found';
