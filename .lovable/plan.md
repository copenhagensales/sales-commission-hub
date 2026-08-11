# Tilmelding til Superligaen sker automatisk ved første salg

I stedet for at auto-tilmelde ud fra jobtitel (som i dag i `league-calculate-standings`) bliver man tilmeldt i det øjeblik man lægger sit første salg op i sæsonen. Det giver kun aktive deltagere, og der skal ikke længere skelnes mellem stab og medarbejdere.

## Sådan virker det

- Nyt salg registreres → sælgeren tilmeldes automatisk den aktive sæson (kvalifikation eller igangværende), hvis han ikke allerede er tilmeldt.
- Ingen filtrering på jobtitel eller team. Alle der sælger, deltager.
- Har man selv afmeldt sig eller er sat som fan, bliver man **ikke** tvunget tilbage — eksisterende tilmeldinger røres ikke.
- Ingen salg = ingen tilmelding. Man kan fortsat tilmelde sig selv manuelt via knappen på ligasiden.

## Backfill nu

Alle med salg **i går (10/8) og i dag (11/8)** tilmeldes med det samme. Det er 55 unikke sælger-mails i den periode, hvoraf 51 kan kobles direkte til en medarbejder. De sidste 4 mails mangler kobling til en medarbejder — de rapporteres i loggen, så koblingen kan rettes, og de tilmeldes automatisk ved næste salg.

## Oprydning af gamle auto-tilmeldinger

Sæson 4 har lige nu 114 tilmeldinger, som alle er oprettet automatisk af cron-kørslen i dag (11/8 kl. 10:58–11:09) ud fra jobtitel-reglen — ingen af dem er manuelle.

Ved implementeringen slettes de tilmeldinger i Sæson 4, der:
- er oprettet af den gamle automatik (før implementeringstidspunktet), og
- ikke har salg i sæsonens periode (fra 10/8).

Alt der oprettes af den nye salgs-trigger eller manuelt bagefter, står urørt. Tilmeldinger fra tidligere, afsluttede sæsoner røres ikke — historikken bevares.



## Teknisk

1. **Ingen ny mail-kobling.** Vi genbruger præcis den kobling systemet allerede bruger i rapporter og ligastillinger (`get_sales_aggregates_v2`): `agents.email` → `employee_agent_mapping` → medarbejder, med fallback til `employee_master_data.work_email`. Kan et salg ikke kobles i dag, kan det heller ikke tilmeldes — det logges, intet nyt matchningslag opfindes.

2. **Databasetrigger** `AFTER INSERT ON public.sales` → `public.league_enroll_on_sale()` (SECURITY DEFINER, `set search_path = public`):
   - finder aktiv sæson (`status in ('qualification','active')`) hvor salgets dato ligger inden for sæsonens periode
   - løser `agent_email` til `employee_id`
   - `INSERT ... ON CONFLICT (employee_id, season_id) DO NOTHING` med `is_active = true`, `is_spectator = false`
   - fejler aldrig salgsindsættelsen: hele kroppen pakkes i `EXCEPTION WHEN OTHERS THEN RETURN NEW`
3. **Backfill-funktion** `public.league_enroll_from_sales(p_season_id uuid, p_from timestamptz)` — samme indsættelseslogik kørt over eksisterende salg. Kaldes én gang for Sæson 4 fra 10/8.
4. **`league-calculate-standings`**: `syncLeagueEnrollments()` (jobtitel-baseret) erstattes af et kald til `league_enroll_from_sales` for sæsonens periode, så cron-kørslen samler op, hvis en trigger-indsættelse skulle fejle. `_shared/leagueEligibility.ts` bliver ubrugt her og fjernes fra kaldstedet.
5. **Ligasiden** (`CommissionLeague.tsx`): landingsteksten opdateres til at forklare, at man tilmeldes automatisk ved første salg. Manuel tilmeldingsknap bevares.

Zone: rød (SECURITY DEFINER + trigger på `sales`). Trigger er ren tilføjelse; den ændrer ikke salgsdata, pricing eller løn.
