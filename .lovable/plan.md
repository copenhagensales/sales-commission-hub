

# Fix: OPP-baseret aggregering — kun for TDC Erhverv

## Problem
`computeDiff` og godkendelseskøen behandler alle kunder ens. Men OPP-gruppering og produkt/omsætnings-sammenligning er **kun relevant for TDC Erhverv**. Andre kunder kan have helt andre Excel-formater og matchinglogikker. Derudover indsættes der stadig ét queue-item per salg, så et OPP med 3 salg giver 3 separate rækker i køen.

## Løsning

### 1. Migration: Tilføj `opp_group` og `client_id` til `cancellation_queue`
- `opp_group TEXT` — OPP-nummeret der binder items sammen (kun brugt for TDC)
- `client_id UUID` — hvilken kunde uploaden tilhører (så ApprovalQueueTab kan filtrere/tilpasse logik)

### 2. `UploadCancellationsTab.tsx` — Gem `opp_group` og `client_id`
- Ved insert i `cancellation_queue`: gem `opp_group = OPP-nummer` og `client_id = selectedClientId`
- Ingen ændring i selve matchinglogikken — alle salg under et OPP indsættes stadig, men nu med fælles `opp_group`

### 3. `ApprovalQueueTab.tsx` — Kundespecifik visning

**Gruppér per OPP (kun når `opp_group` er sat):**
- Gruppér queue-items med samme `opp_group`
- Aggregér alle `sale_items` under gruppen (sum af revenue, commission, liste af produkter)
- Kør `computeDiff` én gang per OPP-gruppe mod den fælles `uploaded_data`
- Vis ét samlet resultat per OPP med alle involverede sælgere

**Uden `opp_group` (andre kunder):**
- Behold nuværende per-salg visning
- `computeDiff` kører kun hvis der er en config — ellers vises ingen diff (som nu)

**TDC-specifik logik i `computeDiff`:**
- Nuværende revenue/commission/produkt-sammenligning forbliver kun aktiv når config er sat (= TDC)
- Andre kunder kan få deres egen config med andre kolonner når det bliver relevant

### UI i godkendelseskøen

```text
┌──────────┬────────────────┬──────────────┬──────────────┬──────────┐
│ OPP      │ Sælgere        │ System (sum) │ Upload       │ Handling │
├──────────┼────────────────┼──────────────┼──────────────┼──────────┤
│ OPP-     │ Sune, Ahmed    │ Oms: 12000   │ Oms: 12000   │          │
│ 1079497  │ (2 salg)       │ Prov: 6000   │ Prov: 6000   │ ✓  ✗    │
│          │                │ ✓ MATCH      │              │          │
├──────────┼────────────────┼──────────────┼──────────────┼──────────┤
│ OPP-     │ Lars           │ Oms: 500     │ Oms: 300     │          │
│ 1076507  │ (1 salg)       │ ↑ FORSKEL    │              │ ✓  ✗    │
└──────────┴────────────────┴──────────────┴──────────────┴──────────┘
```

Godkend/afvis handler opdaterer **alle salg** under OPP-gruppen samlet.

| Fil | Ændring |
|-----|---------|
| Migration | Tilføj `opp_group TEXT` og `client_id UUID` til `cancellation_queue` |
| `UploadCancellationsTab.tsx` | Gem `opp_group` (OPP-nummer) og `client_id` ved insert |
| `ApprovalQueueTab.tsx` | Gruppér per OPP-gruppe, aggregér sale_items, vis ét diff per OPP. Behold per-salg visning for kunder uden OPP |

