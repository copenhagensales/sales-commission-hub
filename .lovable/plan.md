# Balder afvises i bulk-upload: navnet i systemet har et "-" som efternavn

## Årsag (verificeret)

I `employee_master_data` står Balder som:

- `first_name` = "Balder Møller Nørgaard"
- `last_name` = "-"
- `is_active` = true, `work_email` = bamn@copenhagensales.dk

Bulk-importen bygger navnet som `first_name + " " + last_name` og sammenligner det med Adversus-kolonnen "Sidst kontaktet af" (`supabase/functions/manual-sales/index.ts:267` og `:306`). Systemets navn bliver derfor "balder møller nørgaard -", mens filen indeholder "balder møller nørgaard". Ingen match → "Sælger findes ikke eller er inaktiv".

Det er altså ikke en manglende eller inaktiv medarbejder — kun bindestregen som efternavn der bryder matchet.

## Løsning

To dele:

1. **Robust navne-match i importen.** Normaliseringen udvides, så tegn der ikke er bogstaver/tal (bindestreg, punktum, komma) fjernes, og dobbelte mellemrum kollapses — både for systemnavnet og filnavnet. Så matcher "Balder Møller Nørgaard -" og "Balder Møller Nørgaard" hinanden. Samtidig indekseres hver medarbejder også under sit rene navn uden tomme/tegn-kun navnedele.
2. **Ryd op i data.** Balders `last_name` er reelt en pladsholder. Anbefaling: flyt "Nørgaard" til `last_name` og lad `first_name` være "Balder Møller" — eller som minimum fjern "-". Dette gøres manuelt under Alle medarbejdere, så vi ikke ændrer navnedata bag om jer. Fortæl til om jeg skal rette det i stedet.

Punkt 1 alene løser uploaden nu og fremover, også for andre medarbejdere med "-" eller tomme navnefelter.

## Teknisk

Fil: `supabase/functions/manual-sales/index.ts` (bulk_import-handleren, linje ~259-310)

- `norm()` ændres til at fjerne alt som ikke er bogstav/ciffer/mellemrum (unicode-sikkert, så æøå og accenter bevares), derefter kollapse mellemrum og trimme.
- Navnenøglen bygges af navnedele der indeholder mindst ét bogstav/ciffer, så en del som "-" bliver ignoreret i stedet for at ødelægge nøglen.
- Ingen skemaændringer. Ingen ændring af selve oprettelses- eller dublet-logikken.
- Fejlteksten "Sælger findes ikke eller er inaktiv" beholdes uændret.
- Edge-funktionen deployes efter ændringen; dry-run-preview vil derefter vise Balders rækker som klar i stedet for fejl.
