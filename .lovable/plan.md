

## Plan: Vis datoperiode under hver udgiftspost

### Problem
Det er utydeligt hvilken datoperiode (15.–14.) tallene dækker, inkl. hvilken måned.

### Løsning
Tilføj en lille tekst under hver udgiftspost-label der viser den aktuelle lønperiode, f.eks. *"15. feb – 14. mar"*. Formatteres med `date-fns` og dansk locale.

### Ændring

**`src/components/billing/ExpenseReportTab.tsx`**
- I tabelrækken under `cat.label`, tilføj en `<span>` med klassen `text-xs text-muted-foreground block` der viser:
  `"15. feb – 14. mar 2026"` (formateret fra `periodStart` og `periodEnd`)
- Brug `format(new Date(periodStart), "d. MMM", { locale: da })` og tilsvarende for `periodEnd` inkl. år
- Gælder alle rækker (både auto, recurring og manuelle)

### Filer

| Fil | Ændring |
|-----|---------|
| `src/components/billing/ExpenseReportTab.tsx` | Tilføj periodevisning under hver udgiftslabel |

