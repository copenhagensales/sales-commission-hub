
# Økonomisk Overblik per Opgave (Klient)

## Formål
En ny fane i Lønstyring der viser den reelle nettoindtjening per klient/opgave, hvor alle omkostninger er korrekt fordelt:
- **Sælgerløn** = provision + 12,5% feriepenge
- **Teamlederløn** = procentsats af DB (efter annullering og andre omkostninger) + 1% feriepenge til teamleder
- **Assistentløn** = fordelt proportionelt på klienter i teamet
- **Andre udgifter** = lokationsomkostninger (centre/boder) for FM-klienter

---

## Beregningslogik

### Trin 1: Grundlæggende tal per klient
- **Bruttoomsætning** = sum af `mapped_revenue` fra salg
- **Provision** = sum af `mapped_commission` fra salg
- **Feriepenge (sælger)** = provision × 12,5%
- **Lokationsomkostninger** = fra `booking` tabel (kun Eesy FM og YouSee)

### Trin 2: Annullering
- **Annullering %** = justerbar per klient (fra `client_adjustment_percents`)
- Annullering modregnes på både omsætning og lønomkostninger proportionelt

### Trin 3: Basis DB (før teamleder)
```
Basis DB = Justeret omsætning 
         - Justeret provision 
         - Justeret feriepenge (sælger) 
         - Lokationsomkostninger
```

### Trin 4: Assistentløn fordeling
- Hent assistentløn for teamet fra `personnel_salaries`
- Hvis teamet har flere klienter: fordel proportionelt baseret på klientens andel af teamets samlede omsætning
```
Klientens assistentløn = (Klient omsætning / Team total omsætning) × Assistentløn
```

### Trin 5: DB før teamleder
```
DB før teamleder = Basis DB - Assistentløn (proportionelt)
```

### Trin 6: Teamlederløn beregning
- Hent `percentage_rate` og `minimum_salary` fra `personnel_salaries`
- Beregn på **team-niveau** først (sum af alle klienters DB før teamleder)
- Teamlederløn = MAX(team_db × procentsats, minimum_salary)
- Fordel teamlederløn proportionelt på klienter baseret på deres andel af team-DB
- Tilføj 1% feriepenge til teamlederløn

### Trin 7: Final DB per klient
```
Final DB = DB før teamleder 
         - Teamlederløn (proportionelt) 
         - Teamleder feriepenge (1%)
```

---

## UI Design

### Placering
Ny fane i `/salary/types`: **"DB per klient"** (mellem "DB Oversigt" og "Samlet")

### Tabel kolonner
| Klient | Salg | Omsætning | Sælgerløn* | Centre/Boder | Assist.løn | Lederløn** | Annul. % | Final DB |

*Sælgerløn = provision + 12,5% feriepenge  
**Lederløn = beregnet andel + 1% feriepenge

### Features
- Periodefilter (måned, lønperiode, custom)
- Totalrække nederst
- Klik på klient for detaljevisning
- Farvemarkering: positiv DB (grøn), negativ DB (rød)

---

## Tekniske filer

### Ny komponent
`src/components/salary/ClientDBTab.tsx`
- Bruger eksisterende hooks: `useSalesAggregatesExtended` for salgsdata
- Henter team-klient mapping fra `team_clients`
- Henter løndata fra `personnel_salaries`
- Henter bookings for lokationsomkostninger
- Beregner proportionel fordeling af team-omkostninger

### Opdateringer
`src/pages/SalaryTypes.tsx`
- Tilføj ny tab trigger og content for "DB per klient"

---

## Datakrav (allerede tilgængelige)
- `sales` + `sale_items` → omsætning og provision
- `fieldmarketing_sales` → FM-salg
- `team_clients` → klient-team mapping
- `personnel_salaries` → teamleder % og assistentløn
- `booking` → lokationsomkostninger
- `client_adjustment_percents` → annullerings-% (eksisterende tabel)

---

## Edge cases håndtering
1. **Klient uden team** → Vis "Ikke tildelt" og spring leder/assistent-beregning over
2. **Team uden leder** → Ingen lederløn-beregning
3. **Teamleder minimum_salary > beregnet** → Brug minimum og fordel proportionelt
4. **Klient med 0 omsætning** → Ingen proportionel andel af team-omkostninger
5. **FM-klienter** → Inkluder lokationsomkostninger fra bookings
