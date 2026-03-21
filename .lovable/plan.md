
# Plan: Gør mapping-siden brugbar med faktura-detaljer

## Hvad jeg kan se i data nu
Den nuværende side skjuler for meget information:
- Den reducerer posteringer til grove præfikser som `EESY`, `TRYG`, `Order`, `Salg til medlemmer`
- Men de faktiske posteringer indeholder allerede mere info som vi kan vise:
  - `tekst`
  - `faktura_nr`
  - `bilags_nr`
  - `dato`
  - `forfalds_dato`
  - `antal`
  - `beloeb_dkk`
  - `posterings_type`
  - `raw_json`

Konkrete eksempler i de nuværende posteringer:
- `EESY: TM Levering af salg`
- `EESY: Pop-up Coop`
- `EESY: Pop-up marked`
- `TRYG: FDM mødebooking`
- `TRYG: Finansforbundet mødebooking`

Så problemet er primært UI/visning og for grov gruppering.
For `Order` og `Salg til medlemmer` ser dataen ud til at være mere sparsom, så hvis du skal have endnu mere kontekst dér, kræver det sandsynligvis udvidet import.

## Løsning
Jeg vil ændre `/economic/revenue-match` fra “badge-baseret mapping” til en rigtig **mapping-inspektør**.

### 1. Erstat grove badges med en “umappede fakturaer/posteringer” liste
Vis en rigtig tabel eller kortliste for umappede poster med:
- Fuld tekst
- Måned
- Fakturanr.
- Bilagsnr.
- Antal
- Beløb
- Dato
- Foreslået kunde/prefix

Det gør at `EESY` ikke bare står som ét badge, men som flere adskilte linjer.

### 2. Tilføj detaljevisning pr. linje
Når man klikker på en umappet linje, åbnes en drawer/dialog med:
- Fuld fakturatekst
- Fakturanr. / bilagsnr.
- Dato / forfaldsdato
- Beløb og antal
- Posterings-type
- Rå felter fra importen hvis nødvendigt
- Andre posteringer med samme `faktura_nr` eller `bilags_nr`

Det giver dig den konkrete kontekst, du mangler for at mappe.

### 3. Gør mappings mere præcise
I stedet for kun at mappe brede præfikser skal siden støtte mere præcise mønstre:
- Hele teksten (`EESY: Pop-up Coop`)
- Prefix (`EESY:`)
- Eventuelt “contains” / “starts with”

Anbefaling:
- Brug fuld tekst til tvetydige kunder som EESY og TRYG
- Brug brede patterns kun hvor det giver mening

### 4. Tilføj måned-filter
Tilføj filter i toppen:
- År
- Måned (én eller flere)
- Kun umappede
- Søg i tekst

Så du kan isolere f.eks. kun februar og se hvilke fakturaer der mangler mapping.

### 5. Vis “preview af match”
Når du vælger et mønster, vis et preview:
- Hvor mange posteringer matcher
- Hvilke måneder
- Samlet faktureret beløb
- Eksempeltekster

Så man kan se konsekvensen før man gemmer.

## Hvis `Order` og `Salg til medlemmer` stadig er for uklare
Så tager vi fase 2:
- Udvider ZIP-importen til at læse flere e-conomic CSV-filer end kun `Konto.csv` og `Postering.csv`
- Gemmer ekstra faktura-header/linjeinfo
- Viser det i detaljevisningen på revenue-match siden

Det er vigtigt, fordi den nuværende import kun læser posteringer, og hvis kildedata dér kun siger `Order`, så findes der ikke mere kontekst i den nuværende tabel.

## Filer der skal ændres
- `src/pages/economic/EconomicRevenueMatch.tsx`
  - Ny mapping-inspektør
  - Måned-filter
  - Detailvisning
  - Match-preview
- `src/hooks/useEconomicData.ts`
  - Nye hooks/helpers til detaljerede revenue-posteringer og filtrering
- `supabase/functions/import-economic-zip/index.ts` (kun fase 2)
  - Udvid import af ekstra faktura-data hvis ZIP’en indeholder dem
- Eventuel migration (kun fase 2)
  - Ny tabel eller ekstra felter til importeret faktura-metadata

## Resultat
Efter ændringen kan du:
- Se præcis hvilken EESY/TRYG-faktura der er tale om
- Se forskel på fx `TM Levering af salg` og `Pop-up Coop`
- Filtrere på måned
- Mappe på et mere præcist grundlag
- Få bedre hjælp til generiske linjer som `Order` og `Salg til medlemmer`
