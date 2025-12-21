-- Drop ALL old recursive policies
DROP POLICY IF EXISTS "Conversation creators can add members" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can update their own membership" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can view members of their conversations" ON chat_conversation_members;
DROP POLICY IF EXISTS "Users can view conversations they are members of" ON chat_conversations;