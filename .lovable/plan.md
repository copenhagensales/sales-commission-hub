

# Send email-notifikation ved ny kundehenvendelse

## Ændring

### `supabase/functions/customer-inquiry-webhook/index.ts`
Efter succesfuld insert i `customer_inquiries`, send en notifikations-email til `mg@copenhagensales.dk` og `km@copenhagensales.dk` via Microsoft Graph API (M365-credentials er allerede konfigureret).

**Tilføjelser:**
1. Efter insert: hent M365 OAuth token (samme mønster som andre edge functions i projektet)
2. Send én email med begge modtagere (`toRecipients` array) med detaljer om henvendelsen (navn, firma, email, telefon, besked)
3. Email sendes asynkront — hvis den fejler, logges fejlen men webhook returnerer stadig success (henvendelsen er gemt)
4. Simpel HTML-formatering med henvendelsens detaljer

**Ingen andre filer ændres.** Ingen database-ændringer.

| Fil | Handling |
|-----|---------|
| `supabase/functions/customer-inquiry-webhook/index.ts` | Tilføj email-notifikation efter insert |

