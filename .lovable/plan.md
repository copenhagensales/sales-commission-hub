

# UI/UX Forbedring af DB per Klient-rapporten

## Nuvaerende problemer

### 1. For mange kolonner (13+ kolonner)
Tabellen har alt for mange kolonner, der vises samtidigt:
- Klient, Team, Salg, Omsaetning, Saelgerlon, Centre/Boder, Assist.lon, Lederlon, ATP/B, Annul.%, Final DB, DB%, Oms/FTE

Dette skaber:
- Horisontalt scroll
- Svaert at sammenligne tal
- Uoverskuelig datapraesentation

### 2. Manglende visuel hierarki
Alle data vises pa samme niveau uden gruppering. Omkostningskolonner (rod tekst) blandes med nogletal (gron/neutral).

### 3. Ingen KPI-oversigt
Brugeren skal gennemlaese hele tabellen for at fa et overblik over performancen.

### 4. Footer-sektion er uoverskuelig
Subtotal, Stab-udgifter og Stabsloninger er separate raekker i tabellen i stedet for at vaere visuelt adskilt.

---

## Foreslaaet losning

### 1. KPI Dashboard oeverst
Tilfoej en kompakt KPI-sektion med de vigtigste nogletal:

```text
+---------------+  +---------------+  +---------------+  +---------------+
| Total Oms.    |  | Total DB      |  | DB%           |  | Netto Indtj.  |
| 291.970 kr    |  | 77.763 kr     |  | 26,6%         |  | 52.000 kr     |
+---------------+  +---------------+  +---------------+  +---------------+
```

### 2. Komprimeret tabel med grupperede omkostninger
Reducer kolonner fra 13+ til 8 ved at:
- Kombinere alle omkostninger (Saelgerlon, Centre/Boder, Assist.lon, Lederlon, ATP/B) til en enkelt "Omkostninger" kolonne
- Fjerne individuelle omkostningskolonner fra hovedvisningen
- Tilfoeje en expand/collapse funktion til at se omkostningsdetaljer

**Ny tabelstruktur:**

| Klient | Team | Salg | Omsaetning | Omkostninger | Final DB | DB% | Detaljer |
|--------|------|------|------------|--------------|----------|-----|----------|

Klik pa "Detaljer" eller udvid raekken for at se:
- Saelgerlon, Lokation, Assist.lon, Lederlon, ATP/B, Annul.%

### 3. Visuelt adskilt footer
Flytter summary-sektionen ud af tabellen og ind i et separat card-layout:

```text
+--------------------------------------------------+
|  SAMLET OVERSIGT                                 |
+--------------------------------------------------+
| Team DB:     77.763 kr                           |
| - Stab-udg:  -8.500 kr                           |
| - Stab-lon:  -17.263 kr                          |
+--------------------------------------------------+
| NETTO:       52.000 kr                    +26.6% |
+--------------------------------------------------+
```

### 4. Collapsible tabelfunktionalitet
Hovedtabellen viser kun kunder med aktivitet som standard. Kunder med 0 salg/omsaetning kan skjules/vises via en toggle.

### 5. Forbedret farvekodning
- **Gron** for positive DB-vaerdier og hoj DB%
- **Rodt** for negative vaerdier
- **Gra** for neutrale/tomme vaerdier
- Progressbar til DB% for hurtig visuel sammenligning

---

## Teknisk implementering

### Nye filer

| Fil | Formal |
|-----|--------|
| `src/components/salary/ClientDBKPIs.tsx` | KPI-oversigt for rapporten |
| `src/components/salary/ClientDBSummaryCard.tsx` | Ny footer med samlet indtjening |
| `src/components/salary/ClientDBExpandableRow.tsx` | Udvidelig raekke med omkostningsdetaljer |

### Aendringer i eksisterende filer

| Fil | Aendring |
|-----|----------|
| `src/components/salary/ClientDBTab.tsx` | Integration af nye komponenter, reduceret kolonneantal |

### Implementation steps

1. **Opret ClientDBKPIs** - KPI-cards oeverst med Total Oms., Total DB, DB% og Netto Indtjening
2. **Opret ClientDBExpandableRow** - Collapsible raekke-komponent med omkostningsdetaljer
3. **Opret ClientDBSummaryCard** - Visuelt adskilt summary-sektion
4. **Refaktor ClientDBTab** - Reducer tabel til 8 kolonner, integrer nye komponenter
5. **Tilfoej hide-zero toggle** - Mulighed for at skjule kunder uden aktivitet

---

## Forventet resultat

**For:**
- 13+ kolonner - horisontalt scroll
- Ingen hurtig oversigt
- Footer blandet ind i tabel
- Alle omkostninger vises individuelt

**Efter:**
- 8 kolonner med expand-for-detaljer
- KPI-dashboard med nogletal
- Visuelt adskilt summary-sektion
- Kompakt tabel med detaljer on-demand
- Toggle til at skjule inaktive kunder

