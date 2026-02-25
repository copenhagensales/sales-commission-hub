

## Fix: Dobbelt FM-salg i Dagsrapporter

### Problem

Fieldmarketing-salg har et `agent_email`-felt sat (f.eks. `frfo@copenhagensales.dk`). Dagsrapporter henter salg via **to separate forespørgsler**:

1. **Almindelige salg** (linje ~569): Henter ALLE salg matchende `agent_email` -- inklusiv FM-salg. Disse vises som "Ukendt kampagne" fordi FM-salg ikke har et `dialer_campaign_id`.
2. **FM-salg** (linje ~668): Henter separat alle salg med `source = 'fieldmarketing'` og matcher via `fm_seller_id`. Disse vises som "Fieldmarketing".

Resultatet er at hvert FM-salg taelles og vises dobbelt -- en gang under "Ukendt kampagne" og en gang under "Fieldmarketing" -- med identiske tal.

### Loesning

Tilfoej et filter der udelukker FM-salg fra den foerste (almindelige) salgs-foresporgsel, saa de kun haandteres af den dedikerede FM-logik.

### Teknisk aendring

**Fil:** `src/pages/reports/DailyReports.tsx`

**Aendring 1** -- I den almindelige salgs-foresporgsel (ca. linje 569-581), tilfoej `.neq("source", "fieldmarketing")` til filteret:

```typescript
salesData = await fetchAllRows(
  "sales", selectClause,
  (q) => {
    let query = q
      .or(emailOrFilter)
      .neq("source", "fieldmarketing")  // <-- NY LINJE
      .gte("sale_datetime", `${startStr}T00:00:00`)
      .lte("sale_datetime", `${endStr}T23:59:59`);
    if (selectedClient !== "all") {
      query = query.eq("client_campaigns.client_id", selectedClient);
    }
    return query;
  }
);
```

Dette sikrer at FM-salg kun tælles af den dedikerede FM-logik (linje 826-830), som korrekt viser dem under "Fieldmarketing" med korrekte provisions- og omsætningstal.

Ingen andre filer eller logik behøver ændres.

