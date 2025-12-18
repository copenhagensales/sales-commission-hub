-- Create fieldmarketing_sales table for sales registrations
CREATE TABLE public.fieldmarketing_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.employee_master_data(id),
  location_id UUID NOT NULL REFERENCES public.location(id),
  client_id UUID NOT NULL REFERENCES public.clients(id),
  product_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  comment TEXT,
  registered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fieldmarketing_sales ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view all sales
CREATE POLICY "Authenticated users can view fieldmarketing sales"
ON public.fieldmarketing_sales
FOR SELECT
TO authenticated
USING (true);

-- Policy: Fieldmarketing employees can insert their own sales
CREATE POLICY "Fieldmarketing employees can insert sales"
ON public.fieldmarketing_sales
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Owners and teamleaders can update/delete
CREATE POLICY "Managers can update fieldmarketing sales"
ON public.fieldmarketing_sales
FOR UPDATE
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Managers can delete fieldmarketing sales"
ON public.fieldmarketing_sales
FOR DELETE
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

-- Create index for better query performance
CREATE INDEX idx_fieldmarketing_sales_client ON public.fieldmarketing_sales(client_id);
CREATE INDEX idx_fieldmarketing_sales_registered_at ON public.fieldmarketing_sales(registered_at);
CREATE INDEX idx_fieldmarketing_sales_seller ON public.fieldmarketing_sales(seller_id);