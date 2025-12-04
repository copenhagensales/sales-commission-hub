-- Add missing columns to employee_absence table
ALTER TABLE public.employee_absence 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'APPROVED',
ADD COLUMN IF NOT EXISTS is_full_day BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS start_time TIME,
ADD COLUMN IF NOT EXISTS end_time TIME,
ADD COLUMN IF NOT EXISTS approved_by_employee_id UUID REFERENCES public.employee(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add missing columns to vehicle table
ALTER TABLE public.vehicle
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create vehicle_mileage table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.vehicle_mileage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicle(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.booking(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  start_mileage INT NOT NULL,
  end_mileage INT NOT NULL,
  estimated_distance INT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on vehicle_mileage
ALTER TABLE public.vehicle_mileage ENABLE ROW LEVEL SECURITY;

-- RLS policies for vehicle_mileage
CREATE POLICY "Admins can manage vehicle mileage" ON public.vehicle_mileage FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.employee WHERE employee.id = auth.uid() AND employee.role IN ('admin', 'planner'))
);
CREATE POLICY "Employees can view vehicle mileage" ON public.vehicle_mileage FOR SELECT TO authenticated USING (true);

-- Add cooldown_weeks and available_after_date to location
ALTER TABLE public.location
ADD COLUMN IF NOT EXISTS cooldown_weeks INT DEFAULT 4,
ADD COLUMN IF NOT EXISTS available_after_date DATE;