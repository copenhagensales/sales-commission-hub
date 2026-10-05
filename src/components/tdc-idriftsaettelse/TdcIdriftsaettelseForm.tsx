import { useEffect, useMemo, useState } from "react";
import { Copy, Check, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { da } from "date-fns/locale";

type Solution = "omstilling" | "oneplus";
type Mbb = "none" | "datadeling" | "mobilevoice";
interface NumberRow { name: string; subscription: string; sim: string }

const SOLUTIONS: Record<Solution, string> = {
  omstilling: "One+ Omstillingsløsning",
  oneplus: "One+ Løsning",
};

const SOLUTION_LABELS: Record<Solution, string> = { omstilling: "Omstilling", oneplus: "Mobileonly" };

const ROUTERS = ["Huawei H158 381 5G MBB Router", "Huawei B535 4G MBB Router Cat 7", "Zyxel NR5307 5G Router, Hvid 230V"];

const SUBSCRIPTIONS = [
  "Hovednummer",
  "Mobil minut",
  "Mobil DK (3GB)",
  "Mobil Basis (5GB)",
  "Basis mobil (15GB)",
  "Mobil Basis (40GB)",
  "Standard mobil (40GB)",
  "Professionel mobil (100GB)",
  "Premium mobil (1TB)",
];

const BENEFITS = ["Pris", "Udlandstelefoni", "Udlandsdata", "Datakort", "Call-record", "Yousee musik", "God dækning", "Omstilling og de fordele der følger med", "Viderestilling", "Min status", "Guldnummer", "5G+", "Internetfilter", "Samlet løsning"];

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
const isValidDkNumber = (v: string) => /^\d{8}$/.test(v.replace(/\s/g, ""));

function buildMail(f: {
  solution: Solution; contact: string; phone: string; mainNumber: string; rows: NumberRow[];
  mbb: Mbb; noRouter: boolean; fiveG: boolean;
  hasSubsidy: boolean; subsidyAmount: string; subsidySpecific: boolean; subsidyProducts: string[]; router: string; features: string[]; benefits: string[];
  startMode: "" | "binding" | "date"; startDate: string;
}) {
  const html: string[] = [];
  const txt: string[] = [];
  const p = (h: string, t: string) => { html.push(h); txt.push(t); };

  p("<p><b>Kære kunde</b></p>", "Kære kunde\n");
  p("<p>Hermed som lovet en mail med relevant information om dit videre forløb, og hvad der sker herfra.</p>",
    "Hermed som lovet en mail med relevant information om dit videre forløb, og hvad der sker herfra.\n");
  const contact = f.contact.trim() || "<indtast kontaktperson>";
  const phone = cleanPhone(f.phone) || "<indtast telefonnummer>";
  p(`<p><b>TDC Erhverv ${esc(SOLUTIONS[f.solution])}</b></p><ul><li>Snarest muligt kontakter min kollega jer ifm. opsætning og indhentning af oplysninger. Vi bruger følgende kontaktoplysninger:<ul><li>Kontaktperson: ${esc(contact)}</li><li>Telefonnummer: ${esc(phone)}</li></ul></li></ul>`,
    `TDC Erhverv ${SOLUTIONS[f.solution]}\n• Snarest muligt kontakter min kollega jer ifm. opsætning og indhentning af oplysninger. Vi bruger følgende kontaktoplysninger:\n   - Kontaktperson: ${contact}\n   - Telefonnummer: ${phone}\n`);

  const forloeb = "I vil skulle lave fuldmagter for at få flyttet numrene med. Derfor må du så vidt som muligt gerne have fundet alle numrenes tilhørende simkortsnummer frem. Sidst i mailen kan du læse hvordan.";
  const dateTxt = f.startDate ? format(new Date(`${f.startDate}T12:00:00`), "d. MMMM yyyy", { locale: da }) : "[dato]";
  const forloeb2 = f.startMode === "date"
    ? `Vi har aftalt, at numrene flyttes den ${dateTxt} eller hurtigst muligt herefter. Hvis det ligger før jeres nuværende udbyders bindings- eller opsigelsesperiode, kan de opkræve et gebyr for tidlig udtrædelse.`
    : "Vi sørger for, at overflytningen af numrene sker når jeres nuværende bindings- og opsigelsesperiode er udløbet, så vi er sikre på i ikke modtager nogle dobbeltregninger.";
  p(`<p><b>Videre forløb</b></p><ul><li>${forloeb}<br>${forloeb2}</li></ul>`, `Videre forløb\n• ${forloeb}\n  ${forloeb2}\n`);

  const ul = (items: string[]) => `<ul style="margin-top:0;margin-bottom:8pt">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  const bullets = (items: string[]) => items.map((i) => `• ${i}`).join("\n");

  const rows = f.rows.filter((r) => r.name || r.subscription || r.sim);
  if (f.solution === "omstilling") rows.unshift({ name: f.mainNumber || "[Hovednummer]", subscription: "Hovednummer", sim: "" });
  const isMain = (r: NumberRow) => r.subscription === "Hovednummer";
  const simOf = (r: NumberRow) => (isMain(r) ? "" : `Simkort: ${r.sim || "[Simkortsnummer]"}`);
  const rowHtml = rows.map((r) => [isMain(r) ? `<b>${esc(r.name)}</b>` : esc(r.name), esc(r.subscription), esc(simOf(r))].filter(Boolean).join(" – "));
  const rowTxt = rows.map((r) => [r.name, r.subscription, simOf(r)].filter(Boolean).join(" – "));
  const fallback = "[Nummer/Navn] – [Abonnement] – Simkort: [Simkortsnummer]";

  const extra: string[] = [];
  if (f.mbb === "datadeling") extra.push("Det mobile bredbånd oprettes som et datadelingskort, som deler data med mobilabonnementet det er tilknyttet. Derfor står det ikke som et selvstændigt abonnement.");
  if (f.mbb === "mobilevoice") extra.push("Der oprettes et mobilt bredbånd gennem et mobilevoice abonnement. Det får et fiktivt nummer.");
  if (f.mbb !== "none" && f.noRouter) extra.push("Der medfølger ikke router til dit mobilebredbånd.");
  if (f.fiveG) extra.push("Derudover får du 5G Fri internet med, hvor vi fremsender router og simkort.");

  p(`<p><b>Selve løsningen:</b></p><p style="margin-bottom:4pt">De numre vi har drøftet skal indgå i løsningen er følgende:</p>${ul(rowHtml.length ? rowHtml : [esc(fallback)])}${extra.length ? ul(extra) : ""}`,
    `Selve løsningen:\nDe numre vi har drøftet skal indgå i løsningen er følgende:\n${bullets(rowTxt.length ? rowTxt : [fallback])}\n${extra.length ? `${bullets(extra)}\n` : ""}`);

  if (f.hasSubsidy) {
    const raw = f.subsidyAmount.trim();
    const num = Number(raw.replace(/\./g, "").replace(",", "."));
    const amtVal = raw ? `${/^[\d.,]+$/.test(raw) && !isNaN(num) ? num.toLocaleString("da-DK") : raw} kr.` : "[Beløb]";
    const amtHtml = `<b>${esc(amtVal)}</b>`;
    if (f.subsidySpecific) {
      const prods = [f.router, ...f.subsidyProducts].map((x) => x.trim()).filter(Boolean);
      p(`<p><b>Tilskud:</b></p><p style="margin-bottom:4pt">I har fået tildelt et terminaltilskud ${amtHtml}, vi har drøftet det umiddelbart skal bruges på:</p>${prods.length ? ul(prods.map(esc)) : ""}`,
        `Tilskud:\nI har fået tildelt et terminaltilskud ${amtVal}, vi har drøftet det umiddelbart skal bruges på:\n${prods.length ? `${bullets(prods)}\n` : ""}`);
    } else {
      p(`<p><b>Tilskud:</b></p><p>I har fået tildelt et terminaltilskud ${amtHtml}</p>`,
        `Tilskud:\nI har fået tildelt et terminaltilskud ${amtVal}\n`);
    }
  }

  const shop = "I kan på https://shop.tdc.dk/ se hvilket hardware vi udbyder, bestillinger foregår via kontaktformularen og er ikke noget jeg har mulighed for at gøre for dig. Hvis i ønsker at bestille for mere, end det medfølgende terminaltilskud, vil i selv skulle betale differencen.";
  p(`<p>${shop}</p>`, `${shop}\n`);

  if (f.solution === "omstilling" && f.features.length) {
    p(`<p style="margin-bottom:4pt"><b>Vi har talt om I gerne vil gøre brug af følgende funktioner:</b></p>${ul(f.features.map(esc))}`,
      `Vi har talt om I gerne vil gøre brug af følgende funktioner:\n${bullets(f.features)}\n`);
  }

  if (f.benefits.length) {
    p(`<p style="margin-bottom:4pt"><b>Fordele</b></p><p style="margin-bottom:4pt">Nogle af de fordele vi har drøftet er:</p>${ul(f.benefits.map(esc))}`,
      `Fordele\nNogle af de fordele vi har drøftet er:\n${bullets(f.benefits)}\n`);
  }

  const sim = [
    ["På selve simkortet:", "Du kan se nummeret (ICCID) trykt på det lille nano-simkort eller på det store plastikkort, du modtog det med."],
    ["I telefonens indstillinger:", "På mange smartphones kan du finde nummeret under telefonens om- eller indstillingsmenu (fx under Om enhed / Status)."],
    ["Via selvbetjening:", "Du kan logge ind på din udbyders selvbetjening for at se oplysninger om dit abonnement og simkort."],
  ];
  p(`<p><b>Sådan finder du dit simkortnummer</b></p><ul>${sim.map(([a, b]) => `<li><b>${a}</b> ${b}</li>`).join("")}</ul>`,
    `Sådan finder du dit simkortnummer\n${sim.map(([a, b]) => `• ${a} ${b}`).join("\n")}\n`);
  p("<p>Rigtig god dag – og endnu en gang tillykke med din aftale!</p>", "Rigtig god dag – og endnu en gang tillykke med din aftale!");

  return { html: `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${html.join("").replace(/<p>/g, '<p style="margin:0 0 8pt">').replace(/<p style="margin-bottom:4pt">/g, '<p style="margin:0 0 4pt">')}</div>`, text: txt.join("\n") };
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
  const [subsidyProducts, setSubsidyProducts] = useState<string[]>([""]);
  const [subsidySpecific, setSubsidySpecific] = useState(true);
  const [router, setRouter] = useState("");
  const needsRouter = mbb !== "none" && !noRouter;
  useEffect(() => { if (needsRouter) { setHasSubsidy(true); setSubsidySpecific(true); } }, [needsRouter]);
  const [features, setFeatures] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [startMode, setStartMode] = useState<"" | "binding" | "date">("");
  const [startDate, setStartDate] = useState("");
  const [mainNumber, setMainNumber] = useState("");

  const mail = useMemo(
    () => buildMail({ solution, contact, phone, mainNumber, rows, mbb, noRouter, fiveG, hasSubsidy, subsidyAmount, subsidySpecific, subsidyProducts, router: needsRouter ? router : "", features, benefits, startMode, startDate }),
    [solution, contact, phone, mainNumber, rows, mbb, noRouter, fiveG, hasSubsidy, subsidyAmount, subsidySpecific, subsidyProducts, router, needsRouter, features, benefits, startMode, startDate],
  );

  const updateRow = (i: number, k: keyof NumberRow, v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));

  const missing: string[] = [];
  if (!contact.trim() || !phone.trim()) missing.push("kontaktperson og telefonnummer");
  const phoneBad = !!phone.trim() && !isValidDkNumber(phone);
  const mainBad = solution === "omstilling" && !!mainNumber.trim() && !isValidDkNumber(mainNumber);
  const rowBad = (v: string) => !!v.trim() && !/\p{L}/u.test(v) && !isValidDkNumber(v);
  if (phoneBad) missing.push("telefonnummer (8 cifre)");
  if (mainBad) missing.push("hovednummer (8 cifre)");
  if (rows.some((r) => rowBad(r.name))) missing.push("8 cifre på alle numre i løsningen");
  if (solution === "omstilling" && !mainNumber.trim()) missing.push("hovednummer");
  if (rows.some((r) => !r.name.trim() || !r.subscription)) missing.push("nummer/navn og abonnement på alle linjer");
  if (hasSubsidy && !subsidyAmount.trim()) missing.push("beløb for terminaltilskud");
  if (solution === "omstilling" && features.length === 0) missing.push("mindst én funktion");
  if (benefits.length === 0) missing.push("mindst én fordel");
  if (!startMode) missing.push("opstart");
  if (startMode === "date" && !startDate) missing.push("ønskedato");
  if (hasSubsidy && subsidySpecific && !(needsRouter && router) && subsidyProducts.some((x) => !x.trim())) missing.push("produkter for terminaltilskud");
  if (needsRouter && (!hasSubsidy || !subsidySpecific || !router)) missing.push("router under terminaltilskud (specifikke produkter)");
  const canCopy = missing.length === 0;

  const copy = async () => {
    if (!canCopy) {
      toast({ title: `Udfyld: ${missing.join(", ")}`, variant: "destructive" });
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
            <div className="space-y-2"><Label>Telefonnummer *</Label><Input value={phone} className={phoneBad ? "border-destructive" : ""} title={phoneBad ? "Skal være 8 cifre" : undefined} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>

          <div className="space-y-2">
            <Label>Numre i løsningen</Label>
            {solution === "omstilling" && (
              <div className="flex gap-2">
                <Input placeholder="Hovednummer" value={mainNumber} className={mainBad ? "border-destructive" : ""} title={mainBad ? "Skal være 8 cifre" : undefined} onChange={(e) => setMainNumber(e.target.value)} />
                <Input value="Hovednummer" disabled />
                <Input placeholder="Intet simkort" disabled />
                <div className="w-10 shrink-0" />
              </div>
            )}
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Nummer/Navn" value={r.name} className={rowBad(r.name) ? "border-destructive" : ""} title={rowBad(r.name) ? "Skal være 8 cifre" : undefined} onChange={(e) => updateRow(i, "name", e.target.value)} />
                <Select value={r.subscription} onValueChange={(v) => updateRow(i, "subscription", v)}>
                  <SelectTrigger><SelectValue placeholder="Abonnement" /></SelectTrigger>
                  <SelectContent>
                    {SUBSCRIPTIONS.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>
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
                <Checkbox id="norouter" checked={noRouter} onCheckedChange={(v) => { setNoRouter(!!v); if (!v) { setHasSubsidy(true); setSubsidySpecific(true); } }} />
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
              <Checkbox id="subsidy" disabled={needsRouter} checked={hasSubsidy || needsRouter} onCheckedChange={(v) => setHasSubsidy(!!v)} />
              <Label htmlFor="subsidy">Terminaltilskud</Label>
            </div>
            {(hasSubsidy || needsRouter) && (
              <div className="space-y-2 pl-6">
                <Input placeholder="Beløb (kr.)" value={subsidyAmount} onChange={(e) => setSubsidyAmount(e.target.value)} />
                <RadioGroup value={subsidySpecific || needsRouter ? "yes" : "no"} onValueChange={(v) => setSubsidySpecific(v === "yes")} className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="yes" id="sub-yes" />
                    <Label htmlFor="sub-yes">Specifikke produkter</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="no" id="sub-no" disabled={needsRouter} />
                    <Label htmlFor="sub-no">Ingen specifikke produkter</Label>
                  </div>
                </RadioGroup>
                {(subsidySpecific || needsRouter) && (
                  <div className="space-y-2">
                    {needsRouter && (
                      <Select value={router} onValueChange={setRouter}>
                        <SelectTrigger><SelectValue placeholder="Vælg router (påkrævet)" /></SelectTrigger>
                        <SelectContent>
                          {ROUTERS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    {subsidyProducts.map((prod, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input placeholder="Produkt inkl. evt. gigabyte, 4G/5G" value={prod}
                          onChange={(e) => setSubsidyProducts((ps) => ps.map((x, idx) => (idx === i ? e.target.value : x)))} />
                        <Button variant="ghost" size="icon" disabled={subsidyProducts.length === 1}
                          onClick={() => setSubsidyProducts((ps) => ps.filter((_, idx) => idx !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => setSubsidyProducts((ps) => [...ps, ""])}>
                      <Plus className="h-4 w-4 mr-1" /> Tilføj produkt
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {solution === "omstilling" && (
          <div className="space-y-2">
            <Label>Funktioner * <span className="font-normal text-muted-foreground">(vælg mindst 1)</span></Label>
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
          )}

          <div className="space-y-2">
            <Label>Opstart *</Label>
            <RadioGroup value={startMode} onValueChange={(v) => setStartMode(v as "binding" | "date")}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="binding" id="start-binding" />
                <Label htmlFor="start-binding" className="font-normal">Efter endt binding- og opsigelse</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="date" id="start-date" />
                <Label htmlFor="start-date" className="font-normal">Ønskedato</Label>
              </div>
            </RadioGroup>
            {startMode === "date" && (
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className={`max-w-xs ${!startDate ? "border-destructive" : ""}`} />
            )}
          </div>

          <div className="space-y-2">
            <Label>Fordele * <span className="font-normal text-muted-foreground">(vælg mindst 1)</span></Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-center gap-2">
                  <Checkbox id={`benefit-${b}`} checked={benefits.includes(b)}
                    onCheckedChange={(v) => setBenefits((cur) => (v ? BENEFITS.filter((x) => cur.includes(x) || x === b) : cur.filter((x) => x !== b)))} />
                  <Label htmlFor={`benefit-${b}`} className="font-normal">{b}</Label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:sticky lg:top-4 self-start">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Mail</CardTitle>
          <Button onClick={copy} disabled={!canCopy} title={canCopy ? undefined : `Udfyld: ${missing.join(", ")}`}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />} Kopiér mail
          </Button>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {!canCopy && (
              <div className="absolute inset-0 z-10 flex items-start justify-center rounded-md bg-destructive/95 backdrop-blur-sm">
                <div className="sticky top-1/3 p-6 text-center text-xl font-bold text-destructive-foreground">
                  ⚠️ Udfyld venligst: {missing.join(", ")}
                </div>
              </div>
            )}
            <div className="prose prose-sm max-w-none dark:prose-invert rounded-md border bg-card p-4 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: mail.html }} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
