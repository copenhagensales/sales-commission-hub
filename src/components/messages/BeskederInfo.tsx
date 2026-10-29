// 24d2: infoknap + ark »Sådan virker Beskeder«. Ren visning – ingen data, ingen rettigheder.
import { useRef, useState, type MouseEvent, type Ref, type RefObject } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { BESKEDER_INFO, BESKEDER_INFO_VERSION, BESKEDER_INFO_KNAP_TEKST, ligeNuTekster, type BeskederInfoStatus } from "./beskederInfoTekst";

/** Telefon → ark fra bunden; ellers panel fra højre. Læses ved hver visning; uden matchMedia (prøver) → panel. */
function erTelefon(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
}

export function BeskederInfoIkon({ onClick, className, knapRef }: { onClick: (e: MouseEvent<HTMLButtonElement>) => void; className?: string; knapRef?: Ref<HTMLButtonElement> }) {
  return (
    <Button ref={knapRef} variant="ghost" size="sm" onClick={onClick} className={cn("h-8 w-8 p-0 max-md:h-11 max-md:w-11", className)}
      aria-label={BESKEDER_INFO_KNAP_TEKST} title={BESKEDER_INFO_KNAP_TEKST}>
      <Info className="h-4 w-4" />
    </Button>
  );
}

/**
 * Arket åbnes uden SheetTrigger (flere åbningsknapper deler ét ark). Radix flytter ellers fokus til en manglende trigger ved lukning,
 * så fokus gives tilbage til den knap, der åbnede (returFokus). Er den forsvundet fra DOM imens (fx »Hvorfor?« efter at filvejen
 * er åbnet igen), bruges det permanente infoikon (reserveFokus).
 */
export function BeskederInfoSheet({ open, onOpenChange, status, returFokus, reserveFokus }: {
  open: boolean; onOpenChange: (open: boolean) => void; status?: BeskederInfoStatus;
  returFokus?: RefObject<HTMLElement | null>; reserveFokus?: RefObject<HTMLElement | null>;
}) {
  const telefon = erTelefon();
  const ligeNu = ligeNuTekster(status);
  const fokusTilbage = (e: Event) => {
    const aabner = returFokus?.current;
    const maal = aabner && aabner.isConnected ? aabner : reserveFokus?.current;
    if (maal && maal.isConnected) { e.preventDefault(); maal.focus(); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={telefon ? "bottom" : "right"}
        className={cn("overflow-y-auto", telefon ? "max-h-[85dvh] rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]" : "sm:max-w-md")}
        onCloseAutoFocus={fokusTilbage}>
        <SheetHeader className="text-left">
          <SheetTitle>{BESKEDER_INFO_KNAP_TEKST}</SheetTitle>
          <SheetDescription>Tjek, slettefrister og filer i Storkbook Beskeder.</SheetDescription>
        </SheetHeader>
        {ligeNu.length > 0 && (
          <div role="status" className="mt-3 rounded-lg border border-border bg-card p-3 text-[14px] text-card-foreground">
            <p className="font-medium">Lige nu</p>
            {ligeNu.map((t) => <p key={t} className="mt-1">{t}</p>)}
          </div>
        )}
        <Accordion type="multiple" defaultValue={[BESKEDER_INFO[0].id]} className="mt-2">
          {BESKEDER_INFO.map((a) => (
            <AccordionItem key={a.id} value={a.id}>
              <AccordionTrigger className="min-h-11 py-3 text-left text-[15px] font-medium">{a.titel}</AccordionTrigger>
              <AccordionContent>
                <ul className="list-disc space-y-2 pl-5 text-[14px] text-foreground">
                  {a.punkter.map((p) => <li key={p}>{p}</li>)}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <p className="mt-4 text-xs text-muted-foreground">Version {BESKEDER_INFO_VERSION}</p>
      </SheetContent>
    </Sheet>
  );
}

/** Selvstændig knap med eget ark (til sidehovedet, hvor der ingen driftsstatus er). */
export function BeskederInfoKnap({ status, className }: { status?: BeskederInfoStatus; className?: string }) {
  const [open, setOpen] = useState(false);
  const knap = useRef<HTMLButtonElement | null>(null);
  return (
    <>
      <BeskederInfoIkon knapRef={knap} onClick={() => setOpen(true)} className={className} />
      <BeskederInfoSheet open={open} onOpenChange={setOpen} status={status} returFokus={knap} />
    </>
  );
}
