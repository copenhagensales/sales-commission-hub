# Tryg: salg fra "FDM eksisterende" vises ikke under Tryg

## Hvad jeg fandt (kun læst)
- De 10 salg fra Luca Martins i dag ER kommet ind fra Herobase (Enreach). De ligger i Stork med 10 produktlinjer og en provision på 500 kr.
- Kampagnen "MB FDM eksisterende kunder" (CAMP20182S3064) er ikke koblet til en kundekampagne i Stork. Kampagnekoblingen har ingen kundekampagne.
- Det gælder alle 171 salg på kampagnen siden 1. september. Uden kobling hører salgene ikke til Tryg, så de mangler i Tryg-rapporter, dashboards og teamtal. Hos sælgeren tælles de stadig, når opslaget sker via e-mail.
- De andre FDM-kampagner (TRYG - FDM, Tryg - FDM 2) er koblet til Trygs FDM-kundekampagne.

## Forslag
1. Kobl CAMP20182S3064 til samme FDM-kundekampagne som de andre FDM-kampagner. Det sker i kampagnekoblingen i MgTest eller med én målrettet opdatering af kampagnekoblingen.
2. Sæt kundekampagnen på de eksisterende salg fra kampagnen, så de også tæller bagud i Tryg-rapporterne. Provision og produktlinjer ændres ikke. Der genberegnes ingen priser.
3. Kontrollér bagefter, at alle 171 salg er koblet, og at provisionssummen er uændret. Tjek også, at salgene vises under Tryg i rapporten for i dag.

## Skal besluttes
- Skal salgene ligge under samme FDM-kundekampagne som "TRYG - FDM", eller under en ny, separat kundekampagne "FDM eksisterende"?
- Skal koblingen gælde bagud fra 1. september (punkt 2), eller kun for nye salg?

## Teknisk
- `adversus_campaign_mappings`: der skal sættes en kundekampagne (`client_campaign_id`) på rækken for CAMP20182S3064. I dag er feltet tomt, og de andre FDM-kampagner bruger 874e09c2-…
- Backfill: `UPDATE sales SET client_campaign_id = … WHERE source='tryg' AND dialer_campaign_id='CAMP20182S3064' AND client_campaign_id IS NULL`. `sale_items` røres ikke. Der tages et før/efter-snapshot af antal og `mapped_commission`.
- Gul zone (attribution). Pricing og løn røres ikke.
