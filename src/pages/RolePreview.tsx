import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

// Owner position name
const OWNER_POSITION_NAME = "Ejer";

interface PositionPermissions {
  [key: string]: boolean | { view: boolean; edit: boolean };
}

// Generate all permissions for owner
const generateAllPermissions = (): PositionPermissions => ({
  menu_dashboard: true,
  menu_wallboard: true,
  menu_some: { view: true, edit: true },
  menu_sales: { view: true, edit: true },
  menu_logics: { view: true, edit: true },
  menu_closing_shifts: { view: true, edit: true },
  menu_employees: { view: true, edit: true },
  menu_teams: { view: true, edit: true },
  menu_contracts: { view: true, edit: true },
  menu_permissions: { view: true, edit: true },
  menu_career_wishes_overview: { view: true, edit: true },
  menu_car_quiz_admin: { view: true, edit: true },
  menu_code_of_conduct_admin: { view: true, edit: true },
  menu_pulse_survey_results: { view: true, edit: true },
  menu_payroll: { view: true, edit: true },
  menu_tdc_erhverv: { view: true, edit: true },
  menu_codan: { view: true, edit: true },
  menu_mg_test: { view: true, edit: true },
  menu_mg_test_dashboard: { view: true, edit: true },
  menu_dialer_data: { view: true, edit: true },
  menu_calls_data: { view: true, edit: true },
  menu_adversus_data: { view: true, edit: true },
  menu_shift_planning: { view: true, edit: true },
  menu_recruitment: { view: true, edit: true },
  menu_vagt_flow: { view: true, edit: true },
  menu_boards: { view: true, edit: true },
  menu_settings: { view: true, edit: true },
  menu_my_schedule: true,
  menu_my_profile: true,
  menu_my_contracts: true,
  menu_career_wishes: true,
  tab_employees_all: { view: true, edit: true },
  tab_employees_dialer_mapping: { view: true, edit: true },
  tab_employees_teams: { view: true, edit: true },
  tab_employees_positions: { view: true, edit: true },
  view_own_revenue: true,
  view_team_revenue: true,
  view_all_revenue: true,
  view_own_commission: true,
  view_team_commission: true,
  view_all_commission: true,
  view_salary_data: true,
  view_sensitive_data: true,
  create_employees: true,
  edit_employees: true,
  delete_employees: true,
  manage_teams: true,
  assign_team_members: true,
  manage_positions: true,
  assign_roles: true,
  view_contracts: true,
  create_contracts: true,
  send_contracts: true,
  edit_contract_templates: true,
  delete_contracts: true,
  view_all_shifts: true,
  create_shifts: true,
  edit_shifts: true,
  approve_absence: true,
  mark_sick: true,
  edit_time_stamps: true,
  view_sales: true,
  edit_sales: true,
  delete_sales: true,
  manage_products: true,
  manage_campaigns: true,
  run_payroll: true,
  view_integrations: true,
  manage_integrations: true,
  view_logs: true,
  trigger_sync: true,
  manage_system_settings: true,
  view_audit_logs: true,
  manage_webhooks: true,
  full_admin_access: true,
});

export default function RolePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { enterPreviewMode } = useRolePreview();

  const { data: position, isLoading, error } = useQuery({
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

  useEffect(() => {
    if (position) {
      const isOwner = position.name.toLowerCase() === OWNER_POSITION_NAME.toLowerCase();
      const permissions: PositionPermissions = isOwner 
        ? generateAllPermissions() 
        : (position.permissions as PositionPermissions) || {};
      
      // Enter preview mode with the role's permissions
      enterPreviewMode(position.name, permissions);
      
      // Navigate to my-schedule (typical employee landing page)
      navigate("/my-schedule", { replace: true });
    }
  }, [position, enterPreviewMode, navigate]);

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

  if (error || !position) {
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
        <p className="text-muted-foreground">Starter preview som {position.name}...</p>
      </div>
    </div>
  );
}
