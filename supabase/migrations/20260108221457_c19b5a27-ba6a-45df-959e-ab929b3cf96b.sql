-- Add missing columns for TV board access settings
ALTER TABLE public.tv_board_access 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_rotate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rotate_interval_seconds INTEGER,
ADD COLUMN IF NOT EXISTS celebration_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS celebration_effect TEXT DEFAULT 'fireworks',
ADD COLUMN IF NOT EXISTS celebration_duration INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS celebration_trigger_condition TEXT DEFAULT 'any_update',
ADD COLUMN IF NOT EXISTS celebration_trigger_value NUMERIC,
ADD COLUMN IF NOT EXISTS celebration_text TEXT;