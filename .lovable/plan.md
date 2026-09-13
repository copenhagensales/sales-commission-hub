# Hilsenen på loginsiden skal være naturligt dansk

## Hvad der er galt
Overskriften sættes sammen af to dele: en hilsen efter klokken + fast tekst "til dig". Om aftenen/natten bliver resultatet "God nat til dig", og det er ikke dansk talesprog - "godnat" er noget man siger, når man går, ikke når man byder nogen velkommen. "God middag" og "God formiddag" bruges heller ikke naturligt på dansk.

## Ny formulering
Hilsenen skrives som en hel sætning i stedet for at klistre "til dig" på:

- Før kl. 5: "Du er tidligt op"
- Kl. 5-10: "Godmorgen"
- Kl. 10-12: "Godmorgen"
- Kl. 12-18: "Goddag"
- Kl. 18-22: "Godaften"
- Efter kl. 22: "Du er sent på den"

Overskriften bliver hilsenen alene (fx "Godaften"), uden "til dig". Underteksten "Log ind med din arbejdsmail for at fortsætte." beholdes.

## Teknisk
Kun `src/pages/Auth.tsx`: `greeting`-funktionen justeres, og "{greeting} til dig" bliver til "{greeting}". Ingen ændringer i login, rettigheder eller data.
