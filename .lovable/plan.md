

## Refactor: Two-Step Product Mapping (Column → Values)

### Current Behavior
The dialog shows all Excel column headers as checkboxes. User maps column names directly to a product.

### New Behavior
1. **Step 1 — Pick Column**: Dialog shows only 3 hardcoded columns: **Operator**, **Subscription Name**, **Sales Department**
2. **Step 2 — Pick Values**: After selecting a column, fetch all unique values from that column across uploaded data (`cancellation_queue.uploaded_data` + `cancellation_imports.unmatched_rows`), and show them as checkboxes
3. User selects which values map to the internal product (multiple allowed)
4. Save stores the selected values (not the column name) as `excel_product_name` in `cancellation_product_mappings`

### Technical Changes

**File: `src/components/cancellations/SellerMappingTab.tsx`**

- **Replace `excelColumns` query** with a new query that fetches unique values per column. For each row in `cancellation_queue` and `cancellation_imports.unmatched_rows`, extract values for the 3 allowed columns
- **Add state**: `selectedColumn: string | null` to track which column is being drilled into
- **Dialog redesign**:
  - Step 1: Show 3 clickable column options (Operator, Subscription Name, Sales Department)
  - Step 2: When a column is clicked, show all unique values from that column as checkboxes (with back button)
  - Keep manual "Tilføj nyt navn" input
- **Update unmapped overview**: Show unmapped values (not column names) as badges
- **Keep save logic** unchanged — it already stores string values as `excel_product_name`

### UI Flow
```text
[Select product] → Dialog opens
  ┌──────────────────────────┐
  │ Vælg kolonne:            │
  │  ▸ Operator              │
  │  ▸ Subscription Name     │
  │  ▸ Sales Department      │
  └──────────────────────────┘
       ↓ click "Operator"
  ┌──────────────────────────┐
  │ ← Tilbage                │
  │ Værdier fra "Operator":  │
  │  ☑ TDC                   │
  │  ☐ Telia                  │
  │  ☑ 3                     │
  │  ☐ Yousee                │
  └──────────────────────────┘
       ↓ Gem
```

