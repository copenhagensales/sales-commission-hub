

## GDPR-rettelser: Punkt 1 (PII-sanitering) + Punkt 2 (Datatransfer-dokumentation)

Ingen af disse ændringer påvirker eksisterende funktionalitet.

---

### Punkt 1: PII-sanitering i edge function logs

**Ny fil:** `supabase/functions/_shared/sanitize.ts`

- `maskPhone("+4512345678")` → `"+45****5678"`
- `maskEmail("john@test.dk")` → `"j***@test.dk"`
- `sanitizePayload(obj)` → maskerer kendte PII-nøgler (`email`, `phone`, `From`, `To`, `Body`, `first_name`, `last_name`)

**Berørte edge functions** (kun `console.log` ændres):

`twilio-webhook`, `receive-sms`, `zapier-webhook`, `send-meta-conversion`, `adversus-webhook`, `dialer-webhook`, `economic-webhook`, `send-password-reset`, `complete-password-reset`, `send-employee-invitation`, `delete-auth-user`

---

### Punkt 2: Datatransfer-dokumentationsside

**Ny fil:** `src/pages/compliance/DataTransferRegistry.tsx`

Statisk side med tabel — **alle services er EU-hostede**:

| Modtager | Datakategorier | Lokation | Retsgrundlag | DPA status |
|----------|---------------|----------|-------------|------------|
| Twilio | Telefonnumre, SMS-indhold | **EU** | DPA | Aktiv |
| Meta (Facebook) | Email, telefon, navn (hashet) | **EU** | DPA | Aktiv |
| Microsoft 365 | Email-adresser, navne | **EU** | DPA | Aktiv |
| e-conomic | Faktureringsdata | **EU (DK)** | DPA | Aktiv |
| Adversus | Agent-emails, kampagnedata | **EU** | DPA | Aktiv |

**Routing:** Tilføj `/compliance/data-transfers` i `pages.ts` og `config.tsx`, samt link fra `ComplianceOverview.tsx`.

---

### Risiko

Ingen. Punkt 1 ændrer kun log-output. Punkt 2 tilføjer en ny read-only side.

