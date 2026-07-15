
## Svar kort
Ja. Companion-produkt bliver en betingelse i den eksisterende "Betingelser (alle skal matche)"-liste — samme sted hvor `Tilskud`, `Dækningssum`, `A-kasse type` mv. tilføjes. Den ligger i dropdown'en over tilgængelige betingelses-nøgler.

## Sådan fungerer det i regel-editoren
I `src/components/mg-test/PricingRuleEditor.tsx` findes i dag en liste `CONDITION_KEYS` (Tilskud, Forening, Dækningssum, A-kasse type, A-kasse salg). Vi tilføjer én ny nøgle:

- **Nøgle:** `Solgt sammen med`
- **UI når valgt:** i stedet for et fast dropdown ("0%" / "100%") vises en multi-select produkt-picker (søgbar liste over Relatel-produkter).
- **Adfærd:** OR mellem valgte produkter — reglen matcher hvis salget indeholder mindst ét af dem.
- **Kun synlig for Relatel-produkter:** nøglen `Solgt sammen med` vises kun i dropdown'en når reglen redigeres på et produkt med `client_id = Relatel` (jf. `src/utils/clientIds.ts`). For andre klienter fjernes den fra listen.

Alle andre eksisterende betingelser og AND-logik ("alle skal matche") beholdes uændret.

## Persistens
Gemmes i samme `conditions` jsonb som de andre betingelser, med reserveret struktur så matcheren kan skelne den fra en almindelig streng-værdi:

```json
{
  "Tilskud": "0%",
  "Solgt sammen med": {
    "__companion__": true,
    "product_ids": ["<uuid>", "<uuid>", "<uuid>"]
  }
}
```

Rent DB-mæssigt er det stadig én nøgle i `conditions` — ingen migration, bagudkompatibel med regler der ikke bruger den.

## Matcher-ændring (`supabase/functions/rematch-pricing-rules/index.ts`)
1. Kald-siden bygger `siblingProductIds: Set<string>` én gang pr. salg: alle `sale_items.product_id` på salget, minus den nuværende linjes eget produkt, minus fuldt annullerede linjer (`cancelled_quantity >= quantity`).
2. `matchPricingRule` får parameteren `siblingProductIds`.
3. I felt-condition-loopet: hvis værdien er et objekt med `__companion__: true`, evaluér som companion-krav (mindst ét af `product_ids` skal findes i `siblingProductIds`). Ellers falder det tilbage til eksisterende streng/numerisk-logik.
4. Priority-sortering uændret. Companion-reglen skal have højere `priority` end den almindelige regel for samme produkt — brugeren sætter det manuelt som i dag.

## Kant-tilfælde
- Companion-linje fuldt annulleret → tæller ikke.
- Companion annulleres efter indlæsning → næste rematch flytter linjen tilbage til den almindelige sats. Nævnes i UI-hjælpetekst.
- Companion-betingelse kombineret med campaign-restriction eller andre betingelser → AND, uændret flow.
- Toggle valgt men tom produktliste → UI blokerer gem (samme mønster som andre betingelser med tomme værdier).

## Ikke i scope
- FM-flow (`_shared/pricing-service.ts`, `fmPricing.ts`) — rører vi ikke.
- "Samme CVR på tværs af ordrer" — kræver rigtigt CVR-felt på `sales`, findes ikke i dag. Samme sale_id garanterer allerede samme CVR + samme ordre.
- Selve reglen oprettes af brugeren via UI'et.

## Filer der ændres
- `supabase/functions/rematch-pricing-rules/index.ts` — matcher + kald-side.
- `src/components/mg-test/PricingRuleEditor.tsx` — ny betingelses-nøgle `Solgt sammen med` med produkt-picker, kun synlig for Relatel-produkter.
- Evt. `src/components/mg-test/ProductPricingRulesDialog.tsx` for at vise companion-info i regel-listen (badge "→ solgt sammen med: Produkt X, Y").

## Verifikation før deploy
Rød zone (pricing-motor). Test på konkret Relatel-salg:
1. Opret companion-regel, dry-run rematch → salg MED companion får ny sats, salg UDEN beholder gammel.
2. Salg hvor companion-linjen er fuldt annulleret → beholder gammel sats.
3. Regel uden companion-betingelse på samme produkt → uændret adfærd.
