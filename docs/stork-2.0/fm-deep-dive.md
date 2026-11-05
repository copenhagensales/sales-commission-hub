# Field Marketing (FM) i Stork 1.0 — deep dive

Forarbejde til Stork 2.0 Lag E. Faktarapport, ingen forslag eller anbefalinger.

Scope: hele FM-domænet i 1.0 — hvad findes, hvordan hænger det sammen, hvad gør koden faktisk.

Empirisk grundlag:
- Kode læst direkte fra repo `/home/user/sales-commission-hub` (state 2026-05-13).
- DB-state fra `docs/system-snapshot.md` (auto-genereret).
- Live Supabase MCP peger på Stork 2.0 (greenfield), så ingen direkte queries mod 1.0-prod.

---

## 1. Sproget: Vagt = FM

"Vagt-flow" og "FM" er det samme i koden. UI ligger under `/vagt-flow/*` og under permission-namespace `menu_fm_*`. Tabellerne hedder `booking`, `booking_assignment` etc. (uden "fm_"-prefix), men deres RLS-policies og brug er FM-eksklusiv. Hvis du ser "vagt-admin", "vagt-flow", "VagtBookings", "is_vagt_admin_or_planner" — det handler om FM.

Distinkt fra "shift"/"vagtplan" (kontor-vagter i `src/pages/shift-planning/`). To uafhængige planlægnings-systemer:
- **Kontor/TM**: `shift`-tabellen, `useShiftPlanning`-hook, `src/pages/shift-planning/`.
- **FM**: `booking`-træet, `useCalendarBooking`-hook, `src/pages/vagt-flow/`.

De deler kun `absence_request_v2` (samme fraværssystem).

---

## 2. Domænets data-model — alle FM-tabeller

### Core booking-træ

| Tabel | Rækker (snapshot) | Rolle |
|---|---|---|
| `booking` | 296 | Selve "ugen × lokation × kunde × kampagne" |
| `booking_assignment` | 1 988 | Hvem arbejder hvilken dag |
| `booking_diet` | 287 | Diæt-/oplæringsbonus-poster pr. dag |
| `booking_hotel` | 9 | Hotel-reservation pr. booking |
| `booking_vehicle` | 284 | Bil-tildeling pr. dag |
| `booking_startup_bonus` | -1 | Startup-bonus pr. dag (defineret men ikke i brug — se §13.4) |

### Master-data

| Tabel | Rækker | Rolle |
|---|---|---|
| `location` | 229 | Fysiske lokationer (shoppingcentre, kunder, mv.) |
| `location_placements` | -1 | Stand-positioner inde i en lokation, med egen dagspris |
| `brand` | -1 | Brand-mærker (Eesy, YouSee) — `name` med `color_hex` |
| `hotel` | -1 | Hotel-registry til overnatninger |
| `vehicle` | -1 | Bil-registry (firmabiler + lej-selv) |
| `vehicle_mileage` | -1 | Kilometer-aflæsninger pr. bil pr. dag |
| `vehicle_return_confirmation` | 1 | Bekræftelse af bil-aflevering med foto-upload |
| `mileage_report` | -1 | Pr. medarbejder km-rapportering (`employee_id`, `start_km`, `end_km`, `route_description`) |

### Booking → økonomi (debitor-side)

| Tabel | Rolle |
|---|---|
| `supplier_contacts` | Kontakter pr. `location_type` (shoppingcenter etc.) |
| `supplier_discount_rules` | Rabataftaler med leverandører (procent pr. antal placements eller årsomsætning) |
| `supplier_location_exceptions` | Per-lokation undtagelser fra rabatregler (excluded / max_discount) |
| `supplier_invoice_reports` | Gemte fakturaer pr. periode med JSON-detalje |

### FM-checkliste — backoffice, ikke felt-tjek

| Tabel | Rækker | Rolle |
|---|---|---|
| `fm_checklist_templates` | -1 | Daglige opgave-skabeloner (sort_order, weekdays) |
| `fm_checklist_completions` | 122 | Hvilke opgaver er udført hvilke dage |
| `fm_checklist_email_config` | -1 | Send-tid for daglig resumé-email |
| `fm_checklist_email_recipients` | -1 | Modtager-liste for resumé-emailen |

**Vigtigt:** Sample-templates viser opgaver som "Tjek dubletter igennem" og "Tjek difference fra PB til IM" — det er backoffice-tjekliste, ikke noget felt-personalet udfører ude. "FM" i `fm_checklist_*` betyder Field Marketing-teamet's daglige rutiner som backoffice.

### FM-salg (to parallelle tabeller)

| Tabel | Rækker | Status |
|---|---|---|
| `sales` (med `source='fieldmarketing'`) | del af 35 513 | Live-tabel |
| `fieldmarketing_sales` | 2 593 | Legacy/historisk |
| `sale_items` | del af 43 006 | Pris-linjer (oprettes via DB-trigger for FM) |

Begge tabeller har data. `useFieldmarketingSales`-hook (`src/hooks/useFieldmarketingSales.ts:31-101`) læser fra `sales` med `source='fieldmarketing'` og transformerer til legacy-shape. `useKpiTest.ts:154` har en kommentar "fieldmarketing_sales: 1 per row" — KPI-test-koden kender stadig den gamle tabel. Sample fra `fieldmarketing_sales` (`docs/system-snapshot.md:9013-9036`) og fra `sales` (`docs/system-snapshot.md:349396-349460`) viser samme felter — den nye lagrer fm_*-data i `sales.raw_payload`.

### Vagt-flow-roller (FM-isoleret rolle-system)

`employee`-tabellen (3 rækker, `docs/system-snapshot.md:7259`) har en USER-DEFINED `role` af type `vagt_flow_role` med default `'employee'`. Sample viser værdier `'admin'` og `'employee'`. RLS-policies refererer eksplicit til `vagt_flow_role`-værdier `'admin'` og `'planner'`. Sample-rækker har felter som `team: "YouSee"` og `team: "Eesy"` — string-felter, ikke FK.

Denne tabel kører **parallelt** med `employee_master_data` — den er en arv fra FM som standalone-system. RLS-policies for `mileage_report`, `vehicle_mileage` og enkelte andre tabeller refererer til denne tabel.

---

## 3. Booking-objektet — anatomien

`booking` (`docs/system-snapshot.md:1866-1969`):

```
id, location_id (FK → location), brand_id (FK → brand, ofte null),
start_date, end_date (date), week_number, year (integer),
expected_staff_count (default 2),
booked_days: integer[] (default {0,1,2,3,4} = mandag-fredag, ISO-day 0-indekseret),
client_id (FK → clients), campaign_id (FK → client_campaigns, ofte null),
daily_rate_override numeric, total_price numeric, placement_id (FK → location_placements),
status text DEFAULT 'draft',
comment text
```

### Status-værdier

Sample-data viser kun `'draft'` og `'confirmed'`. UI-koden filtrerer typisk på `status === 'confirmed'` (`MyBookingSchedule.tsx:84-86`, `Billing.tsx:62`, `SupplierReportTab.tsx:116`). Ingen enum — bare text-felt.

