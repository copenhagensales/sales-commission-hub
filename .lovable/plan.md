

# Plan: Fjern tier-segmentering, tilføj manuel tilføjelse med godkendelse

## Opsummering
Fjern den automatiske A/B/C-segmentering. Når en kandidat tilføjes, oprettes den som `pending_approval`. Kandidaten aktiveres og flow startes kun efter manuel godkendelse (den eksisterende Godkend/Afvis-funktionalitet bevares).

## Tekniske ændringer

### `src/pages/recruitment/BookingFlow.tsx`
- **Fjern** `SegmentationModal`-import og `segModalOpen` state
- **Fjern** `tierConfig`, `filterTier` state, tier-filter dropdown, tier-stats kort (Tier A/B/C)
- **Fjern** tier-badges fra enrollment-listen og pending approvals
- **Fjern** `segmentation_signals`-badges (alder, erfaring, sprog, deltid) fra pending approvals
- **Ændr** "Tilføj kandidat"-dialogen: Når en kandidat vælges, insertes direkte i `booking_flow_enrollments` med `status: 'pending_approval'` (ingen SegmentationModal, ingen edge function-kald)
- **Behold** "Afventer godkendelse"-sektionen med Godkend/Afvis-knapper — dette er nu den eneste vej til at aktivere et flow
- **Behold** `approveMutation` (som allerede sætter `status: 'active'` og opretter touchpoints)
- **Opdater** subtitle fra "Automatiseret outreach med intelligent A/B/C-segmentering" til "Automatiseret outreach med manuel godkendelse"
- **Stats**: Vis kun "Aktive flows" og "Afventer godkendelse" kort (fjern 3 tier-kort, grid fra 5 til 2 kolonner)

### `src/components/recruitment/SegmentationModal.tsx`
- Ingen ændring — bruges bare ikke længere

## Filer der ændres
- `src/pages/recruitment/BookingFlow.tsx`

