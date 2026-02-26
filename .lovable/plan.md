

## Vis markeder i Bookinger-fanen

### Problem
Bookinger-fanen filtrerer aktivt markeder og messer fra (linje 91+111 i BookingsContent.tsx). Brugeren vil gerne se markeder begge steder for bedre overblik.

### Losning
Tilfoej en separat sektion i bunden af Bookinger-fanen der viser market-bookinger for den valgte uge. Markederne vises i et visuelt adskilt kort med et Tent-ikon, sa de er nemme at skelne fra almindelige bookinger.

### Aendringer i `BookingsContent.tsx`

1. **Ny query for market-bookinger** - Tilfoej en `useQuery` der henter bookinger med `location.type IN ('Markeder', 'Messer')` for den valgte uge (samme week/year filter som eksisterende).

2. **Ny sektion i UI** - Efter de eksisterende client-grupperede bookinger, tilfoej en "Markeder denne uge" sektion:
   - Vises kun hvis der er market-bookinger i den valgte uge
   - Bruger Tent-ikon og lilla/indigo farvetema for at adskille visuelt fra normale bookinger
   - Viser lokation, dato-range, kunde, bemandingsstatus og tildelte medarbejdere
   - Samme dagsgrid (Man-Son) som normale bookinger, sa det er konsistent
   - Klikbar for at aabne EditBookingDialog

3. **Ingen aendring i Markeder-fanen** - Markeder vises stadig i deres egen fane med den fulde maanedsvisning og kalender-widget.

### Teknisk detalje

```text
// Ny query (ca. linje 137, efter eksisterende bookings query)
const { data: marketBookings } = useQuery({
  queryKey: ["vagt-market-bookings-week", selectedWeek, selectedYear],
  queryFn: async () => {
    // Hent bookinger med location.type IN MARKET_TYPES for valgt uge
    // Samme employee-name enrichment som eksisterende query
  },
});

// Ny UI-sektion (efter linje 698, efter normale bookinger)
{marketBookings?.length > 0 && (
  <Card className="border-indigo-200 bg-indigo-50/30">
    <CardContent>
      <div className="flex items-center gap-2 mb-4">
        <Tent className="h-5 w-5 text-indigo-600" />
        <h3 className="font-semibold">Markeder denne uge</h3>
        <Badge>{marketBookings.length}</Badge>
      </div>
      {/* Samme dagsgrid-rendering som normale bookinger */}
    </CardContent>
  </Card>
)}
```

### Resultat
- Markeder vises i **begge** faner: Bookinger (ugeoverblik) og Markeder (maanedsoverblik)
- Visuelt adskilt med ikon og farve sa man hurtigt kan se forskel
- Klikbar for redigering via EditBookingDialog
- Ingen pavirkning af eksisterende funktionalitet

