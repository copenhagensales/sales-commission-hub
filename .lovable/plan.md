

## Plan: Tilføj uger & ugedags-badges til Leverandørrapport-fanen

### Ændringer i `src/components/billing/SupplierReportTab.tsx`

1. **Import `getISOWeek` fra `date-fns`** (allerede bruger `date-fns`).

2. **Tilføj `getBookedWeekdays` hjælpefunktion** — kopieret fra Billing.tsx. Returnerer `Map<number, Set<number>>` (ugenummer → ISO-ugedage).

3. **Udvid `bookingsByLocation` reduceren** til at akkumulere `weekdaysByWeek` for hver lokation (merge Sets per uge).

4. **Erstat `Periode`-kolonnen** (linje 487 header, linje 519 celle):
   - Kolonne-header: `"Periode"` → `"Uger & Dage"`
   - Celle: Erstatter `formatDateRange(loc.minDate, loc.maxDate)` med uge-baseret visning:
     - Sorterede ugenumre med `Uge X` label
     - Weekday badges (`Man`, `Tir`, `Ons`, `Tor`, `Fre`, `Lør`, `Søn`)
     - Fulde hverdagsuger (0-4) vises som én `Man–Fre` badge
     - Original dato-range som `text-xs text-muted-foreground` nedenunder

Samme visuelle design som allerede implementeret i Oversigten.

