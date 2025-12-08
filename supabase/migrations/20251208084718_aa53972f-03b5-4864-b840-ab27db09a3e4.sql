-- Create table for weekly social media metrics
CREATE TABLE public.some_weekly_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start_date DATE NOT NULL,
  tiktok_followers INTEGER DEFAULT 0,
  tiktok_views INTEGER DEFAULT 0,
  tiktok_likes INTEGER DEFAULT 0,
  insta_followers INTEGER DEFAULT 0,
  insta_views INTEGER DEFAULT 0,
  insta_likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT some_weekly_metrics_week_unique UNIQUE (week_start_date)
);

-- Enable RLS
ALTER TABLE public.some_weekly_metrics ENABLE ROW LEVEL SECURITY;

-- RLS policies - same as content_items
CREATE POLICY "Owners can manage some_weekly_metrics"
  ON public.some_weekly_metrics FOR ALL
  USING (is_owner(auth.uid()));

CREATE POLICY "SOME job title can manage some_weekly_metrics"
  ON public.some_weekly_metrics FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM employee_master_data e
      WHERE (e.private_email = (auth.jwt() ->> 'email') OR e.work_email = (auth.jwt() ->> 'email'))
      AND e.job_title = 'SOME'
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_some_weekly_metrics_updated_at
  BEFORE UPDATE ON public.some_weekly_metrics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();