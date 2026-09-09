# OPP-nr. og Sales ID på persondata-positivlisten

## Trin 0 — svar, med evidens fra basen

**1. Udfyldes de strukturerede kolonner ved ingestion?**
Nej. Kolonnerne heder `sales.external_reference_number` og `sales.external_sales_id` (tilføjet 9/9/2026). De er **tomme i hele basen**: 0 udfyldte af 62.901 salg. Ingestion (dialer-webhook, integration-engine, sync-adversus) skriver OPP-nummeret ned i `raw_payload` — dels som `legacy_opp_number` (1.873 rækker), dels i `leadResultFields` / `leadResultData`. De to kolonner skrives i dag **udelukkende af oprydningsjobbet på fristen** (`gdpr-data-cleanup`, linje 394-414), som bevaringsskridt netop før `raw_payload` sættes til null.

Konsekvens: opgavens præmis om at felterne "bevares i de strukturerede kolonner" er ikke virkelighed endnu — bevaringsskridtet er bygget, men har ikke kørt på salg. Den rigtige ændring er derfor at **fjerne bevaringsskridtet** i stedet for at tilføje en sletning af felter der aldrig blev fyldt. Rapporterne læser fortsat OPP direkte fra `raw_payload` via `get_sales_report_raw`, og fordi `raw_payload` allerede nulles på fristen, forsvinder OPP automatisk ved anonymisering, når bevaringsskridtet fjernes.

**2. Er TDC's OPP-gruppe lig med OPP-nr.?**
Ja. `cancellation_queue.opp_group` er en direkte kopi af salgets OPP-nummer (`UploadCancellationsTab.tsx:2420`: `opp_group: sale.oppNumber`), og TDC-matchet grupperer på netop den nøgle (`ApprovalQueueTab.tsx:668-673`). Derudover ligger OPP i `cancellation_queue.uploaded_data` under nøglen `OPP-nr.` (143 rækker). Begge steder skal med i samme behandling. I dag er 143 af 2.277 køposter OPP-mærkede, og **0** af dem hører til et salg der er forbi fristen.

**3. Constraints?**
Ingen. `pg_constraint` har ingen NOT NULL/unique/FK på nogen af de to kolonner, og begge er nullable. `opp_group` er også nullable. Der er derfor ingen grund til at overskrive med et internt id — felterne kan sættes til `NULL`.

## Trin 1 — rapporterne

Alle læsninger af OPP/Sales ID er fundet:

| Sted | Type | Handling |
|---|---|---|
| `get_sales_report_raw` (2 varianter) → `adversus_opp_number` fra `raw_payload` | vises til mennesker (b) | uændret; bliver tom efter fristen fordi `raw_payload` nulles |
| `RawSalesTable.tsx:113`, `ReportsManagement.tsx:206` (Excel-eksport) | vises/eksporteres (b) | viser "Anonymiseret" i stedet for blank, når salget er forbi fristen |
| TDC-annulleringsmatch via `opp_group` (`ApprovalQueueTab`, `ApprovedTab`, `UploadCancellationsTab`) | grupperingsnøgle (a) inden for vinduet | uændret — matchet sker kun på salg inden for fristen |
| `sale_items.raw_data` | 0 forekomster af OPP | ingen handling |
| `fieldmarketing_sales`, `eesy_fm_powerbi_rows`, `adversus_events` | ingen OPP-/Sales-ID-kolonner (kun `phone`, `comment`, `payload`) | `adversus_events` slettes fortsat efter 90 dage; ingen ny feltbehandling |

Ingen rapport tæller, grupperer eller sammenligner på de eksterne id'er. Trin 1 kræver derfor ingen omlægning til internt salgs-id — kun tekstvisningen ovenfor.

## Trin 2 — feltklassifikation

- `opp_nr` og `sales_id` registreres i `data_field_definitions` som PII med frist = kampagnens retention (ingen selvstændig dags-værdi; oprydningen bruger kampagnepolitikken, som `customer_phone` gør i dag).
- Positivlisten i `_shared/gdpr-sales-privacy.ts` udvides: OPP- og Sales-ID-nøgler tilføjes til både `NORMALIZED_IDENTITY_KEYS` og `CANCELLATION_IDENTITY_KEYS` (`OPP-nr.`, `OPP nr`, `OPP-nr`, `Sales ID`, `SalesID`).
- Gælder alle 23 aktive kampagnepolitikker, inkl. TDC Erhverv.

## Trin 3 — oprydningsmotoren

I `gdpr-data-cleanup`:
1. Bevaringsskridtet (linje 394-414 + `extractOppNumber` / `extractSalesId`-kaldene) fjernes.
2. Patchen på fristen sætter `external_reference_number = null` og `external_sales_id = null` sammen med `customer_phone` og `raw_payload` — samme opdatering, samme række.
3. `cancellation_queue` for udløbne salg: `opp_group = null` og nøglen `OPP-nr.` fjernes fra `uploaded_data`.
4. `gdpr_cleanup_log` får én linje per felt per tabel (fx `anonymize_sales_external_reference_number`, `anonymize_cancellation_queue_opp_group`).
5. Ingestion røres ikke.

## Trin 4 — engangsbackfill (bygges, køres ikke)

Separat batch med `dry_run`, der finder salg forbi fristen med udfyldte OPP-/Sales-ID-felter (kolonner, `normalized_data`, `cancellation_queue`). Nuværende status fra basen: 0 rækker i kolonnerne, 0 udløbne køposter med `opp_group` — backfillen har reelt intet at rette, men bygges som sikkerhedsnet. Kører ikke uden Kaspers godkendelse.

## Trin 5 — verifikation

Dry run på den nye fristlogik. Udløbne salg pr. kampagne i dag (frist beregnet nu):

| Kampagne | Udløbne salg | Heraf med payload | Heraf med OPP i payload |
|---|---|---|---|
| Finansforbundet | 5.408 | 3.866 | 0 |
| Tryg | 4.674 | 4.674 | 0 |
| Eesy gaden | 3.585 | 3.585 | 0 |
| Eesy TM | 2.340 | 2.340 | 0 |
| ASE | 2.038 | 2.037 | 0 |
| TDC Erhverv | 1.629 | 1.091 | 1.091 |
| Øvrige (7 kampagner) | 2.509 | 2.356 | 0 |

Efter aktivering: forespørgsel der viser 0 ikke-tomme `external_reference_number`, `external_sales_id`, OPP i `normalized_data` og `opp_group` på salg forbi fristen. Resultatet fremvises.

## Afgrænsning

Rører ikke provision, mapping, pricing, dashboards, RLS eller kampagnepolitikkerne. Oprydningsjobbet kører fortsat kun med `GDPR_CRON_TOKEN`/ejer.
