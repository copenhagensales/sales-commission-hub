

## Bemærkning og mødetid på bookinger

### Oversigt
To nye features til booking-systemet:
1. **Bemærkning til booking** - En fritekst-besked (fx "I skal stå ved elevatoren") som sælgerne kan se på deres vagtplan
2. **Manuel mødetid** - Mulighed for at rette start- og sluttid per dag direkte i booking-dialogen

### Eksisterende infrastruktur (ingen skemaændringer nødvendige)
- `booking`-tabellen har allerede en `comment`-kolonne (text, nullable)
- `booking_assignment`-tabellen har allerede `start_time`, `end_time` og `note`-kolonner
- Tiderne er pt. hardkodet til 09:00-17:00 ved oprettelse

### Ændringer

**1. EditBookingDialog.tsx - Booking-fanen: Tilføj bemærkningsfelt**
- Tilføj state `comment` initialiseret fra `booking.comment`
- Tilføj et `<Textarea>` felt med label "Bemærkning til sælger" under dagspris-sektionen
- Placeholder: "Fx 'Stå ved elevatoren' eller 'Parkering bag bygningen'"
- Inkluder `comment` i `handleSaveBooking` / `updateBookingMutation`

**2. EditBookingDialog.tsx - Medarbejder-fanen: Tilføj mødetid**
- Tilføj state for `meetingStartTime` og `meetingEndTime` (default 09:00 / 17:00)
- Vis to `TimeSelect` felter ("Mødetid" og "Sluttid") i "Tilføj medarbejdere"-sektionen
- Tiderne bruges ved oprettelse af assignments i stedet for de hardkodede 09:00-17:00
- Vis nuværende tider på eksisterende assignments

**3. EditBookingDialog.tsx - Eksisterende assignments: Vis/ret tider**
- I sektionen "Tilknyttede medarbejdere" tilføj mulighed for at se og redigere start/sluttid per medarbejder
- Tilføj en inline redigeringsmulighed eller en lille edit-knap

**4. MarketsContent.tsx og BookingsContent.tsx - Brug dynamiske tider**
- Opdater `bulkAssignMutation` i begge filer til at acceptere og videresende `start_time`/`end_time` fra EditBookingDialog i stedet for hardkodede værdier

**5. MyBookingSchedule.tsx - Vis bemærkning**
- Tilføj `comment` til booking-queryen (allerede henter `booking:booking_id`)
- Vis bemærkningen med et info-ikon under lokation/tid, kun hvis den ikke er tom
- Vis bemærkningen med let styling så den skiller sig ud (fx italic eller en lille info-boks)

### Resultat
- Bookingansvarlige kan skrive en bemærkning der automatisk vises for alle sælgere tildelt den booking
- Mødetiden kan tilpasses per booking i stedet for altid at være 09:00-17:00
- Sælgere ser både bemærkning og korrekt mødetid på deres vagtplan
