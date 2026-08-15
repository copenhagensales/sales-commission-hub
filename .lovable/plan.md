# "Godkend"-knap under Handlinger (Claims/Reimport)

## Hvad
I kolonnen "Handlinger" på fanen Claims/Reimport tilføjes en tredje knap "Godkend" som første handling — udfyldt grøn knap med flueben-ikon, som på det vedhæftede billede.

Rækkefølge: **Godkend** (grøn, fyldt) · **Rediger** (dæmpet tekst + blyant) · **Slet** (rød + skraldespand).

Ingen funktion tilkobles endnu — knappen er visuel (klik gør ingenting). "Mangler i PowerBI"-visningen beholder sin nuværende blyant.

## Teknisk
- `src/pages/vagt-flow/EesyFmDeviations.tsx` (`DeviationsPanel`, claims-rækken):
  - Ny `Button size="sm"` før "Rediger": fyldt emerald-baggrund, mørk tekst, `Check`-ikon fra lucide-react, label "Godkend".
  - "Rediger" skifter fra grøn til neutral/dæmpet tekstfarve (`text-muted-foreground`, hover `text-foreground`) så den matcher billedet; "Slet" uændret.
  - Kolonnebredden øges fra `w-40` til `w-56` og `whitespace-nowrap` sikres, så de tre knapper står på én linje.
  - `Check` tilføjes til lucide-importen.
- Kun præsentation — ingen data-, hook- eller logikændringer.
