# Relatel-salg 15/5 – 14/6 2026 pr. sælger

Data er allerede hentet direkte fra DB (`sales` + `sale_items`, `client_campaign_id = Relatel Products`, `sale_datetime ∈ [2026-05-15, 2026-06-15)`, ekskl. annullerede sale_items). 268 salg fordelt på 20 sælgere.

## Resultat (sorteret efter antal salg)

| Sælger | Email | Antal salg | Antal produkter | Omsætning (kr) | Provision (kr) |
|---|---|---:|---:|---:|---:|
| Thorbjørn Larsen | thor@cph-relatel.dk | 50 | 126 | 234.888,00 | 108.988,60 |
| Alexander Gosvig | algo@cph-relatel.dk | 32 | 96 | 161.225,00 | 72.896,50 |
| Jakob Kranker | jakr@cph-relatel.dk | 28 | 74 | 126.538,25 | 56.377,00 |
| Anders Kristensen | ankr@cph-relatel.dk | 22 | 107 | 150.721,50 | 67.802,00 |
| Benjamin Solberg | beso@cph-relatel.dk | 22 | 94 | 157.895,00 | 72.075,00 |
| Frederik Kvistgaard | fbdo@cph-relatel.dk | 22 | 29 | 53.189,75 | 24.292,96 |
| Gustav Diebel | gudi@cph-relatel.dk | 17 | 64 | 79.177,50 | 36.827,50 |
| Noah Zylber | nozy@cph-relatel.dk | 17 | 54 | 100.076,25 | 44.472,00 |
| Silas Von Pedersen | ss@cph-relatel.dk | 16 | 42 | 68.254,25 | 31.043,20 |
| Sarah Akarsu Husein | sahu@cph-relatel.dk | 9 | 21 | 39.520,25 | 17.162,00 |
| Samuel Rosenborg | saro@cph-relatel.dk | 9 | 29 | 57.681,00 | 24.665,00 |
| Simon | simo@cph-relatel.dk | 7 | 15 | 25.910,75 | 11.343,00 |
| Emillio | jona@cph-relatel.dk | 5 | 12 | 23.855,00 | 10.250,00 |
| Carl Nielsen | carl@cph-relatel.dk | 3 | 25 | 49.219,75 | 21.967,00 |
| Mathias Møller | mamo@cph-relatel.dk | 2 | 2 | 3.750,00 | 1.650,00 |
| Emilio | jona@cph-relatel.dk | 2 | 7 | 11.451,25 | 5.009,00 |
| Rasmus Mikkelsen | mikkelsen@cph-relatel.dk | 2 | 0 | 0,00 | 0,00 |
| Rasmus Quilding | raqu@cph-relatel.dk | 1 | 2 | 4.400,00 | 1.760,00 |
| Axel | axel@cph-relatel.dk | 1 | 2 | 3.925,00 | 1.760,00 |
| Karl Koppel | kk@cph-relatel.dk | 1 | 0 | 0,00 | 0,00 |

## Bemærkninger
- `jona@cph-relatel.dk` figurerer to gange (stavet "Emillio" og "Emilio") — samme person, agent_name ikke normaliseret.
- 3 sælgere har 0 i omsætning/provision — sale_items mangler enten mapping eller er alle annulleret.

## Næste skridt
Plan-mode tillader ikke filskrivning til `/mnt/documents/`. **Skift til build mode**, så eksporterer jeg samme datasæt direkte som `relatel-salg-15maj-14jun-2026.csv` (klar til download). Ingen kodeændringer — kun en CSV-fil.
