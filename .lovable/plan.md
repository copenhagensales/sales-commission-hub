# Hvorfor Lucas' Hiper-salg ikke vises

## Root cause (bekræftet i DB)

`manual-sales` edge function (linje 235) sætter `agent_email = employee.work_email` ved oprettelse. Lucas Baz Uttrup (`fe4d5dff-…`) har `work_email = NULL` i `employee_master_data`, så alle 9 Hiper-salg fra i dag er gemt med **tom `agent_email`**.

Tavle og dagsrapporter attribuerer salg via `agent_email` (join mod `employee_agent_mapping` / `work_email`). Uden email findes salgene, men de kobles ikke til Lucas → dukker ikke op på Hiper-tavlen eller i dagsrapporter.

Til sammenligning: Lucas' Adversus-salg (Eesy TM) har `agent_email = lubu@copenhagensales.dk` og virker fint.

## Fix (2 dele — data + guard)

### 1. Data-fix (én gang)
- Sæt `employee_master_data.work_email = 'lubu@copenhagensales.dk'` for Lucas (samme email som Adversus bruger).
- Backfill de 9 eksisterende manual Hiper-salg: `UPDATE sales SET agent_email = 'lubu@copenhagensales.dk' WHERE source='manual_entry' AND agent_name='Lucas Baz Uttrup' AND (agent_email IS NULL OR agent_email='')`.

### 2. Guard i `manual-sales` edge function (forhindrer at det gentager sig)
I `supabase/functions/manual-sales/index.ts`, i create-flowet før insert: hvis `employee.work_email` er null/tom → returnér `400` med besked `"Din work_email mangler i medarbejder-master. Bed en admin udfylde den før du kan taste salg."`. Ingen ændring i eksisterende happy-path.

## Uden for scope
- Ingen ændring af tavle-/rapport-hooks (attribuering via `agent_email` bevares som i dag).
- Ingen ændring af pricing, sale_items eller commission (allerede korrekte — kun attribution er brudt).
- Andre medarbejdere uden work_email er ikke tjekket her; kan gøres i særskilt sweep hvis ønsket.

## Verificering
- Efter data-fix: Lucas' 9 Hiper-salg vises på Hiper-tavlen og i dagsrapport for i dag.
- Efter guard: nyt manuelt salg fra en medarbejder uden work_email returnerer klar 400-fejl i stedet for at oprette et "usynligt" salg.

## Zone
- Data-fix: gul (rører `employee_master_data` og `sales`, men kun 1 række + 9 salg for én sælger; ingen løn-/prisberegning ændres).
- Guard: gul (edge function, ingen ændring i eksisterende adfærd).