Ingen kode jeg har fundet sætter andre statusværdier end disse to. Ingen "cancelled"/"completed"-overgang implementeret.

### `booked_days` semantik

Et array af heltal 0-6 hvor `0 = Mandag`, `5 = Lørdag`, `6 = Søndag` (ISO-format). En booking fra start_date 2026-04-20 (mandag) til end_date 2026-04-24 (fredag) med `booked_days=[0,1,2,3,4]` betyder alle 5 hverdage. En anden booking samme uge med `booked_days=[5,6]` betyder lør+søn. Hver booking er altså "et stykke uge" — ikke 7 separate bookings.

Sample fra prod (`docs/system-snapshot.md:1931-1944`):
- Booking #1: man-fre 2026-04-20 → 2026-04-24, `booked_days=[0,1,2,3,4]`
- Booking #2: lør-søn 2026-01-24 → 2026-01-25, `booked_days=[5,6]`

### `daily_rate` — pris-hierarki

For fakturerings-formål er dagsprisen et hierarki (`Billing.tsx:166-171`, `LocationProfitabilityContent.tsx:363-364`):

1. `booking.total_price` (samlet pris — bruges hvis sat)
2. `booking.daily_rate_override` (per-booking override)
3. `location_placements.daily_rate` (hvis booking har `placement_id`)
4. `location.daily_rate` (default — sample-værdier: 1000-2000 kr)
5. Hardcoded `1000` som final fallback

### Triggers på `booking`

- `cleanup_assignments_on_booked_days_change` AFTER UPDATE (`docs/system-snapshot.md:357681-357706`):  
  Når `booked_days` ændres, slettes assignments for fjernede dage automatisk. Beregner dato som `NEW.start_date + day_index`.

### Markeder/Messer som special-case

`BookingsContent.tsx:93-95` har hardkodet `MARKET_TYPES = ["Markeder", "Messer"]`. Bookinger med `location.type ∈ MARKET_TYPES` filtreres ud af "normal bookings"-listen og vises i en separat fane. Lokationer med disse types behandles altså anderledes i UI, men i DB er de samme `booking`-rækker.

---

## 4. Booking-assignment — pr. medarbejder pr. dag

`booking_assignment` (`docs/system-snapshot.md:1972-2045`):

```
id, booking_id (FK), employee_id (FK → employee_master_data),
date (DATE, NOT NULL),
start_time, end_time (TIME, NOT NULL — typisk 09:00/17:00),
note text,
sales_reported integer DEFAULT 0,
leads_reported integer DEFAULT 0,
on_my_way_at timestamptz
```

UNIQUE-constraints:
- `booking_assignment_unique_employee_booking_date`: én medarbejder kan kun have én tildeling pr. (booking, dato)
- `booking_assignment_unique_employee_date`: én medarbejder kan **ikke have to assignments samme dag i to forskellige bookings**. Total-overlap er DB-blokeret.

### RLS

- Admin/planners kan ALT (`is_vagt_admin_or_planner`)
- Alle authenticated kan SELECT
- Medarbejder kan UPDATE egne (kun `employee_id = auth.uid()`-check, hvilket forudsætter `auth.uid()` = `employee.id` — det er `employee`-tabellen, ikke `employee_master_data`)

### Hvad gør `on_my_way_at`?

Felt der opdateres når medarbejder trykker "på vej" — bruges af UI til status, men jeg har ikke fundet kode der læser det andet end visning.

### `sales_reported`, `leads_reported`

Tællere på assignment-rækken. Jeg har ikke fundet kode der opdaterer dem ved salg — sales-flow i `SalesRegistration.tsx` opretter sales-rækker, ikke booking_assignment-update. Felterne ser ud til at være ubrugte/legacy.

---

## 5. Diæt-flow

### `booking_diet` (287 rækker)

```
id, booking_id, employee_id, date,
salary_type_id (FK → salary_types, NOT NULL),
amount numeric NOT NULL,
created_at, created_by
```

Sample (`docs/system-snapshot.md:2087-2108`):
```
booking_id: <ref>, employee_id: <ref>, salary_type_id: <ref>, date: "2026-02-24", amount: 300
```

### Diæt-modellen

UI dokumenterer reglerne (`TravelExpenses.tsx:166-186`):
- 1. dag = 0 kr (rejsedagen)
- Fra dag 2 og frem = 300 kr/dag

**Reglen er prosa i UI, ikke maskin-kode.** Faktisk DB-værdi er bare `amount: 300` pr. række — der er INTET der validerer at dag 1 = 0 kr. UI'et i Bookings-siden tilbyder en "Quick-Add Diæt"-knap der opretter en `booking_diet`-række med `amount` fra `salary_type.amount` (`BookingsContent.tsx:297-310` — fetcher `salary_types` hvor `name ILIKE '%diæt%'`).

### `salary_type_id` adskiller diæt fra oplæringsbonus

Samme tabel (`booking_diet`) bruges til:
- **Diæt** (`salary_types.name ILIKE '%diæt%'`)
- **Oplæringsbonus** (`salary_types.name ILIKE '%oplæring%'` — også kaldt "startup bonus" i `useSellerSalariesCached.ts:191-207`)

Skelnen sker udelukkende via `salary_type_id`. `BookingsContent.tsx:312-326` fetcher begge salary_types separat og bygger to forskellige lookup-maps:
- `dietByBookingDate` (filtreret på diet-salary_type)
- `trainingByBookingDate` (filtreret på oplæring-salary_type)

### Hvordan diæt ender i løn

`useSellerSalariesCached.ts:130-150` (diet) og 191-207 (startup-bonus):
- Diet: `booking_diet` filtreret på `salary_type_id != trainingBonusTypeId` (`useSellerSalariesCached.ts:140-141`) — så diet er "alt der ikke er oplæringsbonus".
- Startup bonus: `booking_diet` filtreret på `salary_type_id = trainingBonusTypeId`.
- Aggregeret pr. `employee_id` og lagt sammen i `SellerData.diet` og `SellerData.startupBonus`.

`useStaffHoursCalculation.ts` filtrerer i `booking_diet`-queryen (`useSellerSalariesCached.ts:140-141`): `query.neq("salary_type_id", trainingBonusTypeId)` — så staff-hours-beregningen ekskluderer oplæringsbonus-rækker fra "diet"-summen.

### Hvad er `booking_startup_bonus`?

Separat tabel med samme skema som booking_diet plus salary_type_id, `docs/system-snapshot.md:2780-2812`. **Ingen kode i `src/` eller `supabase/functions/` skriver til eller læser fra tabellen** (search `grep -rln "booking_startup_bonus"` returnerer kun TypeScript-typer). Tabellen findes som DDL men er pt. ubrugt. "Startup bonus" i koden bruger `booking_diet` med oplærings-salary_type i stedet.

---

## 6. Hotel-flow

### `booking_hotel`

```
id, booking_id, hotel_id, check_in, check_out, rooms, confirmation_number text,
status text DEFAULT 'pending',
price_per_night numeric, notes,
check_in_time, check_out_time TIME,
booked_days integer[]
```

Sample (`docs/system-snapshot.md:2449-2487`) viser priser som `1846.64` og `2080` kr/nat. Status-værdier: `'pending'`, `'confirmed'`.

