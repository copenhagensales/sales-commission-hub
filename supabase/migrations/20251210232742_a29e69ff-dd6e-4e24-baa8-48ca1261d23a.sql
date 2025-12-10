-- Create dialer_calls table for GDPR-compliant call detail records
CREATE TABLE public.dialer_calls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_id TEXT NOT NULL,
  integration_type TEXT NOT NULL CHECK (integration_type IN ('adversus', 'enreach', 'other')),
  dialer_name TEXT NOT NULL,
  
  -- Temporality
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Telephony metrics
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  total_duration_seconds INTEGER NOT NULL DEFAULT 0,
  
  -- Unified status
  status TEXT NOT NULL CHECK (status IN ('ANSWERED', 'NO_ANSWER', 'BUSY', 'FAILED', 'OTHER')),
  
  -- Anonymous references (IDs only - GDPR compliant)
  agent_external_id TEXT NOT NULL,
  campaign_external_id TEXT NOT NULL,
  lead_external_id TEXT NOT NULL,
  
  -- Matched agent (nullable, populated via matching)
  agent_id UUID REFERENCES public.agents(id),
  
  -- Recording
  recording_url TEXT,
  
  -- Raw metadata for debugging
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(external_id, integration_type, dialer_name)
);

-- Create indexes for common queries
CREATE INDEX idx_dialer_calls_agent_id ON public.dialer_calls(agent_id);
CREATE INDEX idx_dialer_calls_start_time ON public.dialer_calls(start_time);
CREATE INDEX idx_dialer_calls_status ON public.dialer_calls(status);
CREATE INDEX idx_dialer_calls_dialer_name ON public.dialer_calls(dialer_name);
CREATE INDEX idx_dialer_calls_agent_external_id ON public.dialer_calls(agent_external_id);

-- Enable RLS
ALTER TABLE public.dialer_calls ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Managers can view all calls"
ON public.dialer_calls FOR SELECT
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can manage calls"
ON public.dialer_calls FOR ALL
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Service can insert calls"
ON public.dialer_calls FOR INSERT
WITH CHECK (true);

CREATE POLICY "Service can update calls"
ON public.dialer_calls FOR UPDATE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_dialer_calls_updated_at
BEFORE UPDATE ON public.dialer_calls
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();