-- Add postponed_until column to track 24-hour postponement
ALTER TABLE public.absence_request_v2 
ADD COLUMN IF NOT EXISTS postponed_until timestamp with time zone DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.absence_request_v2.postponed_until IS 'Timestamp until which the request is postponed. Can only be set once per request.';