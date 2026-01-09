-- Allow anyone to update access count and last_accessed_at on tv_board_access
CREATE POLICY "Anyone can update access stats"
ON public.tv_board_access
FOR UPDATE
TO public
USING (is_active = true)
WITH CHECK (is_active = true);