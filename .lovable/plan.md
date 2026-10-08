# Opsummering: få alle produkter og den rigtige pris med fra tilbuddet

## Årsag (bekræftet i koden)
`src/lib/tdcTilbud/prefill.ts` (`buildPrefill`) sender kun to grupper videre til opsummeringen:
- mobilabonnementer (Mobilpakker og Kun EU)
- 5G-bredbånd/fiber

Produkter under **Omstilling** og **Diverse** (fx Professionel/Standard omstilling, DDI nummer, MB hovednummer, IOT, Internetfilter, Passivt nummer, Extra datakort) bliver sprunget over. De tælles med i tilbuddets pris, men ikke i opsummeringen. Derfor bliver prisen på side 2 lavere end på side 1.

## Ændring
- I opsummeringen tilføjes en linje lige efter mobil- og bredbåndslinjerne, når der er valgt Omstilling- eller Diverse-produkter:
  "Derudover får du 1 x Professionel omstilling, 2 x DDI nummer … til en samlet månedlig pris på X kr. ekskl. moms."
- Summen af alle linjer i opsummeringen bliver dermed den samme som tilbuddets "Pris pr. måned ekskl. moms".
- Produkter uden kendt pris (MBB 200/40) vises med navn, ligesom i dag.

## Tekniske detaljer
- `prefill.ts`: tilføj `otherText` og `otherPrice` for `kind === "other"` i `buildPrefill`. `applyPrefillToSummary` indsætter den ekstra linje efter mobil- eller MBB-linjen.
- Test i `calc.test.ts` (eller i den nye `prefill.test.ts`): summen af mobil-, MBB- og øvrige priser skal være lig med `calcTilbud(...).price`.
- Ingen database, løn eller provision berøres. Grøn/gul zone.
