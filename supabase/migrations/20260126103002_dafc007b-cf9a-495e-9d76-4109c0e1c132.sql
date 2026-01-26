-- Tilføj total_price kolonne til booking tabellen
-- Bruges til markeder/messer hvor man angiver samlet pris i stedet for dagspris
ALTER TABLE public.booking ADD COLUMN total_price numeric DEFAULT NULL;

COMMENT ON COLUMN public.booking.total_price IS 'Samlet pris for hele bookingen (bruges til markeder/messer). Hvis sat, ignoreres daily_rate beregning.';