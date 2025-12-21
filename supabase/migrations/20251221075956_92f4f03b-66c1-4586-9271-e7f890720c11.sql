-- Drop ALL existing chat policies completely
DROP POLICY IF EXISTS "Members can view conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON chat_conversations;
DROP POLICY IF EXISTS "Members can update conversations" ON chat_conversations;

DROP POLICY IF EXISTS "Members can view conversation members" ON chat_conversation_members;
DROP POLICY IF EXISTS "Insert members into conversations" ON chat_conversation_members;

DROP POLICY IF EXISTS "Members can view messages" ON chat_messages;
DROP POLICY IF EXISTS "Members can send messages" ON chat_messages;

-- Simpler approach: allow authenticated users full access to chat tables
-- The membership check happens in the application code

-- chat_conversations: allow all authenticated access
CREATE POLICY "Authenticated access to conversations"
ON chat_conversations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- chat_conversation_members: allow all authenticated access
CREATE POLICY "Authenticated access to members"
ON chat_conversation_members FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- chat_messages: allow all authenticated access
CREATE POLICY "Authenticated access to messages"
ON chat_messages FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);