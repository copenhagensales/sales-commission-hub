# Excel: TDC Erhverv fibersalg, september 2026 (1/9–30/9)

## Datagrundlag (verificeret)
De 6 fiberprodukter fra TDC-fiberboardet har i perioden 84 salgslinjer:

| Produkt | Linjer | Antal |
| --- | --- | --- |
| Lead Provi HAP | 27 | 31 |
| Lukket salg HAP | 23 | 25 |
| Fuldt salg HAP | 22 | 23 |
| Fuldt salg VOK | 5 | 5 |
| Lead Provi VOK | 4 | 4 |
| Lukket salg VOK | 3 | 3 |

## Kolonner
- **OPP-nummer** — fra salgets dialerdata ("OPP nr")
- **Sælgernavn** — Stork-medarbejdernavn via sælgerkobling (fallback: dialerens agentnavn)
- **Produkt** — kun fiberproduktet (med antal hvis > 1); øvrige produkter på samme salg udelades
- **Salgsdato** — i dansk tid

Én række pr. fibersalgslinje, sorteret efter dato.

## Spørgsmål ved godkendelse
"Lead Provi"-linjer medtages som standard (de tæller på fiberboardet). Sig til, hvis kun rigtige salg (Lukket/Fuldt) skal med — så er det 58 linjer.

## Teknisk
Ét læse-SELECT mod salgslinjer + salg + produkter + medarbejderkobling. Filen genereres til Files. Ingen ændringer i kode eller database.
