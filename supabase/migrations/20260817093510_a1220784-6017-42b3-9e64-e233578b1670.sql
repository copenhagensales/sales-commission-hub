CREATE TABLE public.it_area_edges (
  area_code text PRIMARY KEY,
  edge_top text,
  edge_right text,
  edge_bottom text,
  edge_left text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.it_area_edges TO authenticated;
GRANT ALL ON public.it_area_edges TO service_role;

ALTER TABLE public.it_area_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "IT staff can view area edges"
ON public.it_area_edges FOR SELECT TO authenticated
USING (public.has_it_access(auth.uid(), false));

CREATE POLICY "IT staff can insert area edges"
ON public.it_area_edges FOR INSERT TO authenticated
WITH CHECK (public.has_it_access(auth.uid(), true));

CREATE POLICY "IT staff can update area edges"
ON public.it_area_edges FOR UPDATE TO authenticated
USING (public.has_it_access(auth.uid(), true)) WITH CHECK (public.has_it_access(auth.uid(), true));

CREATE POLICY "IT staff can delete area edges"
ON public.it_area_edges FOR DELETE TO authenticated
USING (public.has_it_access(auth.uid(), true));

CREATE TRIGGER it_area_edges_set_updated_at
BEFORE UPDATE ON public.it_area_edges
FOR EACH ROW EXECUTE FUNCTION public.it_set_updated_at();