# Mødetype-provision på Lederne (bulk salg)

## Kort svar
Nej — ikke alene. To regler på Lederne-produktet er den rigtige *halve* løsning, men de vil ikke få nogen effekt, som systemet ser ud nu. To ting mangler:

1. **Mødetypen bliver ikke gemt.** Bulk-uploaden læser kun 6 kolonner (Mobil, Kampagne, Sidst kontaktet af, Status, Emne-ID, Sidste kontakttidspunkt). Kolonne G "Mødetype" kastes væk, så en regel har intet at matche på.
2. **Bulk-salg bruger ikke prissætningsreglerne.** Ved import sættes provision og omsætning direkte fra produktets grundpris (`products.commission_dkk` / `revenue_dkk`). Prissætningsreglerne bliver aldrig kigget på for manuelle salg. Lederne har i øvrigt i dag 0 regler.

Verificeret: dit ark har kolonnen `Mødetype` med værdierne `Onlinemøde` / `Telefonmøde`; importen i `supabase/functions/manual-sales/index.ts` (linje 235-245 og 404-432) læser den ikke og prissætter fra grundprisen.

## Løsning
Vi lukker de to huller, så din plan derefter virker præcis som du forestiller dig — regler oprettes og vedligeholdes i MG test, ikke i kode.

1. **Læs kolonne G med.** Bulk-uploaden læser "Mødetype" og sender den med til serveren.
2. **Gem mødetypen på salget** under samme feltnavn, som prissætningsreglerne allerede bruger på andre produkter (`Hvilket type møde`, vist som "Type møde" i regeleditoren). Så kan du oprette de to regler med den betingelse, du allerede kender.
3. **Lad bulk-salg blive prissat af reglerne** ved at genbruge den eksisterende prissætningsmotor efter import — ingen kopi af prislogikken.
4. **Vis kolonnen i vejledningen** på Bulk Salg-fanen som punkt 7, så lederne trækker den med ud af Adversus.
5. Rækker uden mødetype afvises ikke; de falder tilbage på grundprisen som i dag, og mangler mødetype fremgår ikke som fejl.

Derefter er fremgangsmåden: opret to regler på Lederne i MG test med betingelsen Type møde = Telefonmøde og Type møde = Onlinemøde, hver med sin provision/omsætning og "Gyldig fra"-dato.

## Teknisk
- `src/pages/TastSelvSalg.tsx`: `BulkRow` får `moedetype`; `pickCol(r, ["mødetype", "modetype", "type møde"])`; nyt punkt 7 i kolonnelisten.
- `src/hooks/useLederneSales.ts`: `BulkImportRow` udvides med `moedetype: string | null`.
- `supabase/functions/manual-sales/index.ts` (bulk_import): tag `moedetype` fra rækken; gem i `raw_payload` som `data: { "Hvilket type møde": <værdi> }` ved siden af de nuværende felter (`bulk_import`, `subject_id`, m.fl.), så `rematch-pricing-rules` kan læse den (den læser `raw_payload.data`). Efter loopet: kald `rematch-pricing-rules` med de oprettede `sale_ids`, så provision/omsætning sættes af regelmotoren. Fejler kaldet, beholder salgene grundprisen, og der logges — intet salg går tabt.
- Ingen ændring i `matchPricingRule`, `_shared/pricing-service.ts`, `pricingRuleMatching.ts`, RLS eller skema. Ingen migration.
- Eksisterende salg (før ændringen) berøres ikke.

## Verifikation
- Typecheck.
- Tør-kørsel af det vedhæftede ark: bekræft at mødetypen læses på alle rækker.
- Oprettes to testregler på Lederne, importeres få rækker, og det kontrolleres via læse-query at `sale_items.mapped_commission` følger reglen pr. mødetype, og at `raw_payload.data` indeholder `Hvilket type møde`.
- Kontrollér at rækker uden mødetype fortsat oprettes med grundprisen.
