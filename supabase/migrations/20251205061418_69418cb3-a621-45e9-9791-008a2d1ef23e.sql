-- Create enum for contract types
CREATE TYPE public.contract_type AS ENUM (
  'employment',      -- Ansættelseskontrakt
  'amendment',       -- Tillægsaftale
  'nda',            -- Fortrolighedsaftale
  'company_car',    -- Firmabilaftale
  'termination',    -- Opsigelse
  'other'           -- Andet
);

-- Create enum for contract status
CREATE TYPE public.contract_status AS ENUM (
  'draft',           -- Kladde
  'pending_employee', -- Afventer medarbejder
  'pending_manager',  -- Afventer leder
  'signed',          -- Underskrevet
  'rejected',        -- Afvist
  'expired'          -- Udløbet
);

-- Contract templates table
CREATE TABLE public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type contract_type NOT NULL,
  description TEXT,
  content TEXT NOT NULL, -- HTML/Markdown with placeholders like {{employee_name}}, {{job_title}}, etc.
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Contracts sent to employees
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.contract_templates(id),
  employee_id UUID REFERENCES public.employee_master_data(id) ON DELETE CASCADE NOT NULL,
  type contract_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- Merged content with employee data
  status contract_status DEFAULT 'draft',
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Contract signatures
CREATE TABLE public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  signer_type TEXT NOT NULL CHECK (signer_type IN ('employee', 'manager')),
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_employee_id UUID REFERENCES public.employee_master_data(id),
  signed_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT,
  acceptance_text TEXT, -- The text they agreed to
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contract_templates
CREATE POLICY "Managers can manage contract templates"
ON public.contract_templates FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Authenticated users can view active templates"
ON public.contract_templates FOR SELECT
USING (is_active = true);

-- RLS Policies for contracts
CREATE POLICY "Managers can manage all contracts"
ON public.contracts FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Employees can view their own contracts"
ON public.contracts FOR SELECT
USING (employee_id = get_current_employee_id());

CREATE POLICY "Employees can update their pending contracts"
ON public.contracts FOR UPDATE
USING (employee_id = get_current_employee_id() AND status = 'pending_employee')
WITH CHECK (employee_id = get_current_employee_id());

-- RLS Policies for contract_signatures
CREATE POLICY "Managers can manage all signatures"
ON public.contract_signatures FOR ALL
USING (is_manager_or_above(auth.uid()))
WITH CHECK (is_manager_or_above(auth.uid()));

CREATE POLICY "Employees can view signatures on their contracts"
ON public.contract_signatures FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.contracts 
  WHERE contracts.id = contract_signatures.contract_id 
  AND contracts.employee_id = get_current_employee_id()
));

CREATE POLICY "Employees can sign their own contracts"
ON public.contract_signatures FOR INSERT
WITH CHECK (signer_employee_id = get_current_employee_id() AND signer_type = 'employee');

-- Triggers for updated_at
CREATE TRIGGER update_contract_templates_updated_at
BEFORE UPDATE ON public.contract_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.contract_templates (name, type, description, content) VALUES
('Standard ansættelseskontrakt', 'employment', 'Standard ansættelsesaftale for nye medarbejdere', 
'<h1>Ansættelseskontrakt</h1>

<p>Mellem <strong>Copenhagen Sales ApS</strong> (herefter "Arbejdsgiver") og</p>

<p><strong>{{employee_name}}</strong><br>
CPR-nr: {{cpr_number}}<br>
Adresse: {{address}}</p>

<h2>1. Stillingsbetegnelse</h2>
<p>Du ansættes som <strong>{{job_title}}</strong> med tiltrædelse den <strong>{{employment_start_date}}</strong>.</p>

<h2>2. Arbejdssted</h2>
<p>Dit primære arbejdssted er {{work_location}}.</p>

<h2>3. Arbejdstid</h2>
<p>Din ugentlige arbejdstid er {{weekly_hours}} timer. Mødetid: {{standard_start_time}}.</p>

<h2>4. Løn</h2>
<p>Din aflønning er {{salary_type}} på {{salary_amount}} DKK.</p>

<h2>5. Ferie</h2>
<p>Du er omfattet af ferieloven. Ferieordning: {{vacation_type}}.</p>

<h2>6. Opsigelse</h2>
<p>Ansættelsesforholdet kan opsiges med funktionærlovens varsler.</p>

<h2>7. Tavshedspligt</h2>
<p>Du har tavshedspligt om alle fortrolige oplysninger.</p>

<p><em>Dato: {{current_date}}</em></p>'),

('Fortrolighedsaftale (NDA)', 'nda', 'Fortrolighedsaftale for medarbejdere', 
'<h1>Fortrolighedsaftale</h1>

<p>Mellem <strong>Copenhagen Sales ApS</strong> og <strong>{{employee_name}}</strong>.</p>

<h2>1. Formål</h2>
<p>Denne aftale sikrer fortrolighed om virksomhedens oplysninger.</p>

<h2>2. Fortrolige oplysninger</h2>
<p>Omfatter: kundedata, forretningsstrategier, priser, kontrakter, og interne processer.</p>

<h2>3. Forpligtelser</h2>
<p>Du må ikke videregive, kopiere eller udnytte fortrolige oplysninger uden skriftlig tilladelse.</p>

<h2>4. Varighed</h2>
<p>Denne aftale gælder under ansættelsen og 2 år efter ophør.</p>

<h2>5. Konsekvenser</h2>
<p>Brud på aftalen kan medføre erstatningsansvar og bortvisning.</p>

<p><em>Dato: {{current_date}}</em></p>'),

('Tillægsaftale - Lønændring', 'amendment', 'Tillæg til ansættelseskontrakt ved lønændring', 
'<h1>Tillæg til Ansættelseskontrakt</h1>

<p>Vedrørende: <strong>{{employee_name}}</strong></p>

<h2>Ændring</h2>
<p>Med virkning fra {{effective_date}} ændres din løn til:</p>
<p>{{new_salary_details}}</p>

<p>Alle øvrige vilkår i din ansættelseskontrakt forbliver uændrede.</p>

<p><em>Dato: {{current_date}}</em></p>'),

('Firmabilaftale', 'company_car', 'Aftale om firmabil til medarbejder', 
'<h1>Firmabilaftale</h1>

<p>Mellem <strong>Copenhagen Sales ApS</strong> og <strong>{{employee_name}}</strong>.</p>

<h2>1. Køretøj</h2>
<p>Du får stillet firmabil til rådighed: {{vehicle_details}}</p>

<h2>2. Anvendelse</h2>
<p>Bilen må anvendes til arbejdsrelateret kørsel og privat kørsel.</p>

<h2>3. Beskatning</h2>
<p>Du beskattes af fri bil efter gældende regler.</p>

<h2>4. Vedligeholdelse</h2>
<p>Arbejdsgiver betaler service, forsikring og brændstof til arbejdskørsel.</p>

<h2>5. Returnering</h2>
<p>Ved fratrædelse returneres bilen senest sidste arbejdsdag.</p>

<p><em>Dato: {{current_date}}</em></p>');