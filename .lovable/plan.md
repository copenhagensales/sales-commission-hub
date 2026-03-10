

## Analyse

**Salget MG-202602-15927** (Noa, 17. feb, "Eesy uden første måned"):
- Har `client_campaign_id = NULL` — derfor usynligt på FM-dashboardet
- Booking for lokationen (7443d250) og datoen **eksisterer**, men bookingen har `campaign_id = NULL`
- Trigger-fallback via `fm_client_id` burde have fanget det, men triggeren blev oprettet 20. feb (migration `20260220`) — **3 dage efter salget blev registreret**
- Sale_items er korrekt oprettet (Eesy uden første måned, 360 kr / 1000 kr)

**Omfang af problemet:**
- 70 bookings uden `campaign_id` siden februar
- Men kun **1 FM-salg** uden `client_campaign_id` — resten er håndteret af fallback

## Plan

### 1. Fix salget MG-202602-15927
Opdater `client_campaign_id` til Eesy gaden-kampagnen (`c527b6a1-2aaa-42c9-a290-4933675c3800`), da produktet er et gade-produkt.

### 2. Fix bookingen uden campaign_id  
Opdater booking `b6fe5111` med den korrekte Eesy gade-kampagne, så fremtidige salg på samme lokation/dato-kombination også matches korrekt.

### 3. Forbedre enrich_fm_sale triggeren
Nuværende flow:
1. Find booking → brug `booking.campaign_id` → **fejler hvis NULL**
2. Fallback: brug `fm_client_id` → vælg første kampagne for klienten

**Problem:** Fallbacken vælger blindt den første kampagne (sorteret efter `created_at`), uden at skelne mellem gade/marked.

**Forbedring:**
- Tilføj logging når booking mangler `campaign_id` (advarsel i `integration_logs`)
- Tilføj en ekstra fallback: match produktnavnet mod kampagnenavnet (f.eks. "gade" i produktnavn → "gaden" kampagne) for at vælge mere præcist
- Bevar eksisterende fallback som sidste udvej

### Filer der ændres
- Database: 1 data-fix (UPDATE salg + booking), 1 migration (forbedret trigger)

