

## Fix: Melissa (og andre uden agent-mapping) viser 0 provision

### Årsag
`usePersonalSalesStats` henter agent-emails via `employee_agent_mapping`. Melissa har ingen mapping, så `agentEmails` returnerer et tomt array. Linje 58 har betingelsen `agentEmails.length > 0`, som blokerer hele queryen - provision bliver aldrig hentet.

Melissa har salg under `mech@copenhagensales.dk` (hendes work_email), men hooket kender ikke til den.

### Løsning
Tilføj work_email som fallback i `usePersonalSalesStats` (og tilsvarende i `usePreviousPeriodComparison`), så medarbejdere uden agent-mapping stadig får vist deres provision.

### Ændringer

**1. `src/hooks/usePersonalSalesStats.ts` (linje 33-58)**
- I agent-email queryen: Hvis `employee_agent_mapping` returnerer tomt, hent `work_email` fra `employee_master_data` som fallback.
- Fjern kravet om `agentEmails.length > 0` i `enabled`-betingelsen - lad den køre hvis der er enten agent-emails eller work_email.

**2. `src/hooks/usePreviousPeriodComparison.ts` (linje 33-50)**
- Samme fallback-logik: Hent work_email hvis ingen agent-mapping findes.

### Teknisk detalje
Ændringen er ca. 10-15 linjer per fil. Query-funktionen udvides til:
1. Hent emails fra `employee_agent_mapping` (eksisterende logik)
2. Hvis tomt: Hent `work_email` fra `employee_master_data` for medarbejderen
3. Returner det fundne som `agentEmails`

Dette matcher den fallback-kæde som allerede bruges i `get_sales_aggregates_v2` RPC'en og `useSellerSalariesCached`.

