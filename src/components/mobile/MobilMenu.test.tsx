import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home, Target, Calendar, Users, ClipboardList, User } from "lucide-react";

/** D1: Menu-arket viser områder som fliser (uden Mit arbejde), søgning finder alle sider, valg navigerer via arkets go, Log ud kalder tilbage. */
const g = vi.hoisted(() => ({ go: vi.fn() }));
vi.mock("@/components/layout/StrukturMenu", () => ({
  useSynligStruktur: () => [
    { id: "omraade_mit_arbejde", label: "Mit arbejde", ikon: Home, sider: [
      { id: "side_hjem", label: "Hjem", rute: "/home", ikon: Home, synlig: () => true },
      { id: "side_mine_tal", label: "Mine tal", rute: "/my-goals", ikon: Target, synlig: () => true },
      { id: "side_vagter", label: "Vagter", rute: "/vagter", ikon: Calendar, synlig: () => true },
      { id: "side_min_profil", label: "Min profil", rute: "/my-profile", ikon: User, synlig: () => true },
    ] },
    { id: "omraade_mit_team", label: "Mit team", ikon: Users, sider: [
      { id: "side_vagtplan", label: "Vagtplan", rute: "/shift-planning", ikon: ClipboardList, synlig: () => true },
      { id: "side_mit_team", label: "Mit team", rute: "/mit-team", ikon: Users, synlig: () => true },
    ] },
    { id: "omraade_loen", label: "Løn og rapporter", ikon: Users, sider: [
      { id: "side_rapporter", label: "Rapporter", rute: "/reports/admin", ikon: ClipboardList, synlig: () => true },
    ] },
  ],
}));
vi.mock("./BottomSheet", () => ({ useSheetNavigate: () => g.go }));
vi.mock("@/hooks/useSidebarMenuConfig", () => ({ useSidebarMenuConfig: () => ({ isLoading: false }) }));
vi.mock("@/hooks/usePositionPermissions", () => ({ usePermissions: () => ({ isLoading: false, canView: (k: string) => k !== "menu_reports_management" }) }));

import { MobilMenu } from "./MobilMenu";

describe("MobilMenu", () => {
  it("fliser for alle områder (også Mit arbejde) med fane-hint; Min profil og Log ud nederst", () => {
    const logud = vi.fn();
    render(<MemoryRouter initialEntries={["/shift-planning"]}><MobilMenu onLogout={logud} badges={{ side_vagtplan: <span>2</span> }} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Mit team" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mit arbejde" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Hjem/ })).toBeTruthy();
    // Rapporter-flisen viser de første faner, brugeren må se (Ledelsesrapport er skjult af canView)
    expect(screen.getByRole("button", { name: /Rapporter/ }).textContent).toContain("Overblik · Dagsrapporter · +");
    expect(screen.getByRole("button", { name: /Rapporter/ }).textContent).not.toContain("Ledelsesrapport");
    expect(screen.getByRole("button", { name: /Vagtplan/ }).getAttribute("aria-current")).toBe("page");
    expect(within(screen.getByRole("region", { name: "Konto" })).getByRole("button", { name: /Min profil/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Mit team/ }));
    expect(g.go).toHaveBeenCalledWith("/mit-team");
    fireEvent.click(screen.getByRole("button", { name: "Log ud" }));
    expect(logud).toHaveBeenCalledTimes(1);
  });

  it("søgning finder sider og faner (Dagsrapporter → fanens rute), kan ryddes med kryds/Escape; intet fund giver besked", () => {
    render(<MemoryRouter><MobilMenu onLogout={() => {}} /></MemoryRouter>);
    const felt = screen.getByRole("searchbox", { name: "Søg i menuen" });
    fireEvent.change(felt, { target: { value: "vagt" } });
    expect(screen.getByRole("button", { name: /^Vagter/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Vagtplan/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Mit team" })).toBeNull();
    fireEvent.change(felt, { target: { value: "dagsrap" } });
    const fane = screen.getByRole("button", { name: /Dagsrapporter/ });
    expect(fane.textContent).toContain("Løn og rapporter · Rapporter");
    fireEvent.click(fane);
    expect(g.go).toHaveBeenLastCalledWith("/reports/daily");
    fireEvent.change(felt, { target: { value: "ledelsesrap" } });
    expect(screen.getByText(/Ingen sider eller faner matcher/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ryd søgning" }));
    expect((felt as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("heading", { name: "Mit team" })).toBeTruthy();
    fireEvent.change(felt, { target: { value: "x" } }); fireEvent.keyDown(felt, { key: "Escape" });
    expect((felt as HTMLInputElement).value).toBe("");
  });
});
