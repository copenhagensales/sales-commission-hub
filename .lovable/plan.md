
# Plan: Excel-eksport af Fieldmarketing-salg

## Hvad skal bygges

En eksportfunktion der henter alle fieldmarketing-salg fra 15. januar 2026 til nu og downloader dem som en Excel-fil med alle relevante oplysninger.

## Excel-fil indhold

| Kolonne | Kilde |
|---------|-------|
| Dato | `registered_at` |
| Sælger | `seller.first_name` + `seller.last_name` |
| Lokation | `location.name` |
| Klient | `client.name` |
| Produkt | `product_name` |
| Telefonnummer | `phone_number` |
| Kommentar | `comment` |
| Oprettet | `created_at` |

## Teknisk implementering

### 1. Opret ny eksport-utility

**Ny fil: `src/utils/excelExport.ts`**

```typescript
import * as XLSX from "xlsx";

export function downloadExcel(data: Record<string, unknown>[], filename: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  XLSX.writeFile(workbook, filename);
}
```

### 2. Opret eksport-komponent

**Ny fil: `src/components/fieldmarketing/FieldmarketingExcelExport.tsx`**

- Knap med "Eksporter til Excel" i Fieldmarketing Dashboard
- Henter data fra `fieldmarketing_sales` med dato-filter
- Formaterer og downloader Excel-fil

### 3. Data-hentning

```typescript
const { data } = await supabase
  .from("fieldmarketing_sales")
  .select(`
    id,
    registered_at,
    product_name,
    phone_number,
    comment,
    created_at,
    seller:employee_master_data!seller_id(first_name, last_name),
    location:location!location_id(name),
    client:clients!client_id(name)
  `)
  .gte("registered_at", "2026-01-15T00:00:00")
  .order("registered_at", { ascending: false });
```

### 4. Transformer til Excel-format

```typescript
const excelData = sales.map(sale => ({
  "Dato": format(new Date(sale.registered_at), "dd-MM-yyyy HH:mm"),
  "Sælger": `${sale.seller?.first_name} ${sale.seller?.last_name}`,
  "Lokation": sale.location?.name || "-",
  "Klient": sale.client?.name || "-",
  "Produkt": sale.product_name,
  "Telefonnummer": sale.phone_number,
  "Kommentar": sale.comment || "",
  "Oprettet": format(new Date(sale.created_at), "dd-MM-yyyy HH:mm"),
}));
```

---

## Filer der oprettes/ændres

| Fil | Handling |
|-----|----------|
| `src/utils/excelExport.ts` | Ny - generisk eksport-utility |
| `src/components/fieldmarketing/FieldmarketingExcelExport.tsx` | Ny - eksport-komponent |
| `src/pages/dashboards/FieldmarketingDashboardFull.tsx` | Tilføj eksport-knap i header |

## Forventet resultat

Brugeren kan klikke på "Eksporter til Excel" i Fieldmarketing Dashboard og få downloadet en .xlsx fil med alle salg fra 15/1 til nu, inklusiv sælgernavn, dato, lokation og alle andre felter.
