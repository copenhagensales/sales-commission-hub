

## Forenkl Rediger Kurv - Fjern individuel annullering/afvisning, tilfoej antal-redigering

### Oversigt
Fjerner "Annuller 1" og "Afvis 1" knapperne fra produkttabellen i EditCartDialog. I stedet faar hver raekke et redigerbart antal-felt, saa man kan aendre quantity direkte. Slet-knappen (skraldespand) og "Tilfoej produkt" beholdes. Footer-knapperne "Annuller hele salget" og "Afvis hele salget" beholdes ogsaa.

---

### AEndringer i EditCartDialog.tsx

**Fjernes:**
- `cancelOneUnitMutation` og `rejectOneUnitMutation` (individuel annullering/afvisning)
- `undoOneUnitMutation` (fortryd-knappen)
- `confirmAction` state og al logik omkring det
- "Annuller 1", "Afvis 1" og "Fortryd 1" knapperne i tabellen
- "Status" kolonnen (ikke relevant naar man kun redigerer antal)
- Import af `Minus`, `ThumbsDown`

**Tilfoejes:**
- `updateQuantityMutation`: Opdaterer `quantity`, `mapped_commission` og `mapped_revenue` paa en `sale_item`. Commission og revenue genberegnes proportionelt (per-unit-vaerdi x nyt antal).
- Antal-kolonnen bliver et redigerbart input-felt (number input, min 1) i stedet for blot at vise tallet.

**Tabel-layout efter aendring:**
| Produkt | Antal (input) | Prov./stk | Handling (slet-knap) |

### Teknisk detalje: Genberegning af commission/revenue
Naar antal aendres, beregnes nye vaerdier:
- `perUnit = mapped_commission / old_quantity`
- `new mapped_commission = perUnit * new_quantity`
- Samme for `mapped_revenue`

Dette foelger den eksisterende konvention om at vaerdierne er prae-multipliceret.

---

### Filer der aendres
1. **`src/components/cancellations/EditCartDialog.tsx`** - Fjern individuelle cancel/reject mutations og knapper, tilfoej inline antal-redigering med update mutation

