

## Fix: Sørg for at kontraktens visning matcher skabelonens opsætning

### Problem
Skabelonen redigeres i en Tiptap rich text editor med `prose prose-sm` (standard Tailwind Typography styling). Men kontraktvisningen (`ContractSign.tsx` og `Contracts.tsx`) overskriver næsten al prose-styling med custom CSS-regler der ændrer mellemrum, margins og line-heights markant. Resultatet er at den endelige kontrakt ser anderledes ud end skabelonen.

Konkrete forskelle:
- **Paragraffer**: Editoren bruger `prose-sm` default (`my-4` ~16px margin). Vieweren sætter `prose-p:my-5` (20px) + `text-justify` + `hyphens-auto` — ændrer layout.
- **`<br>` tags**: Nu sat til `h-[1em]` men mangler stadig naturlig line-height rendering i visse kontekster.
- **Overskrifter**: Editoren bruger `prose-sm` defaults. Vieweren overskriver med custom `font-size`, `mt/mb` og `tracking-wider` — ændrer spacing.
- **Lister**: Editoren har default indrykning. Vieweren sætter `list-none` på `<ol>` og fjerner standard nummerering, tilføjer custom spacing.
- **Tomme paragraffer**: `[&_p:empty]:min-h-[1em]` er tilføjet men Tiptap genererer ofte `<p><br></p>` for tomme linjer, ikke `<p></p>` — så reglen rammer ikke altid.

### Løsning
Tilpas viewerens CSS så den matcher editorens output tættere:

1. **`ContractSign.tsx`** — Juster prose-overrides:
   - Ændr `prose-p:my-5` → `prose-p:my-4` (matcher editor default)
   - Fjern `prose-p:text-justify prose-p:hyphens-auto` (editoren viser venstrejusteret)
   - Tilføj `[&_p_br]:h-auto` så `<br>` inde i paragraffer opfører sig normalt
   - Tilføj `[&_p:has(br:only-child)]:min-h-[1em]` for Tiptaps tomme linjer (`<p><br></p>`)
   - Behold `[&_p:empty]:min-h-[1em]` som fallback

2. **`Contracts.tsx`** (preview-modal) — Samme justeringer som ovenfor.

3. **`ContractSign.tsx`** — Fjern `[&_br]:h-[1em]` og erstat med mere nuanceret tilgang:
   - `[&_br]:block` (behold)
   - Fjern den faste højde — lad `<br>` bruge sin naturlige linjehøjde
   - Tilføj `[&_p+p]:mt-4` for at sikre paragraf-spacing er konsistent

4. **PDF-generering** (`contractPdfGenerator.ts` og edge function) — Opdater `.content p` CSS i PDF'en med tilsvarende spacing så PDF også matcher.

### Ændringer
- **`src/pages/ContractSign.tsx`**: Juster 4-5 prose CSS-regler i content-containeren
- **`src/pages/Contracts.tsx`**: Samme justeringer i preview-prose-styling
- **`src/utils/contractPdfGenerator.ts`**: Juster `.content p` margin til at matche

Ingen database-ændringer. Ren CSS/styling-fix.

