

## Rediger Kurv - Omdob og udvid funktionalitet

### Oversigt
AEndrer "Annuller/afvis"-fanen og dialogen til "Rediger kurv", saa man kan tilfoeje/fjerne produkter i et salg, samt stadig annullere eller afvise hele salget.

---

### AEndring 1: Tab-tekst i Cancellations.tsx
- AEndr TabsTrigger fra "Annuller/afvis" til "Rediger kurv"

### AEndring 2: Knap i ManualCancellationsTab.tsx
- AEndr knapteksten fra "Annuller/afvis" til "Rediger kurv"
- Skift ikon fra `X` til `ShoppingCart`
- AEndr variant fra `destructive` til `outline`

### AEndring 3: Udvid CancellationDialog.tsx
Dialogen omdoebes til **EditCartDialog** og faar foelgende nye funktioner:

**Ny titel og beskrivelse:**
- "Rediger kurv" / "Tilfoej eller fjern produkter, eller annuller/afvis hele salget"

**Tilfoej produkt-sektion (ny):**
- Hent salgets `client_campaign_id` fra `sales`-tabellen
- Hent tilgaengelige produkter fra `products`-tabellen filtreret paa den kampagne
- Dropdown til at vaelge produkt + antal-input (standard 1)
- "Tilfoej"-knap der opretter ny raekke i `sale_items` med:
  - `sale_id`, `product_id`, `display_name` (fra produktet)
  - `quantity`, `mapped_commission` (commission_dkk x antal), `mapped_revenue` (revenue_dkk x antal)

**Fjern produkt (ny):**
- Slet-knap (TrashIcon) per raekke der helt fjerner `sale_item`-raekken fra databasen
- Bekraeftelsesdialog foer sletning

**Bevar eksisterende funktionalitet:**
- Annuller 1 stk / Afvis 1 stk per produkt
- Fortryd 1
- "Annuller hele salget" og "Afvis hele salget" i footer

---

### Tekniske detaljer

**Filer der aendres:**
1. `src/pages/salary/Cancellations.tsx` - Tab-tekst
2. `src/components/cancellations/ManualCancellationsTab.tsx` - Knap-tekst, ikon, variant
3. `src/components/cancellations/CancellationDialog.tsx` - Omdoeb til EditCartDialog, tilfoej produkt-query, tilfoej/slet mutations

**Database:** Ingen skemaaendringer noedvendige. Alle kolonner findes allerede i `sale_items` og `products`.

**Nye queries i dialogen:**
- `sales` query for `client_campaign_id` (baseret paa `saleId`)
- `products` query filtreret paa `client_campaign_id`
- INSERT mutation til `sale_items` for nye produkter
- DELETE mutation til `sale_items` for fjernelse

