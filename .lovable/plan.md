

## Konverteringsrate opdelt på Salgskonsulent og Fieldmarketing

### Data (aktuelt)
- **Salgskonsulent**: 33 ansat af 270 ansøgere = **12,2%**
- **Fieldmarketing**: 5 ansat af 58 ansøgere = **8,6%**

### Visualisering

**1. To side-by-side KPI-kort** — placeres under de eksisterende 4 KPI-kort:
- **Salgskonsulent konvertering**: Stort procenttal (12,2%), undertekst "33 af 270 ansat", trend vs. forrige periode
- **Fieldmarketing konvertering**: Stort procenttal (8,6%), undertekst "5 af 58 ansat", trend vs. forrige periode

**2. Funnel-bars under KPI-kort** — to horisontale stacked bars der viser fordelingen per type:
- Ny → Kontaktet → Samtale → **Ansat** vs. Afvist/Ghostet/Ikke-kvalificeret
- Én bar for Salgskonsulent, én for Fieldmarketing
- Giver overblik over hvor i processen kandidater falder fra, for hver stillingskategori

### Teknisk
- Kun ændringer i `RecruitmentDashboard.tsx`
- Grupperer `candidates` arrayet på `applied_position` (case-insensitive match på "salgskonsulent" / "fieldmarketing")
- Bruger recharts `BarChart` (stacked, horizontal) til funnel
- Periodefilter (30d/90d/alle) genbruges fra eksisterende chart

