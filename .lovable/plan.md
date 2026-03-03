

## Plan: Tilføj ID-kolonne i email-rapporten

### Status
- **UI-tabel:** ✅ ID vises allerede (`external_id`)
- **PDF:** ✅ ID vises allerede (`externalId`)
- **Email-rapport:** ❌ ID mangler

### Ændring

**`supabase/functions/send-supplier-report/index.ts`**

1. Tilføj `<th>ID</th>` kolonne i table header (efter Lokation)
2. Tilføj `<td>${loc.externalId || ''}</td>` i table rows (efter locationName)

Data'en (`externalId`) sendes allerede med fra frontend via `reportData` — den skal bare vises i email-templaten.

