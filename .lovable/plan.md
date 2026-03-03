

## Plan: Redesign email-rapport — inline med subtotal og premium design

### Ændringer i `supabase/functions/send-supplier-report/index.ts`

**Fjern vedhæftningslogik** — rapporten bygges direkte i email-body'en igen (ingen attachment).

**Redesign `buildReportHtml()`** med premium email-design:
- Professionelt header-banner med gradient baggrund, firmanavn og periode
- Brugerens besked i et tydeligt afsnit over tabellen
- Tabel med alternerende rækkefarver, afrundede hjørner-effekt, og pæne badges for ugedage
- **Subtotal-footer** i bunden af tabellen med summeret beløb (og finalAmount hvis rabat)
- Total-dage summeret
- Footer med firmanavn og genereringsdato
- Farvepalette: Mørkeblå header (#1e293b), hvid baggrund, blød grå på ulige rækker (#f8fafc), accent-farve til totaler

**Fjern attachment-kode** — ingen `attachments` array i Graph API-kaldet, ingen base64-encoding.

**Email body** bliver hele rapporten inklusive brugerens besked øverst.

### Filer der ændres
- `supabase/functions/send-supplier-report/index.ts`

