## Mål
På MG Test → produkt → "Regler" tab: gør det tydeligt hvilke regler der er udløbet (`effective_to` overskredet), og placer dem nederst under de stadigt gyldige.

## Ændringer

**Fil:** `src/components/mg-test/ProductPricingRulesDialog.tsx` (grøn zone – kun visuel/præsentation, ingen ændring af pricing-logik).

### 1. Sortering
I "Regler"-tab, før `.map()`:
- Split `rules` i to grupper:
  - **Gyldige:** `effective_to === null` ELLER `effective_to >= today`
  - **Udløbne:** `effective_to !== null` OG `effective_to < today`
- Behold eksisterende rækkefølge inden for hver gruppe (priority DESC som RPC'en leverer).
- Render gyldige først, derefter udløbne.

### 2. Visuel markering af udløbne regler
På kortet for udløbne regler:
- Rød venstre-border + svag rød baggrund (`border-l-4 border-l-destructive bg-destructive/5`) – tydeligere end nuværende `opacity-60` for inaktive.
- Ny badge `Udløbet` (destructive variant) ved siden af "Prioritet"-badge.
- Lille linje under navnet: `Udløb: {format(effective_to, "d. MMMM yyyy", { locale: da })}`.
- Provision/omsætning-tal får `line-through text-muted-foreground` så det er visuelt klart at reglen ikke længere anvendes.

### 3. Sektionsopdeling (kun hvis der findes udløbne regler)
Lille header mellem grupperne: `— Udløbne regler —` (muted, small caps) så adskillelsen er læsbar.

## Uden for scope
- Ingen ændring i `pricingRuleMatching.ts`, `rematch-pricing-rules` eller RPC. Motoren håndterer allerede `effective_to`.
- Ingen ændring af "Hovedside"/"Historik"-tabs.
- Ingen sortering ændret for aktive regler (priority-rangorden bevares).
