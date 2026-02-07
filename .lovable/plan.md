
# Vis Fradragsbeløb for Sygeløn og Annullering

## Formål

Tilføj visning af de faktiske kronebeløb, der fratrækkes/tillægges via annullerings- og sygelønsprocenten i den udvidede rækkevisning i DB per Klient-rapporten. Dette giver et klarere overblik end kun at se procenterne.

## Beregningslogik

Baseret på den nuværende kode beregnes følgende:

```text
Eksempel: TDC Erhverv
─────────────────────────────────────
Provision:             500.000 kr
+ Feriepenge (12,5%):   62.500 kr
= Sælgerløn (basis):   562.500 kr

Sygeløn 3%:           + 16.875 kr  ← Ekstra omkostning
= Sælgerløn m/syge:    579.375 kr

Annullering 10%:      - 57.938 kr  ← Fratrukket pga. annullering
= Justeret sælgerløn:  521.437 kr
```

**Sygeløn-tillæg:** `sellerSalaryCost × sickPayPercent / 100`

**Annullerings-fradrag (på omsætning):** `revenue × cancellationPercent / 100`

**Annullerings-fradrag (på sælgerløn):** `sellerCostWithSickPay × cancellationPercent / 100`

## UI-ændringer

### Nuværende visning (expanded row)

```text
Annul. %      Sygeløn %
  10.0%         3.0%
```

### Ny visning med beløb

```text
Annul. %           Sygeløn %
  10.0%              3.0%
(-57.938 kr oms.)  (+16.875 kr)
```

Alternativt kan det vises som separate felter:

```text
Annul. %     Annul. fradrag     Sygeløn %     Sygeløn tillæg
  10.0%        -57.938 kr         3.0%         +16.875 kr
```

## Teknisk Implementering

### 1. Udvid ClientDBData interface

Tilføj to nye felter til at holde de beregnede beløb:

```typescript
interface ClientDBData {
  // ... eksisterende felter
  sickPayAmount: number;           // Ekstra omkostning fra sygeløn (positiv)
  cancellationRevenueDeduction: number;  // Fradrag i omsætning (positiv)
  cancellationCostDeduction: number;     // Fradrag i sælgerløn (positiv)
}
```

### 2. Beregn beløbene i ClientDBTab.tsx

I `useMemo`-beregningen, tilføj:

```typescript
// Beregn sygeløn-tillæg (ekstra omkostning)
const sickPayAmount = sellerSalaryCost * (sickPayPercent / 100);

// Beregn annullerings-fradrag
const cancellationRevenueDeduction = salesData.revenue * (cancellationPercent / 100);
const cancellationCostDeduction = sellerCostWithSickPay * (cancellationPercent / 100);
```

### 3. Udvid ClientDBRowData interface

```typescript
interface ClientDBRowData {
  // ... eksisterende felter
  sickPayAmount: number;
  cancellationRevenueDeduction: number;
}
```

### 4. Opdater ClientDBExpandableRow UI

I expanded row-sektionen, vis beløbene under procenterne:

```typescript
<div>
  <button onClick={() => onEditCancellation(...)}>
    <p className="text-muted-foreground text-xs mb-0.5">Annul. %</p>
    <p className="font-medium">
      {client.cancellationPercent > 0 ? formatPercent(client.cancellationPercent) : "—"}
    </p>
    {client.cancellationRevenueDeduction > 0 && (
      <p className="text-xs text-destructive">
        -{formatCurrency(client.cancellationRevenueDeduction)} oms.
      </p>
    )}
  </button>
</div>

<div>
  <button onClick={() => onEditSickPay(...)}>
    <p className="text-muted-foreground text-xs mb-0.5">Sygeløn %</p>
    <p className="font-medium">
      {client.sickPayPercent > 0 ? formatPercent(client.sickPayPercent) : "—"}
    </p>
    {client.sickPayAmount > 0 && (
      <p className="text-xs text-muted-foreground">
        +{formatCurrency(client.sickPayAmount)}
      </p>
    )}
  </button>
</div>
```

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Beregn og tilføj beløb til data-objektet |
| `src/components/salary/ClientDBExpandableRow.tsx` | Vis beløb under procenterne i UI |

## Visuel opsummering

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DB per Klient - Expanded Row                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Sælgerløn    Centre/Boder   Assist.løn   Lederløn   ATP/Barsel                 │
│  -604.766 kr      —          -19.125 kr  -150.636 kr  -1.905 kr                 │
│                                                                                 │
│  Annul. %              Sygeløn %                                                │
│    10.0%                 3.0%                                                   │
│  (-50.000 kr oms.)     (+18.141 kr)                                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Dette giver brugeren et klart overblik over den faktiske økonomiske effekt af begge justeringer.
