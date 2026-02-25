

## Tilføj valgfrit "ID" felt til lokations-stamdata

### Hvad

Et nyt valgfrit tekstfelt "ID" i Stamdata-sektionen på lokationsdetaljesiden, placeret mellem "Navn" og "Type/Status"-rækken. Feltet kan bruges til at angive et eksternt ID (f.eks. butiksnummer, Coop-ID osv.) men er ikke påkrævet.

### Database

Tilføj kolonne til `location`-tabellen:

```sql
ALTER TABLE public.location ADD COLUMN external_id text;
```

Nullable, ingen default — helt valgfrit.

### Frontend (1 fil)

**`src/pages/vagt-flow/LocationDetail.tsx`:**

1. Tilføj `external_id` til `formData`-initialisering (fra location-query).
2. Indsæt et nyt input-felt lige under "Navn"-feltet:
   ```
   <div>
     <Label>ID (valgfrit)</Label>
     <Input
       value={formData.external_id || ""}
       onChange={...}
       placeholder="F.eks. butiksnummer"
       disabled={!canEditLocation}
     />
   </div>
   ```
3. Inkludér `external_id` i save-mutation'en, så værdien gemmes.

### Ingen andre ændringer

- Feltet er rent valgfrit — ingen validering påkrævet.
- Lokationslisten (LocationsContent) behøver ikke vise feltet medmindre du ønsker det senere.

