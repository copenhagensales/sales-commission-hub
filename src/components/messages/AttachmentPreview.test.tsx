import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AttachmentPreview, kanMiniature, MINIATURE_MAKS_BYTES, type LokalFil } from "./AttachmentPreview";

afterEach(() => cleanup());
const fil = (size: number, type = "image/png"): LokalFil => ({
  file: null, name: "a.png", type, size, previewUrl: "blob:x", uploader: false, trin: "uploadet", sti: "s",
});

describe("B2-6A §A miniature ≤ 200 KB", () => {
  it("grænsen er 200 KB", () => {
    expect(MINIATURE_MAKS_BYTES).toBe(204800);
    expect(kanMiniature({ type: "image/jpeg", size: 204800 })).toBe(true);
    expect(kanMiniature({ type: "image/jpeg", size: 204801 })).toBe(false);
    expect(kanMiniature({ type: "application/pdf", size: 10 })).toBe(false);
  });
  it("større original vises ikke som miniature, selv med previewUrl", () => {
    render(<AttachmentPreview fil={fil(MINIATURE_MAKS_BYTES + 1)} onRemove={() => {}} />);
    expect(screen.queryByRole("img")).toBeNull();
  });
  it("lille billede vises som miniature", () => {
    render(<AttachmentPreview fil={fil(1000)} onRemove={() => {}} />);
    expect(screen.getByRole("img").getAttribute("src")).toBe("blob:x");
  });
});
