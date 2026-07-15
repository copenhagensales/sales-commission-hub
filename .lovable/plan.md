## Problem
Den seneste `relatel-produkter-v2.xlsx` inkluderer alle Relatel-produkter — også dem med `is_hidden = true`. Filen har kun en "Aktiv"-kolonne (som er `is_active`), så skjulte produkter ligger blandet med synlige uden markering.

## Løsning
Regenerér filen med samme udvælgelses-strategi (klient ILIKE '%relatel%' + kendte Relatel-navnemønstre), men **tilføj filter `is_hidden = false`** på både fane 1 og fane 2.

## Output
Ny fil: `/mnt/documents/relatel-produkter-v3.xlsx`

**Fane 1 – Aktuelle satser** (uændret struktur, kun filter tilføjet):
Produkt, Klient, Kampagne, Aktiv, Base provision, Base omsætning, Aktuel regel, Provision v. tilskud=0, Omsætning v. tilskud=0, Gældende fra, Gældende til, Prioritet, Har tilskud-diff.

**Fane 2 – Historik (alle regler)** (uændret struktur, kun filter på produkter):
Produkt, Regel-navn, Provision, Omsætning, Betingelser, Kampagne-filter, Gældende fra, Gældende til, Prioritet, Aktiv, Status, Oprettet, Sidst opdateret.

## Verifikation
1. Efter generering: tæl rækker på fane 1 og bekræft alle har `is_hidden = false` i DB.
2. Sammenlign med v2 (155 rækker) — forventet fald svarende til antallet af skjulte Relatel-produkter (~66+).
3. Rapportér til dig: antal produkter i v3 vs. v2, og eksempler på hvilke produkter der er fjernet.

## Ingen kode-ændringer
Dette er en engangs-eksport til `/mnt/documents/` — ingen ændringer i repo eller DB.
