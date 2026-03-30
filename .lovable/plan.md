

## Vis medlemsnummer i straksbetaling-tabellen

### Ændringer i `src/pages/ImmediatePaymentASE.tsx`

**1. Udvid query til at hente medlemsnummer (linje 198-213)**
- Tilføj `normalized_data, raw_payload` til select-query på `sales`-tabellen

**2. Udvid `ImmediatePaymentSale` interface (linje 30-39)**
- Tilføj `member_number: string | null`

**3. Udlæs medlemsnummer ved mapping (linje 248-257)**
- Hent fra `normalized_data.member_number` med fallback til `raw_payload.data.Medlemsnummer`

**4. Erstat "Kunde"-kolonnen med "Medlemsnr." (linje 315 + 329-331)**
- Kolonne-header: "Medlemsnr." i stedet for "Kunde"
- Vis `sale.member_number || "-"` i stedet for `customer_company || customer_phone || "Ukendt"`

