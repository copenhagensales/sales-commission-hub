import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { RolePreviewBanner } from "./RolePreviewBanner";
import { useRolePreview } from "@/contexts/RolePreviewContext";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import cphSalesLogo from "@/assets/cph-sales-logo.png";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { isPreviewMode } = useRolePreview();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Preview banner at very top */}
      <RolePreviewBanner />
      
      {/* Header with menu trigger */}
      <div className={`fixed left-0 right-0 z-50 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 ${isPreviewMode ? "top-10" : "top-0"}`}>
        <div className="flex items-center gap-4">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary h-12 w-12">
                <Menu className="h-7 w-7" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
              <AppSidebar isMobile onNavigate={() => setSidebarOpen(false)} />
            </SheetContent>
          </Sheet>
          
          <div 
            onClick={() => navigate("/")} 
            className="flex items-center cursor-pointer"
          >
            <img src={cphSalesLogo} alt="CPH Sales" className="h-8 w-auto object-contain" />
          </div>
        </div>
      </div>
      
      {/* Main content - full width, no sidebar margin */}
      <main className={`min-h-screen ${isPreviewMode ? "pt-24" : "pt-14"}`}>
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
