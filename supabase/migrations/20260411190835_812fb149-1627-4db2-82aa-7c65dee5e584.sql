ALTER TABLE public.booking_flow_steps DROP CONSTRAINT booking_flow_steps_phase_check;
ALTER TABLE public.booking_flow_steps ADD CONSTRAINT booking_flow_steps_phase_check CHECK (phase IN ('active', 'reengagement', 'confirmation'));
UPDATE public.booking_flow_steps SET phase = 'confirmation' WHERE template_key = 'booking_confirmation_sms';