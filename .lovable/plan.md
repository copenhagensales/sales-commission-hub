## Hvad jeg fandt på tværs af Eesy FM + Yousee FM

Kørt en sammenligning af `mapped_commission` på alle FM sale_items siden 15/5 mod den kampagne-specifikke regel der burde have matchet (`adversus_campaign_mappings` → `product_pricing_rules`).

**Resultat:**

| Kampagne | Items med forkert pris | Samlet overbetaling |
|---|---|---|
| Eesy marked | **395** | **25.675 kr** |
| Eesy gaden | 0 | 0 |
| eesy FM Gaden Products | 0 | 0 |
| Yousee gaden | 0 | 0 |

Yousee gaden har ingen kampagne-specifikke regler (priser = base 440 kr på alle Fri-produkter) — derfor intet problem dér.

Eesy gaden har regler der koincidentielt = base-pris (360/450) — derfor heller intet problem.

**Eesy marked er den eneste kampagne hvor de specifikke regler er LAVERE end base**, og det er præcis dér overbetalingen sker. Top 5 ramte sælgere:

| Sælger | Overbetaling |
|---|---|
| mech@ (Melissa) | 5.395 kr |
| saro@ | 4.485 kr |
| jubj@ | 2.275 kr |
| thes@ (Theo) | 1.885 kr |
| nore@ | 1.820 kr |

(+ ~20 andre sælgere med mindre beløb)

## Spor A — Rematch (fjerner overbetalingen)

Kald `rematch-pricing-rules` edge function målrettet de 395 ramte sale_items. Tre måder at scope det på (vælger den sidste — mest sikker):

1. ❌ Hele lønperioden 15/5+ — for stort scope, ramler i `WORKER_RESOURCE_LIMIT` som vi så tidligere.
2. ❌ Hele FM-source 15/5+ — stadig for stort.
3. ✅ **Eksplicit liste af de 395 `sale_item_ids` jeg har identificeret** — sender dem i batches af 100 via `body.sale_item_ids` til edge function. Hurtig, deterministisk, ingen risiko for at røre andet.

Efter kørsel: re-verificér med samme diff-query → forventer 0 mispriced items, 0 kr overpayment.

## Spor B — Root cause + permanent fix

**Symptom:** `create_fm_sale_items`-triggeren har korrekt SQL til at slå kampagne-specifik regel op via `adversus_campaign_mappings`, men i praksis lander Eesy marked-salg konsekvent på base-pris. Data + timestamps udelukker at `client_campaign_id` blev opdateret efter insert. Det skal afdækkes i isoleret test (jeg har ikke kunnet reproducere fra data alene), men selve fix'et er ikke afhængigt af root cause:

**Fix (defense in depth — virker uanset root cause):**

1. **Skriv `matched_pricing_rule_id` ind på sale_item** i både `create_fm_sale_items` og `heal_fm_missing_sale_items`. I dag sættes feltet aldrig for FM-salg → vi kan ikke se hvilken regel der vandt → bug bliver usynlig. Med ID'et på plads bliver enhver fremtidig mismatch synlig i én SQL.

2. **Tilføj en `assert`-blok i `create_fm_sale_items`** der logger en `integration_logs` warning HVIS `client_campaign_id` har en `adversus_campaign_mapping`-row OG der findes en aktiv regel for produktet + mapping, men `v_rule_commission` alligevel kommer ud som NULL. Det vil fange root cause første gang det sker igen.

3. **Daglig integritets-check (cron, 30 min efter midnat):** Kør samme diff-query jeg brugte ovenfor mod sidste 24t FM-salg. Send Slack/email til Mathias hvis mispriced items > 0. Stopper at en lignende bug forsvinder ind i lønkørslen.

4. **(Valgfrit) Hård validering før løn:** Tilføj knap "Tjek FM-pricing-integritet" på Cancellations/Salary-siden der kører diff-query for lønperioden og blokerer eksport hvis afvigelser findes.

## Rækkefølge og scope

1. Spor A: rematch 395 items (read-only edge function call, ingen migration).
2. Spor B trin 1+2: migration der ændrer `create_fm_sale_items` + `heal_fm_missing_sale_items` (RØD ZONE — pricing-motor. Beder dig bekræfte før den køres).
3. Spor B trin 3: ny edge function `fm-pricing-integrity-check` + cron-job.
4. Spor B trin 4: UI-knap (kan vente til efter trin 1-3 har stabiliseret sig).

## Røde flag / bekræft før implementering

- **Bekræft 295/385 kr ER de korrekte Eesy marked-priser** (du har bekræftet logikken tidligere — men de gælder altså bagudrettet for HELE lønperioden 15/5+, ikke kun fra i dag).
- **Melissa-attribution (sælger-dropdown bug) er IKKE inkluderet i denne plan** — Spor B her løser kun pricing. Hvem-registrerede-salget er en separat sag og afventer din beslutning.
- Spor B trin 1 rører pricing-motoren (rød zone). Ramme-aftalen fra de seneste kasser dækker ikke FM-triggere — beder eksplicit om go før jeg deployer migrationen.

Klar til at gå i gang når du siger go. Hvis du kun vil have Spor A nu og udskyde Spor B, siger du bare det.