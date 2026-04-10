

## Gør Kandidat-funnel mere visuel

### Problem
Den nuværende funnel er en flad horisontal bar med små farvesegmenter — svær at aflæse, især når segmenter er meget små.

### Løsning: Vertikal funnel med recharts BarChart

Erstat den nuværende inline-bar med en **vertikal stacked bar chart** (recharts `BarChart`) for hver kategori — klarere farver, labels direkte på søjlerne, og en ægte funnel-følelse.

**Design:**
- To side-by-side vertikale bar charts (én per kategori)
- Hver status er en separat søjle (ikke stacked), sorteret i funnel-rækkefølge: Ny → Kontaktet → Samtale → **Ansat** | Afvist, Ghostet, etc.
- Grønne toner for positive trin (Ny, Kontaktet, Samtale, Ansat med stigende intensitet), røde/grå for negative (Afvist, Ghostet, etc.)
- Antal og procent vises som label over hver søjle
- Konverteringsrate vises som stort tal i hjørnet af hver chart
- Responsivt: stacker vertikalt på smalle skærme

### Teknisk
- Kun ændringer i `RecruitmentDashboard.tsx`
- Bruger `BarChart`, `Bar`, `XAxis`, `YAxis`, `Cell`, `LabelList` fra recharts (allerede importeret i projektet)
- Erstatter den eksisterende funnel-sektion (linje 298-371)
- Data-logikken (`conversionStats`, `funnelData`) genbruges uændret

