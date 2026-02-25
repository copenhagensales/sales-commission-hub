

## Fix: Vis korrekte medarbejdernavne i ledelsesrapporten

### Problem
RPC-funktionen `get_sales_aggregates_v2` bruger denne prioritetsrækkefølge for navne:
```
COALESCE(a.name, emd_fb.first_name || ' ' || emd_fb.last_name, s.agent_email)
```

`a.name` er agent-navnet fra dialeren (f.eks. "joel", "trine", "leigk"), som ofte er brugernavne i stedet for rigtige navne. Funktionen bruger **aldrig** `emd.first_name || ' ' || emd.last_name` fra den primære employee_master_data join (via employee_agent_mapping).

### Løsning
Ændr navneopslags-prioriteten i RPC'en til:

```
COALESCE(
  emd.first_name || ' ' || emd.last_name,    -- Primær: via agent mapping
  emd_fb.first_name || ' ' || emd_fb.last_name, -- Fallback: via work_email
  a.name,                                       -- Fallback: agent navn
  s.agent_email                                  -- Sidste udvej: email
)
```

Dette sikrer at det rigtige medarbejdernavn vises, uanset om medarbejderen er aktiv eller inaktiv.

### Teknisk ændring

**Database-migration:** Opdater `get_sales_aggregates_v2` funktionen.

Ændringen er i `group_name` CASE-udtrykket for alle tre group_by-varianter (`employee`, `date`, `both`). Prioriteten ændres fra `a.name` først til `emd.first_name || ' ' || emd.last_name` først.

Også i GROUP BY klausulen, så den matcher SELECT-udtrykket.

### Filer der ændres

| Fil | Ændring |
|---|---|
| Database (ny migration) | Opdater `get_sales_aggregates_v2` med korrekt navneprioritering |

### Resultat
- "joel" → "Joel [Efternavn]"
- "trine" → "Trine [Efternavn]"  
- Inaktive medarbejdere vises stadig (ingen `is_active` filter)
- Ingen ændring i salgstal eller provision

