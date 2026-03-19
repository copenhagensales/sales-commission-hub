

# Forbedret UI for leaderboard-headeren

## Nuværende problemer
- Headeren er flad og kedelig — bare tekst og en lille badge
- "Kvalifikationsrunde" titlen blander sig med ZoneLegend-ikonet
- "Opdateret"-badgen ser ud som metadata, ikke som et vigtigt signal
- Tabs ("Alle Divisioner" / "Min Division") er visuelt adskilt fra headeren

## Forslag til forbedringer

### 1. Tilføj et ikon og bedre hierarki til titlen
- Tilføj et `Trophy`-ikon (allerede importeret) foran "Kvalifikationsrunde" i en accent-farve
- Gør titlen lidt større og med gradient-tekst eller accent-farve for at signalere vigtighed
- Flyt ZoneLegend til højre side af headeren (som en utility-knap)

### 2. Live-status som pulserende indikator
- Erstat den statiske "Live opdatering" tekst med en pulserende grøn prik + "Live" label (samme stil som spillerens live-prik)
- Gør "Opdateret HH:mm" til en subtil muted tekst i stedet for en Badge

### 3. Bedre header-layout
- Brug hele bredden med flex justify-between
- Venstre: Ikon + titel + live-prik + tilmeldte count
- Højre: "Opdateret HH:mm" tekst + ZoneLegend ikon

### 4. Tabs tættere på headeren
- Reducer spacing mellem header og tabs for bedre sammenhæng

## Teknisk ændring
**Fil:** `src/pages/CommissionLeague.tsx` (linje 538-563)

Omskriv `CardHeader`-blokken:
- Venstre side: `Trophy`-ikon (text-yellow-400) + "Kvalifikationsrunde" (større font) + pulserende grøn prik + "Live" + "• 67 tilmeldte"
- Højre side: "Opdateret 15:45" (muted, ingen badge) + `ZoneLegend`
- Reducer `mb-4` på TabsList til `mb-3`

