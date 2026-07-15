## Problem
"Solgt sammen med" vises kun når `clientId` prop til `PricingRuleEditor` er lig Relatels client-id. I dag udledes den i `MgTest.tsx` (linje 2583) sådan:

```
clientId: clientCampaigns?.find(c => c.id === row.product?.client_campaign_id)?.client_id
```

Hvis produktet ikke har `client_campaign_id` sat (typisk for Relatel-produkter der er tilknyttet via `adversus_campaign_mappings` og ikke direkte via `client_campaigns.id`), bliver `clientId` `undefined` → `isRelatelProduct = false` → betingelsen skjules. Derfor kan du ikke se den på 5 GB - 1 Time ATL.

## Fix
Brug den klient som rækken allerede er grupperet under. I aggregeringen sættes `row.campaignId` = klient-id (se linje 786, 823, 831 i `MgTest.tsx`). Den er den korrekte kilde, uafhængig af om produktet har `client_campaign_id`.

Ny udledning (linje 2583):

```ts
clientId:
  (row as any).campaignId
  ?? clientCampaigns?.find(c => c.id === row.product?.client_campaign_id)?.client_id
```

- `row.campaignId` bruges som primær kilde (den klient rækken vises under).
- Fallback beholder eksisterende opslag så vi ikke bryder tilfælde hvor kun `client_campaign_id` er sat.

Ingen anden logik ændres. `PricingRuleEditor` og `rematch-pricing-rules` er uændrede.

## Verifikation
1. Åbn 5 GB - 1 Time ATL fra Relatel-rækken → "Tilføj betingelse" viser nu "Solgt sammen med".
2. Åbn et Ase/Tryg-produkt → "Solgt sammen med" vises IKKE.
3. Opret regel med companion-krav, kør dry-run rematch, bekræft matches.

## Zone
Rød zone (pricing UI). Én commit, én fil, én linje ændret.
