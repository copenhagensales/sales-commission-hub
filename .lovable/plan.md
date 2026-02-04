
# Komplet Status & Resterende Opgaver

## Analyse af Nuværende Situation

### ✅ Hvad ER Implementeret (verificeret i koden)

| # | Opgave | Status | Detaljer |
|---|--------|--------|----------|
| 1-4 | SQL Migrations (cleanup + constraints) | ✅ | Udført tidligere |
| 5 | RPC `get_sales_aggregates_v2` | ✅ | Fungerer, bekræftet i /salary |
| 6 | `excluded-domains.ts` whitelist | ✅ | VALID_EMAIL_DOMAINS defineret |
| 7-8 | `users.ts` + `sales.ts` filtrering | ✅ | Bruger `isValidSyncEmail()` |
| 9 | `adversus.ts` email-filtrering | ✅ | Linje 134-182: Whitelist aktiv |
| 10 | `enreach.ts` email-filtrering | ✅ | Linje 338-354: Whitelist aktiv |
| 11 | `useSalesAggregates.ts` hook | ✅ | + wrapper hooks |
| 12-17 | Frontend migrations | ✅ | Bekræftet med browser-test |

### ❌ Hvad MANGLER Stadig

#### Problem 1: Legacy Data i Databasen
- **376 salg** med ugyldige emails (gmail.com, hotmail.com)
- **65 agenter** med ugyldige emails
- Fordeling:
  - `Relatel_CPHSALES`: 342 salg (3 unikke emails)
  - `Lovablecph`: 33 salg (2 unikke emails)  
  - `Eesy`: 1 salg (1 unik email)

#### Problem 2: Case-Sensitivity Bug
- **48 salg** med `louh@Copenhagensales.dk` (stort C)
- Disse tæller som "ugyldige" fordi whitelist bruger lowercase check

#### Problem 3: Cleanup Cron Mangler
- Task 22 aldrig implementeret
- Ingen automatisk oprydning af legacy data

---

## Plan: Komplet Oprydning

### Fase 1: Case-Sensitivity Fix (5 min)

Normaliser emails i databasen til lowercase:

```text
UPDATE sales 
SET agent_email = LOWER(agent_email)
WHERE agent_email != LOWER(agent_email);

UPDATE agents 
SET email = LOWER(email)
WHERE email != LOWER(email);
```

### Fase 2: Slet Legacy Data (10 min)

Fjern historiske salg med ugyldige emails:

```text
-- Slet sale_items først (foreign key)
DELETE FROM sale_items 
WHERE sale_id IN (
  SELECT id FROM sales 
  WHERE agent_email IS NOT NULL 
    AND agent_email != ''
    AND NOT (
      LOWER(agent_email) LIKE '%@copenhagensales.dk' OR
      LOWER(agent_email) LIKE '%@cph-relatel.dk' OR
      LOWER(agent_email) LIKE '%@cph-sales.dk'
    )
);

-- Slet salg
DELETE FROM sales 
WHERE agent_email IS NOT NULL 
  AND agent_email != ''
  AND NOT (
    LOWER(agent_email) LIKE '%@copenhagensales.dk' OR
    LOWER(agent_email) LIKE '%@cph-relatel.dk' OR
    LOWER(agent_email) LIKE '%@cph-sales.dk'
  );

-- Slet ugyldige agenter
DELETE FROM agents 
WHERE email IS NOT NULL 
  AND email != ''
  AND NOT (
    LOWER(email) LIKE '%@copenhagensales.dk' OR
    LOWER(email) LIKE '%@cph-relatel.dk' OR
    LOWER(email) LIKE '%@cph-sales.dk'
  );
```

### Fase 3: Cleanup Cron Job (15 min)

Opret en database-funktion + cron job der kører ugentligt:

```text
-- Funktion til at rydde op i ugyldige emails
CREATE OR REPLACE FUNCTION cleanup_invalid_email_sales()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Slet sale_items for salg med ugyldige emails
  DELETE FROM sale_items 
  WHERE sale_id IN (
    SELECT id FROM sales 
    WHERE agent_email IS NOT NULL 
      AND agent_email != ''
      AND NOT (
        agent_email LIKE '%@copenhagensales.dk' OR
        agent_email LIKE '%@cph-relatel.dk' OR
        agent_email LIKE '%@cph-sales.dk'
      )
  );
  
  -- Slet salg med ugyldige emails
  WITH deleted AS (
    DELETE FROM sales 
    WHERE agent_email IS NOT NULL 
      AND agent_email != ''
      AND NOT (
        agent_email LIKE '%@copenhagensales.dk' OR
        agent_email LIKE '%@cph-relatel.dk' OR
        agent_email LIKE '%@cph-sales.dk'
      )
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron job: kør hver søndag kl. 04:00
SELECT cron.schedule(
  'cleanup-invalid-email-sales-weekly',
  '0 4 * * 0',
  'SELECT cleanup_invalid_email_sales()'
);
```

---

## Teknisk Opsummering

### Verificeret Fungerende
- Email whitelist **virker i adapters** - ingen nye gmail-salg siden 27. januar
- Central hook bruger RPC korrekt (234ms responstid)
- Alle frontend-komponenter migreret

### Deprioriteret (stadig gældende)
- Task 18-21: Lav risiko, høj kompleksitet

### Estimat for Resterende Arbejde
- Fase 1: 5 minutter
- Fase 2: 10 minutter  
- Fase 3: 15 minutter
- **Total: ~30 minutter**

---

## Forventet Resultat

Efter implementering:
- ✅ 0 salg med ugyldige emails
- ✅ 0 agenter med ugyldige emails  
- ✅ Case-insensitive email matching
- ✅ Automatisk ugentlig oprydning
- ✅ Fremtidig beskyttelse via adapter-filtrering
