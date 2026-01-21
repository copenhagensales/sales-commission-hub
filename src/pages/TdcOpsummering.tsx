import { useState, useMemo } from "react";
import { FileText, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/MainLayout";

interface SummaryLine {
  text: string;
  isRed?: boolean;
}

type MbbType = "mobilevoice" | "datadelingskort" | null;
type NumberChoice = "existing" | "mixed" | "new";
type StartupChoice = "asap" | "specific";

export default function TdcOpsummering() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Customer data and product lines removed - using static placeholders in summary

  // MBB options (1 and 2 - only one can be selected)
  const [mbbType, setMbbType] = useState<MbbType>(null);
  const [includeWithoutRouter, setIncludeWithoutRouter] = useState(false); // Option 3 - datadelingskort
  const [noMbb, setNoMbb] = useState(false);
  
  // Number choice (4, 5, 6 - one MUST be selected)
  const [numberChoice, setNumberChoice] = useState<NumberChoice | null>(null);
  
  // Startup (7, 8 - one MUST be selected)
  const [startupChoice, setStartupChoice] = useState<StartupChoice | null>(null);
  
  // Subsidy
  const [hasSubsidy, setHasSubsidy] = useState(false);
  const [noSubsidy, setNoSubsidy] = useState(false);
  
  // Omstilling (13, 14)
  const [hasOmstilling, setHasOmstilling] = useState(false);
  const [isStandardOmstilling, setIsStandardOmstilling] = useState(true);
  const [noOmstilling, setNoOmstilling] = useState(false);

  // Validation for required fields
  const isNummervalgMissing = !numberChoice;
  const isOpstartRequired = numberChoice === "existing" || numberChoice === "mixed";
  const isOpstartMissing = isOpstartRequired && !startupChoice;
  
  // Nye valideringer - brugeren skal aktivt vælge enten tjenesten ELLER "ingen"
  const isMbbMissing = !noMbb && mbbType === null;
  const isTilskudMissing = !noSubsidy && !hasSubsidy;
  const isOmstillingMissing = !noOmstilling && !hasOmstilling;

  const showWarningBanner = isNummervalgMissing || isOpstartMissing || isMbbMissing || isTilskudMissing || isOmstillingMissing;

  // Generate summary lines with formatting info
  const summaryLines = useMemo(() => {
    const lines: SummaryLine[] = [];

    // 1. Introduction (always)
    lines.push({ text: "For at sikre, at der ikke opstår misforståelser, vil jeg lige opsummere aftalen med dig. Jeg skal gøre opmærksom på, at samtalen nu optages." });
    lines.push({ text: "" });

    // 2. Basic info (always)
    lines.push({ text: "Aftalen bliver oprettet i (firmanavn) med CVR-nummer (CVR-nummer). Kontaktpersonen er (navn), og det telefonnummer vi benytter, er (telefonnummer)." });
    lines.push({ text: "" });

    // 3. Product lines - static placeholder
    lines.push({ text: "Du får (antal + fulde produktnavn + datamængde) til en månedlig pris på (beløb) kr. ekskl. moms." });
    lines.push({ text: "" });

    // 1 - Mobilevoice som MBB
    if (mbbType === "mobilevoice") {
      lines.push({ text: "Der oprettes et mobilt bredbånd gennem et mobilabonnement. Det får et fiktivt nummer, som vil fremgå i din ordrebekræftelse." });
      lines.push({ text: "" });
    }
    
    // 2 - Datadelingskort som MBB
    if (mbbType === "datadelingskort") {
      lines.push({ text: "Det mobile bredbånd oprettes som et datadelingskort, som deler data med mobilabonnementet/puljen, det er tilknyttet. Derfor står det ikke som et selvstændigt abonnement på fremtidige fakturaer." });
      lines.push({ text: "" });
    }
    
    // 3 - uden router (kun hvis et af ovenstående er valgt)
    if (mbbType && includeWithoutRouter) {
      lines.push({ text: "Der medfølger ikke en router til abonnementet, så du skal selv sørge for en router." });
      lines.push({ text: "" });
    }

    // 4, 5, 6 - Number choice
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

    // 9 - Kun hvis "Kun nye numre" (option 6) er valgt
    if (numberChoice === "new") {
      lines.push({ text: "Dine nye numre starter (hurtigst muligt eller på bestemt dato)." });
      lines.push({ text: "" });
    }
    
    // 10 - Opsigelse af eksisterende (kun hvis 4 eller 5 er valgt)
    if (numberChoice === "existing" || numberChoice === "mixed") {
      lines.push({ text: "Vi opsiger kun de numre, vi har aftalt, bliver overflyttet. Internet og produkter uden et nummer tilkoblet skal du derfor selv opsige." });
      lines.push({ text: "" });
    }
    
    // 11 - Opsigelse ved nyoprettelser (kun hvis 6 er valgt)
    if (numberChoice === "new") {
      lines.push({ text: "Da vi opretter nye abonnementer opsiger vi derfor intet du måtte have ved andre udbydere." });
      lines.push({ text: "" });
    }

    // Binding terms (always included)
    lines.push({ text: "I er bundet på kontrakten i 36 måneder." });
    lines.push({ text: "" });

    // 7 or 8 - Startup (KUN hvis eksisterende/mixed numre - aldrig sammen med punkt 9)
    if (numberChoice === "existing" || numberChoice === "mixed") {
      if (startupChoice === "asap") {
        lines.push({ text: "Numrene starter op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder." });
        lines.push({ text: "" });
      } else if (startupChoice === "specific") {
        lines.push({ text: "Vi har aftalt, at numrene flyttes den (dato). Hvis det ligger før jeres nuværende udbyders bindings- eller opsigelsesperiode, kan de opkræve et gebyr for tidlig udtrædelse." });
        lines.push({ text: "" });
      }
    }

    // Order confirmation (always included)
    lines.push({ text: "Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår." });
    lines.push({ text: "" });

    // Add/remove subscriptions (always included)
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

    // 13, 14 - Omstilling
    if (hasOmstilling) {
      lines.push({ text: "Gennemgå kaldsflow (Når man ringer på hovednummeret, hvad sker der så?) Gennemgå hardware (Hvad for noget udstyr skal kunden bruge til omstillingen)", isRed: true });
      lines.push({ text: "" });
      
      if (isStandardOmstilling) {
        lines.push({ text: "Hvis du får brug for menuvalg i fremtiden, så kan du altid opgradere din omstilling." });
        lines.push({ text: "" });
      }
    }

    // Closing (always)
    lines.push({ text: "Har du nogle spørgsmål til mig?" });

    return lines;
  }, [
    mbbType, includeWithoutRouter, 
    numberChoice,
    startupChoice,
    hasSubsidy,
    hasOmstilling, isStandardOmstilling
  ]);

  // Plain text version for copying
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
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">TDC Opsummering</h1>
            <p className="text-muted-foreground">Generer en struktureret opsummeringstekst efter et TDC-salg</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - Input form */}
          <div className="space-y-6">
            {/* Conditional blocks */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Valgfrie sektioner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* MBB Type (1 and 2) */}
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
                  
                  {/* Option 3 - Datadelingskort (only available if 1 or 2 is selected) */}
                  {mbbType && (
                    <div className="flex items-center space-x-2 ml-6">
                      <Checkbox
                        id="withoutRouter"
                        checked={includeWithoutRouter}
                        onCheckedChange={(checked) => setIncludeWithoutRouter(checked === true)}
                      />
                      <Label htmlFor="withoutRouter" className="font-normal cursor-pointer">uden router (3)</Label>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Number choice (4, 5, 6) - MANDATORY */}
                <div className="space-y-3">
                  <Label className="font-medium">Nummervalg *</Label>
                  <RadioGroup 
                    value={numberChoice || ""} 
                    onValueChange={(val) => {
                      setNumberChoice(val as NumberChoice);
                      // Nulstil startup valg hvis "kun nye numre" vælges
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

                {/* Binding */}

                <Separator />

                {/* Startup (7, 8) - Kun relevant når der flyttes numre (4 eller 5) */}
                {(numberChoice === "existing" || numberChoice === "mixed") && (
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

                <Separator />

                <Separator />

                {/* Subsidy */}
                <div className="space-y-2">
                  <Label className="font-medium">Tilskud</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hasSubsidy" 
                      checked={hasSubsidy}
                      onCheckedChange={(checked) => {
                        setHasSubsidy(checked === true);
                        if (checked) setNoSubsidy(false);
                      }}
                    />
                    <Label htmlFor="hasSubsidy" className="font-normal cursor-pointer">Tilskud inkluderet</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="noSubsidy" 
                      checked={noSubsidy}
                      onCheckedChange={(checked) => {
                        setNoSubsidy(checked === true);
                        if (checked) setHasSubsidy(false);
                      }}
                    />
                    <Label htmlFor="noSubsidy" className="font-normal cursor-pointer">Intet Tilskud</Label>
                  </div>
                </div>

                <Separator />

                {/* Omstilling (13, 14) */}
                <div className="space-y-2">
                  <Label className="font-medium">Omstilling</Label>
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
                  {/* Warning overlay - covers the summary text */}
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
                  <div className="min-h-[600px] font-mono text-sm p-3 border rounded-md bg-background overflow-auto whitespace-pre-wrap">
                    {summaryLines.map((line, index) => (
                      <span 
                        key={index} 
                        className={line.isRed ? "text-red-600 font-semibold" : ""}
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
    </MainLayout>
  );
}
