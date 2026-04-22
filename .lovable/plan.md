

## Generer Word-dokument med alle unikke formuleringer fra TDC Erhverv opsummering

### Mål
Producér én `.docx`-fil i `/mnt/documents/` der samler alle unikke sætninger brugt i `TdcOpsummering.tsx` på tværs af de tre varianter (Standard, Pilot, Kun 5g fri salg) — uden dubletter.

### Struktur i Word-dokumentet
Dokumentet organiseres med overskrifter pr. logisk blok, så det er nemt at bruge som reference:

1. **Fælles intro** (bruges i alle varianter)
   - "For at sikre, at der ikke opstår misforståelser…"
   - "Aftalen bliver oprettet i (firmanavn)…"

2. **Produktlinje**
   - Standard/Pilot variant (datamængde)
   - 5g fri salg variant (hastighedsbegrænsning)

3. **MBB / Datadelingskort**
   - Mobilevoice som MBB
   - Datadelingskort
   - Uden router

4. **Vilkår & binding**
   - "I er bundet på kontrakten i 36 måneder."
   - 5g fri salg-binding-tekst (12 mdr. binding + 3 mdr. opsigelse + opsigelse-anbefaling)

5. **Pilot welcome call & nummervalg (Pilot)**
   - Welcome call-linje
   - "Vi har snakket om, at det som udgangspunkt er" + tre varianter (eksisterende / mixed / nye)
   - "Hvilke numre i ønsker…"
   - Pilot opstart-tekst

6. **Standard nummervalg & opstart**
   - 3 bekræftelsesvarianter (eksisterende / mixed / nye)
   - "Dine nye numre starter…"
   - 2 opsigelse-varianter
   - 2 opstart-varianter (asap / specific dato)
   - Ordrebekræftelse-linje

7. **Tilføj/opsig abonnementer** (fælles)

8. **Tilskud (hasSubsidy)**
   - Tilskudslinje
   - Udlægsordning-linje
   - "Vi har talt om…" + rød placeholder
   - Webshop-linje

9. **Omstilling**
   - Pilot intro-linje
   - Standard rød placeholder (kaldsflow/hardware)
   - Opgrader-til-menuvalg-linje (fælles)

10. **Afslutning**
    - "Har du nogle spørgsmål til mig?"

### Teknisk fremgang
- Brug `docx`-skill: skrive Node-script der bygger `.docx` med Arial, A4, overskrifter (Heading1/Heading2), almindelige paragraphs og rød tekst (`color: "C00000"`) for placeholder-linjer.
- Deduplikering: indsamle alle strenge fra `summaryLines`-grenene, normalisere og kun beholde unikke (tomme separator-linjer udelades).
- Validere `.docx` via skill-script.
- QA: konvertere til PDF/billede og inspicere før levering.
- Output: `/mnt/documents/TDC_Opsummering_Formuleringer.docx` + leveres som `<lov-artifact>`.

### Filer berørt
- Ingen kodeændringer i projektet. Kun generering af artefakt i `/mnt/documents/`.

