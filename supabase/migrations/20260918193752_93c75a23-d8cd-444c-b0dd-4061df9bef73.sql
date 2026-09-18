UPDATE public.weekly_lead_report_lines SET sort_order = -sort_order;

UPDATE public.weekly_lead_report_lines SET sort_order = v.ord
FROM (VALUES
  ('DCU', 1),
  ('FDM', 2),
  ('FDM 1+', 3),
  ('Finansforbundet', 4),
  ('Hjerteforeningen', 5),
  ('Kanvas', 6),
  ('Kræftens Bekæmpelse', 7),
  ('Lederne', 8),
  ('Lederne konvertering', 9)
) AS v(line, ord)
WHERE public.weekly_lead_report_lines.report_line = v.line;