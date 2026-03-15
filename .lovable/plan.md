

## Problem: Fieldmarketing-sælgere mangler fra CS Top 20

### Årsag

RPC-funktionen `get_cs_top20_custom_period_leaderboard` (bruges til custom periods + fallback) joiner via:

```text
agents a ON LOWER(a.email) = LOWER(s.agent_email)
→ employee_agent_mapping eam ON eam.agent_id = a.id
→ employee_master_data emd ON emd.id = eam.employee_id
```

FM-salg har typisk **ikke** en `agent_email` der matcher `agents`-tabellen. De har i stedet `agent_name` sat direkte (f.eks. "Jonas Jensen") og `agent_email` sat til medarbejderens `work_email`. Joinet fejler fordi `agents`-tabellen kun indeholder dialer-agenter (TM).

Den cachebaserede leaderboard (edge function) har en `work_email`-fallback, men RPC'en har det ikke.

### Løsning

Opdatér RPC'en `get_cs_top20_custom_period_leaderboard` til at inkludere FM-sælgere via et **alternativt join** på `agent_email = work_email` i `employee_master_data`.

**Ændring: 1 database-migration**

Ny SQL der erstatter RPC'en med en version der bruger `LEFT JOIN` + `COALESCE`:

```sql
-- Join path 1 (TM): agents → employee_agent_mapping → employee_master_data
-- Join path 2 (FM fallback): sales.agent_email → employee_master_data.work_email

WITH resolved AS (
  SELECT
    s.id as sale_id,
    COALESCE(emd_tm.id, emd_fm.id) AS employee_id,
    COALESCE(emd_tm.first_name, emd_fm.first_name) AS first_name,
    COALESCE(emd_tm.last_name, emd_fm.last_name) AS last_name,
    COALESCE(emd_tm.avatar_url, emd_fm.avatar_url) AS avatar_url,
    COALESCE(t_tm.name, t_fm.name) AS team_name,
    si.*
  FROM sales s
  JOIN sale_items si ON si.sale_id = s.id
  -- TM path
  LEFT JOIN agents a ON LOWER(a.email) = LOWER(s.agent_email)
  LEFT JOIN employee_agent_mapping eam ON eam.agent_id = a.id
  LEFT JOIN employee_master_data emd_tm ON emd_tm.id = eam.employee_id
  LEFT JOIN teams t_tm ON t_tm.id = emd_tm.team_id
  -- FM fallback path
  LEFT JOIN employee_master_data emd_fm 
    ON emd_fm.work_email IS NOT NULL 
    AND LOWER(emd_fm.work_email) = LOWER(s.agent_email)
    AND emd_tm.id IS NULL  -- only use fallback when TM path didn't match
  LEFT JOIN teams t_fm ON t_fm.id = emd_fm.team_id
  WHERE s.sale_datetime >= p_from AND s.sale_datetime <= p_to
    AND COALESCE(s.validation_status, '') <> 'rejected'
)
SELECT ... GROUP BY employee_id ...
```

### Ingen kodeændringer
Kun database-migration. Frontend og edge function forbliver uændrede.

