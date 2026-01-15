-- Create system_role_definitions table for detailed role documentation
CREATE TABLE public.system_role_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  detailed_description text,
  color text DEFAULT 'gray',
  icon text DEFAULT 'shield',
  priority int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_role_definitions ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Everyone can view role definitions"
ON public.system_role_definitions
FOR SELECT
USING (true);

-- Only owners can modify
CREATE POLICY "Owners can manage role definitions"
ON public.system_role_definitions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.system_roles
    WHERE user_id = auth.uid() AND role = 'ejer'
  )
);

-- Insert the 5 roles with detailed descriptions
INSERT INTO public.system_role_definitions (key, label, description, detailed_description, color, icon, priority) VALUES
  ('ejer', 'Ejer', 'Fuld adgang til alle funktioner', 
   E'Ejere har ubegrænset adgang til hele systemet inklusiv:\n• Løn og økonomi\n• Alle medarbejderdata\n• Systemindstillinger\n• Alle rapporter og statistikker\n• Fuld redigeringsadgang overalt', 
   'primary', 'crown', 100),
  ('teamleder', 'Teamleder', 'Adgang til eget team og lederfunktioner',
   E'Teamledere kan:\n• Se og redigere medarbejdere i eget team\n• Godkende fravær for teammedlemmer\n• Se teamrapporter og statistikker\n• Administrere vagtplan for teamet\n• Oprette og godkende kontrakter',
   'blue', 'users', 80),
  ('rekruttering', 'Rekruttering', 'Adgang til kandidater og ansættelser',
   E'Rekrutteringsrollen giver:\n• Fuld adgang til kandidatpipeline\n• Planlægning af samtaler\n• Oprettelse af ansættelser\n• Redigering af medarbejderstamdata\n• Adgang til SMS/email skabeloner',
   'amber', 'file-text', 60),
  ('some', 'SOME', 'Adgang til sociale medier og indhold',
   E'SOME-rollen giver:\n• Adgang til indholdsplanlægning\n• Håndtering af ekstra arbejde\n• Adgang til SOME-dashboard\n• Planlægning af opslag',
   'purple', 'calendar', 40),
  ('medarbejder', 'Medarbejder', 'Begrænset adgang til egen profil',
   E'Standardmedarbejdere kan:\n• Se egen profil og stamdata\n• Se egen vagtplan\n• Anmode om fravær\n• Se egne kontrakter\n• Bruge stempelur',
   'muted', 'user', 20);

-- Add trigger for updated_at
CREATE TRIGGER update_system_role_definitions_updated_at
BEFORE UPDATE ON public.system_role_definitions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();