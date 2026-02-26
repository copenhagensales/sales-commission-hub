

## Redesign af booking-kommentar i vagtplanen

### Problem
Kommentaren ("Dette er en test-note :-)") drukner visuelt i de andre tekstlinjer. Den bruger samme layout som tid og makker, og er let at overse.

### Design-ide: Callout-kort under badges

Inspireret af Apples "inline callout" pattern (som man kender fra Notes og Reminders) placeres kommentaren som et lille fremhævet kort **under** makker og badges - helt nederst i vagtkortet. Det giver den visuel vægt uden at forstyrre det primære informationshierarki (lokation, tid, makker, bil/diaet).

Layoutet bliver:

```text
MAN 23/2
  @ Kvickly Holbaek, Holbaek
    Eesy FM - Eesy gaden
    09:00 - 17:00
    Makker: Martina
    [Ford Transit]  [Diaet]
  +-------------------------------------+
  | Note fra planlægger                  |
  | "Dette er en test-note :-)"          |
  +-------------------------------------+
```

### Visuelt design
- Fuld bredde inden for kortet (ml-6 for alignment med resten)
- Afrundet container med `rounded-lg`
- Blå/indigo tonalitet: `bg-blue-50 border border-blue-200` (dark: `bg-blue-950/30 border-blue-800`)
- Lille label "Note" i semibold over selve teksten
- `MessageSquare`-ikon ved labelen i matchende blaa
- Kommentarteksten i normal vaegt (ikke kursiv - det er svaerere at laese)

### Teknisk aendring

**Fil:** `src/pages/vagt-flow/MyBookingSchedule.tsx`

1. Flyt kommentar-blokken (linje 276-284) til **efter** badges-rækken (efter linje 310)
2. Erstat den simple tekstlinje med en callout-container:
   - Ydre `div` med `ml-6 mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800`
   - Indre header: ikon + "Note" label i `text-xs font-semibold text-blue-700 dark:text-blue-300`
   - Kommentartekst i `text-sm text-blue-900 dark:text-blue-100`

En enkelt aendring i en fil, ca. 15 linjer kode.
