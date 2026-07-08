# Tast selv salg — udvid med Hiper-kanal

Genbruger eksisterende infrastruktur (`src/pages/TastSelvSalg.tsx` + `supabase/functions/manual-sales/index.ts`). Ingen ny side, ingen ny DB-migration (Hiper-klient/kampagne/produkter/pricing rules blev oprettet i forrige migration).

Bekræftet: identisk formular (produkt + telefonnummer påkrævet). To separate salg pr. handel — viderestiller og lukker registrerer hver deres. Én sælger vælger ét produkt (Hiper Viderestilling ELLER Hiper Lukning) pr. salg.

## Ændringer

### 1. Edge function `supabase/functions/manual-sales/index.ts`

Erstat de tre hardkodede konstanter (`TEAM_UNITED_ID`, `CLIENT_NAME`, `CAMPAIGN_NAME`, `ALLOWED_PRODUCT_NAMES`) med en channels-liste:

```ts
const CHANNELS = [
  { key: "lederne", label: "Lederne",
    team_id: "ed095592-cc72-4dc5-b4d7-cc4a65250cac",
    client_name: "Tryg", campaign_name: "Tryg Products",
    allowed_products: ["Lederne"] },
  { key: "hiper", label: "Hiper Bredbånd",
    team_id: "0cb1b854-e7b5-4f49-8fdf-30e54e7d2f95",
    client_name: "Hiper", campaign_name: "Hiper Bredbånd",
    allowed_products: ["Hiper Viderestilling", "Hiper Lukning"] },
];
```

`getCallerContext` returnerer nu også `allowed_channel_keys: string[]` beregnet ud fra `team_members` (managers/ejer får alle kanaler via `is_manager_or_above`).

`resolveCampaignId` bliver `resolveChannel(svc, channelKey)` og returnerer `{ campaign_id, allowed_products, label }` for den valgte kanal — 404 hvis kanalen ikke findes eller caller ikke har adgang.

Actions bliver channel-scoped via querystring `?channel=hiper`:

- `products?channel=<key>` → produkter for den kanals kampagne, filtreret på `allowed_products`.
- `list` → uden channel: returnerer alle callers manuelle salg på tværs af tilladte kanaler. Hver række beriges med `channel_key` (baseret på `client_campaign_id → channel`) så UI kan gruppere.
- `create?channel=<key>` → validerer at valgte produkt tilhører den kanals kampagne + står på `allowed_products`.
- `delete` → uændret; ejerskabs-tjek er allerede pr. sale-id og source=`manual_entry`.

Adgangs-gate: hvis `channel` er angivet i action og callers `allowed_channel_keys` ikke indeholder den → 403.

Kompatibilitet: hvis `channel` mangler i eksisterende kald falder default tilbage til `lederne` (bevarer nuværende UI indtil frontend er opdateret).

`channels` action tilføjes: `GET /manual-sales?action=channels` → `{ channels: [{ key, label }] }` for caller. Bruges af UI til at rendere det rette antal sektioner uden hardkodning.

### 2. Frontend

`src/hooks/useLederneSales.ts` omdøbes internt til `useManualSales.ts` (behold gammel fil som re-export for at undgå breakage), tilføjer:

- `useManualChannels()` → henter tilladte kanaler for caller.
- `useManualProducts(channelKey)` → produkter pr. kanal.
- `useMyManualSales()` → alle callers salg med `channel_key` pr. række.
- `useCreateManualSale()` mutation: `{ channel_key, product_id, customer_phone }`.
- `useDeleteManualSale()` uændret.

`src/pages/TastSelvSalg.tsx` refactores:

- Fjerner ord "Lederne" fra overskrifter/tekster — bliver dynamisk (kanalens label).
- Hvis caller kun har 1 kanal → nuværende layout, men med kanalens label.
- Hvis caller har flere kanaler → tabs (shadcn `Tabs`) med én per kanal. Hver tab har egen produktvælger + form + "seneste salg" list.
- "Mine seneste salg" viser alle på tværs af kanaler i sin egen tab-uafhængige sektion, med `Badge` for kanal.

Formular og validering bevares 1:1: produkt påkrævet, telefon påkrævet (`>=4` tegn), toast ved success/fejl.

### 3. Adgang for Eesy TM-teamet

Eesy TM-teamet (`0cb1b854-...`) har allerede route-adgang til `/tast-selv-salg` — verificér i `src/routes/config.tsx` at siden ikke er begrænset til United. Hvis den er: udvid `allowedTeamIds` eller tilsvarende til også at inkludere Eesy TM. (Bekræftes ved implementation — ingen ændring hvis siden er åben for alle authenticated.)

### 4. Verifikation

- Ejer-bruger på United: ser begge kanaler som tabs, kan taste Lederne og Hiper.
- Eesy TM-sælger: ser kun Hiper-kanal, kan taste Viderestilling eller Lukning, ser telefon-input.
- United-sælger: ser kun Lederne-kanal (uændret UX).
- Salget lander i `sales` med `source='manual_entry'`, `client_campaign_id`=Hiper Bredbånd, korrekt `agent_email`, og `sale_items` med `mapped_commission=400` eller `200` fra produktets `commission_dkk` (som allerede står i produkt-rækkerne fra forrige migration).
- Slet virker for Hiper-salg (ejerskabs-tjek: `source=manual_entry` + `agent_email` match).

## Rød-zone tjek

- Ingen ændringer i pricing-motor, `hours.ts`, `useSellerSalariesCached.ts`, webhooks eller SECURITY DEFINER-funktioner.
- Ingen DB-migration.
- Ny logik er isoleret i `manual-sales` edge function + `TastSelvSalg.tsx` + hook.
- Bruger produkt-baseline priser (`products.commission_dkk`) — samme mønster som eksisterende Lederne-flow. Pricing rules (som ligger klar i DB) rammer først når rematch kører; da rules er låst til 400/200 for de to Hiper-produkter er der ingen drift.

## Filer der ændres

- `supabase/functions/manual-sales/index.ts` (refactor til channels)
- `src/hooks/useLederneSales.ts` (udvidet + re-export fra ny fil, eller in-place rename)
- `src/pages/TastSelvSalg.tsx` (tabs når >1 kanal, dynamiske labels)
- evt. `src/routes/config.tsx` hvis siden er team-restricted

## Ét åbent punkt

`is_manager_or_above` giver i dag managers adgang til Lederne-kanalen. Skal samme bypass gælde Hiper — dvs. skal ejere/teamledere kunne taste Hiper-salg på egne vegne? Default: ja (bevarer eksisterende mønster). Sig til hvis Hiper skal være strengt kun for Eesy TM-teammedlemmer.
