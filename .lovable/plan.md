

## Plan: Forhindre genbrug af matchede salg

### Problem
`linkSaleMutation.onSuccess` i `LocateSaleDialog.tsx` invaliderer ikke `["used-sale-ids"]` query-cachen. Derfor vises det netop matchede salg stadig som valgbart næste gang dialogen åbnes.

### Løsning

**Fil:** `src/components/cancellations/LocateSaleDialog.tsx` (linje 238-243)

Tilføj én linje i `onSuccess`:

```typescript
onSuccess: () => {
  toast({ title: "Salg koblet til annullering og sendt til godkendelseskøen" });
  queryClient.invalidateQueries({ queryKey: ["used-sale-ids", clientId] }); // NY
  queryClient.invalidateQueries({ queryKey: ["match-errors", clientId] });
  queryClient.invalidateQueries({ queryKey: ["match-errors-count"] });
  queryClient.invalidateQueries({ queryKey: ["cancellation-queue"] });
  onOpenChange(false);
},
```

Dette sikrer at listen over brugte sale_ids genindlæses, så allerede matchede salg filtreres væk i `filtered`-memo'et (linje 170-175).

### Fil
- `src/components/cancellations/LocateSaleDialog.tsx` — tilføj 1 linje

