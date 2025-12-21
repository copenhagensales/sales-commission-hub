-- Create chat_conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.employee_master_data(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_conversation_members table
CREATE TABLE public.chat_conversation_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, employee_id)
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.employee_master_data(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS for chat_conversations
CREATE POLICY "Users can view conversations they are members of"
ON public.chat_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversation_members
    WHERE conversation_id = id AND employee_id = get_current_employee_id()
  )
);

CREATE POLICY "Users can create conversations"
ON public.chat_conversations FOR INSERT
WITH CHECK (created_by = get_current_employee_id());

-- RLS for chat_conversation_members
CREATE POLICY "Users can view members of their conversations"
ON public.chat_conversation_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversation_members cm
    WHERE cm.conversation_id = chat_conversation_members.conversation_id 
    AND cm.employee_id = get_current_employee_id()
  )
);

CREATE POLICY "Conversation creators can add members"
ON public.chat_conversation_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chat_conversations c
    WHERE c.id = conversation_id AND c.created_by = get_current_employee_id()
  )
  OR employee_id = get_current_employee_id()
);

CREATE POLICY "Users can update their own membership"
ON public.chat_conversation_members FOR UPDATE
USING (employee_id = get_current_employee_id());

-- RLS for chat_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversation_members
    WHERE conversation_id = chat_messages.conversation_id 
    AND employee_id = get_current_employee_id()
  )
);

CREATE POLICY "Users can send messages to their conversations"
ON public.chat_messages FOR INSERT
WITH CHECK (
  sender_id = get_current_employee_id()
  AND EXISTS (
    SELECT 1 FROM public.chat_conversation_members
    WHERE conversation_id = chat_messages.conversation_id 
    AND employee_id = get_current_employee_id()
  )
);

-- Indexes for performance
CREATE INDEX idx_chat_conversation_members_employee ON public.chat_conversation_members(employee_id);
CREATE INDEX idx_chat_conversation_members_conversation ON public.chat_conversation_members(conversation_id);
CREATE INDEX idx_chat_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at DESC);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversation_members;

-- Trigger for updated_at on conversations
CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();