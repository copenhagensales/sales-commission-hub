-- Create employee invitations table
CREATE TABLE public.employee_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.employee_invitations ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to manage invitations
CREATE POLICY "Managers can manage invitations"
ON public.employee_invitations
FOR ALL
USING (public.is_manager_or_above(auth.uid()));

-- Policy for public access with valid token (for self-service form)
CREATE POLICY "Anyone can read invitation with valid token"
ON public.employee_invitations
FOR SELECT
USING (true);

-- Index for token lookup
CREATE INDEX idx_employee_invitations_token ON public.employee_invitations(token);
CREATE INDEX idx_employee_invitations_email ON public.employee_invitations(email);