

# FM Forecast: Inkludér FM-sælgeres salg via work_email fallback

## Problem
Forecast-hooken (`useClientForecast`) finder salg via `employee_agent_mapping → agents.email`. FM-sælgere har ingen agent-mapping (de bruger ikke en dialer), så deres salg tælles som 0 og de vises med "mangler agent-mapping" advarsel.

FM-salg gemmes med `agent_email` = medarbejderens `work_email` fra `employee_master_data`. Løsningen er at bruge `work_email` som fallback når der ikke findes en agent-mapping.

## Ændring

### `src/hooks/useClientForecast.ts`

**I email-map bygningen (linje 128-138):**
- Efter agent-mapping er bygget, tilføj fallback: for medarbejdere uden agent-emails, brug `employee_master_data.work_email` i stedet
- Kræver at `work_email` hentes med i employee-queryen (tilføj til select på linje 106)

```
// Eksisterende: empEmailMap bygges fra agent_mapping
// Nyt fallback for FM-medarbejdere:
for (const emp of employees) {
  if (!empEmailMap.has(emp.id) && emp.work_email) {
    empEmailMap.set(emp.id, [emp.work_email.toLowerCase()]);
  }
}
```

Det er hele ændringen — resten af forecast-logikken (ugentlig SPH, vagter, fravær, churn) virker allerede korrekt, da den er medarbejder-baseret og ikke dialer-specifik.

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj `work_email` til employee select + fallback i email-map |

