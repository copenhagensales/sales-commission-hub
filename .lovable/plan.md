## Problem
`booking.end_date` sættes én gang ved oprettelse i "Book uge"-flowet ud fra de valgte dage. Når du bagefter udvider bookingen — enten ved at klikke flere dage på (opdaterer `booked_days` i `BookingsContent.tsx:595/620`) eller ved at tildele en medarbejder på en dato udenfor bookingens interval — bliver `end_date`/`start_date` ikke opdateret. Leverandørrapporten klipper på `[start_date, end_date]`, så alle assignments/booked_days udenfor det oprindelige interval forsvinder ud af faktureringen.

Konkret i dag: Asnæs uge 27 har `booked_days=[0,1,2,3,4]` og assignments på Tor 2/7 + Fre 3/7, men `end_date=2026-07-01`, så juli-rapporten viser kun 1 dag i stedet for 3.

## Fix — to trin

**Trin 1: Punktvis data-rettelse nu** (insert-tool UPDATE)
```sql
UPDATE booking SET end_date = '2026-07-03'
WHERE id = 'e4a21a47-40d2-45c7-bae5-c06f0d9cde59';
```
Efter dette viser juli-rapporten Ons/Tor/Fre for Asnæs uge 27 (3 dage, 2.838 kr før rabat).

**Trin 2: Rod-fix i selve booking-flowet** (gul zone — kræver separat plan)
Én DB-trigger på `booking_assignment` og på `booking.booked_days` der automatisk holder `start_date`/`end_date` konsistent:
- Ved INSERT/UPDATE på `booking_assignment`: hvis `date < booking.start_date` eller `> booking.end_date`, udvid parent-bookingens interval.
- Ved UPDATE af `booking.booked_days`: recompute `start_date`/`end_date` som (uge-mandag + min/max booked_day).

Dette fanger fejlen i data-laget uanset hvilken UI-vej der bruges (dag-toggle, assign-medarbejder, drag/drop). Jeg vil først liste alle bookinger hvor tilstanden allerede er inkonsistent, så du kan se omfanget før vi ruller triggeren ud.

## Ikke inkluderet nu
- Ingen kodeændringer i denne runde — kun data-fixet i trin 1.
- Trin 2 kræver din godkendelse som separat plan (rører booking-flow, gul zone).
- Ingen ændring til `booked_days` på Asnæs uge 27 (allerede korrekt: [0,1,2,3,4]).
