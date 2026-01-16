-- Fix Jonas' broken position_id to point to the correct Teamleder position
UPDATE employee_master_data 
SET 
  position_id = '412a9da6-7194-47a3-b67b-c02ad4eb13d0',
  updated_at = NOW()
WHERE id = '2922454c-72c5-4f7b-86c0-300efd5f55b5';