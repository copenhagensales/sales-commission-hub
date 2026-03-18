
Mål
- Fjerne begge elementer i toppen af `/commission-league`: tandhjul (sæsonindstillinger) og knappen “Opdater”, så headeren bliver renere.

Afklaring (ud fra dit valg)
- Du har bekræftet, at **begge dele** skal fjernes.

Implementeringsplan
1) Opdatér top-headeren i `src/pages/CommissionLeague.tsx`
- Fjern action-rækken i `CollapsibleContent`, hvor følgende vises:
  - `SeasonSettingsDialog` (tandhjul)
  - `Opdater`-knappen med refresh-ikon

2) Ryd op i ubrugt kode i samme fil
- Fjern import af `SeasonSettingsDialog`.
- Fjern `RefreshCw` fra ikon-importen.
- Fjern `isOwner` fra `useUnifiedPermissions()` hvis den ikke længere bruges.
- Behold `handleCalculateStandings`, fordi den stadig bruges ved tilmelding (`handleEnroll` kalder den).

3) Bevar eksisterende struktur/UX
- Behold `Collapsible`-headeren og resten af siden uændret.
- Ingen ændringer i backend eller datalogik.

Tekniske detaljer
- Primær fil: `src/pages/CommissionLeague.tsx`
- Berørte områder:
  - Import-sektion (fjerne ubrugte imports)
  - Header-blok omkring `CollapsibleContent`
  - Permissions-destructuring (`isOwner`)
- Ingen databaseændringer.
- Ingen ændringer i hooks, edge-funktioner eller RLS.

Forventet resultat
- Øverste højre del i headeren viser ikke længere tandhjul + “Opdater”.
- UI fremstår mere minimalistisk, som ønsket.
- Ingen funktionel regression for almindelige brugere; manuel opdatering og sæsonindstillinger fra denne side fjernes.

Validering efter implementering
- Åbn `/commission-league` og bekræft:
  1) Tandhjul er væk
  2) “Opdater”-knappen er væk
  3) Resten af siden (rules, prize cards, boards, fan/tilmeld-flow) virker som før
