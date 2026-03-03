

## Plan: Fjern eller forbedre dato-range teksten under uge-badges

**Problem:** Datoteksten "02/02 – 20/02" under uge-badges er forvirrende — den er svær at koble til ugerne ovenover og tilføjer ikke reel værdi, da ugerne allerede viser hvornår der er booket.

**Løsning:** Fjern den lille dato-range tekst helt. Uge-badges giver allerede al den nødvendige information. Dato-rangen er redundant og skaber forvirring.

### Ændring i `src/components/billing/SupplierReportTab.tsx`

Fjern linje 567-569 — `<p>` tagget med `format(loc.minDate) – format(loc.maxDate)`. Det er den eneste ændring.

Samme ændring laves i `src/pages/vagt-flow/Billing.tsx` (Oversigten) for konsistens, da den også viser dato-range under badges.

