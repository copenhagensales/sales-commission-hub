# Feedback-boksen på Opstartshold kan ikke rulles på mobil

## Årsag (bekræftet i koden)

Boksen ved "1-1 coaching" / "1-1 lyt" ligger i `src/pages/onboarding/RampTeam.tsx` (linje 678-689). Den er centreret i et fast lag over siden, men selve boksen har `overflow-hidden` og ingen maksimal højde. På en telefon er indholdet (noter, ugens fokus, styrke, knapper) højere end skærmen, så alt under kanten bliver klippet væk - og fordi boksen ikke må rulle, kan man ikke nå ned til feltet og knappen.

## Plan

1. Giv boksen en maksimal højde i forhold til skærmen og lad indholdet rulle indeni, så bunden altid kan nås.
2. Behold overskrift/luk øverst synligt og lad kun midterdelen rulle, så knappen "Send og markér" ikke forsvinder.
3. Lad laget bagved rulle til toppen på små skærme, så boksen ikke sidder fast under mobilheaderen, og undgå at siden bagved ruller med.
4. Verificér i mobilbredde: alle felter kan nås, der kan rulles, og knappen kan trykkes. Tjek også at desktopvisningen er uændret.

## Afgrænsning

Kun udseende/rulning i `src/pages/onboarding/RampTeam.tsx`. Ingen ændringer i data, mails, rettigheder eller beregninger.
