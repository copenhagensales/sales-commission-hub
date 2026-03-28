

## Slet statisk Excel-fil og tilføj upload-dropzone

### Ændringer

**1. Slet `public/temp/employee-import.xlsx`**
Fjerner persondata fra offentligt tilgængelige assets.

**2. Opdater `src/pages/ExcelFieldMatcher.tsx`**
- Fjern `useEffect` der fetcher den statiske fil (linje 81-98)
- Sæt `loading` initial state til `false`
- Tilføj en fil-upload dropzone (drag & drop + klik) som startvisning
- Når brugeren vælger en `.xlsx`-fil, parse den med den eksisterende `parseExcelFile()` og vis kolonnemapping + importknap som før
- Al eksisterende logik (mapping, preview, import) forbliver uændret

### Filer

| Fil | Handling |
|---|---|
| `public/temp/employee-import.xlsx` | **Slet** |
| `src/pages/ExcelFieldMatcher.tsx` | Erstat auto-fetch med fil-upload dropzone |

