

## Fix: Vis kun det målrettede produkt i Godkendelseskøen for Eesy TM

### Problem
Godkendelseskøen viser ALLE produkter på et salg under "Produkter solgt" (f.eks. både Abo1 og Abo2). For Eesy TM skal der kun vises det ENE produkt, der er målrettet for annullering — bestemt af `target_product_name` på køelementet.

### Løsning

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`** (linje ~507)

Filtrér `saleItems` ned til kun det produkt, der matcher `target_product_name`, når klienten er Eesy TM og `target_product_name` er sat:

```text
Nuværende (linje 507):
  const saleItems = saleItemsBySale.get(item.sale_id) || [];

Ny logik:
  let saleItems = saleItemsBySale.get(item.sale_id) || [];
  
  // For Eesy TM: filter to only the targeted product
  if (clientId === CLIENT_IDS["Eesy TM"] && targetProductName) {
    const filtered = saleItems.filter(si => 
      si.product_name.toLowerCase().trim() === targetProductName.toLowerCase().trim()
    );
    if (filtered.length > 0) saleItems = filtered;
  }
```

Kun én ændring, ~5 linjer. Ingen database-ændringer. Andre klienter er uberørte.

