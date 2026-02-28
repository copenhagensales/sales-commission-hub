

# Reparer 18 Lovablecph orphan-salg

## Trin 1: Opret produktet "Modebooking Video - Codan"
Indsaet i `products`-tabellen med:
- commission_dkk: 110, revenue_dkk: 175
- client_campaign_id: ecb3d430-ab1e-4c5d-a54b-31f812ed3dc9
- counts_as_sale: true

## Trin 2: Opret edge function `repair-orphan-items`
Engangs-funktion der:
1. Henter de 18 orphan-salg (Lovablecph, uden sale_items, feb 19-24)
2. Laeser `raw_payload.lines[]` fra hvert salg
3. Mapper productId til internt product_id og priser:
   - 7266 -> Partnersalg FDM TRYG (75/200)
   - 7493 -> Modebooking Video Codan (110/175) - nyoprettet
   - 5146 -> Winback EA Finansforbundet (600/1200)
   - 5141 -> A-kasse Erhvervsaktiv Finansforbundet (100/500)
4. Indsaetter sale_items med praemultipliceret commission/revenue
5. Opdaterer enrichment_status til "complete"

## Trin 3: Koer og verificer
- Kald funktionen via curl
- Bekraeft orphan-count falder fra 20 til 2

## Trin 4: Oprydning
- Slet edge function efter brug

## Finansiel effekt
| Produkt | Antal | Kommission | Omsaetning |
|---------|-------|------------|------------|
| Partnersalg FDM TRYG | 15 | 1.125 kr | 3.000 kr |
| Modebooking Video Codan | 2 | 220 kr | 350 kr |
| Winback EA | 1 | 600 kr | 1.200 kr |
| A-kasse Erhvervsaktiv | 1 | 100 kr | 500 kr |
| **Total** | **19 items** | **2.045 kr** | **5.050 kr** |

