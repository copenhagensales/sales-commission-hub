

# Tilføj "Nulstil" knap til igangværende upload

## Problem
Brugeren kan ikke "afslutte" et upload uden at rulle godkendte ændringer tilbage. Der mangler en knap til at nulstille (fjerne resterende ventende rækker + fejl i match), så man kan starte forfra med et nyt upload.

## Ændringer

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/ApprovalQueueTab.tsx` | Tilføj "Nulstil" knap ved siden af "Slet" i active import card |

## Detaljer

### "Nulstil" knap (ved siden af Slet-knappen)
- Ny knap med `variant="outline"` og et `RotateCcw` ikon
- Wrapped i `AlertDialog` med bekræftelse: "Er du sikker på at du vil nulstille dette upload? Alle ventende rækker og fejl i match vil blive fjernet. Allerede godkendte ændringer bevares."

### Nulstil-logik (onClick)
1. **Slet alle pending queue items** for dette import: `DELETE FROM cancellation_queue WHERE import_id = X AND status = 'pending'`
2. **Nulstil unmatched_rows**:

<lov-plan>

# Tilføj "Nulstil" knap til igangværende upload

## Problem
Brugeren kan ikke "afslutte" et upload uden at rulle godkendte ændringer tilbage. Der mangler en knap til at nulstille (fjerne resterende ventende rækker + fejl i match), så man kan starte forfra med et nyt upload.

## Ændringer

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/ApprovalQueueTab.tsx` | Tilføj "Nulstil" knap ved siden af "Slet" i active import card |

## Detaljer

### "Nulstil" knap (ved siden af Slet-knappen)
- Ny knap med `variant="outline"` og et `RotateCcw` ikon, placeret til venstre for den røde "Slet" knap
- Wrapped i `AlertDialog` med bekræftelse: "Er du sikker på at du vil nulstille dette upload? Alle ventende rækker og fejl i match vil blive fjernet. Allerede godkendte ændringer bevares."

### Nulstil-logik (onClick)
1. **Slet alle pending queue items** for dette import: `supabase.from("cancellation_queue").delete().eq("import_id", X).eq("status", "pending")`
2. **Nulstil unmatched_rows** på importen: `supabase.from("cancellation_imports").update({ unmatched_rows: null }).eq("id", X)`
3. **Invalidér queries**: `active-import-info`, `active-import-block`, `cancellation-queue`, `match-errors`, `match-errors-count`
4. **Toast**: "Upload nulstillet — du kan nu uploade en ny fil."

### Forskel fra "Slet"
- "Slet" kalder `rollback_cancellation_import` RPC som ruller ALT tilbage (inkl. godkendte)
- "Nulstil" fjerner kun ventende rækker og match-fejl — godkendte ændringer bevares

