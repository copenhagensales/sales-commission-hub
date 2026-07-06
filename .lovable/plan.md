## Udtræk: Eesy FM numre sidste uge

**Data der findes:** 414 salg, 388 unikke telefonnumre i uge 27 (29. juni – 5. juli 2026). Kundenavn/firma er tomme felter (Eesy FM får ikke kundedata fra dialeren i dag), men vi har telefon, dato/tid, sælger og status.

**Leverance:** CSV-fil i `/mnt/documents/eesy-fm-numre-uge27.csv` med kolonnerne:
- `sale_datetime` (dansk tid)
- `customer_phone`
- `agent_name`
- `agent_email`
- `status`
- `internal_reference` (MG-nummer)

Sorteret efter dato. Ingen dedup — hvis samme nummer optræder to gange får du begge rækker (så du kan se dubletter).

**Scope:** Kun læsning + CSV-eksport. Ingen kode-, DB- eller schema-ændringer. Grøn zone.

**Åbne valg:**
1. Skal dubletter fjernes (388 rækker) eller beholdes (414 rækker)?
2. Vil du have kun godkendte salg (`validation_status='approved'`) eller alle inkl. pending/cancelled?