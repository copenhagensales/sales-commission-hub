import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { 
  LayoutDashboard, Users, ShoppingCart, Wallet, Settings, Tv, 
  Percent, Shield, Building2, Calendar, MapPin, ChevronDown, ChevronRight,
  Car, Clock, UserCheck, Receipt, Database, ListChecks, Timer, 
  FileText, Crown, User, Sparkles, BarChart3, Video, Phone, FlaskConical
} from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PreviewSidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

// Map permission keys to menu items (aligned with PositionsTab.tsx)
const MAIN_MENU_ITEMS = {
  menu_dashboard: { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  menu_wallboard: { name: "Wallboard", href: "/wallboard", icon: Tv },
  menu_some: { name: "SOME", href: "/some", icon: Video },
  menu_sales: { name: "Salg", href: "/sales", icon: ShoppingCart },
  menu_logics: { name: "Logikker", href: "/logikker", icon: ListChecks },
  menu_closing_shifts: { name: "Lukkevagter", href: "/closing-shifts", icon: Clock },
};

const PERSONAL_MENU_ITEMS = {
  menu_my_schedule: { name: "Min kalender", href: "/my-schedule", icon: UserCheck },
  menu_my_profile: { name: "Min profil", href: "/my-profile", icon: User },
  menu_my_contracts: { name: "Mine kontrakter", href: "/my-contracts", icon: FileText },
  menu_career_wishes: { name: "Karriereønsker", href: "/career-wishes", icon: Sparkles },
  menu_time_stamp: { name: "Stempel ind/ud", href: "/time-stamp", icon: Clock },
};

const PERSONNEL_ITEMS = {
  menu_employees: { name: "Medarbejdere", href: "/employees", icon: Users },
  menu_teams: { name: "Teams", href: "/teams", icon: Users },
};

const MANAGEMENT_ITEMS = {
  menu_contracts: { name: "Kontrakter", href: "/contracts", icon: FileText },
  menu_permissions: { name: "Rettigheder", href: "/permissions", icon: Shield },
  menu_career_wishes_overview: { name: "Karriereønsker", href: "/career-wishes-overview", icon: Sparkles },
};

const TEST_ITEMS = {
  menu_car_quiz_admin: { name: "Bil Quiz Admin", href: "/car-quiz-admin", icon: Car },
  menu_coc_admin: { name: "Code of Conduct", href: "/code-of-conduct-admin", icon: Shield },
  menu_pulse_survey: { name: "Pulsmåling", href: "/pulse-survey-results", icon: BarChart3 },
};

const MG_ITEMS = {
  menu_payroll: { name: "Lønkørsel", href: "/payroll", icon: Wallet },
  menu_tdc_erhverv: { name: "TDC Erhverv", href: "/tdc-erhverv", icon: Building2 },
  menu_codan: { name: "Codan", href: "/codan", icon: Shield },
  menu_mg_test: { name: "MG Test", href: "/mg-test", icon: Percent },
  menu_test_dashboard: { name: "Test Dashboard", href: "/mg-test-dashboard", icon: FlaskConical },
  menu_dialer_data: { name: "Dialer Data", href: "/dialer-data", icon: Database },
  menu_calls_data: { name: "Opkald", href: "/calls-data", icon: Phone },
  menu_adversus_data: { name: "Adversus Data", href: "/adversus-data", icon: Database },
};

const SHIFT_PLANNING_ITEMS = {
  menu_shift_overview: { name: "Vagtplan", href: "/shift-planning", icon: Calendar },
  menu_absence: { name: "Fravær", href: "/shift-planning/absence", icon: Clock },
  menu_time_tracking: { name: "Tidsregistrering", href: "/shift-planning/time-tracking", icon: Timer },
  menu_extra_work: { name: "Ekstra arbejde", href: "/extra-work", icon: Clock },
  menu_extra_work_admin: { name: "Ekstra arbejde admin", href: "/extra-work-admin", icon: Clock },
};

const VAGT_FLOW_ITEMS = {
  menu_fm_overview: { name: "Oversigt", href: "/vagt-flow", icon: LayoutDashboard },
  menu_fm_my_week: { name: "Min uge", href: "/vagt-flow/min-uge", icon: UserCheck },
  menu_fm_book_week: { name: "Book uge", href: "/vagt-flow/book-week", icon: Calendar },
  menu_fm_bookings: { name: "Bookinger", href: "/vagt-flow/bookings", icon: Calendar },
  menu_fm_locations: { name: "Lokationer", href: "/vagt-flow/locations", icon: MapPin },
  menu_fm_vehicles: { name: "Køretøjer", href: "/vagt-flow/vehicles", icon: Car },
  menu_fm_billing: { name: "Fakturering", href: "/vagt-flow/billing", icon: Receipt },
  menu_fm_time_off: { name: "Fraværsanmodninger", href: "/vagt-flow/time-off-requests", icon: Clock },
};

const RECRUITMENT_ITEMS = {
  menu_recruitment_dashboard: { name: "Dashboard", href: "/recruitment", icon: LayoutDashboard },
  menu_candidates: { name: "Kandidater", href: "/recruitment/candidates", icon: Users },
  menu_upcoming_interviews: { name: "Kommende interviews", href: "/recruitment/upcoming-interviews", icon: Calendar },
  menu_winback: { name: "Winback", href: "/recruitment/winback", icon: Users },
  menu_upcoming_hires: { name: "Kommende ansættelser", href: "/recruitment/upcoming-hires", icon: Users },
  menu_messages: { name: "Beskeder", href: "/recruitment/messages", icon: FileText },
  menu_sms_templates: { name: "SMS skabeloner", href: "/recruitment/sms-templates", icon: FileText },
  menu_email_templates: { name: "Email skabeloner", href: "/recruitment/email-templates", icon: FileText },
};

const BOARDS_ITEMS = {
  menu_boards_test: { name: "Test", href: "/boards/test", icon: Tv },
  menu_boards_economic: { name: "Økonomi", href: "/boards/economic", icon: Wallet },
  menu_boards_sales: { name: "Sales Dashboard", href: "/boards/sales", icon: ShoppingCart },
};

export function PreviewSidebar({ isMobile = false, onNavigate }: PreviewSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { previewPermissions } = useRolePreview();
  
  const [personnelOpen, setPersonnelOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [mgOpen, setMgOpen] = useState(false);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [vagtFlowOpen, setVagtFlowOpen] = useState(false);
  const [recruitmentOpen, setRecruitmentOpen] = useState(false);
  const [boardsOpen, setBoardsOpen] = useState(false);

  // Helper to check if permission is enabled
  const hasPermission = (key: string): boolean => {
    if (!previewPermissions) return false;
    const value = previewPermissions[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "object" && value !== null) {
      return value.view || value.edit || false;
    }
    return false;
  };

  // Get enabled items from a category
  const getEnabledItems = (items: Record<string, { name: string; href: string; icon: typeof Users }>) => {
    return Object.entries(items)
      .filter(([key]) => hasPermission(key))
      .map(([_, item]) => item);
  };

  const mainItems = getEnabledItems(MAIN_MENU_ITEMS);
  const personalItems = getEnabledItems(PERSONAL_MENU_ITEMS);
  const personnelItems = getEnabledItems(PERSONNEL_ITEMS);
  const managementItems = getEnabledItems(MANAGEMENT_ITEMS);
  const testItems = getEnabledItems(TEST_ITEMS);
  const mgItems = getEnabledItems(MG_ITEMS);
  const shiftItems = getEnabledItems(SHIFT_PLANNING_ITEMS);
  const vagtFlowItems = getEnabledItems(VAGT_FLOW_ITEMS);
  const recruitmentItems = getEnabledItems(RECRUITMENT_ITEMS);
  const boardsItems = getEnabledItems(BOARDS_ITEMS);

  const handleNavClick = () => {
    if (isMobile && onNavigate) {
      onNavigate();
    }
  };

  const sidebarClasses = isMobile 
    ? "h-full w-full bg-sidebar overflow-y-auto" 
    : "fixed left-0 top-10 z-40 h-[calc(100vh-40px)] w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto";

  const renderNavItem = (item: { name: string; href: string; icon: typeof Users }) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    return (
      <NavLink
        key={item.href}
        to={item.href}
        onClick={handleNavClick}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}
      >
        <Icon className="h-5 w-5" />
        {item.name}
      </NavLink>
    );
  };

  const renderCollapsibleMenu = (
    title: string,
    icon: typeof Users,
    items: { name: string; href: string; icon: typeof Users }[],
    open: boolean,
    setOpen: (open: boolean) => void,
    paths: string[]
  ) => {
    if (items.length === 0) return null;
    const isActive = paths.some(p => location.pathname.startsWith(p));
    const Icon = icon;
    
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        )}>
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" />
            {title}
          </div>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pl-4 space-y-1 mt-1">
          {items.map((item) => {
            const ItemIcon = item.icon;
            const itemActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  itemActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <ItemIcon className="h-4 w-4" />
                {item.name}
              </NavLink>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <aside className={sidebarClasses}>
      <div className="flex h-full flex-col">
        {!isMobile && (
          <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
            <div 
              onClick={() => navigate("/")} 
              className="flex items-center justify-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 hover:bg-sidebar-accent/50"
            >
              <img src={cphSalesLogo} alt="CPH Sales" className="h-10 w-auto object-contain" />
            </div>
          </div>
        )}
        
        <nav className="flex-1 space-y-1 p-4 pt-6">
          {/* Main navigation items */}
          {mainItems.map(renderNavItem)}
          
          {/* Personal menu items */}
          {personalItems.map(renderNavItem)}
          
          {/* Personnel submenu */}
          {renderCollapsibleMenu("Personale", Users, personnelItems, personnelOpen, setPersonnelOpen, ["/employees", "/teams"])}
          
          {/* Management submenu */}
          {renderCollapsibleMenu("Ledelse", Crown, managementItems, managementOpen, setManagementOpen, ["/contracts", "/permissions", "/career-wishes-overview"])}
          
          {/* Test submenu */}
          {renderCollapsibleMenu("Test", Shield, testItems, testOpen, setTestOpen, ["/car-quiz-admin", "/code-of-conduct-admin", "/pulse-survey-results"])}
          
          {/* MG submenu */}
          {renderCollapsibleMenu("MG", Percent, mgItems, mgOpen, setMgOpen, ["/payroll", "/tdc-erhverv", "/codan", "/mg-test", "/mg-test-dashboard", "/dialer-data", "/calls-data", "/adversus-data"])}
          
          {/* Shift Planning submenu */}
          {renderCollapsibleMenu("Vagtplan", Calendar, shiftItems, shiftOpen, setShiftOpen, ["/shift-planning", "/extra-work"])}
          
          {/* Vagt Flow submenu */}
          {renderCollapsibleMenu("Fieldmarketing", MapPin, vagtFlowItems, vagtFlowOpen, setVagtFlowOpen, ["/vagt-flow"])}
          
          {/* Recruitment submenu */}
          {renderCollapsibleMenu("Rekruttering", Users, recruitmentItems, recruitmentOpen, setRecruitmentOpen, ["/recruitment"])}
          
          {/* Boards submenu */}
          {renderCollapsibleMenu("Boards", Tv, boardsItems, boardsOpen, setBoardsOpen, ["/boards"])}
          
          {/* Settings */}
          {hasPermission("menu_settings") && (
            <NavLink
              to="/settings"
              onClick={handleNavClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                location.pathname === "/settings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Settings className="h-5 w-5" />
              Indstillinger
            </NavLink>
          )}
        </nav>
      </div>
    </aside>
  );
}
