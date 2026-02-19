

# System Kort: Komplet systemkort med alle moduler + dropdown-filter

## Oversigt

Ombyg "System Kort"-fanen til et reelt kort over HELE systemet -- ikke kun integrationer/dashboards, men alle applikationsmoduler: Rettigheder, Spil (Liga, H2H), Rekruttering, Onboarding, Vagtplan, Rapporter, Fieldmarketing, SOME, Oekonomi, Løn osv. Tilfoej en dropdown oeverst hvor man kan filtrere til specifikke dele af systemet.

## Nyt layout: Fuldt systemkort

Kortet viser hele applikationens arkitektur i logiske zoner:

```text
[DROPDOWN: Vis alle | Integrationer | Personale | Spil | Rekruttering | ...]

+--SYSTEM THROUGHPUT GAUGE (kun synlig paa "Vis alle" / "Integrationer")--+

+===========================================+
|            HELE SYSTEMET SOM KORT         |
+===========================================+

Zone 1: EKSTERNE KILDER
  Adversus API, Enreach API, Webhooks, Twilio, e-conomic API

Zone 2: BACKEND PROCESSING  
  Integration Engine, Webhook Processors, Edge Functions (60+ funktioner)

Zone 3: DATABASE LAYER
  Primaer DB (sales, employees, teams, contracts, ...)
  Auth & Sessions

Zone 4: APPLIKATIONSMODULER (den store nye del!)
  +-- Personale: Medarbejdere, Teams, Rettigheder, Login Log
  +-- Spil: Salgsligaen, Head-to-Head, Team H2H
  +-- Rekruttering: Pipeline, Kandidater, Winback, Beskeder
  +-- Onboarding: Kursus, Ramp-up, Drills, Coaching
  +-- Vagtplan: Vagtplan, Fravaer, Tidsregistrering, Stempelur
  +-- Fieldmarketing: Booking, Koeretojer, Salgsregistrering
  +-- Rapporter: Daglige, Ledelse, Annulleringer
  +-- Oekonomi: Dashboard, Udgifter, Budget, e-conomic Import
  +-- Løn: Løntyper, Lønkoersel
  +-- SOME: Indhold, Maal, Ekstraarbejde
  +-- Salg & System: Salg, Logikker, Live Stats, Indstillinger
  +-- Ledelse: Firmaoversigt, Kontrakter, Karriereoensker

Zone 5: KPI & CACHE
  pg_cron, KPI Functions, Cache Tabeller

Zone 6: OUTPUT
  Klient Dashboards (alle 10+), TV Boards, Softphone
```

## Dropdown-filter

Oeverst i kortet vises en Select-dropdown med muligheder:

| Vaelg | Viser |
|-------|-------|
| Vis hele systemet | Alt |
| Integrationer & Data | Zone 1-3 + Zone 5-6 (nuvaerende kort) |
| Personale & Rettigheder | DB -> Personale-moduler |
| Spil & Liga | DB -> Liga, H2H, Team H2H |
| Rekruttering | DB -> Rekruttering-moduler |
| Onboarding & Coaching | DB -> Onboarding-moduler |
| Vagtplan & Tid | DB -> Vagtplan-moduler |
| Fieldmarketing | DB -> FM-moduler |
| Oekonomi & Løn | DB -> Oekonomi + Løn + e-conomic |
| Rapporter | DB -> Rapport-moduler |
| Dashboards & Output | Cache -> Dashboards + TV |

Naar en specifik del vaelges, fades ikke-relevante noder ud (opacity + grayscale) mens den valgte sektion fremhaeves med fulde farver.

## Teknisk implementering

### Fil der aendres: `src/components/system-stability/SystemStatusMap.tsx`

Komplet omskrivning med:

1. **Dropdown** oeverst via `Select` komponent fra `@/components/ui/select`
2. **Udvidet node-liste** med alle applikationsmoduler grupperet i zoner
3. **Zone-baseret grid layout** -- vertikal flow med horisontale grupper inden i hver zone
4. **Fade-logik**: Noder der ikke matcher dropdown-valget faar `opacity-20 grayscale`
5. **Forbindelser**: SVG-linjer mellem zoner + interne forbindelser
6. **Status**: Integrationsrelaterede noder bruger live metriker. Applikationsmoduler viser statisk "ok" (de har ingen API-metrics men er altid aktive)

### Nye ikoner der bruges (alle fra lucide-react, allerede installeret):
- Shield (Rettigheder), Trophy (Liga), Swords (H2H), UserPlus (Rekruttering)  
- GraduationCap (Onboarding), Calendar (Vagtplan), MapPin (Fieldmarketing)
- FileBarChart (Rapporter), Wallet (Oekonomi), DollarSign (Løn)
- Share2 (SOME), ShoppingCart (Salg), Tv (TV Boards)

### Node-typer:

**Zone nodes** (store gruppekort med sub-items indeni):
- Viser zone-titel + antal moduler
- Indeholder sub-noder som smaa pills/chips

**Sub-nodes** (mindre chips inden i en zone):
- Viser ikon + navn
- Status-dot (altid groen for app-moduler, live for integrationer)

### Forbindelser mellem zoner:

```text
Eksterne Kilder --> Backend Processing --> Database
Database --> Applikationsmoduler (alle)
Database --> KPI Engine --> Output
Applikationsmoduler --> Output (dashboards laerer fra moduler)
```

### Dropdown-filter logik:

```text
type MapView = "all" | "integrations" | "personnel" | "games" | "recruitment" 
             | "onboarding" | "shifts" | "fieldmarketing" | "economy" 
             | "reports" | "dashboards";

// Hver node har et "zone" tag
// Naar filter !== "all", vis kun noder med matchende zone + altid vis DB
// Ikke-matchende noder: opacity-20 + grayscale filter
```

## Filer der aendres

| Fil | Aendring |
|-----|----------|
| `src/components/system-stability/SystemStatusMap.tsx` | Komplet omskrivning med alle moduler + dropdown |

Ingen andre filer roeres.

## Forventet resultat

| Element | Foer | Efter |
|---------|------|-------|
| Noder i kortet | 10 (kun integrationer + dashboards) | 50+ (hele systemet) |
| Dropdown-filter | Intet | 11 muligheder |
| Applikationsmoduler | Ikke vist | Alle 12+ sektioner synlige |
| Spil (Liga, H2H) | Ikke vist | Egen zone med forbindelser |
| Rettigheder | Ikke vist | Under Personale-zone |
| Fokus-mode | Intet | Fade/highlight ved filter-valg |

