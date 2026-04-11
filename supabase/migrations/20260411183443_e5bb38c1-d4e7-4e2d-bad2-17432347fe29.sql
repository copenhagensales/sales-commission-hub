
CREATE TABLE public.booking_flow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day INTEGER NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT DEFAULT '',
  content TEXT NOT NULL,
  offset_hours NUMERIC DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  phase TEXT NOT NULL DEFAULT 'active' CHECK (phase IN ('active', 'reengagement')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.booking_flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teamledere can view flow steps"
ON public.booking_flow_steps FOR SELECT
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Teamledere can insert flow steps"
ON public.booking_flow_steps FOR INSERT
TO authenticated
WITH CHECK (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Teamledere can update flow steps"
ON public.booking_flow_steps FOR UPDATE
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

CREATE POLICY "Teamledere can delete flow steps"
ON public.booking_flow_steps FOR DELETE
TO authenticated
USING (public.is_teamleder_or_above(auth.uid()));

CREATE TRIGGER update_booking_flow_steps_updated_at
BEFORE UPDATE ON public.booking_flow_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with existing 9 steps
INSERT INTO public.booking_flow_steps (day, channel, template_key, subject, content, offset_hours, sort_order, is_active, phase) VALUES
(0, 'email', 'flow_a_dag0_email', 'Book en tid til en snak om din ansøgning', E'Hej {{fornavn}},\n\nTak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.\n\nVi vil gerne invitere dig til en uforpligtende snak på 5–10 minutter over telefonen med Oscar, som er ansvarlig for rekruttering.\n\nBook selv den tid der passer dig bedst her:\n{{booking_link}}\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales', 10, 1, true, 'active'),
(0, 'sms', 'flow_a_dag0_sms', '', E'Hej {{fornavn}}! Tak for din ansøgning til {{rolle}}. Vi vil gerne tage en uforpligtende snak på 5–10 min over telefonen. Book selv en tid med Oscar her: {{booking_link}} – Afmeld: {{afmeld_link}}', 10, 2, true, 'active'),
(1, 'sms', 'flow_a_dag1_sms', '', E'Hej {{fornavn}} 👋 Har du set vores besked? Vi vil stadig gerne snakke med dig om {{rolle}}. Book en tid her: {{booking_link}} – Afmeld: {{afmeld_link}}', 10, 3, true, 'active'),
(3, 'email', 'flow_a_dag3_email', 'Lidt mere om stillingen som {{rolle}}', E'Hej {{fornavn}},\n\nVi ville lige følge op på din ansøgning til {{rolle}} hos Copenhagen Sales.\n\nHos os får du:\n• Grundig oplæring og sparring fra dag ét\n• Et ungt, ambitiøst team\n• Mulighed for at udvikle dig hurtigt\n\nBook en kort snak med Oscar her – det tager kun 5–10 min:\n{{booking_link}}\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales', 10, 4, true, 'active'),
(6, 'sms', 'flow_a_dag6_sms', '', E'Hej {{fornavn}}, vi har stadig en plads åben til {{rolle}} 🙌 Book en tid inden fredag: {{booking_link}} – Afmeld: {{afmeld_link}}', 10, 5, true, 'active'),
(6, 'email', 'flow_a_dag6_email', 'Pladsen er stadig åben – book inden fredag', E'Hej {{fornavn}},\n\nVi har stadig en plads åben til stillingen som {{rolle}}, og vi vil rigtig gerne høre fra dig.\n\nBook en tid til en kort snak her – det tager kun 5–10 min:\n{{booking_link}}\n\nVi holder pladsen åben til fredag.\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales', 10, 6, true, 'active'),
(10, 'email', 'flow_a_dag10_email', 'Vi lukker din ansøgning – men døren er åben', E'Hej {{fornavn}},\n\nVi har forsøgt at nå dig angående din ansøgning til {{rolle}} hos Copenhagen Sales, men har desværre ikke hørt fra dig.\n\nVi lukker derfor din ansøgning for nu – men døren er altid åben, hvis du får lyst til at tage en snak på et senere tidspunkt.\n\nDu er velkommen til at booke en tid her:\n{{booking_link}}\n\nVi ønsker dig alt det bedste!\n\nMed venlig hilsen\nCopenhagen Sales', 10, 7, true, 'active'),
(45, 'sms', 'flow_a_dag45_sms', '', E'Hej {{fornavn}} 😊 Det er et stykke tid siden du søgte {{rolle}} hos Copenhagen Sales. Vi leder stadig – har du lyst til en uforpligtende snak? Book her: {{booking_link}} – Afmeld: {{afmeld_link}}', 10, 8, true, 'reengagement'),
(120, 'email', 'flow_a_dag120_email', 'Vi har en ny mulighed til dig', E'Hej {{fornavn}},\n\nDet er et stykke tid siden, men vi tænkte på dig – vi søger lige nu en {{rolle}} hos Copenhagen Sales, og din profil passer godt.\n\nHar du lyst til en helt uforpligtende snak? Det tager kun 5–10 min:\n{{booking_link}}\n\nIngen pres – vi vil bare gerne høre, om det kunne have interesse.\n\nIkke interesseret? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales', 10, 9, true, 'reengagement');
