

## Plan: Gør dato-kolonnen mere leverandørvenlig

**Problem:** "Dato Periode" viser bare "02/02 - 27/02", som ikke fortæller leverandøren hvilke uger eller ugedage der er booket.

**Løsning:** Erstat den uinformative dato-range med en kompakt uge-baseret visning med ugedags-tags.

### Design

For hver lokation samles de faktiske bookede datoer (baseret på `booked_days` arrayet) og grupperes per uge. Visningen bliver:

```text
Uge 6:  [Man] [Tir] [Ons] [Tor] [Fre]
Uge 7:  [Man] [Tir] [Ons] [Tor] [Fre]
Uge 8:  [Man] [Ons] [Fre]
```

Hver ugedag vises som en lille Badge/tag. Hvis en uge har alle 5 hverdage, vises i stedet en kompakt `[Man–Fre]` tag for at spare plads. Kolonneoverskriften ændres til "Uger & Dage".

### Tekniske ændringer

**Fil: `src/pages/vagt-flow/Billing.tsx`**

1. **Ny hjælpefunktion `getBookedWeekdays`:** Itererer over booking-perioden (ligesom `countBookedDays`), men returnerer en `Map<number, number[]>` (ugenummer → liste af ISO-ugedage 0-6) for alle bookinger på en lokation.

2. **Saml ugedage i `bookingsByLocation` reducer:** Tilføj et `weekdaysByWeek` felt der akkumulerer data fra alle bookinger på lokationen.

3. **Ny render-komponent i tabel-cellen:** Erstatter `formatDateRange(loc.minDate, loc.maxDate)` med en kompakt visning:
   - Uge-nummer som label
   - Ugedage som små Badge-tags (`Man`, `Tir`, `Ons`, `Tor`, `Fre`, `Lør`, `Søn`)
   - Fulde uger vises som `Man–Fre` for at holde det kompakt
   - Datoerne vises stadig som en lille muted tekst under tags, så der er reference til de faktiske datoer

4. **Kolonneoverskrift:** Ændres fra "Dato Periode" til "Uger & Dage"

Ugedags-forkortelserne: `["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"]` (index 0-6 matcher ISO).

### UI eksempel per lokation-række

```text
Uge 6  Man–Fre
Uge 7  Man–Fre  
Uge 8  Man  Ons  Fre
03/02 – 27/02
```

Badges bruger `variant="secondary"` i lille størrelse. Uge-labels er `text-xs font-medium`. Dato-range vises som `text-xs text-muted-foreground` nederst.

