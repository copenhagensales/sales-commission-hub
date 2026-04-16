

# Plan: Fane til visning og redigering af bekræftelses- og afmeldingssider

## Formål
En ny fane "Sider" på booking-flow-siden, hvor man kan se og redigere de to sider kandidaten ser:
1. **Booking-bekræftelse** — efter en kandidat har booket en samtale
2. **Afmelding** — når en kandidat afmelder sig

## Nuværende situation
Begge siders tekster er hardcoded:
- Booking-bekræftelsen i `PublicCandidateBooking.tsx` (React)
- Afmeldingssiden i `unsubscribe-candidate/index.ts` (Edge Function HTML)

For at gøre dem redigerbare gemmer vi tekstindholdet i databasen.

## Tekniske ændringer

### 1. Database-migration: `booking_page_content` tabel
```sql
CREATE TABLE public.booking_page_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text UNIQUE NOT NULL,  -- 'booking_success' | 'unsubscribe_success'
  title text NOT NULL,
  body_lines text[] NOT NULL DEFAULT '{}',
  tip_text text,
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.booking_page_content ENABLE ROW LEVEL SECURITY;
-- Authenticated can read, owners/managers can update
```

Seed med nuværende hardcoded tekster som default-værdier.

### 2. Ny komponent: `src/components/recruitment/BookingPagesTab.tsx`
- Henter `booking_page_content` for begge sider
- Viser to sektioner med live preview (ligesom BookingPreviewTab)
- Klik "Rediger" åbner en dialog med felter for titel, body-linjer og tip-tekst
- Gem opdaterer databasen

### 3. Tilføj fanen i `BookingFlow.tsx`
- Ny `TabsTrigger` med `value="pages"` og ikon `Layout`
- Ny `TabsContent` der renderer `<BookingPagesTab />`

### 4. Opdater `PublicCandidateBooking.tsx`
- Hent `booking_page_content` med `page_key = 'booking_success'` via query
- Brug DB-tekster i stedet for hardcoded strings (med fallback til nuværende tekst)

### 5. Opdater `unsubscribe-candidate/index.ts`
- Hent `booking_page_content` med `page_key = 'unsubscribe_success'`
- Brug DB-tekster i HTML-rendering (med fallback)

## Filer der ændres
- **Ny migration** — opretter `booking_page_content` + seed data
- **Ny fil**: `src/components/recruitment/BookingPagesTab.tsx`
- **Ændret**: `src/pages/recruitment/BookingFlow.tsx` (tilføj fane)
- **Ændret**: `src/pages/recruitment/PublicCandidateBooking.tsx` (læs fra DB)
- **Ændret**: `supabase/functions/unsubscribe-candidate/index.ts` (læs fra DB)

