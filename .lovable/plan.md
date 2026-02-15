

# Opret universelle fallback-prisregler for 40 Relatel-produkter

## Hvad vi goer
Vi opretter 40 nye prisregler i systemet - fuldt redigerbare via den eksisterende regeleditor (som vist paa dit screenshot). Hver regel faar:
- **Prioritet 0** (laveste - matcher kun naar ingen Tilskud=0% regel passer)
- **Ingen betingelser** (matcher altid som fallback)
- **Alle kampagner** (universel - ingen kampagne-begraensning)

## Prisvaerdier

### MBB-produkter (bruger Switch-kampagne vaerdier)

| Produkt | Provision | Omsaetning |
|---------|-----------|------------|
| MBB 500GB BTL / BTL #2 | 440 kr | 1.100 kr |
| MBB 500GB ATL | 560 kr | 1.400 kr |
| MBB 1000GB BTL / BTL #2 / #3 / #4 | 730 kr | 2.200 kr |
| MBB 1000GB ATL | 850 kr | 2.500 kr |
| MBB 2000GB BTL / BTL #2-#6 | 800 kr | 2.300 kr |
| MBB 2000GB ATL | 890 kr | 2.600 kr |

### Fri Tale-produkter (bruger basispriser - ingen Switch-data)

| Produkt | Provision | Omsaetning |
|---------|-----------|------------|
| Fri Tale - 10 GB BTL / #2 | 430 kr | 1.085 kr |
| Fri Tale - 10 GB ATL | 500 kr | 1.235 kr |
| Fri Tale - 30 GB BTL / #2 / #3 | 650 kr | 1.625 kr |
| Fri Tale - 30 GB ATL | 770 kr | 1.935 kr |
| Fri Tale - 60 GB BTL / #2 / #3 | 750 kr | 1.875 kr |
| Fri Tale - 60 GB ATL | 875 kr | 2.175 kr |
| Fri Tale - 1000 GB BTL / #2 / #3 / #4 | 950 kr | 2.300 kr |
| Fri Tale - 1000 GB ATL | 1.100 kr | 2.600 kr |
| Fri Tale - 2000 GB BTL / #2 / #3 / #5 | 1.250 kr | 3.000 kr |
| Fri Tale - 2000 GB ATL | 1.250 kr | 3.000 kr |

### Oevrige

| Produkt | Provision | Omsaetning |
|---------|-----------|------------|
| 5 GB - 1 Time BTL | 225 kr | 565 kr |
| Omstillingsbruger #1 | 175 kr | 351 kr |
| MBB 50GB ATL | 380 kr | 950 kr |

## Teknisk implementering

### Trin 1: SQL-migration
En enkelt INSERT-statement med 40 raekker i `product_pricing_rules`:

```text
INSERT INTO product_pricing_rules (product_id, commission_dkk, revenue_dkk, priority, conditions, campaign_mapping_ids, is_active, display_name)
VALUES
  ('product_id_1', 730, 2200, 0, '{}', NULL, true, 'Universel fallback'),
  ...
```

Alle regler oprettes med `display_name = 'Universel fallback'` saa de er nemme at genkende i regeloversigten.

### Trin 2: Koer rematch
Kalder `rematch-pricing-rules` edge function for at genberegne provision paa alle eksisterende salg retroaktivt.

### Ingen kodeaendringer
Alt sker via database-indsaettelser. Reglerne bliver fuldt redigerbare i det eksisterende UI under "Prissaetningsregler" for hvert produkt - praecis som vist paa dit screenshot.

