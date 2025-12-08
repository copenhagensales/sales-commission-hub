-- Create enum for content platform
CREATE TYPE public.content_platform AS ENUM ('TikTok', 'Instagram');

-- Create enum for content type
CREATE TYPE public.content_type AS ENUM ('tiktok_video', 'insta_story', 'insta_post');

-- Create enum for content status
CREATE TYPE public.content_status AS ENUM ('planned', 'in_progress', 'filmed', 'edited', 'published');

-- Create weekly_goals table
CREATE TABLE public.weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  tiktok_videos_target INTEGER NOT NULL DEFAULT 7,
  insta_stories_target INTEGER NOT NULL DEFAULT 3,
  insta_posts_target INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(week_start_date)
);

-- Create content_items table
CREATE TABLE public.content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL,
  platform content_platform NOT NULL,
  type content_type NOT NULL,
  title TEXT NOT NULL,
  status content_status NOT NULL DEFAULT 'planned',
  due_date DATE,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create default goals settings table (singleton)
CREATE TABLE public.some_default_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tiktok_videos_target INTEGER NOT NULL DEFAULT 7,
  insta_stories_target INTEGER NOT NULL DEFAULT 3,
  insta_posts_target INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default goals
INSERT INTO public.some_default_goals (tiktok_videos_target, insta_stories_target, insta_posts_target)
VALUES (7, 3, 1);

-- Enable RLS
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.some_default_goals ENABLE ROW LEVEL SECURITY;

-- RLS policies for weekly_goals
CREATE POLICY "Owners can manage weekly_goals" ON public.weekly_goals
  FOR ALL USING (is_owner(auth.uid()));

CREATE POLICY "SOME job title can manage weekly_goals" ON public.weekly_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employee_master_data e
      WHERE (e.private_email = auth.jwt()->>'email' OR e.work_email = auth.jwt()->>'email')
      AND e.job_title = 'SOME'
    )
  );

-- RLS policies for content_items
CREATE POLICY "Owners can manage content_items" ON public.content_items
  FOR ALL USING (is_owner(auth.uid()));

CREATE POLICY "SOME job title can manage content_items" ON public.content_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employee_master_data e
      WHERE (e.private_email = auth.jwt()->>'email' OR e.work_email = auth.jwt()->>'email')
      AND e.job_title = 'SOME'
    )
  );

-- RLS policies for some_default_goals
CREATE POLICY "Owners can manage default_goals" ON public.some_default_goals
  FOR ALL USING (is_owner(auth.uid()));

CREATE POLICY "SOME job title can manage default_goals" ON public.some_default_goals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM employee_master_data e
      WHERE (e.private_email = auth.jwt()->>'email' OR e.work_email = auth.jwt()->>'email')
      AND e.job_title = 'SOME'
    )
  );

CREATE POLICY "Authenticated can view default_goals" ON public.some_default_goals
  FOR SELECT USING (true);

-- Create indexes
CREATE INDEX idx_content_items_week ON public.content_items(week_start_date);
CREATE INDEX idx_content_items_status ON public.content_items(status);
CREATE INDEX idx_weekly_goals_week ON public.weekly_goals(week_start_date);