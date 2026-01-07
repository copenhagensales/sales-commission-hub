-- Add can_receive_calls field to agent_presence table
ALTER TABLE public.agent_presence 
ADD COLUMN can_receive_calls boolean DEFAULT false;