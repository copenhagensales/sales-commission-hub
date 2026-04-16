

# Fix: Booking/afmeldings-notifikationer sender ikke email

## Problem
`public-book-candidate` og `unsubscribe-candidate` bruger **Resend API** til at sende notifikationsmails, mens alle andre email-funktioner i systemet bruger **M365 Graph API**. Resend-kaldene fejler sandsynligvis fordi domænet `copenhagensales.dk` ikke er verificeret i Resend, eller API-nøglen ikke har korrekt scope. M365 fungerer derimod fejlfrit i resten af systemet.

## Løsning
Erstat Resend-kaldene i begge edge-funktioner med M365 Graph API — samme mønster som bruges i `send-recruitment-email`, `check-compliance-reviews`, `notify-referral-received` osv.

## Tekniske ændringer

### 1. `supabase/functions/public-book-candidate/index.ts`
- Fjern Resend-blokken (linje 142-192)
- Tilføj M365 token-hentning (genbruger `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`, `M365_SENDER_EMAIL`)
- Send booking-notifikation via `https://graph.microsoft.com/v1.0/users/{sender}/sendMail`

### 2. `supabase/functions/unsubscribe-candidate/index.ts`
- Fjern Resend-blokken (linje 106-137)
- Tilføj M365 token-hentning og send afmeldings-notifikation via Graph API

Begge funktioner beholder den eksisterende HTML-skabelon og modtagerliste fra `booking_notification_recipients`.

## Filer der ændres
- `supabase/functions/public-book-candidate/index.ts`
- `supabase/functions/unsubscribe-candidate/index.ts`

