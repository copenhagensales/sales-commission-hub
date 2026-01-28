
# Plan: Optimal Logo Baggrund Farve

## Mål
Vælg en baggrund til klient-logoer der:
- Passer med det mørke UI/UX design
- Giver god kontrast til både lyse og mørke logoer
- Ikke er for lys (skærer i øjnene) eller for mørk (sluger logoer)

## Analyse af Eksisterende Farver

Projektets farve palette (fra `src/index.css`):
- **Background**: `hsl(222 47% 9%)` - meget mørk blå
- **Card**: `hsl(222 47% 12%)` - lidt lysere mørk blå  
- **Secondary**: `hsl(222 30% 20%)` - mellem mørkeblå
- **Muted**: `hsl(222 30% 25%)` - lysere mellemtone

## Anbefaling

Brug en **blød mellemgrå-blå** tone der er neutral nok til alle logoer:

**Valg: `bg-[hsl(220,20%,25%)]`** eller Tailwind's `bg-zinc-700/80`

Denne farve:
- Er ikke for mørk som `slate-800`
- Er ikke for lys som hvid
- Har en neutral undertone der passer med UI'ets blå-grå palette
- Giver god kontrast til både hvide (YouSee) og farvede (Eesy) logoer

## Ændring

**Fil:** `src/pages/dashboards/CphSalesDashboard.tsx`

Udskift `bg-slate-800` med `bg-zinc-700/90`:

```tsx
// Fra
<div className={`... bg-slate-800 ...`}>

// Til  
<div className={`... bg-zinc-700/90 ...`}>
```

`bg-zinc-700/90` giver en blød, neutral grå-tone (~`hsl(240, 5%, 34%)`) med 90% opacity der:
- Matcher det professionelle dark theme
- Virker godt med både lyse og mørke logoer
- Har en subtil gennemsigtighed der integrerer med baggrunden
