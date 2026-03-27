import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Shield, Calendar, FileText, Loader2, Crown, User, Eye, Lock, Pencil, Settings2,
  Home, Users, ClipboardList, Car, FlaskConical, Phone, Monitor, GraduationCap, 
  FileBarChart, Wrench, Settings, ShoppingCart, ListChecks, Activity, Video, 
  HeartHandshake, MessageSquare, UserCheck, Target, Sparkles, Gift, Swords, 
  Trophy, Building2, Mail, Clock, Timer, LayoutDashboard, Receipt, CreditCard, 
  BarChart3, Database, UserPlus, BookOpen, CalendarDays, Globe, Users2, UserCircle,
  ChevronDown, ChevronRight
} from "lucide-react";
import { 
  useRoleDefinitions, 
  usePagePermissions, 
  permissionKeyLabels,
  type RoleDefinition,
  type Visibility
} from "@/hooks/useUnifiedPermissions";
import { PermissionEditor } from "./permissions/PermissionEditor";
import { PermissionMap } from "./permissions/PermissionMap";
import { cn } from "@/lib/utils";

// Visibility icon mapping
const visibilityConfig: Record<Visibility, { icon: React.ReactNode; label: string; color: string }> = {
  all: { icon: <Globe className="h-4 w-4" />, label: "Ser alt data", color: "text-purple-600" },
  team: { icon: <Users2 className="h-4 w-4" />, label: "Ser team data", color: "text-amber-600" },
  self: { icon: <UserCircle className="h-4 w-4" />, label: "Kun egen data", color: "text-gray-400" },
  none: { icon: <UserCircle className="h-4 w-4" />, label: "Ingen adgang", color: "text-muted-foreground/30" },
};

// Icon mapping from database string to component (for roles)
const roleIconMap: Record<string, React.ReactNode> = {
  crown: <Crown className="h-4 w-4" />,
  shield: <Shield className="h-4 w-4" />,
  "file-text": <FileText className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
};

// Color mapping from database string to Tailwind classes
const colorMap: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  blue: "bg-blue-500 text-white",
  amber: "bg-amber-500 text-white",
  purple: "bg-purple-500 text-white",
  muted: "bg-muted text-muted-foreground",
  gray: "bg-muted text-muted-foreground",
};

