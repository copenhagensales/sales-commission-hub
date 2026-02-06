

# Plan: Bevar knap efter aktivering og tilføj annuller-funktion

## Oversigt
Ændrer straksbetalingssiden så knappen forbliver synlig efter aktivering og skifter til en rød "Annuller straksbetaling" knap.

---

## Nuværende adfærd vs. ønsket adfærd

| Status | Nuværende | Ønsket |
|--------|-----------|--------|
| Afventer | Grøn "Tilføj straksbetaling" knap | Grøn "Tilføj straksbetaling" knap |
| Aktiveret | Streg (—) | Rød "Annuller straksbetaling" knap |

---

## Ændringer i ImmediatePaymentASE.tsx

### 1. Tilføj ny mutation til annullering

Opretter `cancelMutation` der:
- Henter original commission og revenue fra prisreglen
- Sætter `is_immediate_payment` til `false`
- Nulstiller `mapped_commission` og `mapped_revenue` til standardværdierne

### 2. Opdater handling-kolonnen

Erstat betinget visning med:
- **Hvis aktiveret**: Rød knap med tekst "Annuller straksbetaling" 
- **Hvis afventer**: Grøn knap med tekst "Tilføj straksbetaling"

### 3. Tilføj bekræftelsesdialog for annullering

Ny AlertDialog med:
- Titel: "Annuller straksbetaling?"
- Beskrivelse: Advarsel om at provision reduceres
- Rød bekræftelsesknap

---

## Teknisk implementering

```text
┌─────────────────────────────────────────────────────────────┐
│ Handling-kolonne                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  if (is_immediate_payment === true)                         │
│    → Vis rød "Annuller straksbetaling" knap                 │
│    → AlertDialog med bekræftelse                            │
│    → cancelMutation opdaterer sale_item                     │
│                                                             │
│  else                                                       │
│    → Vis grøn "Tilføj straksbetaling" knap (uændret)        │
│    → convertMutation (eksisterende logik)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Prisregel-felter der bruges

| Felt | Bruges til |
|------|------------|
| `commission_dkk` | Standard provision (ved annullering) |
| `revenue_dkk` | Standard omsætning (ved annullering) |
| `immediate_payment_commission_dkk` | Forhøjet provision (ved aktivering) |
| `immediate_payment_revenue_dkk` | Forhøjet omsætning (ved aktivering) |

---

## Berørt fil

| Fil | Ændringer |
|-----|-----------|
| `src/pages/ImmediatePaymentASE.tsx` | Tilføj cancelMutation, opdater UI til at vise rød annulleringsknap |

