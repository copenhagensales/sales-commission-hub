

## Fix: Bevar mellemrum og linjeskift fra skabelonen i kontraktvisningen

### Problem
Når der laves linjeskift (Enter/Shift+Enter) i kontraktskabelonens rich text editor, gemmes de som `<br>` tags og tomme `<p>` tags i HTML'en. Men i kontraktvisningen (både `ContractSign.tsx` og `Contracts.tsx` preview) overskrives deres naturlige spacing af disse CSS-regler:

```css
[&_br]:block [&_br]:content-[''] [&_br]:h-0.5   /* Kollapser <br> til 2px */
prose-p:my-5                                       /* Fast margin på alle <p> */
```

`<br>` tags får kun 2px højde i stedet for en normal linjehøjde, så mellemrum forsvinder.

### Løsning
1. **`src/pages/ContractSign.tsx`** (linje 468): Ændr `[&_br]:h-0.5` til `[&_br]:h-[1em]` så linjeskift respekterer den naturlige linjehøjde. Fjern `content-['']` så `<br>` opfører sig normalt.

2. **`src/pages/Contracts.tsx`** (preview-modal): Tilføj samme fix så preview også viser korrekte mellemrum.

3. Bevar tomme `<p>` tags' spacing ved at tilføje `[&_p:empty]:min-h-[1em]` så tomme paragraffer fra editoren også vises som mellemrum.

### Ændringer
- **Fil 1**: `src/pages/ContractSign.tsx` — opdater `<br>` CSS-regel og tilføj `p:empty` regel
- **Fil 2**: `src/pages/Contracts.tsx` — samme ændring i preview-prose-styling

Ingen database-ændringer. Ren CSS-fix.

