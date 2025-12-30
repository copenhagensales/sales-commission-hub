-- Create integration debug log table
-- This table stores raw sync data for debugging purposes
-- It replaces itself on each sync (only keeps latest sync per provider)
CREATE TABLE public.integration_debug_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL, -- 'adversus', 'enreach', 'herobase', etc.
  sync_type text NOT NULL, -- 'sales', 'calls', 'users', 'campaigns'
  sync_started_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_completed_at timestamp with time zone,
  raw_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- Array of raw items from API
  registered_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- Items that were saved as sales (tagged with "reg")
  skipped_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- Items that were skipped (with reason)
  stats jsonb DEFAULT '{}'::jsonb, -- Summary stats: total, registered, skipped, errors
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create unique constraint to ensure only one log per provider+sync_type
CREATE UNIQUE INDEX integration_debug_log_provider_type_idx 
  ON public.integration_debug_log (provider, sync_type);

-- Enable RLS
ALTER TABLE public.integration_debug_log ENABLE ROW LEVEL SECURITY;

-- Only managers can view debug logs
CREATE POLICY "Managers can view integration debug logs" 
  ON public.integration_debug_log 
  FOR SELECT 
  USING (is_manager_or_above(auth.uid()));

-- System can manage debug logs (for edge functions)
CREATE POLICY "System can manage integration debug logs" 
  ON public.integration_debug_log 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.integration_debug_log IS 'Stores raw sync data for debugging integration issues. Only keeps latest sync per provider/type.';