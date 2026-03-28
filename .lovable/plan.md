

## Plan: Vis hvem der har tilgået data i begge audit-logs

### Problem
Sensitive access log viser kun hvilken medarbejders data der blev tilgået, men **ikke hvem der tilgik den**. Tabellen har allerede `user_id` — det vises bare ikke i UI'et.

Contract access log viser allerede begge dele, men kolonnenavnene kan tydeliggøres.

### Ændringer

**`src/pages/compliance/SensitiveAccessLog.tsx`**
1. Tilføj en query der resolver `user_id` til medarbejdernavn (via `employee_master_data.auth_user_id`)
2. Tilføj en "Tilgået af" kolonne i tabellen der viser brugerens navn
3. Opdater søgefunktionen til også at søge på brugernavnet
4. Omdøb "Medarbejder" kolonnen til "Berørt medarbejder" for klarhed

### Filer

| Fil | Ændring |
|-----|---------|
| `src/pages/compliance/SensitiveAccessLog.tsx` | Tilføj bruger-lookup + "Tilgået af" kolonne |

