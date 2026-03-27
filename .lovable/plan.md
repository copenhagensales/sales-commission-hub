
Problem:
Systemet kan godt finde salget via OPP i “Sales Overview”, men annullerings-matcheren bruger en anden og mere fejlbehæftet OPP-udtrækning.

Bekræftet årsag:
- TDC Erhverv-konfigurationen matcher på `opp_column = "OPP nr."`.
- I mindst ét konkret salg (OPP-1073213) ligger den fulde værdi korrekt i `raw_payload.leadResultFields["OPP nr"]` og `leadResultData`.
- `UploadCancellationsTab` returnerer dog `legacy_opp_number` først, og i dette salg er den værdi trunkeret: `OPP-107321`.
- Derfor finder søgningen salget, men matching fejler mod Excel-rækken.
- Jeg kunne også bekræfte, at der er mange TDC-salg hvor `legacy_opp_number` afviger fra den fulde OPP-værdi i payloaden.

Hvorfor søgning virker:
- “Sales Overview” bruger `search_sales`, som søger i `raw_payload::text`.
- Den finder derfor den fulde OPP, selv når annullerings-flowet læser den forkerte/trunkerede fallback-værdi.

Plan:
1. Centralisér OPP-udtræk i en delt helper
- Opret én fælles utility til OPP-ekstraktion, så alle TDC-relaterede views bruger samme logik.
- Prioritér fulde payload-felter før legacy-feltet:
  1) `leadResultFields`
  2) `leadResultData`
  3) top-level OPP-nøgler
  4) `legacy_opp_number` som sidste fallback
- Brug robust label-matching (`OPP nr`, `OPP-nr`, med/uden punktum).

2. Opdatér matching-flowet
- Skift `extractOpp` i `src/components/cancellations/UploadCancellationsTab.tsx` til den fælles helper.
- Match på normaliseret OPP (trim + upper-case), men med korrekt prioritet så trunkerede legacy-værdier ikke vinder.

3. Gør visningerne konsistente
- Erstat lokale `extractOpp`-implementeringer i:
  - `src/components/cancellations/UnmatchedTab.tsx`
  - `src/components/cancellations/DuplicatesTab.tsx`
  - `src/components/cancellations/ApprovedTab.tsx`
- Så samme salg viser samme OPP overalt i annulleringsmodulet.

4. Verificér målrettet
- Test det konkrete eksempel `OPP-1073213`.
- Bekræft at preview nu matcher salget.
- Bekræft at antallet af umatchede rækker falder.
- Tjek at Dubletter, Afventer og Godkendte viser samme OPP-værdi.

Tekniske noter:
- Ingen databaseændringer er nødvendige.
- Dette er primært en logikfejl i prioriteringen af OPP-kilder.
- Den sikre løsning er ikke bare “mere fuzzy matching”, men at bruge den rigtige kilde først og gøre logikken ens på tværs af komponenterne.
