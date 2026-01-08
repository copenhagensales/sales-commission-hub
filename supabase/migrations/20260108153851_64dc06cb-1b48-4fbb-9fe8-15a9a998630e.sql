-- Table to track hidden unmapped agents
CREATE TABLE public.hidden_unmapped_agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  hidden_by UUID REFERENCES auth.users(id),
  hidden_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(agent_id)
);

-- Enable RLS
ALTER TABLE public.hidden_unmapped_agents ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all hidden agents
CREATE POLICY "Authenticated users can view hidden agents"
ON public.hidden_unmapped_agents
FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to hide agents
CREATE POLICY "Authenticated users can hide agents"
ON public.hidden_unmapped_agents
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to unhide agents
CREATE POLICY "Authenticated users can unhide agents"
ON public.hidden_unmapped_agents
FOR DELETE
USING (auth.role() = 'authenticated');