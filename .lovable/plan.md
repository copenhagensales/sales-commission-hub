## Diagnose

De 3 salg du rettede for Julie Bonde Jensen 2/7 kl. 10:54 (phones 42264270, 51298175, 51859861, kampagne "Eesy gaden", produkt "Eesy uden første måned (Nuuday)") har korrekt opdateret `raw_payload.fm_product_name` = "Eesy uden første måned (Nuuday)", MEN deres `sale_items`-rækker er slettet og ikke genskabt. Derfor viser UI 0 kr i provi/oms — det er kun disse 3, der mangler.

De øvrige 9 salg samme dag har intakte `sale_items` med korrekt 360 kr / 1000 kr og er ikke rørt.

## Fix (kirurgisk — kun de 3 salg)

Kør DB-funktionen `heal_fm_missing_sale_items` scoped til de 3 sale-id'er:

- `2ec6bfa0-6de7-4e05-b154-73f2c746b3c3`
- `227f423c-045d-4dd3-89d6-d6def878debb`
- `33323090-7876-4c77-8239-acc26e14f49b`

Funktionen findes allerede (`enrich_fm_sale` / `create_fm_sale_items` / `heal_fm_missing_sale_items`) og bruges netop til at genskabe manglende FM sale_items ud fra `raw_payload` og pricing-motoren. Den rører ikke andre salg.

## Verifikation

Efter kørsel: tjek at de 3 sale_items eksisterer med `mapped_commission=360`, `mapped_revenue=1000` og produkt "Eesy uden første måned (Nuuday)" — samme værdier som de andre 9 salg samme dag. Bekræft i UI at Julies totaler for 2/7 nu viser fuld provi/oms inkl. de 3.

## Rod-årsag (rapporteres, fixes ikke i denne omgang)

FM-redigeringsflowet sletter tilsyneladende `sale_items` uden at genkalde `create_fm_sale_items` når produktnavn ændres. Det er den underliggende bug og ligger i rød zone (pricing/lønberegning) — bør fixes separat med eksplicit godkendelse, ikke bundlet med denne hotfix.

## Scope

- Ingen kodeændringer.
- Ingen ændring af de øvrige 9 salg.
- Ét kald til `heal_fm_missing_sale_items` med de 3 sale-id'er.
- Én commit-fri hotfix (data-only).
