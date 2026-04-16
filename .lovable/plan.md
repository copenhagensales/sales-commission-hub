
# Plan: Omdøb "5G - 100/20 - TDC Erhverv" produktet

## Problem
Produktet `5G - 100/20 - TDC Erhverv` (id: `cb3143a5-971c-4060-b157-99f1d6477a99`) har "- TDC Erhverv" i navnet, mens de øvrige 5G-produkter (50/10, 200/40, 500/100) bare hedder fx "5G - 50/10".

## Løsning
Opdater produktnavnet i `products`-tabellen:

```sql
UPDATE products SET name = '5G - 100/20' WHERE id = 'cb3143a5-971c-4060-b157-99f1d6477a99';
```

Én enkelt data-opdatering. Ingen kodeændringer nødvendige.

## Bemærkning
Der findes også et kampagnepris-produkt "5G - 100/20 - Kampagnepris - TDC Erhverv" — dette beholder vi uændret, da de andre kampagnepris-produkter også har "- TDC Erhverv" i navnet (fx "5G - 50/10 - Kampagnepris - TDC Erhverv").