// Comprehensive icon mapping for all permission keys
const permissionIconMap: Record<string, React.ReactNode> = {
  // MIT HJEM
  menu_section_personal: <Home className="h-4 w-4" />,
  menu_home: <Home className="h-4 w-4" />,
  menu_h2h: <Swords className="h-4 w-4" />,
  menu_commission_league: <Trophy className="h-4 w-4" />,
  menu_league_admin: <Crown className="h-4 w-4" />,
  menu_liga_test_board: <Trophy className="h-4 w-4" />,
  menu_h2h_admin: <Swords className="h-4 w-4" />,
  menu_team_h2h: <Users className="h-4 w-4" />,
  menu_messages: <MessageSquare className="h-4 w-4" />,
  menu_my_schedule: <UserCheck className="h-4 w-4" />,
  menu_my_profile: <User className="h-4 w-4" />,
  menu_my_goals: <Target className="h-4 w-4" />,
  menu_team_goals: <Users className="h-4 w-4" />,
  menu_my_contracts: <FileText className="h-4 w-4" />,
  menu_career_wishes: <Sparkles className="h-4 w-4" />,
  menu_my_feedback: <MessageSquare className="h-4 w-4" />,
  menu_refer_friend: <Gift className="h-4 w-4" />,
  menu_my_sales: <ShoppingCart className="h-4 w-4" />,
  menu_my_shifts: <Calendar className="h-4 w-4" />,
  menu_my_absence: <Clock className="h-4 w-4" />,
  menu_my_coaching: <GraduationCap className="h-4 w-4" />,
  
  // SOME
  menu_section_some: <Video className="h-4 w-4" />,
  menu_some: <Video className="h-4 w-4" />,
  menu_extra_work: <HeartHandshake className="h-4 w-4" />,
  
  // PERSONALE
  menu_section_personale: <Users className="h-4 w-4" />,
  menu_dashboard: <LayoutDashboard className="h-4 w-4" />,
  menu_employees: <Users className="h-4 w-4" />,
  menu_teams: <Users className="h-4 w-4" />,
  menu_permissions: <Shield className="h-4 w-4" />,
  menu_login_log: <Clock className="h-4 w-4" />,
  menu_upcoming_starts: <UserPlus className="h-4 w-4" />,
  
  // LEDELSE
  menu_section_ledelse: <Crown className="h-4 w-4" />,
  menu_company_overview: <Building2 className="h-4 w-4" />,
  menu_contracts: <FileText className="h-4 w-4" />,
  menu_career_wishes_overview: <Sparkles className="h-4 w-4" />,
  menu_email_templates_ledelse: <Mail className="h-4 w-4" />,
  menu_security_dashboard: <Lock className="h-4 w-4" />,
  
  // VAGTPLAN
  menu_section_vagtplan: <ClipboardList className="h-4 w-4" />,
  menu_shift_overview: <Calendar className="h-4 w-4" />,
  menu_absence: <Clock className="h-4 w-4" />,
  menu_time_tracking: <Timer className="h-4 w-4" />,
  menu_time_stamp: <Clock className="h-4 w-4" />,
  menu_closing_shifts: <Lock className="h-4 w-4" />,
  
  // FIELDMARKETING
  menu_section_fieldmarketing: <CalendarDays className="h-4 w-4" />,
  menu_fm_overview: <LayoutDashboard className="h-4 w-4" />,
  menu_fm_booking: <CalendarDays className="h-4 w-4" />,
  menu_fm_vehicles: <Car className="h-4 w-4" />,
  menu_fm_dashboard: <LayoutDashboard className="h-4 w-4" />,
  menu_fm_sales_registration: <ShoppingCart className="h-4 w-4" />,
  menu_fm_billing: <Receipt className="h-4 w-4" />,
  menu_fm_travel_expenses: <CreditCard className="h-4 w-4" />,
  menu_fm_edit_sales: <Pencil className="h-4 w-4" />,
  menu_fm_time_off: <Clock className="h-4 w-4" />,
  menu_fm_book_week: <CalendarDays className="h-4 w-4" />,
  menu_fm_bookings: <Calendar className="h-4 w-4" />,
  menu_fm_locations: <Building2 className="h-4 w-4" />,
  menu_fm_vagtplan_fm: <Calendar className="h-4 w-4" />,
  
  // MG
  menu_section_mg: <FlaskConical className="h-4 w-4" />,
  menu_team_overview: <Users className="h-4 w-4" />,
  menu_tdc_erhverv: <Phone className="h-4 w-4" />,
  menu_tdc_erhverv_dashboard: <Phone className="h-4 w-4" />,
  menu_relatel_dashboard: <BarChart3 className="h-4 w-4" />,
  menu_tryg_dashboard: <BarChart3 className="h-4 w-4" />,
  menu_ase_dashboard: <BarChart3 className="h-4 w-4" />,
  menu_codan: <BarChart3 className="h-4 w-4" />,
  menu_mg_test: <FlaskConical className="h-4 w-4" />,
  menu_mg_test_dashboard: <FlaskConical className="h-4 w-4" />,
  menu_dialer_data: <Database className="h-4 w-4" />,
  menu_calls_data: <Phone className="h-4 w-4" />,
  menu_adversus_data: <Database className="h-4 w-4" />,
  menu_payroll: <BarChart3 className="h-4 w-4" />,
  
  // SALARY
  menu_section_salary: <CreditCard className="h-4 w-4" />,
  menu_salary_types: <FileText className="h-4 w-4" />,
  
  // DASHBOARDS (individuelle dashboards administreres i dashboard-miljøet)
  menu_section_dashboards: <Monitor className="h-4 w-4" />,
  menu_dashboards: <Monitor className="h-4 w-4" />,
  
  // TEST
  menu_section_test: <FlaskConical className="h-4 w-4" />,
  menu_car_quiz_admin: <Car className="h-4 w-4" />,
  menu_coc_admin: <Shield className="h-4 w-4" />,
  menu_pulse_survey: <BarChart3 className="h-4 w-4" />,
  
  // REKRUTTERING
  menu_section_rekruttering: <Target className="h-4 w-4" />,
  menu_recruitment_dashboard: <Target className="h-4 w-4" />,
  menu_candidates: <Users className="h-4 w-4" />,
  menu_upcoming_interviews: <Calendar className="h-4 w-4" />,
  menu_winback: <UserPlus className="h-4 w-4" />,
  menu_upcoming_hires: <UserPlus className="h-4 w-4" />,
  menu_messages_recruitment: <MessageSquare className="h-4 w-4" />,
  menu_sms_templates: <MessageSquare className="h-4 w-4" />,
  menu_email_templates_recruitment: <Mail className="h-4 w-4" />,
  menu_referrals: <Gift className="h-4 w-4" />,
  
  // ONBOARDING
  menu_section_onboarding: <GraduationCap className="h-4 w-4" />,
  menu_onboarding_overview: <GraduationCap className="h-4 w-4" />,
  menu_onboarding_kursus: <BookOpen className="h-4 w-4" />,
  menu_onboarding_ramp: <BarChart3 className="h-4 w-4" />,
  menu_onboarding_leader: <Crown className="h-4 w-4" />,
  menu_onboarding_drills: <Target className="h-4 w-4" />,
  menu_onboarding_admin: <GraduationCap className="h-4 w-4" />,
  menu_coaching_templates: <BookOpen className="h-4 w-4" />,
  
  // RAPPORTER
  menu_section_reports: <FileBarChart className="h-4 w-4" />,
  menu_reports_admin: <Crown className="h-4 w-4" />,
  menu_reports_daily: <Calendar className="h-4 w-4" />,
  menu_reports_management: <Crown className="h-4 w-4" />,
  menu_reports_employee: <User className="h-4 w-4" />,
  
  // ADMIN
  menu_section_admin: <Wrench className="h-4 w-4" />,
  menu_kpi_definitions: <BookOpen className="h-4 w-4" />,
  
  // SALG & SYSTEM
  menu_section_sales_system: <ShoppingCart className="h-4 w-4" />,
  menu_sales: <ShoppingCart className="h-4 w-4" />,
  menu_logics: <ListChecks className="h-4 w-4" />,
  menu_live_stats: <Activity className="h-4 w-4" />,
  menu_settings: <Settings className="h-4 w-4" />,
  
  // Legacy
  menu_leaderboard: <Trophy className="h-4 w-4" />,
};

