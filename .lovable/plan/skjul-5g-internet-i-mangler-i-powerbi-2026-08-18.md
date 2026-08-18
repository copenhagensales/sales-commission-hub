# Skjul 5G Internet i "Mangler i PowerBI"

## Mål
Listen "Mangler i PowerBI" skal ikke længere vise salg hvor Tastselv-produktet er 5G Internet. Alle andre visninger (Afvigelser — oversigt, Salg uden afvigelser, Claims/Reimport) er uændrede.

## Ændring
`src/hooks/useEesyFmDeviations.ts`, i "missing"-grenen (linje 317-337): spring salget over hvis `isFiveG(sale.productName)` er sandt — samme helper som allerede bruges i afvigelses-grenen (linje 341). Det ekskluderer 5G-salg fra rækkerne og fra tællingen på kortet.

Ingen ændringer i UI-komponenten, ingen databaseændringer.

## Zone
Gul zone: rapport-/afvigelsesvisning. Rører ikke pricing, løn eller `sale_items`.
