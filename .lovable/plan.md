## Mål
Excel-udtræk over Relatel-salg i lønperiode **15/5–14/6 2026**, ét row pr. sale_item (linje), fuldt udspecificeret.

## Kolonner jeg foreslår

**Det du bad om:**
- Sælger (navn + email)
- Vores interne kampagne (client_campaigns.name)
- Adversus kampagne (dialer_campaign_id + navn fra adversus_campaign_mappings)
- Produkt (display_name + products.name)
- Tilskud (0/50/100% — fra raw_payload/normalized_data)
- Provision (mapped_commission)
- Timestamp (sale_datetime)

**Ekstra som vi har og normalt er nyttige — sig til hvis noget skal skæres væk:**
- Team (sælgers team på salgstidspunktet)
- Revenue (mapped_revenue) — så du kan se DB pr. linje
- Antal (quantity)
- Unit price
- Status + validation_status (verified / pending / cancelled)
- is_cancelled + cancelled_quantity (annulleringer trukket fra)
- is_immediate_payment (straksbetaling-flag)
- Kunde (company + phone) — kan udelades hvis du vil holde det PII-let
- Internal reference (salgs-ID til opslag)
- Matched pricing rule (hvilken prisregel der ramte — godt til pricing-audit)
- needs_mapping flag (umappede salg)
- Sale_id (til krydsreference)

## Format
Én Excel-fil, to faner:
1. **Detaljer** — én række pr. sale_item med alle kolonner ovenfor
2. **Pr. sælger** — pivot: antal salg, sum provision, sum revenue, fordelt på tilskud-niveau

## Afklaringer før jeg bygger
1. Skal **kunde-felter** (company/phone) med? (PII — typisk ja til intern brug)
2. Skal **annullerede linjer** med som egne rækker, eller skal de kun trækkes fra summerne?
3. Provision = **mapped_commission pr. linje** (efter pricing-rules). OK?
4. Tilskud-niveau: jeg henter fra `normalized_data` (typisk felt `subsidy` / `tilskud`). Hvis det mangler på nogle salg, viser jeg "ukendt" — OK?
