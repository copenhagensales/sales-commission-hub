-- Allow anonymous read access to booking_page_content
CREATE POLICY "Allow anonymous read access to booking_page_content"
ON public.booking_page_content
FOR SELECT
TO anon
USING (true);

-- Allow anonymous read access to booking_page_config
CREATE POLICY "Allow anonymous read access to booking_page_config"
ON public.booking_page_config
FOR SELECT
TO anon
USING (true);

-- Also allow anonymous read on booking_settings for public availability
CREATE POLICY "Allow anonymous read access to booking_settings"
ON public.booking_settings
FOR SELECT
TO anon
USING (true);