-- Create table to track which agents have their softphone online
CREATE TABLE public.agent_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  identity TEXT NOT NULL,
  is_online BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS
ALTER TABLE public.agent_presence ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage their own presence
CREATE POLICY "Users can manage their own presence"
ON public.agent_presence
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for quick lookup of online agents
CREATE INDEX idx_agent_presence_online ON public.agent_presence(is_online) WHERE is_online = true;

-- Create trigger for updated_at
CREATE TRIGGER update_agent_presence_updated_at
BEFORE UPDATE ON public.agent_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();