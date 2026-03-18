

## Erstat "X salg" med point i QualificationBoard

### Problem
`QualificationBoard.tsx` viser `{standing.deals_count} salg` — brugeren vil i stedet se optjente turneringspoint.

### Løsning
Under kvalifikation er der endnu ingen point (ingen runder er spillet), så vi viser **"0 pt"** for alle spillere. Dette er korrekt, da point først optjenes når sæsonen starter.

### Ændringer

**`src/components/league/QualificationBoard.tsx`** (linje 232 + 235):
- Erstat `{standing.deals_count} salg` med `0 pt` på begge steder (mobil + desktop).

Alternativt kunne vi helt fjerne kolonnen, da den ikke giver information under kvalifikation. Men "0 pt" kommunikerer tydeligt at point-systemet eksisterer.

