-- Ret seneste Eesy TM upload til lønperiode 15/3-14/4 (deduction_date = 2026-04-14)
UPDATE public.cancellation_queue
SET deduction_date = '2026-04-14'
WHERE import_id = 'a88f4f14-870c-43e6-ad4e-33a57930a57d';

UPDATE public.cancellation_imports
SET default_deduction_date = '2026-04-14'
WHERE id = 'a88f4f14-870c-43e6-ad4e-33a57930a57d';