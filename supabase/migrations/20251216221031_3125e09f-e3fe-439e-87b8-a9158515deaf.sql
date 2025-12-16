-- Create employee to agent mapping table
CREATE TABLE public.employee_agent_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, agent_id)
);

-- Enable RLS
ALTER TABLE public.employee_agent_mapping ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view mappings"
ON public.employee_agent_mapping
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Owners can manage mappings"
ON public.employee_agent_mapping
FOR ALL
USING (public.is_owner(auth.uid()));

CREATE POLICY "Teamleders can manage mappings"
ON public.employee_agent_mapping
FOR ALL
USING (public.is_teamleder_or_above(auth.uid()));

-- Add index for faster lookups
CREATE INDEX idx_employee_agent_mapping_employee ON public.employee_agent_mapping(employee_id);
CREATE INDEX idx_employee_agent_mapping_agent ON public.employee_agent_mapping(agent_id);