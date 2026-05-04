## Samlet plan — Liga: data-fix, sæson-vælger og Hall of Fame

### 1. Backfill manglende rundedata for runde 6 (rød zone)

Runde 6 er markeret `completed` i DB, men har 0 standings (de andre runder har 69 hver). Edge funktionen `league-process-round` har enten fejlet midtvejs eller blev kaldt to gange.

**Fix:**
- Sæt midlertidigt sæson-status = `active` og runde 6 status = `active`
- Kald `league-process-round` med seasonId
- Verificér 69 nye `league_round_standings`-rækker er oprettet og at `league_season_standings` ser rigtige ud
- Sæt sæson- og runde-status tilbage til `completed`

Kører som SQL + edge function-kald. Verificér før jeg er færdig.

---

### 2. Sæson-vælger på `/commission-league` (gul zone)

I dag returnerer `useActiveSeason` kun ÉN sæson. Tilføj dropdown øverst i sæson-kortet.

**Fil:** `src/pages/CommissionLeague.tsx` (+ minor wiring)

- Brug eksisterende `useAllSeasons()`
- Ny state `selectedSeasonId` (default = aktiv sæson, ellers seneste completed)
- Erstat `season` med beregnet `displaySeason = allSeasons.find(s => s.id === selectedSeasonId) ?? activeSeason`
- Dropdown i headeren af "Sæson X"-kortet: `Sæson 1 (afsluttet)`, `Sæson 2 (i gang)` osv. — sorteret nyeste først
- Eksisterende historik-hooks (`useCurrentRound`, `useSeasonStandings`, `useRoundHistory`, `useMySeasonStanding`, `usePrizeLeaders`) peger nu på `displaySeason.id`
- Når en historisk sæson vises: skjul tilmeldings-/qualification-CTA'er — det er kun arkiv

---

### 3. Hall of Fame — Afsluttet sæson-visning (gul zone)

I dag ser en afsluttet sæson nærmest identisk ud med en aktiv: samme Top 3-kort, samme tre special-priser, samme banner. Det føles ikke som en afslutning. Oplæg:

**Designkoncept: "Sæson X — Hall of Fame"**

Når `season.status === "completed"` erstattes hele toppen af siden med en dedikeret hall-of-fame-visning. Ingen "afsluttes når sæsonen starter"-lås, ingen aktiv-runde-indikatorer.

#### Sektion A — Helte-podium (fuld bredde, øverst)

Stort podium-element, ikke tre side-om-side bokse. Inspireret af et faktisk pris-podium:

```text
                    ┌────────┐
                    │  🥇    │
                    │ Avatar │
        ┌────────┐  │ Navn   │  ┌────────┐
        │  🥈    │  │ X pt   │  │  🥉    │
        │ Avatar │  │ Team   │  │ Avatar │
        │ Navn   │  │        │  │ Navn   │
        │ X pt   │  │        │  │ X pt   │
        └────────┘  └────────┘  └────────┘
           2.          1.          3.
```

- Vinderen i midten, højere end nr. 2 og 3
- Avatar fra `useEmployeeAvatars` (allerede i projektet), faldback initialer
- Guld/sølv/bronze gradient-baggrund pr. plads
- Konfetti-animation eller subtil shimmer ved første visning (engang pr. session via sessionStorage-key per sæson)
- Klik = åbn detalje-dialog med fuld division 1 standings (genbrug eksisterende dialog fra `PrizeShowcase`)
- Trofæ-ikon med sæson-nummer: "S1 Mester"

#### Sektion B — Special-priser (3 hyldede kort)

Under podiet, tre større visnings-kort (ikke små chips som i dag):

| Kort | Indhold |
|---|---|
| 🔥 **Bedste Runde** | Navn, runde + provision, lille sparkline der peaker |
| ⭐ **Sæsonens Talent** | Navn, "rookie" badge, points |
| 🚀 **Sæsonens Comeback** | Navn, "+N pladser", før/efter division |

Hvert kort har medaljon-look (ikke flade chips). Klik åbner top-10-dialog som i dag.

#### Sektion C — Sæson-resumé (ny, kompakt strip)

En række key stats om hele sæsonen:
- Antal spillere
- Antal runder spillet
- Total provision tjent (sum)
- Antal op-/nedrykninger
- Vinder af hver division (lille liste, kollapsbar)

#### Sektion D — Eksisterende runde-historik bevares

`Sæson 1`-kortet med Kval/R1–R6-chips og resultater bevares uændret nedenunder. Det er stadig vejen til at se rundedetaljer — bare flyttet ned så Hall of Fame får førstepladsen.

---

### Tekniske detaljer

**Berørte filer:**
- `src/pages/CommissionLeague.tsx` — sæson-vælger, betinget rendering: `completed` → ny `<HallOfFame>`-komponent øverst
- **Ny:** `src/components/league/HallOfFame.tsx` — podium + special prizes + season summary
- **Ny:** `src/components/league/HallOfFamePodium.tsx` — det store 3-trins-podium
- **Ny hook (evt.):** `useSeasonSummary(seasonId)` — aggregerer sum-tal til strip'en (kan også laves inline med eksisterende standings)
- `src/components/league/PrizeShowcase.tsx` — bruges fortsat for aktiv sæson; ingen ændring

**Data:** Genbruger `useSeasonStandings`, `usePrizeLeaders`, `useRoundHistory`, `useEmployeeAvatars`. Ingen nye RPC'er nødvendige.

**Zone:** Alt UI = gul. Backfill (#1) = rød.

**Åben beslutning (afventer dit svar):**
Skal jeg også bygge **auto-start af næste sæson** når en sæson markeres completed (cron eller trigger), eller skal Sæson 2 oprettes manuelt via SeasonManagerCard som i dag?
