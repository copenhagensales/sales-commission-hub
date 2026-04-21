
## Fix den vedvarende `"ordinary"`-fejl på AMO-møder

### Hvad problemet er
Koden i `src/pages/amo/AmoMeetings.tsx` ser allerede rigtig ud, men previewet sender stadig `meeting_type: "ordinary"` i POST-body. Det betyder, at fejlen nu er et runtime/state-problem: enten lever en gammel værdi videre i formular-state, eller også er der et sted i flowet hvor legacy-værdier ikke bliver normaliseret før save.

### Hvad der skal bygges
Gør `AmoMeetings` robust mod både gamle og nye værdier, så den aldrig kan sende en ugyldig enum til databasen.

### Implementering

1. **Indfør én central normalizer i `src/pages/amo/AmoMeetings.tsx`**
   Lav en helper som mapper:
   - `ordinary` → `amo_meeting`
   - `annual` → `annual_discussion`
   - gyldige enum-værdier beholdes som de er

2. **Brug normalizeren alle steder hvor `meeting_type` kan komme ind i state**
   Opdater:
   - `emptyForm`
   - `openNew()`
   - `openEdit(m)` så gamle rækker/legacy-data også vises korrekt
   - `Select` `onValueChange` så state altid holdes på DB-kompatible værdier

3. **Normalizér igen lige før save**
   I `save.mutationFn` skal payload altid bygges med:
   - `meeting_type: normalizeMeetingType(f.meeting_type)`
   
   Det er det vigtigste sikkerhedsnet, fordi det også fanger stale preview-state og gamle formularværdier.

4. **Gør type-definitionen strammere**
   Erstat løse `string`-værdier med en smallere union/type for de tilladte meeting-typer plus legacy-inputs, så samme fejl ikke kan snige sig tilbage senere.

5. **Saml option-data ét sted**
   Definér møde-typer som én fælles konstantliste og brug den både til:
   - labels
   - select-items
   - normalisering
   
   Så UI og databaseværdier ikke kan drive fra hinanden igen.

6. **Bedre fejlbesked ved ukendt værdi**
   Hvis der mod forventning kommer en ukendt type, vis en pæn fejl i UI i stedet for at sende rå ugyldig enum til databasen.

### Filer der berøres
- `src/pages/amo/AmoMeetings.tsx`

### Hvad jeg ikke rører
- Database-enum’en `amo_meeting_type`
- Andre AMO-sider
- Eksisterende mødedata i databasen

### Verificering
- Nyt møde med “Ordinært” gemmer som `amo_meeting`
- Nyt møde med “Årligt møde” gemmer som `annual_discussion`
- Redigering af gamle/legacy-records med `ordinary` eller `annual` kan gemmes uden fejl
- Network request viser aldrig længere `meeting_type: "ordinary"`
