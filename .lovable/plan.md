
## Fjern dobbelte separator-linjer mellem sektioner i "Valgfrie sektioner"

### Problem
I "Valgfrie sektioner"-kortet på både Standard- og Pilot-varianten vises der to vandrette linjer mellem hvert afsnit i stedet for én. Det skaber unødig visuel støj.

### Ændring (kun `src/pages/TdcOpsummering.tsx`)
Gennemgå "Valgfrie sektioner"-blokken og fjern de duplikerede `border-t` / `<Separator />`-elementer, så der kun er én adskillelseslinje mellem hver sektion (MV/Datadelingskort, Nummervalg, Tilskud, Omstilling).

Konkret approach:
- Bevar én konsistent separator-strategi (enten kun `<Separator />` eller kun `border-t` på sektions-wrapperen — ikke begge dele).
- Sikr at den første sektion ikke har en top-separator, og at hver efterfølgende sektion får præcis én.

### Ikke berørt
- Indhold, labels, radio/toggle-adfærd og state.
- 5g-fri-varianten (medmindre samme dobbelt-separator-problem også findes der — i så fald rettes den med samme mønster for konsistens).
- `TdcOpsummeringPublic.tsx`.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`
