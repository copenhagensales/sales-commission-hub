import { describe, it, expect, vi } from "vitest";
import { useRef, useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BeskederInfoIkon, BeskederInfoKnap, BeskederInfoSheet } from "./BeskederInfo";
import { BESKEDER_INFO, BESKEDER_INFO_VERSION, BESKEDER_INFO_KNAP_TEKST, ligeNuTekster } from "./beskederInfoTekst";

/** 24d2 infoknap: ren visning. Ingen netværk. */
describe("BeskederInfo", () => {
  it("knappen åbner arket med alle afsnit og uden driftsblok, når ingen status gives", () => {
    render(<BeskederInfoKnap />);
    expect(screen.queryByText(BESKEDER_INFO_KNAP_TEKST)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: BESKEDER_INFO_KNAP_TEKST }));
    expect(screen.getByRole("heading", { name: BESKEDER_INFO_KNAP_TEKST })).toBeTruthy();
    expect(screen.getByText(/Stork tjekker automatisk hver besked/)).toBeTruthy(); // indledningen forklarer tjekket før afsnittene
    for (const a of BESKEDER_INFO) expect(screen.getByText(a.titel)).toBeTruthy();
    expect(screen.queryByText("Lige nu")).toBeNull();
    expect(screen.getByText(`Version ${BESKEDER_INFO_VERSION}`)).toBeTruthy();
  });

  it("første afsnit er åbent og handler om privatliv", () => {
    render(<BeskederInfoSheet open onOpenChange={() => {}} />);
    expect(BESKEDER_INFO[0].id).toBe("privat");
    expect(screen.getByText("Kun deltagerne i en samtale kan læse den. Det er uændret.")).toBeTruthy();
  });

  it("viser driftsstatus: lukket filvej", () => {
    render(<BeskederInfoSheet open onOpenChange={() => {}} status={{ kendt: true, pause: false, filTilladt: false }} />);
    expect(screen.getByRole("status").textContent).toContain("Filer kan ikke sendes lige nu");
  });

  it("pause først, derefter ukendt status, derefter filvej; åben drift giver ingen blok", () => {
    expect(ligeNuTekster({ kendt: true, pause: true, filTilladt: false })).toEqual(["Beskeder er på pause: du kan læse, men ikke sende. Din kladde bevares."]);
    expect(ligeNuTekster({ kendt: false, pause: false, filTilladt: false })).toEqual(["Driftsstatus kan ikke hentes lige nu. Prøv igen om lidt."]);
    expect(ligeNuTekster({ kendt: true, pause: false, filTilladt: false })).toEqual(["Filer kan ikke sendes lige nu. Tekstbeskeder virker som normalt."]);
    expect(ligeNuTekster({ kendt: true, pause: false, filTilladt: true })).toEqual([]);
    expect(ligeNuTekster(undefined)).toEqual([]);
  });

  it("lukning kaldes via onOpenChange", () => {
    const luk = vi.fn();
    render(<BeskederInfoSheet open onOpenChange={luk} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Luk" }).at(-1)!);  // den tydelige Luk-knap nederst (Mathias 29/10); X øverst findes stadig
    expect(luk).toHaveBeenCalledWith(false);
  });

  it("fokus vender tilbage til åbningsknappen efter Escape", async () => {
    render(<BeskederInfoKnap />);
    const knap = screen.getByRole("button", { name: BESKEDER_INFO_KNAP_TEKST });
    knap.focus();
    fireEvent.click(knap);
    const ark = await screen.findByRole("dialog");
    fireEvent.keyDown(ark, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(knap));
  });

  it("fokus går til det permanente infoikon, når åbneren er forsvundet fra DOM", async () => {
    // Som i ChatView: »Hvorfor?« åbner arket og forsvinder (filvejen åbnes igen), mens arket er åbent.
    function Harness() {
      const [open, setOpen] = useState(false);
      const [visHvorfor, setVisHvorfor] = useState(true);
      const aabner = useRef<HTMLElement | null>(null);
      const ikon = useRef<HTMLButtonElement | null>(null);
      return (
        <>
          <BeskederInfoIkon knapRef={ikon} onClick={(e) => { aabner.current = e.currentTarget; setOpen(true); }} />
          {visHvorfor && <button type="button" onClick={(e) => { aabner.current = e.currentTarget; setOpen(true); setVisHvorfor(false); }}>Hvorfor?</button>}
          <BeskederInfoSheet open={open} onOpenChange={setOpen} returFokus={aabner} reserveFokus={ikon} />
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Hvorfor?" }));
    const ark = await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: "Hvorfor?" })).toBeNull();
    fireEvent.keyDown(ark, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: BESKEDER_INFO_KNAP_TEKST })));
  });
});
