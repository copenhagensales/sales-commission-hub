-- FASE 4: Database-Level Beskyttelse - Triggers for email validering

-- 4A: Trigger funktion for sales tabellen
CREATE OR REPLACE FUNCTION public.validate_sales_email()
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on sales table
DROP TRIGGER IF EXISTS validate_sales_email_trigger ON public.sales;
CREATE TRIGGER validate_sales_email_trigger
  BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_sales_email();

-- 4B: Trigger funktion for agents tabellen
CREATE OR REPLACE FUNCTION public.validate_agents_email()
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
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on agents table
DROP TRIGGER IF EXISTS validate_agents_email_trigger ON public.agents;
CREATE TRIGGER validate_agents_email_trigger
  BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_agents_email();

-- 4C: Cleanup funktion for ugentlig cron (Fase 5 forberedelse)
CREATE OR REPLACE FUNCTION public.cleanup_invalid_email_sales()
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
  
  -- Delete invalid agents (only those without relationships)
  WITH deleted_agents AS (
    DELETE FROM agents 
    WHERE email IS NOT NULL AND email != ''
      AND NOT (email LIKE '%@copenhagensales.dk' 
            OR email LIKE '%@cph-relatel.dk' 
            OR email LIKE '%@cph-sales.dk')
      AND id NOT IN (SELECT DISTINCT agent_id FROM dialer_calls WHERE agent_id IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT agent_id FROM employee_agent_mapping WHERE agent_id IS NOT NULL)
    RETURNING id
  )
  SELECT COUNT(*) INTO agents_deleted FROM deleted_agents;
  
  RETURN jsonb_build_object(
    'sales_deleted', sales_deleted,
    'agents_deleted', agents_deleted,
    'executed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;