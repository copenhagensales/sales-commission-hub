
# Tilfoej brugsstatistik til TV Links-fanen

## Problem
TV Links-fanen paa `/dashboards/settings` viser ikke visningstal eller "sidst brugt" som synlig tekst. Den har kun en indirekte stale-advarsel. Brugeren kan ikke se om et link er aktivt brugt.

## Loesning
Tilfoej en synlig statistiklinje under hvert TV-link med:
- Oeje-ikon + antal visninger (fx "41 visninger")
- Sidst brugt tidspunkt (fx "Sidst: 20. feb 12:09")
- Orange advarsel hvis ubrugt i 5+ dage (allerede implementeret)

## Tekniske detaljer

### Fil: `src/components/dashboard/TvLinksSettingsTab.tsx`

**Tilfoej import**: `Eye` fra `lucide-react` (linje 15)

**Tilfoej statistiklinje** efter badges-raekkerne (efter linje 880, foer `</div>` for flex-1):

```typescript
{/* Usage stats */}
<div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
  <span className="flex items-center gap-1">
    <Eye className="h-3 w-3" />
    {code.access_count || 0} visninger
  </span>
  {code.last_accessed_at && (
    <span>• Sidst: {format(new Date(code.last_accessed_at), "d. MMM HH:mm", { locale: da })}</span>
  )}
</div>
```

Ingen database- eller backend-aendringer er noedvendige -- dataen hentes allerede via `select("*")`.
