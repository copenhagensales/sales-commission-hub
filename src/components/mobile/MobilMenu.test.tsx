import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  ],
}));
vi.mock("./BottomSheet", () => ({ useSheetNavigate: () => g.go }));
vi.mock("@/hooks/useSidebarMenuConfig", () => ({ useSidebarMenuConfig: () => ({ isLoading: false }) }));
vi.mock("@/hooks/usePositionPermissions", () => ({ usePermissions: () => ({ isLoading: false }) }));

import { MobilMenu } from "./MobilMenu";

describe("MobilMenu", () => {
  it("fliser pr. område uden Mit arbejde; Min profil og Log ud nederst", () => {
    const logud = vi.fn();
    render(<MemoryRouter initialEntries={["/shift-planning"]}><MobilMenu onLogout={logud} badges={{ side_vagtplan: <span>2</span> }} /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Mit team" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Mit arbejde" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Hjem/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Vagtplan/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: /Min profil/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Mit team/ }));
    expect(g.go).toHaveBeenCalledWith("/mit-team");
    fireEvent.click(screen.getByRole("button", { name: "Log ud" }));
    expect(logud).toHaveBeenCalledTimes(1);
  });

  it("søgning finder også Mit arbejde-sider og viser området; intet fund giver besked", () => {
    render(<MemoryRouter><MobilMenu onLogout={() => {}} /></MemoryRouter>);
    const felt = screen.getByRole("searchbox", { name: "Søg i menuen" });
    fireEvent.change(felt, { target: { value: "vagt" } });
    expect(screen.getByRole("button", { name: /Vagter/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Vagtplan/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Mit team" })).toBeNull();
    fireEvent.change(felt, { target: { value: "xyz" } });
    expect(screen.getByText(/Ingen sider matcher/)).toBeTruthy();
  });
});
