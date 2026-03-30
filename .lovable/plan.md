

## Fix: Dublet-detektion for Eesy TM i Godkendelseskøen

### Problem
For Eesy TM bruger dublet-detektionen `sale_id` som nøgle. Men ét Eesy TM-salg kan have op til 3 abonnementer (Abo1, Abo2, Abo3) med forskellige telefonnumre. Når alle tre annulleres, oprettes 3 kø-elementer med **samme sale_id** — og alle markeres fejlagtigt som "Dublet".

I virkeligheden er de tre kø-elementer **forskellige produkter** på samme salg, ikke dubletter.

### Løsning
Ændr dublet-nøglen for Eesy TM fra `sale_id` til `sale_id + target_product_name`. Dermed er det kun en dublet, hvis det **samme produkt** på **samme salg** optræder mere end én gang i køen.

### Ændringer

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`**

**4 steder** hvor dublet-nøglen beregnes (linje 635, 650, 921, 1315):

```text
// Nuværende:
const key = isEesyTm ? (item.sale_id || "").trim() : (item.phone || "").trim();

// Ny:
const key = isEesyTm 
  ? `${(item.sale_id || "").trim()}|${(item.target_product_name || "").trim()}`
  : (item.phone || "").trim();
```

### Konsekvens
- 3 forskellige Abo-produkter på samme salg → **ingen** "Dublet" badge (korrekt)
- 2 kø-elementer med **samme** sale_id OG **samme** target_product_name → "Dublet" badge (ægte dublet)
- Andre klienter: Uberørte (bruger stadig `phone`)

