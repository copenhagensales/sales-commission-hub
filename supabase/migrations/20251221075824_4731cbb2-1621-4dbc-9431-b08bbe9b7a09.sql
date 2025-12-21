-- Drop existing policies that cause infinite recursion
DROP POLICY IF EXISTS "Users can view their conversation members" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can insert conversation members" ON chat_conversation_members;
DROP POLICY IF EXISTS "Members can view conversation members" ON chat_conversation_members;
DROP POLICY IF EXISTS "Members can insert members" ON chat_conversation_members;

DROP POLICY IF EXISTS "Users can view their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Members can view conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON chat_conversations;

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON chat_messages;
DROP POLICY IF EXISTS "Members can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Members can send messages" ON chat_messages;

-- Create a security definer function to check conversation membership without recursion
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id uuid, p_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM chat_conversation_members
    WHERE conversation_id = p_conversation_id
      AND employee_id = p_employee_id
  )
$$;

-- Create a function to get current employee id safely
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM employee_master_data WHERE auth_user_id = auth.uid() LIMIT 1
$$;

-- RLS policies for chat_conversations
CREATE POLICY "Members can view conversations"
ON chat_conversations FOR SELECT
TO authenticated
USING (
  public.is_conversation_member(id, public.get_current_employee_id())
);

CREATE POLICY "Authenticated users can create conversations"
ON chat_conversations FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Members can update conversations"
ON chat_conversations FOR UPDATE
TO authenticated
USING (
  public.is_conversation_member(id, public.get_current_employee_id())
);

-- RLS policies for chat_conversation_members (no self-referencing)
CREATE POLICY "View own membership"
ON chat_conversation_members FOR SELECT
TO authenticated
USING (
  employee_id = public.get_current_employee_id()
  OR public.is_conversation_member(conversation_id, public.get_current_employee_id())
);

CREATE POLICY "Insert members into conversations"
ON chat_conversation_members FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS policies for chat_messages
CREATE POLICY "Members can view messages"
ON chat_messages FOR SELECT
TO authenticated
USING (
  public.is_conversation_member(conversation_id, public.get_current_employee_id())
);

CREATE POLICY "Members can send messages"
ON chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = public.get_current_employee_id()
);