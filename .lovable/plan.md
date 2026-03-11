

# Kontraktvisning: Spacing-forskel mellem editor og underskriftsside

## Analyse

Problemet er at **prose-styles er forskellige** mellem de tre steder kontraktindhold vises:

1. **Tiptap Editor** (`RichTextEditor.tsx`): Bruger Tiptaps standard ProseMirror-styles — ingen custom prose-klasser
2. **Admin preview** (`Contracts.tsx`, linje 663-741): Custom prose-styles med moderat spacing (`prose-p:my-4`, `prose-h2:mt-10`)
3. **Underskriftsside** (`ContractSign.tsx`, linje 456-523): Mere aggressive spacing (`prose-h2:mt-14`, `prose-h1:mb-16`, `leading-[1.9]` på paragraphs)

Forskellen i dit screenshot — ekstra mellemrum mellem linjer — skyldes primært:
- `leading-[1.9]` på paragraphs i ContractSign (vs `leading-[1.8]` i preview)
- `prose-p:my-4` giver margin mellem alle `<p>` tags
- `[&_p+p]:mt-4` tilføjer yderligere margin
- Tiptap genererer `<p>` tags for hver linje, så normal tekst med linjeskift bliver til separate `<p>` elementer med margin imellem

## Løsning

Ekstraher prose-styles til én delt utility/konstant og brug den i **alle tre visninger** (admin preview, underskriftsside, og evt. editor-preview). Så spejler de altid 1:1.

### Ændringer

1. **Opret `src/utils/contractProseStyles.ts`** — én konstant med alle prose-klasser
2. **Opdater `ContractSign.tsx`** — brug den delte konstant
3. **Opdater `Contracts.tsx`** — brug den delte konstant
4. **Juster spacing** — reducér `prose-p:my-4` til `prose-p:my-2` og `leading-[1.9]` til `leading-[1.7]` for at matche Tiptap-editorens tættere linjespacing

Dette sikrer at kontraktindhold ser ens ud overalt — det man ser i skabelonen er det man får i underskriften.

