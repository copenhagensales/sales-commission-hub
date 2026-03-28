
-- Security incidents table for breach logging (GDPR Article 33)
CREATE TABLE public.security_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  description TEXT,
  affected_categories TEXT[] DEFAULT '{}',
  affected_count INTEGER,
  reported_to_authority BOOLEAN DEFAULT false,
  reported_at TIMESTAMP WITH TIME ZONE,
  remedial_actions TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;

-- Only owners/admins can view and manage security incidents
CREATE POLICY "Owners can manage security incidents"
  ON public.security_incidents
  FOR ALL
  TO authenticated
  USING (public.is_owner(auth.uid()))
  WITH CHECK (public.is_owner(auth.uid()));
