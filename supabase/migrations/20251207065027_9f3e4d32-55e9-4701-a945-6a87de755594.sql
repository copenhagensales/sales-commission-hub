
-- Create candidates table for recruitment tracking
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT,
  notes TEXT,
  resume_url TEXT,
  applied_position TEXT,
  interview_date TIMESTAMP WITH TIME ZONE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  assigned_to UUID REFERENCES public.employee_master_data(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table for SMS/communication tracking
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employee_master_data(id),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'sms' CHECK (message_type IN ('sms', 'email', 'call')),
  content TEXT NOT NULL,
  phone_number TEXT,
  status TEXT DEFAULT 'sent',
  twilio_sid TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_records table for Twilio softphone integration
CREATE TABLE public.call_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES public.employee_master_data(id),
  twilio_call_sid TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_number TEXT,
  to_number TEXT,
  status TEXT DEFAULT 'initiated',
  duration_seconds INTEGER,
  recording_url TEXT,
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Create recruitment_notifications table
CREATE TABLE public.recruitment_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for candidates
CREATE POLICY "Rekruttering and owners can manage candidates"
ON public.candidates FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view candidates"
ON public.candidates FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- RLS policies for messages
CREATE POLICY "Rekruttering and owners can manage messages"
ON public.messages FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view messages"
ON public.messages FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- RLS policies for call_records
CREATE POLICY "Rekruttering and owners can manage call records"
ON public.call_records FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

CREATE POLICY "Teamledere can view call records"
ON public.call_records FOR SELECT
USING (is_teamleder_or_above(auth.uid()));

-- RLS policies for recruitment_notifications
CREATE POLICY "Users can view own notifications"
ON public.recruitment_notifications FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.recruitment_notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Owners and rekruttering can manage all notifications"
ON public.recruitment_notifications FOR ALL
USING (is_owner(auth.uid()) OR is_rekruttering(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_candidates_status ON public.candidates(status);
CREATE INDEX idx_candidates_assigned_to ON public.candidates(assigned_to);
CREATE INDEX idx_messages_candidate_id ON public.messages(candidate_id);
CREATE INDEX idx_call_records_candidate_id ON public.call_records(candidate_id);
CREATE INDEX idx_recruitment_notifications_user_id ON public.recruitment_notifications(user_id);

-- Create updated_at trigger for candidates
CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
