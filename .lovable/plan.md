

## Problem

Kladde-bookings (drafts) er implementeret i databasen og i **Book uge**-fanen, men:

1. **Bookinger-fanen** (hvor du er nu) viser **ingen visuel markering** af om en booking er draft eller confirmed.
2. **Bekræft uge**-knappen findes kun på Book uge-fanen — ikke på Bookinger-fanen.
3. Der er ingen filtrering i BookingsContent, så drafts og confirmed blandes sammen uden forskel.

## Plan

### 1. Tilføj draft-badge i BookingsContent
- Vis en gul "Kladde"-badge ved hver booking med `status = 'draft'` i booking-oversigten.
- Confirmed bookings får ingen ekstra markering (de er "normale").

### 2. Tilføj "Bekræft uge"-knap på Bookinger-fanen
- Tilføj samme batch-bekræftelses-knap som på Book uge, så lederen kan bekræfte drafts direkte fra Bookinger-fanen.

### 3. Tilføj statusfilter
- Tilføj en filter-mulighed (dropdown eller tabs) i Bookinger-fanen: "Alle", "Kladder", "Bekræftede" — så man hurtigt kan se kun kladder.

### 4. Visuel styling af draft-bookings
- Draft-booking cards/rækker får stiplet kant eller dæmpet baggrund for at skille dem visuelt fra bekræftede.

### Filer der ændres
- `src/pages/vagt-flow/BookingsContent.tsx` — alle ændringer sker her.

