-- Create table for e-conomic webhook events
CREATE TABLE public.economic_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.economic_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service can insert economic_events"
ON public.economic_events
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Authenticated users can view economic_events"
ON public.economic_events
FOR SELECT
USING (true);

CREATE POLICY "Managers can manage economic_events"
ON public.economic_events
FOR ALL
USING (is_manager_or_above(auth.uid()));