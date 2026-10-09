# Slet alder fra Eesy FM-annulleringsuploads

## Hvad der ligger i dag (bekræftet ved optælling)
- Eesy FM har 1.476 gemte uploadlinjer under Annulleringer. 230 af dem har stadig feltet "Age", alle fra uploaden 28. maj 2026.
- Hverken matchingen, provisionen eller lønfradragene læser "Age". Det er samme forhold som for Eesy TM.

## Plan
1. Før sletningen tælles linjerne, deres status og fradrag samt provision og omsætning på de tilknyttede Eesy FM-salg.
2. Kun feltet "Age" fjernes fra de 230 linjer. Alt andet bliver liggende uændret: andre felter, status, matchning og salg.
3. Sletningen logges med antal og årsag i loggen over oprydning af persondata.
4. Kontrol: 0 linjer har "Age". Antal, status, fradrag, provision og omsætning er de samme som før.

## Tekniske detaljer
- `uploaded_data - 'Age'` på `cancellation_queue`, afgrænset til Eesy FM via `cancellation_imports.client_id`. `sale_items` og `sales` røres ikke. Der skrives én række i `gdpr_cleanup_log`.
