

# Komplet overblik: Produkt-merge (TDC Erhverv + Finansforbundet)

## TDC Erhverv — 25 dubletter

### Gruppe A: Rene merges (priser identiske, ingen komplikationer) — 20 stk

| Produkt | Dublet-salg → Original-salg | Provi | Omsætning |
|---|---|---|---|
| 5G - 200/40 | 12 → 0 | 1.600 | 2.700 |
| 5G - 50/10 | 46 → 0 | 1.400 | 2.500 |
| 5G - 500/100 | 39 → 0 | 1.700 | 2.800 |
| Basis mobil (15GB) 0% tilskud | 82 → 0 | 650 | 1.400 |
| Basis mobil (15GB) 100% tilskud | 87 → 0 | 400 | 900 |
| Basis mobil (15GB) 50% tilskud | 0 → 27 | 500 | 1.100 |
| Internetfilter | 0 → 0 | 35 | 75 |
| MBB 100 GB | 1 → 0 | 750 | 1.500 |
| MBB 500 GB | 2 → 0 | 850 | 1.750 |
| Mobil Basis (40GB BTL) 0% tilskud | 0 → 145 | 750 | 1.500 |
| Mobil Basis (40GB BTL) 100% tilskud | 178 → 0 | 450 | 900 |
| Mobil Basis (40GB BTL) 50% tilskud | 19 → 0 | 600 | 1.200 |
| Mobil Basis (5GB BTL) 0% tilskud | 74 → 0 | 450 | 900 |
| Mobil Basis (5GB BTL) 100% tilskud | 72 → 0 | 250 | 700 |
| Mobil Basis (5GB BTL) 50% tilskud | 11 → 0 | 300 | 800 |
| Mobil DK (3GB) 0% tilskud | 0 → 11 | 150 | 300 |
| Mobil DK (3GB) 100% tilskud | 54 → 0 | 125 | 250 |
| Omstilling | 214 → 0 | 350 | 800 |
| Premium mobil (100GB) 0% tilskud | 169 → 0 | 1.050 | 1.900 |
| Premium mobil (100GB) 100% tilskud | 422 → 0 | 800 | 1.400 |

**Handling:** Flyt alle `sale_items` + `adversus_product_mappings` til original → slet dublet.

---

### Gruppe B: Kræver opmærksomhed — 2 stk

**MBB 1000 GB - (DK):**
- Der findes TO originaler med samme navn:
  - `a79ac5f7` — provi 1.000, oms **2.000**, 18 salg ✅
  - `51af6a3e` — provi 1.000, oms **0**, 0 salg ❌
- Dubletten (`3b131e76`) har 3 salg, provi 1.000, oms 2.000
- **Handling:** Merge dublet → `a79ac5f7` (den med korrekt omsætning). Slet også `51af6a3e` (0 salg, forkert oms).

**MBB 30 GB:**
- Der findes TO dubletter:
  - `4fa02f50` — provi 600, oms **1.200**, 1 salg, 1 mapping ✅
  - `966b017f` — provi 600, oms **0**, 0 salg, 0 mappings ❌
- Original (`9170eb2c`) har provi 600, oms 1.200, 1 salg
- **Handling:** Flyt salg fra `4fa02f50` → original. Slet begge dubletter.

---

### Gruppe C: Beholdes (unikke produkter, ingen original) — 4 stk

| Produkt | Salg | Provi | Oms |
|---|---|---|---|
| 5G - 100/20 - TDC Erhverv | 56 | 1.500 | 2.600 |
| 5G - 100/20 - Kampagnepris - TDC Erhverv | 37 | 1.100 | 2.000 |
| 5G - 200/40 - Kampagnepris - TDC Erhverv | 8 | 1.200 | 2.200 |
| 5G - 500/100 - Kampagnepris - TDC Erhverv | 43 | 1.300 | 2.200 |

**Handling:** Ingen ændring — disse er selvstændige produkter.

---

## Finansforbundet — 3 dubletter (+ 1 tom dublet)

| Produkt | Dublet-salg → Orig-salg | Priser ens? | Note |
|---|---|---|---|
| Betalende medlem | 42 → 15 | ✅ Ja (400/800) | Ren merge |
| Studerende medlem | 188 → 137 | ✅ Ja (200/450) | Ren merge |
| Winback EA | 69 → 10 | ⚠️ **Nej** | Original har 0/0, dublet har 600/1.200 |
| Winback EA (2. dublet) | 0 → 10 | — | Tom dublet, slettes direkte |

**Winback EA special-case:** Originalens priser (0/0) skal opdateres til 600/1.200 FØR merge, så de 10 eksisterende salg også får korrekt pris.

---

## Samlet opsummering

| | Antal | Salg der flyttes |
|---|---|---|
| TDC rene merges | 20 | ~1.482 sale_items |
| TDC special cases | 2 | ~4 sale_items |
| Finansforbundet | 3+1 | ~299 sale_items |
| **Total sletninger** | **26 produkter** | **~1.785 sale_items flyttes** |
| Beholdes uændret | 4 | — |

## Trin i rækkefølge
1. Opdater Winback EA original-pris til 600/1.200
2. `UPDATE sale_items SET product_id = <original>` for hvert par
3. `UPDATE adversus_product_mappings SET product_id = <original>` for hvert par
4. Flyt/slet eventuelle `product_pricing_rules` på dubletter
5. `DELETE FROM products WHERE id IN (...)` — alle 26 dubletter
6. Slet den ekstra "MBB 1000 GB - (DK)" original med 0 omsætning
7. Kode-fix i MgTest.tsx: strip suffixes inden matching for at forhindre gentagelse

