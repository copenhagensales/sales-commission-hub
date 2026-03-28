

## Plan: Telefonnummer-fix + auto-normalisering efter turbo-backfill

### Hvad ændres

**1. `supabase/functions/integration-engine/adapters/adversus.ts` (linje 622)**
Tilføj contactData-fallback for fremtidige syncs:
```typescript
let phone = leadData.phone || leadData.contactPhone || leadData.mobile || null;
if (!phone && leadData.contactData) {
  const cd = leadData.contactData;
  phone = cd.Telefonnummer1 || cd['Kontakt nummer'] || cd.phone || cd.mobile || cd.Mobil || cd.Telefon || null;
}
```

**2. `supabase/functions/enrichment-healer/index.ts` (linje 131)**
Samme contactData-fallback for healeren.

**3. Healeren forbliver normal efter backfill**
Healeren kører allerede normalt som standard — `turboMode` og `maxBatch` er request-parametre, ikke persisterede indstillinger. Når vi kalder den med `{ turboMode: true, maxBatch: 200 }` kører den turbo **den ene gang**. Næste kald (fra cron eller manuelt) bruger default `turboMode: false, maxBatch: 20`.

Der er altså ingen kodeændring nødvendig for at "gå tilbage til normal" — det sker automatisk. Turbo er kun aktivt for det specifikke kald.

### Sekvens
1. Ret phone-extraction i begge filer (2 edits)
2. Deploy begge edge functions
3. Invokér healer én gang med `{ turboMode: true, maxBatch: 200, provider: "adversus" }`
4. Healeren kører turbo, henter telefonnumre, og er derefter automatisk tilbage på normal ved næste kald

### Teknisk detalje
- Linje 275-276 i healeren: `const turboMode = body.turboMode === true; const maxBatch = body.maxBatch || (turboMode ? 80 : 20);`
- Disse er per-request parametre. Ingen global state ændres.

