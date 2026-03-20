

# Fix: "Dashboard ikke fundet" på custom domain

## Problem
Dashboardet virker fint i preview (bekræftet via test). Fejlen på `stork.copenhagensales.dk/t/XKVP` skyldes at den **publishede version** ikke indeholder den nyeste kode med `TvLeagueDashboard`.

## Løsning
**Ingen kodeændringer nødvendige.** Du skal blot publicere projektet igen via Lovable's "Publish" knap, så den nyeste build deployes til dit custom domain.

Tryk på **Share → Publish** i Lovable for at opdatere den publishede version.

