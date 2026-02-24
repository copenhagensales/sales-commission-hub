

# Plan: Inline-redigering af Navn, Type og By på lokationssiden

## Hvad aendres

Paa `/vagt-flow/locations` skal kolonnerne **Navn**, **Type** og **By** vaere redigerbare direkte i tabellen -- ligesom Dagspris og Cooldown allerede er i dag.

## Implementering

### Fil: `src/pages/vagt-flow/Locations.tsx`

**1. Ny mutation til generel opdatering**

Tilfoej en `updateLocation` mutation (ligesom `updateCooldown`/`updateDailyRate`) der tager vilkaarlige felter:

```typescript
const updateLocation = useMutation({
  mutationFn: async ({ id, data }: { id: string; data: Record<string, any> }) => {
    const { error } = await supabase.from("location").update(data).eq("id", id);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["vagt-locations-list"] });
    toast({ title: "Lokation opdateret" });
  },
});
```

**2. Erstat statisk tekst med inline-redigerbare felter**

| Kolonne | Nuvaerende | Ny komponent |
|---------|-----------|-------------|
| Navn | `{loc.name}` | `<Input>` med `defaultValue`, opdatering paa `onBlur` |
| Type | `{loc.type}` | `<Select>` med samme valgmuligheder som "Ny lokation"-dialogen (Butik, Storcenter, Markeder, Messer, Danske Shoppingcentre, Ocean Outdoor) |
| By | `{loc.address_city}` | `<Input>` med `defaultValue`, opdatering paa `onBlur` |

Alle felter faar `onClick={(e) => e.stopPropagation()}` saa raekke-navigation ikke udloeses ved klik.

Felterne er kun redigerbare naar `canEditLocation` er `true` (eksisterende tilladelseslogik).

**3. Type-select udvides**

Fra screenshottet ses ogsaa "Danske Shoppingcentre" og "Ocean Outdoor" som typer. Disse tilfoejes til baade "Ny lokation"-dialogen og inline-select.

## Omfang

- 1 fil aendres (`Locations.tsx`)
- Ingen database-aendringer (kolonnerne eksisterer allerede)
- Folger eksisterende moenster fra Dagspris/Cooldown inline-redigering

