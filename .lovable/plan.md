

## Problem: Forkerte provisioner i ligaen

### Root Cause

**Bug i email-opslag:** `league-calculate-standings` mapper hver medarbejder til **én** agent-email. Men mange medarbejdere (mindst 10 af 57) har **flere** agent-mappings (f.eks. `fbdo@cph-relatel.dk` OG `fbdo@copenhagensales.dk`). Koden overskriver den første email med den sidste — og ender med den forkerte.

Frederik Bülow har salg under `fbdo@cph-relatel.dk`, men funktionen bruger `fbdo@copenhagensales.dk` (den sidste mapping der processeres). Resultat: 0 kr.

**24 spillere** viser 0 kr provision — størstedelen skyldes sandsynligvis denne bug.

### Sekundært problem: `qualification_source_end`

Season source_end er sat til `2026-03-22 00:00:00` — men `.lte("sale_datetime", sourceEnd)` udelukker alle salg den 22. marts efter midnat. Bør bruge `< 2026-03-23` eller sætte end til `23:59:59`.

### Tilmelding midt i ugen

Allerede korrekt: Funktionen bruger sæsonens datointerval, ikke tilmeldingsdato. Salg fra hele ugen medtages uanset hvornår man tilmelder sig.

---

### Plan

**Fil:** `supabase/functions/league-calculate-standings/index.ts`

| Ændring | Detalje |
|---------|---------|
| Multi-email mapping | Skift `employeeToAgentEmail` fra `Record<string, string>` til `Record<string, string[]>` — saml ALLE emails per medarbejder |
| Provisionsopslag | Summer provision fra ALLE emails for en given medarbejder |
| Source end dato | Brug `< sourceEnd + 1 dag` i stedet for `<= sourceEnd` for at inkludere hele slutdagen |

```text
Før:  employee → 1 email → lookup sales
Efter: employee → [email1, email2, ...] → lookup sales across ALL emails
```

Ingen UI-ændringer nødvendige. Funktionen redeployes automatisk, og næste beregning (hvert 15. minut) vil give korrekte tal.

