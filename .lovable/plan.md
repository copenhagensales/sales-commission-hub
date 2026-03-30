

## Fix: Kurv-rettelser skal kun trække differencen — ikke hele provisionen

### Problem
Når en kurv-rettelse (basket_difference) godkendes, beregner lønsystemet hele salgets provision som "tabt". Men en kurv-rettelse ændrer kun produktet — den korrekte modregning er **differencen** mellem gammel og ny provision, ikke hele beløbet.

Desuden mangler `upload_type`-filteret stadig i queryen, så `correct_match`-rækker medtages fejlagtigt.

### Løsning

**`src/hooks/useSellerSalariesCached.ts`**

1. **Tilføj `upload_type` til queryen** — hent `upload_type` og filtrer med `.in("upload_type", ["cancellation", "basket_difference"])` så `correct_match` udelukkes.

2. **Hent `product_change_log` for kurv-rettelser** — ny query der henter `old_commission` og `new_commission` fra `product_change_log` for godkendte basket_difference-rækker (hvor `rolled_back_at IS NULL`).

3. **Beregn korrekt fradrag baseret på type**:
   - **Annullering** (`upload_type = "cancellation"`): Hele salgets provision fratrækkes (som nu).
   - **Kurv-rettelse** (`upload_type = "basket_difference"`): Kun differencen `old_commission - new_commission` fratrækkes. Denne data kommer fra `product_change_log`, som allerede gemmer de kampagne-aware priser sat af `rematch-pricing-rules`.

### Tekniske detaljer

- `product_change_log` indeholder: `old_commission`, `new_commission`, `old_product_name`, `new_product_name`, `cancellation_queue_id` — alt hvad vi behøver.
- Priserne i loggen er allerede kampagne-korrekte, da de sættes af `rematch-pricing-rules` ved godkendelse.
- Pagination tilføjes også til cancellation-queryen for at undgå 1000-rækkers grænsen.

