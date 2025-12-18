import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRolePreview, RolePreviewPermissions, PreviewEmployee } from "@/contexts/RolePreviewContext";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Owner position name
const OWNER_POSITION_NAME = "Ejer";

type DataScope = "egen" | "team" | "alt";

// Generate all permissions for owner - visible menu items and tabs
const generateAllPermissions = (): RolePreviewPermissions => ({
  // Main menu
  menu_dashboard: true,
  menu_some: { view: true, edit: true },
  menu_sales: { view: true, edit: true },
  menu_logics: { view: true, edit: true },
  menu_closing_shifts: { view: true, edit: true },
  // Personnel menu
  menu_employees: { view: true, edit: true },
  menu_teams: { view: true, edit: true },
  // Employees tabs
  tab_employees_all: { view: true, edit: true },
  tab_employees_dialer_mapping: { view: true, edit: true },
  tab_employees_teams: { view: true, edit: true },
  tab_employees_positions: { view: true, edit: true },
  // Management menu
  menu_contracts: { view: true, edit: true },
  menu_permissions: { view: true, edit: true },
  menu_career_wishes_overview: { view: true, edit: true },
  // Contracts tabs
  tab_contracts_all: { view: true, edit: true },
  tab_contracts_templates: { view: true, edit: true },
  // Test menu
  menu_car_quiz_admin: { view: true, edit: true },
  menu_coc_admin: { view: true, edit: true },
  menu_pulse_survey: { view: true, edit: true },
  // Car Quiz tabs
  tab_car_quiz_questions: { view: true, edit: true },
  tab_car_quiz_submissions: { view: true, edit: true },
  // CoC tabs
  tab_coc_questions: { view: true, edit: true },
  tab_coc_submissions: { view: true, edit: true },
  // Pulse Survey tabs
  tab_pulse_results: { view: true, edit: true },
  tab_pulse_template: { view: true, edit: true },
  tab_pulse_teams: { view: true, edit: true },
  // MG menu
  menu_payroll: { view: true, edit: true },
  menu_tdc_erhverv: { view: true, edit: true },
  menu_codan: { view: true, edit: true },
  menu_mg_test: { view: true, edit: true },
  menu_test_dashboard: { view: true, edit: true },
  menu_dialer_data: { view: true, edit: true },
  menu_calls_data: { view: true, edit: true },
  menu_adversus_data: { view: true, edit: true },
  // MG Test tabs
  tab_mg_products: { view: true, edit: true },
  tab_mg_campaigns: { view: true, edit: true },
  tab_mg_customers: { view: true, edit: true },
  // Shift planning menu
  menu_shift_overview: { view: true, edit: true },
  menu_my_schedule: true,
  menu_absence: { view: true, edit: true },
  menu_time_tracking: { view: true, edit: true },
  menu_extra_work: { view: true, edit: true },
  menu_extra_work_admin: { view: true, edit: true },
  // Fieldmarketing menu
  menu_fm_overview: { view: true, edit: true },
  menu_fm_my_week: true,
  menu_fm_book_week: { view: true, edit: true },
  menu_fm_bookings: { view: true, edit: true },
  menu_fm_locations: { view: true, edit: true },
  menu_fm_vehicles: { view: true, edit: true },
  menu_fm_billing: { view: true, edit: true },
  menu_fm_time_off: { view: true, edit: true },
  // Recruitment menu
  menu_recruitment_dashboard: { view: true, edit: true },
  menu_candidates: { view: true, edit: true },
  menu_upcoming_interviews: { view: true, edit: true },
  menu_winback: { view: true, edit: true },
  menu_upcoming_hires: { view: true, edit: true },
  menu_messages: { view: true, edit: true },
  menu_sms_templates: { view: true, edit: true },
  menu_email_templates: { view: true, edit: true },
  // Boards menu
  menu_boards_test: true,
  menu_boards_economic: true,
  menu_boards_sales: true,
  // Personal menu
  menu_my_profile: { view: true, edit: true },
  menu_my_contracts: true,
  menu_career_wishes: true,
  menu_time_stamp: true,
  // System menu
  menu_settings: { view: true, edit: true },
  // Settings tabs
  tab_settings_api: { view: true, edit: true },
  tab_settings_dialer: { view: true, edit: true },
  tab_settings_customer: { view: true, edit: true },
  tab_settings_webhooks: { view: true, edit: true },
  tab_settings_logs: { view: true, edit: true },
  tab_settings_excel_crm: { view: true, edit: true },
  // Data scope permissions - owner sees all
  scope_employees: "alt" as DataScope,
  scope_shifts: "alt" as DataScope,
  scope_absence: "alt" as DataScope,
  scope_time_tracking: "alt" as DataScope,
  scope_contracts: "alt" as DataScope,
  scope_payroll: "alt" as DataScope,
  scope_career_wishes: "alt" as DataScope,
  scope_sales: "alt" as DataScope,
  scope_quiz: "alt" as DataScope,
  scope_extra_work: "alt" as DataScope,
  scope_fieldmarketing: "alt" as DataScope,
});

export default function RolePreview() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { enterPreviewMode } = useRolePreview();
  
  const employeeId = searchParams.get("employee");

  const { data: position, isLoading: positionLoading, error: positionError } = useQuery({
    queryKey: ["job-position", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("job_positions")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ["preview-employee", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId,
  });

  useEffect(() => {
    // Wait for all data to be loaded
    if (positionLoading || (employeeId && employeeLoading)) return;
    
    if (position) {
      const isOwner = position.name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();
      const permissions: RolePreviewPermissions = isOwner 
        ? generateAllPermissions() 
        : (position.permissions as RolePreviewPermissions) || {};
      
      // Build preview employee object if employee was selected
      const previewEmployee: PreviewEmployee | undefined = employee ? {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        email: employee.private_email,
      } : undefined;
      
      // Enter preview mode with the role's permissions and optionally the employee
      enterPreviewMode(position.name, permissions, previewEmployee);
      
      // Navigate to my-schedule (typical employee landing page)
      navigate("/my-schedule", { replace: true });
    }
  }, [position, employee, positionLoading, employeeLoading, employeeId, enterPreviewMode, navigate]);

  const isLoading = positionLoading || (employeeId && employeeLoading);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Indlæser rolle preview...</p>
        </div>
      </div>
    );
  }

  if (positionError || !position) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Stilling ikke fundet</p>
          <button 
            onClick={() => navigate("/employees")}
            className="mt-4 text-primary hover:underline"
          >
            Tilbage til medarbejdere
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">
          Starter preview som {position.name}
          {employee && ` (${employee.first_name} ${employee.last_name})`}...
        </p>
      </div>
    </div>
  );
}
