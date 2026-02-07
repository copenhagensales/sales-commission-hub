
# Plan: Tilføj ATP + Barsel (381 kr) som teamomkostning per medarbejder

## Baggrund
Lønarten "ATP + Barsel" eksisterer allerede i `salary_types` tabellen med et beløb på 381 kr per FTE per måned. Denne omkostning skal nu medregnes automatisk som en teamudgift i "DB per Klient" rapporten, baseret på antallet af medarbejdere i hvert team (inklusiv sælgere, assisterende teamledere og teamleder).

## Nuværende team-struktur (fra database)
| Team           | Sælgere | Assistenter | Leder | Total FTE |
|----------------|---------|-------------|-------|-----------|
| Eesy TM        | 16      | 1           | 1     | 18        |
| Fieldmarketing | 34      | 1           | 1     | 36        |
| Relatel        | 11      | 1           | 1     | 13        |
| Stab           | 15      | 1           | 1     | 17        |
| TDC Erhverv    | 19      | 2           | 1     | 22        |
| United         | 17      | 1           | 1     | 19        |

## Løsning

### 1. Hent ATP + Barsel beløb fra salary_types
Tilføj en ny query i `ClientDBTab.tsx` der henter den aktive "ATP + Barsel" lønart:

```typescript
const { data: atpBarsselRate } = useQuery({
  queryKey: ["atp-barsel-rate"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("salary_types")
      .select("amount")
      .ilike("name", "ATP + Barsel")
      .eq("is_active", true)
      .single();
    return data?.amount || 381;
  },
});
```

### 2. Hent team-medlemstal (FTE per team)
Tilføj en query til at tælle medarbejdere per team (sælgere + assistenter + leder):

```typescript
const { data: teamMemberCounts } = useQuery({
  queryKey: ["team-member-counts"],
  queryFn: async () => {
    // Hent sælgere fra team_members
    // Hent assistenter fra team_assistant_leaders
    // Tilføj 1 for teamleder hvor team_leader_id IS NOT NULL
    // Return Map<teamId, totalCount>
  },
});
```

### 3. Beregn ATP + Barsel per team med proratering
I den eksisterende `clientDBData` beregning, beregn udgiften per team:

```
atpBarsselCost = (teamMemberCount × 381 kr) × (periodeDage / 30)
```

Denne omkostning fordeles proportionelt på klienter baseret på omsætningsandel (samme logik som assistentløn).

### 4. Tilføj kolonne i UI
I tabellen tilføjes en ny kolonne "ATP/B" efter "Lederløn" kolonnen for at vise den fordelte ATP + Barsel omkostning per klient.

### 5. Opdater totaler
`totals.atpBarsel` tilføjes og fratrækkes i `finalDB` beregningen samt i "Samlet Team DB" rækken.

## Tekniske ændringer

**Filer der skal ændres:**
- `src/components/salary/ClientDBTab.tsx`:
  - Tilføj queries for ATP/Barsel-sats og team-medlemstal
  - Udvid `ClientDBData` interface med `atpBarsselAllocation: number`
  - Tilføj beregningslogik i `clientDBData` useMemo
  - Tilføj ny tabel-kolonne i UI
  - Opdater totals og netEarnings beregninger

**Beregningsflow:**
1. For hvert team: `teamAtpCost = memberCount × 381 × prorationFactor`
2. For hver klient i team: `atpBarsselAllocation = teamAtpCost × (clientRevenue / teamTotalRevenue)`
3. `finalDB = dbBeforeLeader - leaderAllocation - leaderVacationPay - atpBarsselAllocation`

## Validering
Med beløbet 381 kr per FTE per måned:
- Eesy TM (18 FTE): 6.858 kr/måned
- Fieldmarketing (36 FTE): 13.716 kr/måned  
- TDC Erhverv (22 FTE): 8.382 kr/måned
- etc.

Disse beløb vil prorateres automatisk for kortere perioder (daglig, ugentlig, etc.) ligesom eksisterende omkostninger.

## Parallelle ændringer
Der kræves ingen database-ændringer, da beløbet allerede findes i `salary_types` tabellen og team-medlemsdata allerede er tilgængelig via `team_members`, `team_assistant_leaders` og `teams` tabellerne.
