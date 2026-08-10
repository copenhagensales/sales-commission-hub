# Balder afvises i bulk-upload: navnet i systemet har et "-" som efternavn

## Årsag (verificeret)

I `employee_master_data` står Balder som:

- `first_name` = "Balder Møller Nørgaard"
- `last_name` = "-"
- `is_active` = true, `work_email` = bamn@copenhagensales.dk

Bulk-importen bygger navnet som `first_name + " " + last_name` og sammenligner det med Adversus-kolonnen "Sidst kontaktet af" (`supabase/functions/manual-sales/index.ts:267` og `:306`). Systemets navn bliver derfor "balder møller nørgaard -", mens filen indeholder "balder møller nørgaard". Ingen match → "Sælger findes ikke eller er inaktiv".

Det er altså ikke en manglende eller inaktiv medarbejder — kun bindestregen som efternavn der bryder matchet.

## Omfang: 13 medarbejdere, ikke kun Balder

Samme mønster findes på 13 rækker — fulde navn i `first_name` og "-" eller tomt i `last_name`. Heraf 3 aktive:

- Balder Møller Nørgaard ("-")
- Lucas Vico Petersen ("-")
- Emillio Pedersen (blank)

De øvrige 10 er inaktive (bl.a. Nicholas Kilde, Gabriell Liliefrost, Oscar Køhler, Max Ammitzbøll Andersen, Tobias Esmark Hansen). Flere er oprettet i samme minut (30/3-2026 kl. 07:34), hvilket peger på en oprettelses-/importfejl hvor hele navnet blev tastet i fornavn-feltet og "-" brugt som pladsholder for et påkrævet efternavn — ikke en bevidst konvention.

## Løsning

**Kun robust navne-match i bulk-importen.** Normaliseringen udvides, så tegn der ikke er bogstaver/tal (bindestreg, punktum, komma) fjernes, og dobbelte mellemrum kollapses — både for systemnavnet og filnavnet. Så matcher "Balder Møller Nørgaard -" og "Balder Møller Nørgaard" hinanden.

Ingen oprydning i navnedata i denne omgang. De 13 rækker lades urørt.

### Afgrænsning

`norm()` og `byName` er lokale variabler inde i `bulk_import`-handleren (`supabase/functions/manual-sales/index.ts:264-268` og `:306`) og bruges ingen andre steder i filen. Ændringen påvirker derfor udelukkende bulk-salgsregistreringen — ikke "Tast selv"-enkeltoprettelsen, ikke lønberegning, ikke rapporter eller øvrige navne-opslag i systemet.

## Teknisk

Fil: `supabase/functions/manual-sales/index.ts` (bulk_import-handleren, linje ~259-310)

- `norm()` ændres til at fjerne alt som ikke er bogstav/ciffer/mellemrum (unicode-sikkert, så æøå og accenter bevares), derefter kollapse mellemrum og trimme.
- Navnenøglen bygges af navnedele der indeholder mindst ét bogstav/ciffer, så en del som "-" bliver ignoreret i stedet for at ødelægge nøglen.
- Ingen skemaændringer. Ingen ændring af selve oprettelses- eller dublet-logikken.
- Fejlteksten "Sælger findes ikke eller er inaktiv" beholdes uændret.
- Edge-funktionen deployes efter ændringen; dry-run-preview vil derefter vise Balders rækker som klar i stedet for fejl.
