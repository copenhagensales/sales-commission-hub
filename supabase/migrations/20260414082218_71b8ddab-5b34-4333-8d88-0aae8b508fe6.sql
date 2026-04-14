
-- Create sidebar_menu_config table
CREATE TABLE public.sidebar_menu_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_key text NOT NULL UNIQUE,
  parent_key text REFERENCES public.sidebar_menu_config(item_key) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  label_override text,
  icon_name text,
  href text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_sidebar_menu_config_parent ON public.sidebar_menu_config(parent_key);
CREATE INDEX idx_sidebar_menu_config_sort ON public.sidebar_menu_config(sort_order);

-- Enable RLS
ALTER TABLE public.sidebar_menu_config ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed to render sidebar)
CREATE POLICY "Authenticated users can read menu config"
ON public.sidebar_menu_config FOR SELECT
TO authenticated
USING (true);

-- Only owners can modify
CREATE POLICY "Owners can insert menu config"
ON public.sidebar_menu_config FOR INSERT
TO authenticated
WITH CHECK (public.is_owner(auth.uid()));

CREATE POLICY "Owners can update menu config"
ON public.sidebar_menu_config FOR UPDATE
TO authenticated
USING (public.is_owner(auth.uid()));

CREATE POLICY "Owners can delete menu config"
ON public.sidebar_menu_config FOR DELETE
TO authenticated
USING (public.is_owner(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_sidebar_menu_config_updated_at
BEFORE UPDATE ON public.sidebar_menu_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: Top-level sections first (parent_key = NULL)
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('section_mit_hjem', NULL, 10, true, 'Home', NULL),
('section_spil', NULL, 20, true, 'Trophy', NULL),
('section_some', NULL, 30, true, 'Video', NULL),
('section_personale', NULL, 40, true, 'Users', NULL),
('section_ledelse', NULL, 50, true, 'Crown', NULL),
('item_car_quiz', NULL, 55, true, 'Car', '/car-quiz'),
('item_system_feedback', NULL, 56, true, 'Bug', '/system-feedback'),
('section_vagtplan', NULL, 60, true, 'ClipboardList', NULL),
('section_fieldmarketing', NULL, 70, true, 'Calendar', NULL),
('section_mg', NULL, 75, true, 'Percent', NULL),
('item_code_of_conduct', NULL, 76, true, 'Shield', '/code-of-conduct'),
('section_rekruttering', NULL, 80, true, 'UserPlus', NULL),
('section_onboarding', NULL, 85, true, 'GraduationCap', NULL),
('item_sales', NULL, 90, true, 'ShoppingCart', '/sales'),
('section_rapporter', NULL, 95, true, 'FileBarChart', NULL),
('section_lon', NULL, 100, true, 'Wallet', NULL),
('section_economic', NULL, 110, true, 'Receipt', NULL),
('item_logikker', NULL, 115, true, 'ListChecks', '/logikker'),
('item_live_stats', NULL, 116, true, 'Activity', '/live-stats'),
('section_admin', NULL, 120, true, 'Wrench', NULL),
('section_amo', NULL, 130, true, 'Shield', NULL),
('item_settings', NULL, 140, true, 'Settings', '/settings');

-- Seed: Mit Hjem children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_home', 'section_mit_hjem', 10, true, 'Home', '/home'),
('item_messages', 'section_mit_hjem', 20, true, 'MessageSquare', '/messages'),
('item_my_profile', 'section_mit_hjem', 30, true, 'User', '/my-profile'),
('item_my_feedback', 'section_mit_hjem', 40, true, 'MessageSquare', '/my-feedback'),
('item_pulse_survey', 'section_mit_hjem', 50, true, 'ClipboardCheck', '/pulse-survey'),
('item_my_goals', 'section_mit_hjem', 60, true, 'Target', '/my-goals'),
('item_team_goals', 'section_mit_hjem', 70, true, 'Users', '/team-goals'),
('item_refer_a_friend', 'section_mit_hjem', 80, true, 'Gift', '/refer-a-friend'),
('item_immediate_payment', 'section_mit_hjem', 90, true, 'CreditCard', '/immediate-payment-ase'),
('item_tdc_opsummering', 'section_mit_hjem', 100, true, 'FileText', '/tdc-opsummering');

-- Seed: Spil children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_h2h', 'section_spil', 10, true, 'Swords', '/head-to-head'),
('item_commission_league', 'section_spil', 20, true, 'Trophy', '/commission-league');

-- Seed: SOME children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_some', 'section_some', 10, true, 'Video', '/some'),
('item_extra_work', 'section_some', 20, true, 'HeartHandshake', '/extra-work');

-- Seed: Personale children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_employees', 'section_personale', 10, true, 'Users', '/employees'),
('item_login_log', 'section_personale', 20, true, 'Clock', '/login-log'),
('item_upcoming_starts', 'section_personale', 30, true, 'UserPlus', '/upcoming-starts');

-- Seed: Ledelse children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_contracts', 'section_ledelse', 10, true, 'FileText', '/contracts'),
('item_permissions', 'section_ledelse', 20, true, 'Lock', '/permissions'),
('item_career_wishes', 'section_ledelse', 30, true, 'Sparkles', '/career-wishes-overview'),
('item_company_overview', 'section_ledelse', 40, true, 'Building2', '/company-overview'),
('item_onboarding_analyse', 'section_ledelse', 50, true, 'BarChart3', '/onboarding-analyse'),
('item_email_templates_ledelse', 'section_ledelse', 60, true, 'Mail', '/email-templates'),
('item_security_dashboard', 'section_ledelse', 70, true, 'Shield', '/admin/security'),
('item_system_stability', 'section_ledelse', 80, true, 'Monitor', '/system-stability'),
('item_car_quiz_admin', 'section_ledelse', 90, true, 'Car', '/car-quiz-admin'),
('item_coc_admin', 'section_ledelse', 100, true, 'ShieldCheck', '/code-of-conduct-admin'),
('item_pulse_survey_results', 'section_ledelse', 110, true, 'ClipboardCheck', '/pulse-survey-results'),
('item_customer_inquiries', 'section_ledelse', 120, true, 'Inbox', '/customer-inquiries'),
('item_client_forecast', 'section_ledelse', 130, true, 'BarChart3', '/client-forecast');

-- Seed: Vagtplan children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_shift_overview', 'section_vagtplan', 10, true, 'Calendar', '/shift-planning'),
('item_absence', 'section_vagtplan', 20, true, 'Clock', '/shift-planning/absence'),
('item_time_tracking', 'section_vagtplan', 30, true, 'Timer', '/shift-planning/time-tracking'),
('item_time_stamp', 'section_vagtplan', 40, true, 'Clock', '/time-stamp'),
('item_closing_shifts', 'section_vagtplan', 50, true, 'Lock', '/closing-shifts');

-- Seed: Fieldmarketing children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_fm_my_schedule', 'section_fieldmarketing', 10, true, 'UserCheck', '/vagt-flow/my-schedule'),
('item_fm_overview', 'section_fieldmarketing', 20, true, 'LayoutDashboard', '/vagt-flow'),
('item_fm_booking', 'section_fieldmarketing', 30, true, 'CalendarDays', '/vagt-flow/booking'),
('item_fm_vehicles', 'section_fieldmarketing', 40, true, 'Car', '/vagt-flow/vehicles'),
('item_fm_sales_registration', 'section_fieldmarketing', 50, true, 'ShoppingCart', '/vagt-flow/sales-registration'),
('item_fm_billing', 'section_fieldmarketing', 60, true, 'Receipt', '/vagt-flow/billing'),
('item_fm_travel_expenses', 'section_fieldmarketing', 70, true, 'CreditCard', '/vagt-flow/travel-expenses'),
('item_fm_edit_sales', 'section_fieldmarketing', 80, true, 'Pencil', '/vagt-flow/edit-sales');

-- Seed: MG children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_mg_test', 'section_mg', 10, true, 'Percent', '/mg-test');

-- Seed: Rekruttering children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_recruitment_dashboard', 'section_rekruttering', 10, true, 'LayoutDashboard', '/recruitment'),
('item_candidates', 'section_rekruttering', 20, true, 'Users', '/recruitment/candidates'),
('item_messages_recruitment', 'section_rekruttering', 30, true, 'Phone', '/recruitment/messages'),
('item_sms_templates', 'section_rekruttering', 40, true, 'FileText', '/recruitment/sms-templates'),
('item_email_templates_recruitment', 'section_rekruttering', 50, true, 'FileText', '/recruitment/email-templates'),
('item_referrals', 'section_rekruttering', 60, true, 'Gift', '/recruitment/referrals'),
('item_winback', 'section_rekruttering', 70, true, 'RefreshCcw', '/recruitment/winback'),
('item_upcoming_interviews', 'section_rekruttering', 80, true, 'CalendarClock', '/recruitment/upcoming-interviews'),
('item_upcoming_hires', 'section_rekruttering', 90, true, 'UserCog', '/recruitment/upcoming-hires'),
('item_booking_flow', 'section_rekruttering', 100, true, 'CalendarDays', '/recruitment/booking-flow');

-- Seed: Onboarding children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_onboarding_program', 'section_onboarding', 10, true, 'GraduationCap', '/onboarding-program'),
('item_coaching_templates', 'section_onboarding', 20, true, 'BookOpen', '/coaching-templates');

-- Seed: Rapporter children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_reports_admin', 'section_rapporter', 10, true, 'Crown', '/reports/admin'),
('item_reports_daily', 'section_rapporter', 20, true, 'Calendar', '/reports/daily'),
('item_reports_management', 'section_rapporter', 30, true, 'BarChart3', '/reports/management'),
('item_reports_employee', 'section_rapporter', 40, true, 'User', '/reports/employee'),
('item_cancellations', 'section_rapporter', 50, true, 'XCircle', '/salary/cancellations');

-- Seed: Løn children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_salary_types', 'section_lon', 10, true, 'Receipt', '/salary/types');

-- Seed: Økonomi children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_economic_dashboard', 'section_economic', 10, true, 'LayoutDashboard', '/economic'),
('item_economic_posteringer', 'section_economic', 20, true, 'List', '/economic/posteringer'),
('item_economic_expenses', 'section_economic', 30, true, 'Receipt', '/economic/expenses'),
('item_economic_budget', 'section_economic', 40, true, 'Target', '/economic/budget'),
('item_economic_mapping', 'section_economic', 50, true, 'Database', '/economic/mapping'),
('item_economic_revenue_match', 'section_economic', 60, true, 'Receipt', '/economic/revenue-match'),
('item_economic_sales_validation', 'section_economic', 70, true, 'ShieldCheck', '/economic/sales-validation'),
('item_economic_upload', 'section_economic', 80, true, 'Database', '/admin/economic-upload');

-- Seed: Admin children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_kpi_definitions', 'section_admin', 10, true, 'BookOpen', '/admin/kpi-definitions');

-- Seed: AMO children
INSERT INTO public.sidebar_menu_config (item_key, parent_key, sort_order, visible, icon_name, href) VALUES
('item_amo_dashboard', 'section_amo', 10, true, 'LayoutDashboard', '/amo'),
('item_amo_organisation', 'section_amo', 20, true, 'Users', '/amo/organisation'),
('item_amo_annual_discussion', 'section_amo', 30, true, 'Calendar', '/amo/annual-discussion'),
('item_amo_meetings', 'section_amo', 40, true, 'ClipboardList', '/amo/meetings'),
('item_amo_apv', 'section_amo', 50, true, 'FileText', '/amo/apv'),
('item_amo_kemi_apv', 'section_amo', 60, true, 'FlaskConical', '/amo/kemi-apv'),
('item_amo_training', 'section_amo', 70, true, 'GraduationCap', '/amo/training'),
('item_amo_documents', 'section_amo', 80, true, 'Database', '/amo/documents'),
('item_amo_tasks', 'section_amo', 90, true, 'ListChecks', '/amo/tasks'),
('item_amo_settings', 'section_amo', 100, true, 'Settings', '/amo/settings'),
('item_amo_audit_log', 'section_amo', 110, true, 'Clock', '/amo/audit-log');