### `hotel` (registry)

```
id, name, city, address, phone, email, notes,
postal_code,
default_price_per_night numeric,
times_used integer DEFAULT 0   ← auto-inkrementeres
```

### Trigger: `increment_hotel_times_used`

`docs/system-snapshot.md:359225-359234`:
```sql
BEGIN
  UPDATE public.hotel SET times_used = times_used + 1 WHERE id = NEW.hotel_id;
  RETURN NEW;
END;
```

AFTER INSERT på `booking_hotel`. Bruges til "mest brugte hoteller"-sortering i UI (`useBookingHotels.ts:43`).

### Hotel-omkostning i økonomi-rapporter

`LocationProfitabilityContent.tsx:266-273` aggregerer:
```
hotelCost = sum(booking_hotel.price_per_night)   // NOTE: ikke ganget med rooms eller nætter
```

Det er **per booking, en sum af pris pr. nat for alle rooms-rækker** — men koden ganger ikke med nætter eller værelser. Det er en simpel sum af raw `price_per_night`-værdier. Kommentar i koden konfirmerer ikke om dette er bevidst.

`HotelExpensesTab.tsx` (i billing-mappen) er en separat fakturerings-fane for hoteller.

### Hotel-flow i UI

`MyBookingSchedule.tsx:112-123` viser booking_hotel med hotel-navn, adresse, by, telefon, check_in/out-tider og notes på sin egen vagtkalender. `AssignHotelDialog` (i components) opretter nye hotel-tildelinger.

`MyBookingSchedule.tsx:155-166` fetcher `vehicle_return_confirmation` og viser en `VehicleReturnCallout` på dage med tildelt bil — medarbejder skal bekræfte aflevering med eventuel foto-upload til Supabase Storage bucket `vehicle-return-photos`.

---

## 7. Køretøjs-flow

### `vehicle` (registry)

```
id, name, license_plate (UNIQUE), is_active, notes
```

Sample (`docs/system-snapshot.md:7120-7136`):
- "Greenmobility", license_plate="", notes="Lej selv"
- "Hvid Berlingo (Bil 1)", license_plate="DR55117"

Den første viser at registry også indeholder "lej-selv"-køretøjer uden nummerplade.

### `booking_vehicle`

```
id, booking_id, vehicle_id, date
```

UNIQUE-constraint `booking_vehicle_vehicle_id_date_unique`: én bil pr. dato (kan ikke tildeles til to bookings samme dag).

### `vehicle_return_confirmation`

```
id, booking_vehicle_id, employee_id, confirmed_at,
vehicle_name, booking_date, booking_id, vehicle_id,
photo_url text   ← URL til Supabase Storage
```

UNIQUE: `uq_vehicle_return_booking_vehicle_date`. RLS: medarbejder kan indsætte/se egne, men kun **`is_fieldmarketing_leder(auth.uid())`** kan se alle (`docs/system-snapshot.md:357236-357237`). Eneste sted i hele DB hvor `is_fieldmarketing_leder` bruges.

### `notify-vehicle-returned` edge function

`supabase/functions/notify-vehicle-returned/index.ts`. Kaldes fra `MyBookingSchedule.tsx:186-198`. Funktionen:
- Modtager `booking_id, vehicle_id, vehicle_name, booking_date, photo_url, employee_id`
- Skriver til `vehicle_return_confirmation`
- Sender email via Microsoft Graph (M365) til en eller flere modtagere
- Sender SMS via Twilio
- Telefon-normalisering: hardkoder dansk +45 hvis 8-cifret

### `vehicle_mileage` vs `mileage_report`

To separate kilometer-tabeller:
- `vehicle_mileage` (`docs/system-snapshot.md:357140-357201`): pr. (bil, dato), `start_mileage` + `end_mileage` — bil-niveau. Admin kan oprette via `vagt_flow_role`-check (`docs/system-snapshot.md:357166-357169`).
- `mileage_report` (`docs/system-snapshot.md:346507-346539`): pr. (employee, vehicle, booking, dato), `start_km` + `end_km`, `route_description` — medarbejder-niveau.

Begge skemaer er definerede, men sample viser `start_mileage=0, end_mileage=0` på alle `vehicle_mileage`-rækker — ufuldstændig udfyldning. Halv-bygget kilometer-system.

---

## 8. Lokationer

### `location` (229 rækker)

```
id, name, type text,
address_street, address_postal_code, address_city, region,
contact_person_name, contact_phone, contact_email,
can_book_eesy boolean, can_book_yousee boolean,    ← hardkodet to-klient-flag
status USER-DEFINED DEFAULT 'Ny'::location_status,
notes, is_favorite,
cooldown_weeks integer DEFAULT 4,
available_after_date date,
daily_rate numeric DEFAULT 1000,
bookable_client_ids uuid[] DEFAULT '{}',
client_campaign_mapping jsonb DEFAULT '{}',
external_id text
```

Sample (`docs/system-snapshot.md:346246-346301`):
```
name: "Lyngby Storcenter", type: "Danske Shoppingcentre",
status: "Aktiv", daily_rate: 2000,
bookable_client_ids: ["5011a7cd-..."],     ← YouSee
client_campaign_mapping: {"5011a7cd-...": "743980b0-..."}
```

### `location.type` som leverandørgruppering

`type` er fri tekst, men `Billing.tsx:114` har en hardkodet liste af "statiske typer":
```
["Coop butik", "Meny butik", "Danske Shoppingcentre", "Ocean Outdoor",
 "Markeder", "Messer", "Anden lokation"]
```

`location.type` styrer hvilke rabatregler der gælder (`supplier_discount_rules.location_type` foreign-key til denne text-værdi). **Det er stadig fritekst** — ikke en enum eller dedikeret tabel. Hvis en lokation har `type: "Ocean Outdoor"`, matcher den rabatregler med samme streng.

### `bookable_client_ids` + `client_campaign_mapping`

Lokationen ved hvilke klienter må bookes der, og hvilken kampagne pr. klient. UI'et bruger `client_campaign_mapping` i `LocationDetail.tsx:75-100` — men kun for kampagner der ER mappet i `adversus_campaign_mappings` (en INNER-JOIN på det mapping-table). Lokationen er ALTSÅ kun bookbar mod kampagner som ER kendt af pricing-motoren.

### `can_book_eesy` og `can_book_yousee` — separate booleans

To hardkodede klient-flag — ikke array-baseret. Sample-data viser at de bruges parallelt med `bookable_client_ids`-arrayet. Drift mellem to repræsentationer af samme info.

### `cooldown_weeks` + `available_after_date`

Lokationen har en cooldown efter brug (default 4 uger). Jeg har ikke fundet kode der HÅNDHÆVER dette — det er rådata, formodet til UI-advarsel.

### `location_placements`

Stand-positioner inde i en lokation. Sample (`docs/system-snapshot.md:346333-346347`):
```
location_id: "752c2ca5-...", name: "K1 - Espresso Pladsen", daily_rate: 9270
location_id: "752c2ca5-...", name: "K2 - Synoptik Pladsen", daily_rate: 8652
```

