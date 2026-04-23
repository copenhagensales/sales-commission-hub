

# Logik-rapport: Storks Logikker

## Hvad jeg har fundet ud af om formatet

`sales_ownership` er ikke en hardkodet side — det er **én række i tabellen `public.kpi_definitions`** der renderes generisk. Skema:

| Felt | Type | Eksempel |
|---|---|---|
| `slug` | text | `sales_ownership` |
| `name` | text | `Salgsejer (Attribution)` |
| `category` | text | `sales` |
| `description` | text | 1-2 sætninger |
| `calculation_formula` | text | step-by-step pseudokode (multi-line) |
| `sql_query` | text | reference SQL |
| `data_sources` | text[] | tabel-/RPC-navne |
| `important_notes` | text[] | bullet-liste |
| `example_value` | text | konkret scenarie |
| `dashboard_slugs` | text[] | hvor logikken vises |
| `is_active` | bool | |

Tabellen indeholder allerede 60 rækker (mest KPI-tællere). `sales_ownership` er den eneste rigtige "logik-dokumentation". Jeg vil derfor lave dokumentet i nøjagtigt dette format, så hver logik direkte kan blive til en INSERT senere uden konvertering.

## Hvad jeg leverer

**Ét markdown-dokument**: `storks-logikker.md` (skrives til `/mnt/documents/`).

Hver logik formateres sådan her:

```markdown
### N. Pricing-motor (TM) — `tm_pricing`

- **Kategori:** pricing
- **Beskrivelse:** ...
- **Beregningsformel:**
  1. ...
  2. ...
- **SQL Query (reference):**
  ```sql
  ...
  ```
- **Datakilder:** `tabel1`, `tabel2`, `rpc_x`
- **Vigtige noter:**
  - ...
  - ...
- **Eksempelværdi:** ...
- **Status:** OK / USIKKER / ROD (med kort forklaring hvis ikke OK)
```

## Logikker jeg vil dokumentere

### Fase 1 — Kerne-økonomi (7)
1. `tm_pricing` — Pricing-motor (TM)
2. `fm_pricing` — Pricing-motor (FM, kampagne-aware)
3. `commission_calculation` — Provision pr. sælger fra sale_items
4. `seller_salary` — Sælger-løn (provision + grundløn + diæter + tillæg + feriepenge + annulleringer + rollover)
5. `team_leader_salary` — Leder-løn baseret på team-DB
6. `staff_assistant_salary` — Assistent/stab-løn (timer × sats eller proration)
7. `cancellation_deduction` — Annullering, deduction_date, rollover-ved-stop, leder-DB-beskyttelse

### Fase 2 — Attribution & tilhørsforhold (5)
8. `sales_ownership` — verificeret/opdateret version af eksisterende række
9. `team_client_ownership` — `team_clients` UNIQUE(client_id), ikke team_members
10. `employee_client_assignments` — adgang + primær klient + change-log
11. `fm_dual_path_attribution` — CS Top 20 fallback-logik
12. `revenue_match_validation` — månedlig e-conomic afstemning

### Fase 3 — Permission & rolle (3)
13. `permission_resolution` — login → page-adgang
14. `role_inheritance_priority` — 10 roller, 10→5 RLS-collapse, priority
15. `team_role_employee_matrix` — samspil mellem de tre dimensioner

### Fase 4 — Tid & låsning (3)
16. `payroll_period_15_14` — definition og (manglende) DB-låsning
17. `timezone_handling` — sale_datetime og midnatsgrænser
18. `immutable_data_tables` — INSERT-only-konvention og hvor den håndhæves

### Fase 5 — Klient-specifikke (4)
19. `ase_immediate_payment` — 400/1000 kr.-regler
20. `eesy_cancellation_matching` — 8 telefon-felter, opp_group
21. `tdc_opp_duplicate_detection` — DuplicatesTab
22. `client_specific_pricing_overrides` — Relatel/Eesy uden effective_from, kampagne-fallbacks, Tilskud, DSC-tier-rabat

### Fase 6 — Integration (3)
23. `adversus_pipeline` — webhook → enrichment → triggers → sale_items
24. `enreach_pipeline` — auth, rate limit, attribution-fallback
25. `economic_integration` — invoice-sync, Revenue Match, Sales Validation

### Fase 7 — Cross-cutting (3)
26. `cache_invalidation` — QUERY_KEYS_TO_INVALIDATE + mg-test-sync
27. `gdpr_data_cleanup` — hvilke tabeller renses/bevares
28. `audit_trails` — AMO/contract/sensitive-data audit

**I alt: 28 logikker.**

## Markeringer jeg vil bruge

- **OK** — solid bygger-viden, verificerbar i kode/DB
- **USIKKER** — markeret hvor jeg mangler verifikation; jeg skriver hvad jeg ville tjekke
- **ROD** — logik der ikke er bevidst designet (fx pricing-tie-breaker uden sekundær sortering, dobbelt sandhed for job-title→role)

## Sikkerhedsregler jeg respekterer

- Læser kun kode/DB — ingen ændringer
- Eksekverer ingen scripts mod prod
- Skriver kun til `/mnt/documents/storks-logikker.md`
- Ingen løsningsforslag, anbefalinger eller arkitekturforslag — kun beskrivelse
- Markerer "rod" hvor det er rod, men foreslår ikke fix

## Estimeret omfang

~15.000-20.000 ord. Ét dokument. Indholdsfortegnelse øverst. Hver logik ~400-700 ord afhængig af kompleksitet (Fase 1 + 13 + 16 får mest plads).

## Hvad jeg IKKE dokumenterer (med begrundelse)

- **`product_campaign_overrides`-mekanismen** som selvstændig logik — den er halv-død (læses ikke af pricing-motoren). Jeg nævner den i `tm_pricing` under "Vigtige noter / kendt rod" i stedet, fordi en selvstændig "logik"-dokumentation ville suggere at den fungerer.
- **Feature flags** som logik — det er en mekanisme, ikke en forretningsregel. Nævnes hvor relevant.
- **Sidebar Menu Editor** — UI-konfiguration, ikke forretningslogik.

Hvis I vil have nogen af disse alligevel, så sig til.

## Bekræft før jeg starter

Skal jeg:
- **A.** Køre planen som beskrevet (28 logikker, ét dokument, ~15-20k ord)
- **B.** Stramme til Fase 1-3 først (15 logikker), levere dem grundigt, og vente med Fase 4-7
- **C.** Tilføje/fjerne noget fra listen før jeg starter

