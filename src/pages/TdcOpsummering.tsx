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
  const [mbbType, setMbbType] = useState<MbbType>(null);
  const [withoutRouter, setWithoutRouter] = useState(false);
  const [numberChoice, setNumberChoice] = useState<NumberChoice>(null);
  const [startAfterBinding, setStartAfterBinding] = useState(false);
  const [hasWishDate, setHasWishDate] = useState(false);
  const [wishDate, setWishDate] = useState("");
  const [hasSubsidy, setHasSubsidy] = useState(false);
  const [subsidyAmount, setSubsidyAmount] = useState("");
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
    if (companyName || cvr || contactName || contactPhone) {
      lines.push(`Aftalen bliver oprettet i ${companyName || "[firmanavn]"} med CVR-nummer ${cvr || "[CVR-nummer]"}. Kontaktpersonen er ${contactName || "[navn]"}, og det telefonnummer vi benytter, er ${contactPhone || "[telefonnummer]"}.`);
      lines.push("");
    }

    // 3. Product lines
    const validProducts = productLines.filter(p => p.quantity && p.productName);
    if (validProducts.length > 0) {
      validProducts.forEach(p => {
        const dataInfo = p.dataAmount ? ` med ${p.dataAmount}` : "";
        lines.push(`Du får ${p.quantity} stk. ${p.productName}${dataInfo} til en månedlig pris på ${p.monthlyPrice || "[beløb]"} kr. ekskl. moms.`);
      });
      lines.push("");
    }

    // 4. MBB type
    if (mbbType === "mobile_voice") {
      lines.push("Der er tale om Mobile Voice-abonnementer, hvilket betyder at du kan ringe og sende SMS fra abonnementerne.");
      lines.push("");
    } else if (mbbType === "datadelingskort") {
      lines.push("Der er tale om datadelingskort, som bruges til mobile bredbånd eller tablets. Disse kan ikke bruges til at ringe eller sende SMS.");
      lines.push("");
      
      if (withoutRouter) {
        lines.push("Abonnementerne leveres uden router, da du har oplyst at I allerede har router til formålet.");
        lines.push("");
      }
    }

    // 5. Number choice
    if (numberChoice === "existing") {
      lines.push("I beholder jeres eksisterende telefonnumre, som portes over til TDC Erhverv.");
      lines.push("");
    } else if (numberChoice === "mixed") {
      lines.push("I beholder nogle af jeres eksisterende numre og får derudover nye numre fra TDC Erhverv.");
      lines.push("");
    } else if (numberChoice === "new") {
      lines.push("I får nye telefonnumre fra TDC Erhverv.");
      lines.push("");
    }

    // 6. Binding terms (always)
    lines.push("Abonnementerne har en bindingsperiode på 36 måneder, og bindingen starter fra den dag, aftalen træder i kraft.");
    lines.push("");

    // 7. Start after binding
    if (startAfterBinding) {
      lines.push("Jeres eksisterende binding hos nuværende leverandør er stadig aktiv. Aftalen med TDC Erhverv træder først i kraft, når jeres nuværende binding udløber.");
      lines.push("");
    }

    // 8. Wish date
    if (hasWishDate && wishDate) {
      lines.push(`I har ønsket at aftalen skal træde i kraft den ${wishDate}.`);
      lines.push("");
    }

    // 9. Order confirmation (always)
    lines.push("Du modtager en ordrebekræftelse på mail, som du bedes gennemgå. Hvis der er fejl eller mangler, bedes du kontakte os hurtigst muligt.");
    lines.push("");

    // 10. Cancellation (always)
    lines.push("Såfremt du ønsker at opsige jeres nuværende aftale hos en anden leverandør, skal du selv stå for dette.");
    lines.push("");

    // 11. Additional subscriptions (always)
    lines.push("Når aftalen er aktiveret, kan du frit tilføje flere abonnementer på samme vilkår via Kundeservice.");
    lines.push("");

    // 12. Subsidy
    if (hasSubsidy && subsidyAmount) {
      lines.push(`I modtager et tilskud på ${subsidyAmount} kr. ekskl. moms, som kan bruges til ${subsidyProducts || "hardware og tilbehør"}.`);
      lines.push("");
    }

    // 13. Omstilling
    if (hasOmstilling) {
      if (isStandardOmstilling) {
        lines.push("Der er inkluderet en standard omstillingsløsning i aftalen.");
      } else {
        lines.push("Der er inkluderet en avanceret omstillingsløsning i aftalen. Du vil blive kontaktet af en tekniker for opsætning.");
      }
      lines.push("");
    }

    // 14. Closing (always)
    lines.push("Har du nogle spørgsmål til mig?");

    return lines.join("\n");
  }, [
    companyName, cvr, contactName, contactPhone, productLines,
    mbbType, withoutRouter, numberChoice, startAfterBinding,
    hasWishDate, wishDate, hasSubsidy, subsidyAmount, subsidyProducts,
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
                          placeholder="3"
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
                          placeholder="50 GB data"
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
                <CardTitle className="text-lg">Aftalebetingelser</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* MBB Type */}
                <div className="space-y-3">
                  <Label>Abonnementstype</Label>
                  <RadioGroup 
                    value={mbbType || ""} 
                    onValueChange={(val) => setMbbType(val as MbbType || null)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mobile_voice" id="mobile_voice" />
                      <Label htmlFor="mobile_voice" className="font-normal cursor-pointer">Mobile Voice (tale + SMS)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="datadelingskort" id="datadelingskort" />
                      <Label htmlFor="datadelingskort" className="font-normal cursor-pointer">Datadelingskort (MBB/tablet)</Label>
                    </div>
                  </RadioGroup>
                  
                  {mbbType === "datadelingskort" && (
                    <div className="flex items-center space-x-2 ml-6 pt-2">
                      <Checkbox 
                        id="withoutRouter" 
                        checked={withoutRouter}
                        onCheckedChange={(checked) => setWithoutRouter(checked === true)}
                      />
                      <Label htmlFor="withoutRouter" className="font-normal cursor-pointer">Uden router (kunden har egen)</Label>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Number choice */}
                <div className="space-y-3">
                  <Label>Nummervalg</Label>
                  <RadioGroup 
                    value={numberChoice || ""} 
                    onValueChange={(val) => setNumberChoice(val as NumberChoice || null)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="existing" id="existing" />
                      <Label htmlFor="existing" className="font-normal cursor-pointer">Kun eksisterende numre (portering)</Label>
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
                </div>

                <Separator />

                {/* Start after binding */}
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="startAfterBinding" 
                    checked={startAfterBinding}
                    onCheckedChange={(checked) => setStartAfterBinding(checked === true)}
                  />
                  <Label htmlFor="startAfterBinding" className="font-normal cursor-pointer">
                    Opstart efter eksisterende binding udløber
                  </Label>
                </div>

                {/* Wish date */}
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="hasWishDate" 
                      checked={hasWishDate}
                      onCheckedChange={(checked) => setHasWishDate(checked === true)}
                    />
                    <Label htmlFor="hasWishDate" className="font-normal cursor-pointer">
                      Specifik ønskedato
                    </Label>
                  </div>
                  {hasWishDate && (
                    <div className="ml-6">
                      <Input
                        type="date"
                        value={wishDate}
                        onChange={(e) => setWishDate(e.target.value)}
                      />
                    </div>
                  )}
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
                    <Label htmlFor="hasSubsidy" className="font-normal cursor-pointer">
                      Tilskud inkluderet
                    </Label>
                  </div>
                  {hasSubsidy && (
                    <div className="ml-6 space-y-3">
                      <div className="space-y-2">
                        <Label>Tilskudsbeløb (ekskl. moms)</Label>
                        <Input
                          value={subsidyAmount}
                          onChange={(e) => setSubsidyAmount(e.target.value)}
                          placeholder="5000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Kan bruges til</Label>
                        <Input
                          value={subsidyProducts}
                          onChange={(e) => setSubsidyProducts(e.target.value)}
                          placeholder="hardware og tilbehør"
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
                    <Label htmlFor="hasOmstilling" className="font-normal cursor-pointer">
                      Omstillingsløsning inkluderet
                    </Label>
                  </div>
                  {hasOmstilling && (
                    <RadioGroup 
                      value={isStandardOmstilling ? "standard" : "advanced"} 
                      onValueChange={(val) => setIsStandardOmstilling(val === "standard")}
                      className="ml-6"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="standard" id="standard" />
                        <Label htmlFor="standard" className="font-normal cursor-pointer">Standard omstilling</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="advanced" id="advanced" />
                        <Label htmlFor="advanced" className="font-normal cursor-pointer">Avanceret omstilling (tekniker kontakter)</Label>
                      </div>
                    </RadioGroup>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right column - Generated summary */}
          <div className="lg:sticky lg:top-6 h-fit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-lg">Genereret opsummering</CardTitle>
                <Button onClick={copyToClipboard} variant="outline" size="sm">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Kopieret
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Kopiér tekst
                    </>
                  )}
                </Button>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={summaryText}
                  readOnly
                  className="min-h-[600px] font-mono text-sm leading-relaxed resize-none"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
