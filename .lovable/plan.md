# Fix: Switch Krydssalg bruger forkerte (gamle) provisionsregler

## Diagnose (evidens fra DB)

- `Cph Sales - Google` = `bbac6432-8704-4289-9bf3-0be19849f766`
- `CPH Sales - Switch Krydssalgs kampagne` = `2a7318af-bb43-4db2-bc39-597c9cc14aaa`
- I `product_pricing_rules` (aktive, `campaign_match_mode = 'include'`) er Switch knyttet til væsentligt flere regler end Google — fx 4 regler pr. Switch Unlimited-variant vs. 1 for Google, samt `+ Router`/`#2-#4`-varianter hvor kun Switch er med. Det er rester fra den gamle særopsætning.
- Eksempel: regel `3f4758fa-…` (MBB 1000GB ATL, prov. 1035, kun Switch) vs. den fælles regel `163d5ac5-…` (samme produkt, prov. 1185, ~90 kampagner inkl. Google men IKKE Switch).
- Konsekvens: pricing-motoren rammer den gamle Switch-specifikke regel før den fælles. Tilskuds-%'en er hardcodet i delt kode uden Switch-branch, så når reglerne spejles, arver Switch automatisk de 20 % via samme kodevej som Google. ✅

## Mål

Switch Krydssalg skal have **præcis** samme aktive provisionsregler som Google.

## Fix (data-migration, ingen kodeændring)

På `product_pricing_rules` (kun `is_active = true`):

1. **Fjern** Switch-id'et fra `campaign_mapping_ids` på alle regler hvor Google-id'et IKKE er med.
2. **Tilføj** Switch-id'et til `campaign_mapping_ids` på alle regler hvor Google-id'et ER med men Switch ikke er.
3. **Slet ingen** regel-rækker — gamle Switch-only regler bevares uden Switch-id, så historik og evt. brug i andre kampagner ikke ødelægges.
4. **Skriv historik** til `pricing_rule_history` for hver ændret regel (audit-krav).

Derefter:

5. **Rematch fra 15. maj 2026** (indeværende lønperiode) for Switch-kampagnen via `rematch-pricing-rules` edge function. Opdaterer `sale_items.mapped_commission` / `mapped_revenue` for allerede registrerede Switch-salg i perioden.
6. **Broadcast** cache-invalidation på `mg-test-sync` så MgTest/dashboards opdateres på tværs af sessions.

## Verifikation

- SQL-diff pr. aktivt produkt: regelmængden filtreret på Switch-id skal være identisk med regelmængden filtreret på Google-id.
- Stikprøve på 3 nylige Switch-salg (MBB, Switch Unlimited, Omstillingsbruger) fra 15. maj — i dag: bekræft `mapped_commission`/`mapped_revenue` matcher Google-reglens værdier, og at tilskud beregnes med 20 %.
- Tjek i MgTest → Pricing Rules at Switch står på samme regler som Google.

## Zone

Rød zone (`product_pricing_rules` + `pricing_rule_history` + rematch). Ingen kodefiler røres. `product_campaign_overrides` røres ikke.
