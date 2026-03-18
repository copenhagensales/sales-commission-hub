

# Plan: Forbedre Kemi-APV status på AMO Dashboard

## Problem
Kemi-APV kortet på dashboardet viser "grøn" selvom der er 3 produkter med forfaldne reviews. Logikken (linje 170-177) tjekker kun om farlige produkter mangler SDS — den ignorerer `next_review_due` feltet.

## Løsning
Udvid Kemi-APV status-beregningen til også at inkludere:
1. **Forfaldne reviews** — produkter hvor `next_review_due < today` → rød
2. **Snart forfaldne reviews** — produkter hvor review er inden for 30 dage → gul
3. **Manglende SDS på farlige produkter** → rød (eksisterende logik)

## Ændringer

**Fil: `src/pages/amo/AmoDashboard.tsx`** (linje 170-177)

Erstat den nuværende kemi-status logik med:
- Beregn `overdueReviews` = produkter med `next_review_due` før i dag
- Beregn `soonDueReviews` = produkter med review inden for 30 dage
- Status: rød hvis manglende SDS eller forfaldne reviews, gul hvis snart forfalden, ellers grøn
- Detail-tekst: vis antal problemer (f.eks. "3 forfaldne reviews, 0 mangler SDS")

Ingen andre filer eller database-ændringer nødvendige.

