# Lederne: hvorfor står alle salg stadig til 75 kr

## Svaret

Nej, ingen af salgene er kommet ind med 30/90 kr. Alle 266 Lederne-salg siden 7. september står på basissatsen 75 kr provision / 200 kr omsætning, og ingen af dem har en prisregel påhæftet.

Årsagen er ikke reglerne og ikke prismotoren:

- Begge regler findes og er aktive fra 7. september: Telefonmøde 30 kr (prioritet 1), Onlinemøde 90 kr (prioritet 0), 200 kr omsætning på begge.
- Importen læser kolonnen og gemmer mødetypen på salget, hvis der står en værdi.
- Men på samtlige 266 salg er mødetypen slet ikke gemt — feltet mangler helt på salget, også på de 45 salg fra i dag.

Systemet gemmer kun mødetypen, når der faktisk står en værdi i den kolonne, den kan finde. Når feltet mangler på hvert enkelt salg, betyder det, at de uploadede ark ikke har haft en mødetype-værdi med — enten fordi kolonnen ikke blev trukket med ud af Adversus, eller fordi den hedder noget andet end de navne importen genkender i dag (Mødetype, Modetype, Type møde, Hvilket type møde). Uden arket kan jeg ikke afgøre hvilken af de to det er. Uden mødetype falder salget korrekt tilbage på 75 kr — det er den forventede opførsel, ikke en fejl i beregningen.

## Forslag til hvad vi gør

1. **Find den præcise årsag.** Du sender (eller uploader) et af dagens ark, så jeg kan se de faktiske kolonnenavne. Det afgør endeligt om kolonnen mangler eller hedder noget andet.
2. **Synlig kontrol i Bulk Salg.** Efter "Kontrollér" vises hvor mange rækker der har en mødetype, og en tydelig advarsel hvis ingen rækker har det. Så bliver det opdaget før import i stedet for bagefter i lønnen.
3. **Eventuel efterregulering.** Hvis de allerede importerede salg skal have de rigtige satser, kræver det, at mødetypen kan genfindes pr. salg (via Emne-ID mod et ark med mødetype). Det laves som et selvstændigt, godkendt trin med før/efter-visning — ikke i denne omgang.

## Teknisk

- Verificeret read-only: `product_pricing_rules` har de to aktive regler på produkt `900fd5ad…`; `sale_items.matched_pricing_rule_id` er NULL på alle 266 linjer; `sales.raw_payload->'data'->>'Hvilket type møde'` er NULL på alle 266.
- `supabase/functions/manual-sales/index.ts:346,421` gemmer kun `data: { "Hvilket type møde": … }` når værdien er ikke-tom — konsistent med observationen.
- Punkt 2 rører kun `src/pages/TastSelvSalg.tsx` (visning af tælling/advarsel efter tørkørsel). Ingen ændring i prismotor, `manual-sales`, skema, RLS eller eksisterende salg.
- Punkt 3 er rød zone (provisionsgrundlag) og udføres først efter separat godkendelse.
