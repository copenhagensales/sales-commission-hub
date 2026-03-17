

## Hvorfor Madhan skal oprette MFA

Madhans `job_title` er **"Rekruttering"**, og positionen `Rekruttering` i `job_positions`-tabellen har `requires_mfa = true`.

Flowet i `useMfa.ts` er:
1. Finder medarbejderens `job_title` → "Rekruttering"
2. Slår op i `job_positions` → `requires_mfa = true`
3. `isRequired = true` → MFA-lås vises i `LockOverlays`

### Muligheder

**A) Slå MFA-krav fra for Rekruttering-positionen:**
```sql
UPDATE job_positions SET requires_mfa = false WHERE name = 'Rekruttering';
```

**B) Slå MFA-krav fra kun for Madhan** ved at tilføje en IP-exemption eller en individuel override.

**C) Behold MFA-kravet** – Madhan skal sætte MFA op som forventet.

Anbefaling: Hvis Rekruttering ikke skal kræve MFA, kør option A (én database-opdatering, ingen kodeændring). Hvis kun Madhan skal undtages, skal vi tilføje en individuel override-kolonne.