// Section order for grouping permissions
const sectionOrder: string[] = [
  'menu_section_personal',
  'menu_section_some',
  'menu_section_personale',
  'menu_section_ledelse',
  'menu_section_vagtplan',
  'menu_section_fieldmarketing',
  'menu_section_mg',
  'menu_section_salary',
  'menu_section_dashboards',
  'menu_section_test',
  'menu_section_rekruttering',
  'menu_section_onboarding',
  'menu_section_reports',
  'menu_section_admin',
  'menu_section_sales_system',
];

// Map items to their parent section - COMPLETE list matching PermissionEditor HIERARCHY
const sectionChildren: Record<string, string[]> = {
  menu_section_personal: [
    'menu_home', 'menu_h2h', 'menu_commission_league', 'menu_league_admin',
    'menu_liga_test_board', 'menu_h2h_admin', 'menu_team_h2h', 'menu_messages',
    'menu_my_schedule', 'menu_my_profile', 'menu_my_goals', 'menu_team_goals', 'menu_my_contracts',
    'menu_career_wishes', 'menu_my_feedback', 'menu_refer_friend',
    'menu_my_sales', 'menu_my_shifts', 'menu_my_absence', 'menu_my_coaching'
  ],
  menu_section_some: ['menu_some', 'menu_extra_work'],
  menu_section_personale: [
    'menu_dashboard', 'menu_employees', 'menu_teams', 'menu_permissions',
    'menu_login_log', 'menu_upcoming_starts'
  ],
  menu_section_ledelse: [
    'menu_company_overview', 'menu_contracts', 'menu_career_wishes_overview',
    'menu_email_templates_ledelse', 'menu_security_dashboard'
  ],
  menu_section_vagtplan: [
    'menu_shift_overview', 'menu_absence', 'menu_time_tracking',
    'menu_time_stamp', 'menu_closing_shifts'
  ],
  menu_section_fieldmarketing: [
    'menu_fm_overview', 'menu_fm_booking', 'menu_fm_vehicles', 'menu_fm_dashboard',
    'menu_fm_sales_registration', 'menu_fm_billing', 'menu_fm_travel_expenses',
    'menu_fm_edit_sales', 'menu_fm_time_off', 'menu_fm_book_week',
    'menu_fm_bookings', 'menu_fm_locations', 'menu_fm_vagtplan_fm'
  ],
  menu_section_mg: [
    'menu_team_overview', 'menu_tdc_erhverv', 'menu_tdc_erhverv_dashboard',
    'menu_relatel_dashboard', 'menu_tryg_dashboard', 'menu_ase_dashboard',
    'menu_codan', 'menu_mg_test', 'menu_mg_test_dashboard',
    'menu_dialer_data', 'menu_calls_data', 'menu_adversus_data', 'menu_payroll'
  ],
  menu_section_salary: ['menu_payroll', 'menu_salary_types'],
  menu_section_dashboards: [
    'menu_dashboards',
    'menu_dashboard_admin',
    'menu_tv_board_admin',
    'menu_dashboard_settings'
  ],
  menu_section_test: ['menu_car_quiz_admin', 'menu_coc_admin', 'menu_pulse_survey'],
  menu_section_rekruttering: [
    'menu_recruitment_dashboard', 'menu_candidates', 'menu_upcoming_interviews',
    'menu_winback', 'menu_upcoming_hires', 'menu_messages_recruitment',
    'menu_sms_templates', 'menu_email_templates_recruitment', 'menu_referrals'
  ],
  menu_section_onboarding: [
    'menu_onboarding_overview', 'menu_onboarding_kursus', 'menu_onboarding_ramp',
    'menu_onboarding_leader', 'menu_onboarding_drills', 'menu_onboarding_admin',
    'menu_coaching_templates'
  ],
  menu_section_reports: [
    'menu_reports_admin', 'menu_reports_daily', 'menu_reports_management',
    'menu_reports_employee'
  ],
  menu_section_admin: ['menu_kpi_definitions'],
  menu_section_sales_system: ['menu_sales', 'menu_logics', 'menu_live_stats', 'menu_settings'],
};

