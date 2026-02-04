

# Komplet Email Oprydning & Fremtidig Beskyttelse

## Nuværende Status

| Problem | Antal | Beskrivelse |
|---------|-------|-------------|
| Duplikerede agenter (case) | 6 | 3 agenter med både uppercase og lowercase email |
| Salg med uppercase emails | 435 | F.eks. `louh@Copenhagensales.dk` |
| Salg med ugyldige emails | 376 | gmail.com, hotmail.com, etc. |
| Agenter med ugyldige emails | 65 | Historiske agenter fra før whitelist |

## Eksisterende Beskyttelse (Verificeret)

| Lag | Status | Beskyttelse |
|-----|--------|-------------|
| Adapter-niveau (adversus.ts) | ✅ | `isValidSyncEmail()` filtrerer FØR database |
| Adapter-niveau (enreach.ts) | ✅ | `isValidSyncEmail()` filtrerer FØR database |
| Core sales.ts | ✅ | Whitelist defineret |
| Core users.ts | ✅ | Whitelist defineret |
| **Database-niveau** | ❌ | **INGEN CONSTRAINT ELLER TRIGGER** |

**Problem**: Hvis nogen bypasser adapterne (direkte SQL, ny integration, bug), kan ugyldige emails stadig indsættes.

---

## 5-Fase Plan

### Fase 1: Merge Duplikerede Agenter

**Hvad sker der:**
1. Opdater salg fra uppercase til lowercase email
2. Slet de tomme uppercase agent-poster

**SQL:**
```text
-- Flyt salg til lowercase
UPDATE sales 
SET agent_email = LOWER(agent_email)
WHERE agent_email IN ('Flkl@copenhagensales.dk', 'Dajo@copenhagensales.dk', 'Sima@copenhagensales.dk');

-- Slet duplikat-agenter (nu orphaned)
DELETE FROM agents 
WHERE email IN ('Flkl@copenhagensales.dk', 'Dajo@copenhagensales.dk', 'Sima@copenhagensales.dk');
```

---

### Fase 2: Normaliser Alle Emails til Lowercase

**Hvad sker der:** Alle resterende emails konverteres til lowercase.

**SQL:**
```text
UPDATE sales SET agent_email = LOWER(agent_email)
WHERE agent_email IS NOT NULL AND agent_email != LOWER(agent_email);

UPDATE agents SET email = LOWER(email)
WHERE email IS NOT NULL AND email != LOWER(email);
```

---

### Fase 3: Slet Legacy Data med Ugyldige Emails

**Hvad sker der:** Fjern historiske data der ikke matcher whitelist.

**SQL:**
```text
-- Slet sale_items først (foreign key)
DELETE FROM sale_items 
WHERE sale_id IN (
  SELECT id FROM sales 
  WHERE agent_email IS NOT NULL AND agent_email != ''
    AND NOT (agent_email LIKE '%@copenhagensales.dk' 
          OR agent_email LIKE '%@cph-relatel.dk' 
          OR agent_email LIKE '%@cph-sales.dk')
);

-- Slet salg
DELETE FROM sales 
WHERE agent_email IS NOT NULL AND agent_email != ''
  AND NOT (agent_email LIKE '%@copenhagensales.dk' 
        OR agent_email LIKE '%@cph-relatel.dk' 
        OR agent_email LIKE '%@cph-sales.dk');

-- Slet ugyldige agenter
DELETE FROM agents 
WHERE email IS NOT NULL AND email != ''
  AND NOT (email LIKE '%@copenhagensales.dk' 
        OR email LIKE '%@cph-relatel.dk' 
        OR email LIKE '%@cph-sales.dk');
```

---

### Fase 4: Database-Level Beskyttelse (NY!)

**Dette sikrer at problemet ALDRIG kan ske igen** - selv ved direkte SQL eller nye integrationer.

**4A: Trigger på `sales` tabellen**

```text
CREATE OR REPLACE FUNCTION validate_sales_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow NULL or empty emails (some sales may not have agent)
  IF NEW.agent_email IS NULL OR NEW.agent_email = '' THEN
    RETURN NEW;
  END IF;
  
  -- Normalize to lowercase
  NEW.agent_email := LOWER(NEW.agent_email);
  
  -- Validate against whitelist
  IF NOT (
    NEW.agent_email LIKE '%@copenhagensales.dk' OR
    NEW.agent_email LIKE '%@cph-relatel.dk' OR
    NEW.agent_email LIKE '%@cph-sales.dk'
  ) THEN
    RAISE EXCEPTION 'Invalid email domain. Only @copenhagensales.dk, @cph-relatel.dk, @cph-sales.dk are allowed. Got: %', NEW.agent_email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_sales_email_trigger
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION validate_sales_email();
```

**4B: Trigger på `agents` tabellen**

