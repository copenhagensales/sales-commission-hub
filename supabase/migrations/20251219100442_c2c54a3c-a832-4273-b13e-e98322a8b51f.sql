-- Create trigger function to clean up assignments when booked_days changes
CREATE OR REPLACE FUNCTION public.cleanup_booking_assignments_on_days_change()
RETURNS TRIGGER AS $$
DECLARE
  day_index integer;
  assignment_date date;
BEGIN
  -- Only run if booked_days changed
  IF OLD.booked_days IS DISTINCT FROM NEW.booked_days THEN
    -- Find days that were removed (in OLD but not in NEW)
    FOR day_index IN SELECT unnest(OLD.booked_days) EXCEPT SELECT unnest(COALESCE(NEW.booked_days, ARRAY[]::integer[]))
    LOOP
      -- Calculate the date for this day index (0 = Monday of the week)
      assignment_date := NEW.start_date + day_index;
      
      -- Delete assignments for this day
      DELETE FROM public.booking_assignment
      WHERE booking_id = NEW.id AND date = assignment_date;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on booking table
DROP TRIGGER IF EXISTS cleanup_assignments_on_booked_days_change ON public.booking;
CREATE TRIGGER cleanup_assignments_on_booked_days_change
  AFTER UPDATE OF booked_days ON public.booking
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_booking_assignments_on_days_change();