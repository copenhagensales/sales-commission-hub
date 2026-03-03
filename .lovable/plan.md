

# Bil-aflevering påmindelse og bekræftelse

## Oversigt
Pa den sidste dag en bil er booket til en medarbejder, vises en detaljeret instruktions-callout om aflevering. Medarbejderen kan bekrafte afleveringen med en knap, som sender en email-notifikation til Fieldmarketing-lederne. GreenMobility-biler er undtaget.

## UI/UX Design

### Callout pa sidste bil-dag (gul/amber tema, matcher bil-badge stilen)
En kompakt, men synlig callout vises KUN pa den sidste dag bilen er booket. Den indeholder:

```text
+--------------------------------------------------+
|  CAR  AFLEVERING AF BIL I DAG                    |
|                                                   |
|  Parker bilen pa parkeringspladsen i de           |
|  afmaerkede base med "Copenhagen Sales".          |
|                                                   |
|  Hvis porten er last, brug noeglebrik fra         |
|  noegleboksen til hoejre for porten (kode 2109).  |
|  Aflever noeglen pa det lille kontor.             |
|                                                   |
|  ! Afleveres noeglen ikke, kan kollegaer ikke     |
|    bruge bilen. Parkerer du udenfor porten, er    |
|    du selv ansvarlig for parkeringsboeder.        |
|                                                   |
|  [check] Bekraeft aflevering                      |
+--------------------------------------------------+
```

- Farvetema: Amber/gul (matcher eksisterende bil-badge)
- "Bekraeft aflevering"-knappen skifter til en gron "Afleveret"-tilstand efter klik
- GreenMobility-biler viser IKKE denne callout

### Bekraeftelses-flow
1. Medarbejder klikker "Bekraeft aflevering"
2. En record gemmes i en ny `vehicle_return_confirmation`-tabel
3. En edge function sender email til FM-lederne (William Krogh Bornak + Thomas Wehage)
4. Knappen viser "Afleveret kl. HH:MM" i gron

## Tekniske aendringer

### 1. Database: Ny tabel `vehicle_return_confirmation`
```sql
CREATE TABLE vehicle_return_confirmation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_vehicle_id UUID REFERENCES booking_vehicle(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employee_master_data(id),
  confirmed_at TIMESTAMPTZ DEFAULT now(),
  vehicle_name TEXT,
  booking_date DATE
);
-- RLS: authenticated kan INSERT egne og SELECT egne
```

### 2. Edge function: `notify-vehicle-returned`
- Modtager: employee_id, vehicle_name, booking_date
- Slar op hvem der er FM-ledere (job_title ILIKE '%fieldmarketing leder%' eller 'Assisterende Teamleder FM')
- Sender email via M365 Graph API (samme monstre som andre send-funktioner)
- Emailen indeholder: Hvem afleverede, hvilken bil, hvilken dato

### 3. Frontend: `MyBookingSchedule.tsx`
- **Logik**: For hvert assignment med en bil, beregn om det er den sidste dag bilen er booket for det booking (ved at se alle booking_vehicle datoer for samme booking_id og vehicle_id). Undtag biler hvor `vehicle.name` matcher "Greenmobility" (case-insensitive).
- **Query**: Hent eksisterende `vehicle_return_confirmation` records for at vise "allerede bekraeftet" tilstand.
- **Mutation**: `useMutation` til at indsaette i `vehicle_return_confirmation` og kalde `notify-vehicle-returned` edge function.
- **UI**: Amber-farvet callout med instruktioner + bekraeft-knap, kun pa sidste bil-dag og kun for ikke-GreenMobility biler.

### 4. Raekkefoelge
1. Opret database-tabel + RLS
2. Opret edge function `notify-vehicle-returned`
3. Opdater `MyBookingSchedule.tsx` med logik, UI og mutation
