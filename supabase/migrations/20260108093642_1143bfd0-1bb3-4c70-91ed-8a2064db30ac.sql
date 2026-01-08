-- Create scheduled_emails table for delayed email sending
CREATE TABLE public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  employee_id UUID,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  template_key TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Policy: Teamleder+ and rekruttering can manage scheduled emails
CREATE POLICY "Teamleder and rekruttering can manage scheduled emails"
ON public.scheduled_emails
FOR ALL
USING (
  public.is_teamleder_or_above(auth.uid()) OR public.is_rekruttering(auth.uid())
)
WITH CHECK (
  public.is_teamleder_or_above(auth.uid()) OR public.is_rekruttering(auth.uid())
);

-- Index for efficient processing
CREATE INDEX idx_scheduled_emails_pending ON public.scheduled_emails(scheduled_at) 
WHERE status = 'pending';