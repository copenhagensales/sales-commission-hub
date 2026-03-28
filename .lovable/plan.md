

## Fix: Produkt-kolonne viser "-" i DuplicatesTab

### Problem
Queryen henter `sale_items(title)`, men `sale_items`-tabellen har ingen `title`-kolonne. Produktnavnet ligger i `display_name` (eller `adversus_product_title` som fallback).

### Løsning i `src/components/cancellations/DuplicatesTab.tsx`

**1. Opdater Supabase-query (linje 111)**
```
sale_items(display_name, adversus_product_title)
```

**2. Opdater `SaleRow` interface (linje ~70)**
```typescript
sale_items?: { display_name: string | null; adversus_product_title: string | null }[];
```

**3. Opdater rendering (linje ~360)**
Vis `display_name ?? adversus_product_title ?? "-"` i stedet for `item.title`.

