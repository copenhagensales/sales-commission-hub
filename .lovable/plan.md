

## Show All 3 Columns' Values at Once in the Dialog

### Problem
Currently the dialog forces a two-step flow: pick a column first, then see its values. The user wants to see and select values from all 3 columns (Operator, Subscription Name, Sales Department) simultaneously.

### Solution
Remove the column-selection step. Instead, show all 3 columns as collapsible/accordion sections in the dialog, each listing its values as checkboxes. The user can pick values from any combination of columns in one view.

### Changes — `src/components/cancellations/SellerMappingTab.tsx`

1. **Remove `selectedColumn` state** — no longer needed.

2. **Replace the two-step dialog body** (lines 478-553) with a single scrollable view containing 3 sections:
   - Each section has a bold header (e.g. "Operator") and lists all unique values from that column as checkbox rows.
   - All sections are visible at once — no drill-down needed.
   - Checked state uses the same `checkedNames` set across all columns.

3. **Keep the manual input** ("Tilføj nyt navn manuelt") at the bottom, outside the column sections.

4. **Keep save logic unchanged** — it already handles any set of string values.

### UI Sketch
```text
┌──────────────────────────────────┐
│ Tilknyt værdier til "Produkt X"  │
│                                  │
│ Operator                         │
│  ☑ TDC                           │
│  ☐ Telia                         │
│  ☐ Yousee                        │
│                                  │
│ Subscription Name                │
│  ☐ 5G Internet                   │
│  ☑ Mobil 99                      │
│                                  │
│ Sales Department                 │
│  ☐ Dept A                        │
│  ☐ Dept B                        │
│                                  │
│ [Tilføj nyt navn manuelt...] [+] │
│                                  │
│         Annuller    Gem (2 valgt) │
└──────────────────────────────────┘
```

