-- Create table for storing client adjustment percentages
CREATE TABLE public.client_adjustment_percents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    deduction_percent numeric(5,2) NOT NULL DEFAULT 0,
    cancellation_percent numeric(5,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_adjustment_percents ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read
CREATE POLICY "Authenticated users can read client_adjustment_percents"
ON public.client_adjustment_percents
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to insert
CREATE POLICY "Authenticated users can insert client_adjustment_percents"
ON public.client_adjustment_percents
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to update
CREATE POLICY "Authenticated users can update client_adjustment_percents"
ON public.client_adjustment_percents
FOR UPDATE
TO authenticated
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_client_adjustment_percents_updated_at
BEFORE UPDATE ON public.client_adjustment_percents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();