// Get permission badge info
function getPermissionBadge(canView: boolean, canEdit: boolean, visibility: Visibility): {
  label: string;
  variant: "default" | "secondary" | "outline";
  className: string;
} {
  if (!canView) {
    return { label: "—", variant: "secondary", className: "bg-muted text-muted-foreground" };
  }
  if (canEdit && visibility === 'all') {
    return { label: "Fuld", variant: "default", className: "bg-green-600 text-white hover:bg-green-700" };
  }
  if (canEdit) {
    return { label: "Rediger", variant: "default", className: "bg-blue-600 text-white hover:bg-blue-700" };
  }
  return { label: "Læs", variant: "outline", className: "border-green-600 text-green-600" };
}

export function PermissionsTab() {
  const { data: roleDefinitions = [], isLoading: rolesLoading } = useRoleDefinitions();
  const { data: pagePermissions = [], isLoading: permissionsLoading } = usePagePermissions();
  
  // Track which sections are open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    sectionOrder.forEach(section => {
      initial[section] = true; // All sections open by default
    });
    return initial;
  });

  const isLoading = rolesLoading || permissionsLoading;
  
  // Get page permission for a role/key combination
  const getPagePermission = (roleKey: string, permissionKey: string) => {
    return pagePermissions.find(p => p.role_key === roleKey && p.permission_key === permissionKey);
  };

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList>
        <TabsTrigger value="overview">Oversigt</TabsTrigger>
        <TabsTrigger value="map" className="gap-2">
          🗺️ Kort
        </TabsTrigger>
        <TabsTrigger value="edit" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Rediger
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* Role descriptions from database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Systemroller
            </CardTitle>
            <CardDescription>
              Hver rolle giver adgang til specifikke funktioner i systemet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roleDefinitions.map((role) => (
                <div key={role.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className={colorMap[role.color || "gray"]}>
                      {roleIconMap[role.icon || "shield"]}
                      <span className="ml-1">{role.label}</span>
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-foreground">{role.description}</p>
                  {role.detailed_description && (
                    <div className="text-sm text-muted-foreground whitespace-pre-line border-t pt-3 mt-2">
                      {role.detailed_description}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Page Access Matrix - from database */}
        <Card>
          <CardHeader className="space-y-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Side-adgang & Data synlighed
              </CardTitle>
              <CardDescription>
                Hvem kan se og redigere hvilke sider, og hvilke data kan de se?
              </CardDescription>
            </div>
            
            {/* Legend moved to top */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground pt-2 border-t">
              <div className="flex items-center gap-1.5">
                <Badge className="bg-green-600 text-white text-xs">Fuld</Badge>
                <span>Kan se, redigere & alt data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge className="bg-blue-600 text-white text-xs">Rediger</Badge>
                <span>Kan redigere</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="border-green-600 text-green-600 text-xs">Læs</Badge>
                <span>Kun læseadgang</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">—</Badge>
                <span>Ingen adgang</span>
              </div>
              <div className="flex items-center gap-1.5 border-l pl-4">
                <Globe className="h-4 w-4 text-purple-600" />
                <span>Alt data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users2 className="h-4 w-4 text-amber-600" />
                <span>Team data</span>
              </div>
              <div className="flex items-center gap-1.5">
                <UserCircle className="h-4 w-4 text-gray-400" />
                <span>Egen data</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              {/* Scrollable container with sticky header */}
              <div className="max-h-[600px] overflow-y-auto relative border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                    <TableRow>
                      <TableHead className="bg-background min-w-[200px]">Side/Funktion</TableHead>
                      {roleDefinitions.map((role) => (
                        <TableHead key={role.key} className="text-center bg-background min-w-[100px]">
                          <Badge className={cn(colorMap[role.color || "gray"], "text-xs")} variant="outline">
                            {role.label}
                          </Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sectionOrder.map((sectionKey) => {
                      const children = sectionChildren[sectionKey] || [];
                      const isOpen = openSections[sectionKey];
                      
                      return (
                        <Collapsible key={sectionKey} open={isOpen} onOpenChange={() => toggleSection(sectionKey)} asChild>
                          <>
                            {/* Section Header Row */}
                            <CollapsibleTrigger asChild>
                              <TableRow className="bg-muted/70 hover:bg-muted cursor-pointer">
                                <TableCell className="font-semibold" colSpan={1}>
                                  <div className="flex items-center gap-2">
                                    {isOpen ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform" />
                                    )}
                                    {permissionIconMap[sectionKey] || <Shield className="h-4 w-4" />}
                                    <span>{permissionKeyLabels[sectionKey] || sectionKey}</span>
                                    <Badge variant="secondary" className="ml-2 text-xs">
                                      {children.length}
                                    </Badge>
                                  </div>
                                </TableCell>
                                {roleDefinitions.map((role) => {
                                  const perm = getPagePermission(role.key, sectionKey);
                                  const canView = perm?.can_view ?? false;
                                  const canEdit = perm?.can_edit ?? false;
                                  const visibility = (perm?.visibility as Visibility) ?? 'none';
                                  const badgeInfo = getPermissionBadge(canView, canEdit, visibility);
                                  const visConfig = visibilityConfig[visibility] || visibilityConfig.none;
                                  
                                  return (
                                    <TableCell key={role.key} className="text-center">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex items-center justify-center gap-1">
                                            <Badge 
                                              variant={badgeInfo.variant}
                                              className={cn("cursor-help text-xs", badgeInfo.className)}
                                            >
                                              {badgeInfo.label}
                                            </Badge>
                                            {canView && (
                                              <span className={visConfig.color}>
                                                {visConfig.icon}
                                              </span>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                          <div className="space-y-1 text-xs">
                                            <div className="font-medium">{permissionKeyLabels[sectionKey]}</div>
                                            <div className="flex items-center gap-1">
                                              <Eye className={cn("h-3 w-3", canView ? "text-green-600" : "text-muted-foreground")} />
                                              {canView ? "Kan se" : "Kan ikke se"}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              <Pencil className={cn("h-3 w-3", canEdit ? "text-blue-600" : "text-muted-foreground")} />
                                              {canEdit ? "Kan redigere" : "Kan ikke redigere"}
                                            </div>
                                            <div className="flex items-center gap-1">
                                              {canView ? visConfig.icon : <UserCircle className="h-3 w-3" />}
                                              {canView ? visConfig.label : "Ingen data adgang"}
                                            </div>
                                          </div>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            </CollapsibleTrigger>
                            
                            {/* Child Permission Rows */}
                            <CollapsibleContent asChild>
                              <>
                                {children.map((childKey) => {
                                  return (
                                    <TableRow key={childKey} className="hover:bg-muted/30">
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2 pl-8">
                                          {permissionIconMap[childKey] || <Shield className="h-4 w-4 text-muted-foreground" />}
                                          <span className="text-sm">{permissionKeyLabels[childKey] || childKey.replace('menu_', '').replace(/_/g, ' ')}</span>
                                        </div>
                                      </TableCell>
                                      {roleDefinitions.map((role) => {
                                        const perm = getPagePermission(role.key, childKey);
                                        const canView = perm?.can_view ?? false;
                                        const canEdit = perm?.can_edit ?? false;
                                        const visibility = (perm?.visibility as Visibility) ?? 'none';
                                        const badgeInfo = getPermissionBadge(canView, canEdit, visibility);
                                        const visConfig = visibilityConfig[visibility] || visibilityConfig.none;
                                        
                                        return (
                                          <TableCell key={role.key} className="text-center">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <div className="flex items-center justify-center gap-1">
                                                  <Badge 
                                                    variant={badgeInfo.variant}
                                                    className={cn("cursor-help text-xs", badgeInfo.className)}
                                                  >
                                                    {badgeInfo.label}
                                                  </Badge>
                                                  {canView && (
                                                    <span className={visConfig.color}>
                                                      {visConfig.icon}
                                                    </span>
                                                  )}
                                                </div>
                                              </TooltipTrigger>
                                              <TooltipContent className="max-w-xs">
                                                <div className="space-y-1 text-xs">
                                                  <div className="font-medium">{permissionKeyLabels[childKey] || childKey}</div>
                                                  <div className="flex items-center gap-1">
                                                    <Eye className={cn("h-3 w-3", canView ? "text-green-600" : "text-muted-foreground")} />
                                                    {canView ? "Kan se" : "Kan ikke se"}
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    <Pencil className={cn("h-3 w-3", canEdit ? "text-blue-600" : "text-muted-foreground")} />
                                                    {canEdit ? "Kan redigere" : "Kan ikke redigere"}
                                                  </div>
                                                  <div className="flex items-center gap-1">
                                                    {canView ? visConfig.icon : <UserCircle className="h-3 w-3" />}
                                                    {canView ? visConfig.label : "Ingen data adgang"}
                                                  </div>
                                                </div>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TableCell>
                                        );
                                      })}
                                    </TableRow>
                                  );
                                })}
                              </>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>

      </TabsContent>

      <TabsContent value="map">
        <PermissionMap />
      </TabsContent>

      <TabsContent value="edit">
        <PermissionEditor />
      </TabsContent>
    </Tabs>
  );
}
