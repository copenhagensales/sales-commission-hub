

## Plan: Vis manuelt matchede rækker under Annulleringer + håndter "both"

### Problem
Rækken for Alexander Stamatakos sidder i databasen med `upload_type = 'both'`, fordi den blev indsat før fikset. Godkendelseskøen filtrerer på `upload_type === subTab` (dvs. `"cancellation"`, `"basket_difference"`, `"correct_match"`), så `"both"` aldrig vises.

### Løsning (2 dele)

**1. Database-migration: ret eksisterende `'both'`-rækker**

```sql
UPDATE cancellation_queue 
SET upload_type = 'cancellation' 
WHERE upload_type = 'both';
```

Dette retter alle eksisterende rækker (inkl. Alexander-rækken).

**2. Fallback i ApprovalQueueTab.tsx — behandl `'both'` som `'cancellation'`**

Sikkerhedsnet så fremtidige edge cases også fanges:

- **Linje 605** (OPP-grupper): Ændr `items[0]?.upload_type || "cancellation"` til at resolve `'both'` → `'cancellation'`
- **Linje 907** (sub-tab filtrering for flat items): Tilføj resolve af `upload_type` før sammenligning med `subTab`
- **Linje 973-984** (tællere): Tilføj `'both'` til `'cancellation'`-tællingen

Konkret: Tilføj en lille hjælpefunktion øverst:
```typescript
const resolveUploadType = (t: string) => t === "both" ? "cancellation" : t;
```

Og brug den i de 4-5 steder hvor `upload_type` / `uploadType` sammenlignes med sub-tab værdier.

### Filer
- Database migration (1 UPDATE statement)
- `src/components/cancellations/ApprovalQueueTab.tsx` (tilføj `resolveUploadType` helper + brug den i filtrering og tællere)

