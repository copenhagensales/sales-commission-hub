

# Forbedrede datovælgere i alle faner

## Hvad ændres
Erstat de native `<input type="date">` felter med Shadcn Calendar + Popover datovælgere i de to faner der har datofiltre:

1. **ManualCancellationsTab** - "Fra dato" og "Til dato"
2. **DuplicatesTab** - "Fra dato" og "Til dato"

(UploadCancellationsTab har ingen datofelter og skal ikke ændres.)

## Tekniske detaljer

### Begge filer: Samme moenster

- Skift `dateFrom`/`dateTo` state fra `string` til `Date | undefined`
- Importer `Calendar`, `Popover`, `PopoverTrigger`, `PopoverContent` fra Shadcn
- Importer `CalendarIcon` fra lucide-react og `cn` fra utils
- Erstat `<Input type="date">` med en Popover-knap der viser valgt dato formateret paa dansk (`dd/MM/yyyy`) og aabner en kalender
- Konverter `Date` til ISO-streng i query-filteret for Supabase
- Tilfoej `pointer-events-auto` paa Calendar for korrekt interaktion

### Resultat
Pæne, konsistente datovælgere med kalender-popup i stedet for browserens standard dato-input, som passer til det moerke tema.

