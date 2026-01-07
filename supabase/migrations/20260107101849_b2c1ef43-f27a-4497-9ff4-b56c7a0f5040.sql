-- Create onboarding_cohorts table for managing cohorts/groups of new hires
CREATE TABLE public.onboarding_cohorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    start_time TIME,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    client_campaign TEXT,
    location TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    max_capacity INTEGER,
    created_by UUID REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cohort_members table for tracking members in each cohort
CREATE TABLE public.cohort_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cohort_id UUID NOT NULL REFERENCES public.onboarding_cohorts(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
    employee_id UUID REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'started', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT cohort_member_unique UNIQUE (cohort_id, candidate_id),
    CONSTRAINT must_have_candidate_or_employee CHECK (candidate_id IS NOT NULL OR employee_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.onboarding_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohort_members ENABLE ROW LEVEL SECURITY;

-- Create updated_at trigger for onboarding_cohorts
CREATE TRIGGER update_onboarding_cohorts_updated_at
    BEFORE UPDATE ON public.onboarding_cohorts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for cohort_members
CREATE TRIGGER update_cohort_members_updated_at
    BEFORE UPDATE ON public.cohort_members
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies for onboarding_cohorts
-- Teamleder, assisterende teamleder, rekruttering, and owner can view cohorts
CREATE POLICY "Authorized users can view cohorts"
ON public.onboarding_cohorts
FOR SELECT
TO authenticated
USING (
    public.is_teamleder_or_above(auth.uid()) OR 
    public.is_rekruttering(auth.uid())
);

-- Rekruttering and owner can insert cohorts
CREATE POLICY "Rekruttering and owner can insert cohorts"
ON public.onboarding_cohorts
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_rekruttering(auth.uid()) OR 
    public.is_owner(auth.uid())
);

-- Rekruttering and owner can update cohorts
CREATE POLICY "Rekruttering and owner can update cohorts"
ON public.onboarding_cohorts
FOR UPDATE
TO authenticated
USING (
    public.is_rekruttering(auth.uid()) OR 
    public.is_owner(auth.uid())
);

-- Only owner can delete cohorts
CREATE POLICY "Only owner can delete cohorts"
ON public.onboarding_cohorts
FOR DELETE
TO authenticated
USING (public.is_owner(auth.uid()));

-- RLS Policies for cohort_members
-- Same view access as cohorts
CREATE POLICY "Authorized users can view cohort members"
ON public.cohort_members
FOR SELECT
TO authenticated
USING (
    public.is_teamleder_or_above(auth.uid()) OR 
    public.is_rekruttering(auth.uid())
);

-- Rekruttering and owner can manage cohort members
CREATE POLICY "Rekruttering and owner can insert cohort members"
ON public.cohort_members
FOR INSERT
TO authenticated
WITH CHECK (
    public.is_rekruttering(auth.uid()) OR 
    public.is_owner(auth.uid())
);

CREATE POLICY "Rekruttering and owner can update cohort members"
ON public.cohort_members
FOR UPDATE
TO authenticated
USING (
    public.is_rekruttering(auth.uid()) OR 
    public.is_owner(auth.uid())
);

CREATE POLICY "Rekruttering and owner can delete cohort members"
ON public.cohort_members
FOR DELETE
TO authenticated
USING (
    public.is_rekruttering(auth.uid()) OR 
    public.is_owner(auth.uid())
);

-- Create indexes for better performance
CREATE INDEX idx_onboarding_cohorts_start_date ON public.onboarding_cohorts(start_date);
CREATE INDEX idx_onboarding_cohorts_team_id ON public.onboarding_cohorts(team_id);
CREATE INDEX idx_onboarding_cohorts_status ON public.onboarding_cohorts(status);
CREATE INDEX idx_cohort_members_cohort_id ON public.cohort_members(cohort_id);
CREATE INDEX idx_cohort_members_candidate_id ON public.cohort_members(candidate_id);
CREATE INDEX idx_cohort_members_employee_id ON public.cohort_members(employee_id);