

# Ny fane: Posteringer (udspecificeret)

## Hvad du faar
En ny fane "Posteringer" i Economic-navigationen, der viser alle importerede posteringer i en soegbar, filtrerbar tabel.

### Funktioner
- Fuld tabel med kolonner: Dato, Konto nr, Kontonavn, Tekst, Beloeb, Kategori, Team, Kilde
- Soegefelt (soeg i tekst, kontonavn)
- Filtre: Aar, Kategori, Team
- Sortering paa alle kolonner (default: dato faldende)
- Farvemarkering af indtaegter (groent) vs. udgifter (roedt)
- Badge der viser klassificeringskilde (regel/mapping/fallback)
- Paginering eller scroll med alle posteringer synlige

## Teknisk plan

### 1. Ny side: `src/pages/economic/EconomicPosteringer.tsx`
- Bruger eksisterende `usePosteringerEnriched` hook til at hente data
- Soegefelt filtrerer lokalt paa tekst og kontonavn
- Select-filtre for aar, kategori og team (genbruger eksisterende hooks)
- Tabel med alle felter fra `PosteringEnriched`
- `formatDKK` til beloeb-formatering

### 2. Opdater `src/pages/economic/EconomicLayout.tsx`
- Tilfoej nyt nav-item: `{ path: "/economic/posteringer", label: "Posteringer", icon: List }`

### 3. Opdater routing (App.tsx eller routes config)
- Tilfoej route: `/economic/posteringer` -> `EconomicPosteringer`

