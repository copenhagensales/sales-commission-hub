-- Function to create coaching tasks for a new employee
CREATE OR REPLACE FUNCTION public.create_onboarding_coaching_tasks_for_employee(
  p_employee_id UUID,
  p_start_date DATE DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leader_id UUID;
  v_start_date DATE;
  v_day RECORD;
  v_task_count INTEGER := 0;
  v_due_date TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get the employee's manager (team leader) and start date
  SELECT manager_id, COALESCE(p_start_date, employment_start_date)
  INTO v_leader_id, v_start_date
  FROM employee_master_data
  WHERE id = p_employee_id;
  
  -- If no start date, use today
  IF v_start_date IS NULL THEN
    v_start_date := CURRENT_DATE;
  END IF;
  
  -- Loop through all onboarding days and create tasks
  FOR v_day IN 
    SELECT id, day 
    FROM onboarding_days 
    WHERE is_active = true 
    ORDER BY day
  LOOP
    -- Calculate due date (start_date + day number - 1, at 17:00)
    v_due_date := (v_start_date + (v_day.day - 1) * INTERVAL '1 day')::date + INTERVAL '17 hours';
    
    -- Skip if task already exists
    IF NOT EXISTS (
      SELECT 1 FROM onboarding_coaching_tasks 
      WHERE employee_id = p_employee_id 
        AND onboarding_day_id = v_day.id
    ) THEN
      INSERT INTO onboarding_coaching_tasks (
        employee_id,
        leader_id,
        onboarding_day_id,
        due_date,
        status
      ) VALUES (
        p_employee_id,
        v_leader_id,
        v_day.id,
        v_due_date,
        'open'
      );
      v_task_count := v_task_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_task_count;
END;
$$;

-- Function to mark overdue tasks
CREATE OR REPLACE FUNCTION public.update_overdue_coaching_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE onboarding_coaching_tasks
  SET status = 'overdue', updated_at = now()
  WHERE status = 'open'
    AND due_date < now();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function to get coaching coverage stats per leader
CREATE OR REPLACE FUNCTION public.get_coaching_coverage_stats(p_leader_id UUID DEFAULT NULL)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  leader_id UUID,
  leader_name TEXT,
  total_tasks BIGINT,
  completed_tasks BIGINT,
  open_tasks BIGINT,
  overdue_tasks BIGINT,
  completion_rate NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    e.id as employee_id,
    e.first_name || ' ' || e.last_name as employee_name,
    t.leader_id,
    COALESCE(l.first_name || ' ' || l.last_name, 'Ikke tildelt') as leader_name,
    COUNT(t.id) as total_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'done') as completed_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'open') as open_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'overdue') as overdue_tasks,
    CASE 
      WHEN COUNT(t.id) > 0 THEN ROUND((COUNT(t.id) FILTER (WHERE t.status = 'done')::numeric / COUNT(t.id)::numeric) * 100, 1)
      ELSE 0
    END as completion_rate
  FROM onboarding_coaching_tasks t
  JOIN employee_master_data e ON e.id = t.employee_id
  LEFT JOIN employee_master_data l ON l.id = t.leader_id
  WHERE (p_leader_id IS NULL OR t.leader_id = p_leader_id)
  GROUP BY e.id, e.first_name, e.last_name, t.leader_id, l.first_name, l.last_name
  ORDER BY overdue_tasks DESC, open_tasks DESC;
$$;

-- Trigger to auto-create coaching tasks when employee starts (based on employment_start_date)
CREATE OR REPLACE FUNCTION public.trigger_create_onboarding_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only trigger for new employees with recent employment_start_date
  IF NEW.employment_start_date IS NOT NULL 
     AND NEW.employment_start_date >= CURRENT_DATE 
     AND NEW.is_active = true THEN
    -- Create coaching tasks for this employee
    PERFORM create_onboarding_coaching_tasks_for_employee(NEW.id, NEW.employment_start_date);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on employee_master_data
DROP TRIGGER IF EXISTS create_onboarding_tasks_on_new_employee ON employee_master_data;
CREATE TRIGGER create_onboarding_tasks_on_new_employee
  AFTER INSERT OR UPDATE OF employment_start_date, is_active
  ON employee_master_data
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_onboarding_tasks();