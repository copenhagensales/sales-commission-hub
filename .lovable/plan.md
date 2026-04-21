

## Diagnose: Find CPH-sælgeren på Alka — udtøm alle muligheder

### Kontekst
- 178 success-leads i går på Alka — alle attribueret til `@tryg.dk` via `lastModifiedByUser`
- Du bekræfter at en `@copenhagensales.dk` sælger sidder på opgaven
- Vi har KUN tjekket `lastModifiedByUser` indtil nu
- Adapter-koden har 3 fallback-lag: `firstProcessedByUser.email` → `lastModifiedByUser.email` → `orgCode→email`-map

### Hypoteser der skal testes (alle ad gangen, kun Alka API + DB read)

**H1: CPH-sælger findes som Enreach-bruger med CPH-email**  
→ Søg `/users` for alle 3 CPH-domæner

**H2: CPH-sælger er `firstProcessedByUser` (ikke `lastModified`)**  
→ Scan `firstProcessedByUser` på sidste 7 dage

**H3: CPH-sælger har en `@tryg.dk` alias-email i Enreach, men findes i vores `employee_master_data` med CPH-email**  
→ Krydsreferér alle 587 Enreach-brugeres navne mod `employee_master_data.first_name + last_name` hvor `work_email` ender på CPH-domæne

**H4: CPH-sælger findes via et andet brugerfelt (`createdByUser`, `assignedToUser`, etc.)**  
→ Inspicér ALLE user-relaterede felter i en sample lead-payload med `Include=*` eller bredere

**H5: Salgene findes faktisk i DB, men under et andet integration_id (Tryg's egen)**  
→ Query `sales` for sidste 7 dage hvor `agent_email LIKE '%copenhagensales%'` på TVÆRS af alle Enreach-integrationer

**H6: CPH-sælgeren bruger en helt 3. email-domain vi ikke har whitelistet endnu**  
→ List top 50 unikke email-domæner blandt alle 587 Enreach-brugere

### Implementering

**Fil:** `supabase/functions/probe-enreach-integration/index.ts` (udvides med 6 tjek)

Probe kører kun mod Alka credentials (`integration_id=48d8bd23-...`), maks ~15 ekstra API-kald.

### Output-rapport

```
fullDiagnosis: {
  H1_cphUsersInEnreach: [{name,email,orgCode,isActive,lastActive}],
  H2_firstProcessedDomains: { "@tryg.dk":N, "@copenhagensales.dk":N, ...},
  H3_nameMatchedToCphEmployees: [{enreachName, enreachEmail, cphWorkEmail}],
  H4_allUserFieldsInLead: ["lastModifiedByUser","firstProcessedByUser",...],
  H5_existingSalesInDb: { count, sampleAgentEmails:[...] },
  H6_topDomainsInEnreach: { "@tryg.dk":520, "@alka.dk":40, ...},
  recommendation: "..."
}
```

### Hvad jeg IKKE rører
- Andre integrationer (Tryg, Eesy, ASE, Adversus) — probe kalder kun Alka credentials
- `EnreachAdapter`, sync-logik, calls-sync
- Database write (kun SELECT på `sales` + `employee_master_data`)
- Whitelist-config (allerede sat til kun `@copenhagensales.dk` via tidligere migration)

### Næste skridt
Kør probe → få entydigt svar på hvor CPH-sælgeren skjuler sig → vælg targeted fix (justér attribution-prioritet, tilføj alias-mapping, eller bekræft at salget skal komme via anden kanal).

