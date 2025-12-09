-- Create commission_transactions table for tracking commission adjustments
CREATE TABLE public.commission_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('commission', 'clawback', 'bonus', 'adjustment')),
  amount NUMERIC NOT NULL,
  reason TEXT,
  source TEXT, -- 'crm_sync', 'excel_import', 'manual'
  source_reference TEXT, -- ID or filename of the source
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add validation_status to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'approved', 'cancelled', 'rejected'));

-- Enable RLS
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Managers can manage commission transactions"
ON public.commission_transactions
FOR ALL
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Service can insert commission transactions"
ON public.commission_transactions
FOR INSERT
WITH CHECK (true);

-- Index for performance
CREATE INDEX idx_commission_transactions_agent ON public.commission_transactions(agent_name);
CREATE INDEX idx_commission_transactions_client ON public.commission_transactions(client_id);
CREATE INDEX idx_commission_transactions_sale ON public.commission_transactions(sale_id);
CREATE INDEX idx_sales_validation_status ON public.sales(validation_status);