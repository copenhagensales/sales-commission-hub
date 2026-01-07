-- Add context fields to communication_logs for smart routing
ALTER TABLE public.communication_logs 
ADD COLUMN IF NOT EXISTS sender_employee_id UUID REFERENCES employee_master_data(id),
ADD COLUMN IF NOT EXISTS context_type TEXT DEFAULT 'candidate',
ADD COLUMN IF NOT EXISTS target_employee_id UUID REFERENCES employee_master_data(id);

-- Add check constraint for context_type
ALTER TABLE public.communication_logs 
ADD CONSTRAINT communication_logs_context_type_check 
CHECK (context_type IN ('candidate', 'employee'));

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_comm_logs_sender ON communication_logs(sender_employee_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_context ON communication_logs(context_type);
CREATE INDEX IF NOT EXISTS idx_comm_logs_target ON communication_logs(target_employee_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_phone_direction ON communication_logs(phone_number, direction);

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Recruitment can view all communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Recruitment can insert communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Recruitment can update communication logs" ON communication_logs;
DROP POLICY IF EXISTS "Service role full access" ON communication_logs;

-- Create new RLS policies with context-based visibility

-- SELECT policy: Context-aware visibility
CREATE POLICY "Context-aware read access" ON communication_logs
FOR SELECT USING (
  -- Candidate context: visible to recruitment + owners
  (context_type = 'candidate' AND (
    public.is_rekruttering(auth.uid()) OR public.is_owner(auth.uid())
  ))
  OR
  -- Employee context: only sender and target can see
  (context_type = 'employee' AND (
    sender_employee_id = public.get_current_employee_id()
    OR
    target_employee_id = public.get_current_employee_id()
  ))
  OR
  -- Fallback for legacy records without context (treat as candidate)
  (context_type IS NULL AND (
    public.is_rekruttering(auth.uid()) OR public.is_owner(auth.uid())
  ))
);

-- INSERT policy: Authenticated users can insert their own messages
CREATE POLICY "Authenticated users can insert" ON communication_logs
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL
);

-- UPDATE policy: Users can update messages they can see
CREATE POLICY "Users can update accessible messages" ON communication_logs
FOR UPDATE USING (
  -- Same logic as SELECT
  (context_type = 'candidate' AND (
    public.is_rekruttering(auth.uid()) OR public.is_owner(auth.uid())
  ))
  OR
  (context_type = 'employee' AND (
    sender_employee_id = public.get_current_employee_id()
    OR
    target_employee_id = public.get_current_employee_id()
  ))
  OR
  (context_type IS NULL AND (
    public.is_rekruttering(auth.uid()) OR public.is_owner(auth.uid())
  ))
);