En lokation kan have flere placeringer med forskellige priser. Booking peger på en placement via `booking.placement_id` (nullable). `LocationProfitabilityContent.tsx:248-263` har en mutation til at ændre placement på flere bookinger samtidigt.

---

## 9. Bookings → faktureringsside (Leverandørrapport)

`SupplierReportTab.tsx` (1087 linjer) genererer fakturarapporter pr. `location_type` (leverandør).

### Rabatregler — to typer

`supplier_discount_rules` har `discount_type`:

**1. `'placements'`** (default): trapper på antal placeringer
```
min_placements >= N → discount_percent = X
```
Eksempel-data: "0 placeringer → 15%", "10 placeringer → 20%" osv.

**2. `'annual_revenue'`** eller **`'monthly_revenue'`**: trapper på omsætning
```
min_revenue >= N kr → discount_percent = X
```
Eksempel (`docs/system-snapshot.md:354878-354904`):
- "Ocean Outdoor", min_revenue=0 → 15%
- "Ocean Outdoor", min_revenue=200000 → 20%

### `supplier_location_exceptions`

Per-lokation undtagelser. `exception_type` kan være:
- `'max_discount'` med `max_discount_percent` (e.g. 25%) — capper rabatten
- `'excluded'` — lokation tæller ikke i rabatberegning og får ingen rabat

Sample (`docs/system-snapshot.md:355410-355431`):
```
location_type="Ocean Outdoor", location_name="Bruuns Galleri",
exception_type="max_discount", max_discount_percent=25
```

### Faktureringsmodel

`Billing.tsx:219-309` (BillingOverviewTab) bygger fakturerings-summer:

```
For hvert location_type:
  rules = supplier_discount_rules WHERE location_type=X
  placements = Σ floor(totalDays_pr_lokation / min_days_per_location)
  typeGroupTotal = Σ totalAmount (minus excluded locations)

  if discount_type = 'monthly_revenue':
    appliedDiscount = højeste rule hvor typeGroupTotal >= min_revenue
  elif discount_type = 'annual_revenue':
    appliedDiscount = laveste tier (forenklet — "we don't have YTD in this tab")
  else (placements):
    appliedDiscount = højeste rule hvor placements >= min_placements

  Pr. lokation:
    if excluded: full price (ingen rabat)
    if max_discount: effective = min(appliedDiscount, max_discount_percent)
    netto = totalAmount * (1 - effectiveDiscount/100)
```

### `supplier_invoice_reports` — fakturahistorik

Sample (`docs/system-snapshot.md:354948-354978`):
```
location_type="Danske Shoppingcentre", period_start="2026-01-01",
total_amount=159200, discount_percent=15, discount_amount=23880,
final_amount=135320, unique_locations=15, status="approved",
report_data: [
  {city, days, amount, client, dailyRate, isExcluded, finalAmount, locationName, discountAmount, discount, minDate, maxDate},
  ...
]
```

Hele rapporten gemmes inkl. snapshot af alle linjer i `report_data` jsonb. Status: `'draft', 'approved'`.

### `send-supplier-report` edge function

273 linjer, sender email + PDF til leverandør via M365 Graph. Triggeres fra UI via `SendToSupplierDialog`.

### Periode-typer for fakturering

`Billing.tsx:38, 44-49`: rapporter kan kørs over kalendermåned ELLER lønperiode (15.→14.). Periode-skift i UI; ingen DB-låsning.

---

## 10. FM-salg — flow fra UI til DB

### Indgang: `/vagt-flow/sales-registration`

`src/pages/vagt-flow/SalesRegistration.tsx`. Bruger logget-ind FM-sælger åbner siden.

### Trin 1: Find dagens vagt

`SalesRegistration.tsx:79-117` slår op i `booking_assignment` for `employee_id = currentEmployee.id AND date = today`. Resultat = `todayBooking` (`activeBooking`) med location, client, brand, campaign.

Ejere (`isOwner`) kan vælge fra alle bookinger via `selectedBookingId` (line 122-141). Almindelige sælgere er låst til deres assignment.

Callback-tilstand (`SalesRegistration.tsx:174-216`): sælgeren kan registrere et salg for en TIDLIGERE dato hvis hun glemte det — UI lader hende vælge dato og slår tilsvarende booking_assignment op.

### Trin 2: Find produkter for kampagnen

`SalesRegistration.tsx:250-328`. Tre-trins fallback for at hente produkter:
1. Hvis booking har `campaign_id`: `SELECT FROM products WHERE client_campaign_id = booking.campaign_id`
2. Hvis booking har `brand.name`: find campaigns via `client_campaigns.name ILIKE %brand%`, så produkter
3. Hvis booking har kun `client_id`: alle campaigns for kunden, så alle produkter

`WHERE name != 'Lokation'` filtrerer en specifik produktnavn ud.

Duplikater (samme navn) dedupliceres lokalt.

### Trin 3: Sælgeren tilføjer produkter

UI viser `productSelections: [{ productId, productName, quantity, phoneNumbers[] }]`. Et produkt med qty=3 har 3 telefonnumre-felter (one phone per unit-salg).

### Trin 4: Submit

`SalesRegistration.tsx:406-477` validerer og kalder `createSalesMutation` (= `useCreateFieldmarketingSale`).

`useCreateFieldmarketingSale` (`src/hooks/useFieldmarketingSales.ts:203-265`):
1. For hver sale: slår op i `employee_master_data` for `first_name, last_name, work_email`.
2. Bygger insert-objekter med:
   ```
   source: 'fieldmarketing',
   integration_type: 'manual',
   sale_datetime: callback-dato (12:00 noon) eller now(),
   customer_phone: phone (per række),
   agent_name: "first last",
   agent_email: work_email,
   client_campaign_id: null,                ← sættes af trigger
   validation_status: 'pending',
   raw_payload: {
     fm_seller_id, fm_location_id, fm_client_id, fm_product_name, fm_comment
   }
   ```
3. `supabase.from("sales").insert(enrichedSales)` — én række pr. (produkt × telefon).

### Trin 5: DB-triggers tager over

**`enrich_fm_sale()` (BEFORE INSERT, `docs/system-snapshot.md:357981-358015`):**
- Hvis `agent_email` mangler: SELECT `work_email, first_name||' '||last_name` FROM `employee_master_data` WHERE `id = fm_seller_id` → sætter `NEW.agent_email` og `NEW.agent_name`.
- Hvis `client_campaign_id` mangler: prøver i rækkefølge:
  1. Slå booking op via `fm_location_id` + dato → tag `booking.campaign_id`
  2. Smart-match: `fm_product_name` med "gade" → kampagne med "gade" i navn (eller "marked"-match)
  3. Fallback: første campaign for `fm_client_id` (ORDER BY `created_at ASC`)

**`create_fm_sale_items()` (AFTER INSERT, `docs/system-snapshot.md:357909-357940`):**
- Idempotensvagt: skip hvis sale_items allerede findes.
- Hent produkt på case-insensitive trim af `fm_product_name`.
- Find pricing-regel: campaign-specifik via `adversus_campaign_mappings` → universal regel → product base price.
- Insert `sale_item` med `mapped_commission`, `mapped_revenue`, `display_name`.

