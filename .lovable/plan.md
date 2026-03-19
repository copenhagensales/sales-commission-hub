

# Plan: Gør LeagueMotivationBar dynamisk

## Problem
Mathias ser kun 2 statiske beskeder fordi:
1. `dailyTarget` og `todayTotal` er hardcoded til `0` i CommissionLeague.tsx — så signaler der afhænger af dem (streak, dagsmål, personlig rekord) aldrig trigger
2. De signaler der kan trigge (hourly rate + ny streak/uge-momentum) har ingen variation — samme besked hver dag
3. Overhalings-gaps er for snævre (< 2.000 kr / < 1.500 kr)

## Løsning

### 1. Pass rigtige data fra CommissionLeague.tsx
- Importér `usePersonalSalesStats` og hent `todayTotal` og `dailyTarget` (fra goal tracker eller employee data)
- Alternativt: Lad `LeagueMotivationBar` selv hente sin `todayTotal` fra `weeklyStats.dailyBreakdown` (dagens entry) — dette kræver ingen ændring i parent

### 2. LeagueMotivationBar intern fix: Beregn todayTotal fra dailyBreakdown
- Find dagens entry i `dailyBreakdown` og brug `commission` som `todayTotal` (i stedet for at stole på prop'en)
- Fjern afhængighed af hardcoded `0`-props

### 3. Lempede betingelser
- Signal #2 (overhalning): `gap < 5.000 kr` i stedet for `< 2.000 kr`
- Signal #6 (nogen bag dig): `gap < 3.000 kr` i stedet for `< 1.500 kr`
- Signal #9 (personlig rekord): `> 60%` i stedet for `> 80%`

### 4. Besked-variation via dato-seed
- Brug `new Date().getDate()` som seed til at rotere varianter af signal #7 (ekstra indsats) og #10 (ny streak)
- Signal #7 varianter: "Hver time ≈ X kr", "2 gode timer = +Y kr", "Lørdag = +Z kr" (rotér dagligt)
- Signal #10 varianter: "Start en ny streak", "Dit første salg tæller", "En god dag starter med ét salg"

### 5. Tidspunkt- og ugedag-signaler (nye)
- Morgen (< 11): "God morgen! Første salg sætter tempoet"
- Eftermiddag (> 14): "Stærk finish — de sidste timer tæller mest"
- Fredag: "Stærk fredag = stærk uge"
- Disse får prioritet 7-8 og fungerer som fallbacks der sikrer variation

### 6. Bredt rang-signal (nyt)
- "Du er #X i ligaen" — altid tilgængeligt som lavprioritets-fallback
- Sikrer at der altid er mindst 3 beskeder

## Filer der ændres
- **`src/components/league/LeagueMotivationBar.tsx`** — al logik: beregn todayTotal internt, lempede thresholds, rotation, nye signaler
- **`src/pages/CommissionLeague.tsx`** — minor: kan beholde props som de er (todayTotal beregnes nu internt)

## Forventet resultat
Brugere ser 3 varierede, dagligt skiftende beskeder der afspejler deres faktiske situation.

