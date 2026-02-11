

## Fix: Dobbelt-multiplikation af revenue og commission i KPI-cache

### Problem
KPI-cache-beregningen (`calculate-kpi-values`) ganger `mapped_revenue * quantity` og `mapped_commission * quantity`, men disse vaerdier er **allerede ganget med quantity** naar de gemmes i `sale_items` tabellen (f.eks. i `sync-adversus`: `mapped_revenue: revenue * quantity`).

Det betyder at alle KPI-cache-vaerdier for `total_revenue` og `total_commission` er ca. 3x for hoeje.

**Eksempel for TDC Erhverv i februar 2026:**
- Korrekt revenue (direkte fra DB): **653.800 kr**
- KPI-cache revenue: **2.132.000 kr** (dobbelt-ganget)
- Vist i "DB per Klient": **1.918.800 kr** (cache-vaerdi fra et tidligere tidspunkt)

### Beroorte steder i `supabase/functions/calculate-kpi-values/index.ts`

Der er **6 steder** der skal rettes - alle aendrer `* (item.quantity || 1)` til bare vaerdien:

1. **Linje 615**: `teamCommission += (item.mapped_commission || 0) * (item.quantity || 1)` - team commission
2. **Linje 1669-1671**: Global `calculateTotalCommission` funktion  
3. **Linje 1711-1713**: Global `calculateTotalRevenue` funktion
4. **Linje 2104-2106**: Client-scoped commission beregning
5. **Linje 2148-2150**: Client-scoped revenue beregning

Alle aendres fra:
```
(item.mapped_commission || 0) * (item.quantity || 1)
```
Til:
```
(item.mapped_commission || 0)
```

(Samme moenster for `mapped_revenue`)

### Leaderboard-beregningerne er korrekte
Linje 1119-1121 og lignende steder bruger allerede `mapped_commission` direkte uden dobbelt-multiplikation. Disse roeres ikke.

### Efter deploy
KPI-cachen skal genberegnes for at opdatere de forkerte vaerdier. Dette sker automatisk ved naeste scheduled koersel, eller kan trigges manuelt.
