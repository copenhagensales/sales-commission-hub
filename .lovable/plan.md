

# Plan: Konsolidering af Lønsikring + Salg-prisregler inkl. straksbetaling

## Overblik

Denne plan samler alle ændringer for **Lønsikring** og **Salg**-produkterne, inklusiv straksbetaling.

---

## Del 1: Lønsikring-konsolidering

### Nuværende situation
12 Lønsikring-produkter, kun 2 med data:

| Produkt | Items | Handling |
|---------|-------|----------|
| **Lønsikring** (`f9a8362f`) | 408 | Beholdes som eneste aktive |
| Lønsikring Udvidet - 6000 (`fb4763a0`) | 16 | Items flyttes, deaktiveres |
| 9 andre varianter (Super, Udvidet-16000, osv.) | 0 | Deaktiveres |

### Trin

**1. Flyt 16 sale_items** fra `fb4763a0` til hovedproduktet `f9a8362f`

**2. Nulstil alle ~424 items** (`mapped_commission = 0`, `mapped_revenue = 0`, `matched_pricing_rule_id = NULL`)

**3. Opret 2 prisregler** (uden straksbetaling):

| Regel | Betingelse | Provision | Omsætning | Straks |
|-------|-----------|-----------|-----------|--------|
| **Lønsikring Basis** (Lille) | Dækningssum 1–5999 | 200 kr | 400 kr | Nej |
| **Lønsikring Udvidet** (Stor) | Dækningssum >= 6000 | 400 kr | 800 kr | Nej |

Begge med `use_rule_name_as_display = true`, `allows_immediate_payment = false`, prioritet 5.

Dækningssum = 0 matcher ingen regel = 0 kr (korrekt).

**4. Deaktiver 9 ubrugte produkter** (alle undtagen hovedproduktet og de 3 separate Fagforening-produkter)

**5. Kør rematch** for produkt `f9a8362f`

---

## Del 2: Salg-prisregler med straksbetaling

### Nuværende regler på "Salg" (`1ad52862`)

4 aktive regler allerede konfigureret:

| # | Navn | Prio | Betingelser | Provision | Omsætning | Straks? | Straks-prov. | Straks-oms. |
|---|------|------|-------------|-----------|-----------|---------|-------------|-------------|
| 1 | Ung Under Udannelse med FF | 10 | Forening=Ase Lønmodtager + A-kasse type=Ung under uddannelse | 600 kr | 1500 kr | Nej | - | - |
| 2 | Ung under udannelse uden FF | 5 | A-kasse type=Ung under uddannelse | 300 kr | 1000 kr | Nej | - | - |
| 3 | A-kasse uden straksbetaling | 2 | A-kasse salg=Ja + A-kasse type=Lønmodtager | 400 kr | 1500 kr | **Ja** | **1000 kr** | **2100 kr** |
| 4 | Akasse salg uden straks - selvstændig | 1 | A-kasse salg=Ja + A-kasse type=Selvstændig | 400 kr | 1500 kr | **Ja** | **1000 kr** | **2100 kr** |

Regel 3 og 4 har `allows_immediate_payment = true` med straksprovision 1000 kr / 2100 kr omsætning.

### Handling

Reglerne ser korrekte ud. Hvis beløbene stemmer, kører vi blot **rematch for Salg** (`1ad52862`) for at sikre alle 1.255+ sale_items har korrekt provision.

Fortæl mig hvis nogen beløb skal justeres.

---

## Samlet rækkefølge

```text
1. Flyt 16 Lønsikring-items til hovedproduktet
2. Nulstil alle ~424 Lønsikring-items
3. Opret 2 Lønsikring-prisregler (Basis + Udvidet, uden straks)
4. Deaktiver 9 ubrugte Lønsikring-produkter
5. Kør rematch for Lønsikring (f9a8362f)
6. Kør rematch for Salg (1ad52862) - verificerer straksreglerne
```

## Ingen kodeændringer

Alt er ren datakonfiguration via database-operationer og rematch-kald.

