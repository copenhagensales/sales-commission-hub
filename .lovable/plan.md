
## Mobiloptimering af "Min vagtplan"

Forbedringer fokuseret pa at gore mobilvisningen renere, mere luftig og lettere at laese.

### Visuelle aendringer

**1. Header -- kompakt og centreret pa mobil**
- Titel og ugenummer stables vertikalt med navigation-knapper centreret nedenunder
- Mindre titel pa mobil (text-xl i stedet for text-2xl)

**2. Dage uden vagt -- skjules/minimeres**
- Dage uden vagt vises som en enkel linje (ikke et helt kort) for at spare plads
- Kun "MAN 23/2 -- Ingen vagt" pa en tynd, dempet raekke

**3. Dagskort med vagt -- renere layout**
- Fjern `ml-6` indrykning pa alle underlinjer -- brug i stedet en venstre border-accent til at gruppere visuelt
- Lokationsnavn som primaer overskrift (storre, bold)
- Adresse-link direkte under navn, mindre og diskret
- Tid, makker, klient/kampagne som kompakte linjer med ikoner
- Badges (bil, diaet, hotel) samles i en raekke med mindre padding

**4. "Naeste vagt"-kort**
- Gores mere kompakt med tighter padding pa mobil

**5. Tomme dage kollapses**
- Dage i fortiden uden vagter skjules helt i stedet for at vise dem faded

### Teknisk implementering

Alt aendres i en enkelt fil: `src/pages/vagt-flow/MyBookingSchedule.tsx`

- Erstatte individuelle `Card` for tomme dage med en simpel `div`-raekke
- Tilfoeje `p-3` i stedet for `p-4` pa mobil via responsive classes
- Bruge `border-l-2 border-primary pl-3` pa vagtdetaljer i stedet for `ml-6`
- Skjule tomme fortidsdage helt (`isPast && assignments.length === 0` = return null)
- Reducere spacing mellem elementer (`space-y-1` i stedet for `space-y-1.5`)
- Goere badges mindre med `text-[11px]` og `py-0 px-1.5`
- Hotel/comment callouts: reducere padding og font-sizes lidt
