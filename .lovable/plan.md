

# Redesign forecast PDF til at matche sidens UI/UX + fix kundetarget

## Problem
1. **Kundetarget vises ikke** — koden er der, men det ser ud til at `clientTarget` ikke kommer med korrekt (muligvis stadig dato-mismatch eller at "all" er valgt)
2. **PDF'en ser generisk ud** — hvid baggrund, system-fonts, ingen visuel sammenhæng med sidens mørke tema

## Løsning

### Fil: `src/utils/forecastReportPdfGenerator.ts` — komplet redesign

**Visuelt tema (matcher sidens CSS-variabler):**
- Mørk baggrund: `#0f172a` (sidens `--background`)
- Kort-baggrund: `#162032` (sidens `--card`)
- Primær grøn: `#0BA360` (sidens `--primary`)
- Tekst: `#f8f8f8` (lys) og `#9ca3af` (muted)
- Destructive rød: `#ef4444`
- Border: `#1e3a5f`

**Struktur redesignet:**
- **Header**: Grøn accent-linje top, stort bold klientnavn + periode, genereret-dato subtilt
- **Executive Summary boks**: Gradient-border kort med stort forecast-tal, interval, og kundetarget med farvekodet badge (grøn/rød) — præcis som UI'en
- **KPI-grid**: 3 kolonner med mørke bokse, tal i hvid, labels i muted
- **Effekter**: Røde/grønne rækker med ikoner (▼/▲) som på siden
- **Opstartshold-tabel**: Stilet som sidens Card-komponent
- **Drivers sektion**: Positiv/negativ gruppering med farvede labels
- **Outlook**: Primær + sekundær boks (dashed border for M2)
- **Footer**: Subtil, grøn accent-linje

**Kundetarget fix:**
- Sikre at target-linjen vises prominent i summary-boksen med Target-ikon og diff-badge
- Debugge: tilføj fallback query der matcher på `date_trunc('month', period_start)` i stedet for eksakt dato-match, for at undgå fremtidige mismatch

### Fil: `src/pages/ForecastClientReport.tsx`
- Gør target-query mere robust: match på måned i stedet for eksakt dato (`.gte(periodStart).lt(nextMonthStart)`)

