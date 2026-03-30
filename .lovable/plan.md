

## Plan: Vis også inaktive medarbejdere i sælger-dropdowns på annulleringssiden

### Baggrund
Annulleringer kan vedrøre salg fra medarbejdere, der siden er blevet deaktiveret. Lige nu viser begge sælger-dropdowns (i UploadCancellationsTab og MatchErrorsSubTab) kun aktive medarbejdere, hvilket gør det umuligt at tildele annulleringer til tidligere ansatte.

### Ændringer

**1. `src/components/cancellations/UploadCancellationsTab.tsx`**
- Fjern `.eq("is_active", true)` filteret i `allEmployees`-queryen (linje 637), så både aktive og inaktive medarbejdere hentes.
- Tilføj `is_active` til select-felterne.
- Sortér listen så aktive vises først, derefter inaktive.
- Vis inaktive medarbejdere med en visuel markering i dropdown (f.eks. grå tekst + "(inaktiv)"-suffix).

**2. `src/components/cancellations/MatchErrorsSubTab.tsx`**
- Samme ændring: fjern `.eq("is_active", true)` (linje 121), tilføj `is_active` til select.
- Sortér aktive først, inaktive sidst.
- Vis "(inaktiv)"-markering i dropdown-valgene.

### Tekniske detaljer
- Begge steder ændres queryen fra `.eq("is_active", true)` til at hente alle medarbejdere med `is_active` inkluderet i select.
- Dropdown-items renderes med betinget styling: `className="text-muted-foreground"` og suffix `(inaktiv)` for `is_active === false`.
- Sortering: `.order("is_active", { ascending: false }).order("first_name")` sikrer aktive først.

