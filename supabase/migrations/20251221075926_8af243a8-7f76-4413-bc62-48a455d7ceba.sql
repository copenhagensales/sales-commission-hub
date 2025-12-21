-- Drop the problematic policy
DROP POLICY IF EXISTS "View own membership" ON chat_conversation_members;

-- Create a simple policy that only checks employee_id without calling is_conversation_member
CREATE POLICY "Members can view conversation members"
ON chat_conversation_members FOR SELECT
TO authenticated
USING (
  employee_id = public.get_current_employee_id()
);