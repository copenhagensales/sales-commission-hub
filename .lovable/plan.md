

## Fix: Merge-dialog viser nu korrekte produkter for Eesy TM

Koden er allerede opdateret til at bruge `get_aggregated_product_types` RPC'en — samme datakilde som hovedtabellen. Problemet er at den nuværende kode stadig kan have subtile forskelle i forhold til hovedtabellen:

1. **RPC returnerer duplikerede `product_id`'er** (f.eks. "Fri tale + fri data" og "Venta General" optræder flere gange). Den nuværende `seen`-Map deduplikerer korrekt.
2. **RPC returnerer rækker med `product_id = NULL`** (4 rækker for Eesy TM). Disse filtreres korrekt fra med `r.product_id &&`.
3. **Hovedtabellen viser "adversus_product_title" som primært navn**, men merge-dialogen viser `product_name` (internt navn). For bedre genkendelse bør merge-dialogen også vise `adversus_product_title` når det er tilgængeligt.

### Ændringer

**Fil: `src/components/mg-test/ProductMergeDialog.tsx`**

1. **Tilføj `adversus_product_title` til `ProductRow`-interfacet** så brugeren kan genkende produkterne ud fra det navn de ser i hovedtabellen.
2. **Vis `adversus_product_title` som undertekst** i produktlisten (step 2), ligesom hovedtabellen viser "Internt produkt: ..." under adversus-titlen.
3. **Brug `adversus_product_title` som primært visningsnavn** når det er tilgængeligt, med `product_name` som fallback — dette matcher hovedtabellens visning.
4. **Behold den nuværende RPC + kampagne-baserede hentning** da den allerede matcher hovedtabellen korrekt for Eesy TM (alle 40 unikke produkter).

### Teknisk detalje

```text
ProductRow interface:
+ adversusTitle: string | null   // fra RPC'ens adversus_product_title

loadProducts():
  name: r.adversus_product_title ?? r.product_name ?? "Ukendt"
  adversusTitle: r.adversus_product_title

Step 2 UI:
  Primært: p.name (adversus title)
  Sekundært: "Internt: {product_name}" i lille tekst
```

