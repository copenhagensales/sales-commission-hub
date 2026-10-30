import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { grupperKommentarer } from "./kommentarTraad";
import { renderTekstMedLinks, FoersteLink } from "./tekstMedLinks";

describe("S8 tråde og links", () => {
  it("grupperer svar under deres topkommentar, ældste først; forældreløse svar bliver topkommentarer", () => {
    const g = grupperKommentarer([
      { id: "c", parentId: "a", createdAt: "2026-10-30T10:02:00Z" },
      { id: "a", parentId: null, createdAt: "2026-10-30T10:00:00Z" },
      { id: "b", parentId: null, createdAt: "2026-10-30T10:01:00Z" },
      { id: "d", parentId: "a", createdAt: "2026-10-30T10:01:30Z" },
      { id: "e", parentId: "væk", createdAt: "2026-10-30T10:03:00Z" },
    ]);
    expect(g.map((x) => x.top.id)).toEqual(["a", "b", "e"]);
    expect(g[0].svar.map((s) => s.id)).toEqual(["d", "c"]);
    expect(g[1].svar).toEqual([]);
  });

  it("gør links klikbare og bevarer omtaler; første link får forhåndsvisning", () => {
    render(<p>{renderTekstMedLinks("Se @Emil N. her https://example.com/menu og https://b.dk", [{ navn: "Emil N.", id: "x" } as never])}</p>);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual(["https://example.com/menu", "https://b.dk"]);
    expect(screen.getByText("@Emil N.")).toBeTruthy();
    cleanup();
    render(<FoersteLink body="tekst https://example.com/menu mere" />);
    expect(screen.getByRole("link", { name: /example.com/ }).getAttribute("href")).toBe("https://example.com/menu");
  });
});
