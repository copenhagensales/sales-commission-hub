-- Fix: Change view to use SECURITY INVOKER (the safe default) instead of SECURITY DEFINER
ALTER VIEW public.employee_basic_info SET (security_invoker = true);