

## Gør draft-styling på markeder tydeligere

Regulære bookinger har allerede tydelig draft-styling (linje 971):
- `border-l-4 border-l-yellow-500 bg-yellow-50/30 dark:bg-yellow-950/10`

Markeds-bookinger (linje 1251) har kun `p-4 border rounded-lg bg-card` — ingen visuel draft-indikation ud over badge'et.

### Ændring

**Fil**: `src/pages/vagt-flow/BookingsContent.tsx`, linje 1251

Tilføj samme conditional styling til markedsbookinger:
- Gul venstre-border (`border-l-4 border-l-yellow-500`)
- Let gul baggrund (`bg-yellow-50/30 dark:bg-yellow-950/10`)

Én linje ændres — markedsbookinger vil visuelt matche de regulære bookinger når de er drafts.

