# Telefonmøde-reglen på Partnersalg Finansforbundet - TRYG

## Bekræftet i data (read-only)

- Produkt: `Partnersalg Finansforbundet - TRYG` (`b3e04a4a…`), basissats 75 kr prov / 200 kr oms.
- To aktive regler, begge gyldige fra 07-09-2026, prioritet 0:
  - `Onlinemøde`: betingelse `Hvilken type møde = Onlinemøde` → 90/200
  - `Tlfmøde` (`22d1d924…`): betingelse `Hvilken type møde = Telefonmøde` → 30/200
- Adversus sender faktisk værdien **`Telefonnummer`**, ikke `Telefonmøde`. Bekræftet på salg 21-09 13:36: `leadResultFields."Hvilken type møde" = "Telefonnummer"`.
- Salg på produktet fra 15-08 til nu: 180 uden mødetype (står på 75 kr, korrekt), 19 med `Onlinemøde` (90 kr, matcher), **2 med `Telefonnummer`** (står fejlagtigt på 75 kr). Ingen linjer er manuelt låst.

## Det der laves

1. **Betingelsen på den ene regel rettes** fra `Telefonmøde` til `Telefonnummer` på reglen `Tlfmøde`. Satser (30/200), prioritet, gyldighedsdato og kampagneafgrænsning er uændrede. Onlinemøde-reglen og alle andre produkter røres ikke.
2. **Rematch** på kun dette produkt med startdato 15-08-2026 — først tørkørsel, hvor jeg viser hvor mange linjer der ændrer beløb, derefter for alvor.

Forventet resultat: de 2 salg med `Telefonnummer` går fra 75 kr til 30 kr provision (omsætning uændret 200 kr). De 19 Onlinemøde-salg og de 180 uden mødetype er uændrede. Fremadrettet rammer reglen automatisk.

## Verifikation efter kørslen

- Optælling pr. mødetype og sats på produktet fra 15-08 og frem, før/efter.
- Kontrol af at de 180 linjer uden mødetype stadig står 75/200, og de 19 Onlinemøde stadig 90/200.

## Teknisk

- Datakonfiguration, ingen kodeændring: `UPDATE product_pricing_rules SET conditions = '{"Hvilken type møde": "Telefonnummer"}' WHERE id = '22d1d924-9976-4957-a9c9-dc97adf0ecf9'`.
- Rematch via eksisterende `rematch-pricing-rules` med `product_id=b3e04a4a…` og `min_sale_datetime=2026-08-15T00:00:00`, først `dry_run: true`. Motoren, `_shared/pricing-service.ts` og `integration-engine` ændres ikke; ingen deploy, ingen migration, ingen RLS-ændring.
- Rød zone (provisionsgrundlag). Ændringen er afgrænset til én regel og ét produkt; manuelle låse respekteres (der er ingen i perioden). Før/efter-tal rapporteres.
