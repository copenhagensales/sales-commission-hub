

# Redesign: Provisionssatser — deduplikering og kampagnesynlighed

## Dataanalyse

| Kunde | Unikke produkter | Dublet-rækker | Aktive regler | Bemærkning |
|-------|------------------|---------------|---------------|------------|
| Eesy FM | 9 | 8 (alle × 2) | Kampagnespecifikke (gaden vs marked) | Eneste med dubletter |
| Eesy TM | 6 | 0 | Op til 41 pr. produkt | Mange kampagne-bundne |
| TDC Erhverv | 40 | 0 | Tilskud-regler | Stort katalog |
| Tryg | 18 | 0 | Blandet | - |
| Yousee | 19 | 0 | Ingen regler | Kun base-priser |
| Øvrige | 14 | 0 | Få/ingen | - |

**Hovedproblemer:**
1. Eesy FM viser 17 rækker i stedet for 9 (samme produkt under "Eesy gaden" + "Eesy marked")
2. Regler vises som "Unavngivet regel" — kampagnenavne (Eesy gaden, Eesy marked, Adversus, Enreach) resolves ikke
3. Ingen visuel forskel mellem base-pris og kampagne-override

## Løsning

### 1. Gruppér produkter efter navn
Produkter med identisk `name` samles i én række. Base-prisen tages fra det første match (de er identiske for dubletter).

### 2. Resolve kampagnenavne
Hent `adversus_campaign_mappings` for at oversætte `campaign_mapping_ids` → læsbare navne (f.eks. "Eesy gaden", "Eesy marked").

### 3. Nyt visuelt layout for regler

```text
┌────────────────────────────────────────────────────────────────┐
│ ▼ Eesy 99 med 1. md (IKKE Nuuday)    200 kr    950 kr    2   │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ Eesy gaden      200 kr   950 kr                         │ │
│   │ Eesy marked     355 kr   950 kr   ▲155 kr               │ │
│   └──────────────────────────────────────────────────────────┘ │
│                                                                │
│ ▶ Eesy uden 1. md (Nuuday)            360 kr  1.000 kr    2   │
│ ▶ 5G Internet                         300 kr    650 kr    2   │
│                                                                │
│   Yousee Fri tale + 50 GB             125 kr    250 kr    —   │
└────────────────────────────────────────────────────────────────┘
```

- Farvekodede badges for kampagnenavne
- ▲/▼ difference-indikatorer vs base-pris
- Regler uden navn viser kampagnenavn i stedet
- "Udvid alle / Luk alle" knap

### 4. Søgefelt
Tilføj et simpelt tekstfilter over tabellen så man hurtigt kan finde produkter i store kataloger (TDC har 40 produkter).

## Tekniske ændringer

### Fil: `src/components/mg-test/CommissionRatesTab.tsx` (omskrives)

1. **Ny query**: Hent `adversus_campaign_mappings` (id, adversus_campaign_name) for at resolve kampagnenavne
2. **Gruppering**: `useMemo` der samler produkter med samme `name` → én grupperet række med alle tilhørende regler
3. **Kampagne-labels**: Map `campaign_mapping_ids` → kampagnenavne fra den nye query
4. **Difference-visning**: Beregn `rule.commission - base.commission` og vis som ▲/▼
5. **Søgefelt**: `Input` med `onChange` filter på produktnavn
6. **Udvid alle**: Toggle-knap der åbner/lukker alle grupper

Ingen nye tabeller eller migrationer.

