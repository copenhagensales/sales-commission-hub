-- Add sick_pay_percent column to client_adjustment_percents
ALTER TABLE public.client_adjustment_percents 
ADD COLUMN IF NOT EXISTS sick_pay_percent numeric DEFAULT 0;