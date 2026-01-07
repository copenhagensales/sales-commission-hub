import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Search, Users, Phone, MessageSquare, Loader2, ArrowRight, Check, FileText, Trash2, Eye, EyeOff, Mail, UserCheck, UserPlus, Send, ArrowRightLeft, Clock, X, UserX, Camera, User, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { EmployeeExcelImport } from "@/components/employees/EmployeeExcelImport";
import { DialerMappingTab } from "@/components/employees/DialerMappingTab";
import { TeamsTab } from "@/components/employees/TeamsTab";
import { PositionsTab } from "@/components/employees/PositionsTab";
import { StaffEmployeesTab } from "@/components/employees/StaffEmployeesTab";
import { SendEmployeeSmsDialog } from "@/components/employees/SendEmployeeSmsDialog";
import { useTwilioDevice } from "@/hooks/useTwilioDevice";


interface EmployeeMasterDataRecord {
  id: string;
  first_name: string;
  last_name: string;
  cpr_number: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_country: string | null;
  private_phone: string | null;
  private_email: string | null;
  work_email: string | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
  job_title: string | null;
  department: string | null;
  work_location: string | null;
  manager_id: string | null;
  team_id: string | null;
  contract_id: string | null;
  contract_version: string | null;
  salary_type: "provision" | "fixed" | "hourly" | null;
  salary_amount: number | null;
  bank_reg_number: string | null;
  bank_account_number: string | null;
  system_role_id: string | null;
  vacation_type: "vacation_pay" | "vacation_bonus" | null;
  vacation_bonus_percent: number | null;
  has_parking: boolean;
  parking_spot_id: string | null;
  parking_monthly_cost: number | null;
  working_hours_model: string | null;
  weekly_hours: number | null;
  standard_start_time: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  invitation_status: "none" | "pending" | "completed" | null;
  auth_user_id: string | null;
  avatar_url: string | null;
}

type NewEmployee = Omit<EmployeeMasterDataRecord, "id" | "created_at" | "updated_at">;

const defaultEmployee: NewEmployee = {
  first_name: "",
  last_name: "",
  cpr_number: null,
  address_street: null,
  address_postal_code: null,
  address_city: null,
  address_country: "Danmark",
  private_phone: null,
  private_email: null,
  work_email: null,
  employment_start_date: null,
  employment_end_date: null,
  job_title: null,
  department: null,
  work_location: "København V",
  manager_id: null,
  team_id: null,
  contract_id: null,
  contract_version: null,
  salary_type: "provision",
  salary_amount: null,
  bank_reg_number: null,
  bank_account_number: null,
  system_role_id: null,
  vacation_type: "vacation_pay",
  vacation_bonus_percent: 1,
  has_parking: false,
  parking_spot_id: null,
  parking_monthly_cost: null,
  working_hours_model: null,
  weekly_hours: null,
  standard_start_time: null,
  is_active: true,
  invitation_status: "none",
  auth_user_id: null,
  avatar_url: null,
};

