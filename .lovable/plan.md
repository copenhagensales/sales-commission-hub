# Tryg - Ret salg: "Afvis" og "Godkendt"-knapper

## Hvad
På hver salgslinje tilføjes to knapper i handlingskolonnen, placeret til venstre for "Kopiér":

- **Afvis** — rød (destructive-token), X-ikon
- **Godkendt** — grøn (emerald-token i tråd med resten af systemet), flueben-ikon

Rækkefølge i kolonnen: Afvis · Godkendt · Kopiér · markeringsboks · Slet.

Knapperne er kun visuelle i denne runde — klik gør ingenting. Funktionen tilføjes efter din næste forklaring.

## Teknisk
- Kun `src/pages/reports/TrygEditSales.tsx` ændres (linje 418-449, handlingscellen).
- To nye `Button size="sm"` før "Kopiér"; ikoner `X` og `Check` fra lucide-react tilføjes til den eksisterende import.
- Farver via semantiske tokens/utility-klasser som andre steder i appen — ingen nye hardkodede hex-værdier.
- Kolonnebredden øges fra `w-40` til `w-[22rem]` og `whitespace-nowrap` bevares, så alle knapper står på én linje.
- Ingen ændringer i hooks, data, sletning, beregninger eller adgangskontrol.
