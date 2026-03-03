

## Plan: Fix manglende ID i email + vedhæft PDF

### Problem 1: ID er tomt i email
`reportData` der sendes til `SendToSupplierDialog` mangler `externalId`. Feltet inkluderes i email-templaten, men værdien sendes aldrig med fra frontend.

**Fix i `src/components/billing/SupplierReportTab.tsx`:**
- Linje ~928-939: Tilføj `externalId: loc.location?.external_id || ""` til reportData-mappingen i SendToSupplierDialog
- Linje ~497-510: Tilføj samme felt i approveMutation's reportData

### Problem 2: Vedhæft rapport som PDF
I stedet for at bygge HTML-tabellen inline i emailen, genererer vi PDF'en server-side og vedhæfter den.

**Tilgang:** Generer HTML-rapporten (samme layout som PDF-generatoren) i Edge Function'en og konverter til PDF via en headless browser-service. Da vi ikke har adgang til en headless browser i Edge Functions, bruger vi en alternativ tilgang:

**Realistisk tilgang:** Vedhæft rapporten som en velformateret HTML-fil (.html) — eller brug Microsoft Graph API's file attachment med base64-encoded HTML. Email-body'en forbliver en kort besked, og den detaljerede rapport vedhæftes.

**Ændringer:**

1. **`src/components/billing/SupplierReportTab.tsx`** — Tilføj `externalId` til begge reportData-mappings

2. **`supabase/functions/send-supplier-report/index.ts`** — Restructurer til:
   - Email body: Kort besked (den brugerindtastede message)
   - Attachment: Den fulde HTML-rapport som `.html` vedhæftning via Microsoft Graph API's attachment-funktionalitet (base64-encoded)
   - Graph API understøtter `attachments` array i message-objektet med `contentBytes` (base64)

### Teknisk detalje: Graph API attachment
```json
{
  "message": {
    "subject": "...",
    "body": { "contentType": "HTML", "content": "<kort besked>" },
    "toRecipients": [...],
    "attachments": [{
      "@odata.type": "#microsoft.graph.fileAttachment",
      "name": "Rapport-Coop-februar-2026.html",
      "contentType": "text/html",
      "contentBytes": "<base64-encoded HTML>"
    }]
  }
}
```

### Filer der ændres
- `src/components/billing/SupplierReportTab.tsx` — tilføj externalId til reportData
- `supabase/functions/send-supplier-report/index.ts` — tilføj externalId fix + vedhæft rapport som HTML-fil

