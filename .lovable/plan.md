# Klap og kommentarer på fejringer og ligaens top 3

Man skal kunne give en hurtig reaktion (👏 🎉 🔥) og skrive en kort besked som "Godt gået" eller "Tillykke" på to steder på forsiden: fejringsstriben med fødselsdage og jubilæer, og de tre øverste i "Liga · denne periode". Alle medarbejdere kan se og skrive.

## Sådan ser det ud

Fejringskortene beholder deres nuværende udseende og får en linje nedenunder:

```text
🎂  William Sean Maare Bai            👏 4   🎉 2   [ + ]
    Tillykke med fødselsdagen!        "Tillykke William!" — Kasper M.
                                      3 beskeder mere
```

- Tre faste reaktionsknapper. Et klik giver reaktionen, et klik mere fjerner den igen. Antallet står ved siden af, og navnene kan ses ved at holde musen over eller trykke på tallet.
- Plus-knappen åbner et lille felt til en kort besked, højst 200 tegn. Man kan slette sin egen besked.
- De to nyeste beskeder vises direkte på kortet. Resten ligger bag "vis flere", så striben ikke vokser ud af skærmen.
- I ligakortet får hver af de tre rækker de samme tre reaktionsknapper til højre, men kun reaktioner — ingen beskeder, så listen bliver ikke lang og uoverskuelig. Beskeder hører til fejringerne.
- Ingen bundplacering og ingen negative reaktioner. Kun ros.

## Det der skal besluttes undervejs

Fejringerne findes ikke som rækker i systemet i dag. De regnes ud på forsiden ud fra medarbejderkortene hver gang siden åbnes, så der er ikke noget "kort" at hænge en reaktion på. Det løses ved at give hver fejring en fast nøgle sammensat af personen, typen og året — fødselsdag for samme person i 2027 bliver dermed en ny fejring med tomme reaktioner, hvilket er det rigtige. Fødselsdatoen selv gemmes ikke sammen med reaktionen; den udledes som i dag og forlader ikke medarbejderkortet.

Ligaens rækker har derimod et fast id pr. runde, så en reaktion på ugens nummer et bliver ikke overført til næste uges nummer et.

## Teknisk

To nye tabeller, begge generiske så flere kort kan kobles på senere uden nye tabeller:

- `feed_reactions`: `target_type` ('birthday', 'anniversary', 'league_round'), `target_key` (tekst), `user_id`, `emoji`, unik på (target_type, target_key, user_id, emoji) så samme person ikke kan klappe to gange.
- `feed_comments`: samme to målfelter, `user_id`, `body` (længde begrænset i trigger og i formularen), `created_at`.

Nøgleformat: `birthday:<employee_id>:<år>`, `anniversary:<employee_id>:<år>`, `league_round:<round_id>:<employee_id>`.

RLS: læsning for `authenticated` (USING true), indsættelse kun med `auth.uid() = user_id`, sletning kun af egne rækker. Ingen opdatering — en besked rettes ved at slette og skrive igen. GRANT til `authenticated` og `service_role`; ingen `anon`-adgang. Mønsteret er det samme som `event_gallery_photo_likes` bruger i dag.

Frontend: én ny hook `useFeedReactions.ts` (React Query, henter reaktioner og beskeder samlet for en liste af nøgler i ét kald, invaliderer efter mutation) og to små komponenter under `src/components/home/` — en reaktionsrække og en besked-liste. `Home.tsx` og `CompactLeagueView.tsx` udvides med disse, uden ændringer i beregningen af fejringer, liga eller provision.

Navne vises via den eksisterende opslagsvej for medarbejdernavne og avatarer, så vi ikke laver en ny navnekilde.

Tilgængelighed: hver reaktionsknap får en tekstlig etiket ("Klap — 4"), så tal og betydning ikke bæres af emoji alene, og aktiv/inaktiv tilstand markeres med både ramme og `aria-pressed`, ikke kun farve. Farver tages fra de eksisterende tokens.

## Uden for opgaven

Ligakortet viser i dag provision i kroner. Det ændres ikke her, men det er en selvstændig overvejelse, om den offentlige enhed bør være antal salg.

Der laves ingen ændringer i løn, provision, pricing, adgangsroller eller ligaberegningen.
