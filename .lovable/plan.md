
Problem
- Madhan findes allerede i databasen med `is_staff_employee = true` og `is_active = true`.
- Staff-listen sorterer på `last_name`, så Madhan burde faktisk ligge øverst.
- Derfor er dette ikke en rolle-/RLS-fejl. Det er meget sandsynligt en stale frontend-cache: previewet viser en gammel `staff-employees` query fra før dataændringen.

Hvad jeg fandt
- `StaffEmployeesTab.tsx` henter listen med `useQuery(["staff-employees"])` uden lokal refetch-strategi.
- Appens globale React Query-konfiguration har `staleTime: 60s` og `refetchOnWindowFocus: false`.
- Der er ingen realtime-subscription for medarbejderlisten.
- Network-snapshot viser ingen ny staff-liste request efter dataændringen, hvilket passer med cache-problemet.

Plan
1. Gør medarbejderlisterne selv-opdaterende
- Tilføj eksplicit refetch-konfiguration på:
  - `src/components/employees/StaffEmployeesTab.tsx`
  - `src/pages/EmployeeMasterData.tsx`
- Brug en kombination som:
  - `staleTime: 0`
  - `refetchOnMount: "always"`
  - `refetchOnWindowFocus: "always"`
- Så bliver listen genindlæst, når man vender tilbage til previewet eller åbner fanen igen.

2. Tilføj manuel “Opdater” fallback i UI
- Tilføj en lille refresh-knap i headeren på staff-listen (og evt. også alle medarbejdere).
- Knapen skal kalde queryens `refetch()`.
- Det giver en tydelig nødudvej ved backend-ændringer, imports eller manuelle datarettelser.

3. Hold begge faner i sync
- Samme refetch-adfærd bør gælde både:
  - “Stab”
  - “Alle medarbejdere”
- Ellers risikerer vi, at en medarbejder flyttes korrekt i databasen men stadig vises i den forkerte liste, indtil siden reloades.

4. QA
- Reproducer flowet med en medarbejder, der flyttes ind/ud af stab via backend/dataændring.
- Bekræft at:
  - Madhan dukker op i “Stab” uden hård reload
  - han forsvinder fra “Alle medarbejdere”
  - listen opdateres ved faneskift/fokus eller via refresh-knappen

Tekniske noter
- Ingen databaseændringer er nødvendige.
- Ingen RLS-ændringer er nødvendige for denne fejl.
- Den foreslåede Stack Overflow-retning om “roller loader for sent” matcher ikke den faktiske kode her; problemet er cache/synkronisering, ikke permission-resolution.

Praktisk lige nu
- En manuel browser-refresh af `/employees?tab=staff-employees` burde sandsynligvis få Madhan frem med det samme, fordi data allerede ligger korrekt i backend.
