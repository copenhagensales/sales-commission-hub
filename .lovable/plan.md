

## Ændr markedsbookinger fra blå/indigo til samme grønne stil som normale bookinger

### Problem
Markedsbookinger ("Markeder denne uge") bruger en blå/indigo farveskala, som er svær at se i dark mode. Normale bookinger bruger `primary`-farver (grøn), som ser bedre ud.

### Ændring
En enkelt fil: `src/pages/vagt-flow/BookingsContent.tsx`

Erstat alle indigo-farver i markedsektionen (linje 800-872) med de samme `primary`-baserede farver som normale bookinger:

- **Kort-ramme (linje 800):** `border-indigo-200 bg-indigo-50/30 dark:border-indigo-800 dark:bg-indigo-950/20` bliver til ingen specielle farver (standard `Card`)
- **Ikon-cirkel (linje 804):** `bg-indigo-100 dark:bg-indigo-900/40` bliver til `bg-primary/10`
- **Ikon (linje 805):** `text-indigo-600 dark:text-indigo-400` bliver til `text-primary`
- **Dag-celler (linje 862):** `bg-indigo-100/60 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700` bliver til `bg-primary/10 border border-primary/20`
- **Medarbejder-navne (linje 872):** `text-indigo-700 dark:text-indigo-300` bliver til `text-primary`