Detaljer på pricing-side: se `docs/stork-2.0/beregningsmotor-deep-dive.md`.

### `useFieldmarketingSales`-hook returnerer legacy-shape

`useFieldmarketingSales.ts:31-101` læser `sales`-tabellen men returnerer objekter der ser ud som om de kom fra `fieldmarketing_sales`-tabellen:
```ts
{ id, seller_id, location_id, client_id, product_name, phone_number, comment, ...}
```

Felterne kommer fra `sales.raw_payload.fm_*`. Det er en transformations-shim ovenpå migrationen — alle UI-komponenter ser stadig den gamle shape.

### Edit-flow: `vagt-flow/edit-sales`

`EditSalesRegistrations.tsx` (1172 linjer). Tillader teamleder eller FM-leder at rette eksisterende FM-salg:
- Update felter: seller_id, client_id, location_id, product_name, comment, telefon.
- For "core data changes" (`saleIdsNeedingRematch`): kalder edge function `rematch-pricing-rules` med sale-ids for at genberegne commission.
- For nye sales: insertes som ny `sales`-række — triggers håndterer resten.

`EditSalesRegistrations.tsx:412-415` viser at rematch-pricing-rules kaldes manuelt fra UI ved opdatering.

---

## 11. Vagtplanlægning — hvad ser hvem

### Sælger-side: `/vagt-flow/my-schedule`

`MyBookingSchedule.tsx` (595 linjer). Sælgeren ser sin uge:
- Egne `booking_assignment`-rækker med booking + location + client + campaign
- Tildelte hoteller (`booking_hotel` for sine bookinger)
- Tildelte biler (`booking_vehicle` for sine bookinger)
- Diæt-beløb (`booking_diet` for sig selv)
- Partnere (andre medarbejdere på samme booking samme dag)
- Bil-aflevering-prompts (`vehicle_return_confirmation`)

Read-only undtagen bil-aflevering-action.

### Leder-side: `/vagt-flow/bookings`

`Bookings.tsx` (853 linjer) eller `BookingsContent.tsx` (1825 linjer — den nye monolitiske komponent med tabs). Leder ser:
- Alle bookinger denne uge
- Klient-filter (kun klienter tilknyttet "Fieldmarketing"-team via `team_clients`)
- Status-filter
- Pr. booking-dag: tildelte medarbejdere, biler, hoteller, diæter, training-bonus, fravær

Operationer (`BookingsContent.tsx:489-650+`):
- `bulkAssignMutation`: tildel medarbejdere til flere dage
- `deleteBookingMutation`: slet booking
- `deleteAssignmentMutation`: fjern medarbejder fra vagt
- `removeDayMutation`: fjern enkelt dag fra booking (opdaterer `booked_days`-array)
- `addDayMutation`: tilføj dag
- `addVehicleToDayMutation` / `removeVehicleFromDayMutation`
- "Quick add diet" / "Quick add training bonus"

### Ny booking: `/vagt-flow/book-week`

`BookWeekContent.tsx` (899 linjer). Wizard til at booke en uge med multiple bookings.

### Lokations-administration: `/vagt-flow/locations`

`Locations.tsx`, `LocationsContent.tsx`, `LocationDetail.tsx`. CRUD over `location`-tabellen og dens placeringer. `LocationHistoryContent.tsx` viser historik for bookinger.

### Lokations-økonomi: `/vagt-flow/locations?tab=okonomi`

`LocationProfitabilityContent.tsx` (747 linjer). DB-analyse pr. lokation:
```
totalRevenue = Σ sale_items.mapped_revenue (FM-salg på lokationen)
sellerCost  = totalCommission × (1 + VACATION_PAY_RATES.SELLER)
                                      ↑ 12,5% feriepenge oveni
locationCost = dailyRate × bookedDays
hotelCost   = Σ booking_hotel.price_per_night
dietCost    = Σ booking_diet.amount (alle, INKLUSIV training bonus)
db (dækningsbidrag) = totalRevenue - sellerCost - locationCost - hotelCost - dietCost
```

(Konsekvens: træningsbonus tæller som diet i DB-beregningen her, men adskilles i løn-rapport. Drift.)

### Markeder: `MarketsContent.tsx` (861 linjer)

Separat fane for bookinger med `location.type ∈ ["Markeder", "Messer"]`. Egen detalje-UI.

### Fakturering: `/vagt-flow/billing`

`Billing.tsx` med 6 faner:
- Oversigt
- Leverandørrapport (`SupplierReportTab`)
- Hoteller (`HotelExpensesTab`)
- Udgiftsrapport (`ExpenseReportTab`)
- Rabataftaler (`DiscountRulesTab`)
- Kontaktpersoner (`SupplierContactsTab`)

### Andre vagt-flow-sider

- `/vagt-flow/vehicles` — `Vehicles.tsx` (324 linjer): bil-registry + tildelinger
- `/vagt-flow/time-off` — `TimeOffRequests.tsx` (213 linjer): læser `employee_absence` (tom!) — død flow (se §13.1)
- `/vagt-flow/travel-expenses` — `TravelExpenses.tsx`: STATISK INFORMATIONS-SIDE — ingen DB-interaktion, kun policy-tekst

### Dashboard: `/vagt-flow` (root) og `/dashboards/fieldmarketing`

`vagt-flow/Index.tsx` viser uge-oversigt + `BookingsLast30DaysChart`. `vagt-flow/FieldmarketingDashboard.tsx` (581 linjer) viser pr-klient KPI'er (i dag, denne uge, denne måned, total) plus top-sælgere med commission-beregninger.

`FieldmarketingDashboardFull.tsx` (`/dashboards/fieldmarketing`) er en separat dashboard-rute.

---

## 12. Permission-modellen

### `vagt_flow_role` enum (kun for `employee`-tabellen)

Sample-værdier observeret: `'admin'`, `'employee'`, `'planner'` (sidstnævnte refereret i RLS-policies men ikke i samples).

### `is_vagt_admin_or_planner(_user_id)` (`docs/system-snapshot.md:359424-359443`)

```sql
SELECT EXISTS (
  SELECT 1 FROM system_roles
  WHERE user_id = _user_id AND role IN ('ejer', 'teamleder')
)
OR EXISTS (
  SELECT 1 FROM employee_master_data emd
  LEFT JOIN job_positions jp ON emd.position_id = jp.id
  WHERE emd.auth_user_id = _user_id
    AND emd.is_active = true
    AND (
      emd.job_title IN ('Fieldmarketing leder', 'Ejer', 'Teamleder',
                        'Assisterende Teamleder FM', 'Assisterende Teamleder')
      OR jp.system_role_key IN ('ejer', 'teamleder',
                                'assisterende_teamleder_fm', 'fm_leder')
    )
)
```

To-trins resolution: `system_roles` (gammel) ELLER `employee_master_data.job_title` OG `job_positions.system_role_key` (nyere). Job-title-strings er HARDKODET i function-body.

### `is_fieldmarketing_leder(_user_id)`

