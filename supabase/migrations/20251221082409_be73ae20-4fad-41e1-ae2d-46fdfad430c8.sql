-- Add columns to chat_messages for attachments, replies, and editing
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create chat_message_reactions table
CREATE TABLE IF NOT EXISTS public.chat_message_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, employee_id, emoji)
);

-- Enable RLS on reactions
ALTER TABLE public.chat_message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for reactions - members of conversation can view/add/remove reactions
CREATE POLICY "Members can view reactions" ON public.chat_message_reactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages m
    JOIN public.chat_conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = message_id
    AND cm.employee_id = (SELECT id FROM public.employee_master_data WHERE auth_user_id = auth.uid())
  )
);

CREATE POLICY "Members can add reactions" ON public.chat_message_reactions
FOR INSERT WITH CHECK (
  employee_id = (SELECT id FROM public.employee_master_data WHERE auth_user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.chat_messages m
    JOIN public.chat_conversation_members cm ON cm.conversation_id = m.conversation_id
    WHERE m.id = message_id
    AND cm.employee_id = employee_id
  )
);

CREATE POLICY "Users can remove own reactions" ON public.chat_message_reactions
FOR DELETE USING (
  employee_id = (SELECT id FROM public.employee_master_data WHERE auth_user_id = auth.uid())
);

-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat attachments
CREATE POLICY "Authenticated users can upload chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_reactions;

-- Add index for faster message search
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_search ON public.chat_messages USING gin(to_tsvector('danish', content));

-- Add index for reply lookups
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON public.chat_messages(reply_to_id) WHERE reply_to_id IS NOT NULL;