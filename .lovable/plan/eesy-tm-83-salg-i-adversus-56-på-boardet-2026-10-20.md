# Eesy TM: 83 salg i Adversus, 56 på boardet

## Fund (read-only, intet ændret)

- Stork har i dag 31 Eesy TM-salg med 56 produkter. Det er de 56, boardet viser. Boardet regner rigtigt ud fra det, der er kommet ind.
- **Seneste salg, der er kommet ind, er fra kl. 14:25 dansk tid.** Efter det er der ikke kommet noget ind.
- Hentningen fra Adversus kører stadig hvert ca. 15. min og melder "success", men finder 0 nye salg. Den sidste fulde genhentning kl. 15:16 fandt heller ikke noget nyt.
- Alle salg, der er kommet ind i dag, er koblet til kendte Eesy TM-kampagner. Der ligger ingen salg i Stork uden kobling.

Så fejlen er der noget om: der mangler cirka 27 produkter (83 − 56), og de er lukket i Adversus efter kl. 14:25. Hentningen ser dem ikke. Hvorfor er endnu ikke bevist.

## Næste skridt (kun læsning mod Adversus, ingen skrivning)

1. Hent dagens lukkede Eesy TM-salg direkte fra Adversus og tæl dem pr. time og kampagne. De 83 skal kunne genfindes.
2. Find de salg, der ikke er i Stork, og se, hvad de har til fælles. Mulige årsager:
   - ny kampagne uden kobling
   - anden status eller andet resultat
   - ændret felt
   - tidsvindue eller sidebladring i hentningen
3. Rapportér årsagen med tal. Rettelser og genhentning sker først efter godkendelse.

## Teknisk

- `dialer_integrations` "Eesy TM" (adversus): last_status success. `integration_sync_runs` 13:28 UTC records 0; 13:16 UTC 136 (fuld genhentning, intet nyt).
- Salg i dag: source "Eesy TM", 8 dialer-kampagner, alle mappet; max sale_datetime 12:25:35 UTC.
- Opslaget sker via den eksisterende read-only diagnose-funktion mod Adversus. Ingen ændring i integration-engine eller webhook i dette trin.
