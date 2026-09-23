# "Ret"-boksen: kun dato, og mulighed for at rette telefonnummer

## Hvad brugeren får

I boksen "Ret" på fanen United-salg:

1. **Kun dato** — feltet "Salgsdato og tid" bliver "Salgsdato" med en ren datovælger. Klokkeslættet vises ikke længere og kan ikke rettes. Hvis datoen ændres, beholder salget sit oprindelige klokkeslæt (fx et salg kl. 10:47 der flyttes til dagen før, ligger stadig kl. 10:47).
2. **Telefonnummer** — nyt felt hvor nummeret på salget kan rettes eller udfyldes, hvis det mangler. Nummeret er det samme der vises i kolonnen "Telefon" i tabellen.

Alt andet er uændret: sælger, produkt, genberegning af provision ved produktskift, og advarslen om at ændringer slår igennem i rapporter og løngrundlag.

## Vigtigt at være klar over

Telefonnummeret bruges også af annullerings- og dublet-matchning. Retter man nummeret, kan et salg matche anderledes fremover. Nummeret gemmes præcis som det skrives (kun mellemrum i start/slut fjernes) — ingen automatisk omskrivning af formatet.

## Teknisk

**`src/components/reports/UnitedEditSaleDialog.tsx`**
- `datetime`-state (`datetime-local`) erstattes af `date`-state med `type="date"` (`yyyy-MM-dd`).
- Ved gem: hvis datoen er ændret, bygges ny ISO-værdi ved at tage den valgte dato og bevare time/minut/sekund/ms fra `sale.saleDatetime` (lokal tid, som i dag) → sendes videre som `saleDatetime`.
- Nyt `phone`-state initialiseret fra `sale.customerPhone ?? ""`. Ændring (efter `trim()`) sendes som `customerPhone`; tomt felt sendes som `null`.
- `hasChanges` udvides med telefon-ændringen.

**`src/hooks/useUpdateUnitedSale.ts`**
- `UpdateUnitedSaleInput` får `customerPhone?: string | null`.
- Feltet skrives til `sales.customer_phone` i den eksisterende `sales`-opdatering (kun når det er med i input). Samme cache-invalidering som nu.

Ingen migrationer, ingen ændringer i prisregler, pricing-service, lønberegning, RLS eller de øvrige faner.
