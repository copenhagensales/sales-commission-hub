-- Add read receipts tracking
CREATE TABLE IF NOT EXISTS public.chat_message_read_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(message_id, employee_id)
);

-- Enable RLS
ALTER TABLE public.chat_message_read_receipts ENABLE ROW LEVEL SECURITY;

-- RLS policies for read receipts
CREATE POLICY "Users can view read receipts for conversations they're in"
  ON public.chat_message_read_receipts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_messages cm
      WHERE cm.id = message_id
      AND public.is_conversation_member(cm.conversation_id, public.get_current_employee_id())
    )
  );

CREATE POLICY "Users can insert their own read receipts"
  ON public.chat_message_read_receipts
  FOR INSERT
  WITH CHECK (employee_id = public.get_current_employee_id());

-- Add index for performance
CREATE INDEX idx_read_receipts_message ON public.chat_message_read_receipts(message_id);
CREATE INDEX idx_read_receipts_employee ON public.chat_message_read_receipts(employee_id);

-- Enable realtime for read receipts
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_message_read_receipts;