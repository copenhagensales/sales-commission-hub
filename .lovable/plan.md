
# Sammenklappelig "Tidligere" sektion

## Hvad der aendres
"Tidligere"-sektionen paa Kommende Opstarter-siden goeres sammenklappelig med Collapsible-komponenten, saa den er lukket som standard. Alle andre sektioner (I dag, I morgen, Denne uge, Kommende) vises som normalt.

## Implementering

### Fil: `src/pages/personnel/UpcomingStarts.tsx`

1. Importerer `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` fra `@/components/ui/collapsible` og `ChevronRight`-ikonet fra `lucide-react`.

2. Tilfoej state: `const [pastOpen, setPastOpen] = useState(false)` - lukket som standard.

3. Aendrer renderingen af "Tidligere"-sektionen (linje 765) fra `renderSection("Tidligere", past)` til en dedicated Collapsible-blok:
   - Header med "Tidligere" titel + badge med antal + chevron-ikon der roterer naar den er aaben
   - Klikbar header-linje der toggler sektionen
   - Indholdet (grid med cohort-kort) vises kun naar den er foldet ud

### Visuelt resultat
- Lukket: En kompakt linje med "Tidligere (8)" og en pil
- Aaben: Linjen udvides og viser alle tidligere hold i det samme grid-layout som foer
