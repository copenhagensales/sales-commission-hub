-- Drop the existing helper function (if it exists with wrong signature)
DROP FUNCTION IF EXISTS public.is_conversation_member(uuid);

-- Create a new helper function that uses get_current_employee_id()
CREATE OR REPLACE FUNCTION public.is_chat_conversation_member(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_conversation_members ccm
    WHERE ccm.conversation_id = _conversation_id
      AND ccm.employee_id = get_current_employee_id()
  )
$$;

-- chat_conversations policies
CREATE POLICY "Users can view conversations they are members of"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (public.is_chat_conversation_member(id));

CREATE POLICY "Authenticated users can create conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Members can update their conversations"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (public.is_chat_conversation_member(id));

-- chat_conversation_members policies
CREATE POLICY "Users can view members of their conversations"
ON public.chat_conversation_members
FOR SELECT
TO authenticated
USING (public.is_chat_conversation_member(conversation_id));

CREATE POLICY "Users can add members to conversations they are part of"
ON public.chat_conversation_members
FOR INSERT
TO authenticated
WITH CHECK (public.is_chat_conversation_member(conversation_id) OR NOT EXISTS (
  SELECT 1 FROM public.chat_conversation_members WHERE conversation_id = chat_conversation_members.conversation_id
));

CREATE POLICY "Users can remove themselves from conversations"
ON public.chat_conversation_members
FOR DELETE
TO authenticated
USING (employee_id = get_current_employee_id());

-- chat_messages policies
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (public.is_chat_conversation_member(conversation_id));

CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (public.is_chat_conversation_member(conversation_id));

CREATE POLICY "Users can edit their own messages"
ON public.chat_messages
FOR UPDATE
TO authenticated
USING (sender_id = get_current_employee_id());

CREATE POLICY "Users can delete their own messages"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (sender_id = get_current_employee_id());