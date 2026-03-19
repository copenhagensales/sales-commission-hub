

# Tilføj "Tilmeld mig"-knap til begivenheder

## Hvad bygges
En ny mulighed ved oprettelse/redigering af events: "Kræver tilmelding". Når aktiveret, vises en tydelig "Tilmeld"-knap på eventet i stedet for (eller ved siden af) thumbs up/down. Brugere kan tilmelde/afmelde sig, og antallet af tilmeldte vises.

## Database-ændring
Tilføj kolonne `requires_registration` (boolean, default false) til `company_events`-tabellen.

## UI-ændringer

### Ved oprettelse/redigering af event
- Ny Switch "Kræver tilmelding" i både oprettelses-dialogen (`Home.tsx`) og `EditEventDialog.tsx`

### I event-listen (Kommende begivenheder)
- Hvis `requires_registration = true`: Vis en "Tilmeld"-knap (grøn, med `UserPlus`-ikon) i stedet for ThumbsUp. ThumbsDown erstattes af en "Afmeld"-knap
- Hvis `requires_registration = false`: Behold nuværende ThumbsUp/ThumbsDown som i dag
- Genbruger den eksisterende `event_attendees`-tabel og `toggleAttendanceMutation` — ingen ny tabel nødvendig

### I EventDetailDialog
- Vis tilmeldingsknap i detaljevisningen også, når `requires_registration = true`

## Filer der ændres
1. **Database migration** — tilføj `requires_registration` kolonne
2. **`src/pages/Home.tsx`** — ny switch i oprettelses-dialog + betinget knap-visning i event-listen
3. **`src/components/home/EditEventDialog.tsx`** — ny switch i redigerings-dialog
4. **`src/components/home/EventDetailDialog.tsx`** — betinget tilmeldingsknap

