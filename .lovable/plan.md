# Regenerér Relatel Excel-fil (v2)

## Problem
Første fil manglede produkter fordi jeg joinede via `clients → client_campaigns → products`. Produkter som "Fri Tale - 1000 GB BTL #4" har `client_campaign_id = NULL` og røg dermed ud af filtret. Dine rettelser fra 14/7 findes — de sidder bare på produkter uden formel klient-kobling.

## Ny udvælgelses-strategi

Da `client_campaign_id` ikke er pålidelig til at identificere Relatel-produkter, samler jeg dem via bredere kriterier:

1. **Alle produkter** hvor `client_campaigns → clients.name ILIKE '%relatel%'` (de 68 fra før), PLUS
2. **Alle produkter** hvor navnet matcher Relatel-mønstre: `Fri Tale%`, `MBB%`, `M2M%`, `5 Timers%`, `Contact Center%`, `Bruger +MV%`, `Professional (ATL)%`, samt navne der figurerer på Relatel-dashboardet.

**Sikkerhedscheck inden bygning:** Jeg lister først kandidat-produkter til dig (navn + id + har-regel-fra-14/7) så du kan bekræfte omfanget — eller sige "tag alle 87 produkter der fik regler 14/7-2026 med".

## Nye kolonner (samme som før + historik)

Fane 1 – **Relatel produkter (aktuelle satser)**:
1. Produkt
2. Base provision (kr) + Base omsætning (kr) *(fra `products`)*
3. **Aktuel regel-navn**
4. **Provision v. tilskud=0 (kr)** *(fra aktive regel der matcher tilskud=0)*
5. **Omsætning v. tilskud=0 (kr)**
6. **Gældende fra**
7. **Gældende til** (blank = åben)
8. Prioritet
9. Har "tilskud"-differentiering (Ja/Nej — findes særskilt regel med `subsidy_percent > 0`?)

Fane 2 – **Historik (alle regler)**:
Én række pr. regel (aktiv + udløbet), sorteret pr. produkt → efter `effective_from` DESC. Kolonner: produkt, regel-navn, provision, omsætning, betingelser (tekst), gældende fra, gældende til, prioritet, oprettet-dato, status (aktiv/udløbet).

## Fremgangsmåde
1. Jeg lister kandidat-produkter til bekræftelse.
2. Efter du bekræfter, bygger jeg xlsx'en direkte i `/mnt/documents/relatel-produkter-v2.xlsx`.
3. Verificerer indhold ved genindlæsning før levering.

## Åbne spørgsmål
1. Skal jeg tage **alle 87 produkter med regel-ændring 14/7-2026** med, eller kun dem der matcher "Relatel-lignende" navne?
2. Skal historik-fanen inkludere `pricing_rule_history` (revisions-log), eller kun de nuværende regler (aktive + udløbne varianter)?
