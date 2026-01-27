
## Rettelse: Supabase 1000-row Limit Problem

### Problemet
`usePagePermissions()` i `src/hooks/useUnifiedPermissions.ts` henter ALLE permissions fra `role_page_permissions` tabellen, som nu indeholder **1262 rækker**. Supabase har en default limit på 1000 rækker per query, hvilket betyder at alle `tab_*` permissions (alfabetisk efter række 1000) aldrig bliver hentet.

Dette påvirker **alle brugere** der skal tilgå tab-baserede sider som Booking, da deres tab-permissions ikke findes i de returnerede data.

### Berørte brugere
- William Bornak (fm_leder) - kan ikke se Booking-tabs
- Potentielt alle andre non-ejer roller med tab-permissions

### Løsning

**Tilføj `.range()` eller fjern limit i Supabase query:**

I `src/hooks/useUnifiedPermissions.ts`, linje 56-70, skal queryen opdateres til at hente ALLE rækker:

```typescript
// FØR (begrænset til 1000 rækker)
export function usePagePermissions() {
  return useQuery({
    queryKey: ['page-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_page_permissions')
        .select('*')
        .order('permission_key');
      
      if (error) throw error;
      return data as PagePermission[];
    },
    // ...
  });
}

// EFTER (henter alle rækker)
export function usePagePermissions() {
  return useQuery({
    queryKey: ['page-permissions'],
    queryFn: async () => {
      // Supabase has a 1000 row default limit
      // Use .range(0, 2000) to ensure all permissions are fetched
      const { data, error } = await supabase
        .from('role_page_permissions')
        .select('*')
        .order('permission_key')
        .range(0, 2000); // Explicitly request up to 2000 rows
      
      if (error) throw error;
      return data as PagePermission[];
    },
    // ...
  });
}
```

### Alternativ optimering (anbefalet for performance)
I stedet for at hente alle 1262 rækker, kan vi kun hente permissions for den aktuelle brugers rolle:

```typescript
export function usePagePermissions(roleKey: string | null) {
  return useQuery({
    queryKey: ['page-permissions', roleKey],
    queryFn: async () => {
      if (!roleKey) return [];
      
      const { data, error } = await supabase
        .from('role_page_permissions')
        .select('*')
        .eq('role_key', roleKey)
        .order('permission_key');
      
      if (error) throw error;
      return data as PagePermission[];
    },
    enabled: !!roleKey,
    // ...
  });
}
```

Dette vil:
1. Reducere data fra ~1262 til ~140 rækker per bruger
2. Fjerne behovet for at bekymre sig om 1000-row limit
3. Forbedre performance

### Implementeringsplan

1. **Opdater `usePagePermissions()`** til at bruge `.range(0, 2000)` som hurtig fix
2. **Opdater `useUnifiedPermissions()`** til at filtrere på rolle for bedre performance
3. **Test** at William Bornak nu kan se Booking-tabs
4. **Verificer** at andre brugere også har korrekt adgang

### Tekniske detaljer
- Fil: `src/hooks/useUnifiedPermissions.ts`
- Linjer: 56-70 (usePagePermissions)
- Påkrævet ændring: Tilføj `.range(0, 2000)` til Supabase query

### Risiko
Lav risiko - dette er en simpel query-justering der ikke ændrer logik, kun sikrer at alle data hentes.
