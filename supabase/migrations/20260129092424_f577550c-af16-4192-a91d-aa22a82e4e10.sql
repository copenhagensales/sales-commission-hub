-- Drop den fejlagtige policy
DROP POLICY IF EXISTS "Users can manage own invitation views" ON event_invitation_views;

-- Opret korrekt policy med employee_master_data
CREATE POLICY "Users can manage own invitation views"
ON event_invitation_views
FOR ALL
TO authenticated
USING (
  employee_id IN (
    SELECT id FROM employee_master_data 
    WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
       OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM employee_master_data 
    WHERE LOWER(private_email) = LOWER(auth.jwt()->>'email') 
       OR LOWER(work_email) = LOWER(auth.jwt()->>'email')
  )
);