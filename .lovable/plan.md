

# Tilføj opsætnings-administration + Eesy TM filter

## Problem
Vi fjernede mapping-trinnet, men nu er der ingen måde at oprette nye opsætninger. Eesy TM mangler en config, og filtreringsfunktionen (`filter_column`/`filter_value`) — som allerede er i DB og kode — kan ikke konfigureres.

## Løsning
Tilføj en **opsætnings-sektion** i upload-trinnet, som vises når der ingen config er. Når der allerede er en config, viser vi den som nu (auto-match).

## Ændringer

### 1. UploadCancellationsTab.tsx — Inline config-oprettelse

Erstat den nuværende blokerings-besked ("Ingen opsætning fundet") med en inline config-oprettelsesformular:

**Når `clientConfigs.length === 0`:**
- Vis besked: "Ingen opsætning fundet — opret en herunder"
- Vis en fil-upload dropzone (til at hente kolonnenavne fra filen)
- Når filen er indlæst, vis mapping-felter:
  - Telefonkolonne (dropdown med kolonner fra filen)
  - OPP-kolonne
  - Medlemsnummer-kolonne
  - Virksomhedskolonne
  - **Filterkolonne** (dropdown: vælg f.eks. "Annulled Sales")
  - **Filterværdi** (tekstfelt: f.eks. "1")
  - Badge: "X af Y rækker inkluderet" baseret på filter
  - Config-navn (tekstfelt)
  - "Gem opsætning" knap
- Efter gem → invalidér query → configs reloades → nu vises normal upload-flow

**Når `clientConfigs.length > 0`:**
- Behold nuværende flow (dropzone → auto-match → preview)
- Tilføj en lille "Rediger opsætning" knap der åbner en dialog med de samme felter, pre-filled fra den aktuelle config

### 2. Flow for Eesy TM
1. Bruger vælger Eesy TM → ser "Opret opsætning"
2. Uploader eksempelfil → kolonner vises
3. Sætter: Phone → "Phone Number", Filter → "Annulled Sales" = "1"
4. Navngiver: "Eesy TM Standard", gemmer
5. Næste gang: auto-match med filter aktiv

## Tekniske detaljer
- Ingen DB-migration nødvendig — `filter_column` og `filter_value` eksisterer allerede
- `saveConfigMutation` eksisterer allerede i koden og bruges direkte
- Preview-badge beregning: `parsedData.filter(row => String(row.originalRow[filterColumn]) === filterValue).length`
- Genbrug eksisterende `applyConfig`, `handleMatch`, `saveConfigMutation`

