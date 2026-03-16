

## Gør `end_date` valgfri for sæsoner

Lige nu kræver systemet at alle 6 datoer udfyldes, og `league-process-round` stopper med at oprette nye runder hvis `nextEnd > season.end_date`. Det betyder at sæsonen ikke kan køre uden slutdato.

### Ændringer

**1. Database: Gør `end_date` nullable**
- Migration: `ALTER TABLE league_seasons ALTER COLUMN end_date DROP NOT NULL;` (hvis den har NOT NULL)
- Ingen data-tab — eksisterende sæsoner beholder deres datoer

**2. Frontend: Sæsonoprettelse (`SeasonManagerCard.tsx`)**
- Fjern `end_date` fra valideringen (`handleCreate`) — kun 5 datoer kræves
- Gør slutdato-feltet valgfrit med placeholder-tekst "Valgfri"
- Samme ændring i `SeasonSettingsDialog.tsx`

**3. Frontend: `useCreateSeason` hook (`useLeagueData.ts`)**
- Send `end_date` som `null` hvis den ikke er sat

**4. Edge Function: `league-process-round/index.ts`**
- Linje 415: Ændr check fra `nextEnd <= new Date(season.end_date)` til at altid oprette næste runde hvis `end_date` er null:
  ```
  if (!season.end_date || nextEnd <= new Date(season.end_date))
  ```
- Sæsonen kører uendeligt indtil admin manuelt sætter status til `completed`

### Resultat
Admin kan oprette en sæson med kun startdato. Runder oprettes automatisk uge for uge, indtil enten slutdatoen nås eller sæsonen lukkes manuelt.

