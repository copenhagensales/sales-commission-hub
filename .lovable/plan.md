

# Indbakke til kundehenvendelser på Hjem-siden

## Hvad bygges
En ny "Kundehenvendelser"-sektion på Home-siden, kun synlig for `mg@copenhagensales.dk` og `km@copenhagensales.dk`. Sektionen viser indkomne kontaktformularer fra hjemmesiden og lyser rødt når der er ulæste henvendelser.

## Database
Ny tabel `customer_inquiries` med kolonner:
- `id` (uuid, PK)
- `name`, `company`, `email`, `phone`, `message` (text)
- `is_read` (boolean, default false)
- `created_at` (timestamptz)

RLS: Kun authenticated brugere kan SELECT/UPDATE (adgangskontrol sker via email-check i frontend + webhook bruger service role key).

## Webhook
Ny edge function `customer-inquiry-webhook` der modtager formulardata (navn, firma, email, telefon, besked) og inserter i `customer_inquiries`. Offentligt tilgængeligt endpoint til hjemmesiden.

## UI på Home-siden
- Ny komponent `CustomerInquiryInbox` renderet øverst på Home-siden
- Kun vist hvis `user.email` er `mg@copenhagensales.dk` eller `km@copenhagensales.dk`
- Card med rød pulserende border/glow når der er ulæste henvendelser (`is_read = false`)
- Liste af henvendelser med navn, firma, email, telefon, besked, tidspunkt
- Klik på en henvendelse markerer den som læst
- Badge med antal ulæste

## Filer
1. **Database migration** — opret `customer_inquiries` tabel + RLS
2. **`supabase/functions/customer-inquiry-webhook/index.ts`** — modtag formular fra hjemmeside
3. **`src/components/home/CustomerInquiryInbox.tsx`** — inbox-komponent med rød glow
4. **`src/pages/Home.tsx`** — import og vis inbox for de to emails

