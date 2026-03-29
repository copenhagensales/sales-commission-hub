

## Plan: Filtrer allerede-behandlede salg fra + tilføj datovælger i Lokaliser salg

### Ændringer i `src/components/cancellations/LocateSaleDialog.tsx`

**1. Ekskluder salg der allerede er i annullerings-/kurvrettelseskøen**

- Tilføj en separat query der henter alle `sale_id`'er fra `cancellation_queue` for denne klient (hvor status ikke er `rejected`)
- I den klient-side filtrering (`filtered` useMemo), fjern salg hvis `id` findes i dette sæt
- Dette sikrer at kun "frie" salg vises — salg der allerede er koblet til en annullering eller kurvrettelse skjules

**2. Tilføj datovælger til filtrering**

- Tilføj en `dateFilter` state (`Date | undefined`)
- Placer en Popover-baseret datovælger (Shadcn Calendar) ved siden af søgefeltet og employee-toggle
- Når en dato er valgt, filtrer salg klient-side så kun salg fra den valgte dato vises
- Tilføj en "Ryd"-knap for at fjerne datofiltret

### Teknisk detalje

```text
// Ny query: hent sale_ids allerede i køen
const { data: usedSaleIds } = useQuery({
  queryKey: ["used-sale-ids", clientId],
  queryFn: async () => {
    const { data } = await supabase
      .from("cancellation_queue")
      .select("sale_id")
      .eq("client_id", clientId)
      .neq("status", "rejected");
    return new Set((data || []).map(d => d.sale_id));
  },
  enabled: open,
});

// Udvid filtered useMemo:
const filtered = useMemo(() => {
  let result = sales;
  // Ekskluder allerede brugte salg
  if (usedSaleIds?.size) {
    result = result.filter(s => !usedSaleIds.has(s.id));
  }
  // Datofilter
  if (dateFilter) {
    result = result.filter(s => 
      s.sale_datetime && format(new Date(s.sale_datetime), "yyyy-MM-dd") === format(dateFilter, "yyyy-MM-dd")
    );
  }
  // Søgefilter
  if (searchQuery.trim()) { /* eksisterende logik */ }
  return result;
}, [sales, searchQuery, usedSaleIds, dateFilter]);
```

UI-layout for filtre:
```text
[Søgefelt............] [📅 Dato] [Toggle: Kun sælger]
```

### Fil
- `src/components/cancellations/LocateSaleDialog.tsx`

