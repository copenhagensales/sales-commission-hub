-- Create table for tracking sales streaks
CREATE TABLE public.employee_sales_streaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_streak_date DATE,
  total_streak_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

-- Create table for tracking achievements/badges
CREATE TABLE public.employee_sales_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, achievement_type)
);

-- Create table for personal records
CREATE TABLE public.employee_sales_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL,
  record_value NUMERIC NOT NULL,
  achieved_at DATE NOT NULL,
  period_reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, record_type)
);

-- Create table for tracking accumulated XP/level progress
CREATE TABLE public.employee_sales_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  total_earned NUMERIC NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

-- Enable RLS on all tables
ALTER TABLE public.employee_sales_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_sales_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_sales_levels ENABLE ROW LEVEL SECURITY;

-- RLS for employee_sales_streaks
CREATE POLICY "Users can view own streaks" ON public.employee_sales_streaks
  FOR SELECT USING (employee_id = get_current_employee_id());

CREATE POLICY "Users can insert own streaks" ON public.employee_sales_streaks
  FOR INSERT WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Users can update own streaks" ON public.employee_sales_streaks
  FOR UPDATE USING (employee_id = get_current_employee_id());

CREATE POLICY "Managers can view all streaks" ON public.employee_sales_streaks
  FOR SELECT USING (is_teamleder_or_above(auth.uid()));

-- RLS for employee_sales_achievements
CREATE POLICY "Users can view own achievements" ON public.employee_sales_achievements
  FOR SELECT USING (employee_id = get_current_employee_id());

CREATE POLICY "Users can insert own achievements" ON public.employee_sales_achievements
  FOR INSERT WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Managers can view all achievements" ON public.employee_sales_achievements
  FOR SELECT USING (is_teamleder_or_above(auth.uid()));

-- RLS for employee_sales_records
CREATE POLICY "Users can view own records" ON public.employee_sales_records
  FOR SELECT USING (employee_id = get_current_employee_id());

CREATE POLICY "Users can insert own records" ON public.employee_sales_records
  FOR INSERT WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Users can update own records" ON public.employee_sales_records
  FOR UPDATE USING (employee_id = get_current_employee_id());

CREATE POLICY "Managers can view all records" ON public.employee_sales_records
  FOR SELECT USING (is_teamleder_or_above(auth.uid()));

-- RLS for employee_sales_levels
CREATE POLICY "Users can view own level" ON public.employee_sales_levels
  FOR SELECT USING (employee_id = get_current_employee_id());

CREATE POLICY "Users can insert own level" ON public.employee_sales_levels
  FOR INSERT WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Users can update own level" ON public.employee_sales_levels
  FOR UPDATE USING (employee_id = get_current_employee_id());

CREATE POLICY "Managers can view all levels" ON public.employee_sales_levels
  FOR SELECT USING (is_teamleder_or_above(auth.uid()));