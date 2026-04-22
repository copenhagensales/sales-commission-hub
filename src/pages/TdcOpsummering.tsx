import { useState, useMemo, useEffect } from "react";
import { FileText, Copy, Check, Sun, Moon, Type } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/MainLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SummaryLine {
  text: string;
  isRed?: boolean;
}

type MbbType = "mobilevoice" | "datadelingskort" | null;
type NumberChoice = "existing" | "mixed" | "new";
type StartupChoice = "asap" | "specific";
type SummaryVariant = "standard" | "pilot" | "5g-fri";

export default function TdcOpsummering() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [fontSize, setFontSize] = useState(16);

  // Summary variant toggle
  const [summaryVariant, setSummaryVariant] = useState<SummaryVariant>("standard");
  const [isEnglish, setIsEnglish] = useState(false);
  const isPilot = summaryVariant === "pilot";
  const kun5gFriSalg = summaryVariant === "5g-fri";

  // MBB options
  const [mbbType, setMbbType] = useState<MbbType>(null);
  const [includeWithoutRouter, setIncludeWithoutRouter] = useState(false);
  const [noMbb, setNoMbb] = useState(false);
  
  // Number choice
  const [numberChoice, setNumberChoice] = useState<NumberChoice | null>(null);
  
  // Startup
  const [startupChoice, setStartupChoice] = useState<StartupChoice | null>(null);
  
  // Router warning dialog
  const [showRouterWarning, setShowRouterWarning] = useState(false);
  const [subsidyLockedForRouter, setSubsidyLockedForRouter] = useState(false);
  
  // Subsidy
  const [hasSubsidy, setHasSubsidy] = useState(false);
  const [noSubsidy, setNoSubsidy] = useState(false);
  
  // Omstilling
  const [hasOmstilling, setHasOmstilling] = useState(false);
  const [isStandardOmstilling, setIsStandardOmstilling] = useState(true);
  const [noOmstilling, setNoOmstilling] = useState(true);

  // Default "Ingen Omstilling" when switching to Standard variant if nothing is selected
  useEffect(() => {
    if (summaryVariant === "standard" && !hasOmstilling && !noOmstilling) {
      setNoOmstilling(true);
      setIsStandardOmstilling(true);
    }
  }, [summaryVariant, hasOmstilling, noOmstilling]);

  // Specialsalg - now derived from summaryVariant

  // Validation
  const isNummervalgMissing = !numberChoice;
  const isOpstartRequired = !isPilot && (numberChoice === "existing" || numberChoice === "mixed");
  const isOpstartMissing = isOpstartRequired && !startupChoice;
  
  const isMbbMissing = !noMbb && mbbType === null;
  const isTilskudMissing = !noSubsidy && !hasSubsidy;
  const isOmstillingMissing = !noOmstilling && !hasOmstilling;

  const showWarningBanner = !kun5gFriSalg && (isNummervalgMissing || isOpstartMissing || isMbbMissing || isTilskudMissing || (!isPilot && isOmstillingMissing));

  // Generate summary lines
  const summaryLines = useMemo(() => {
    const lines: SummaryLine[] = [];

    // Kun 5g Fri Salg shortcut
    if (kun5gFriSalg) {
      lines.push({ text: "For at sikre, at der ikke opstår misforståelser, vil jeg lige opsummere aftalen med dig. Jeg skal gøre opmærksom på, at samtalen nu optages." });
      lines.push({ text: "" });
      lines.push({ text: "Aftalen bliver oprettet i (firmanavn) med CVR-nummer (CVR-nummer). Kontaktpersonen er (navn), og det telefonnummer vi benytter, er (telefonnummer)." });
      lines.push({ text: "" });
      lines.push({ text: "Du får (antal + fulde produktnavn + hastighedsbegrænsning) til en månedlig pris på (beløb) kr. ekskl. moms." });
      lines.push({ text: "" });
      lines.push({ text: "Abonnementet har 12 måneders binding og derefter 3 måneders opsigelse. Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår. Vi kan ikke opsige dit nuværende internet for dig, vi anbefaler derfor at du matcher opsigelsen med vores oprettelsesdato der fremgår i ordrebekræftelsen." });
      lines.push({ text: "" });
      lines.push({ text: "Har du nogle spørgsmål til mig?" });
      return lines;
    }

    // 1. Introduction (always)
    lines.push({ text: "For at sikre, at der ikke opstår misforståelser, vil jeg lige opsummere aftalen med dig. Jeg skal gøre opmærksom på, at samtalen nu optages." });
    lines.push({ text: "" });

    // 2. Basic info (always)
    lines.push({ text: "Aftalen bliver oprettet i (firmanavn) med CVR-nummer (CVR-nummer). Kontaktpersonen er (navn), og det telefonnummer vi benytter, er (telefonnummer)." });
    lines.push({ text: "" });

    // 3. Product lines
    lines.push({ text: "Du får (antal + fulde produktnavn + datamængde) til en månedlig pris på (beløb) kr. ekskl. moms." });
    lines.push({ text: "" });

    // 1 - Mobilevoice som MBB
    if (mbbType === "mobilevoice") {
      lines.push({ text: "Der oprettes et mobilt bredbånd gennem et mobilabonnement. Det får et fiktivt nummer, som vil fremgå i din ordrebekræftelse." });
      lines.push({ text: "" });
    }
    if (mbbType === "datadelingskort") {
      lines.push({ text: "Det mobile bredbånd oprettes som et datadelingskort, som deler data med mobilabonnementet/puljen, det er tilknyttet. Derfor står det ikke som et selvstændigt abonnement på fremtidige fakturaer." });
      lines.push({ text: "" });
    }
    if (mbbType && includeWithoutRouter) {
      lines.push({ text: "Der medfølger ikke en router til abonnementet, så du skal selv sørge for en router." });
      lines.push({ text: "" });
    }

    // --- VILKÅR ---
    lines.push({ text: "I er bundet på kontrakten i 36 måneder." });
    lines.push({ text: "" });

    if (isPilot) {
      // Pilot: Vilkår + welcome call + nummervalg in one flow
      lines.push({ text: "Inden for 7 hverdage vil i blive kontaktet af min kollega, som vil byde jer velkommen og få hjulpet med nummeroverflytning." });
      lines.push({ text: "" });

      // Pilot nummervalg
      if (numberChoice === "existing") {
        lines.push({ text: "Vi har snakket om, at det som udgangspunkt er" });
        lines.push({ text: "(antal) eksisterende numre" });
        lines.push({ text: "" });
      } else if (numberChoice === "mixed") {
        lines.push({ text: "Vi har snakket om, at det som udgangspunkt er" });
        lines.push({ text: "(antal) eksisterende numre og (antal) nye numre" });
        lines.push({ text: "" });
      } else if (numberChoice === "new") {
        lines.push({ text: "Vi har snakket om, at det som udgangspunkt er" });
        lines.push({ text: "Udelukkende nye numre der oprettes" });
        lines.push({ text: "" });
      }

      if (numberChoice) {
        lines.push({ text: "Hvilke numre i ønsker, er op til jer, men antallet af abonnementer skal overholdes" });
        lines.push({ text: "" });
      }

      // Pilot opstart - generisk tekst (altid)
      lines.push({ text: "Numrene starter som udgangspunkt op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder." });
      lines.push({ text: "" });

    } else {
      // Standard: nummervalg
      if (numberChoice === "existing") {
        lines.push({ text: "Jeg vil lige bede dig bekræfte, at det er følgende numre, der skal indgå i aftalen: [X, Y, Z]." });
        lines.push({ text: "" });
      } else if (numberChoice === "mixed") {
        lines.push({ text: "Jeg vil lige bede dig bekræfte, at de numre, der skal indgå i aftalen, er [X, Y, Z], og at vi derudover opretter (antal) nye mobilnumre." });
        lines.push({ text: "" });
      } else if (numberChoice === "new") {
        lines.push({ text: "Jeg vil lige bede dig bekræfte, at du ikke ønsker at flytte eksisterende numre med over, og at løsningen derfor udelukkende skal bestå af nye mobilnumre." });
        lines.push({ text: "" });
      }

      // Kun nye numre - startup text
      if (numberChoice === "new") {
        lines.push({ text: "Dine nye numre starter (hurtigst muligt eller på bestemt dato)." });
        lines.push({ text: "" });
      }
      
      // Opsigelse
      if (numberChoice === "existing" || numberChoice === "mixed") {
        lines.push({ text: "Vi opsiger kun de numre, vi har aftalt, bliver overflyttet. Internet og produkter uden et nummer tilkoblet skal du derfor selv opsige." });
        lines.push({ text: "" });
      }
      if (numberChoice === "new") {
        lines.push({ text: "Da vi opretter nye abonnementer opsiger vi derfor intet du måtte have ved andre udbydere." });
        lines.push({ text: "" });
      }

      // Standard opstart
      if (numberChoice === "existing" || numberChoice === "mixed") {
        if (startupChoice === "asap") {
          lines.push({ text: "Numrene starter op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder." });
          lines.push({ text: "" });
        } else if (startupChoice === "specific") {
          lines.push({ text: "Vi har aftalt, at numrene flyttes den (dato). Hvis det ligger før jeres nuværende udbyders bindings- eller opsigelsesperiode, kan de opkræve et gebyr for tidlig udtrædelse." });
          lines.push({ text: "" });
        }
      }

      // Standard: ordrebekr. + tilføj/opsig
      lines.push({ text: "Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår." });
      lines.push({ text: "" });
    }

    // Tilføj/opsig abonnementer (always)
    lines.push({ text: "Det er muligt at tilføje ekstra abonnementer til samme priser som står i kontrakten i hele kontraktperioden. Det er også muligt at opsige abonnementer i perioden med 3 måneders varsel, hvilket muliggør løbende udskiftning af numre og op- og nedgradering af abonnementer, så længe den samlede månedlige pris overholdes." });
    lines.push({ text: "" });

    // Subsidy
    if (hasSubsidy) {
      lines.push({ text: "Du får et tilskud på (beløb), som kan bruges fra kontraktens startdato (dato), hvor det samtidig bliver tilgængeligt i vores selvbetjeningsunivers." });
      lines.push({ text: "" });
      lines.push({ text: "Vi har talt om, at du skal bruge tilskuddet på disse produkter:" });
      lines.push({ text: "" });
      lines.push({ text: "(Nævn produkt og gigabyte, samt deres pris og eventuel resterende egenbetaling - Hvis router nævn også forbindelsestype 4G/5G)", isRed: true });
      lines.push({ text: "" });
      lines.push({ text: "Tilskuddet bruges som rabatkode i vores webshop, hvor vi altid bestræber os på at have lageret fyldt. Jeg kan ikke foretage bestillingen for dig, det gør du selv via shoppen." });
      lines.push({ text: "" });
    }

    // Omstilling
    if (isPilot) {
      lines.push({ text: "I forhold til jeres omstilling og hvordan den skal virke, så er det noget i aftaler med min kollega der ringer og byder jer velkommen." });
      lines.push({ text: "" });
      if (isStandardOmstilling) {
        lines.push({ text: "Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe." });
        lines.push({ text: "" });
      }
    } else if (hasOmstilling) {
      lines.push({ text: "Gennemgå kaldsflow (Når man ringer på hovednummeret, hvad sker der så?) Gennemgå hardware (Hvad for noget udstyr skal kunden bruge til omstillingen)", isRed: true });
      lines.push({ text: "" });
      if (isStandardOmstilling) {
        lines.push({ text: "Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe." });
        lines.push({ text: "" });
      }
    }

    // Closing
    lines.push({ text: "Har du nogle spørgsmål til mig?" });

    return lines;
  }, [
    kun5gFriSalg, isPilot,
    mbbType, includeWithoutRouter, 
    numberChoice,
    startupChoice,
    hasSubsidy,
    hasOmstilling, isStandardOmstilling
  ]);

  // Plain text for copying
  const summaryText = useMemo(() => {
    return summaryLines.map(line => line.text).join("\n");
  }, [summaryLines]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      toast({
        title: "Kopieret!",
        description: "Opsummeringsteksten er kopieret til udklipsholderen.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Fejl",
        description: "Kunne ikke kopiere teksten. Prøv igen.",
        variant: "destructive",
      });
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-7xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">TDC Opsummering</h1>
              <p className="text-muted-foreground">Generer en struktureret opsummeringstekst efter et TDC-salg</p>
            </div>
          </div>
          <div className="inline-flex items-center bg-muted/30 rounded-full p-1">
            {([
              { val: false, label: "DA" },
              { val: true, label: "EN" },
            ] as const).map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setIsEnglish(opt.val)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
                  isEnglish === opt.val
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Input form */}
          <div className="space-y-6">
            {/* Summary variant toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Opsummeringstype</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="inline-flex w-full bg-muted/30 rounded-lg p-1">
                  {([
                    { val: "standard", label: "Standard" },
                    { val: "pilot", label: "Pilot" },
                    { val: "5g-fri", label: "Kun 5g fri salg" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setSummaryVariant(opt.val)}
                      className={cn(
                        "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                        summaryVariant === opt.val
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Conditional blocks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Valgfrie sektioner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* MBB Type */}
                <div className="space-y-3">
                  <Label className="font-medium">MV/Datadelingskort som MBB</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mobilevoice"
                      checked={mbbType === "mobilevoice"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setMbbType("mobilevoice");
                          setIncludeWithoutRouter(true);
                          setNoMbb(false);
                        } else {
                          setMbbType(null);
                          setIncludeWithoutRouter(false);
                        }
                      }}
                    />
                    <Label htmlFor="mobilevoice" className="font-normal cursor-pointer">Mobilevoice som MBB (1)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="datadelingskort"
                      checked={mbbType === "datadelingskort"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setMbbType("datadelingskort");
                          setIncludeWithoutRouter(true);
                          setNoMbb(false);
                        } else {
                          setMbbType(null);
                          setIncludeWithoutRouter(false);
                        }
                      }}
                    />
                    <Label htmlFor="datadelingskort" className="font-normal cursor-pointer">Datadelingskort som MBB (2)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="noMbb"
                      checked={noMbb}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setNoMbb(true);
                          setMbbType(null);
                          setIncludeWithoutRouter(false);
                        } else {
                          setNoMbb(false);
                        }
                      }}
                    />
                    <Label htmlFor="noMbb" className="font-normal cursor-pointer">Ingen Mobilt Bredbånd</Label>
                  </div>
                </div>
                  
                  {mbbType && (
                    <div className="flex items-center space-x-2 ml-6">
                      <Checkbox
                        id="withoutRouter"
                        checked={includeWithoutRouter}
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            setIncludeWithoutRouter(true);
                            setSubsidyLockedForRouter(false);
                          } else {
                            setShowRouterWarning(true);
                          }
                        }}
                      />
                      <Label htmlFor="withoutRouter" className="font-normal cursor-pointer">uden router (3)</Label>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Number choice - MANDATORY */}
                <div className="space-y-3">
                  <Label className="font-medium">Nummervalg *</Label>
                  <RadioGroup 
                    value={numberChoice || ""} 
                    onValueChange={(val) => {
                      setNumberChoice(val as NumberChoice);
                      if (val === "new") {
                        setStartupChoice(null);
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="existing" id="existing" />
                      <Label htmlFor="existing" className="font-normal cursor-pointer">Kun eksisterende/reserverede numre (4)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mixed" id="mixed" />
                      <Label htmlFor="mixed" className="font-normal cursor-pointer">Blanding af eksisterende og nye (5)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="new" id="new" />
                      <Label htmlFor="new" className="font-normal cursor-pointer">Kun nye numre (6)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                {/* Startup - only shown in standard mode when existing/mixed */}
                {!isPilot && (numberChoice === "existing" || numberChoice === "mixed") && (
                  <div className="space-y-3">
                    <Label className="font-medium">Opstart *</Label>
                    <RadioGroup 
                      value={startupChoice || ""} 
                      onValueChange={(val) => setStartupChoice(val as StartupChoice)}
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="asap" id="asap" />
                        <Label htmlFor="asap" className="font-normal cursor-pointer">Efter binding/opsigelsesperiode (7)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="specific" id="specific" />
                        <Label htmlFor="specific" className="font-normal cursor-pointer">Med ønskedato (8)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {!isPilot && (numberChoice === "existing" || numberChoice === "mixed") && (
                  <Separator />
                )}

                {/* Subsidy */}
                <div className="space-y-2">
                  <Label className="font-medium">
                    Tilskud
                    {subsidyLockedForRouter && (
                      <span className="text-amber-600 text-sm ml-2">(låst - router kræver tilskud)</span>
                    )}
                  </Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hasSubsidy" 
                      checked={hasSubsidy}
                      disabled={subsidyLockedForRouter}
                      onCheckedChange={(checked) => {
                        setHasSubsidy(checked === true);
                        if (checked) setNoSubsidy(false);
                      }}
                    />
                    <Label htmlFor="hasSubsidy" className={`font-normal cursor-pointer ${subsidyLockedForRouter ? "text-muted-foreground" : ""}`}>Tilskud inkluderet</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="noSubsidy" 
                      checked={noSubsidy}
                      disabled={subsidyLockedForRouter}
                      onCheckedChange={(checked) => {
                        setNoSubsidy(checked === true);
                        if (checked) setHasSubsidy(false);
                      }}
                    />
                    <Label htmlFor="noSubsidy" className={`font-normal cursor-pointer ${subsidyLockedForRouter ? "text-muted-foreground" : ""}`}>Intet Tilskud</Label>
                  </div>
                </div>

                <Separator />

                {/* Omstilling */}
                <div className="space-y-2">
                  <Label className="font-medium">Omstilling</Label>
                  {isPilot ? (
                    <div className="flex items-center gap-3 pt-1">
                      <span
                        className={cn(
                          "text-sm transition-colors",
                          isStandardOmstilling ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}
                      >
                        Standard
                      </span>
                      <Switch
                        checked={!isStandardOmstilling}
                        onCheckedChange={(checked) => {
                          setIsStandardOmstilling(!checked);
                          setHasOmstilling(true);
                          setNoOmstilling(false);
                        }}
                      />
                      <span
                        className={cn(
                          "text-sm transition-colors",
                          !isStandardOmstilling ? "font-semibold text-foreground" : "text-muted-foreground"
                        )}
                      >
                        Professionel
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="hasOmstilling"
                          checked={hasOmstilling}
                          onCheckedChange={(checked) => {
                            setHasOmstilling(checked === true);
                            if (checked) setNoOmstilling(false);
                          }}
                        />
                        <Label htmlFor="hasOmstilling" className="font-normal cursor-pointer">Omstilling inkluderet</Label>
                      </div>
                      {hasOmstilling && (
                        <div className="ml-6">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="standardOmstilling"
                              checked={isStandardOmstilling}
                              onCheckedChange={(checked) => setIsStandardOmstilling(checked === true)}
                            />
                            <Label htmlFor="standardOmstilling" className="font-normal cursor-pointer">Standard omstilling (kan opgraderes senere)</Label>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="noOmstilling"
                          checked={noOmstilling}
                          onCheckedChange={(checked) => {
                            setNoOmstilling(checked === true);
                            if (checked) {
                              setHasOmstilling(false);
                              setIsStandardOmstilling(true);
                            }
                          }}
                        />
                        <Label htmlFor="noOmstilling" className="font-normal cursor-pointer">Ingen Omstilling</Label>
                      </div>
                    </>
                  )}
                </div>

              </CardContent>
            </Card>
          </div>

          {/* Right column - Generated text */}
          <div className="lg:sticky lg:top-6 h-fit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Genereret opsummering</CardTitle>
                <Button onClick={copyToClipboard} size="sm" variant={copied ? "secondary" : "default"}>
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Kopieret
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Kopier tekst
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  {/* Warning overlay */}
                  {showWarningBanner && (
                    <div className="absolute inset-0 z-10 bg-destructive/95 backdrop-blur-sm rounded-md flex items-center justify-center">
                      <div className="text-destructive-foreground text-center font-bold text-xl p-6">
                        ⚠️ Udfyld venligst: 
                        {[
                          isNummervalgMissing && "Nummervalg",
                          isOpstartMissing && "Opstart",
                          isMbbMissing && "Mobilt Bredbånd",
                          isTilskudMissing && "Tilskud",
                          isOmstillingMissing && "Omstilling"
                        ].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  )}
                  
                  {/* Controls */}
                  <div className="flex items-center justify-between mb-3 p-2 bg-muted/50 rounded-md">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      <Switch checked={!isDarkTheme} onCheckedChange={(v) => setIsDarkTheme(!v)} />
                      <Sun className="h-4 w-4 text-muted-foreground" />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Type className="h-4 w-4 text-muted-foreground" />
                      <Slider 
                        value={[fontSize]} 
                        onValueChange={(val) => setFontSize(val[0])}
                        min={12}
                        max={24}
                        step={1}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground w-12">{fontSize}px</span>
                    </div>
                  </div>

                  <div 
                    className={cn(
                      "min-h-[600px] font-mono p-3 border rounded-md overflow-auto whitespace-pre-wrap",
                      isDarkTheme ? "bg-slate-900 text-white" : "bg-white text-black"
                    )}
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    {summaryLines.map((line, index) => (
                      <span 
                        key={index} 
                        className={line.isRed ? "text-red-500 font-semibold" : ""}
                      >
                        {line.text}
                        {index < summaryLines.length - 1 && "\n"}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog open={showRouterWarning} onOpenChange={setShowRouterWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vigtigt: Router skal inkluderes</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Når du fjerner "uden router", skal du huske at inkludere en 4G eller 5G router under Tilskud-sektionen i de produkter, du har aftalt med kunden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setIncludeWithoutRouter(false);
                setShowRouterWarning(false);
                setHasSubsidy(true);
                setNoSubsidy(false);
                setSubsidyLockedForRouter(true);
              }}
            >
              Jeg har forstået
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
