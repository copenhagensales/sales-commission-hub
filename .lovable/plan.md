## Mål

På `Rapporter Ledelse` → fanen `Rådata` (når klient = **Eesy FM**) skal hver række have to nye kolonner: **Kampagne** og **Lokation**. Samme to felter tilføjes til Excel-download (Rådata-arket).

For andre klienter (TM o.l.) er kolonnerne tomme — kun Eesy FM beriges.

## Datakilder

- **Kampagne:** `client_campaigns.name` via samme COALESCE-kæde som RPC'en allerede bruger til filtrering (`s.client_campaign_id` → `p2.client_campaign_id` → `acm.client_campaign_id`).
- **Lokation:** Ingen direkte FK fra `sales` til `booking`. Vi joiner via `booking_assignment` på medarbejder + dato:
  - `sales.agent_email` → `employee_master_data.work_email` → `employee_id`
  - `booking_assignment.employee_id = emd.id AND ba.date = (sale_datetime AT TIME ZONE 'Europe/Copenhagen')::date`
  - `booking.location_id → location.name`
  - Hvis flere assignments samme dag, foretrækkes den hvor `booking.campaign_id = sales.client_campaign_id`.

## Ændringer

### 1. DB-migration — opdatér `get_sales_report_raw`
Begge overloads (3-arg og 5-arg med limit/offset) returnerer to nye kolonner:
- `campaign_name text`
- `location_name text`

Logik tilføjes via `LEFT JOIN client_campaigns` på den samme COALESCE-id der allerede bruges, samt en `LEFT JOIN LATERAL` mod `booking_assignment` → `booking` → `location` for at hente lokationsnavn pr. salg.

### 2. Frontend — `src/pages/reports/RawSalesTable.tsx`
- Udvid `RawRow` med `campaign_name?: string | null` og `location_name?: string | null`.
- Tilføj to nye kolonner efter `Produkt`: **Kampagne** og **Lokation**.

### 3. Frontend — `src/pages/reports/ReportsManagement.tsx`
- I `handleExport` udvides `rawRows`-mappingen med `Kampagne` og `Lokation`.
- Justér `columnWidths` for Rådata-arket (2 ekstra felter).

## Zone

Gul zone (rapport + RPC). Ingen ændringer i pricing, løn, RLS eller skema på `sales`/`sale_items`.

## Verifikation

- Kør RPC mod Eesy FM, periode 15/4–14/5, og bekræft at FM-rækker har lokation + kampagne udfyldt.
- Tjek at TM-klienter stadig returnerer rækker uden fejl (tomme felter).
- Tjek Excel-download: de to nye kolonner findes i Rådata-arket.
