-- Allow owners to view adversus_events (since the existing policy only allows managers)
CREATE POLICY "Owners can view adversus_events" 
ON public.adversus_events 
FOR SELECT 
USING (is_owner(auth.uid()));