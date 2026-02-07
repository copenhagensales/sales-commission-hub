
# Sygelønsprocent per Klient — Implementeringsplan

## Formål

Tilføj en redigerbar **"Sygeløn %"** per klient i DB per Klient-rapporten. Denne procent øger provisionsomkostningen for at afspejle, at sælgere modtager løn under sygdom.

**Eksempel:** 
- Provision + feriepenge: 562.500 kr
- Sygefraværsprocent: 3%
- Justeret omkostning: 579.375 kr (sælgerløn × 1,03)

## Oversigt

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│  DB per Klient - Expanded Row                                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│  Sælgerløn    Centre/Boder   Assist.løn   Lederløn   ATP/Barsel                 │
│  -604.766 kr      —          -19.125 kr  -150.636 kr  -1.905 kr                 │
│                                                                                 │
│  Annul. %      Sygeløn % (NY!)                                                  │
│    10.0%         3.0%                                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Teknisk Implementering

### 1. Database: Tilføj kolonne til eksisterende tabel

Tilføj `sick_pay_percent` til `client_adjustment_percents`:

| Kolonne | Type | Standard |
|---------|------|----------|
| sick_pay_percent | numeric | 0 |

Dette matcher den eksisterende struktur med `cancellation_percent` og `deduction_percent`.

### 2. Frontend: Udvid query til at inkludere sygeløn

I `ClientDBTab.tsx`, tilføj `sick_pay_percent` til den eksisterende query:

```typescript
// Linje 191-199 - Udvid SELECT
const { data: adjustmentPercents } = useQuery({
  queryKey: ["client-adjustment-percents"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("client_adjustment_percents")
      .select("client_id, cancellation_percent, deduction_percent, sick_pay_percent"); // Tilføj sick_pay_percent
    if (error) throw error;
    return data;
  },
});
```

### 3. Beregningslogik: Øg sælgerløn med sygeløn

Opdater beregningen i `useMemo` (omkring linje 584-590):

```typescript
// Nuværende:
const sellerSalaryCost = commission + sellerVacationPay;
const adjustedSellerCost = sellerSalaryCost * cancellationFactor;

// Nyt - med sygefraværsprocent:
const sickPayPercent = Number(adjustment?.sick_pay_percent) || 0;
const sickPayFactor = 1 + (sickPayPercent / 100);

const sellerSalaryCost = commission + sellerVacationPay;
const sellerCostWithSickPay = sellerSalaryCost * sickPayFactor;
const adjustedSellerCost = sellerCostWithSickPay * cancellationFactor;
```

**Rækkefølge:** Sygeløn tilføjes først (øger basis), derefter reduceres med annulleringsprocent.

### 4. Save-funktion: Spejl eksisterende logik

Tilføj `handleSaveSickPayPercent` som kopi af `handleSaveCancellationPercent`:

```typescript
const handleSaveSickPayPercent = async (clientId: string) => {
  const newValue = parseFloat(editValue);
  if (isNaN(newValue) || newValue < 0 || newValue > 100) {
    toast.error("Ugyldig værdi. Indtast et tal mellem 0 og 100.");
    return;
  }

  try {
    const { data: existing } = await supabase
      .from("client_adjustment_percents")
      .select("id")
      .eq("client_id", clientId)
      .single();

    if (existing) {
      await supabase
        .from("client_adjustment_percents")
        .update({ sick_pay_percent: newValue })
        .eq("client_id", clientId);
    } else {
      await supabase
        .from("client_adjustment_percents")
        .insert({ client_id: clientId, sick_pay_percent: newValue });
    }

    toast.success("Sygefraværsprocent opdateret");
    queryClient.invalidateQueries({ queryKey: ["client-adjustment-percents"] });
    setEditingClientId(null);
  } catch (error) {
    toast.error("Kunne ikke opdatere sygefraværsprocent");
  }
};
```

### 5. UI: Vis og rediger i expanded row

**Udvid interface `ClientDBRowData`:**

```typescript
interface ClientDBRowData {
  // ... eksisterende felter
  sickPayPercent: number;  // NY
}
```

**Udvid props:**

```typescript
interface ClientDBExpandableRowProps {
  // ... eksisterende
  onEditSickPay: (clientId: string, currentValue: number) => void; // NY
}
```

**Tilføj felt i expanded row grid (ved siden af Annul. %):**

```typescript
<div>
  <button
    onClick={() => onEditSickPay(client.clientId, client.sickPayPercent)}
    className="text-left hover:text-primary transition-colors"
  >
    <p className="text-muted-foreground text-xs mb-0.5">Sygeløn %</p>
    <p className="font-medium">
      {client.sickPayPercent > 0 ? formatPercent(client.sickPayPercent) : "—"}
    </p>
  </button>
</div>
```

## Berørte filer

| Fil | Ændring |
|-----|---------|
| Migration (ny) | Tilføj `sick_pay_percent` kolonne |
| `ClientDBTab.tsx` | Query, beregning, save-funktion, state |
| `ClientDBExpandableRow.tsx` | Interface, props, UI-felt |

## Beregningseksempel

For TDC Erhverv med 10% annullering og 3% sygeløn:

```text
Provision:             500.000 kr
+ Feriepenge (12,5%):   62.500 kr
= Sælgerløn:           562.500 kr

× Sygeløn (1,03):      579.375 kr  ← +16.875 kr ekstra
× Annullering (0,90):  521.437 kr  ← efter 10% reduktion

Samlet effekt: Sygeløn øger basis, annullering reducerer totalen
```

## Dialog til redigering

Genbruger den eksisterende dialog-logik med state til at tracke om vi redigerer `cancellation` eller `sickPay`, så samme input-felt kan bruges.
