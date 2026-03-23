
Fixet skal laves i backend-RPC’en, ikke i TDC-viewet alene.

Hvad jeg fandt:
- Der er faktisk data i perioden for TDC Erhverv: ca. 297 salg på `sales` og 175 rækker i `get_sales_report_detailed`.
- Problemet er derfor ikke manglende data eller adgang.
- `get_sales_report_raw` fejler med HTTP 400: `column s.adversus_opp_number does not exist`.
- Kolonnen blev tidligere fjernet fra `sales`, men RPC’en blev senere ændret til stadig at læse den.
- Derfor viser UI fejlagtigt “Ingen salgsdata”, selvom forespørgslen i virkeligheden crasher.

Plan:
1. Opdater `get_sales_report_raw` i en migration
- Fjern afhængigheden til `s.adversus_opp_number`.
- Beregn OPP-nummer direkte fra eksisterende payload-data i stedet, fx:
  - `raw_payload->>'legacy_opp_number'`
  - `raw_payload->'leadResultFields'->>'OPP nr'`
  - fallback fra `leadResultData` hvor `label = 'OPP nr'`
- Det er den sikreste løsning, fordi den matcher den nuværende datamodel i stedet for at genindføre en kolonne, som allerede er udfaset.

2. Ret rapport-siden så fejl vises som fejl
- `ReportsManagement.tsx` skal håndtere `isError/error` for rådata-queryen.
- Ved backend-fejl skal siden vise en tydelig fejlmeddelelse i stedet for “Ingen salgsdata fundet”.
- Excel-knappen skal også være låst eller vise fejlstatus, hvis rådata ikke kunne hentes.

3. Behold OPP-kolonnen i råtabellen og eksporten
- `RawSalesTable.tsx` og Excel-eksporten kan fortsat bruge feltet `adversus_opp_number`.
- Når RPC’en er rettet, vil TDC Erhverv-rådata igen loade, og OPP-feltet vil blive udfyldt dér hvor det findes i payloaden.

Hvorfor denne løsning:
- Den løser den aktuelle blocker med det samme.
- Den følger den faktiske datamodel i databasen.
- Den undgår at genskabe en kolonne, som tidligere er blevet migreret væk.
- Den gør også UI’et ærligt, så lignende fejl ikke ligner “0 data” fremover.

Filer der skal ændres:
- `supabase/migrations/...` — ret `get_sales_report_raw`
- `src/pages/reports/ReportsManagement.tsx` — håndter `isError/error` for rådata-queryen og export state
- Eventuelt ingen ændring nødvendig i `src/pages/reports/RawSalesTable.tsx` ud over at understøtte en fejlvisning, hvis vi vil holde den logik samlet der
