

## Premium TV Board Redesign -- Apple-inspired UI/UX

Boardet redesignes fra bunden med en ren, moderne og minimal Apple-inspireret aestetik. Fokus pa laesbarhed fra afstand, elegante overgange, og et visuelt hierarki der guider ojet naturligt.

### Design-principper

- **Typografi forst**: San Francisco-lignende vaegt med stor kontrast mellem overskrifter og undertekst
- **Negative space**: Generost whitespace, ingen visuel stoj
- **Subtile gradienter**: Brug af glasmorfisme og ultra-subtile baggrunde i stedet for kraftige farve-gradienter
- **Monokromatisk med accent**: Primaert hvid/sort palette med en enkelt accent-farve
- **Animationer**: Brug fade-in animationer for indlaedt indhold

### Konkrete aendringer i `SalesOverviewAll.tsx`

**1. Ur-sektion (hero)**
- Uret bliver det visuelle centrum -- stort, lyst, og dominerende
- Tid i `text-8xl` (eller `text-[120px]` for TV) med ultra-tynd font-weight
- Dato under uret i en elegant `text-xl` med uppercase og letter-spacing
- Fjern Clock-ikonet -- uret taler for sig selv
- Fjern `DashboardHeader`-komponenten i TV mode for et renere look (behold i normal mode)

**2. Total salg hero-sektion**
- Et centralt, stort tal der viser dagens totale salg
- Teksten "SALG I DAG" i subtilt uppercase med tracking
- Placeret lige under uret med god afstand

**3. Klient-grid**
- Erstat de farverige gradient-kort med minimale glasmorfisme-kort:
  - `bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl`
- Logo-container med moerk baggrund og generoes padding
- Salgstal i `text-5xl font-light` (let vaegt, ikke bold -- Apple-stil)
- Klientnavn i `text-sm uppercase tracking-widest text-white/50`
- Ens stoerrelse pa alle kort, sorteret efter flest salg
- Grid: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` med stoerre gap

**4. Baggrund**
- TV mode: `bg-[#0a0a0a]` (naesten sort) med en subtil radial gradient i midten
- Fjern den nuvaerende `from-background via-background to-primary/5`

**5. Footer**
- Minimal footer med tidsstempel og en subtil pulserende "LIVE" badge
- `text-white/30` for at holde det diskret

### Tekniske detaljer

**Fil der aendres:** `src/pages/dashboards/SalesOverviewAll.tsx`

Alle aendringer er isoleret til denne ene fil. Ingen nye komponenter eller dependencies kraeves.

Overblik over aendringer:
- Fjern `DashboardHeader` i TV mode (behold i normal dashboard mode)
- Nyt hero-layout med ur + total salg
- Nyt klient-grid med glasmorfisme-stil
- Opdateret TV mode baggrund
- Tilfoej fade-in animation (bruger eksisterende `animate-fade-in` klasse)
- Behold al eksisterende datalogik uaendret

