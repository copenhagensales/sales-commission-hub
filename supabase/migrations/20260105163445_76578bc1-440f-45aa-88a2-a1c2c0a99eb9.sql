-- Enable full replica identity for call_records to support realtime updates
ALTER TABLE public.call_records REPLICA IDENTITY FULL;

-- Add call_records to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_records;