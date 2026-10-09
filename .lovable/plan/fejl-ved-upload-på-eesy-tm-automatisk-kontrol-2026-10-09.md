# Fejl ved upload på Eesy TM automatisk kontrol

## Hvad er bekræftet
- Filen læses fint (log 13:49:45: 272 rækker, 272 telefonnumre).
- Derefter henter siden Eesy TM-salg til matchingen. Det kald fejler kl. 13:49:53 med **"canceling statement due to statement timeout"** (HTTP 500).
- Kaldet: `UploadCancellationsTab.tsx:1221-1237` henter ALLE ikke-annullerede salg på Eesy TM-kampagnerne (8.022 salg tilbage til aug. 2025, ca. 6,5 MB `raw_payload`) i sider á 1.000, sorteret nyeste først, uden datoafgrænsning.
- Mængden er ikke stor i sig selv, så den sandsynlige årsag er adgangskontrollen (RLS) på `sales`, der evalueres pr. række sammen med de tunge JSON-felter. Det er endnu ikke bekræftet.

## Plan
1. **Bekræft årsagen (read-only):** kør `EXPLAIN` på samme forespørgsel som din bruger vs. uden RLS, og tjek RLS-politikkerne på `sales`. Ingen kundeværdier læses.
2. **Ret i matchingens datahentning (gul zone, ingen ændring i matchlogik eller løn):**
   - Mindre sider (fx 250) og kun de felter matchingen faktisk bruger, så hvert kald holder sig under timeout.
   - Hvis RLS er årsagen: en lille, læse-kun `SECURITY DEFINER`-funktion der henter kandidatsalg for én kunde, med adgangstjek på annulleringsrettigheden — samme felter, samme filtre (inkl. Eesy TM-fallback for salg uden kampagne).
   - Ingen datoafgrænsning tilføjes uden din beslutning, da gamle salg kan blive annulleret.
3. **Tydelig fejlbesked** i stedet for at upload hænger, hvis hentning fejler.
4. **Test:** upload samme fil igen; bekræft samme antal kandidatsalg og matches som før fejlen, og at TDC/andre kunders upload er uændret.

## Rør ikke
Matchregler, fradrag, provision/løn, godkendelseskø, Data import-regler.
