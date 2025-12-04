-- Create enum for shift status
CREATE TYPE public.shift_status AS ENUM ('planned', 'completed', 'cancelled');

-- Create enum for absence type
CREATE TYPE public.absence_type_v2 AS ENUM ('vacation', 'sick');

-- Create enum for absence request status
CREATE TYPE public.absence_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Shifts table
CREATE TABLE public.shift (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  planned_hours NUMERIC GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 - COALESCE(break_minutes, 0) / 60.0
  ) STORED,
  status shift_status DEFAULT 'planned',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  CONSTRAINT no_overlapping_shifts UNIQUE (employee_id, date, start_time)
);

-- Absence requests table
CREATE TABLE public.absence_request_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  type absence_type_v2 NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  start_time TIME, -- for partial day absence
  end_time TIME,   -- for partial day absence
  is_full_day BOOLEAN DEFAULT true,
  comment TEXT,
  status absence_request_status DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Time entries for clock in/out
CREATE TABLE public.time_entry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shift(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  actual_hours NUMERIC GENERATED ALWAYS AS (
    CASE WHEN clock_in IS NOT NULL AND clock_out IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 
    ELSE NULL END
  ) STORED,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Danish holidays table
CREATE TABLE public.danish_holiday (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  year INTEGER NOT NULL
);

-- Notifications table
CREATE TABLE public.shift_notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'absence_request', 'absence_approved', 'absence_rejected', 'shift_change'
  reference_id UUID, -- ID of related absence_request or shift
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert Danish holidays for 2024-2026
INSERT INTO public.danish_holiday (date, name, year) VALUES
-- 2024
('2024-01-01', 'Nytårsdag', 2024),
('2024-03-28', 'Skærtorsdag', 2024),
('2024-03-29', 'Langfredag', 2024),
('2024-03-31', 'Påskedag', 2024),
('2024-04-01', 'Anden påskedag', 2024),
('2024-04-26', 'Store bededag', 2024),
('2024-05-09', 'Kristi himmelfartsdag', 2024),
('2024-05-19', 'Pinsedag', 2024),
('2024-05-20', 'Anden pinsedag', 2024),
('2024-06-05', 'Grundlovsdag', 2024),
('2024-12-24', 'Juleaftensdag', 2024),
('2024-12-25', 'Juledag', 2024),
('2024-12-26', 'Anden juledag', 2024),
('2024-12-31', 'Nytårsaftensdag', 2024),
-- 2025
('2025-01-01', 'Nytårsdag', 2025),
('2025-04-17', 'Skærtorsdag', 2025),
('2025-04-18', 'Langfredag', 2025),
('2025-04-20', 'Påskedag', 2025),
('2025-04-21', 'Anden påskedag', 2025),
('2025-05-29', 'Kristi himmelfartsdag', 2025),
('2025-06-08', 'Pinsedag', 2025),
('2025-06-09', 'Anden pinsedag', 2025),
('2025-06-05', 'Grundlovsdag', 2025),
('2025-12-24', 'Juleaftensdag', 2025),
('2025-12-25', 'Juledag', 2025),
('2025-12-26', 'Anden juledag', 2025),
('2025-12-31', 'Nytårsaftensdag', 2025),
-- 2026
('2026-01-01', 'Nytårsdag', 2026),
('2026-04-02', 'Skærtorsdag', 2026),
('2026-04-03', 'Langfredag', 2026),
('2026-04-05', 'Påskedag', 2026),
('2026-04-06', 'Anden påskedag', 2026),
('2026-05-14', 'Kristi himmelfartsdag', 2026),
('2026-05-24', 'Pinsedag', 2026),
('2026-05-25', 'Anden pinsedag', 2026),
('2026-06-05', 'Grundlovsdag', 2026),
('2026-12-24', 'Juleaftensdag', 2026),
('2026-12-25', 'Juledag', 2026),
('2026-12-26', 'Anden juledag', 2026),
('2026-12-31', 'Nytårsaftensdag', 2026);

-- Enable RLS
ALTER TABLE public.shift ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_request_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.danish_holiday ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_notification ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shift
CREATE POLICY "Managers can manage all shifts" ON public.shift
FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Employees can view their own shifts" ON public.shift
FOR SELECT USING (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE private_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- RLS Policies for absence_request_v2
CREATE POLICY "Managers can manage all absence requests" ON public.absence_request_v2
FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Employees can view their own absence requests" ON public.absence_request_v2
FOR SELECT USING (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE private_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Employees can create their own absence requests" ON public.absence_request_v2
FOR INSERT WITH CHECK (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE private_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- RLS Policies for time_entry
CREATE POLICY "Managers can manage all time entries" ON public.time_entry
FOR ALL USING (is_manager_or_above(auth.uid()));

CREATE POLICY "Employees can view their own time entries" ON public.time_entry
FOR SELECT USING (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE private_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

CREATE POLICY "Employees can manage their own time entries" ON public.time_entry
FOR ALL USING (
  employee_id IN (
    SELECT id FROM public.employee_master_data 
    WHERE private_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- RLS Policies for danish_holiday
CREATE POLICY "Anyone can view holidays" ON public.danish_holiday
FOR SELECT USING (true);

CREATE POLICY "Managers can manage holidays" ON public.danish_holiday
FOR ALL USING (is_manager_or_above(auth.uid()));

-- RLS Policies for shift_notification
CREATE POLICY "Users can view their own notifications" ON public.shift_notification
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications" ON public.shift_notification
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON public.shift_notification
FOR INSERT WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_shift_updated_at
BEFORE UPDATE ON public.shift
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_absence_request_v2_updated_at
BEFORE UPDATE ON public.absence_request_v2
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_time_entry_updated_at
BEFORE UPDATE ON public.time_entry
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_shift_employee_date ON public.shift(employee_id, date);
CREATE INDEX idx_absence_request_v2_employee ON public.absence_request_v2(employee_id);
CREATE INDEX idx_absence_request_v2_status ON public.absence_request_v2(status);
CREATE INDEX idx_time_entry_employee_date ON public.time_entry(employee_id, date);
CREATE INDEX idx_shift_notification_user ON public.shift_notification(user_id, is_read);