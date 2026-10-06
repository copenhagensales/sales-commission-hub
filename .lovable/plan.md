# Fjern 24 hardwareprodukter fra Tilbud

## Hvad ændres
De 24 produkter, du har nævnt, fjernes fra listen "Hardware (TDC Shop)" under **1. Tilbud**. Kun listen ændres. Priser, tilskud og provision på de andre produkter forbliver de samme.

Sådan ser listen ud bagefter:
- **Samsung (6):** Galaxy Xcover 7 128GB, HMD Fusion 5G 256GB Business, Galaxy S24 128GB Enterprise, Galaxy S25 128GB EE Enterprise, Galaxy S26 256GB, Galaxy S26 Ultra 256GB, Galaxy S26 Ultra 512GB, Galaxy Tab A7 Lite Wifi 32GB, Galaxy Buds4
- **Apple:** iPhone 17e 256GB, iPhone 18 Pro 256GB, iPhone 17 256GB, iPhone 18 Pro 512GB, iPhone 17 Pro 256GB/512GB, iPhone 17 Pro Max 256GB/512GB, iPhone 18 Pro Max 256GB, iPad Wifi 128GB, iPad Wifi 128GB + 5G, AirPods 4, AirPods Pro 3, Apple Watch SE, Apple Watch Ultra 3
- **Routere og ekstra:** 4G Router, 5G wifi 7 Router, Doro Leva L11s
- **Google:** Hele gruppen forsvinder, fordi alle fem Pixel-modeller fjernes.

## Det skal du vide
- Ændringen gælder både den interne side og det åbne link, fordi de bruger samme liste.
- På jeres eget domæne og det åbne link ses ændringen først, når appen er udgivet.

## Teknisk
- Kun `src/lib/tdcTilbud/catalog.ts` (HARDWARE-listen) ændres.
- Hardware-id'er dannes ud fra placeringen i listen, så nogle id'er flytter sig. Det er uden betydning, fordi valg kun ligger i browseren og ikke gemmes nogen steder.
- Jeg tjekker, om testene i `calc.test.ts` henviser til et fjernet produkt, og kører dem.
