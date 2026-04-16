

# Plan: Tilføj sociale medier-links til booking-bekræftelsen

## Hvad skal bygges
En ny sektion med runde ikon-knapper (Instagram, LinkedIn, TikTok, hjemmeside) der vises nederst på booking-bekræftelsessiden. Linkene skal kunne redigeres af admin i "Sider"-fanen.

## Løsning

### 1. Database: Tilføj `social_links` kolonne
Tilføj en JSONB-kolonne til `booking_page_content` med struktur:
```json
{
  "instagram": "https://instagram.com/copenhagensales",
  "linkedin": "https://linkedin.com/company/copenhagensales",
  "tiktok": "https://tiktok.com/@copenhagensales",
  "website": "https://copenhagensales.dk"
}
```
Migration sætter default-værdier på `booking_success`-rækken.

### 2. Admin-editor (`BookingPagesTab.tsx`)
- Tilføj 4 input-felter i edit-dialogen (kun for `booking_success`): Instagram, LinkedIn, TikTok, Hjemmeside
- Gem og hent `social_links` sammen med de øvrige felter
- Vis ikon-tags i preview-kortet

### 3. Kandidatside (`PublicCandidateBooking.tsx`)
- Vis en række med runde sociale medie-ikoner under tip-teksten på success-siden
- Links åbner i nyt vindue
- Kun de links der er udfyldt vises

### 4. Visuelt design
Runde ikoner i Copenhagen Sales-grøn med hvid ikon, placeret vandret centreret under tip-teksten. Subtilt og professionelt.

## Filer der ændres
- Database-migration (ny kolonne)
- `src/components/recruitment/BookingPagesTab.tsx` — editor + preview
- `src/pages/recruitment/PublicCandidateBooking.tsx` — kandidatens success-side

