# Fjern mærkatet "12 = SPÆNDET" i mailen

## Svar på spørgsmålet
Tallet er ikke spændet, men den nedre grænse (p25) for det typiske antal salg pr. uge for sælgerens anciennitet. Det er mærkatet på den stiplede linje i salgsgrafen. Formuleringen er upræcis, og den fjernes.

## Ændring
- Fjern tekstmærkatet ved den stiplede linje i salgsgrafen i begge mailvarianter (sælger og leder).
- Behold selve den stiplede linje, så man stadig visuelt kan se niveauet.
- Behold fodnoten under grafen, som forklarer det typiske spænd og medianen med ord.

## Teknisk
- Kun `supabase/functions/_shared/ramp-session-mail.ts`: `bandLabel` erstattes af en tom celle, så grafens kolonnebredder er uændrede. `bandLine` og fodnoten `footer` røres ikke.
- Deploy `send-ramp-session-feedback` (bruger den delte skabelon).
- Send to isolerede testmails til `km@copenhagensales.dk` (sælger + leder) via mailkøen, så resultatet kan ses i inbox.
- Ingen ændringer i ramp-data, provision, adgang eller RLS.