```text
CREATE OR REPLACE FUNCTION validate_agents_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow NULL or empty emails
  IF NEW.email IS NULL OR NEW.email = '' THEN
    RETURN NEW;
  END IF;
  
  -- Normalize to lowercase
  NEW.email := LOWER(NEW.email);
  
  -- Validate against whitelist
  IF NOT (
    NEW.email LIKE '%@copenhagensales.dk' OR
    NEW.email LIKE '%@cph-relatel.dk' OR
    NEW.email LIKE '%@cph-sales.dk'
  ) THEN
    RAISE EXCEPTION 'Invalid email domain. Only @copenhagensales.dk, @cph-relatel.dk, @cph-sales.dk are allowed. Got: %', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_agents_email_trigger
  BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION validate_agents_email();
```

**Fordele ved denne tilgang:**
- Automatisk lowercase-normalisering ved insert/update
- Afviser ugyldige emails med klar fejlbesked
- Fungerer uanset hvordan data kommer ind (adapters, SQL, fremtidige integrationer)

---

### Fase 5: Automatisk Ugentlig Oprydning (Sikkerhedsnet)

**Hvad sker der:** Backup-mekanisme der kører ugentligt og fjerner eventuelle edge cases.

```text
CREATE OR REPLACE FUNCTION cleanup_invalid_email_sales()
RETURNS jsonb AS $$
DECLARE
  sales_deleted integer := 0;
  agents_deleted integer := 0;
BEGIN
  -- Delete sale_items for invalid sales
  DELETE FROM sale_items 
  WHERE sale_id IN (
    SELECT id FROM sales 
    WHERE agent_email IS NOT NULL AND agent_email != ''
      AND NOT (agent_email LIKE '%@copenhagensales.dk' 
            OR agent_email LIKE '%@cph-relatel.dk' 
            OR agent_email LIKE '%@cph-sales.dk')
  );
  
  -- Delete invalid sales
  WITH deleted_sales AS (
    DELETE FROM sales 
    WHERE agent_email IS NOT NULL AND agent_email != ''
      AND NOT (agent_email LIKE '%@copenhagensales.dk' 
            OR agent_email LIKE '%@cph-relatel.dk' 
            OR agent_email LIKE '%@cph-sales.dk')
    RETURNING id
  )
  SELECT COUNT(*) INTO sales_deleted FROM deleted_sales;
  
  -- Delete invalid agents
  WITH deleted_agents AS (
    DELETE FROM agents 
    WHERE email IS NOT NULL AND email != ''
      AND NOT (email LIKE '%@copenhagensales.dk' 
            OR email LIKE '%@cph-relatel.dk' 
            OR email LIKE '%@cph-sales.dk')
    RETURNING id
  )
  SELECT COUNT(*) INTO agents_deleted FROM deleted_agents;
  
  RETURN jsonb_build_object(
    'sales_deleted', sales_deleted,
    'agents_deleted', agents_deleted,
    'executed_at', NOW()
  );
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

## Beskyttelseslag Efter Implementering

```text
┌─────────────────────────────────────────────────────────┐
│                    EKSTERN DATA                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  LAG 1: ADAPTER-FILTRERING (adversus.ts / enreach.ts)   │
│  • isValidSyncEmail() - whitelist                        │
│  • Filtrerer før data når core                           │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  LAG 2: CORE-FILTRERING (sales.ts / users.ts)           │
│  • Sekundær whitelist-check                              │
│  • Logger skippede emails                                │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  LAG 3: DATABASE TRIGGERS (NY!)                          │
│  • validate_sales_email_trigger                          │
│  • validate_agents_email_trigger                         │
│  • Auto-lowercase + afviser ugyldige                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  LAG 4: UGENTLIG CRON (sikkerhedsnet)                   │
│  • cleanup_invalid_email_sales()                         │
│  • Kører søndag 04:00                                    │
│  • Fjerner eventuelle edge cases                         │
└─────────────────────────────────────────────────────────┘
```

---

## Forventet Resultat

| Metrik | Før | Efter |
|--------|-----|-------|
| Duplikerede agenter | 6 | 0 |
| Salg med uppercase emails | 435 | 0 |
| Salg med ugyldige emails | 376 | 0 |
| Agenter med ugyldige emails | 65 | 0 |
| Database-level beskyttelse | ❌ | ✅ Trigger |
| Automatisk oprydning | ❌ | ✅ Ugentligt |
| Adapter-beskyttelse | ✅ | ✅ |

---

## Teknisk Sektion

### Hvorfor Trigger i Stedet for CHECK Constraint?

1. **Dynamisk normalisering**: Trigger kan ændre data (lowercase) før insert - CHECK kan kun validere
2. **Bedre fejlbeskeder**: RAISE EXCEPTION giver brugbar feedback
3. **Supabase-kompatibel**: Undgår problemer med immutable CHECK constraints

### Eksekveringsrækkefølge

Faserne skal køres i rækkefølge:
1. **Fase 1 + 2** først (normaliser data)
2. **Fase 3** derefter (slet ugyldige)
3. **Fase 4** så (installer triggers - kræver clean data)
4. **Fase 5** til sidst (cron job)

### Estimeret Tid

- Fase 1-2: 5 minutter
- Fase 3: 5 minutter
- Fase 4: 10 minutter
- Fase 5: 5 minutter
- **Total: ~25 minutter**

