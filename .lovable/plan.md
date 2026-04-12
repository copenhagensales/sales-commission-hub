

## Tilføj leverandørtype-oversigt med DB/dag

### Hvad bygges
En opsummeringstabel øverst på siden der viser **DB/dag pr. leverandørtype** (Danske Shoppingcentre, Markeder, Coop butik, etc.). Sorteret efter DB/dag, så man hurtigt kan se hvilken type lokation der performer bedst.

### Ændringer i `src/pages/vagt-flow/LocationHistoryContent.tsx`

1. **Udvid booking-query**: Tilføj `type` til `location`-select: `location!inner(id, name, daily_rate, type)`

2. **Gem `locationType` i data**: Tilføj `locationType: string` til `AggregatedLocation` og gem `loc?.type || "Ukendt"` under aggregering

3. **Ny leverandørtype-aggregering** (`useMemo`): Gruppér `locationData` efter `locationType`, beregn pr. gruppe: antal lokationer, total dage, total DB, DB/dag, total salg, salg/dag

4. **Ny opsummeringskomponent**: En kompakt tabel/kort-sektion **over** KPI-kortene med kolonner: Type | Lokationer | Dage | Salg/dag | DB | DB/dag — sorteret efter DB/dag (højeste først), med farve-indikation (grøn/rød)

### Teknisk detalje
- `location.type` feltet indeholder værdier som: "Danske Shoppingcentre", "Markeder", "Coop butik", "Meny butik", "Anden lokation", "Ocean Outdoor", "Butik", "Messer"
- Ingen database-ændringer nødvendige — feltet eksisterer allerede

