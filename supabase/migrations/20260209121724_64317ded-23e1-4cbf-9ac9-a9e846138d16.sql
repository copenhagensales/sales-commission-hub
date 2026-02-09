CREATE POLICY "FM sellers can insert fieldmarketing sales"
ON public.sales
FOR INSERT
WITH CHECK (
  source = 'fieldmarketing'
  AND auth.uid() IS NOT NULL
);