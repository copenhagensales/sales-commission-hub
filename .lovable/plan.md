
# Fix Eesy TM pricing-regression (exclude-mode) + Winback 15 mdr-konsolidering

## TL;DR

Bug findes ét sted: **`supabase/functions/integration-engine/core/sales.ts`** (linje 163-169 + SELECT linje 668). Den læser ikke `campaign_match_mode` og behandler alle regler som "include". Resultat: exclude-regler matcher aldrig på nye salg → de falder tilbage til base-pris.

`_shared/pricing-service.ts` og `rematch-pricing-rules/index.ts` har allerede korrekt logik. De er ikke ramt.

Brugerens tabel = forventet resultat efter fix. Satser bekræftet korrekte.

## Zone

**RØD** — pricing-motoren (top-10 kritisk fil). Ændringen er minimal og 1:1 alignment med allerede deployeret logik fra to søsterfiler. Kræver eksplicit godkendelse jf. princip §4.

## Hvorfor

Sidste uges ændring tilføjede `campaign_match_mode = 'exclude'` på Eesy TM-reglerne. `_shared/pricing-service.ts` og `rematch-pricing-rules` blev opdateret. **Webhook-pipeline (`integration-engine`) blev glemt.**

Forretningsregel (bekræftet):
- Exclude-listen = konkurrenceleads, winback, FS leads, Inboxgame mv. → får HØJ base-pris (350/300)
- Alt andet (Karman, Admill, Mobilpriser, Tjenestetorvet mv.) → matcher reglen og får LAV pris (260/225)

## Ændringer

### 1. Kode-fix (1 fil, 2 steder)

**`supabase/functions/integration-engine/core/sales.ts`**

**A) Linje 668** — tilføj `campaign_match_mode` til SELECT.

**B) Linje 163-169** — erstat include-only check med samme logik som `_shared/pricing-service.ts`:

```ts
const ids = rule.campaign_mapping_ids;
const hasRestriction = !!ids && ids.length > 0;
const mode = rule.campaign_match_mode === "exclude" ? "exclude" : "include";

let campaignMatches: boolean;
if (!hasRestriction) {
  campaignMatches = true;                                              // universal
} else if (mode === "include") {
  campaignMatches = !!campaignMappingId && ids!.includes(campaignMappingId);
} else { // exclude
  campaignMatches = !campaignMappingId || !ids!.includes(campaignMappingId);
}
if (!campaignMatches) continue;
```

Note (princip §8): logikken findes nu 3 steder. Bør konsolideres til én delt helper i `_shared/` som separat oprydningsopgave — uden for denne fix.

### 2. Rematch af historiske data

Kør `rematch-pricing-rules` for **Eesy TM** sale_items siden **2026-04-28**.

Først `dry_run=true` → rapport:
- Antal items der ændres pr. produkt
- Total commission-delta
- Stikprøve på 5 sager

Derefter rigtig kørsel + broadcast `pricing_rules_updated` på `mg-test-sync` så `useSalesAggregates`, `EesyTmDashboard` og daily reports rydder cache.

### 3. Winback 15 mdr-konsolidering

To `adversus_campaign_mappings`-rækker for samme kampagne:
- "Winback 15 mdr"
- "Winback 15 mdr." (med punktum)

Plan:
1. Identificér de to mapping-IDs i DB.
2. Vælg én som kanonisk (den med flest historiske referencer — typisk uden punktum, jf. mønster fra Winback 6 mdr-fixet).
3. Opdater `sales.client_campaign_id` på alle salg fra dublet → kanonisk mapping.
4. Opdater alle `product_pricing_rules.campaign_mapping_ids`-arrays der refererer dubletten.
5. Deaktivér dubletten (`is_active=false`) i stedet for at slette — bevarer historik (princip §1: historik bevares altid).

### 4. Verifikation efter deploy

`supabase--read_query` mod 5 nyeste salg pr. produkt:
- Karman Internettjek (NEJ) → 260 / 225 ✅
- FS leads fra Bisnode (JA) → 350 / 300 ✅
- Mobilpriser - Premium (NEJ, lille) → 260 / 225 ✅
- Winback 15 mdr (uanset variant) → 350 / 300 ✅

## Forventet resultat

Matcher brugerens tabel 1:1 efter fix + rematch.

**Fri tale + fri data (5G):** Alle ⬇-rækker → 260. ✅-rækker uændret.
**Fri Tale + 70 GB:** Alle ⬇-rækker → 225, alle ⬆-rækker → 300.

## Parkeret (ikke i denne leverance)

- **CAMP7343C81 / CAMP7371C81 / CAMP7526C81** — navne ukendte. Volumen er stor (samlet 374 salg på de to produkter), så de bør navngives når kilden er identificeret. Tilføj som separat opgave senere.
- **Admill - Internet leads outlier (5G, snit 416 kr)** — bekræftet manuel/forkert provision. Behandles via salgs-redigering (ikke pricing-fix). Separat opgave.

## Næste skridt

Når du godkender, skifter jeg til build-mode og:
1. Implementerer kode-fixet i `sales.ts`.
2. Deployer `integration-engine`.
3. Kører dry-run rematch og rapporterer tal.
4. Beder om go/no-go på rigtig rematch.
5. Udfører Winback 15 mdr-konsolidering (insert-tool).
6. Verificerer.
