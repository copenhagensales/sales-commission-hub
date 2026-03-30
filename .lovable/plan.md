

## Fix: Annulleringer trækker hele salgets provision i stedet for kun det annullerede produkt

### Problem
Når en annullering godkendes, summerer lønsystemet **alle** sale_items på salget — ikke kun det produkt der er annulleret. For Eesy TM-salg med flere produkter (typisk 2-3 items) betyder det f.eks. at en annullering af "Lønsikring" (400 kr.) trækker hele salgets 1.400 kr. fra sælgerens provision.

**Bevist eksempel:** Annullering af "Lønsikring" på salg med 2 items:
- Salg = 1.000 kr. (hovedprodukt) + 400 kr. (Lønsikring)  
- Target = "Lønsikring" → korrekt fradrag = 400 kr.  
- Nuværende fradrag = 1.400 kr. (hele salget)

### Løsning

**`src/hooks/useSellerSalariesCached.ts`**

1. **Hent `target_product_name` fra cancellation_queue** — tilføj feltet til select-queryen (linje 239-248).

2. **Hent produktnavne for matching** — ny query der slår `product_id → name` op fra `products`-tabellen, så vi kan matche `target_product_name` mod de faktiske sale_items.

3. **Beregn kun den målrettede provision**:
   - Hvis `target_product_name` findes: find den matchende sale_item og træk kun dennes `mapped_commission` fra.
   - Hvis `target_product_name` er null (ældre rækker uden produktmål): fald tilbage til at trække hele salgets provision fra (nuværende adfærd).

### Tekniske detaljer
- `cancellation_queue.target_product_name` gemmes allerede ved matching/godkendelse
- Matching sker ved at sammenligne `target_product_name` med `products.name` via `sale_items.product_id`
- Fallback-logikken sikrer bagudkompatibilitet med ældre annulleringer

