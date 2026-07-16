## Fix: Inkludér FM i omsætning pr. medarbejder

**Problem:** `get_monthly_revenue` RPC filtrerer FM fra (`source != 'fieldmarketing'`), men nævneren (headcount) inkluderer FM-medarbejdere. Resultat: skæv graf.

**Ændring:** Fjern FM-filteret i RPC'en, så tæller og nævner matcher.

```sql
CREATE OR REPLACE FUNCTION public.get_monthly_revenue(p_start timestamptz, p_end timestamptz)
RETURNS TABLE(month_start date, revenue numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT date_trunc('month', s.sale_datetime)::date AS month_start,
         COALESCE(SUM(si.mapped_revenue), 0)::numeric AS revenue
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  WHERE s.sale_datetime >= p_start
    AND s.sale_datetime < p_end
    AND COALESCE(s.validation_status, 'approved') != 'rejected'
  GROUP BY 1
  ORDER BY 1;
$$;
```

Ingen frontend-ændringer nødvendige — RPC-signaturen er uændret.

**Note:** Dette er samlet TM+FM omsætning pr. medarbejder. Hvis du hellere vil have to separate linjer (TM/FM), sig til — så laver jeg det i stedet.