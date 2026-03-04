

## Hvorfor Thomas Wehage ikke kan se diæter

### Årsag
Thomas Wehage har **0 rækker** i `booking_diet`-tabellen. Diæter er kun oprettet for specifikke medarbejdere (Theo, Jonathan, Michelle, Lucas, Frederik) — ikke for Thomas.

Medarbejdervisningen ("Min vagtplan") filtrerer diæter med `.eq("employee_id", employeeId)`, så Thomas ser kun sine egne diæter — og han har ingen.

### To mulige løsninger

**A) Dataproblem (mest sandsynligt):** Thomas mangler simpelthen diæt-tildelinger i databasen. Når diæter oprettes for en booking, skal alle tildelte medarbejdere på den booking+dato også få en `booking_diet`-række. → Tjek om diætoprettelsen i admin-UI'et automatisk opretter rækker for alle tildelte medarbejdere, eller kun for udvalgte.

**B) UI-ændring:** Vis diæt-badge til ALLE medarbejdere på en booking+dato, selvom de ikke personligt har en `booking_diet`-række. Ændring i `MyBookingSchedule.tsx`: hent diæter for hele bookingen (uden `employee_id`-filter) og vis badge hvis der eksisterer en diæt for booking+dato.

### Anbefaling
**Løsning B** — ændre `MyBookingSchedule.tsx` til at vise diæt-badgen for alle medarbejdere på en given booking+dato, uanset om de personligt har en `booking_diet`-række. Dermed ser Thomas at der er diæt tildelt på markedet, selvom hans specifikke diætrække mangler.

Ændringen er lille: fjern `.eq("employee_id", employeeId)` fra diæt-queryen i `MyBookingSchedule.tsx`, så den henter alle diæter for de relevante bookinger og viser badge hvis mindst én diæt findes for booking+dato.

