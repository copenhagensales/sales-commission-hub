

## Målrettet telefonnummer-backfill for Tryg-kampagner i Adversus

### Problem
Tryg-salg fra Adversus (source = "Lovablecph") mangler `customer_phone` fordi telefonnummeret ligger i `contactData.Telefonnummer1` og ikke i standard-felter. Healeren skal målrettet gå efter disse salg.

### Løsning

**1. Tilføj `clientId`-filter til enrichment-healer**

Udvid request-body med et nyt `clientId`-parameter. Når det er sat, filtrerer queryen på `client_id`:

```typescript
const clientIdFilter = typeof body.clientId === "string" ? body.clientId.trim() : "";

// I query-opbygningen:
if (clientIdFilter) {
  salesQuery = salesQuery.eq("client_id", clientIdFilter);
}
```

**2. Sikr at queryen finder salg med manglende telefon**

Queryen fanger allerede `enrichment_status = complete AND customer_phone IS NULL` (linje 305). Med `clientId` + `provider`-filter rammer vi præcis Tryg-kampagnernes Adversus-salg.

**3. Deploy og kør målrettet**

Invokér healeren med:
```json
{
  "turboMode": true,
  "maxBatch": 200,
  "provider": "adversus",
  "clientId": "516a3f67-ea6d-4ef0-929d-e3224cc16e22"
}
```

### Sekvens
1. Tilføj `clientId`-filter i `enrichment-healer/index.ts`
2. Deploy edge function
3. Invokér med Tryg client_id + adversus provider + turbo mode
4. Healeren henter kun Tryg/Adversus-salg uden telefonnummer og beriger dem via contactData-fallback

### Risiko
Minimal — tilføjer kun et ekstra filter-parameter. Eksisterende logik uændret.

