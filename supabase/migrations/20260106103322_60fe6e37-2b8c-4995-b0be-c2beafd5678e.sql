-- Fix sale_items: Drop the misconfigured policy with qual:true
DROP POLICY IF EXISTS "Managers can manage sale_items" ON public.sale_items;

-- Fix candidates: Drop the policy that allows ALL authenticated users to view
DROP POLICY IF EXISTS "Authenticated users can view candidates" ON public.candidates;

-- Create proper SELECT policy for candidates - only rekruttering and leaders
CREATE POLICY "Rekruttering and leaders can view candidates"
ON public.candidates
FOR SELECT
TO authenticated
USING (is_rekruttering(auth.uid()) OR is_teamleder_or_above(auth.uid()));

-- Fix chat_messages: Drop the _all_authenticated policy
DROP POLICY IF EXISTS "chat_messages_all_authenticated" ON public.chat_messages;

-- Fix chat_conversations: Drop the _all_authenticated policy  
DROP POLICY IF EXISTS "chat_conversations_all_authenticated" ON public.chat_conversations;

-- Fix chat_conversation_members: Drop the _all_authenticated policy
DROP POLICY IF EXISTS "chat_conversation_members_all_authenticated" ON public.chat_conversation_members;