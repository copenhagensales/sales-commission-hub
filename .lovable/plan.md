

# Fix: Fjern konflikerende prose-styles fra Tiptap editor

## Problem
`RichTextEditor.tsx` linje 87 sætter `prose prose-sm` på selve editor-elementet. Den ydre wrapper (linje 343) har `CONTRACT_PROSE_SIGN_CLASSES` som inkluderer `prose prose-neutral` med `prose-base` og specifikke line-heights. De to prose-lag konflikter — `prose-sm` vinder og giver tættere linjeafstand end underskriftssiden.

## Løsning
Fjern `prose prose-sm` fra `editorProps.attributes.class` i `RichTextEditor.tsx` (linje 87). Behold kun layout-klasser (`max-w-none focus:outline-none min-h-[300px]`). Fjern også den redundante `p-4` da wrapperen allerede har padding.

### Fil: `src/components/contracts/RichTextEditor.tsx`
- **Linje 87**: Ændr `class` fra `'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4'` til `'max-w-none focus:outline-none min-h-[300px]'`

Resultat: Editoren arver korrekt prose-styling fra den ydre `CONTRACT_PROSE_SIGN_CLASSES` wrapper — identisk linjeafstand som underskriftssiden.

