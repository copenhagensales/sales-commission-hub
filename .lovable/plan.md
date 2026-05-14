## Synkronisér TDC Opsummering (intern + offentlig) via delt kode

### Mål
`/tdc-opsummering` (intern) og `/tdc-public` (offentlig) skal vise nøjagtigt samme indhold, layout og tekstgenerering. Fremtidige rettelser sker ét sted og slår igennem begge steder. **Public-URL `/tdc-public` ændres ikke.**

### Tilgang
Løft den fælles del ud i to nye filer; intern + public bliver tynde wrappers. Følger Princip 8 (single source of truth, også i koden).

### Nye filer
1. **`src/lib/tdcOpsummering/generateSummary.ts`**
   - Ren funktion: `(state) => SummaryLine[]`
   - `TRANSLATIONS`-map (dansk + engelsk)
   - Delte typer (`SummaryLine`, `FormState`, `SummaryVariant`, `MbbType`, `NumberChoice`, `StartupChoice`)
   - Ingen React, ingen Supabase. Kan unit-testes.

2. **`src/components/tdc-opsummering/TdcOpsummeringForm.tsx`**
   - Hele UI'et samlet: variant-vælger (Standard / Pilot / Kun 5G Fri / Engelsk), MBB-sektion (Mobilevoice / Datadelingskort / Ingen / uden router), nummervalg, opstart, tilskud, omstilling + standard-omstilling-toggle, 5G Fri-validering med fejlbanner, tema-vælger, font-slider, preview med nummererede noter (1)–(8) og rød-markerede kritiske linjer, "Kopier tekst"-knap.
   - Bruger `generateSummary()` fra delt lib.

### Reduceres til skal
3. **`src/pages/TdcOpsummering.tsx`** (787 → ~30 linjer)
   ```tsx
   <MainLayout><TdcOpsummeringForm /></MainLayout>
   ```
4. **`src/pages/TdcOpsummeringPublic.tsx`** (601 → ~25 linjer)
   ```tsx
   <div className="min-h-screen bg-background p-4 md:p-8">
     <header className="max-w-7xl mx-auto mb-6 flex items-center gap-3">
       <FileText className="text-primary" />
       <div>
         <h1 className="text-2xl font-bold">TDC Opsummering</h1>
         <p className="text-muted-foreground text-sm">Generer en struktureret opsummeringstekst efter et TDC-salg</p>
       </div>
     </header>
     <TdcOpsummeringForm />
   </div>
   ```
   Public bevarer den simple header (Valg A — bekræftet). Ingen synlig ændring for slutbrugere.

### Hvad der IKKE røres
- `src/routes/config.tsx` — `/tdc-public` (`access: "public"`) og `/tdc-opsummering` (`positionPermission: "menu_tdc_opsummering"`) beholdes 1:1.
- `src/routes/pages.ts` — lazy-imports peger på samme filnavne.
- Ringesystem-link til `/tdc-public` virker uændret.
- Ingen DB, edge functions, permissions eller RLS.

### Hvad public får forærende ved sync
Public har i dag halve features. Efter refactor får den automatisk:
- Fuld engelsk-oversættelse via `TRANSLATIONS`
- Tema-vælger
- Font-størrelse-slider
- Eventuelle fremtidige rettelser i intern slår automatisk igennem.

### Zone & risiko
**Gul zone.** Pure UI-refactor + indholdssync. Ingen rød-zone-filer (ingen pricing, løn, RLS, permissions). Risiko: subtle state-bugs hvis state-flyt brydes — mitigeres ved at flytte hele state-blokken samlet ind i `TdcOpsummeringForm` og bevare al logik 1:1.

### Verifikation efter implementation
1. `/tdc-opsummering` (logget ind): alle felter, tema, font-slider, engelsk, preview-tekst identisk med før.
2. `/tdc-public` (incognito, ingen login): samme indhold som intern, samme URL, samme simple header.
3. Samme input på begge sider → byte-for-byte identisk genereret tekst.
4. Ringesystem-knap åbner `/tdc-public` uændret.
5. Build/typecheck grøn.
