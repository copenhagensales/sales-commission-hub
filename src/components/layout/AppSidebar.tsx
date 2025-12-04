import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, Tv, LogOut, Percent, Shield, Building2, Calendar, MapPin, ChevronDown, ChevronRight, Car, Clock, UserCheck, Receipt, Database, ListChecks, ClipboardList, Timer } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Agenter", href: "/agents", icon: Users },
  { name: "Medarbejdere", href: "/employees", icon: Users },
  { name: "Salg", href: "/sales", icon: ShoppingCart },
  { name: "Codan", href: "/codan", icon: Shield },
  { name: "TDC Erhverv", href: "/tdc-erhverv", icon: Building2 },
  { name: "Provision og CPO", href: "/commission-cpo", icon: Percent },
  { name: "Lønkørsel", href: "/payroll", icon: Wallet },
  { name: "Wallboard", href: "/wallboard", icon: Tv },
  { name: "Datakilder info", href: "/adversus-data", icon: Database },
  { name: "Logikker", href: "/logikker", icon: ListChecks },
  { name: "MG test", href: "/mg-test", icon: Percent },
  { name: "KM test", href: "/km-test", icon: Percent },
];

const vagtFlowNavigation = [
  { name: "Oversigt", href: "/vagt-flow", icon: LayoutDashboard },
  { name: "Min uge", href: "/vagt-flow/min-uge", icon: UserCheck },
  { name: "Book uge", href: "/vagt-flow/book-week", icon: Calendar },
  { name: "Vagtplan", href: "/vagt-flow/bookings", icon: Calendar },
  { name: "Lokationer", href: "/vagt-flow/locations", icon: MapPin },
  { name: "Medarbejdere", href: "/vagt-flow/employees", icon: Users },
  { name: "Fravær", href: "/vagt-flow/time-off", icon: Clock },
  { name: "Køretøjer", href: "/vagt-flow/vehicles", icon: Car },
  { name: "Fakturering", href: "/vagt-flow/billing", icon: Receipt },
];

const shiftPlanningNavigation = [
  { name: "Vagtplan (leder)", href: "/shift-planning", icon: Calendar },
  { name: "Min kalender", href: "/shift-planning/my-schedule", icon: UserCheck },
  { name: "Fravær", href: "/shift-planning/absence", icon: Clock },
  { name: "Tidsregistrering", href: "/shift-planning/time-tracking", icon: Timer },
];

export function AppSidebar() {
  const location = useLocation();
  const { toast } = useToast();
  const [vagtFlowOpen, setVagtFlowOpen] = useState(location.pathname.startsWith("/vagt-flow"));
  const [shiftPlanningOpen, setShiftPlanningOpen] = useState(location.pathname.startsWith("/shift-planning"));

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Fejl ved logout", description: error.message, variant: "destructive" });
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto">
      <div className="flex h-full flex-col">
        <div className="flex h-20 items-center justify-center border-b border-sidebar-border px-6">
          <img src={cphSalesLogo} alt="CPH Sales" className="h-14 w-auto object-contain" />
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            );
          })}

          {/* Vagt-flow menu with submenu */}
          <Collapsible open={vagtFlowOpen} onOpenChange={setVagtFlowOpen}>
            <CollapsibleTrigger className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname.startsWith("/vagt-flow") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5" />
                Vagtplan
              </div>
              {vagtFlowOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-1 mt-1">
              {vagtFlowNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </NavLink>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          {/* Intern Vagtplan menu */}
          <Collapsible open={shiftPlanningOpen} onOpenChange={setShiftPlanningOpen}>
            <CollapsibleTrigger className={cn(
              "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname.startsWith("/shift-planning") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}>
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5" />
                Intern vagtplan
              </div>
              {shiftPlanningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 space-y-1 mt-1">
              {shiftPlanningNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </NavLink>
                );
              })}
            </CollapsibleContent>
          </Collapsible>

          <NavLink
            to="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname === "/settings" ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <Settings className="h-5 w-5" />
            Indstillinger
          </NavLink>
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50">
            <LogOut className="h-5 w-5" />
            Log ud
          </button>
        </div>
      </div>
    </aside>
  );
}
