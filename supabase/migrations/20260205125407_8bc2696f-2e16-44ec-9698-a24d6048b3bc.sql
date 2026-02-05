-- Fix reviewed_by foreign key to reference employee_master_data instead of auth.users
ALTER TABLE absence_request_v2 
DROP CONSTRAINT IF EXISTS absence_request_v2_reviewed_by_fkey;

ALTER TABLE absence_request_v2
ADD CONSTRAINT absence_request_v2_reviewed_by_fkey 
FOREIGN KEY (reviewed_by) REFERENCES employee_master_data(id) ON DELETE SET NULL;