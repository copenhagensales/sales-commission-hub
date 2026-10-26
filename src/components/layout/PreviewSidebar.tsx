import { useNavigate } from "react-router-dom";
import cphSalesLogo from "@/assets/cph-sales-logo.png";
import { StrukturMenu, useSynligStruktur } from "./StrukturMenu";
import { MIT_ARBEJDE } from "@/config/struktur";

interface PreviewSidebarProps {
  isMobile?: boolean;
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

/** Rolle-forhåndsvisning: samme menu som AppSidebar (STRUKTUR), med den forhåndsviste rolles rettigheder. */
export function PreviewSidebar({ isMobile = false, onNavigate }: PreviewSidebarProps) {
  const navigate = useNavigate();
  // Respekterer sidebar_menu_config (skjul/label) og samme synlighed som de øvrige punkter.
  const profil = useSynligStruktur().flatMap((o) => o.sider).find((sd) => sd.id === "side_min_profil");
  const top = isMobile && profil ? [profil] : [];
  const sidebarClasses = isMobile
    ? "h-full w-full bg-sidebar overflow-y-auto pt-safe pb-safe"
    : "fixed left-0 top-10 z-40 h-[calc(100vh-40px)] w-64 border-r border-sidebar-border bg-sidebar overflow-y-auto";

  return (
    <aside className={sidebarClasses}>
      <div className="flex h-full flex-col">
        {!isMobile && (
          <div className="flex h-24 items-center justify-center border-b border-sidebar-border px-4">
            <div onClick={() => navigate("/")}
              className="flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 transition-all duration-200 hover:bg-sidebar-accent/50">
              <img src={cphSalesLogo} alt="CPH Sales" className="h-20 w-auto object-contain" />
            </div>
          </div>
        )}
        <nav className="flex-1 space-y-1 p-4 pt-6">
          <StrukturMenu onNavigate={isMobile ? onNavigate : undefined} udelad={isMobile ? [MIT_ARBEJDE] : []} top={top} />
        </nav>
      </div>
    </aside>
  );
}
