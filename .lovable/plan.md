
# Plan: Implementer Historik-fanen i ProductPricingRulesDialog

## Opgave

Erstat placeholder "Historik kommer snart" med en funktionel historik-visning der viser alle prisændringer for produktet.

---

## Eksisterende data

Tabellen `product_price_history` indeholder allerede:
- `commission_dkk` og `revenue_dkk` - prisværdier
- `effective_from` - ikrafttrædelsesdato
- `is_retroactive` - om ændringen var retroaktiv
- `applied_at` - hvornår ændringen blev anvendt (NULL = afventer)
- `created_at` - hvornår ændringen blev oprettet
- `counts_as_sale` og `counts_as_cross_sale` - salgsklassificering

---

## Løsning

### 1. Tilføj useQuery til at hente historik

Hent historik for det specifikke produkt, sorteret efter oprettelsesdato (nyeste først):

```typescript
const { data: history, isLoading: historyLoading } = useQuery({
  queryKey: ["product-price-history", productId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("product_price_history")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: open,
});
```

### 2. Erstat historik-tab placeholder

Vis historikdata i en overskuelig liste med:

| Kolonne | Indhold |
|---------|---------|
| Dato | Ikrafttrædelsesdato (effective_from) |
| Provision | commission_dkk i kr |
| Omsætning | revenue_dkk i kr |
| Klassificering | Salg / Bisalg / Ingen |
| Status | Badge: "Afventer", "Anvendt" eller "Retroaktiv" |
| Oprettet | created_at formateret |

### 3. UI-design

Hver historik-post vises som et kort med:
- Hovedvisning: Provision og omsætning
- Ikrafttrædelsesdato tydeligt vist
- Status-badge med farve:
  - Grøn: Anvendt
  - Orange: Retroaktiv
  - Blå: Afventer (fremtidig ændring)
- Klassificeringsikoner (salg/bisalg)
- Oprettelsestidspunkt i mindre tekst

---

## Visuelt eksempel

```text
┌─────────────────────────────────────────────────────┐
│  📅 1. januar 2026                    [Retroaktiv]  │
│  ──────────────────────────────────────────────────│
│  💰 Provision: 110 kr    📊 Omsætning: 175 kr       │
│  ✅ Tæller som salg                                 │
│                                                     │
│  Oprettet: 6. feb 2026 kl. 18:15                   │
└─────────────────────────────────────────────────────┘
```

---

## Teknisk implementation

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/mg-test/ProductPricingRulesDialog.tsx` | Tilføj query + erstat historik-tab indhold |

### Nye imports

- `Clock` ikon fra lucide-react (for afventende ændringer)

### Interface for historik

```typescript
interface PriceHistoryEntry {
  id: string;
  product_id: string;
  commission_dkk: number | null;
  revenue_dkk: number | null;
  effective_from: string;
  is_retroactive: boolean;
  applied_at: string | null;
  created_at: string;
  counts_as_sale: boolean | null;
  counts_as_cross_sale: boolean | null;
}
```

---

## Forventet resultat

Efter implementering vil historik-fanen vise:
- Alle prisændringer for produktet i kronologisk rækkefølge
- Tydelig status for hver ændring
- Mulighed for at se hvornår priser blev ændret og af hvem (fremtidig udvidelse)
- Afventende fremtidige ændringer markeret tydeligt
