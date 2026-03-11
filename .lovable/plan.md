

# Synkroniser linjeafstand mellem editor og underskriftsside

## Problem
Tiptap-editoren (RichTextEditor.tsx linje 342) renderer `EditorContent` med kun `className="bg-background"` — ingen prose-styles. Underskriftssiden bruger `CONTRACT_PROSE_SIGN_CLASSES` med margins og line-height. Derfor ser de forskellige ud.

## Løsning
Tilføj de samme prose-styles til Tiptap-editorens `EditorContent` wrapper, så det man skriver i editoren visuelt matcher det underskriveren ser.

### Ændringer

1. **`src/components/contracts/RichTextEditor.tsx`** (linje 342):
   - Wrap `EditorContent` i en container med `CONTRACT_PROSE_SIGN_CLASSES` og `bg-white` baggrund
   - Importér `CONTRACT_PROSE_SIGN_CLASSES` fra `contractProseStyles`
   - Giver WYSIWYG — det du ser i editoren er det du får på papiret

2. **Evt. juster `contractProseStyles.ts`**:
   - Reducér `[&_p:empty]:min-h-[1em]` og `[&_p+p]:mt-2` hvis det stadig giver for meget luft i editoren
   - Finjuster `prose-p:my-2` → `prose-p:my-1` hvis nødvendigt for tættere match

Resultatet: Editor, admin-preview og underskriftsside bruger alle de samme prose-klasser = identisk layout overalt.

