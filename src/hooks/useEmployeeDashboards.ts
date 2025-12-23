import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Json } from "@/integrations/supabase/types";

export interface DashboardWidget {
  id: string;
  widgetTypeId: string;
  dataSource: "kpi" | "custom";
  kpiTypeIds: string[];
  customValue?: string;
  customLabel?: string;
  timePeriodId: string;
  customFromDate?: string;
  title?: string;
  targetValue?: number;
  showComparison?: boolean;
  comparisonPeriodId?: string;
  colorThemeId?: string;
  showTrend?: boolean;
  trackingScopeId?: string;
  limitToTeam?: boolean;
  teamId?: string;
  limitToClient?: boolean;
  clientId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EmployeeDashboard {
  id: string;
  employee_id: string;
  name: string;
  design_id: string;
  widgets: DashboardWidget[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useEmployeeDashboards() {
  const { toast } = useToast();
  const [dashboards, setDashboards] = useState<EmployeeDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | null>(null);

  // Get current employee ID
  useEffect(() => {
    const fetchEmployeeId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user found');
        setLoading(false);
        return;
      }

      // First try by auth_user_id
      let { data: employee } = await supabase
        .from('employee_master_data')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      // Fallback: try by email
      if (!employee) {
        const { data: employeeByEmail } = await supabase
          .from('employee_master_data')
          .select('id')
          .eq('private_email', user.email)
          .single();
        employee = employeeByEmail;
      }

      if (employee) {
        setCurrentEmployeeId(employee.id);
      } else {
        console.log('No employee record found for user:', user.id, user.email);
        setLoading(false);
      }
    };
    fetchEmployeeId();
  }, []);

  // Fetch dashboards
  useEffect(() => {
    const fetchDashboards = async () => {
      if (!currentEmployeeId) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('employee_dashboards')
        .select('*')
        .eq('employee_id', currentEmployeeId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching dashboards:', error);
      } else {
        // Parse widgets JSON and cast to correct types
        const parsedDashboards = (data || []).map(d => ({
          ...d,
          widgets: (d.widgets as unknown as DashboardWidget[]) || [],
          design_id: d.design_id || 'minimal',
          is_default: d.is_default || false
        }));
        setDashboards(parsedDashboards);
      }
      setLoading(false);
    };

    fetchDashboards();
  }, [currentEmployeeId]);

  // Save dashboard
  const saveDashboard = async (
    name: string,
    designId: string,
    widgets: DashboardWidget[],
    dashboardId?: string
  ): Promise<string | null> => {
    if (!currentEmployeeId) {
      toast({ title: "Fejl", description: "Du skal være logget ind", variant: "destructive" });
      return null;
    }

    setSaving(true);
    
    // Serialize widgets for storage
    const serializedWidgets = widgets.map(w => ({
      ...w,
      customFromDate: w.customFromDate ? w.customFromDate.toString() : undefined
    }));

    try {
      if (dashboardId) {
        // Update existing
        const { error } = await supabase
          .from('employee_dashboards')
          .update({
            name,
            design_id: designId,
            widgets: serializedWidgets as unknown as Json
          })
          .eq('id', dashboardId);

        if (error) throw error;
        
        toast({ title: "Dashboard opdateret" });
        return dashboardId;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('employee_dashboards')
          .insert({
            employee_id: currentEmployeeId,
            name,
            design_id: designId,
            widgets: serializedWidgets as unknown as Json
          })
          .select('id')
          .single();

        if (error) throw error;
        
        toast({ title: "Dashboard gemt" });
        return data?.id || null;
      }
    } catch (error: any) {
      console.error('Error saving dashboard:', error);
      toast({ 
        title: "Fejl ved gemning", 
        description: error.message,
        variant: "destructive" 
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Delete dashboard
  const deleteDashboard = async (dashboardId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('employee_dashboards')
        .delete()
        .eq('id', dashboardId);

      if (error) throw error;

      setDashboards(prev => prev.filter(d => d.id !== dashboardId));
      toast({ title: "Dashboard slettet" });
      return true;
    } catch (error: any) {
      console.error('Error deleting dashboard:', error);
      toast({ 
        title: "Fejl ved sletning", 
        description: error.message,
        variant: "destructive" 
      });
      return false;
    }
  };

  // Load dashboard
  const loadDashboard = async (dashboardId: string): Promise<EmployeeDashboard | null> => {
    const { data, error } = await supabase
      .from('employee_dashboards')
      .select('*')
      .eq('id', dashboardId)
      .single();

    if (error) {
      console.error('Error loading dashboard:', error);
      return null;
    }

    return {
      ...data,
      widgets: (data.widgets as unknown as DashboardWidget[]) || [],
      design_id: data.design_id || 'minimal',
      is_default: data.is_default || false
    };
  };

  return {
    dashboards,
    loading,
    saving,
    currentEmployeeId,
    saveDashboard,
    deleteDashboard,
    loadDashboard,
    refetch: () => {
      if (currentEmployeeId) {
        setLoading(true);
        supabase
          .from('employee_dashboards')
          .select('*')
          .eq('employee_id', currentEmployeeId)
          .order('created_at', { ascending: false })
          .then(({ data }) => {
            const parsedDashboards = (data || []).map(d => ({
              ...d,
              widgets: (d.widgets as unknown as DashboardWidget[]) || [],
              design_id: d.design_id || 'minimal',
              is_default: d.is_default || false
            }));
            setDashboards(parsedDashboards);
            setLoading(false);
          });
      }
    }
  };
}
