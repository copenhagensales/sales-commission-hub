
## To separate opgaver

### Opgave A — Mappe Alka Erhverv-kampagner (Enreach)

Der kommer allerede AE_-salg ind via Enreach, men de er umappede og lander med `source='tryg'`. Skal mappes til klient **ALKA** som fire separate kampagner (samme mønster som TDC), så vi kan differentiere provision/omsætning.

**Trin (gøres i MgTest — ingen kodeændringer):**

1. Under klient **ALKA**, opret fire kampagner:
   - `Borsen`
   - `Kanvas`
   - `Permission`
   - `1 police`
2. I **Adversus Campaign Mappings**, sæt `client_campaign_id` på hver af de fire eksisterende mapping-rækker:
   - `AE_Borsen` → ALKA / Borsen
   - `AE_Kanvas` → ALKA / Kanvas
   - `AE_permision` → ALKA / Permission
   - `AE_1_police` → ALKA / 1 police
3. Under hver af de fire kampagner: opret produkterne med korrekt `commission_dkk` + `revenue_dkk`.
4. (Anbefalet) Kør **rematch-pricing-rules** for AE_-kampagnerne så historiske salg får den rette pricing pålagt — ellers gælder ny pricing kun for nye salg.

Efter mapping: nye AE_-salg lander automatisk på ALKA i alle dashboards, personlig løn og team-rapporter.

**Åbent spørgsmål:** Skal historiske AE_-salg (dem der p.t. står som `source='tryg'`) omdirigeres til ALKA, eller kun nye fra i dag? Kan gøres via et engangsscript, men er en RØD ZONE-ændring på historiske data — kræver eksplicit godkendelse.

---

### Opgave B — "Tast selv salg" (kun Lederne)

Lederne har intet API og oprettes fra bunden. Ny side hvor team United kan taste manuelt.

**Trin 1 — Data (dig, én gang i MgTest):**
- Opret klient **Lederne** + kampagne **Standard**
- Opret produkter under Lederne/Standard med korrekt `commission_dkk` + `revenue_dkk`

**Trin 2 — Ny side:**

- **Route:** `/tast-selv-salg`
- **Sidebar:** "Tast selv salg" — synlig kun for team United (+ globalAccess)
- **Formular:**
  - Produkt (dropdown fra `products` under Lederne/Standard)
  - Kundens telefonnummer
  - Salgstidspunkt (default = nu)
  - Knap: "Registrér salg" → nulstiller
- **Under formularen:** Sælgerens **egne Lederne-salg** i dag/denne uge (produkt, tlf, tid)

**Data-flow (identisk med Eesy FM):**
1. `sales`: `source='manual_entry'`, `integration_type='manual'`, `client_campaign_id`=Lederne/Standard, `agent_email`/`agent_name` fra logget-ind bruger, `customer_phone`, `sale_datetime`, `validation_status='pending'`
2. `sale_items`: `product_id`, `quantity=1`, `mapped_commission_dkk`/`mapped_revenue_dkk` fra `products`
3. Indgår automatisk i `get_sales_aggregates_v2`

**Filer:**
- **Ny:** `src/pages/TastSelvSalg.tsx`
- **Ny:** `src/hooks/useLederneSales.ts` (list egne + create)
- **Ny:** `src/config/manualEntryCampaign.ts` (holder Lederne/Standard `client_campaign_id` — nemt at udvide senere)
- **Ændret:** `src/routes/pages.ts` + `src/routes/config.tsx` (route + team United-guard)
- **Ændret:** sidebar-menu (`sidebar_menu_config` / `AppSidebar`)
- **Ingen DB-migrations.**

---

## Rækkefølge

1. Du opretter Alka-kampagner + produkter og mapper AE_-kampagnerne i MgTest.
2. Du beslutter om historiske AE_-salg skal omdirigeres (opgave A, åbent spørgsmål).
3. Du opretter Lederne-klient/kampagne/produkter i MgTest.
4. Jeg bygger "Tast selv salg"-siden med Lederne/Standard-id hardkodet i configfilen.

## Bekræftelse efter byg (opgave B)

1. Log ind som United-medarbejder → "Tast selv salg" synlig i sidebar.
2. Registrér testsalg → dukker op i personlig løn/dashboards med korrekt provision/omsætning under Lederne.
