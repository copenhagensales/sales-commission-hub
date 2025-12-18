-- Create table for client monthly goals
CREATE TABLE public.client_monthly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  sales_target INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, year, month)
);

-- Enable RLS
ALTER TABLE public.client_monthly_goals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can view client monthly goals" 
ON public.client_monthly_goals 
FOR SELECT 
USING (true);

CREATE POLICY "Managers can manage client monthly goals" 
ON public.client_monthly_goals 
FOR ALL 
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

-- Update trigger
CREATE TRIGGER update_client_monthly_goals_updated_at
BEFORE UPDATE ON public.client_monthly_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();