CREATE POLICY "Powerdag input users can insert events"
ON public.powerdag_events FOR INSERT TO authenticated
WITH CHECK (public.has_page_permission(auth.uid(), 'menu_powerdag_input', true));

CREATE POLICY "Powerdag input users can update events"
ON public.powerdag_events FOR UPDATE TO authenticated
USING (public.has_page_permission(auth.uid(), 'menu_powerdag_input', true))
WITH CHECK (public.has_page_permission(auth.uid(), 'menu_powerdag_input', true));

CREATE POLICY "Powerdag input users can delete events"
ON public.powerdag_events FOR DELETE TO authenticated
USING (public.has_page_permission(auth.uid(), 'menu_powerdag_input', true));

CREATE POLICY "Powerdag input users can insert rules"
ON public.powerdag_point_rules FOR INSERT TO authenticated
WITH CHECK (public.has_page_permission(auth.uid(), 'menu_powerdag_input', true));

CREATE POLICY "Powerdag input users can delete rules"
ON public.powerdag_point_rules FOR DELETE TO authenticated
USING (public.has_page_permission(auth.uid(), 'menu_powerdag_input', true));

CREATE POLICY "Powerdag input users can delete scores"
ON public.powerdag_scores FOR DELETE TO authenticated
USING (public.has_page_permission(auth.uid(), 'menu_powerdag_input', true));