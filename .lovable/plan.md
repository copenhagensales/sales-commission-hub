# Relatel-fiber: tæl kun leads lavet efter skiftet til Relatel

## Fund
- Jacob H.'s ene lead er fra 19. okt.; han blev lagt på Relatel-teamet 26. okt. Han har ingen planlagte teamskift og intet i fjernelsesloggen, så datoen han blev medlem er det eneste spor af skiftet.

## Ændring
- Relatel-fibertælleren tæller kun et lead, hvis det er lavet på eller efter den dato, sælgeren blev medlem af Relatel-teamet.
- Det gælder både KPI-kortene "(+N fiber)" og fibertallet på sælgerrækkerne.
- Jacobs lead fra 19. okt. forsvinder fra Relatel-boardet. Det bliver stående på TDC Erhverv-boardet som i dag.
- Provision, løn, salg og teamdata ændres ikke.

## Teknisk
- `supabase/functions/tv-dashboard-data/index.ts`: `getRelatelEmailToEmployee` gemmer også `team_members.created_at` pr. mail. Både `handleFiberSalesCount` og `handleFiberBoardStats` springer en linje over, hvis `sale_datetime` ligger før den dato. Herefter udrulles funktionen.
- Kontrol: en optælling, der kun læser og kun viser antal, skal give 0 Relatel-leads i den aktuelle lønperiode. Bagefter kontrolleres boardet.
- Risiko: `created_at` er medlemsdatoen for den nuværende teamrække. Hvis en sælger nogensinde bliver lagt på teamet igen, regnes datoen fra den nye række, så leads fra før det skift tæller heller ikke. Det svarer til den ønskede regel.
