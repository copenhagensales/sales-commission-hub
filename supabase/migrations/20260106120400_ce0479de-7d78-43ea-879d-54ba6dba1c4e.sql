-- Add trusted_ip_ranges column to job_positions
ALTER TABLE job_positions 
ADD COLUMN IF NOT EXISTS trusted_ip_ranges JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN job_positions.trusted_ip_ranges IS 'Array of trusted IP ranges that bypass MFA for this position. Format: [{"name": "Office", "ip": "82.103.140.0/24"}]';