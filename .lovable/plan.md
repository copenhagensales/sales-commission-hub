

# Tilføj slet-knap til salgsvalideringer

## Ændring
Tilføj en slet-knap (Trash2 ikon) med bekræftelsesdialog i "Tidligere valideringer"-tabellen.

## Teknisk

### `src/pages/economic/SalesValidation.tsx`

1. **Import**: Tilføj `Trash2` fra lucide-react + `AlertDialog`-komponenter
2. **Delete mutation**: Ny `useMutation` der sletter fra `sales_validation_uploads` og kalder `refetchUploads()`
3. **UI**: Tilføj slet-knap med `AlertDialog` bekræftelse i den eksisterende tomme `<TableHead></TableHead>` kolonne (linje 722), ved siden af "Vis"-knappen (linje 736)

