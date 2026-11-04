# Fibersalg på Relatels dashboard ved valgt dato

## Årsag
Når man vælger en anden dato/periode, skifter dashboardet til "live"-visning. Fibertallene hentes i dag kun for i dag, uge og lønperiode (`ClientDashboard.tsx` linje 231–241) og flettes kun ind i de faste lister. Live-visningen (linje 292–306, 440, 498–509 og 599–620) henter ingen fiberdata og viser ikke fiberkolonnen. Derfor mangler fiber, når datoen sættes tilbage.

## Ændring (kun `src/components/dashboard/ClientDashboard.tsx`)
- Hent fibertal for den valgte periode med de eksisterende hooks `useFiberBoardStats` og `useFiberSalesCount`, kun når live-visningen er aktiv og boardet har fiber slået til.
- Flet dem ind i live-sælgerlisten med samme `mergeFiber` som de faste lister. Relatel: lead tæller 1, og provisionen lægges til. TDC: samme regler som i dag.
- Vis fiberkolonnen i live-toplisten (både CPH-stil og almindelig stil) og "(+N fiber)" ved Salg-tallet.
- Samme komponent bruges af TDC Erhvervs board, så det får samme rettelse ved valgt dato. Fiberreglerne ændres ikke.

## Ikke ændret
Ingen data, provision, edge-funktioner, rettigheder eller andre filer. Visningen for i dag/uge/lønperiode er uændret.

## Kontrol
Build og preview af Relatel-boardet med "I går": Frederiks og Williams fiberlead vises i fiberkolonnen og i Salg-tallet.
