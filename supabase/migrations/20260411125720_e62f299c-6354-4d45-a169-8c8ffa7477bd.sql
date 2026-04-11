ALTER TABLE public.booking_flow_enrollments DROP CONSTRAINT booking_flow_enrollments_status_check;

ALTER TABLE public.booking_flow_enrollments ADD CONSTRAINT booking_flow_enrollments_status_check CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text, 'pending_approval'::text]));