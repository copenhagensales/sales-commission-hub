# Løn-fanen viser 0 kr provision — for alle sælgere, ikke kun Fanny

## Fund (read-only, bekræftet)
- Jeg har åbnet Fannys Løn & Mål i preview:
  - **Mål-fanen** viser 2.790 kr. Det passer: ny lønperiode startede i dag (15/10), og hun har 4 salg i dag til i alt 2.790 kr.
  - **Løn-fanen** viser 0 kr provision for 15/10–14/11, selvom samme 4 salg findes.
  - Sidste periode (15/9–14/10) har hun 51.465 kr. i provision i databasen.
- **Årsag:** Løn-fanen henter kun salg, hvor feltet `status` er forskelligt fra "rejected" (`PayrollDayByDay.tsx:44`). Feltet `status` er tomt på **alle** salg i databasen (0 af alle rækker har en værdi). I databasen tæller "tom" ikke som "forskellig fra", så alle salg falder fra. Løn-fanens provision er derfor 0 kr for alle, ikke kun Fanny.
- Kontrol af en anden sælger: Mikkel Winther Fjeldsøe Kirk har agent-mapping og salg i dag. Hans **Løn-fane** viser også 0 kr. Når andre sælgere "kan se det", er det derfor sandsynligvis **Mål-fanen**. Den virker allerede for sælgere med mapping i den publicerede app. For Fanny virker Mål-fanen først efter Publish af gårsdagens rettelse.
- Mål-fanen og alle tavler bruger i stedet `validation_status` og udelader kun "rejected" og "cancelled" (salgsoptællingen, `get_sales_aggregates_v2`). Det er den gældende regel.
- Mindre fund: Løn-fanen afgrænser datoer i UTC (`T00:00:00`), mens Mål-fanen bruger dansk tid. Salg mellem kl. 00 og 02 dansk tid kan derfor havne i forkert dag eller periode.
- Gårsdagens rettelse (arbejdsmail-fallback) virker i preview. Den kræver stadig Publish for at nå den rigtige app.

## Plan
1. Løn-fanen bruger samme salgsregel som Mål-fanen: salg tæller, medmindre `validation_status` er "rejected" eller "cancelled". Tom status tæller med. Annullerede salg vises fortsat kun i kassen "Annullering", ikke i provision. Så tæller vi dem ikke to gange.
2. Datoafgrænsningen følger dansk tid, ligesom på Mål-fanen.
3. Reglen lægges i én lille funktion i `src/lib/` og testes: pending/tom tæller med, cancelled tæller ikke, rejected tæller ikke.
4. Ingen ændring af provisionssatser, løndata, lønberegning (`useSellerSalariesCached` m.fl.) eller databasen. Kun hvad Løn-fanen viser.
5. Browserkontrol:
   - Fannys Løn-fane viser 2.790 kr for i dag, og forrige periode viser 51.465 kr.
   - Summen matcher Mål-fanen.
   - Stikprøve på én TM-sælger.

## Teknisk
- Filer: `src/components/my-profile/PayrollDayByDay.tsx` (salgsforespørgsel: fjern `.neq("status","rejected")`, hent `validation_status`, filtrér med den nye funktion, datoer via periodens Date-objekter i ISO). Ny `src/lib/payrollSaleFilter.ts` og test til den.
- Påvirkning: Løn-fanens provisionstal går fra 0 til de rigtige tal for alle provisionslønnede. Det er et rent visningsfund, men tallene bliver synlige for sælgerne.
- Zone: Løn-visning (gul/rød). Ingen beregning af udbetalt løn ændres.
