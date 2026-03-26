

## Problem: `get_sales_report_detailed` mangler salg via adversus campaign mappings

### Årsag
RPC'en `get_sales_report_detailed` finder kun salg hvor `s.client_campaign_id` direkte peger på klientens campaigns:

```sql
AND s.client_campaign_id IN (
  SELECT cc.id FROM client_campaigns cc WHERE cc.client_id = p_client_id
)
```

Men `get_sales_report_raw` (som bruges i Rapporter-siden) bruger **tre** matchveje:
1. Produktets campaign → klient (`cc_prod.client_id`)
2. Salgets campaign → klient (`cc_sale.client_id`)  
3. Adversus mapping → campaign → klient (`adversus_campaign_mappings` → `cc_mapping.client_id`)

Salg der kun er koblet via adversus campaign mappings (vej 3) eller via produktets campaign (vej 1) tælles **ikke** med i forecast. Dette forklarer den lavere Salg MTD.

### Løsning: Opdater `get_sales_report_detailed` RPC

Tilføj de samme JOINs som `get_sales_report_raw` bruger, så alle tre matchveje dækkes:

```sql
LEFT JOIN client_campaigns cc_prod ON cc_prod.id = p.client_campaign_id
LEFT JOIN client_campaigns cc_sale ON cc_sale.id = s.client_campaign_id
LEFT JOIN adversus_campaign_mappings acm ON acm.adversus_campaign_id = s.dialer_campaign_id
LEFT JOIN client_campaigns cc_mapping ON cc_mapping.id = acm.client_campaign_id
WHERE COALESCE(cc_prod.client_id, cc_sale.client_id, cc_mapping.client_id) = p_client_id
```

### Berørte filer
- Ny database migration (opdater `get_sales_report_detailed` funktionen)

### Ingen kodeændringer
Hook'en (`useClientForecast.ts`) kalder allerede RPC'en korrekt — det er kun SQL-funktionen der skal opdateres.

