# Mapping-fane: kampagne-mapping (trin 1)

## Mål
Under fanen "Mapping" laves to bokse: én til kampagne-mapping (bygges nu) og én til operator-mapping (placeholder). Kun kampagnen "1 måneds gratis abonnement" har effekt på afvigelser.

## Kampagne-boksen
Boksen "Kampagne-mapping" er to-delt:

- **Kampagner med effekt** — viser "1 måneds gratis abonnement" som en pille/linje. Kort forklaring: disse kampagner udløser sammenligning mod interne Stork-salg.
- **Kampagner uden effekt** — tom sektion nu, med teksten "Udfyldes senere" plus kort forklaring: disse kampagner ignoreres ved afvigelsestjek.

Under boksen vises en informationslinje om, at selve sammenligningsreglen mod interne salg tilføjes senere (afventer din forklaring).

## Operator-boksen
Boks nummer to, "Operator-mapping", oprettes som placeholder med samme visuelle stil og teksten "Udfyldes senere".

## Teknisk
- Kun `src/pages/vagt-flow/EesyFmDeviations.tsx` ændres (grøn zone: præsentation).
- Kampagner med effekt defineres som en konstant i filen (`CAMPAIGNS_WITH_EFFECT = ["1 måneds gratis abonnement"]`), så listen senere let kan flyttes til DB eller bruges i afvigelseslogikken.
- Ingen ændringer i hooks, DB eller afvigelsesberegning i dette trin — visning og struktur kun.
- Semantiske tokens til styling, samme kort-look som de øvrige faner (`border-border/50 bg-card/50 backdrop-blur-sm`).
