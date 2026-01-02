-- Create table for employee sales goals
CREATE TABLE public.employee_sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  target_amount INTEGER NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, period_start, period_end)
);

-- Enable RLS
ALTER TABLE public.employee_sales_goals ENABLE ROW LEVEL SECURITY;

-- Create policies - employees can only manage their own goals
CREATE POLICY "Users can view their own goals"
ON public.employee_sales_goals
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own goals"
ON public.employee_sales_goals
FOR INSERT
WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own goals"
ON public.employee_sales_goals
FOR UPDATE
USING (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own goals"
ON public.employee_sales_goals
FOR DELETE
USING (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE auth_user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_employee_sales_goals_updated_at
BEFORE UPDATE ON public.employee_sales_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();