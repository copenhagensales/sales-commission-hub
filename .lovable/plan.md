

# Kampagneopdeling i Produktopdeling

## Hvad skal aendres
Produktopdelingen i dagsrapporter skal udvides saa hvert produkt ogsaa viser hvilken kampagne det er solgt paa. Hvis samme produkt er solgt paa to forskellige kampagner, vises de som separate raekker.

## Aendringer i detaljer

### 1. Udvid ProductSaleDetail interface
Tilfoej `campaign_name` felt:
```typescript
interface ProductSaleDetail {
  product_name: string;
  campaign_name: string;  // NYT
  quantity: number;
  commission: number;
  revenue: number;
}
```

### 2. Udvid campaign mappings fetch
Den eksisterende fetch af `adversus_campaign_mappings` henter allerede `adversus_campaign_id` og `id`. Tilfoej `adversus_campaign_name` til select-clause, og opbyg et nyt Map fra `adversus_campaign_id` til `adversus_campaign_name`.

### 3. Aendr aggregeringsnoegle
I stedet for kun at bruge `product_name` som noegle i `dayProductMap`, bruges nu en kombineret noegle: `produktnavn|||kampagnenavn`. Kampagnenavnet resolves fra salgets `dialer_campaign_id` via det nye Map. For FM-salg saettes kampagnenavnet til "Fieldmarketing".

### 4. Opdater UI-tabellen
Tilfoej en "Kampagne"-kolonne i produktopdeling-tabellen mellem "Produkt" og "Antal". Opdater ogsaa `key` paa raekker til at bruge baade produkt og kampagne.

### 5. Fil der aendres
Kun `src/pages/reports/DailyReports.tsx`:
- Linje 77-82: Udvid interface med `campaign_name`
- Linje 590-596: Tilfoej `adversus_campaign_name` til campaign mappings fetch og byg navn-Map
- Linje 832-900: Aendr aggregeringsnoegle til produkt+kampagne
- Linje 942-957: Tilsvarende for employee-level aggregering
- Linje 1513-1541: Tilfoej Kampagne-kolonne i UI-tabellen