```sql
SELECT EXISTS (
  SELECT 1 FROM employee_master_data
  WHERE auth_user_id = _user_id
    AND job_title ILIKE '%fieldmarketing%leder%'
    AND is_active = true
)
```

Pattern-match på "fieldmarketing...leder" — fanger "Fieldmarketing leder" og lignende. Bruges kun ét sted: RLS på `vehicle_return_confirmation` (`docs/system-snapshot.md:357236-357237`).

### 22 FM-specifikke permission keys

`src/config/permissionKeys.ts:266-289` — 12 menu-keys og 10 tab-keys for FM. Eksempler:
- `menu_fm_my_schedule`, `menu_fm_overview`, `menu_fm_booking`, `menu_fm_vehicles`
- `menu_fm_sales_registration`, `menu_fm_billing`, `menu_fm_travel_expenses`
- `menu_fm_edit_sales`, `menu_fm_time_off`, `menu_fm_book_week`, `menu_fm_bookings`, `menu_fm_locations`
- `tab_fm_eesy`, `tab_fm_yousee`, `tab_fm_book_week`, `tab_fm_bookings`, `tab_fm_markets`, `tab_fm_locations`, `tab_fm_vagtplan`, `tab_fm_hotels`, `tab_fm_training`, `tab_fm_checklist`

Disse er tilknyttet via `job_positions.permissions` jsonb og `role_page_permissions`-tabellen.

### FM-specifikke RLS-policies (samlet liste)

- `booking`: `is_vagt_admin_or_planner OR is_teamleder_or_above` for ALL; all authenticated kan SELECT
- `booking_assignment`: kun admin/planner for ALL; medarbejder kan UPDATE egne; all authenticated kan SELECT
- `brand`: kun admin/planner for ALL
- `employee` (FM legacy): kun admin/planner for ALL
- `employee_absence` (død): kun admin/planner for ALL
- `vehicle`: kun admin/planner for ALL
- `vehicle_mileage`: kun admin/planner for ALL (via `vagt_flow_role` IN admin/planner)
- `mileage_report`: medarbejder kan oprette/se egne; admins kan alt (via `vagt_flow_role`)
- `vehicle_return_confirmation`: medarbejder kan se/oprette egne; `is_fieldmarketing_leder` kan se alle
- `hotel`, `booking_hotel`: alle kan SELECT; kun `is_teamleder_or_above` kan ændre (uafhængigt af vagt_flow_role!)
- `supplier_*`: kun `is_teamleder_or_above` kan ændre (også uafhængigt af vagt_flow_role)
- `fm_checklist_*`: alle authenticated kan ALT
- `fieldmarketing_sales`: alle authenticated kan SELECT/INSERT; kun `is_teamleder_or_above` for UPDATE/DELETE
- `sales` med `source='fieldmarketing'`:
  - `"FM sellers can insert fieldmarketing sales"` (INSERT, public) WITH CHECK: `source='fieldmarketing' AND auth.uid() IS NOT NULL`
  - `"FM sellers can view all fieldmarketing sales"` (SELECT, public) — alle aktive medarbejdere ser ALLE FM-salg
- `sale_items`:
  - `"FM employees can view own FM sale_items"` (SELECT): JOIN gennem `sales s` → `employee_master_data e` på `s.agent_email = e.work_email`. Kun for FM (source='fieldmarketing').

### Inkonsistens: tre forskellige role-systems

For FM-tilladelser checker koden afhængigt af tabel:
1. `vagt_flow_role` (admin/planner/employee) — på den gamle `employee`-tabel via subselect
2. `is_vagt_admin_or_planner()` — kombineret check af `system_roles` + `employee_master_data.job_title` + `job_positions.system_role_key`
3. `is_teamleder_or_above()` — generelt rolle-check
4. `is_fieldmarketing_leder()` — kun for ét RLS-policy

Disse FOUR forskellige veje må alle returnere samme svar for at give konsistent oplevelse — men de checker forskellige tabeller. Kilden til en brugers FM-tilladelser afhænger af hvilken tabel der querres.

---

## 13. Rod, halvbygget og særtilfælde

### 13.1 Død tabel: `employee_absence` (FM-legacy)

`docs/system-snapshot.md:7323-7367`. Skema med `status DEFAULT 'APPROVED'` (uppercase!), `reason USER-DEFINED`, `approved_by_employee_id`. Tom (-1 rows).

Levende fraværssystem er `absence_request_v2` (826 rækker, lowercase status). `useShiftPlanning.useAbsenceRequests` bruger v2.

MEN: `useTimeOffRequests.ts` (213 linjer) læser `employee_absence` og `vagt-flow/TimeOffRequests.tsx` viser den. Hele FM-side viser tom liste, fordi de læser den døde tabel.

### 13.2 Død tabel-tvilling: `fieldmarketing_sales`

2 593 rækker eksisterer, men ingen kode skriver nye til den. `useKpiTest.ts:154` (KPI-test) kender begge tabeller og dokumenterer historikken.

`useFieldmarketingSales`-hook læser nu fra `sales`-tabellen men returnerer legacy-shape. Transformations-shim.

### 13.3 `employee`-tabel (FM-legacy)

3 rækker i en separat employee-tabel parallelt med `employee_master_data`. RLS-policies på `mileage_report` og `vehicle_mileage` refererer til DENNE tabel via `employee.role = 'admin'/'planner'`. Det betyder: `mileage_report.RLS` checker `employee.id = auth.uid()` — som forudsætter at `auth.uid()` (Supabase auth-user-id) er lig den FM-employee-id. Sandsynligvis fungerer det ikke for de fleste medarbejdere (deres auth_user_id matcher `employee_master_data.auth_user_id`, ikke `employee.id`).

### 13.4 `booking_startup_bonus`-tabel uden brugere

Tabel defineret med `booking_id, employee_id, date, amount, salary_type_id`. Schema er klar. Ingen kode skriver eller læser fra den. Konceptet "startup bonus" findes — men implementeres via `booking_diet` + oplærings-`salary_type_id`. Tabellen er ubrugt skemastyrke.

### 13.5 `vehicle_mileage` halvt udfyldt

Alle observerede sample-rows har `start_mileage=0, end_mileage=0`. Tabellen oprettes ved booking_vehicle insert (formodet) men data udfyldes ikke. Kilometer-aflæsninger er halv-bygget.

### 13.6 To km-systemer

`vehicle_mileage` (bil-niveau, admin-styret) og `mileage_report` (medarbejder-niveau, selvbetjent). Begge findes. Ingen er fuldt udfyldt. UI-side for begge er ikke fundet — `MyBookingSchedule.tsx` viser hverken den ene eller anden.

### 13.7 `expected_staff_count` ikke håndhævet

`booking.expected_staff_count` default 2. Ingen DB-check eller UI-validering at antallet af tildelte medarbejdere matcher. Kun rådata for planlægning.

### 13.8 Status-system uden tilstandsmaskine

`booking.status`: kun `'draft'` og `'confirmed'` observeret. Ingen overgang via DB-trigger. UI'et sætter `'confirmed'` ved oprettelse i de fleste flows (sample data er overvejende confirmed).

`booking_hotel.status`: `'pending'`, `'confirmed'`. Sample viser begge.

