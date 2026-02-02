
# Fix: Tilføj ASE til API kilde dropdown

## Problem
API kilde dropdown'en på /sales siden viser ikke "ASE" som valgmulighed, selvom der er 652 ASE-salg i databasen.

## Årsag
Den nuværende kode henter alle `source` værdier fra `sales` tabellen:

```typescript
const { data } = await supabase
  .from("sales")
  .select("source")
  .not("source", "is", null);
```

Men Supabase returnerer kun de første 1000 rækker som standard. Med 34,232+ salg i tabellen, og ASE-salg spredt ud, kan de misse i de første 1000 rækker der returneres.

## Løsning
Opdater query'en til at bruge `DISTINCT` direkte via Supabase, eller brug en mere pålidelig metode til at hente unikke kilder.

### Ændring i `src/components/sales/SalesFeed.tsx`

**Nuværende kode (linje 181-199):**
```typescript
const { data: availableSources = [] } = useQuery({
  queryKey: ["sales-sources"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("sales")
      .select("source")
      .not("source", "is", null);
    
    if (error) throw error;
    
    const uniqueSources = [...new Set(data?.map(s => s.source))]
      .filter(Boolean) as string[];
    
    return uniqueSources.sort();
  },
  staleTime: 1000 * 60 * 5,
});
```

**Ny kode:**
```typescript
const { data: availableSources = [] } = useQuery({
  queryKey: ["sales-sources"],
  queryFn: async () => {
    // Use RPC to get distinct sources efficiently
    const { data, error } = await supabase.rpc('get_distinct_sales_sources');
    
    if (error) {
      // Fallback: hardcoded list of known sources
      console.error("Failed to fetch sources:", error);
      return ["ase", "Eesy", "Lovablecph", "Relatel_CPHSALES", "tryg"];
    }
    
    return (data || []).map((d: { source: string }) => d.source).sort();
  },
  staleTime: 1000 * 60 * 5,
});
```

### Ny database funktion (RPC)
Opret en SQL funktion der returnerer distinkte kilder effektivt:

```sql
CREATE OR REPLACE FUNCTION get_distinct_sales_sources()
RETURNS TABLE(source text) 
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT s.source 
  FROM sales s 
  WHERE s.source IS NOT NULL 
  ORDER BY s.source;
$$;
```

## Alternative løsninger (simplere)

### Option A: Hardcode kendte kilder
Hvis source-listen er relativt stabil, kan den hardcodes:

```typescript
const KNOWN_SOURCES = ["ase", "Eesy", "Lovablecph", "Relatel_CPHSALES", "tryg", "Unknown Dialer"];
```

### Option B: Brug eksisterende tabel
Hvis der er en `dialer_integrations` tabel med alle kilder, kan den bruges i stedet.

## Påvirkede filer
- `src/components/sales/SalesFeed.tsx` - opdater query logik
- Database migration - ny RPC funktion (valgfrit)

## Forventet resultat
- ASE vil vises i API kilde dropdown
- Alle kilder vil altid vises uanset antal salg i tabellen

## Tekniske detaljer
| Kilde i DB | Vist som |
|------------|----------|
| `ase` | ASE |
| `Eesy` | Eesy |
| `Lovablecph` | CPH Sales |
| `Relatel_CPHSALES` | Relatel |
| `tryg` | Tryg |
| `Unknown Dialer` | Ukendt |
