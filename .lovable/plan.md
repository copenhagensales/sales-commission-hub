## Hvorfor er Runde 6 ikke startet?

**Root cause:** Bug i `supabase/functions/league-process-round/index.ts:381`.

Efter R5 sluttede (27. apr) skulle R6 (27. apr → 4. maj) oprettes. Men sæsonens `end_date` er **3. maj**, og koden tjekker:

```ts
if (!season.end_date || nextEnd <= new Date(season.end_date))
```

Da `nextEnd` (4. maj) > `season.end_date` (3. maj) blev R6 aldrig indsat — selvom sæson-config har **6 round_multipliers** (`[1, 1.2, 1.4, 1.6, 1.8, 2]`), dvs. R6 er den planlagte finalerunde.

Det er en off-by-one: tjekket bør være om runden *starter* før sæsonen slutter, ikke om den *ender* før.

## Plan

### 1. Fix round-creation bug (rød zone — pricing/scoring-tilstødende)

**Fil:** `supabase/functions/league-process-round/index.ts` (linje 374-399)

Skift logikken til at oprette runden hvis den planlagte runde ≤ antal `round_multipliers` i config. Det matcher forretningsreglen ("der spilles N runder, hvor N = antal multipliers"). Faldback til date-tjek hvis config mangler.

### 2. Manuel oprettelse af R6 nu

Indsæt R6 direkte i `league_rounds` med:
- `round_number: 6`
- `start_date: 2026-04-27`
- `end_date: 2026-05-04` (eller 2026-05-03 = sæson-slut, valg nedenfor)
- `status: 'active'`

### 3. "Sidste runde"-effekt på `/commission-league`

Når `currentRound.round_number === total_rounds` (= 6), vises:

**A. Pulserende rød/guld badge i header** (erstatter den grønne "RUNDE X"-prik):
- "🏆 FINALE · SIDSTE RUNDE" med animeret glow
- Erstat emerald-grøn med amber/rød gradient + `animate-pulse`

**B. Hero-banner under header:**
- Fuld bredde, mørk gradient (amber-900 → red-900) med subtile guld-partikler
- Tekst: "FINALE-RUNDE · Sidste chance for at sikre titlen"
- Countdown-timer til runde-slut (genbrug eksisterende `QualificationCountdown`-mønster)
- Lille tekst: "Point i denne runde tæller ×2"

**C. Subtle flame-ikon** ved siden af "Bedste runde"-kortet i `PrizeShowcase` med tooltip "Finalemultiplier ×2 aktiv".

Komponenten bliver ny: `src/components/league/FinalRoundBanner.tsx`. Vises kun når `isLastRound === true` og `currentRound.status === 'active'`.

### Tekniske detaljer

- `total_rounds` udledes som `season.config.round_multipliers.length` (6).
- `isLastRound = currentRound?.round_number === totalRounds`.
- Multiplier-værdi vises fra `roundMultipliers[5] = 2`.
- Countdown bruger `currentRound.end_date`.

## Spørgsmål inden implementering

1. **R6 slutdato:** 4. maj (normal 7-dages runde, går 1 dag over sæson-end) eller 3. maj (præcis sæson-end, 6-dages runde)?
2. **Skal jeg også sende en `LeagueAnnouncementPopup` "FINALE STARTET" til alle spillere første gang R6 indlæses?** (Der findes allerede et announcement-system.)