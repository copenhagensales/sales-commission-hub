
# UI/UX Forbedring af Lonstyring-siden

## Nuvaerende problemer

### 1. For mange tabs pa samme niveau (8 stk)
Den flade struktur med 8 top-level tabs er overvældende:
- Lonarter
- Personale lon (med 3 nested sub-tabs)
- Saelgerloninger
- Teamomkostninger
- DB Oversigt
- DB per klient
- Samlet
- Nye medarbejdere

### 2. Manglende visuel hierarki
Alle tabs ser ens ud uden kategorisering eller gruppering.

### 3. Nested tabs i "Personale lon"
Skaber forvirring med tabs-i-tabs (Teamledere, Assistenter, Stabsloninger).

### 4. Ingen hurtig oversigt
Brugeren skal navigere rundt for at fa et overblik over lonsituationen.

---

## Foreslaaet losning

### Ny struktur med 3 hovedkategorier

Erstatter 8 flade tabs med en grupperet struktur:

```text
+--------------------------------------------------+
|                   LONGUIDE                       |
|  [Opsaetning]   [Lonberegning]   [Rapporter]    |
+--------------------------------------------------+
```

**Kategori 1: Opsaetning (Administration)**
- Lonarter (salary type definitions)
- Personale lon (Teamledere, Assistenter, Stab - som cards, ikke tabs)
- Teamomkostninger
- Nye medarbejdere

**Kategori 2: Lonberegning (Operationelt)**
- Saelgerloninger (provision-beregning)
- Samlet lonoversigt

**Kategori 3: Rapporter (Analyse/CFO)**
- DB Oversigt (team-niveau)
- DB per klient (med trends, DB%, Waterfall)

---

### Dashboard med KPI-oversigt

Tilfojer en kort oversigtssektion oven pa tabs:

```text
+-------------+  +-------------+  +-------------+  +-------------+
| Total Lon   |  | Sælgere     |  | DB Total    |  | DB%         |
| 1.234.567 kr|  | 45 aktive   |  | 456.789 kr  |  | 24.5%       |
+-------------+  +-------------+  +-------------+  +-------------+
```

---

### Personale-sektion redesign

Erstat nested tabs med et card-grid layout:

```text
+-----------------------------+  +-----------------------------+
|  Teamledere                 |  |  Assistenter                |
|  [Icon] 8 aktive            |  |  [Icon] 12 aktive           |
|  Senest tilfojet: Jan D.    |  |  Senest tilfojet: Maria S.  |
|  [Se alle ->]               |  |  [Se alle ->]               |
+-----------------------------+  +-----------------------------+

+-----------------------------+
|  Stabsloninger              |
|  [Icon] 5 aktive            |
|  Senest tilfojet: Peter K.  |
|  [Se alle ->]               |
+-----------------------------+
```

Klik pa "Se alle" aabner en modal/sheet med den fulde tabel.

---

### Visual improvements

1. **Farvekodning af kategorier**
   - Opsaetning: Neutral (gray icons)
   - Lonberegning: Primary color (blue/green)
   - Rapporter: Accent color (purple/orange)

2. **Bedre tab-styling**
   - Storre tabs med ikoner
   - Aktiv tab med tydeligere markering
   - Gruppering med subtle separators

3. **Responsive forbedringer**
   - Dropdown-navigation pa mobile i stedet for wrapping tabs
   - Collapsible KPI-sektion

---

## Teknisk implementering

### Nye filer

| Fil | Formal |
|-----|--------|
| `src/components/salary/SalaryDashboardKPIs.tsx` | KPI-oversigt med totaler |
| `src/components/salary/PersonnelOverviewCards.tsx` | Card-grid for personale |
| `src/components/salary/CategoryTabs.tsx` | Grupperet tab-komponent |

### Aendringer i eksisterende filer

| Fil | Aendring |
|-----|----------|
| `src/pages/SalaryTypes.tsx` | Ny struktur med 3 kategorier + KPI-header |
| `src/components/salary/PersonnelSalaryTab.tsx` | Erstat nested tabs med cards |

### Implementation steps

1. **Opret KPI-oversigtskomponent** med nogletal fra existing hooks
2. **Opret kategoriseret tab-struktur** med 3 hovedgrupper
3. **Redesign PersonnelSalaryTab** til card-baseret layout med modals
4. **Tilfoej ikoner og farvekodning** til alle tabs
5. **Mobile dropdown-navigation** for small screens

---

## Forventet resultat

**For:**
- 8 uoverskuelige tabs
- Tabs-i-tabs forvirring
- Ingen hurtig oversigt
- Ensartet udseende

**Efter:**
- 3 logiske kategorier
- Flat navigation med cards til sub-sektioner
- KPI-dashboard med nogletal
- Visuel differentiering mellem omrader
