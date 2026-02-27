import { Outlet, NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Receipt, Target, Settings2, List } from "lucide-react";

const navItems = [
  { path: "/economic", label: "Dashboard", icon: LayoutDashboard, end: true },
  { path: "/economic/posteringer", label: "Posteringer", icon: List },
  { path: "/economic/expenses", label: "Udgifter", icon: Receipt },
  { path: "/economic/budget", label: "Budget 2026", icon: Target },
  { path: "/economic/mapping", label: "Mapping", icon: Settings2 },
];

export default function EconomicLayout() {
  const location = useLocation();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <div className="border-b bg-card">
        <div className="container mx-auto">
          <nav className="flex gap-1 p-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.end 
                ? location.pathname === item.path 
                : location.pathname.startsWith(item.path);
              
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
      
      {/* Content */}
      <main className="container mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
