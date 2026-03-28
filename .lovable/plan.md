

## Fix: Skjul allerede mappede produkter fra dropdown

### Ændring

**Fil: `src/components/cancellations/SellerMappingTab.tsx`, linje 444**

Filtrer produkter der allerede har betingelser ud af dropdown-listen:

```typescript
// Before
{products.map(p => (

// After  
{products.filter(p => !productsWithConditions.includes(p.id)).map(p => (
```

Produkter med eksisterende betingelser vises allerede i tabellen nedenunder og kan redigeres ved klik. De skal ikke kunne vælges igen i dropdown'en.

