

## Del "Annulleret" op i to: vi annullerede vs. kandidat trak sig tilbage

### Hvad jeg fandt

På `/recruitment/booking-flow` er der ét samlet filter "Annullerede" i status-dropdownen. I databasen skelner vi allerede mellem hvem der annullerede via `cancelled_reason`-feltet på `booking_flow_enrollments`:

**Vi (recruiter/system) annullerede:**
- `Afvist af recruiter` — knap "Afvis" på pending approval
- `Manuelt annulleret` — XCircle-knap på aktive flows
- `Kandidat status ændret til: …` — auto-cancellation når application-status ændrer sig (process-booking-flow edge function)

**Kandidat trak sig selv:**
- `Kandidat afmeldte sig via link` — unsubscribe-link i email/SMS
- `Kandidat svarede på SMS` — STOP/svar via SMS
- (Bemærk: `Kandidat bookede selv en tid` er status `completed`, ikke cancelled — uændret)

### Ændringer

**1. `src/pages/recruitment/BookingFlow.tsx`**

a) Erstat dropdown-option "Annullerede" med to:
   - `cancelled_by_us` → "Vi annullerede"
   - `cancelled_by_candidate` → "Kandidat trak sig"

b) I enrollments-queryen: når filter er en af de to nye værdier, filtrer på `status = 'cancelled'` PLUS `cancelled_reason` matcher den rette gruppe (brug `.in()` med arrayet af reasons for hver gruppe).

c) Udvid `statusConfig` med to virtuelle statuser så badges på listen viser den korrekte etiket og farve:
   - `cancelled_by_us`: rød "Vi annullerede" (XCircle)
   - `cancelled_by_candidate`: grå/orange "Kandidat trak sig" (UserMinus-ikon)

d) Når badge rendes pr. enrollment: hvis `status === 'cancelled'`, beregn hvilken af de to grupper rækken hører til ud fra `cancelled_reason` og vis det rigtige badge — ikke det generelle "Annulleret".

**2. `src/components/recruitment/RecruitmentKpiBar.tsx`**

Split KPI-kortet "Annulleret" i to mindre kort (eller én kort med to tal) så ledelsen kan se forskellen på hvad vi afviser vs. hvad kandidaten selv frafalder. Brug samme `.in()`-mønster på `cancelled_reason`.

### Reason-grupperne (én kilde)

Jeg samler arrayet ét sted i `BookingFlow.tsx` (top of file) så det er nemt at vedligeholde:

```ts
const REASONS_BY_US = [
  "Afvist af recruiter",
  "Manuelt annulleret",
];
const REASON_PREFIX_BY_US = "Kandidat status ændret til:"; // bruges som startsWith-match
const REASONS_BY_CANDIDATE = [
  "Kandidat afmeldte sig via link",
  "Kandidat svarede på SMS",
];
```

For `Kandidat status ændret til: …`-rækker: behandles som "Vi annullerede" (system/recruiter-handling).

For ukendte/manglende `cancelled_reason`: defaulter til "Vi annullerede" (sikker fallback).

### Hvad jeg IKKE rør

- Database-skema (`cancelled_reason`-feltet eksisterer allerede og bruges korrekt af alle 4 edge functions)
- Edge functions (`unsubscribe-candidate`, `receive-sms`, `process-booking-flow`, `public-book-candidate`)
- Status-logik selv (`status = 'cancelled'` forbliver én værdi i DB — vi splitter kun visningen via `cancelled_reason`)
- Andre faner (Samtaler, Templates osv.)
- `BookingFlowEngagement.tsx` (har allerede sin egen "self-booked"-logik)

### Verificering

- Filter dropdown viser nu "Vi annullerede" og "Kandidat trak sig" i stedet for "Annullerede"
- Vælg "Vi annullerede" → ser de 14 nuværende rækker (13 afvist + 1 manuelt)
- Vælg "Kandidat trak sig" → ser fremtidige unsubscribe/SMS-respons rækker
- Hver række i listen viser det rigtige badge baseret på `cancelled_reason`
- KPI-baren viser to separate tal i stedet for ét samlet "Annulleret"

