
# Analyse: Beregning af annullering på Relatel

## Nuværende beregning (korrekt ifølge implementeringen)

For Relatel med 10% annullering:

| Trin | Beregning | Resultat |
|------|-----------|----------|
| Total omsætning | - | 49.852 kr |
| Provision + feriepenge | - | 22.901 kr |
| Basis indtjening | 49.852 - 22.901 | **26.951 kr** |
| Annulleringsbeløb | 49.852 × 10% | 4.985 kr |
| Justeret indtjening | 26.951 - 4.985 | **21.966 kr** |

Den viste værdi på **21.966 kr er matematisk korrekt** baseret på den nuværende logik.

---

## Mulig forventning fra brugeren

Du nævnte at "det er ikke 21966 (oprindelig beløb 26951)". Måske forventer du at annulleringen beregnes anderledes?

### Alternativ 1: Annullering beregnes på indtjening (ikke omsætning)
```
Annulleringsbeløb = 26.951 × 10% = 2.695 kr
Justeret indtjening = 26.951 - 2.695 = 24.256 kr
```

### Alternativ 2: Proportionel reduktion af alt
```
Reduceret omsætning = 49.852 × 90% = 44.867 kr
Reduceret provision = 22.901 × 90% = 20.611 kr  
Ny indtjening = 44.867 - 20.611 = 24.256 kr
```

---

## Afklaring nødvendig

Hvilken forretningslogik ønskes?

1. **Nuværende**: Annullering trækkes fra omsætningen, og det fulde beløb fratrækkes indtjeningen
   - Resultat: 21.966 kr ✓ (dette er hvad koden gør nu)

2. **Alternativ**: Annullering beregnes som procent af indtjeningen (ikke omsætningen)
   - Resultat: 24.256 kr

3. **Andet**: Beskriv venligst den ønskede beregningsmetode

---

## Teknisk ændring (hvis alternativ 2 ønskes)

**Fil:** `src/pages/reports/RevenueByClient.tsx` (linje 585-591)

Fra:
```typescript
const cancellationAmount = client.totalRevenue * (cancellationPct / 100);
```

Til:
```typescript
const cancellationAmount = client.totalEarnings * (cancellationPct / 100);
```

Dette vil ændre beregningen så procenten trækkes fra **indtjeningen** i stedet for **omsætningen**.
