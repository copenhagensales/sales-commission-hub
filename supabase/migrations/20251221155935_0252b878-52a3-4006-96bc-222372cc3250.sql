-- Onboarding days master table
CREATE TABLE public.onboarding_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day INTEGER NOT NULL,
  week INTEGER NOT NULL,
  focus_id TEXT NOT NULL,
  focus_title TEXT NOT NULL,
  focus_description TEXT,
  videos JSONB NOT NULL DEFAULT '[]',
  quiz_questions INTEGER DEFAULT 5,
  quiz_pass_score INTEGER DEFAULT 80,
  drill_id TEXT,
  drill_title TEXT,
  drill_duration_min INTEGER,
  call_mission TEXT,
  checkout_confidence_scale BOOLEAN DEFAULT true,
  checkout_blockers TEXT[] DEFAULT '{}',
  leader_course_title TEXT,
  leader_course_duration_min INTEGER,
  leader_course_ppt_id TEXT,
  coaching_required BOOLEAN DEFAULT true,
  coaching_focus_only BOOLEAN DEFAULT true,
  coaching_reviews_per_rep INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(day, week)
);

-- Drill library
CREATE TABLE public.onboarding_drills (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  focus TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employee onboarding progress
CREATE TABLE public.employee_onboarding_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  onboarding_day_id UUID NOT NULL REFERENCES public.onboarding_days(id) ON DELETE CASCADE,
  videos_completed JSONB DEFAULT '[]',
  quiz_completed BOOLEAN DEFAULT false,
  quiz_score INTEGER,
  drill_completed BOOLEAN DEFAULT false,
  checkout_completed BOOLEAN DEFAULT false,
  checkout_confidence INTEGER,
  checkout_blockers TEXT[],
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, onboarding_day_id)
);

-- Coaching tasks
CREATE TABLE public.onboarding_coaching_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  leader_id UUID REFERENCES public.employee_master_data(id),
  onboarding_day_id UUID NOT NULL REFERENCES public.onboarding_days(id) ON DELETE CASCADE,
  call_id TEXT,
  call_timestamp TIMESTAMP WITH TIME ZONE,
  score INTEGER CHECK (score >= 0 AND score <= 2),
  strength TEXT,
  improvement TEXT,
  suggested_phrase TEXT,
  assigned_drill_id TEXT REFERENCES public.onboarding_drills(id),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'overdue')),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_drills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_coaching_tasks ENABLE ROW LEVEL SECURITY;

-- Onboarding days - readable by all authenticated
CREATE POLICY "Onboarding days readable by authenticated" 
ON public.onboarding_days FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Drills - readable by all authenticated
CREATE POLICY "Drills readable by authenticated" 
ON public.onboarding_drills FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Progress - employees can see/update their own
CREATE POLICY "Employees can view own progress" 
ON public.employee_onboarding_progress FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Employees can insert own progress" 
ON public.employee_onboarding_progress FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Employees can update own progress" 
ON public.employee_onboarding_progress FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Coaching tasks - viewable by authenticated
CREATE POLICY "Coaching tasks viewable by authenticated" 
ON public.onboarding_coaching_tasks FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Coaching tasks insertable by authenticated" 
ON public.onboarding_coaching_tasks FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Coaching tasks updatable by authenticated" 
ON public.onboarding_coaching_tasks FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- Admin policies for managing content
CREATE POLICY "Admins can manage onboarding days" 
ON public.onboarding_days FOR ALL 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage drills" 
ON public.onboarding_drills FOR ALL 
USING (auth.uid() IS NOT NULL);