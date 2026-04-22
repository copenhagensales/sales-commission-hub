

## Tilføj engelsk oversættelse til TDC Opsummering

### Mål
Når DA/EN-toggle står på **EN**, vises hele opsummeringsteksten på engelsk i stedet for dansk — på tværs af alle tre varianter (Standard, Pilot, Kun 5g fri salg). DA er fortsat default. Kun intern brug, ingen i18n-fil oprettes — teksterne lægges direkte i komponenten for hurtig vedligeholdelse.

### Ændring (kun `src/pages/TdcOpsummering.tsx`)

1. **Oversættelses-map** (top af filen, før komponenten):
   Opret en konstant `TRANSLATIONS: Record<string, string>` med dansk→engelsk for hver unik linje brugt i `summaryLines`. Engelske formuleringer hentes 1:1 fra det uploadede dokument:
   - Intro, CVR-linje, produktlinjer (datamængde + hastighedsbegrænsning)
   - MBB (mobilevoice, datadelingskort, uden router)
   - Binding (36 mdr. + 5g fri salg-binding)
   - Pilot welcome call + 3 nummervalg-varianter + frihed-linje + pilot opstart
   - Standard 3 bekræftelser + nye-numre opstart + 2 opsigelser + 2 opstart-varianter + ordrebekræftelse
   - Tilføj/opsig-linjen
   - Tilskud (4 linjer + rød placeholder)
   - Omstilling (Pilot intro + Standard rød placeholder + tilkøb-menuvalg)
   - Afslutning ("Har du nogle spørgsmål…")

2. **Helper i komponenten:**
   ```ts
   const t = (da: string) => (isEnglish ? TRANSLATIONS[da] ?? da : da);
   ```
   Fallback til dansk hvis et opslag mangler (sikrer ingen tom output).

3. **Anvendelse:** Wrap hver `lines.push({ text: "..." })`-streng i `summaryLines`-useMemo med `t(...)`. Inkludér `isEnglish` i dependency-arrayet. Røde placeholder-linjer oversættes også (markdown/italic-stil bevares som almindelig tekst, `isRed` uændret).

4. **Toast-besked ved kopi:** `"Kopieret!"` / `"Opsummeringsteksten er kopieret…"` oversættes betinget til `"Copied!"` / `"The summary text has been copied to the clipboard."` når `isEnglish` er true. (UI-labels som kort-titler, knap-tekster, sidebar osv. forbliver på dansk — kun selve opsummeringsoutputtet er flerssproget, jf. krav om "kun internt for nu".)

### Ikke berørt
- Toggle-UI (DA/EN findes allerede).
- Validering, betinget logik, røde markeringer, kopiér-funktion.
- Øvrige UI-labels på siden (kun output-tekst oversættes).
- Andre sider/komponenter.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

