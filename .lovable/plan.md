# Seneste event: gør billedrækken swipe-bar på mobil

## Hvad jeg har bekræftet

- Sektionen ligger i `src/components/home/EventGallery.tsx` og bruger en vandret rulleliste (`overflow-x-auto`, `snap-x snap-mandatory`) med kort på 50 % bredde på mobil.
- Der ligger 5 billeder i galleriet lige nu, så på en telefon er der reelt indhold uden for skærmen - rækken burde altså kunne rulles.
- Selve årsagen til at swipe ikke reagerer på din telefon er **ikke bekræftet endnu**. Første skridt er derfor at reproducere det i mobilvisning.

## Plan

1. Reproducér i mobilbredde og find ud af, om rullebeholderen faktisk har indhold uden for skærmen, eller om berøringen bliver fanget af noget udenom.
2. Ret derefter rækken, så den er robust på touch:
   - tilføj eksplicit touch-rulning på beholderen (vandret panorering, blødere iOS-rulning, ingen "kæde" til siden bagved)
   - gør snap mindre stramt på små skærme, så en kort swipe ikke hopper tilbage
   - vis pilene også når der kun er få billeder mere end der er plads til, så man altid har en knap-vej frem
   - lad hele billedet være rulbart ved at flytte "like"- og redigeringsknapperne, hvis de spiser berøringen
3. Verificér i mobilvisning: swipe til side virker, pilene virker, og de fem billeder kan alle nås.

## Afgrænsning

Kun udseende og berøring i `src/components/home/EventGallery.tsx` (og evt. lidt styling). Ingen ændringer i data, upload, likes eller adgangsregler.
