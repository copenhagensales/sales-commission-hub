-- Call Center Payroll System Database Schema

-- Create custom types
CREATE TYPE public.employment_type AS ENUM ('hourly', 'monthly');
CREATE TYPE public.commission_type AS ENUM ('fixed', 'percentage');
CREATE TYPE public.sale_status AS ENUM ('pending', 'active', 'cancelled', 'clawbacked');
CREATE TYPE public.commission_transaction_type AS ENUM ('earn', 'clawback', 'manual_adjustment');
CREATE TYPE public.absence_type AS ENUM ('sick', 'vacation', 'other');
CREATE TYPE public.payroll_status AS ENUM ('draft', 'approved', 'exported');
CREATE TYPE public.app_role AS ENUM ('admin', 'payroll', 'manager', 'agent');

-- 1. Agents table
CREATE TABLE public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    external_adversus_id TEXT,
    base_salary_monthly NUMERIC DEFAULT 0,
    employment_type employment_type DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT true,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Products table
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    commission_type commission_type DEFAULT 'fixed',
    commission_value NUMERIC DEFAULT 0,
    clawback_window_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Sales table
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
    adversus_call_id TEXT,
    customer_id TEXT,
    sale_amount NUMERIC DEFAULT 0,
    sale_date TIMESTAMPTZ DEFAULT now(),
    effective_date TIMESTAMPTZ,
    status sale_status DEFAULT 'pending',
    cancellation_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Commission transactions table
CREATE TABLE public.commission_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
    type commission_transaction_type NOT NULL,
    amount NUMERIC DEFAULT 0,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Absences table
CREATE TABLE public.absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    type absence_type DEFAULT 'other',
    hours NUMERIC DEFAULT 0,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Payroll runs table
CREATE TABLE public.payroll_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status payroll_status DEFAULT 'draft',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Payroll lines table
CREATE TABLE public.payroll_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id UUID REFERENCES public.payroll_runs(id) ON DELETE CASCADE NOT NULL,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
    base_salary_amount NUMERIC DEFAULT 0,
    commission_amount NUMERIC DEFAULT 0,
    sick_deduction_amount NUMERIC DEFAULT 0,
    bonus_amount NUMERIC DEFAULT 0,
    vacation_pay_base NUMERIC DEFAULT 0,
    total_payout NUMERIC DEFAULT 0,
    details_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Settings table
CREATE TABLE public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value_json JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. User roles table (for RBAC)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

-- Enable Row Level Security on all tables
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create function to check if user has any management role
CREATE OR REPLACE FUNCTION public.is_manager_or_above(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager', 'payroll')
  )
$$;

-- Get user's agent ID
CREATE OR REPLACE FUNCTION public.get_agent_id_for_user(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.agents WHERE user_id = _user_id LIMIT 1
$$;

-- RLS Policies for agents
CREATE POLICY "Admins and managers can view all agents" ON public.agents
  FOR SELECT USING (public.is_manager_or_above(auth.uid()));
  
CREATE POLICY "Agents can view themselves" ON public.agents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage agents" ON public.agents
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for products (public read, admin write)
CREATE POLICY "Anyone authenticated can view products" ON public.products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage products" ON public.products
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for sales
CREATE POLICY "Managers can view all sales" ON public.sales
  FOR SELECT USING (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Agents can view own sales" ON public.sales
  FOR SELECT USING (agent_id = public.get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins and managers can manage sales" ON public.sales
  FOR ALL USING (public.is_manager_or_above(auth.uid()));

-- RLS Policies for commission_transactions
CREATE POLICY "Managers can view all commissions" ON public.commission_transactions
  FOR SELECT USING (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Agents can view own commissions" ON public.commission_transactions
  FOR SELECT USING (agent_id = public.get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins and payroll can manage commissions" ON public.commission_transactions
  FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll'));

-- RLS Policies for absences
CREATE POLICY "Managers can view all absences" ON public.absences
  FOR SELECT USING (public.is_manager_or_above(auth.uid()));

CREATE POLICY "Agents can view own absences" ON public.absences
  FOR SELECT USING (agent_id = public.get_agent_id_for_user(auth.uid()));

CREATE POLICY "Admins and managers can manage absences" ON public.absences
  FOR ALL USING (public.is_manager_or_above(auth.uid()));

-- RLS Policies for payroll_runs
CREATE POLICY "Payroll users can view payroll runs" ON public.payroll_runs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll'));

CREATE POLICY "Payroll users can manage payroll runs" ON public.payroll_runs
  FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll'));

-- RLS Policies for payroll_lines
CREATE POLICY "Payroll users can view all payroll lines" ON public.payroll_lines
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll'));

CREATE POLICY "Agents can view own payroll lines" ON public.payroll_lines
  FOR SELECT USING (agent_id = public.get_agent_id_for_user(auth.uid()));

CREATE POLICY "Payroll users can manage payroll lines" ON public.payroll_lines
  FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'payroll'));

-- RLS Policies for settings
CREATE POLICY "Admins can manage settings" ON public.settings
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view settings" ON public.settings
  FOR SELECT TO authenticated USING (true);

-- RLS Policies for user_roles
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_runs_updated_at BEFORE UPDATE ON public.payroll_runs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payroll_lines_updated_at BEFORE UPDATE ON public.payroll_lines
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.settings (key, value_json) VALUES
    ('vacation_pay_percentage', '{"value": 12.5}'),
    ('default_clawback_days', '{"value": 30}'),
    ('sick_day_deduction_hourly', '{"value": 150}');