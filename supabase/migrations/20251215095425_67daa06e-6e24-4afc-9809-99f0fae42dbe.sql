-- Add tasks column to closing_shifts
ALTER TABLE public.closing_shifts ADD COLUMN tasks TEXT;

-- Update weekday 1 with the default tasks
UPDATE public.closing_shifts 
SET tasks = 'Lukke alle vinduer (inkl. mødelokaler)
Fylde opvaskeren og starte den
Ryd kopper af alle borde
Lukke begge døre'
WHERE weekday = 1;