Ingen "completed", "cancelled" eller "invoiced" tilstande. Slutning af en booking er implicit (end_date er fortid).

### 13.9 Brand-tabel uden FK-forbindelse til klient

`brand` (Eesy, YouSee) hænger isoleret. `booking.brand_id` er nullable FK. De fleste samples har `brand_id: null`. UI'et bruger brand som visuel taggning (`color_hex`). Ingen relation `brand → client` eller `brand → campaign` i skemaet.

### 13.10 `client_campaign_mapping` på location er JSONB

`location.client_campaign_mapping: jsonb DEFAULT '{}'` — opbevarer `{client_id: campaign_id}`. Det burde måske være en relations-tabel `location_campaigns`, men er en hardkodet jsonb-struktur. UI'et i `LocationDetail.tsx:75-100` slår dette op.

### 13.11 To repræsentationer for "hvilke klienter kan bookes her"

`location.bookable_client_ids: uuid[]` OG `location.can_book_eesy: bool, location.can_book_yousee: bool`. To-flag-modellen er hardkodet til netop disse to klienter. Sample-data viser at `bookable_client_ids` er den faktisk-brugte (`docs/system-snapshot.md:346295-346298`), men begge skal vedligeholdes.

### 13.12 Hotel-omkostning ignorerer nætter og rooms

`LocationProfitabilityContent.tsx:268-273`:
```ts
const cost = h.price_per_night || 0;
map.set(h.booking_id, (map.get(h.booking_id) || 0) + cost);
```

Det er `price_per_night` direkte, IKKE `price_per_night × (check_out - check_in) × rooms`. Det er hverken er en kommentar eller fix — beregning-koden tager bare et tal pr. række.

### 13.13 `booking_hotel.booked_days` parallelt med `check_in`/`check_out`

Et hotel har BÅDE et date-interval (check_in, check_out) OG et integer-array af bookede dage (`booked_days: integer[]`). To repræsentationer af samme info. Sample (`docs/system-snapshot.md:2462-2466`):
```
check_in: 2026-03-30, check_out: 2026-04-01, booked_days: [0,1]
```

Bortset fra at `[0,1]` er mandag-tirsdag og datoerne er en mandag til onsdag. Det er ikke åbenlyst at de hænger sammen.

### 13.14 `daily_rate_override` semantic uklart

`booking.daily_rate_override` numeric nullable. Hvis `total_price` er sat, bruger Billing-koden `total_price / days` i stedet. Hvis `daily_rate_override` er sat, bruges det. Hvis intet er sat, fald-back til `placement.daily_rate` eller `location.daily_rate`. Tre veje til samme info.

### 13.15 Faktureringstest-tabel: `supplier_invoice_reports.report_data` er en JSONB-snapshot

Rapporten gemmes som en bunke (`report_data` jsonb) plus aggregeret meta (`total_amount, discount_amount, final_amount`). Hvis en location senere ændrer navn eller pris, ændrer **rapport-snapshot ikke sig** — det er forsætligt en historisk record. Men der er heller ingen versions-/audit-trail på hvem ændrede rapporten.

### 13.16 `salary_types`-koblet diæt-beløb

`booking_diet.amount` er ikke automatisk lig `salary_type.amount` (samme tabel kan have forskellige diæt-beløb pr. række). UI tilbyder default-værdi fra `salary_type.amount` (300), men der er ingen DB-constraint at det skal være sådan.

### 13.17 FM-salg-RLS lader alle aktive medarbejdere se ALLE FM-salg

`sales.RLS "FM sellers can view all fieldmarketing sales"` policy:
```sql
USING ((source = 'fieldmarketing') AND (EXISTS (
  SELECT 1 FROM employee_master_data
  WHERE auth_user_id = auth.uid() AND is_active = true
)))
```

Enhver aktiv medarbejder kan se enhver FM-sælgers salg (kun source-filtrering). Det er bredere end TM-sales RLS.

### 13.18 `enrich_fm_sale` trigger har 3-trins fallback for kampagne — kun den første er deterministisk

`docs/system-snapshot.md:357981-358015` smart-matching:
1. Find booking på `fm_location_id` + dato → ta `booking.campaign_id` (deterministisk hvis booking findes)
2. Sammenlign `fm_product_name` med "gade" eller "marked" patterns → smart-match
3. Første campaign for client (`ORDER BY created_at ASC`) — non-deterministic for nye kunder uden eksplicit kampagne-flow

Sælgeren kan altså ende med wrong campaign mapping hvis booking ikke matcher eller produktnavn ikke har de hardkodede substrings.

### 13.19 To `vehicle_id`-felter på `vehicle_return_confirmation`

Felter: `booking_vehicle_id` (FK til `booking_vehicle`) OG `vehicle_id` direkte (FK til `vehicle`). Sample viser at den ene eller anden er sat — duplikeret reference. Ikke åbenlyst hvilken er kanonisk.

### 13.20 `notify-vehicle-returned` håndterer både DB-skrivning OG notifikation

Edge function laver både insert i `vehicle_return_confirmation`-tabel OG sender mail + SMS. Hvis email fejler, er insert allerede sket. Hvis insert fejler, sendes ingen notifikation. Single-transaction-håndtering eksisterer ikke.

### 13.21 Booking-rolle for ejer i SalesRegistration

`SalesRegistration.tsx:50, 122-141`. Hvis bruger er `position.name === "ejer"`, og hun ikke har egen booking i dag, kan hun vælge en booking fra dropdown. Ejer-bypass hardkodet på rolle-streng.

### 13.22 `vagt-flow/time-off` viser tom liste men eksisterer som menu

Permission-key `menu_fm_time_off` er aktiv. Side eksisterer. Hook læser fra død tabel. Set fra bruger er det en tom side hvor man kunne forvente fraværsanmodninger.

### 13.23 Static info-side: TravelExpenses

`/vagt-flow/travel-expenses` (217 linjer) er REN prosa-side med politik om rejsekort og diæter. INGEN database-interaktion. Reglerne er beskrevet i tekst — for diæter: "Du får 300 kr. pr. dag fra og med dag 2". Hardkodet UI-tekst — der er INGEN check eller automatik der håndhæver første-dag = 0 kr på `booking_diet.amount`. Sælgere kan se reglen, men oprettelse af diet-rækker er en separat handling i Bookings-siden uden disse begrænsninger.

### 13.24 Hardkodede satser og magic numbers

