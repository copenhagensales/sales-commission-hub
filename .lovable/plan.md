

## Plan: Skjul rabatberegning når der ingen rabatregler er

### Problem
Rabatberegnings-sektionen vises altid — også for leverandører som Coop, der ikke har nogen rabatordning. Det giver ingen mening at vise "0% rabat" og "Ingen" når der slet ikke er opsat regler.

### Løsning
Wrap hele rabat-sektionen (Card med "Rabatberegning") i en betingelse der kun viser den, hvis der faktisk findes aktive discount rules for den valgte leverandørtype.

### Ændring i `src/components/billing/SupplierReportTab.tsx`

**Linje ~746-870 (Discount section Card):**
Tilføj `{discountRules && discountRules.length > 0 && ( ... )}` omkring hele Card-elementet.

Samme logik skal også fjerne rabat-kolonnerne fra tabellen og PDF-eksporten når der ingen regler er — men det sker allerede naturligt, da `discountType === "annual_revenue"` kun er true når der er regler med den type, og `appliedDiscount` er 0 uden regler.

Det eneste der skal ændres er: **skjul rabat-Card'et helt** når `!discountRules?.length`.

