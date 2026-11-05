// SR2: infoknap + ark »Sådan virker sletteregler« (samme mønster som Beskeders infoark). Ren visning – ingen data, ingen rettigheder.
import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SLETTEREGEL_INFO, SLETTEREGEL_INFO_INDLEDNING, SLETTEREGEL_INFO_KNAP_TEKST } from "./sletteregelInfoTekst";

function erTelefon(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
}

export function SletteregelInfo({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const telefon = erTelefon();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className={cn("h-8 w-8 p-0 max-md:h-11 max-md:w-11", className)} aria-label={SLETTEREGEL_INFO_KNAP_TEKST} title={SLETTEREGEL_INFO_KNAP_TEKST}>
        <Info className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={telefon ? "bottom" : "right"} className={cn("overflow-y-auto", telefon ? "max-h-[85dvh] rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]" : "sm:max-w-md")}>
          <SheetHeader className="text-left">
            <SheetTitle className="pr-12 text-[22px] font-extrabold leading-tight tracking-[-0.02em]">{SLETTEREGEL_INFO_KNAP_TEKST}</SheetTitle>
            <SheetDescription className="text-[15px] leading-[1.5]">{SLETTEREGEL_INFO_INDLEDNING}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {SLETTEREGEL_INFO.map((a) => (
              <section key={a.id} aria-labelledby={`sr-info-${a.id}`} className="rounded-[24px] bg-card p-4">
                <h3 id={`sr-info-${a.id}`} className="text-[15px] font-extrabold text-foreground">{a.titel}</h3>
                <ul className="mt-2 space-y-2 text-[14px] leading-[1.5] text-foreground">
                  {a.punkter.map((p) => <li key={p} className="flex gap-2"><span aria-hidden="true" className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[hsl(var(--cph-emerald))]" /><span>{p}</span></li>)}
                </ul>
              </section>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