- **Diæt: 300 kr/dag** (i `TravelExpenses.tsx:168` og `salary_types`-tabel)
- **Oplæringsbonus: 750 kr** (per CLAUDE.md, hardkodet i helpers, ikke verificeret denne pass)
- **Feriepenge 12,5%** (`VACATION_PAY_RATES.SELLER = 0.125` i `vacation-pay.ts:18`)
- **Default `expected_staff_count = 2`** (`booking` DDL)
- **Default `cooldown_weeks = 4`** (`location` DDL)
- **Default `daily_rate = 1000`** (`location` DDL og final fallback i Billing)
- **Default `slot_duration_minutes = 15`** (`booking_settings` — for recruitment-booking, ikke FM)
- **Default `lookahead_days = 14`** (`booking_settings` — også recruitment)
- **Hardkodede klient-IDs**: `FIELDMARKETING_CLIENTS.EESY_FM = "9a92ea4c-..."` og `YOUSEE = "5011a7cd-..."` (`src/hooks/useFieldmarketingSales.ts:268-271`)
- **Hardkodet team-navn-pattern**: `ILIKE '%fieldmarketing%'` (mange steder for at finde FM-team)
- **Hardkodede location_types**: `["Coop butik", "Meny butik", "Danske Shoppingcentre", "Ocean Outdoor", "Markeder", "Messer", "Anden lokation"]` (`Billing.tsx:114`)
- **Hardkodet location_type-filter**: `MARKET_TYPES = ["Markeder", "Messer"]` i `BookingsContent.tsx:94`
- **Hardkodet job_title-pattern**: `'Fieldmarketing leder'`, `'Assisterende Teamleder FM'` i `is_vagt_admin_or_planner` SQL
- **Hardkodede storage-bucket**: `vehicle-return-photos`

### 13.25 Smart-matching i `enrich_fm_sale` er hardkodet til to ord

`'gade'` og `'marked'` (`docs/system-snapshot.md:358001-358015` — fuld body på linje 357981-358015 men trunkeret i snapshot, fuld body i pricing-rapport). To danske substrings hardkodet i PL/pgSQL-trigger. Stork har ikke et generisk udtryksbaseret system.

### 13.26 `process-booking-flow` cron-job er IKKE FM

CLAUDE.md nævner "process-booking-flow cron (hver 5. min)". Funktionen findes (`supabase/functions/process-booking-flow/index.ts`, 316 linjer) men er recruitment-relateret — den processerer `booking_flow_touchpoints` (rekrutterings-tabeller). Ingen FM-data berøres.

### 13.27 Ejer-bypass på role-name string

`SalesRegistration.tsx:50`:
```ts
const isOwner = position?.name?.toLowerCase() === "ejer";
```

Rolle-streng-sammenligning. Ny rolle med samme funktion ville kræve kode-ændring.

### 13.28 Drift mellem økonomi og løn for diæt

I `LocationProfitabilityContent.tsx`: alle `booking_diet`-rækker tæller som `dietCost` (inkl. oplæringsbonus). I `useSellerSalariesCached.ts`: oplæringsbonus separeres fra diæt via `salary_type_id`-filter. Samme rå data, to forskellige kategoriseringer afhængigt af hvor man ser den.

### 13.29 `mileage_report.RLS` checker `employee_id = auth.uid()`

Det betyder kun virker hvis mileage_report.employee_id IS `auth.users.id`. Men `employee_master_data.id` ER NORMALT IKKE `auth.users.id` — det er separate uuid'er linkjet via `auth_user_id`. Så medarbejdere kan ikke se egne mileage_reports korrekt. RLS-bug.

### 13.30 `fm_checklist_templates.one_time_date` — særlige one-time-opgaver

Skema understøtter både gentagne (`weekdays`-array) og one-time (`one_time_date`-felt). UI'et i `FmChecklistContent.tsx` skelner mellem dem.

### 13.31 To check_in-tider på `booking_hotel`

`check_in` (date) OG `check_in_time` (time). Booking gemmer datoen som date og tiden som separat felt. Tilsvarende `check_out`/`check_out_time`. Ingen DB-constraint at de skal hænge sammen.

### 13.32 `vehicle.license_plate` er UNIQUE — også for tomme strings?

Vehicle med `license_plate=""` (Greenmobility) eksisterer. UNIQUE-constraint på et nullable text-felt i Postgres tillader flere null-værdier, men UNIQUE på tom-string ville være kollideret. Faktisk-state ikke verificeret, men sample viser kun én tom.

---

## 14. Hvad jeg ikke har verificeret empirisk

- **Live cron-state for FM-relaterede jobs**: `send-checklist-daily-summary`, `send-supplier-report`, `notify-vehicle-returned` — alle eksisterer som funktioner. `update_checklist_email_cron`-RPC findes (`docs/system-snapshot.md:359933`) men jeg har ikke bekræftet at faktisk cron-job i pg_cron er aktiv.
- **Faktisk dato-matching i `cleanup_assignments_on_booked_days_change`**: Formlen `NEW.start_date + day_index` antager day_index 0 = mandag = start_date. Hvis start_date IKKE er en mandag, går regnestykket galt. Sample-bookings starter typisk mandage.
- **Hvor mange aktive FM-medarbejdere har `vagt_flow_role` udfyldt i `employee`-tabellen** (kun 3 rækker i samples — er det total eller subset?).
- **`mileage_report`-RLS-bugen om den faktisk afviser medarbejdere i prod**: kan ikke testes uden MCP-adgang.
- **Hvilken booking-status-overgange der faktisk sker i prod**: kun draft+confirmed observeret, men anden status kan eksistere.
- **Om `process-booking-flow`-cron faktisk er den eneste cron med "booking" i navnet** — kunne der være en separat FM-cron.

---

## 15. Resumé af sammenhænge

**FM-dag for en sælger:**
1. Logger ind → `vagt-flow/my-schedule` viser dagens vagt fra `booking_assignment` + booking → location/client/campaign + tildelt bil + tildelt hotel + diæt-beløb.
2. Møder op → trykker "på vej" → `on_my_way_at` opdateres på assignment.
3. Sælger et produkt → `/vagt-flow/sales-registration` → opretter `sales`-række med `source='fieldmarketing'` + `raw_payload.fm_*`.
4. `enrich_fm_sale`-trigger fylder `agent_email`, `agent_name`, `client_campaign_id` ind.
5. `create_fm_sale_items`-trigger opretter `sale_item` med pricing.
6. Slutter dagen → afleverer bil → trykker bekræft + foto → `notify-vehicle-returned` opretter `vehicle_return_confirmation` + sender mail/SMS.

**FM-uge for en leder:**
1. `/vagt-flow/book-week` → opretter bookings (`booking` + `booked_days` + `booking_assignment`).
2. `/vagt-flow/bookings` → administrerer bookings, tildeler bil + hotel + diæt + oplæringsbonus dag for dag.
3. Ved redigering: rematch-pricing-rules edge function kaldes ved sale-rettelser.

**FM-måned for backoffice:**
1. `/vagt-flow/billing` → genererer rapport pr. `location.type`.
2. Rabatregler (`supplier_discount_rules` + `supplier_location_exceptions`) → netto-beløb.
3. `send-supplier-report` → sender email + PDF til leverandør → `supplier_invoice_reports`-snapshot gemmes.
4. `fm_checklist_*` → daglig backoffice-tjekliste; resumé-email kl. 15-20.

**FM-løn:**
- Provision: `sale_items.mapped_commission` per FM-salg → `get_sales_aggregates_v2` (inkluderer FM).
- Diæt: `booking_diet.amount` filtreret på `salary_type != trainingBonusTypeId`.
- Oplæringsbonus: `booking_diet.amount` filtreret på `salary_type = trainingBonusTypeId`.
- Feriepenge: commission × 12,5%.
- Annullering-fradrag og andre poster: samme som TM (`useSellerSalariesCached.ts`).

