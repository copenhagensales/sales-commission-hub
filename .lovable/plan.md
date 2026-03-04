

## Tilføj rabat pr. lokation i tabellen for alle rabattyper

### Problem
Rabatkolonnerne ("Rabat" og "Efter rabat") vises kun i tabellen når rabattypen er `annual_revenue`. For `placements`-baserede rabatter beregnes rabatten allerede korrekt pr. lokation (inkl. undtagelser), men den vises ikke i tabellen.

### Løsning
Vis "Rabat" og "Efter rabat" kolonnerne for **alle** rabattyper når der er aktive rabatregler — ikke kun for `annual_revenue`.

### Ændringer i `src/components/billing/SupplierReportTab.tsx`

1. **Table header** (~linje 645-650): Ændr betingelsen `{discountType === "annual_revenue" && (...)}` til `{hasActiveDiscountRules && (...)}` hvor `hasActiveDiscountRules = discountRules && discountRules.length > 0`.

2. **Table body** (~linje 706-719): Samme betingelsesændring for rabat-cellerne pr. lokationsrække.

3. **Table footer** (~linje 731-740): Samme betingelsesændring for subtotal-rabatkolonnerne.

4. **Footer colSpan** (~linje 725): Juster colSpan fra 8 til korrekt antal.

Dette er en ren UI-ændring — al rabatlogik pr. lokation er allerede implementeret i `locationDiscounts`.

