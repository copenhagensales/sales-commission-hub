-- Fix existing cancelled sales that have state='cancelled' in raw_payload but validation_status is not set
UPDATE sales 
SET validation_status = 'cancelled', 
    updated_at = NOW()
WHERE raw_payload->>'state' = 'cancelled' 
  AND (validation_status IS NULL OR validation_status NOT IN ('cancelled'));