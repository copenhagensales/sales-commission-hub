import { useState, useMemo, useEffect } from "react";
import { Copy, Check, Sun, Moon, Type } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  generateSummary,
  type MbbType,
  type NumberChoice,
  type StartupChoice,
  type SummaryVariant,
} from "@/lib/tdcOpsummering/generateSummary";

/**
 * Delt UI for TDC Opsummering.
 * Bruges af både /tdc-opsummering (intern, MainLayout) og /tdc-public (offentlig).
 * Single source of truth — al logik bor her, generator bor i src/lib/tdcOpsummering/.
 */
export function TdcOpsummeringForm() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [fontSize, setFontSize] = useState(16);

  const [summaryVariant, setSummaryVariant] = useState<SummaryVariant>("standard");
  const [isEnglish, setIsEnglish] = useState(false);
  const isPilot = summaryVariant === "pilot";
  const kun5gFriSalg = summaryVariant === "5g-fri";

  const [mbbType, setMbbType] = useState<MbbType>(null);
  const [includeWithoutRouter, setIncludeWithoutRouter] = useState(false);
  const [noMbb, setNoMbb] = useState(false);

  const [numberChoice, setNumberChoice] = useState<NumberChoice | null>(null);
  const [startupChoice, setStartupChoice] = useState<StartupChoice | null>(null);

  const [showRouterWarning, setShowRouterWarning] = useState(false);
  const [subsidyLockedForRouter, setSubsidyLockedForRouter] = useState(false);

  const [hasSubsidy, setHasSubsidy] = useState(false);
  const [noSubsidy, setNoSubsidy] = useState(false);

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

  // Validation
  const isNummervalgMissing = !numberChoice;
  const isOpstartRequired = !isPilot && (numberChoice === "existing" || numberChoice === "mixed");
  const isOpstartMissing = isOpstartRequired && !startupChoice;
  const isMbbMissing = !noMbb && mbbType === null;
  const isTilskudMissing = !noSubsidy && !hasSubsidy;
  const isOmstillingMissing = !noOmstilling && !hasOmstilling;

  const showWarningBanner =
    !kun5gFriSalg &&
    (isNummervalgMissing ||
      isOpstartMissing ||
      isMbbMissing ||
      isTilskudMissing ||
      (!isPilot && isOmstillingMissing));

  const summaryLines = useMemo(
    () =>
      generateSummary({
        isEnglish,
        summaryVariant,
        mbbType,
        includeWithoutRouter,
        numberChoice,
        startupChoice,
        hasSubsidy,
        hasOmstilling,
        isStandardOmstilling,
      }),
    [
      isEnglish,
      summaryVariant,
      mbbType,
      includeWithoutRouter,
      numberChoice,
      startupChoice,
      hasSubsidy,
      hasOmstilling,
      isStandardOmstilling,
    ]
  );

  const summaryText = useMemo(
    () => summaryLines.map((line) => line.text).join("\n"),
    [summaryLines]
  );

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      toast({
        title: isEnglish ? "Copied!" : "Kopieret!",
        description: isEnglish
          ? "The summary text has been copied to the clipboard."
          : "Opsummeringsteksten er kopieret til udklipsholderen.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: isEnglish ? "Error" : "Fejl",
        description: isEnglish
          ? "Could not copy the text. Please try again."
          : "Kunne ikke kopiere teksten. Prøv igen.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column - Input form */}
        <div className="space-y-6">
          {/* Summary variant toggle */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Opsummeringstype</CardTitle>
              <div className="inline-flex items-center bg-muted/30 rounded-full p-1">
                {(
                  [
                    { val: false, label: "DA" },
                    { val: true, label: "EN" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setIsEnglish(opt.val)}
                    className={cn(
                      "px-4 py-1.5 text-sm font-medium rounded-full transition-colors",
                      isEnglish === opt.val
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="inline-flex w-full bg-muted/30 rounded-lg p-1">
                {(
                  [
                    { val: "standard", label: "Standard" },
                    { val: "pilot", label: "Pilot" },
                    { val: "5g-fri", label: "Kun 5g fri salg" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => setSummaryVariant(opt.val)}
                    className={cn(
                      "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                      summaryVariant === opt.val
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
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
                    <Label htmlFor="mobilevoice" className="font-normal cursor-pointer">
                      Mobilevoice som MBB
                    </Label>
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
                    <Label htmlFor="datadelingskort" className="font-normal cursor-pointer">
                      Datadelingskort som MBB
                    </Label>
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
                    <Label htmlFor="noMbb" className="font-normal cursor-pointer">
                      Ingen Mobilt Bredbånd
                    </Label>
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
                    <Label htmlFor="withoutRouter" className="font-normal cursor-pointer">
                      uden router
                    </Label>
                  </div>
                )}
              </div>

              <Separator />

              {/* Number choice */}
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
                    <Label htmlFor="existing" className="font-normal cursor-pointer">
                      Kun eksisterende/reserverede numre
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mixed" id="mixed" />
                    <Label htmlFor="mixed" className="font-normal cursor-pointer">
                      Blanding af eksisterende og nye
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="new" id="new" />
                    <Label htmlFor="new" className="font-normal cursor-pointer">
                      Kun nye numre
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Startup */}
              {!isPilot && (numberChoice === "existing" || numberChoice === "mixed") && (
                <div className="space-y-3">
                  <Label className="font-medium">Opstart *</Label>
                  <RadioGroup
                    value={startupChoice || ""}
                    onValueChange={(val) => setStartupChoice(val as StartupChoice)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="asap" id="asap" />
                      <Label htmlFor="asap" className="font-normal cursor-pointer">
                        Efter binding/opsigelsesperiode
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="specific" id="specific" />
                      <Label htmlFor="specific" className="font-normal cursor-pointer">
                        Med ønskedato
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {!isPilot && (numberChoice === "existing" || numberChoice === "mixed") && <Separator />}

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
                  <Label
                    htmlFor="hasSubsidy"
                    className={`font-normal cursor-pointer ${subsidyLockedForRouter ? "text-muted-foreground" : ""}`}
                  >
                    Tilskud inkluderet
                  </Label>
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
                  <Label
                    htmlFor="noSubsidy"
                    className={`font-normal cursor-pointer ${subsidyLockedForRouter ? "text-muted-foreground" : ""}`}
                  >
                    Intet Tilskud
                  </Label>
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
                      <Label htmlFor="hasOmstilling" className="font-normal cursor-pointer">
                        Omstilling inkluderet
                      </Label>
                    </div>
                    {hasOmstilling && (
                      <div className="ml-6">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="standardOmstilling"
                            checked={isStandardOmstilling}
                            onCheckedChange={(checked) => setIsStandardOmstilling(checked === true)}
                          />
                          <Label htmlFor="standardOmstilling" className="font-normal cursor-pointer">
                            Standard omstilling (kan opgraderes senere)
                          </Label>
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
                      <Label htmlFor="noOmstilling" className="font-normal cursor-pointer">
                        Ingen Omstilling
                      </Label>
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
                {showWarningBanner && (
                  <div className="absolute inset-0 z-10 bg-destructive/95 backdrop-blur-sm rounded-md flex items-center justify-center">
                    <div className="text-destructive-foreground text-center font-bold text-xl p-6">
                      ⚠️ Udfyld venligst:{" "}
                      {[
                        isNummervalgMissing && "Nummervalg",
                        isOpstartMissing && "Opstart",
                        isMbbMissing && "Mobilt Bredbånd",
                        isTilskudMissing && "Tilskud",
                        isOmstillingMissing && "Omstilling",
                      ]
                        .filter(Boolean)
                        .join(", ")}
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
                    <span key={index} className={line.isRed ? "text-red-500 font-semibold" : ""}>
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

      <AlertDialog open={showRouterWarning} onOpenChange={setShowRouterWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vigtigt: Router skal inkluderes</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Når du fjerner "uden router", skal du huske at inkludere en 4G eller 5G router under
              Tilskud-sektionen i de produkter, du har aftalt med kunden.
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
    </>
  );
}
