import { useMemo, useState } from "react";
import { Copy, Check, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";

type Solution = "omstilling" | "oneplus";
type Mbb = "none" | "datadeling" | "mobilevoice";
interface NumberRow { name: string; subscription: string; sim: string }

const SOLUTIONS: Record<Solution, string> = {
  omstilling: "Omstillingsløsning + One+ Løsning",
  oneplus: "One+ Løsning",
};

const SOLUTION_LABELS: Record<Solution, string> = { omstilling: "Omstilling", oneplus: "Mobileonly" };

const FEATURES = [
  "Velkomsthilsen",
  "Åbne- og lukketider",
  "Tidsstyring",
  "Hovednummervisning",
  "Kø funktion",
  "0-valg (1 menu valg på 0 knappen)",
  "Menuvalg",
  "SMS på mobilehovednummer",
  "Call Record",
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const cleanPhone = (s: string) => {
  const d = s.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("45")) return d.slice(2);
  if (d.length === 12 && d.startsWith("0045")) return d.slice(4);
  return d.length === 8 ? d : s.trim();
};

/** Bygger mailen som HTML (Outlook) og ren tekst. Faste afsnit følger Word-skabelonen. */
function buildMail(f: {
  solution: Solution; contact: string; phone: string; rows: NumberRow[];
  mbb: Mbb; noRouter: boolean; fiveG: boolean;
  hasSubsidy: boolean; subsidyAmount: string; subsidyProduct: string; features: string[];
}) {
  const html: string[] = [];
  const txt: string[] = [];
  const p = (h: string, t: string) => { html.push(h); txt.push(t); };

  p("<p><b>Kære kunde</b></p>", "Kære kunde\n");
  p("<p>Hermed som lovet en mail med relevant information om dit videre forløb, og hvad der sker herfra.</p>",
    "Hermed som lovet en mail med relevant information om dit videre forløb, og hvad der sker herfra.\n");
  const contact = f.contact.trim() || "<indtast kontaktperson>";
  const phone = cleanPhone(f.phone) || "<indtast telefonnummer>";
  p(`<ul><li><b>TDC Erhverv ${esc(SOLUTIONS[f.solution])}</b></li><li>Snarest muligt kontakter min kollega jer ifm. opsætning og indhentning af oplysninger. Vi bruger følgende kontaktoplysninger:<ul><li>Kontaktperson: ${esc(contact)}</li><li>Telefonnummer: ${esc(phone)}</li></ul></li></ul>`,
    `• TDC Erhverv ${SOLUTIONS[f.solution]}\n• Snarest muligt kontakter min kollega jer ifm. opsætning og indhentning af oplysninger. Vi bruger følgende kontaktoplysninger:\n   - Kontaktperson: ${contact}\n   - Telefonnummer: ${phone}\n`);

  const forloeb = "I vil skulle lave fuldmagter for at få flyttet numrene med. Derfor må du så vidt som muligt gerne have fundet alle numrenes tilhørende simkortsnummer frem. Sidst i mailen kan du læse hvordan.";
  const forloeb2 = "Vi sørger for, at overflytningen af numrene sker når jeres nuværende bindings- og opsigelsesperiode er udløbet, så vi er sikre på i ikke modtager nogle dobbeltregninger.";
  p(`<p><b>Videre forløb</b></p><ul><li>${forloeb}<br>${forloeb2}</li></ul>`, `Videre forløb\n• ${forloeb}\n  ${forloeb2}\n`);

  const rows = f.rows.filter((r) => r.name || r.subscription || r.sim);
  const rowTxt = rows.map((r) => [r.name, r.subscription, r.sim].filter(Boolean).join(", "));
  p(`<p><b>Selve løsningen:</b></p><p>De numre vi har drøftet skal indgå i løsningen er følgende:</p><p>${rowTxt.map(esc).join("<br>") || "[Nummer/Navn], [Abonnement] [Simkortsnummer]"}</p>`,
    `Selve løsningen:\nDe numre vi har drøftet skal indgå i løsningen er følgende:\n${rowTxt.join("\n") || "[Nummer/Navn], [Abonnement] [Simkortsnummer]"}\n`);

  const extra: string[] = [];
  if (f.mbb === "datadeling") extra.push("Det mobile bredbånd oprettes som et datadelingskort, som deler data med mobilabonnementet det er tilknyttet. Derfor står det ikke som et selvstændigt abonnement.");
  if (f.mbb === "mobilevoice") extra.push("Der oprettes et mobilt bredbånd gennem et mobilevoice abonnement. Det får et fiktivt nummer.");
  if (f.mbb !== "none" && f.noRouter) extra.push("Der medfølger ikke router til dit mobilebredbånd.");
  if (f.fiveG) extra.push("Derudover får du 5G Fri internet med, hvor vi fremsender router og simkort.");
  extra.forEach((e) => p(`<p>${e}</p>`, `${e}\n`));

  if (f.hasSubsidy) {
    const amt = f.subsidyAmount.trim() ? `${f.subsidyAmount.trim()} kr.` : "[Beløb]";
    const prod = f.subsidyProduct.trim() || "[Præcise produkt inkl evt. gigabyte, 4G/5G]";
    p(`<p><b>Tilskud:</b></p><p>I har fået tildelt et terminaltilskud ${esc(amt)}, vi har drøftet det umiddelbart skal bruges på:</p><p>${esc(prod).replace(/\n/g, "<br>")}</p>`,
      `Tilskud:\nI har fået tildelt et terminaltilskud ${amt}, vi har drøftet det umiddelbart skal bruges på:\n${prod}\n`);
  }

  const shop = "I kan på https://shop.tdc.dk/ se hvilket hardware vi udbyder, bestillinger foregår via kontaktformularen og er ikke noget jeg har mulighed for at gøre for dig. Hvis i ønsker at bestille for mere, end det medfølgende terminaltilskud, vil i selv skulle betale differencen.";
  p(`<p>${shop}</p>`, `${shop}\n`);

  if (f.features.length) {
    p(`<p><b>Vi har talt om I gerne vil gøre brug af følgende funktioner:</b></p><p>${f.features.map(esc).join("<br>")}</p>`,
      `Vi har talt om I gerne vil gøre brug af følgende funktioner:\n${f.features.join("\n")}\n`);
  }

  const sim = [
    ["På selve simkortet:", "Du kan se nummeret (ICCID) trykt på det lille nano-simkort eller på det store plastikkort, du modtog det med."],
    ["I telefonens indstillinger:", "På mange smartphones kan du finde nummeret under telefonens om- eller indstillingsmenu (fx under Om enhed / Status)."],
    ["Via selvbetjening:", "Du kan logge ind på din udbyders selvbetjening for at se oplysninger om dit abonnement og simkort."],
  ];
  p(`<p><b>Sådan finder du dit simkortnummer</b></p><ul>${sim.map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join("")}</ul>`,
    `Sådan finder du dit simkortnummer\n${sim.map(([a, b]) => `• ${a} ${b}`).join("\n")}\n`);
  p("<p>Rigtig god dag – og endnu en gang tillykke med din aftale!</p>", "Rigtig god dag – og endnu en gang tillykke med din aftale!");

  return { html: `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${html.join("")}</div>`, text: txt.join("\n") };
}

export function TdcIdriftsaettelseForm() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [solution, setSolution] = useState<Solution>("omstilling");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<NumberRow[]>([{ name: "", subscription: "", sim: "" }]);
  const [mbb, setMbb] = useState<Mbb>("none");
  const [noRouter, setNoRouter] = useState(true);
  const [fiveG, setFiveG] = useState(false);
  const [hasSubsidy, setHasSubsidy] = useState(false);
  const [subsidyAmount, setSubsidyAmount] = useState("");
  const [subsidyProduct, setSubsidyProduct] = useState("");
  const [features, setFeatures] = useState<string[]>([]);

  const mail = useMemo(
    () => buildMail({ solution, contact, phone, rows, mbb, noRouter, fiveG, hasSubsidy, subsidyAmount, subsidyProduct, features }),
    [solution, contact, phone, rows, mbb, noRouter, fiveG, hasSubsidy, subsidyAmount, subsidyProduct, features],
  );

  const updateRow = (i: number, k: keyof NumberRow, v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const copy = async () => {
    if (!contact.trim() || !phone.trim()) {
      toast({ title: "Udfyld kontaktperson og telefonnummer", variant: "destructive" });
      return;
    }
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([mail.html], { type: "text/html" }),
          "text/plain": new Blob([mail.text], { type: "text/plain" }),
        })]);
      } else {
        await navigator.clipboard.writeText(mail.text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Mail kopieret", description: "Indsæt den i Outlook" });
    } catch {
      toast({ title: "Kunne ikke kopiere", variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Oplysninger</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Løsning</Label>
            <RadioGroup value={solution} onValueChange={(v) => setSolution(v as Solution)}>
              {(Object.keys(SOLUTIONS) as Solution[]).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <RadioGroupItem value={k} id={`sol-${k}`} />
                  <Label htmlFor={`sol-${k}`} className="font-normal">{SOLUTION_LABELS[k]}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Kontaktperson *</Label><Input value={contact} onChange={(e) => setContact(e.target.value)} /></div>
            <div className="space-y-2"><Label>Telefonnummer *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>

          <div className="space-y-2">
            <Label>Numre i løsningen</Label>
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Nummer/Navn" value={r.name} onChange={(e) => updateRow(i, "name", e.target.value)} />
                <Input placeholder="Abonnement" value={r.subscription} onChange={(e) => updateRow(i, "subscription", e.target.value)} />
                <Input placeholder="Simkortnummer" value={r.sim} onChange={(e) => updateRow(i, "sim", e.target.value)} />
                <Button variant="ghost" size="icon" disabled={rows.length === 1} onClick={() => setRows(rows.filter((_, idx) => idx !== i))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setRows([...rows, { name: "", subscription: "", sim: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Tilføj række
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Mobilt bredbånd</Label>
            <RadioGroup value={mbb} onValueChange={(v) => setMbb(v as Mbb)}>
              {([["none", "Intet mobilt bredbånd"], ["datadeling", "Datadelingskort"], ["mobilevoice", "Via mobilevoice-abonnement (fiktivt nummer)"]] as const).map(([k, l]) => (
                <div key={k} className="flex items-center gap-2">
                  <RadioGroupItem value={k} id={`mbb-${k}`} />
                  <Label htmlFor={`mbb-${k}`} className="font-normal">{l}</Label>
                </div>
              ))}
            </RadioGroup>
            {mbb !== "none" && (
              <div className="flex items-center gap-2 pl-6">
                <Checkbox id="norouter" checked={noRouter} onCheckedChange={(v) => setNoRouter(!!v)} />
                <Label htmlFor="norouter" className="font-normal">Der medfølger ikke router</Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Checkbox id="fiveg" checked={fiveG} onCheckedChange={(v) => setFiveG(!!v)} />
              <Label htmlFor="fiveg" className="font-normal">5G Fri internet med router og simkort</Label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="subsidy" checked={hasSubsidy} onCheckedChange={(v) => setHasSubsidy(!!v)} />
              <Label htmlFor="subsidy">Terminaltilskud</Label>
            </div>
            {hasSubsidy && (
              <div className="space-y-2 pl-6">
                <Input placeholder="Beløb (kr.)" value={subsidyAmount} onChange={(e) => setSubsidyAmount(e.target.value)} />
                <Textarea placeholder="Produkt inkl. evt. gigabyte, 4G/5G" value={subsidyProduct} onChange={(e) => setSubsidyProduct(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Funktioner</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Checkbox id={f} checked={features.includes(f)}
                    onCheckedChange={(v) => setFeatures((cur) => (v ? FEATURES.filter((x) => cur.includes(x) || x === f) : cur.filter((x) => x !== f)))} />
                  <Label htmlFor={f} className="font-normal">{f}</Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-4 self-start">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mail</CardTitle>
          <Button onClick={copy}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />} Kopiér mail
          </Button>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert rounded-md border bg-card p-4 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: mail.html }} />
        </CardContent>
      </Card>
    </div>
  );
}
