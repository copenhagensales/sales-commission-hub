

## Flere dagspriser per lokation (placeringer)

### Problem
Nogle lokationer har flere steder man kan stå (f.eks. hovedindgang, elevator), og prisen afhænger af placeringen. I dag er der kun en enkelt dagspris per lokation.

### Loesning

Opret en ny tabel `location_placements` til at holde flere placeringer med individuelle priser. Den eksisterende `daily_rate` kolonne bevares som standardpris for lokationer uden placeringer.

### 1. Database: Ny tabel `location_placements`

```sql
CREATE TABLE location_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid NOT NULL REFERENCES location(id) ON DELETE CASCADE,
  name text NOT NULL,           -- f.eks. "Hovedindgang", "Elevator", "Gangarea"
  daily_rate integer NOT NULL DEFAULT 1000,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE location_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage location_placements"
  ON location_placements FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

Tilfoej ogsaa en `placement_id` kolonne paa `booking` tabellen:

```sql
ALTER TABLE booking ADD COLUMN placement_id uuid REFERENCES location_placements(id) ON DELETE SET NULL;
```

### 2. LocationDetail.tsx -- Placeringer-sektion

Under dagspris-feltet tilfoej en ny sektion "Placeringer" i Stamdata-kortet:

- Vis eksisterende placeringer som en liste med navn, pris og slet-knap
- "Tilfoej placering" knap der viser inline inputs (navn + pris)
- Placeringerne hentes og gemmes direkte (ikke via formData/handleSave, men via separate mutations)
- Naar en lokation har placeringer, vises dagspris-feltet som "Standardpris (bruges naar ingen placeringer)" med en note

Layouteksempel:
```text
Dagspris (kr ex moms): [1200]

Placeringer (valgfrit):
  Hovedindgang    1500 kr    [Slet]
  Elevator        1200 kr    [Slet]
  [+ Tilfoej placering]
```

### 3. BookWeekContent.tsx -- Valg af placering ved booking

Naar en lokation vælges og den har placeringer:
- Vis en Select-dropdown "Vælg placering" under lokationsvalget
- Dropdown indeholder alle placeringer for lokationen
- Valgt placering bestemmer `daily_rate_override` paa booking
- `placement_id` gemmes paa booking-rækken
- Hvis lokationen IKKE har placeringer, vises dropdown ikke (som i dag)

### 4. EditBookingDialog.tsx -- Vis/ændr placering

I "Pris"-fanen:
- Hvis bookingen har en `placement_id`, vis placeringsnavnet
- Mulighed for at ændre placering via dropdown (kun hvis lokationen har placeringer)
- Ændring af placering opdaterer ogsaa dagsprisen

### 5. Berørte filer

| Fil | Aendring |
|-----|----------|
| **Migration** | Ny tabel `location_placements` + `booking.placement_id` kolonne |
| `LocationDetail.tsx` | Ny sektion til at administrere placeringer (CRUD) |
| `BookWeekContent.tsx` | Hent placeringer for valgt lokation, vis Select hvis der er placeringer, gem `placement_id` |
| `EditBookingDialog.tsx` | Vis/ændr placering i pris-fanen |
| `LocationsContent.tsx` | Ingen ændring (dagspris-feltet i opret-dialog forbliver som standard) |
| `BookingsContent.tsx` | Evt. vis placeringsnavn i oversigten |

### Tekniske detaljer

**Ny query i LocationDetail:**
```typescript
const { data: placements = [] } = useQuery({
  queryKey: ["location-placements", id],
  queryFn: async () => {
    const { data } = await supabase
      .from("location_placements")
      .select("*")
      .eq("location_id", id)
      .order("name");
    return data || [];
  },
});
```

**Ny query i BookWeekContent (naar lokation vælges):**
```typescript
const { data: locationPlacements = [] } = useQuery({
  queryKey: ["location-placements", selectedLocation?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("location_placements")
      .select("*")
      .eq("location_id", selectedLocation.id)
      .order("name");
    return data || [];
  },
  enabled: !!selectedLocation?.id,
});
```

**Booking insert udvides med:**
```typescript
placement_id: selectedPlacementId || null,
daily_rate_override: selectedPlacement?.daily_rate || null,
```