export default function EmployeeMasterData() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | "all">("active");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<"name" | "position" | "team">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<EmployeeMasterDataRecord | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeMasterDataRecord | null>(null);
  const [formData, setFormData] = useState<NewEmployee>(defaultEmployee);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deleteEmployeeId, setDeleteEmployeeId] = useState<string | null>(null);
  const [moveToStaffId, setMoveToStaffId] = useState<string | null>(null);
  const [sendingResetTo, setSendingResetTo] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsEmployee, setSmsEmployee] = useState<EmployeeMasterDataRecord | null>(null);
  const { canEditEmployees, hasPermission, canSendEmployeeSms } = usePermissions();
  const { makeCall, isDeviceReady } = useTwilioDevice();
  const hasOutboundSoftphone = hasPermission("softphone_outbound");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingEmployee) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${editingEmployee.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('employee-avatars')
        .getPublicUrl(filePath);

      setFormData({ ...formData, avatar_url: publicUrl });
      
      // Auto-save immediately
      await supabase
        .from("employee_master_data")
        .update({ avatar_url: publicUrl })
        .eq("id", editingEmployee.id);
      
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: "Profilbillede uploadet" });
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast({ title: "Fejl ved upload", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const dialogSteps = [
    { title: t("employees.steps.identity"), key: "identity" },
    { title: t("employees.steps.contact"), key: "contact" },
    { title: t("employees.steps.employment"), key: "employment" },
    { title: t("employees.steps.salary"), key: "salary" },
    { title: t("employees.steps.vacation"), key: "vacation" },
    { title: t("employees.steps.other"), key: "other" },
  ];

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employee-master-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .eq("is_staff_employee", false)
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data as EmployeeMasterDataRecord[];
    },
  });

  // Fetch staff employee count
  const { data: staffCount = 0 } = useQuery({
    queryKey: ["staff-employee-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_master_data")
        .select("*", { count: "exact", head: true })
        .eq("is_staff_employee", true)
        .eq("is_active", true);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Fetch job positions from database
  const { data: jobPositions = [] } = useQuery({
    queryKey: ["job-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_positions")
        .select("id, name, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch contracts to check status
  const { data: contracts = [] } = useQuery({
    queryKey: ["employee-contracts-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("employee_id, status");
      if (error) throw error;
      return data;
    },
  });

  // Fetch team memberships
  const { data: teamMemberships = [] } = useQuery({
    queryKey: ["employee-team-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("employee_id, teams:team_id(name)");
      if (error) throw error;
      return data as { employee_id: string; teams: { name: string } | null }[];
    },
  });

  // Get teams for an employee
  const getEmployeeTeams = (employeeId: string): string => {
    const memberships = teamMemberships.filter(tm => tm.employee_id === employeeId);
    if (memberships.length === 0) return "";
    return memberships.map(tm => tm.teams?.name).filter(Boolean).join(", ");
  };

  // Get unique teams for filter dropdown
  const uniqueTeams = React.useMemo(() => {
    const teams = new Set<string>();
    teamMemberships.forEach(tm => {
      if (tm.teams?.name) teams.add(tm.teams.name);
    });
    return Array.from(teams).sort((a, b) => a.localeCompare(b, 'da'));
  }, [teamMemberships]);

  // Keyboard shortcut for search (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle sort
  const handleSort = (column: "name" | "position" | "team") => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get contract status for an employee (prioritized: signed > pending > rejected > none)
  const getContractStatus = (employeeId: string): 'signed' | 'pending' | 'rejected' | 'none' => {
    const employeeContracts = contracts.filter(c => c.employee_id === employeeId);
    if (employeeContracts.some(c => c.status === 'signed')) return 'signed';
    if (employeeContracts.some(c => c.status === 'pending_employee')) return 'pending';
    if (employeeContracts.some(c => c.status === 'rejected')) return 'rejected';
    return 'none';
  };

  const saveMutation = useMutation({
    mutationFn: async (employee: NewEmployee & { id?: string }) => {
      if (employee.id) {
        const { error } = await supabase
          .from("employee_master_data")
          .update(employee)
          .eq("id", employee.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_master_data").insert(employee);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: editingEmployee ? t("employees.toast.updated") : t("employees.toast.created") });
      setDialogOpen(false);
      setEditingEmployee(null);
      setFormData(defaultEmployee);
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (employee: EmployeeMasterDataRecord) => {
    setEditingEmployee(employee);
    setFormData({
      first_name: employee.first_name,
      last_name: employee.last_name,
      cpr_number: employee.cpr_number,
      address_street: employee.address_street,
      address_postal_code: employee.address_postal_code,
      address_city: employee.address_city,
      address_country: employee.address_country,
      private_phone: employee.private_phone,
      private_email: employee.private_email,
      work_email: employee.work_email,
      employment_start_date: employee.employment_start_date,
      employment_end_date: employee.employment_end_date,
      job_title: employee.job_title,
      department: employee.department,
      work_location: employee.work_location,
      manager_id: employee.manager_id,
      team_id: employee.team_id,
      contract_id: employee.contract_id,
      contract_version: employee.contract_version,
      salary_type: employee.salary_type,
      salary_amount: employee.salary_amount,
      bank_reg_number: employee.bank_reg_number,
      bank_account_number: employee.bank_account_number,
      system_role_id: employee.system_role_id,
      vacation_type: employee.vacation_type,
      vacation_bonus_percent: employee.vacation_bonus_percent,
      has_parking: employee.has_parking,
      parking_spot_id: employee.parking_spot_id,
      parking_monthly_cost: employee.parking_monthly_cost,
      working_hours_model: employee.working_hours_model,
      weekly_hours: employee.weekly_hours,
      standard_start_time: employee.standard_start_time,
      is_active: employee.is_active,
      invitation_status: employee.invitation_status,
      auth_user_id: employee.auth_user_id,
      avatar_url: employee.avatar_url,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.first_name || !formData.last_name) {
      toast({ title: t("employees.toast.fillNames"), variant: "destructive" });
      return;
    }
    saveMutation.mutate(editingEmployee ? { ...formData, id: editingEmployee.id } : formData);
  };

  // Auto-save function for step navigation
  const autoSaveEmployee = useCallback(async () => {
    if (!editingEmployee) return; // Only auto-save for existing employees
    
    setAutoSaving(true);
    try {
      const { error } = await supabase
        .from("employee_master_data")
        .update(formData)
        .eq("id", editingEmployee.id);
      
      if (!error) {
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      }
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  }, [editingEmployee, formData, queryClient]);

  // Debounced auto-save when form changes (only for editing existing employee)
  useEffect(() => {
    if (!editingEmployee || !dialogOpen) return;
    
    const timeoutId = setTimeout(() => {
      autoSaveEmployee();
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [formData, editingEmployee, dialogOpen, autoSaveEmployee]);

  const handleStepNext = async () => {
    // Validate first step
    if (currentStep === 0 && (!formData.first_name || !formData.last_name)) {
      toast({ title: t("employees.toast.fillNames"), variant: "destructive" });
      return;
    }

    // Auto-save for existing employee
    if (editingEmployee) {
      await autoSaveEmployee();
    }

    if (currentStep < dialogSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Final step - save and close
      handleSave();
    }
  };

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active, employee }: { id: string; is_active: boolean; employee?: EmployeeMasterDataRecord }) => {
      const today = new Date().toISOString().split("T")[0];
      const updateData = is_active
        ? { is_active, employment_start_date: today, employment_end_date: null }
        : { is_active, employment_end_date: today };
      
      const { error } = await supabase
        .from("employee_master_data")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // If deactivating, send deactivation reminder
      if (!is_active) {
        // Get team membership from team_members (authoritative source)
        const { data: teamMembership } = await supabase
          .from("team_members")
          .select("team_id, teams(id, name, team_leader_id, assistant_team_leader_id)")
          .eq("employee_id", id)
          .maybeSingle();

        const teamId = teamMembership?.team_id;
        const team = teamMembership?.teams as { id: string; name: string; team_leader_id: string | null; assistant_team_leader_id: string | null } | null;

        let manualRecipients: string[] = [];
        const autoRecipientEmails: string[] = [];

        // Only fetch team-specific config and leaders if employee has a team
        if (teamId) {
          // Get config for this team (manually configured recipients)
          const { data: config } = await supabase
            .from("deactivation_reminder_config")
            .select("recipients")
            .eq("team_id", teamId)
            .single();

          manualRecipients = config?.recipients 
            ? config.recipients.split(",").map((r: string) => r.trim()).filter((r: string) => r)
            : [];

          // Get team leader and assistant team leader work emails
          const leaderIds = [team?.team_leader_id, team?.assistant_team_leader_id].filter(Boolean) as string[];
          if (leaderIds.length > 0) {
            const { data: leaders } = await supabase
              .from("employee_master_data")
              .select("work_email")
              .in("id", leaderIds);
            
            (leaders || []).forEach(l => {
              if (l.work_email) autoRecipientEmails.push(l.work_email);
            });
          }
        }

        // Always get recruitment responsible employees (only work_email)
        const { data: recruiters } = await supabase
          .from("employee_master_data")
          .select("work_email")
          .eq("job_title", "Rekruttering")
          .eq("is_active", true);
        
        (recruiters || []).forEach(r => {
          if (r.work_email) autoRecipientEmails.push(r.work_email);
        });

        // Always get owners (only work_email) - exclude Angel
        const { data: owners } = await supabase
          .from("employee_master_data")
          .select("work_email")
          .eq("job_title", "Ejer")
          .eq("is_active", true)
          .neq("first_name", "Angel");
        
        const ownerEmails: string[] = [];
        (owners || []).forEach(o => {
          if (o.work_email) ownerEmails.push(o.work_email);
        });

        // Combine all recipients and remove duplicates
        const allRecipients = [...new Set([...manualRecipients, ...autoRecipientEmails, ...ownerEmails])];

        if (allRecipients.length > 0) {
          await supabase.functions.invoke("send-deactivation-reminder", {
            body: {
              employee_id: id,
              employee_name: `${employee?.first_name} ${employee?.last_name}`,
              employee_email: employee?.work_email || "",
              team_id: teamId || null,
              team_name: team?.name || "Ingen team",
              recipients: allRecipients,
              is_followup: false,
            },
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: t("employees.toast.statusUpdated") });
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ title: t("employees.toast.deleted") });
      setDeleteEmployeeId(null);
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const moveToStaffMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_master_data")
        .update({ is_staff_employee: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      queryClient.invalidateQueries({ queryKey: ["staff-employees"] });
      toast({ title: "Medarbejder flyttet", description: "Medarbejderen er nu i backoffice" });
    },
    onError: (error) => {
      toast({ title: t("employees.toast.error"), description: error.message, variant: "destructive" });
    },
  });

  const handleCreateEmployee = async () => {
    if (!createData.first_name || !createData.email || !createData.password || !createData.job_title) {
      toast({ title: t("employees.toast.fillRequired"), variant: "destructive" });
      return;
    }

    if (createData.password.length < 6) {
      toast({ title: t("employees.toast.passwordTooShort"), variant: "destructive" });
      return;
    }

    setCreatingEmployee(true);
    try {
      // Create auth user first
      const response = await supabase.functions.invoke("create-employee-user", {
        body: {
          email: createData.email,
          password: createData.password,
          firstName: createData.first_name,
          lastName: createData.last_name,
        },
      });

      // Check for error in response data first (edge function returns error in data)
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message || t("employees.toast.couldNotCreate"));
      }

      if (!response.data?.success) {
        throw new Error(t("employees.toast.couldNotCreate"));
      }

      // Update the employee record that was created by the edge function with job_title and employment_start_date
      const { error: updateError } = await supabase
        .from("employee_master_data")
        .update({
          job_title: createData.job_title,
          employment_start_date: new Date().toISOString().split("T")[0],
        })
        .eq("private_email", createData.email);

      if (updateError) {
        console.warn("Could not update job_title:", updateError);
      }

      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ 
        title: t("employees.toast.created"), 
        description: t("employees.toast.userCreated", { email: createData.email }) 
      });
      setCreateDialogOpen(false);
      setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
    } catch (error) {
      console.error("Create error:", error);
      toast({
        title: t("employees.toast.error"),
        description: error instanceof Error ? error.message : t("employees.toast.couldNotCreate"),
        variant: "destructive",
      });
    } finally {
      setCreatingEmployee(false);
    }
  };

  const handleSendInvitation = async (employee: EmployeeMasterDataRecord) => {
    if (!employee.private_email) {
      toast({ title: t("employees.toast.noEmail"), description: t("employees.toast.noEmailRegistered"), variant: "destructive" });
      return;
    }

    setSendingResetTo(employee.id);
    try {
      const response = await supabase.functions.invoke("send-employee-invitation", {
        body: {
          employeeId: employee.id,
          email: employee.private_email,
          firstName: employee.first_name,
          lastName: employee.last_name,
        },
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      if (response.error) {
        throw new Error(response.error.message || t("employees.toast.couldNotSendEmail"));
      }

      queryClient.invalidateQueries({ queryKey: ["employee-master-data"] });
      toast({ 
        title: t("employees.toast.invitationSent"), 
        description: t("employees.toast.invitationSentDesc", { email: employee.private_email }) 
      });
    } catch (error) {
      console.error("Send invitation error:", error);
      toast({
        title: t("employees.toast.error"),
        description: error instanceof Error ? error.message : t("employees.toast.couldNotSendEmail"),
        variant: "destructive",
      });
    } finally {
      setSendingResetTo(null);
    }
  };

  const filteredEmployees = employees
    .filter((e) => {
      if (statusFilter === "active") return e.is_active;
      if (statusFilter === "inactive") return !e.is_active;
      return true;
    })
    .filter((e) => {
      if (teamFilter === "all") return true;
      const employeeTeams = getEmployeeTeams(e.id);
      return employeeTeams.includes(teamFilter);
    })
    .filter(
      (e) =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.private_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.job_title?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case "name":
          const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
          const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
          comparison = nameA.localeCompare(nameB, 'da');
          break;
        case "position":
          const posA = (a.job_title || "").toLowerCase();
          const posB = (b.job_title || "").toLowerCase();
          comparison = posA.localeCompare(posB, 'da');
          break;
        case "team":
          const teamA = getEmployeeTeams(a.id).toLowerCase();
          const teamB = getEmployeeTeams(b.id).toLowerCase();
          comparison = teamA.localeCompare(teamB, 'da');
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const activeCount = employees.filter((e) => e.is_active).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("employees.title")}</h1>
          <p className="text-muted-foreground">{t("employees.subtitle")}</p>
        </div>


            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setEditingEmployee(null);
                setFormData(defaultEmployee);
                setCurrentStep(0);
                setLastSaved(null);
              }
            }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingEmployee ? t("employees.dialog.editEmployee") : t("employees.dialog.newEmployee")}</DialogTitle>
              </DialogHeader>
              
              {/* Progress indicator */}
              <div className="flex items-center justify-center mb-4 gap-1">
                {dialogSteps.map((step, index) => (
                  <div key={index} className="flex items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        index < currentStep
                          ? "bg-green-500 text-white"
                          : index === currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index < currentStep ? <Check className="h-3 w-3" /> : index + 1}
                    </div>
                    {index < dialogSteps.length - 1 && (
                      <div className={`w-6 h-0.5 ${index < currentStep ? "bg-green-500" : "bg-muted"}`} />
                    )}
                  </div>
                ))}
              </div>
              
              <p className="text-center text-sm font-medium mb-4">{dialogSteps[currentStep]?.title}</p>

              {/* Auto-save indicator */}
              <div className="text-center mb-4 h-4">
                {autoSaving ? (
                  <span className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> {t("employees.dialog.saving")}
                  </span>
                ) : lastSaved ? (
                  <span className="text-xs text-green-600 flex items-center justify-center gap-1">
                    <Check className="h-3 w-3" /> {t("employees.dialog.savedAutomatically")}
                  </span>
                ) : null}
              </div>

              {/* Step 0: Identity */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  {/* Avatar Upload - Only show when editing existing employee */}
                  {editingEmployee && (
                    <div className="flex flex-col items-center gap-3">
                      <Label className="text-sm text-muted-foreground">Profilbillede</Label>
                      <div className="relative group">
                        <Avatar className="h-24 w-24 border-2 border-border">
                          <AvatarImage src={formData.avatar_url || undefined} alt="Profilbillede" />
                          <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                            {formData.first_name?.[0]?.toUpperCase() || ""}
                            {formData.last_name?.[0]?.toUpperCase() || ""}
                          </AvatarFallback>
                        </Avatar>
                        <label 
                          htmlFor="avatar-upload" 
                          className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          {uploadingAvatar ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                          ) : (
                            <Camera className="h-6 w-6 text-muted-foreground" />
                          )}
                        </label>
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          disabled={uploadingAvatar}
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("employees.fields.firstName")} *</Label>
                      <Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.lastName")} *</Label>
                      <Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>{t("employees.fields.cprNumber")}</Label>
                      <Input type="password" value={formData.cpr_number || ""} onChange={(e) => setFormData({ ...formData, cpr_number: e.target.value || null })} placeholder={t("employees.fields.cprPlaceholder")} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Contact */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>{t("employees.fields.address")}</Label>
                      <Input value={formData.address_street || ""} onChange={(e) => setFormData({ ...formData, address_street: e.target.value || null })} placeholder={t("employees.fields.addressPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.postalCode")}</Label>
                      <Input value={formData.address_postal_code || ""} onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.city")}</Label>
                      <Input value={formData.address_city || ""} onChange={(e) => setFormData({ ...formData, address_city: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.country")}</Label>
                      <Input value={formData.address_country || ""} onChange={(e) => setFormData({ ...formData, address_country: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.phone")}</Label>
                      <Input value={formData.private_phone || ""} onChange={(e) => setFormData({ ...formData, private_phone: e.target.value || null })} />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>{t("employees.fields.email")}</Label>
                      <Input type="email" value={formData.private_email || ""} onChange={(e) => setFormData({ ...formData, private_email: e.target.value || null })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Employment */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("employees.fields.employmentDate")}</Label>
                      <Input type="date" value={formData.employment_start_date || ""} onChange={(e) => setFormData({ ...formData, employment_start_date: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.endDate")}</Label>
                      <Input type="date" value={formData.employment_end_date || ""} onChange={(e) => setFormData({ ...formData, employment_end_date: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.jobTitle")}</Label>
                      <Select value={formData.job_title || ""} onValueChange={(v) => setFormData({ ...formData, job_title: v || null })}>
                        <SelectTrigger><SelectValue placeholder={t("employees.fields.selectPosition")} /></SelectTrigger>
                        <SelectContent>
                          {jobPositions.map((position) => (
                            <SelectItem key={position.id} value={position.name}>
                              {position.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.department")}</Label>
                      <Input value={formData.department || ""} onChange={(e) => setFormData({ ...formData, department: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.workLocation")}</Label>
                      <Select value={formData.work_location || "København V"} onValueChange={(v) => setFormData({ ...formData, work_location: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="København V">København V</SelectItem>
                          <SelectItem value="Århus">Århus</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.contractId")}</Label>
                      <Input value={formData.contract_id || ""} onChange={(e) => setFormData({ ...formData, contract_id: e.target.value || null })} />
                    </div>
                    <div className="flex items-center space-x-2 col-span-2">
                      <Switch checked={formData.is_active} onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })} />
                      <Label>{t("employees.fields.activeEmployee")}</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Salary */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("employees.fields.salaryType")}</Label>
                      <Select value={formData.salary_type || "provision"} onValueChange={(v) => setFormData({ ...formData, salary_type: v as "provision" | "fixed" | "hourly" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="provision">{t("employees.salaryTypes.provision")}</SelectItem>
                          <SelectItem value="fixed">{t("employees.salaryTypes.fixed")}</SelectItem>
                          <SelectItem value="hourly">{t("employees.salaryTypes.hourly")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(formData.salary_type === "fixed" || formData.salary_type === "hourly") && (
                      <div className="space-y-2">
                        <Label>{t("employees.fields.salaryAmount")}</Label>
                        <Input type="number" value={formData.salary_amount || ""} onChange={(e) => setFormData({ ...formData, salary_amount: e.target.value ? parseFloat(e.target.value) : null })} />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{t("employees.fields.regNumber")}</Label>
                      <Input type="password" value={formData.bank_reg_number || ""} onChange={(e) => setFormData({ ...formData, bank_reg_number: e.target.value || null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.accountNumber")}</Label>
                      <Input type="password" value={formData.bank_account_number || ""} onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value || null })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Vacation */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("employees.fields.vacationType")}</Label>
                      <Select value={formData.vacation_type || "vacation_pay"} onValueChange={(v) => setFormData({ ...formData, vacation_type: v as "vacation_pay" | "vacation_bonus" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacation_pay">{t("employees.fields.vacationPay")}</SelectItem>
                          <SelectItem value="vacation_bonus">{t("employees.fields.vacationBonus")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.vacation_type === "vacation_bonus" && (
                      <div className="space-y-2">
                        <Label>{t("employees.fields.vacationBonusPercent")}</Label>
                        <Input type="number" value={formData.vacation_bonus_percent || 1} onChange={(e) => setFormData({ ...formData, vacation_bonus_percent: parseFloat(e.target.value) })} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Other */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch checked={formData.has_parking} onCheckedChange={(checked) => setFormData({ ...formData, has_parking: checked })} />
                      <Label>{t("employees.fields.parkingSpot")}</Label>
                    </div>
                    {formData.has_parking && (
                      <>
                        <div className="space-y-2">
                          <Label>{t("employees.fields.spotId")}</Label>
                          <Input value={formData.parking_spot_id || ""} onChange={(e) => setFormData({ ...formData, parking_spot_id: e.target.value || null })} />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("employees.fields.monthlyPrice")}</Label>
                          <Input type="number" value={formData.parking_monthly_cost || ""} onChange={(e) => setFormData({ ...formData, parking_monthly_cost: e.target.value ? parseFloat(e.target.value) : null })} />
                        </div>
                      </>
                    )}
                    <div className="space-y-2 col-span-2">
                      <Label>{t("employees.fields.workingHoursModel")}</Label>
                      <Input value={formData.working_hours_model || ""} onChange={(e) => setFormData({ ...formData, working_hours_model: e.target.value || null })} placeholder={t("employees.fields.workingHoursPlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.hoursPerWeek")}</Label>
                      <Input type="number" value={formData.weekly_hours || ""} onChange={(e) => setFormData({ ...formData, weekly_hours: e.target.value ? parseFloat(e.target.value) : null })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("employees.fields.standardStartTime")}</Label>
                      <Input type="time" value={formData.standard_start_time || ""} onChange={(e) => setFormData({ ...formData, standard_start_time: e.target.value || null })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex gap-4 mt-6">
                {currentStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setCurrentStep(currentStep - 1)}
                  >
                    {t("employees.dialog.back")}
                  </Button>
                )}
                <Button
                  type="button"
                  className="flex-1"
                  onClick={handleStepNext}
                  disabled={saveMutation.isPending || autoSaving}
                >
                  {saveMutation.isPending || autoSaving ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("employees.dialog.saving")}</>
                  ) : currentStep === dialogSteps.length - 1 ? (
                    <>{t("employees.dialog.finish")} <Check className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>{t("employees.dialog.next")} <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        <Tabs defaultValue="all-employees" className="space-y-6">
          <TabsList>
            <TabsTrigger value="all-employees">{t("employees.tabs.allEmployees")}</TabsTrigger>
            <TabsTrigger value="staff-employees">Backoffice</TabsTrigger>
            <TabsTrigger value="teams">{t("employees.tabs.teams")}</TabsTrigger>
            <TabsTrigger value="positions">{t("employees.tabs.positions")}</TabsTrigger>
            <TabsTrigger value="dialer-mapping">{t("employees.tabs.dialerMapping")}</TabsTrigger>
          </TabsList>

          <TabsContent value="all-employees" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-card/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t("employees.stats.activeEmployees")}</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{activeCount}</div>
          </div>
          <div className="rounded-xl bg-card/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Backoffice</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{staffCount}</div>
          </div>
          <div className="rounded-xl bg-card/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">{t("employees.stats.total")}</span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{activeCount + staffCount}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h2 className="text-xl font-semibold">{t("employees.overview")}</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg bg-muted/50 p-1">
                <Button
                  variant={statusFilter === "active" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter("active")}
                  className="h-7 px-3 text-xs"
                >
                  {t("employees.filters.active")} ({activeCount})
                </Button>
                <Button
                  variant={statusFilter === "inactive" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter("inactive")}
                  className="h-7 px-3 text-xs"
                >
                  {t("employees.filters.inactive")}
                </Button>
                <Button
                  variant={statusFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                  className="h-7 px-3 text-xs"
                >
                  {t("employees.filters.all")} ({employees.length})
                </Button>
              </div>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-36 h-9 bg-muted/50 border-0">
                  <SelectValue placeholder="Alle teams" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">Alle teams</SelectItem>
                  {uniqueTeams.map((team) => (
                    <SelectItem key={team} value={team}>{team}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  ref={searchInputRef}
                  placeholder={t("employees.filters.searchPlaceholder")} 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-9 pr-12 bg-muted/50 border-0 focus-visible:ring-1 h-9" 
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
              <div className="flex items-center gap-2">
                <EmployeeExcelImport />
                <Dialog open={createDialogOpen} onOpenChange={(open) => {
                  setCreateDialogOpen(open);
                  if (!open) setCreateData({ first_name: "", last_name: "", email: "", password: "", job_title: "" });
                }}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> {t("employees.create.button")}</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{t("employees.create.title")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-muted-foreground">
                        {t("employees.create.description")}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Fornavn *</Label>
                          <Input 
                            value={createData.first_name} 
                            onChange={(e) => setCreateData({ ...createData, first_name: e.target.value })} 
                            placeholder="Fornavn"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Efternavn</Label>
                          <Input 
                            value={createData.last_name} 
                            onChange={(e) => setCreateData({ ...createData, last_name: e.target.value })} 
                            placeholder="Efternavn"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email *</Label>
                        <Input 
                          type="email"
                          value={createData.email} 
                          onChange={(e) => setCreateData({ ...createData, email: e.target.value })} 
                          placeholder="medarbejder@email.dk"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kodeord *</Label>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"}
                            value={createData.password} 
                            onChange={(e) => setCreateData({ ...createData, password: e.target.value })} 
                            placeholder="Mindst 6 tegn"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Medarbejderen kan ændre koden efter første login.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Stilling *</Label>
                        <Select 
                          value={createData.job_title} 
                          onValueChange={(value) => setCreateData({ ...createData, job_title: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Vælg stilling" />
                          </SelectTrigger>
                          <SelectContent>
                            {jobPositions.map((position) => (
                              <SelectItem key={position.id} value={position.name}>
                                {position.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Rettigheder tildeles automatisk baseret på stilling.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleCreateEmployee} disabled={creatingEmployee}>
                        {creatingEmployee ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opretter...</>
                        ) : (
                          <><Plus className="mr-2 h-4 w-4" /> Opret medarbejder</>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
          
          <div className="rounded-xl bg-card/50 overflow-hidden">
            {isLoading ? (
              <p className="text-muted-foreground p-6">{t("employees.loading")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b border-border/50">
                    <TableHead 
                      className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        {t("employees.table.name")}
                        {sortColumn === "name" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("position")}
                    >
                      <div className="flex items-center gap-1">
                        {t("employees.table.position")}
                        {sortColumn === "position" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                      onClick={() => handleSort("team")}
                    >
                      <div className="flex items-center gap-1">
                        Team
                        {sortColumn === "team" ? (
                          sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">{t("employees.table.status")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow 
                      key={employee.id} 
                      className="cursor-pointer hover:bg-muted/30 border-b border-border/30"
                      onClick={() => navigate(`/employees/${employee.id}`)}
                    >
                      <TableCell className="font-medium py-3">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative">
                                {getContractStatus(employee.id) === 'signed' ? (
                                  <div className="flex items-center">
                                    <FileText className="h-3.5 w-3.5 text-green-500" />
                                    <Check className="h-2.5 w-2.5 text-green-500 absolute -right-1 -bottom-0.5" />
                                  </div>
                                ) : getContractStatus(employee.id) === 'pending' ? (
                                  <div className="flex items-center">
                                    <FileText className="h-3.5 w-3.5 text-amber-500" />
                                    <Clock className="h-2.5 w-2.5 text-amber-500 absolute -right-1 -bottom-0.5" />
                                  </div>
                                ) : getContractStatus(employee.id) === 'rejected' ? (
                                  <div className="flex items-center">
                                    <FileText className="h-3.5 w-3.5 text-red-500" />
                                    <X className="h-2.5 w-2.5 text-red-500 absolute -right-1 -bottom-0.5" />
                                  </div>
                                ) : (
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground/30" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {getContractStatus(employee.id) === 'signed' 
                                ? t("employees.table.contractSigned")
                                : getContractStatus(employee.id) === 'pending'
                                ? "Afventer underskrift"
                                : getContractStatus(employee.id) === 'rejected'
                                ? "Kontrakt afvist"
                                : t("employees.table.noContractSigned")}
                            </TooltipContent>
                          </Tooltip>
                          <span>{employee.first_name} {employee.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-sm">{employee.job_title || <span className="text-muted-foreground/50">-</span>}</TableCell>
                      <TableCell className="py-3">
                        {getEmployeeTeams(employee.id) ? (
                          <Badge variant="secondary" className="text-xs font-normal">{getEmployeeTeams(employee.id)}</Badge>
                        ) : <span className="text-muted-foreground/50">-</span>}
                      </TableCell>
                      <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                        <Switch 
                          checked={employee.is_active} 
                          onCheckedChange={(checked) => {
                            if (!checked) {
                              setDeactivatingEmployee(employee);
                            } else {
                              toggleActiveMutation.mutate({ id: employee.id, is_active: true, employee });
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleSendInvitation(employee);
                                }}
                                disabled={!employee.private_email || sendingResetTo === employee.id || employee.invitation_status === "completed"}
                              >
                                {sendingResetTo === employee.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : employee.invitation_status === "completed" ? (
                                  <UserCheck className="h-3.5 w-3.5 text-green-500" />
                                ) : employee.invitation_status === "pending" ? (
                                  <Send className="h-3.5 w-3.5 text-amber-500" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {employee.invitation_status === "completed" 
                                ? t("employees.actions.registered") 
                                : employee.invitation_status === "pending"
                                ? t("employees.actions.resendInvitation")
                                : t("employees.actions.sendInvitation")}
                            </TooltipContent>
                          </Tooltip>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleEdit(employee); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover w-48">
                              <DropdownMenuItem
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  if (employee.private_phone) {
                                    if (hasOutboundSoftphone && isDeviceReady) {
                                      makeCall(employee.private_phone);
                                    } else {
                                      window.location.href = `tel:${employee.private_phone}`;
                                    }
                                  }
                                }}
                                disabled={!employee.private_phone}
                              >
                                <Phone className="h-4 w-4 mr-2" />
                                Ring op
                              </DropdownMenuItem>
                              {canSendEmployeeSms && (
                                <DropdownMenuItem
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setSmsEmployee(employee);
                                    setSmsDialogOpen(true);
                                  }}
                                  disabled={!employee.private_phone}
                                >
                                  <MessageSquare className="h-4 w-4 mr-2" />
                                  Send SMS
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); setMoveToStaffId(employee.id); }}
                              >
                                <ArrowRightLeft className="h-4 w-4 mr-2" />
                                Flyt til stab
                              </DropdownMenuItem>
                              {canEditEmployees && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setDeleteEmployeeId(employee.id); }}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Slet medarbejder
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        {t("employees.table.noEmployeesFound")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

          </TabsContent>

          <TabsContent value="staff-employees" className="space-y-6">
            <StaffEmployeesTab />
          </TabsContent>

          <TabsContent value="teams" className="space-y-6">
            <TeamsTab />
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            <PositionsTab />
          </TabsContent>

          <TabsContent value="dialer-mapping" className="space-y-6">
            <DialerMappingTab />
          </TabsContent>
        </Tabs>

        {/* Delete confirmation dialog */}
        <AlertDialog open={!!deleteEmployeeId} onOpenChange={(open) => !open && setDeleteEmployeeId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("employees.delete.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("employees.delete.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("employees.delete.cancel")}</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deleteEmployeeId && deleteMutation.mutate(deleteEmployeeId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("employees.delete.confirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Move to staff confirmation dialog */}
        <AlertDialog open={!!moveToStaffId} onOpenChange={(open) => !open && setMoveToStaffId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Flyt til backoffice</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på at du vil flytte denne medarbejder til backoffice?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuller</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (moveToStaffId) {
                    moveToStaffMutation.mutate(moveToStaffId);
                    setMoveToStaffId(null);
                  }
                }}
              >
                Flyt medarbejder
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Deactivation confirmation dialog */}
        <AlertDialog open={!!deactivatingEmployee} onOpenChange={(open) => !open && setDeactivatingEmployee(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deaktiver medarbejder</AlertDialogTitle>
              <AlertDialogDescription>
                Er du sikker på at du vil deaktivere <strong>{deactivatingEmployee?.first_name} {deactivatingEmployee?.last_name}</strong>? 
                Medarbejderen vil ikke længere kunne logge ind og vil blive markeret som inaktiv.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuller</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => {
                  if (deactivatingEmployee) {
                    toggleActiveMutation.mutate({ id: deactivatingEmployee.id, is_active: false, employee: deactivatingEmployee });
                    setDeactivatingEmployee(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Deaktiver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* SMS Dialog for employee communication */}
        {smsEmployee && (
          <SendEmployeeSmsDialog
            open={smsDialogOpen}
            onOpenChange={setSmsDialogOpen}
            employee={smsEmployee}
          />
        )}
      </div>
    </MainLayout>
  );
}
