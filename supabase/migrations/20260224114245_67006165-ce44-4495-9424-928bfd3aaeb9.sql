
-- Add discount_type and min_revenue to supplier_discount_rules
ALTER TABLE public.supplier_discount_rules
  ADD COLUMN discount_type text NOT NULL DEFAULT 'placements',
  ADD COLUMN min_revenue numeric DEFAULT NULL;

-- Create supplier_location_exceptions table
CREATE TABLE public.supplier_location_exceptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_type text NOT NULL,
  location_name text NOT NULL,
  exception_type text NOT NULL DEFAULT 'max_discount',
  max_discount_percent numeric DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_exception_type CHECK (exception_type IN ('max_discount', 'excluded'))
);

ALTER TABLE public.supplier_location_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view location exceptions"
  ON public.supplier_location_exceptions FOR SELECT
  USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Admins can insert location exceptions"
  ON public.supplier_location_exceptions FOR INSERT
  WITH CHECK (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Admins can update location exceptions"
  ON public.supplier_location_exceptions FOR UPDATE
  USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Admins can delete location exceptions"
  ON public.supplier_location_exceptions FOR DELETE
  USING (public.is_teamleder_or_above(auth.uid()));

-- Seed Ocean Outdoor discount rules (annual_revenue type)
INSERT INTO public.supplier_discount_rules (location_type, min_placements, discount_percent, description, is_active, discount_type, min_revenue) VALUES
  ('Ocean Outdoor', 0, 15, '0-199.999 kr årsomsætning', true, 'annual_revenue', 0),
  ('Ocean Outdoor', 0, 20, '200.000-399.999 kr årsomsætning', true, 'annual_revenue', 200000),
  ('Ocean Outdoor', 0, 25, '400.000-499.999 kr årsomsætning', true, 'annual_revenue', 400000),
  ('Ocean Outdoor', 0, 30, '500.000-599.999 kr årsomsætning', true, 'annual_revenue', 500000),
  ('Ocean Outdoor', 0, 35, '600.000-799.999 kr årsomsætning', true, 'annual_revenue', 600000),
  ('Ocean Outdoor', 0, 40, '800.000-999.999 kr årsomsætning', true, 'annual_revenue', 800000),
  ('Ocean Outdoor', 0, 50, '1.000.000+ kr årsomsætning', true, 'annual_revenue', 1000000);

-- Seed location exceptions for Ocean Outdoor
INSERT INTO public.supplier_location_exceptions (location_type, location_name, exception_type, max_discount_percent) VALUES
  ('Ocean Outdoor', 'Bruuns Galleri', 'max_discount', 25),
  ('Ocean Outdoor', 'Fields', 'max_discount', 25),
  ('Ocean Outdoor', 'Fisketorvet', 'max_discount', 25);
