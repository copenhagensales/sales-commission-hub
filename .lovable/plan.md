

# Plan: Fix tidszone-bug i slot-filtrering

## Problem
Edge-funktionen `get-public-availability` bruger `new Date()` som er UTC-tid på serveren. Danmark er UTC+2 (CEST i april), så når klokken er 13:36 i DK, er `now` kun 11:36 UTC. Slot-sammenligning med `slotStart.setHours(11, 45)` sætter også UTC-tid, men time-vinduer er defineret i dansk tid. Resultatet er at slots som 11:45 og 12:00 dansk tid fejlagtigt vises som ledige.

## Løsning
Konverter `now` til dansk tid ved at beregne Danish-offset og sammenligne minutter-fra-midnat i stedet for `Date`-objekter.

## Ændringer i `supabase/functions/get-public-availability/index.ts`

1. Tilføj en hjælpefunktion `getDanishNowMinutes()` der beregner nuværende tidspunkt i dansk tid som minutter fra midnat
2. I `generateSlotsForDay`: For dage der er i dag (dansk tid), sammenlign `startMin` med danske nuværende minutter i stedet for at bruge `Date`-objekter
3. I `generateDays`: Brug dansk dato til at afgøre om "i dag" er overstået (samme tidszone-fix)

Konkret: Brug `Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen' })` til at finde aktuel dansk time/minut, og filtrer slots baseret på det.

## Fil der ændres
- `supabase/functions/get-public-availability/index.ts`

