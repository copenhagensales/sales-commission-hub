# Fix: Eesy FM afvigelser smider retur til Hjem

## Årsag

Siden tjekker adgangen, før login-oplysningerne er hentet. `useAuth()` returnerer `user = null` i det første øjeblik efter navigation (mens sessionen indlæses), og siden tolker det som "ingen adgang" og redirecter straks til `/home`. Menupunktet vises korrekt, fordi sidemenuen på det tidspunkt allerede har brugerens mail.

Evidens: `src/hooks/useAuth.tsx:8` starter med `useState<User | null>(null)` og eksponerer `loading` (linje 190); `src/config/eesyFmDeviationAccess.ts:18-21` bruger kun `user?.email` og ignorerer `loading`; `src/pages/vagt-flow/EesyFmDeviations.tsx:9` redirecter med det samme når adgangen er falsk.

## Løsning

- `useEesyFmDeviationAccess()` returnerer fremover tre tilstande i stedet for kun ja/nej: indlæser, adgang, ingen adgang.
- Siden viser en kort indlæsningstilstand mens sessionen hentes og redirecter først til `/home`, når det er bekræftet at brugeren ikke er på listen.
- Sidemenuens punkt skjules kun når adgangen er afklaret og negativ, så det ikke blinker.

## Teknisk

- `src/config/eesyFmDeviationAccess.ts`: hook returnerer `{ hasAccess, isLoading }` baseret på `loading` fra `useAuth()`. `hasEesyFmDeviationAccess(email)` er uændret.
- `src/pages/vagt-flow/EesyFmDeviations.tsx`: `if (isLoading) return` en simpel loader inde i `VagtFlowLayout`; redirect kun ved `!isLoading && !hasAccess`.
- `src/components/layout/AppSidebar.tsx`: opdater brugen af hooken til det nye returformat (kun feltnavn, ingen ændret logik).

Ingen ændringer i DB, RLS, pricing eller løn. Grøn zone.
