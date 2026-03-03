

# Nøgleaflevering med billede

## Ændringer

### 1. Tekst-ændringer i `VehicleReturnCallout.tsx`
- Overskrift: "Aflevering af bil i dag" → "Aflevering af nøgle i dag"
- Knap: "Bekræft aflevering af bil" → "Bekræft aflevering af nøgle"
- Bekræftet-tekst: "afleveret" → "Nøgle afleveret"
- Toast: "Bil aflevering bekræftet!" → "Nøgle aflevering bekræftet!"
- Email subject/body opdateres tilsvarende

### 2. Billede-upload funktion i `VehicleReturnCallout.tsx`
- Tilføj en billedsektion over knappen med to muligheder:
  - **Kamera-knap** (Camera-ikon) — åbner kamera direkte via `<input type="file" accept="image/*" capture="environment">`
  - **Upload-knap** (ImagePlus-ikon) — vælg fra galleri/filer
- Vis preview af valgt billede med mulighed for at fjerne det
- Billedet er valgfrit — man kan stadig bekræfte uden

### 3. Storage bucket: `vehicle-return-photos`
- Opret public bucket via migration
- RLS: authenticated kan uploade, alle kan læse (så emailen kan linke til billedet)

### 4. Upload-flow i `MyBookingSchedule.tsx`
- Før upsert til `vehicle_return_confirmation`, upload billedet til storage bucket
- Gem den offentlige URL i en ny `photo_url` kolonne på `vehicle_return_confirmation`
- Send `photo_url` med til edge function

### 5. Database: Tilføj `photo_url` kolonne
- `ALTER TABLE vehicle_return_confirmation ADD COLUMN photo_url TEXT`

### 6. Edge function: `notify-vehicle-returned`
- Modtag `photo_url` parameter
- Hvis den findes, inkluder billedet i emailen som `<img>` tag

### Rækkefølge
1. Database migration (ny kolonne + storage bucket)
2. Opdater `VehicleReturnCallout.tsx` med nye tekster + billedupload UI
3. Opdater mutation i `MyBookingSchedule.tsx` med upload-logik
4. Opdater edge function med billede i email

