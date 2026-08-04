# Excel-udtræk: Eesy FM produkter med satser pr. regel

## Formål
Én Excel-fil der viser **kun aktive** Eesy FM produkter (`is_active = true`) og hvilken provision + CPO (omsætning) der udløses på hver af de to regler — **Eesy gaden** og **Eesy marked** — med fallback til grundsatsen når der ikke findes en regel. Inaktive produkter udelades helt.

## Hvad udtrækket bygger på (verificeret i data)
- Eesy FM har to kampagner: **Eesy gaden** (10 produkter, 6 aktive) og **Eesy marked** (9 produkter, 1 aktivt: 5G Internet). Kun de aktive kommer med.
- Alle 18 prisregler ligger på produktrækkerne under **Eesy gaden**. Hver af de 9 regel-bærende produkter har præcis 2 regler, koblet via `campaign_mapping_ids` til hhv. mappingen "Eesy gaden" og "Eesy marked".
- Produktrækkerne under kampagnen **Eesy marked** har **ingen** regler — de kører på grundsats.
- `Fri 20 - 89 (KUN IKKE NUUDAY)` (Eesy gaden) har ingen regler — grundsats.
- Alle regler er aktive og uden gyldighedsdatoer (`effective_from`/`effective_to` tomme).

## Kolonner i filen
| Kolonne | Indhold |
| --- | --- |
| Produkt | produktnavn |
| Kampagne (produktrække) | Eesy gaden / Eesy marked |

| Grundsats provision | `products.commission_dkk` |
| Grundsats CPO | `products.revenue_dkk` |
| Gaden – provision | fra reglen mappet til "Eesy gaden", ellers grundsats |
| Gaden – CPO | samme logik |
| Gaden – kilde | Regel / Grundsats (fallback) |
| Marked – provision | fra reglen mappet til "Eesy marked", ellers grundsats |
| Marked – CPO | samme logik |
| Marked – kilde | Regel / Grundsats (fallback) |
| Note | fx "ingen regler — grundsats" |

Rækker sorteres alfabetisk pr. kampagne.

## Teknisk
- Read-only SQL mod `products` (filtreret på `is_active = true`), `client_campaigns`, `clients`, `product_pricing_rules` og `adversus_campaign_mappings` (regel→kampagne via `campaign_mapping_ids`).
- Filen genereres med openpyxl og lægges i `/mnt/documents/eesy-fm-satser.xlsx`.
- Ingen ændringer i kode eller data.
