

## Fjern NPS-kategorilabels fra survey-formularen

De tre labels "0-6: Kritiker", "7-8: Passiv", "9-10: Promoter" er interne NPS-kategorier som ikke bør vises til medarbejderne når de udfylder surveyen — det kan påvirke deres svar.

### Ændring

**`src/pages/PulseSurvey.tsx`** (linje 433-437)
- Fjern de tre `<span>` elementer med Kritiker/Passiv/Promoter labels fra NPS-spørgsmålet
- Farvekodningen på selve knapperne (rød/gul/grøn) bevares, da den giver visuel vejledning uden at afsløre kategorierne

