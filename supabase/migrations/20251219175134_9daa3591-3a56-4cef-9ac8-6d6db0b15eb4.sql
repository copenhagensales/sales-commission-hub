-- Create table for weekend cleanup configuration
CREATE TABLE public.weekend_cleanup_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tasks TEXT,
  recipients TEXT, -- Comma-separated emails
  send_time TIME DEFAULT '16:10:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default row
INSERT INTO public.weekend_cleanup_config (tasks, recipients) 
VALUES (
  'Ryd mødeborde
Tøm køleskabet for gamle madvarer
Tjek at alle vinduer er lukket
Sluk for kaffemaskinen
Sørg for at alle skraldespande er tømt',
  ''
);

-- Enable RLS
ALTER TABLE public.weekend_cleanup_config ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to read/update
CREATE POLICY "Allow authenticated users to read weekend_cleanup_config"
ON public.weekend_cleanup_config
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to update weekend_cleanup_config"
ON public.weekend_cleanup_config
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);