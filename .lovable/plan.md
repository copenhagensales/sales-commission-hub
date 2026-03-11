

# Fix: Synkroniser Tiptap-editor med underskriftsside

## Problem
Tiptap (rich text editoren) injicerer sin egen CSS via `.tiptap` / `.ProseMirror` klassen, som sætter default margins på `<p>` tags (`margin: 1em 0`), lister, blockquotes osv. Disse interne styles eksisterer **kun** i editoren — de er ikke til stede på underskriftssiden, som bruger ren `dangerouslySetInnerHTML`. Derfor ser skabelonen anderledes ud end den endelige kontrakt, selvom begge bruger `CONTRACT_PROSE_SIGN_CLASSES`.

## Løsning
Tilføj CSS-overrides i `src/index.css` der nulstiller Tiptap's default margins, så editoren arver 100% fra prose-klasserne — præcis som underskriftssiden gør.

### Fil: `src/index.css`
Tilføj i bunden:

```css
/* Reset Tiptap/ProseMirror default spacing so editor matches signing page */
.tiptap p,
.ProseMirror p {
  margin-top: 0;
  margin-bottom: 0;
}

.tiptap ul,
.tiptap ol,
.ProseMirror ul,
.ProseMirror ol {
  margin-top: 0;
  margin-bottom: 0;
}

.tiptap blockquote,
.ProseMirror blockquote {
  margin-top: 0;
  margin-bottom: 0;
}

.tiptap h1, .tiptap h2, .tiptap h3,
.ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
  margin-top: 0;
  margin-bottom: 0;
}
```

Disse regler fjerner Tiptap's egne margins, så det udelukkende er Tailwind prose-klasserne (fra `CONTRACT_PROSE_SIGN_CLASSES`) der styrer afstande — identisk med underskriftssiden.

## Resultat
Editoren viser præcis samme linjeafstand og mellemrum som den kontrakt medarbejderen ser ved underskrift.

