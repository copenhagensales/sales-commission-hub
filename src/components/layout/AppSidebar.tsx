import { LayoutDashboard, Users, ShoppingCart, Wallet, Settings, Tv, LogOut, Percent, Shield, Building2 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Agenter", href: "/agents", icon: Users },
  { name: "Salg", href: "/sales", icon: ShoppingCart },
  { name: "Codan", href: "/codan", icon: Shield },
  { name: "Provision og CPO", href: "/commission-cpo", icon: Percent },
  { name: "Lønkørsler", href: "/payroll", icon: Wallet },
  { name: "Wallboard", href: "/wallboard", icon: Tv },
  { name: "MG test", href: "/mg-test", icon: Percent },
  { name: "KM test", href: "/km-test", icon: Percent },
  { name: "Indstillinger", href: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Fejl ved logout", description: error.message, variant: "destructive" });
    }
  };

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-sidebar-border bg-sidebar">
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
