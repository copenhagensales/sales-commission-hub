
## Tilføj "Tæl som bisalg" knap med gensidig udelukkelse

### Oversigt
Tilføj en ny indstilling "Tæl som bisalg" til produkt-prissætningsdialogen, hvor brugeren ikke kan vælge både "Tæl som salg" og "Tæl som bisalg" samtidigt. Disse skal være gensidigt udelukkende.

---

### Implementeringsplan

#### 1. Database-migration
**Ny kolonne:** `counts_as_cross_sale` i `products` tabellen

```sql
ALTER TABLE products 
ADD COLUMN counts_as_cross_sale BOOLEAN NOT NULL DEFAULT false;

-- Tilføj også til product_price_history for historik
ALTER TABLE product_price_history 
ADD COLUMN counts_as_cross_sale BOOLEAN DEFAULT false;
```

#### 2. Opdater ProductPricingRulesDialog.tsx
**Fil:** `src/components/mg-test/ProductPricingRulesDialog.tsx`

Ændringer:
- Tilføj prop `countsAsCrossSale: boolean`
- Tilføj lokal state `localCountsAsCrossSale`
- Implementer gensidig udelukkelse logik:
  - Når "Tæl som salg" vælges → "Tæl som bisalg" deaktiveres automatisk
  - Når "Tæl som bisalg" vælges → "Tæl som salg" deaktiveres automatisk
- Opdater mutation `updateCountsAsSale` til også at håndtere `counts_as_cross_sale`
- Opdater visning og redigerings-UI med begge checkboxes

**UI i visningsmode:**
```
✅ Tæl som salg       eller      ✅ Tæl som bisalg
```

**UI i redigeringsmode:**
```
☐ Tæl som salg
☐ Tæl som bisalg
(kun én kan være valgt ad gangen)
```

#### 3. Opdater MgTest.tsx interfaces og queries
**Fil:** `src/pages/MgTest.tsx`

Ændringer:
- Tilføj `counts_as_cross_sale` til `AggregatedProductRow` interface
- Tilføj `counts_as_cross_sale` til `AggregatedProduct.product` interface
- Opdater SQL queries til at inkludere den nye kolonne
- Opdater `toggleCountsAsSale` mutation til at håndtere begge felter
- Evt. tilføj badge "B" for bisalg (ligesom "S" for salg)

#### 4. Opdater i18n
**Fil:** `src/i18n/locales/da.json`

Tilføj:
```json
"countAsCrossSale": "Tæl som bisalg"
```

---

### Teknisk: Gensidig udelukkelse logik

```typescript
const handleCountsAsSaleChange = (checked: boolean) => {
  setLocalCountsAsSale(checked);
  if (checked) {
    // Hvis salg vælges, fjern bisalg
    setLocalCountsAsCrossSale(false);
  }
};

const handleCountsAsCrossSaleChange = (checked: boolean) => {
  setLocalCountsAsCrossSale(checked);
  if (checked) {
    // Hvis bisalg vælges, fjern salg
    setLocalCountsAsSale(false);
  }
};
```

---

### Filer der ændres

1. **Database migration** - Ny kolonne `counts_as_cross_sale` i `products` og `product_price_history`
2. **`src/components/mg-test/ProductPricingRulesDialog.tsx`** - UI og logik for begge checkboxes
3. **`src/pages/MgTest.tsx`** - Interfaces, queries og mutations
4. **`src/i18n/locales/da.json`** - Oversættelse

---

### Forventet resultat

- Ny "Tæl som bisalg" checkbox vises ved siden af "Tæl som salg"
- Brugeren kan kun vælge én af de to (eller ingen)
- Valg gemmes i databasen og vises korrekt i UI
- Historik-tabellen opdateres med den nye kolonne
