import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Faner, Pille, Fremdrift, Felt, Indtast } from "./index";

/** D0: ren visning. Faner har tastaturnavigation; Pille bliver link med `til`; Fremdrift klemmer 0–100. */
describe("cph", () => {
  it("Faner: klik og piletaster skifter fane, aria-selected følger med", () => {
    const skift = vi.fn();
    render(<Faner etiket="Visning" vaerdi="a" onSkift={skift} punkter={[{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C", taeller: 3 }]} />);
    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: /^C/ }));
    expect(skift).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(skift).toHaveBeenLastCalledWith("b");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
    expect(skift).toHaveBeenLastCalledWith("c");
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "End" });
    expect(skift).toHaveBeenLastCalledWith("c");
  });

  it("Pille: knap som standard; link med til beholder onClick/aria; deaktiveret link er en deaktiveret knap", () => {
    const klik = vi.fn();
    render(<MemoryRouter><Pille>Gem</Pille><Pille til="/my-goals" onClick={klik} aria-label="Gå til Mine tal">Mine tal</Pille><Pille til="/x" disabled>Lukket</Pille></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Gem" }).getAttribute("type")).toBe("button");
    const link = screen.getByRole("link", { name: "Gå til Mine tal" });
    expect(link.getAttribute("href")).toBe("/my-goals");
    fireEvent.click(link); expect(klik).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Lukket" })).toBeNull();
    expect((screen.getByRole("button", { name: "Lukket" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("Felt kobler hjælp/fejl til feltet via aria-describedby og aria-invalid", () => {
    render(<><Felt id="a" etiket="A" hjaelp="Hjælp A"><Indtast id="a" /></Felt><Felt id="b" etiket="B" fejl="Fejl B"><Indtast id="b" /></Felt></>);
    expect(screen.getByLabelText("A").getAttribute("aria-describedby")).toBe("a-hjaelp");
    expect(screen.getByLabelText("B").getAttribute("aria-describedby")).toBe("b-fejl");
    expect(screen.getByLabelText("B").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").id).toBe("b-fejl");
  });

  it("Fremdrift klemmer til 0–100", () => {
    render(<><Fremdrift andel={140} etiket="a" /><Fremdrift andel={-5} etiket="b" /></>);
    expect(screen.getByRole("progressbar", { name: "a" }).getAttribute("aria-valuenow")).toBe("100");
    expect(screen.getByRole("progressbar", { name: "b" }).getAttribute("aria-valuenow")).toBe("0");
  });
});
