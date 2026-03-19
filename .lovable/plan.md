

# Tilføj symbolforklaring (legend) til Salgsligaen

## Hvad skal bygges
En udvidet symbolforklaring der placeres ved "Opdateret HH:mm"-badget i leaderboard-headeren. Den eksisterende `ZoneLegend` komponent dækker kun zone-farver og op/nedrykningspile, men mangler forklaring af:

- 🥇🥈🥉 **Podium badges** (top 3 i divisionen)
- 🔥 **Flamme** / ⚡ **Lyn** (Dagens Top 3 på tværs af divisioner)
- 🟢 **Grøn pulserende prik** (har solgt i dag)
- 📈📉 **Sparkline med trend-pil** (ugentlig formkurve — grøn stiger, rød falder, blå stabil)
- ↗↘ **Grøn/rød pil med tal** (placeringsændring siden i går)
- Farve-striber langs rækker (zone-indikator)

## Plan

### 1. Udvid `ZoneLegend` komponenten
Omdøb/udvid `src/components/league/ZoneLegend.tsx` til en fuld `LeagueLegend` der inkluderer alle symboler — ikke kun zoner. Brug en collapsible/expandable sektion så den ikke fylder for meget:
- Klik på et "?" ikon eller "Symbolforklaring" knap ved siden af "Opdateret"-badget
- Åbner en popover/sheet med alle symboler forklaret visuelt (med selve ikonerne)

### 2. Placering i `CommissionLeague.tsx`
Tilføj legend-triggeren ved siden af "Opdateret HH:mm"-badget (linje ~547), som vist i screenshottet. En `HelpCircle`-ikon eller lille "?"-knap der åbner en `Popover` med den fulde forklaring.

### 3. Indhold i legenden
Grupperet i sektioner:
- **Placering**: 🥇🥈🥉 = Top 3 i division, tal = øvrige pladser
- **Zoner**: Grøn/Orange/Rød/Gul farvestreg = oprykker/playoff/nedrykker/top 3
- **Aktivitet**: Grøn prik = solgt i dag, 🔥 = #1 i dag, ⚡ = #2-3 i dag
- **Trend**: Sparkline viser ugens provision, pil viser momentum
- **Bevægelse**: ↗+2 = rykket 2 pladser op, ↘-1 = rykket 1 ned

### Filer der ændres
1. **`src/components/league/ZoneLegend.tsx`** → Udvides til `LeagueLegend` med alle symboler i en `Popover`
2. **`src/pages/CommissionLeague.tsx`** → Tilføj legend-trigger ved "Opdateret"-badget (2 steder: kvalifikation ~547 og aktiv sæson)

