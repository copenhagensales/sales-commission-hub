# Pulsen på forsiden – kompakt "Seneste fra Pulsen"

## Idé
Et smalt kort på forsiden med de 3 nyeste indlæg fra Huset. Hvert indlæg vises på én linje, og kortet linker videre til Pulsen. Kortet viser kun et uddrag, ikke selve feedet. Man kan derfor ikke kommentere eller reagere fra forsiden.

```text
+--------------------------------------------------------------+
| SENESTE FRA PULSEN                          Se alle  ->      |
| (o) Rasmus H. gav ros til Jonas L. · "Stærk afslutning..." 12 min |
| (o) Mia K. spørger · "Hvem har styr på ..."   i går 14:05  2 svar |
| (o) Oscar B. · [billede] "Fredagsbar i ..."      3 okt     ♥ 8 |
+--------------------------------------------------------------+
```

## Placering
- Kortet placeres lige efter fejringerne og før ligaen og begivenhederne. Det fylder fuld bredde, men holdes på cirka 180px højde.
- En lille prik ved "Se alle" viser, at der er nye indlæg siden sidst. Prikken bygger på det, Pulsen allerede husker om, hvornår man sidst var der.
- Er der ingen indlæg i Huset, vises kortet slet ikke. Der er altså ingen tom kasse.
- Kortet vises kun for brugere, der har adgang til Pulsen.

## Indhold pr. linje
- Lille avatar og navn i fed skrift. Typen står som tekst: "gav ros til …", "spørger" eller "delte et billede".
- Teksten afkortes til én linje. Billeder vises ikke, kun en lille billedmarkør.
- Til højre står tiden i samme format som i Pulsen ("nu", "12 min", "i går 14:05").
- Antal reaktioner eller svar vises som et lille tal.
- Klik på en linje åbner Pulsen ved det indlæg.

## Det kommer ikke med
- Team-indlæg, så forsiden kun viser Huset.
- Begivenheder og fejringer, da de allerede findes på forsiden.
- Reaktionsknapper og kommentarfelt.
- Milepæle, indtil de kommer i trin 6. Derefter kan de vises som samme type linje.

## Teknisk
- Ny hook `usePulsenLatest(limit = 3)` i `src/hooks/usePulsen.ts`. Den bruger samme forespørgsel som feedet med audience='house' og ikke slettet, med limit 3 og staleTime 60s. Der kommer ingen ny RLS, og alt bygger på de eksisterende regler.
- Ny komponent `src/components/pulsen/PulsenLatestCard.tsx`. Den genbruger `PulsenAvatar` og `lib/pulsen/format.ts`. Kortet er `bg-card rounded-3xl`, og den eneste accent er emerald.
- Prikken for nye indlæg sammenligner det nyeste `created_at` med det eksisterende `pulsen_last_seen`.
- Komponenten indsættes i `src/pages/Home.tsx` efter `CelebrationStrip`, bag `menu_pulsen`.
- Der laves ingen ændringer i databasen, salg, provision eller løn.
