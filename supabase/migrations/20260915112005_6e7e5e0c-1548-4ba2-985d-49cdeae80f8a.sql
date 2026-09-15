INSERT INTO public.client_adjustment_percents (client_id, cancellation_percent)
VALUES ('c17c758f-8739-4588-b62d-85b9a5f9b5d2', 25)
ON CONFLICT (client_id) DO UPDATE SET cancellation_percent = 25, updated_at = now();