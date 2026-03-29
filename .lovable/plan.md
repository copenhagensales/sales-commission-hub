
Årsagen er nu ret tydelig: `51759867` står stadig under “Fejl i match”, fordi merge/dedup først sker i `sendToQueueMutation`, mens “Fejl i match” bygges tidligere ud fra `matchedRowIndices` og `unmatched_rows`. Derfor bliver ekstra Excel-rækker for samme telefon stadig behandlet som umatchede, selv om de senere merges til ét salg.

Planen for at rette det uden at ændre jeres øvrige logikker er:

1. Flyt merge-begrebet frem til preview-laget
- Lav én fælles beregning i `UploadCancellationsTab.tsx`, som grupperer `matchedSales` pr. normaliseret telefonnummer allerede efter matching.
- Beregningen skal returnere:
  - `mergedMatchedSales` = én række/salg pr. telefonnummer
  - `mergedAwayRows` = de ekstra Excel-rækker som er opslugt af merge
  - `coveredRowIndices` = alle originale Excel-rækker, der enten blev direkte matchet eller merged ind i et andet match

2. Brug “coveredRowIndices” i stedet for kun `matchedRowIndices`
- Når previewets `unmatchedRows` beregnes, skal rækker som er merged ind i et andet salg ikke længere tælles som “Fejl i match”.
- Det løser præcis problemet med numre som `51759867`, der i dag bliver vist som annullering under fejl, selv om de reelt er del af et merge.

3. Behold klassificeringslogikken uændret
- Selve klassificeringen for combined upload (`both`) skal fortsat være den samme.
- Den merged række skal stadig kun blive klassificeret som annullering, hvis alle tilhørende Excel-rækker for det telefonnummer er annulleringer.
- Hvis bare én af de merged rækker ikke er annullering, skal det merged salg ikke behandles som annullering.

4. Brug samme merge-resultat i hele previewet
- “Matched”-tab skal vise `mergedMatchedSales` i stedet for rå `matchedSales`, så preview matcher det der faktisk sendes videre.
- “Dubletter”-tab skal vise de rækker der blev merged væk, ikke bare rå grupper fra `matchedSales`.
- “Send til godkendelse”-knappen og counts skal bruge samme merged datasæt.

5. Behold “Fejl i match” til reelle fejl
- “Fejl i match” skal kun vise rækker der hverken:
  - blev matched direkte
  - eller blev opslugt af et telefon-merge
- På den måde bliver samme salg ikke vist både som match og som fejl.

6. Løs React key-advarslen samtidig
- Der er også en konsol-advarsel om duplicate keys i preview-tabellen.
- Row keys skal ændres til en stabil nøgle, der inkluderer `saleId` + telefon/rowIndex eller anden unik markør, så UI’et ikke duplikerer eller skjuler rækker forkert.

Teknisk scope
- Fil: `src/components/cancellations/UploadCancellationsTab.tsx`
- Ingen ændringer i backend-tabeller eller eksisterende godkendelseslogik
- Ingen ændringer i selve match-motoren
- Kun synkronisering af merge/dedup mellem:
  - preview
  - unmatched/match errors
  - send-to-queue

Forventet resultat
- `51759867` forsvinder fra “Fejl i match”, hvis rækken allerede er dækket af et merge med samme telefonnummer.
- Uploaden opfører sig fortsat sådan, at flere Excel-rækker bliver til ét salg.
- En merged række tæller kun som annullering, hvis alle merged rækker er annulleringer.
- Øvrige logikker for matching, produktmatch og godkendelseskø forbliver uændrede.
