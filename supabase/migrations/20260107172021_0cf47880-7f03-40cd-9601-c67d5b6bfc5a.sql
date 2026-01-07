-- Create table to track daily bonus payouts
CREATE TABLE public.daily_bonus_payouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  time_stamp_id UUID REFERENCES public.time_stamps(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.employee_master_data(id) ON DELETE SET NULL,
  UNIQUE(employee_id, date)
);

-- Enable RLS
ALTER TABLE public.daily_bonus_payouts ENABLE ROW LEVEL SECURITY;

-- Policy for viewing daily bonus payouts (authenticated users can view)
CREATE POLICY "Authenticated users can view daily bonus payouts"
ON public.daily_bonus_payouts
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy for inserting daily bonus payouts (authenticated users can insert)
CREATE POLICY "Authenticated users can insert daily bonus payouts"
ON public.daily_bonus_payouts
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Policy for deleting daily bonus payouts (authenticated users can delete)
CREATE POLICY "Authenticated users can delete daily bonus payouts"
ON public.daily_bonus_payouts
FOR DELETE
USING (auth.role() = 'authenticated');

-- Index for efficient queries
CREATE INDEX idx_daily_bonus_payouts_employee ON public.daily_bonus_payouts(employee_id);
CREATE INDEX idx_daily_bonus_payouts_date ON public.daily_bonus_payouts(date);

-- Comment for documentation
COMMENT ON TABLE public.daily_bonus_payouts IS 'Tracks daily bonus payouts for new employees. Bonus is triggered for the first N shifts when employee works more than 5 hours and is not absent.';