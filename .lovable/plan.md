
# Map flkl1-agent til Floras medarbejderprofil

## Problem
Flora har 64 ASE-salg registreret under agenten `flkl1@copenhagensales.dk`, men denne agent er ikke mappet til hendes medarbejderprofil. Kun `flkl@copenhagensales.dk` er mappet. Derfor returnerer `useHasImmediatePaymentSales`-hooket `false`, og menupunktet "Straksbetaling (ASE)" er skjult for hende.

38 af de 64 salg har prisregler med `allows_immediate_payment = true`, saa hun burde have adgang.

## Loesning

### Trin 1: Opret agent-mapping
Indsaet en ny raekke i `employee_agent_mapping` der forbinder Floras medarbejder-ID med `flkl1`-agenten:

- **employee_id**: `a30e5992-3545-424c-9b4a-bc429b035ff6` (Flora)
- **agent_id**: `203c1d38-3f42-435e-bb3f-a4b734bf84dc` (flkl1@copenhagensales.dk)

```text
INSERT INTO employee_agent_mapping (employee_id, agent_id)
VALUES (
  'a30e5992-3545-424c-9b4a-bc429b035ff6',
  '203c1d38-3f42-435e-bb3f-a4b734bf84dc'
);
```

### Ingen kodeaendringer
Hooket `useHasImmediatePaymentSales` henter automatisk alle agent-mappings og tjekker ASE-salg for hver agent-email. Naar `flkl1` er mappet, vil hooket finde de 38 salg med `allows_immediate_payment = true` og vise menupunktet.

## Forventet resultat
- Flora kan se "Straksbetaling (ASE)" i menuen
- Hendes 64 ASE-salg (under flkl1) taeller med i provision og statistik
- Ingen pavirkning paa andre medarbejdere
