-- One-time cleanup: Set invitation_status to 'completed' for all users who have logged in
UPDATE employee_master_data 
SET invitation_status = 'completed'
WHERE auth_user_id IS NOT NULL 
AND invitation_status = 'pending';