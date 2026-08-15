# Rediger/Slet-knapper på Claims/Reimport

## Hvad
Blyant-ikonet i sidste kolonne på "Claims/Reimport" erstattes af to tekstknapper som på det vedhæftede billede:
- "Rediger" med blyant-ikon i grøn
- "Slet" med skraldespand-ikon i rød

Kolonneoverskriften ændres fra "Ret salg" til "Handlinger". Ingen funktion tilkobles endnu — knapperne er visuelle (klik gør ingenting). "Mangler i PowerBI"-visningen beholder den nuværende blyant.

## Teknisk
- `src/pages/vagt-flow/EesyFmDeviations.tsx` (`DeviationsPanel`):
  - Header-cellen for rækkehandlinger viser "Handlinger" når `claimsMode` er sand, ellers "Ret salg"; bredden øges (`w-40`).
  - I rækken erstattes den enkelte ghost-icon-knap med to `Button variant="ghost" size="sm"` i en flex-container: `Pencil` + "Rediger" og `Trash2` + "Slet".
  - Farver via semantiske tokens/utility-klasser i tråd med resten af siden (grøn: emerald-tone brugt til positiv handling, rød: `text-destructive`) — ingen nye hardkodede hex-værdier.
  - `Trash2` tilføjes til lucide-importen.
- Kun præsentation — ingen data-, hook- eller logikændringer.
