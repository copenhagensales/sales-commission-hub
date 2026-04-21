

## Fix: forkerte enum-værdier ved oprettelse af AMO-møde

### Problemet

Når du trykker "Gem" sender frontend `meeting_type: "ordinary"` (eller `"annual"`), men databasens enum `amo_meeting_type` accepterer kun:

- `amo_meeting` (ordinært AMO-møde)
- `extraordinary` (ekstraordinært)
- `annual_discussion` (årlig arbejdsmiljødrøftelse)

Derfor fejler insertet med `invalid input value for enum amo_meeting_type: "ordinary"`. Samme problem ville ramme `annual` → `annual_discussion`.

### Løsning

Ret værdierne i `src/pages/amo/AmoMeetings.tsx` så de matcher enum'en præcist. Kun værdierne ændres — labels (dansk visning) forbliver de samme.

**Ændringer i `AmoMeetings.tsx`:**

1. **`meetingTypeLabels`-mappet** (linje 22-26): brug enum-keys
   ```ts
   const meetingTypeLabels: Record<string, string> = {
     amo_meeting: "Ordinært",
     extraordinary: "Ekstraordinært",
     annual_discussion: "Årligt møde",
   };
   ```

2. **`emptyForm.meeting_type`** (linje 53): `"amo_meeting"` i stedet for `"ordinary"`

3. **`<Select>` options i create-dialog** (linje ~284-286):
   ```tsx
   <SelectItem value="amo_meeting">Ordinært</SelectItem>
   <SelectItem value="extraordinary">Ekstraordinært</SelectItem>
   <SelectItem value="annual_discussion">Årligt møde</SelectItem>
   ```

Eksisterende rækker i `amo_meetings` rør jeg ikke — de bruger allerede de gyldige enum-værdier; det var kun UI-koden der var ude af sync.

### Verificering

- Opret et nyt møde med type "Ordinært" → 201 i stedet for 400
- Listevisningen viser fortsat "Ordinært" / "Ekstraordinært" / "Årligt møde" korrekt
- Rediger et eksisterende møde → type-dropdown viser den rigtige forhåndsvalgte værdi

