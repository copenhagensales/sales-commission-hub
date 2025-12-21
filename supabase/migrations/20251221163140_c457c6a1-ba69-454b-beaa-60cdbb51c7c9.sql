-- Updated function to skip weekends and absence days when calculating due dates
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
  v_due_date DATE;
  v_current_date DATE;
  v_days_added INTEGER;
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
    -- Calculate due date skipping weekends and absence days
    v_current_date := v_start_date;
    v_days_added := 0;
    
    WHILE v_days_added < v_day.day LOOP
      -- Check if current date is a weekend (0 = Sunday, 6 = Saturday)
      IF EXTRACT(DOW FROM v_current_date) NOT IN (0, 6) THEN
        -- Check if employee has approved absence on this date
        IF NOT EXISTS (
          SELECT 1 FROM absence_request_v2
          WHERE employee_id = p_employee_id
            AND status = 'approved'
            AND v_current_date BETWEEN start_date::date AND end_date::date
        ) THEN
          v_days_added := v_days_added + 1;
        END IF;
      END IF;
      
      IF v_days_added < v_day.day THEN
        v_current_date := v_current_date + 1;
      END IF;
    END LOOP;
    
    v_due_date := v_current_date;
    
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
        v_due_date + INTERVAL '17 hours',
        'open'
      );
      v_task_count := v_task_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_task_count;
END;
$$;

-- Function to recalculate due dates when absence is added/updated
CREATE OR REPLACE FUNCTION public.recalculate_coaching_due_dates_for_employee(p_employee_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start_date DATE;
  v_task RECORD;
  v_current_date DATE;
  v_days_added INTEGER;
  v_target_day INTEGER;
  v_due_date DATE;
  v_updated INTEGER := 0;
BEGIN
  -- Get employee start date
  SELECT employment_start_date INTO v_start_date
  FROM employee_master_data
  WHERE id = p_employee_id;
  
  IF v_start_date IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Loop through all open/overdue tasks for this employee
  FOR v_task IN 
    SELECT t.id, d.day as target_day
    FROM onboarding_coaching_tasks t
    JOIN onboarding_days d ON d.id = t.onboarding_day_id
    WHERE t.employee_id = p_employee_id
      AND t.status IN ('open', 'overdue')
    ORDER BY d.day
  LOOP
    v_target_day := v_task.target_day;
    v_current_date := v_start_date;
    v_days_added := 0;
    
    WHILE v_days_added < v_target_day LOOP
      -- Skip weekends
      IF EXTRACT(DOW FROM v_current_date) NOT IN (0, 6) THEN
        -- Skip approved absences
        IF NOT EXISTS (
          SELECT 1 FROM absence_request_v2
          WHERE employee_id = p_employee_id
            AND status = 'approved'
            AND v_current_date BETWEEN start_date::date AND end_date::date
        ) THEN
          v_days_added := v_days_added + 1;
        END IF;
      END IF;
      
      IF v_days_added < v_target_day THEN
        v_current_date := v_current_date + 1;
      END IF;
    END LOOP;
    
    v_due_date := v_current_date;
    
    -- Update if due date changed
    UPDATE onboarding_coaching_tasks
    SET due_date = v_due_date + INTERVAL '17 hours',
        updated_at = now()
    WHERE id = v_task.id
      AND (due_date IS NULL OR due_date::date != v_due_date);
    
    IF FOUND THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  
  RETURN v_updated;
END;
$$;

-- Trigger to recalculate due dates when absence is approved
CREATE OR REPLACE FUNCTION public.trigger_recalculate_coaching_on_absence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalculate when absence is approved or dates change
  IF (TG_OP = 'INSERT' AND NEW.status = 'approved') OR
     (TG_OP = 'UPDATE' AND NEW.status = 'approved') THEN
    PERFORM recalculate_coaching_due_dates_for_employee(NEW.employee_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on absence_request_v2
DROP TRIGGER IF EXISTS recalculate_coaching_on_absence ON absence_request_v2;
CREATE TRIGGER recalculate_coaching_on_absence
  AFTER INSERT OR UPDATE OF status, start_date, end_date
  ON absence_request_v2
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_coaching_on_absence();