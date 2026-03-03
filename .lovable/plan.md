

## Forslag til forbedring af leverandør-email-rapporten

Baseret på det nuværende design og screenshots, er her konkrete forbedringsforslag:

### Problemer med nuværende design
1. **Headeren er næsten ulæselig** — hvid tekst på lys baggrund (se screenshot). Gradient-farverne er for lyse i mange email-klienter
2. **Tabellen er tæt pakket** — mange kolonner på 700px gør det svært at scanne
3. **Weekday badges er visuelt støjende** — for mange farver og gradienter konkurrerer om opmærksomhed
4. **Summary cards under tabellen** gentager info der allerede står i subtotal-rækken
5. **Ingen visuel hierarki** — alt har samme vægt, intet springer i øjnene

### Foreslåede forbedringer

**1. Header — Mere kontrast og klarhed**
- Brug solid mørk baggrund (#0f172a) i stedet for gradient der kan se udvasket ud
- Gør firmanavnet mindre og perioden mere fremtrædende (det er det modtageren scanner efter)
- Tilføj leverandørnavn tydeligt i headeren

**2. Tabel — Bedre læsbarhed**
- Øg padding i celler (14px → 16px vertikal)
- Brug tydeligere zebra-striping (#f8fafc → #f1f5f9 for bedre kontrast)
- Gør "Beløb"-kolonnen visuelt tungere (større font, fed)
- Fjern ID-kolonnen fra email (den er mest til intern brug) — eller gør den mere diskret

**3. Weekday badges — Forenkling**
- Drop gradienter på badges, brug solid farver
- Gør "Man–Fre" badges grønne og individuelle dage grå/neutrale (ikke blå+grøn mix)
- Større font på ugenummer for bedre scanbarhed

**4. Subtotal — Tydeligere afslutning**
- Gør subtotal-rækken mere markant med fed border-top og større tal
- Fjern summary cards (duplikerer subtotal) — eller behold kun totalen som et enkelt stort tal under tabellen

**5. Brugerbesked — Bedre placering**
- Flyt beskeden OVER tabellen med en neutral styling (ikke gul advarsel-boks)
- Brug en simpel grå boks eller blot tekst med lidt margin

**6. Footer — Mere professionel**
- Tilføj kontaktinfo eller reference-nummer
- Tilføj "Ved spørgsmål kontakt..." tekst

### Teknisk implementering

Kun én fil ændres: `supabase/functions/send-supplier-report/index.ts` — refaktor `buildReportHtml()` med ovenstående designændringer. Alle ændringer er CSS/inline-style justeringer, ingen strukturelle ændringer.

