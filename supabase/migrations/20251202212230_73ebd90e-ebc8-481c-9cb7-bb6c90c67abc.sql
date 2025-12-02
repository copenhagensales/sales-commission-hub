-- Liquidity Calculator Tables

-- Customers for liquidity forecasting (can be linked to campaigns or standalone)
CREATE TABLE public.liquidity_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_invoice_amount NUMERIC NOT NULL DEFAULT 0,
  invoice_day INTEGER DEFAULT 0, -- 0 = last day of month, 1-28 = specific day
  payment_terms_days INTEGER NOT NULL DEFAULT 25,
  pays_on_time BOOLEAN DEFAULT true,
  average_delay_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Recurring expenses
CREATE TABLE public.liquidity_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('salary', 'software', 'rent', 'marketing', 'other')),
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_day INTEGER DEFAULT 1, -- Day of month
  recurrence TEXT NOT NULL DEFAULT 'monthly' CHECK (recurrence IN ('monthly', 'weekly', 'one_time')),
  one_time_date DATE, -- For one-time expenses
  is_vat_deductible BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Liquidity settings
CREATE TABLE public.liquidity_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default settings
INSERT INTO public.liquidity_settings (setting_key, setting_value) VALUES
  ('general', '{"starting_balance": 0, "starting_date": null, "forecast_months": 6}'),
  ('vat', '{"rate": 25, "payment_day": 10}'),
  ('salary', '{"total_monthly": 0, "vacation_pay_percent": 12.5, "payment_day": 15}');

-- Enable RLS
ALTER TABLE public.liquidity_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquidity_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies - managers and above can manage
CREATE POLICY "Managers can manage liquidity_customers" 
ON public.liquidity_customers FOR ALL 
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can manage liquidity_expenses" 
ON public.liquidity_expenses FOR ALL 
USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Managers can manage liquidity_settings" 
ON public.liquidity_settings FOR ALL 
USING (is_manager_or_above(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_liquidity_customers_updated_at
BEFORE UPDATE ON public.liquidity_customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liquidity_expenses_updated_at
BEFORE UPDATE ON public.liquidity_expenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liquidity_settings_updated_at
BEFORE UPDATE ON public.liquidity_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();