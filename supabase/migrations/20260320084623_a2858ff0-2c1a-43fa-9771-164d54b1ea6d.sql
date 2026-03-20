
CREATE TABLE public.customer_inquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  company text,
  email text,
  phone text,
  message text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view inquiries"
ON public.customer_inquiries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update inquiries"
ON public.customer_inquiries FOR UPDATE TO authenticated USING (true);
