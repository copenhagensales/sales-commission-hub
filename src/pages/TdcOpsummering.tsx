import { useState, useMemo } from "react";
import { FileText, Plus, Trash2, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/MainLayout";

interface ProductLine {
  id: string;
  quantity: string;
  productName: string;
  dataAmount: string;
  monthlyPrice: string;
}

type MbbType = "mobile_voice" | "datadelingskort" | null;
type NumberChoice = "existing" | "mixed" | "new" | null;
type StartupChoice = "after_binding" | "wish_date" | null;

export default function TdcOpsummering() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Customer data
  const [companyName, setCompanyName] = useState("");
  const [cvr, setCvr] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // Product lines
  const [productLines, setProductLines] = useState<ProductLine[]>([
    { id: crypto.randomUUID(), quantity: "", productName: "", dataAmount: "", monthlyPrice: "" }
  ]);

  // Conditional blocks
  const [includeMbb, setIncludeMbb] = useState(false);
  const [mbbType, setMbbType] = useState<MbbType>(null);
  const [withoutRouter, setWithoutRouter] = useState(false);
  
  const [includeNumberChoice, setIncludeNumberChoice] = useState(false);
  const [numberChoice, setNumberChoice] = useState<NumberChoice>(null);
  const [existingNumbers, setExistingNumbers] = useState("");
  const [newNumberCount, setNewNumberCount] = useState("");
  
  const [includeBinding, setIncludeBinding] = useState(false);
  
  const [includeStartup, setIncludeStartup] = useState(false);
  const [startupChoice, setStartupChoice] = useState<StartupChoice>(null);
  const [wishDate, setWishDate] = useState("");
  
  const [includeOrderConfirmation, setIncludeOrderConfirmation] = useState(false);
  const [includeCancellation, setIncludeCancellation] = useState(false);
  const [includeAddRemove, setIncludeAddRemove] = useState(false);
  
  const [hasSubsidy, setHasSubsidy] = useState(false);
  const [subsidyAmount, setSubsidyAmount] = useState("");
  const [subsidyStartDate, setSubsidyStartDate] = useState("");
  const [subsidyProducts, setSubsidyProducts] = useState("");
  
  const [hasOmstilling, setHasOmstilling] = useState(false);
  const [isStandardOmstilling, setIsStandardOmstilling] = useState(true);

  const addProductLine = () => {
    setProductLines([
      ...productLines,
      { id: crypto.randomUUID(), quantity: "", productName: "", dataAmount: "", monthlyPrice: "" }
    ]);
  };

  const removeProductLine = (id: string) => {
    if (productLines.length > 1) {
      setProductLines(productLines.filter(p => p.id !== id));
    }
  };

  const updateProductLine = (id: string, field: keyof ProductLine, value: string) => {
    setProductLines(productLines.map(p => 
      p.id === id ? { ...p, [field]: value } : p
    ));
  };

  // Generate summary text
  const summaryText = useMemo(() => {
    const lines: string[] = [];

    // 1. Introduction (always)
    lines.push("For at sikre, at der ikke opstår misforståelser, vil jeg lige opsummere aftalen med dig. Jeg skal gøre opmærksom på, at samtalen nu optages.");
    lines.push("");

    // 2. Basic info (always)
    lines.push(`Aftalen bliver oprettet i ${companyName || "(firmanavn)"} med CVR-nummer ${cvr || "(CVR-nummer)"}. Kontaktpersonen er ${contactName || "(navn)"}, og det telefonnummer vi benytter, er ${contactPhone || "(telefonnummer)"}.`);
    lines.push("");

    // 3. Product lines
    const validProducts = productLines.filter(p => p.quantity || p.productName || p.dataAmount || p.monthlyPrice);
    if (validProducts.length > 0) {
      validProducts.forEach(p => {
        lines.push(`Du får ${p.quantity || "(antal)"} ${p.productName || "(produktnavn)"} ${p.dataAmount || "(datamængde)"} til en månedlig pris på ${p.monthlyPrice || "(beløb)"} kr. ekskl. moms.`);
      });
      lines.push("");
    }

    // 4. MBB type
    if (includeMbb && mbbType === "mobile_voice") {
      lines.push("Der oprettes et mobilt bredbånd gennem et mobilabonnement. Det får et fiktivt nummer, som vil fremgå i din ordrebekræftelse.");
      lines.push("");
    } else if (includeMbb && mbbType === "datadelingskort") {
      lines.push("Du får et datadelingskort, som deler data med dit hovedabonnement.");
      lines.push("");
    }
    
    // Without router
    if (withoutRouter) {
      lines.push("Der medfølger ikke en router til abonnementet, så du skal selv sørge for en router.");
      lines.push("");
    }

    // 5. Number choice
    if (includeNumberChoice) {
      if (numberChoice === "existing") {
        lines.push(`Jeg vil lige bede dig bekræfte, at det er følgende numre, der skal indgå i aftalen: ${existingNumbers || "[X, Y, Z]"}.`);
        lines.push("");
      } else if (numberChoice === "mixed") {
        lines.push(`Jeg vil lige bede dig bekræfte, at de numre, der skal indgå i aftalen, er ${existingNumbers || "[X, Y, Z]"}, og at vi derudover opretter ${newNumberCount || "(antal)"} nye mobilnumre.`);
        lines.push("");
      } else if (numberChoice === "new") {
        lines.push("Jeg vil lige bede dig bekræfte, at du ikke ønsker at flytte eksisterende numre med over, og at løsningen derfor udelukkende skal bestå af nye mobilnumre.");
        lines.push("");
      }
    }

    // 6. Binding terms
    if (includeBinding) {
      lines.push("I er bundet på kontrakten i 36 måneder.");
      lines.push("");
    }

    // 7. Startup
    if (includeStartup) {
      if (startupChoice === "after_binding") {
        lines.push("Numrene starter op, når bindingen og opsigelsesperioden hos jeres nuværende udbyder udløber. Vi bestræber os på en samlet opstart, men datoerne for nummerflytning afhænger af jeres nuværende udbyder.");
        lines.push("");
      } else if (startupChoice === "wish_date") {
        lines.push(`Vi har aftalt, at numrene flyttes den ${wishDate || "(dato)"}. Hvis det ligger før jeres nuværende udbyders bindings- eller opsigelsesperiode, kan de opkræve et gebyr for tidlig udtrædelse.`);
        lines.push("");
      }
    }

    // 8. Order confirmation
    if (includeOrderConfirmation) {
      lines.push("Du modtager en ordrebekræftelse inden for 14 dage, hvori opstartsdatoerne fremgår.");
      lines.push("");
    }

    // 9. Cancellation
    if (includeCancellation) {
      lines.push("Vi opsiger kun de numre, vi har aftalt, bliver overflyttet. Internet og produkter uden et nummer tilkoblet skal du derfor selv opsige.");
      lines.push("");
    }

    // 10. Add/remove subscriptions
    if (includeAddRemove) {
      lines.push("Det er muligt at tilføje ekstra abonnementer til samme priser som står i kontrakten i hele kontraktperioden. Det er også muligt at opsige abonnementer i perioden med 3 måneders varsel, hvilket muliggør løbende udskiftning af numre og op- og nedgradering af abonnementer, så længe den samlede månedlige pris overholdes.");
      lines.push("");
    }

    // 11. Subsidy
    if (hasSubsidy && subsidyAmount) {
      lines.push(`Du får et tilskud på ${subsidyAmount}, som kan bruges fra kontraktens startdato ${subsidyStartDate || "(dato)"}, hvor det samtidig bliver tilgængeligt i vores selvbetjeningsunivers.`);
      lines.push("");
      
      if (subsidyProducts) {
        lines.push("Vi har talt om, at du skal bruge tilskuddet på disse produkter:");
        lines.push("");
        lines.push(subsidyProducts);
        lines.push("");
      }
      
      lines.push("Tilskuddet bruges som rabatkode i vores webshop, hvor vi altid bestræber os på at have lageret fyldt. Jeg kan ikke foretage bestillingen for dig, det gør du selv via shoppen.");
      lines.push("");
    }

    // 12. Omstilling
    if (hasOmstilling) {
      if (isStandardOmstilling) {
        lines.push("Hvis du får brug for menuvalg i fremtiden, så kan du altid opgradere din omstilling.");
      } else {
        lines.push("Din omstilling inkluderer menuvalg og avanceret kaldsflow.");
      }
      lines.push("");
    }

    // 13. Closing (always)
    lines.push("Har du nogle spørgsmål til mig?");

    return lines.join("\n");
  }, [
    companyName, cvr, contactName, contactPhone, productLines,
    includeMbb, mbbType, withoutRouter, 
    includeNumberChoice, numberChoice, existingNumbers, newNumberCount,
    includeBinding,
    includeStartup, startupChoice, wishDate,
    includeOrderConfirmation, includeCancellation, includeAddRemove,
    hasSubsidy, subsidyAmount, subsidyStartDate, subsidyProducts,
    hasOmstilling, isStandardOmstilling
  ]);

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
            {/* Customer data */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Kundeoplysninger</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Firmanavn</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="CPH Sales ApS"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvr">CVR-nummer</Label>
                    <Input
                      id="cvr"
                      value={cvr}
                      onChange={(e) => setCvr(e.target.value)}
                      placeholder="12345678"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Kontaktperson</Label>
                    <Input
                      id="contactName"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Telefonnummer</Label>
                    <Input
                      id="contactPhone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="12 34 56 78"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product lines */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Produkter</CardTitle>
                <Button variant="outline" size="sm" onClick={addProductLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Tilføj produkt
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {productLines.map((product, index) => (
                  <div key={product.id} className="space-y-3 p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Produkt {index + 1}</span>
                      {productLines.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => removeProductLine(product.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Antal</Label>
                        <Input
                          value={product.quantity}
                          onChange={(e) => updateProductLine(product.id, "quantity", e.target.value)}
                          placeholder="3 stk."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Produktnavn</Label>
                        <Input
                          value={product.productName}
                          onChange={(e) => updateProductLine(product.id, "productName", e.target.value)}
                          placeholder="TDC Erhverv Mobil L"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Datamængde</Label>
                        <Input
                          value={product.dataAmount}
                          onChange={(e) => updateProductLine(product.id, "dataAmount", e.target.value)}
                          placeholder="med 50 GB"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Månedspris (ekskl. moms)</Label>
                        <Input
                          value={product.monthlyPrice}
                          onChange={(e) => updateProductLine(product.id, "monthlyPrice", e.target.value)}
                          placeholder="199"
                        />
                      </div>
                    </div>
                  </div>
                ))}
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
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="includeMbb" 
                      checked={includeMbb}
                      onCheckedChange={(checked) => setIncludeMbb(checked === true)}
                    />
                    <Label htmlFor="includeMbb" className="font-medium cursor-pointer">Mobilt Bredbånd (MBB)</Label>
                  </div>
                  {includeMbb && (
                    <div className="ml-6 space-y-3">
                      <RadioGroup 
                        value={mbbType || ""} 
                        onValueChange={(val) => setMbbType(val as MbbType || null)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mobile_voice" id="mobile_voice" />
                          <Label htmlFor="mobile_voice" className="font-normal cursor-pointer">Mobile Voice (fiktivt nummer)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="datadelingskort" id="datadelingskort" />
                          <Label htmlFor="datadelingskort" className="font-normal cursor-pointer">Datadelingskort</Label>
                        </div>
                      </RadioGroup>
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="withoutRouter" 
                          checked={withoutRouter}
                          onCheckedChange={(checked) => setWithoutRouter(checked === true)}
                        />
                        <Label htmlFor="withoutRouter" className="font-normal cursor-pointer">Uden router (kunden har egen)</Label>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Number choice */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="includeNumberChoice" 
                      checked={includeNumberChoice}
                      onCheckedChange={(checked) => setIncludeNumberChoice(checked === true)}
                    />
                    <Label htmlFor="includeNumberChoice" className="font-medium cursor-pointer">Nummervalg</Label>
                  </div>
                  {includeNumberChoice && (
                    <div className="ml-6 space-y-3">
                      <RadioGroup 
                        value={numberChoice || ""} 
                        onValueChange={(val) => setNumberChoice(val as NumberChoice || null)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="existing" id="existing" />
                          <Label htmlFor="existing" className="font-normal cursor-pointer">Eksisterende numre flyttes</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mixed" id="mixed" />
                          <Label htmlFor="mixed" className="font-normal cursor-pointer">Blanding af eksisterende og nye</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="new" id="new" />
                          <Label htmlFor="new" className="font-normal cursor-pointer">Kun nye numre</Label>
                        </div>
                      </RadioGroup>
                      {(numberChoice === "existing" || numberChoice === "mixed") && (
                        <div className="space-y-2">
                          <Label>Eksisterende numre</Label>
                          <Input
                            value={existingNumbers}
                            onChange={(e) => setExistingNumbers(e.target.value)}
                            placeholder="12345678, 87654321, 11223344"
                          />
                        </div>
                      )}
                      {numberChoice === "mixed" && (
                        <div className="space-y-2">
                          <Label>Antal nye numre</Label>
                          <Input
                            value={newNumberCount}
                            onChange={(e) => setNewNumberCount(e.target.value)}
                            placeholder="3"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Binding */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeBinding" 
                    checked={includeBinding}
                    onCheckedChange={(checked) => setIncludeBinding(checked === true)}
                  />
                  <Label htmlFor="includeBinding" className="font-medium cursor-pointer">Binding (36 måneder)</Label>
                </div>

                <Separator />

                {/* Startup */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="includeStartup" 
                      checked={includeStartup}
                      onCheckedChange={(checked) => setIncludeStartup(checked === true)}
                    />
                    <Label htmlFor="includeStartup" className="font-medium cursor-pointer">Opstart</Label>
                  </div>
                  {includeStartup && (
                    <div className="ml-6 space-y-3">
                      <RadioGroup 
                        value={startupChoice || ""} 
                        onValueChange={(val) => setStartupChoice(val as StartupChoice || null)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="after_binding" id="after_binding" />
                          <Label htmlFor="after_binding" className="font-normal cursor-pointer">Efter binding/opsigelsesperiode</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="wish_date" id="wish_date" />
                          <Label htmlFor="wish_date" className="font-normal cursor-pointer">Med ønskedato</Label>
                        </div>
                      </RadioGroup>
                      {startupChoice === "wish_date" && (
                        <div className="space-y-2">
                          <Label>Ønsket dato</Label>
                          <Input
                            type="date"
                            value={wishDate}
                            onChange={(e) => setWishDate(e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Order confirmation */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeOrderConfirmation" 
                    checked={includeOrderConfirmation}
                    onCheckedChange={(checked) => setIncludeOrderConfirmation(checked === true)}
                  />
                  <Label htmlFor="includeOrderConfirmation" className="font-medium cursor-pointer">Ordrebekræftelse (14 dage)</Label>
                </div>

                {/* Cancellation */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeCancellation" 
                    checked={includeCancellation}
                    onCheckedChange={(checked) => setIncludeCancellation(checked === true)}
                  />
                  <Label htmlFor="includeCancellation" className="font-medium cursor-pointer">Opsigelse af numre</Label>
                </div>

                {/* Add/remove subscriptions */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="includeAddRemove" 
                    checked={includeAddRemove}
                    onCheckedChange={(checked) => setIncludeAddRemove(checked === true)}
                  />
                  <Label htmlFor="includeAddRemove" className="font-medium cursor-pointer">Tilføj/opsig abonnementer</Label>
                </div>

                <Separator />

                {/* Subsidy */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hasSubsidy" 
                      checked={hasSubsidy}
                      onCheckedChange={(checked) => setHasSubsidy(checked === true)}
                    />
                    <Label htmlFor="hasSubsidy" className="font-medium cursor-pointer">Tilskud</Label>
                  </div>
                  {hasSubsidy && (
                    <div className="ml-6 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Tilskudsbeløb</Label>
                          <Input
                            value={subsidyAmount}
                            onChange={(e) => setSubsidyAmount(e.target.value)}
                            placeholder="5.000 kr."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Startdato for tilskud</Label>
                          <Input
                            type="date"
                            value={subsidyStartDate}
                            onChange={(e) => setSubsidyStartDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Produkter tilskuddet bruges på</Label>
                        <Textarea
                          value={subsidyProducts}
                          onChange={(e) => setSubsidyProducts(e.target.value)}
                          placeholder="Router 5G til 1.500 kr., 2 stk. iPhone 15 til 2.000 kr. pr. stk..."
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Omstilling */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hasOmstilling" 
                      checked={hasOmstilling}
                      onCheckedChange={(checked) => setHasOmstilling(checked === true)}
                    />
                    <Label htmlFor="hasOmstilling" className="font-medium cursor-pointer">Omstilling</Label>
                  </div>
                  {hasOmstilling && (
                    <RadioGroup 
                      value={isStandardOmstilling ? "standard" : "advanced"} 
                      onValueChange={(val) => setIsStandardOmstilling(val === "standard")}
                      className="ml-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="standard" id="standard" />
                        <Label htmlFor="standard" className="font-normal cursor-pointer">Standard (kan opgraderes til menuvalg)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="advanced" id="advanced" />
                        <Label htmlFor="advanced" className="font-normal cursor-pointer">Avanceret (inkl. menuvalg)</Label>
                      </div>
                    </RadioGroup>
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
                <Textarea
                  value={summaryText}
                  readOnly
                  className="min-h-[600px] font-mono text-sm resize-none"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
