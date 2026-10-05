# TDC Idriftsættelsesmail – udkast

Ny side under "Mit hjem", ved siden af "TDC Opsummering". Sælgeren udfylder felter, og siden laver mailteksten live med en "Kopiér mail"-knap (både som formateret tekst til Outlook og som ren tekst). Alt der ikke er gult i Word-filen står fast.

## Felter (mine gæt – rettes til bagefter)

| Gult sted i mailen | Felt på siden |
|---|---|
| Omstillingsløsning + One+ / One+ Løsning | Valg: "Omstillingsløsning + One+ Løsning" eller "One+ Løsning" |
| Kontaktperson | Tekstfelt (påkrævet) |
| Telefonnummer | Tekstfelt (påkrævet, vist som 8 cifre) |
| Nummerliste | Tabel med rækker: Nummer/Navn, Abonnement, Simkortnummer – "Tilføj række" / slet |
| Mobilt bredbånd-tekst | Valg: Ingen / Datadelingskort / Eget mobilevoice-abonnement med fiktivt nummer |
| "Der medfølger ikke router" | Afkrydsning (vises kun hvis mobilt bredbånd er valgt) |
| "5G Fri internet med router og simkort" | Afkrydsning |
| Tilskud (overskrift + beløb + produkt) | Afkrydsning "Har tilskud" → Beløb (kr.) + Produkt-tekst. Fravalgt = hele tilskudsafsnittet fjernes |
| Funktionsliste | Afkrydsninger for de 9 funktioner (Velkomsthilsen, Åbne- og lukketider, Tidsstyring, Hovednummervisning, Kø funktion, 0-valg, Menuvalg, SMS på mobilhovednummer, Call Record). Ingen valgt = afsnittet fjernes |

Faste afsnit: hilsen, "Videre forløb", TDC-shop-tekst, "Sådan finder du dit simkortnummer" og afslutning – præcis som i Word-filen.

## Adgang og placering
- Samme rettighed som TDC Opsummering, så de samme personer ser den uden ændring i rettighedssystemet.
- Kun tekstgenerering i browseren – intet gemmes, ingen kundedata i databasen.

## Teknisk
- Ny side `src/pages/TdcIdriftsaettelse.tsx` + `src/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm.tsx` (mønster som `TdcOpsummeringForm`).
- Rute `/tdc-idriftsaettelse` i `routes/config.tsx` + `pages.ts`, `positionPermission: "menu_tdc_opsummering"`.
- Menupunkt i `AppSidebar.tsx` under samme betingelse som TDC Opsummering; tilføj stien til "Mit hjem"-aktivlisten.
- Kopiering via `ClipboardItem` med `text/html` + `text/plain`.
- Ingen DB, ingen migration, ingen rød-zone-filer.

## Åbne spørgsmål (svar gerne løbende)
1. Skal "Kære kunde" erstattes med kundens navn?
2. Skal siden også have en offentlig version uden login, som TDC Opsummering har?
3. Skal mailen kunne sendes direkte fra Stork, eller er kopiér nok?
