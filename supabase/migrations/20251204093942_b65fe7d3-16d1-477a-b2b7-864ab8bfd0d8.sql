-- Create vagt-flow specific types (renamed to avoid conflict with existing app_role)
CREATE TYPE vagt_flow_role AS ENUM ('admin', 'planner', 'employee', 'brand_viewer');
CREATE TYPE location_status AS ENUM ('Ny', 'Aktiv', 'Pause', 'Sortlistet');
CREATE TYPE booking_status AS ENUM ('Planlagt', 'Bekræftet', 'Aflyst', 'Afsluttet');
CREATE TYPE vagt_absence_reason AS ENUM ('Ferie', 'Syg', 'Barn syg', 'Andet');
CREATE TYPE communication_channel AS ENUM ('Telefon', 'Mail', 'Andet');
CREATE TYPE sms_type AS ENUM ('new_shift', 'updated_shift', 'deleted_shift', 'week_confirmation');

-- Brand table
CREATE TABLE public.brand (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color_hex TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Location table
CREATE TABLE public.location (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT,
  address_street TEXT,
  address_postal_code TEXT,
  address_city TEXT,
  region TEXT,
  contact_person_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  can_book_eesy BOOLEAN DEFAULT false,
  can_book_yousee BOOLEAN DEFAULT false,
  status location_status DEFAULT 'Ny',
  notes TEXT,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employee table (unified with auth users)
CREATE TABLE public.employee (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  role vagt_flow_role NOT NULL DEFAULT 'employee',
  availability_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  team TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Booking table
CREATE TABLE public.booking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.location(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES public.brand(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  week_number INT NOT NULL,
  year INT NOT NULL,
  status booking_status DEFAULT 'Planlagt',
  expected_staff_count INT DEFAULT 2,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Employee Absence table
CREATE TABLE public.employee_absence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason vagt_absence_reason NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_absence_range CHECK (end_date >= start_date)
);

-- Booking Assignment (shifts)
CREATE TABLE public.booking_assignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.booking(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  note TEXT,
  sales_reported INT DEFAULT 0,
  leads_reported INT DEFAULT 0,
  on_my_way_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Communication Log
CREATE TABLE public.communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES public.location(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.booking(id) ON DELETE CASCADE,
  created_by_employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  channel communication_channel NOT NULL,
  note TEXT NOT NULL
);

-- SMS Notification Log
CREATE TABLE public.sms_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  booking_assignment_id UUID REFERENCES public.booking_assignment(id) ON DELETE SET NULL,
  type sms_type NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  message_body TEXT NOT NULL
);

-- Vehicle table
CREATE TABLE public.vehicle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  license_plate TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Mileage Report table
CREATE TABLE public.mileage_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicle(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.booking(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_km INT NOT NULL,
  end_km INT NOT NULL,
  route_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Consent Log table
CREATE TABLE public.consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  consented_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT
);

-- Time Off Request table
CREATE TABLE public.time_off_request (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employee(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.employee(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_booking_dates ON public.booking(start_date, end_date);
CREATE INDEX idx_booking_location ON public.booking(location_id);
CREATE INDEX idx_booking_brand ON public.booking(brand_id);
CREATE INDEX idx_booking_week ON public.booking(year, week_number);
CREATE INDEX idx_assignment_booking ON public.booking_assignment(booking_id);
CREATE INDEX idx_assignment_employee ON public.booking_assignment(employee_id);
CREATE INDEX idx_assignment_date ON public.booking_assignment(date);
CREATE INDEX idx_absence_employee ON public.employee_absence(employee_id);
CREATE INDEX idx_absence_dates ON public.employee_absence(start_date, end_date);

-- Enable RLS
ALTER TABLE public.brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_absence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_report ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off_request ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand
CREATE POLICY "Everyone can view brands" ON public.brand FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage brands" ON public.brand FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);

-- RLS Policies for location
CREATE POLICY "Admin and planners can manage locations" ON public.location FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view locations" ON public.location FOR SELECT TO authenticated USING (true);

-- RLS Policies for employee
CREATE POLICY "Admin and planners can manage employees" ON public.employee FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee e WHERE e.id = auth.uid() AND e.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view themselves" ON public.employee FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "All employees can view other employees" ON public.employee FOR SELECT TO authenticated USING (true);

-- RLS Policies for booking
CREATE POLICY "Admin and planners can manage bookings" ON public.booking FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view all bookings" ON public.booking FOR SELECT TO authenticated USING (true);

-- RLS Policies for absence
CREATE POLICY "Admin and planners can manage absences" ON public.employee_absence FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view their absences" ON public.employee_absence FOR SELECT TO authenticated USING (employee_id = auth.uid());

-- RLS Policies for booking_assignment
CREATE POLICY "Admin and planners can manage assignments" ON public.booking_assignment FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view all assignments" ON public.booking_assignment FOR SELECT TO authenticated USING (true);
CREATE POLICY "Employees can update their on_my_way status" ON public.booking_assignment FOR UPDATE TO authenticated USING (employee_id = auth.uid());

-- RLS Policies for communication_log
CREATE POLICY "Admin and planners can manage communication logs" ON public.communication_log FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view communication logs" ON public.communication_log FOR SELECT TO authenticated USING (true);

-- RLS Policies for SMS logs
CREATE POLICY "Admin and planners can view SMS logs" ON public.sms_notification_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);

-- RLS Policies for vehicle
CREATE POLICY "Everyone can view vehicles" ON public.vehicle FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage vehicles" ON public.vehicle FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);

-- RLS Policies for mileage_report
CREATE POLICY "Admins can manage mileage reports" ON public.mileage_report FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view their mileage reports" ON public.mileage_report FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY "Employees can create their mileage reports" ON public.mileage_report FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

-- RLS Policies for consent_log
CREATE POLICY "Admins can view consent logs" ON public.consent_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can create their consent" ON public.consent_log FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

-- RLS Policies for time_off_request
CREATE POLICY "Admins can manage time off requests" ON public.time_off_request FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view their time off requests" ON public.time_off_request FOR SELECT TO authenticated USING (employee_id = auth.uid());
CREATE POLICY "Employees can create time off requests" ON public.time_off_request FOR INSERT TO authenticated WITH CHECK (employee_id = auth.uid());

-- Seed data: Brands
INSERT INTO public.brand (name, color_hex, is_active) VALUES
  ('Eesy', '#FF7A00', true),
  ('YouSee', '#0050A0', true);

-- Seed data: Sample Locations
INSERT INTO public.location (name, type, address_street, address_postal_code, address_city, region, contact_person_name, contact_phone, contact_email, can_book_eesy, can_book_yousee, status) VALUES
  ('Bilka Ishøj', 'Butik', 'Ishøj Storcenter 48', '2635', 'Ishøj', 'Sjælland', 'Lars Nielsen', '+4512345678', 'lars@bilka.dk', true, true, 'Aktiv'),
  ('Føtex Roskilde', 'Butik', 'Algade 49', '4000', 'Roskilde', 'Sjælland', 'Mette Hansen', '+4523456789', 'mette@fotex.dk', true, false, 'Aktiv'),
  ('Netto Odense', 'Butik', 'Kongensgade 15', '5000', 'Odense', 'Fyn', 'Peter Jensen', '+4534567890', 'peter@netto.dk', false, true, 'Aktiv');