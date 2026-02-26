

## Fix: Bemærkninger og kampagne forsvinder ved genåbning

### Problem
1. **Bemærkninger forsvinder**: Når bookingen gemmes fra "Rediger booking"-dialogen, invalideres kun `vagt-bookings-list` og `vagt-billing-bookings` query-cache -- men IKKE `vagt-market-bookings`. Sa nar dialogen abnes igen fra Markeder-visningen, bruges gamle (stale) data uden den opdaterede bemærkning.
2. **Kampagne skal vælges igen**: Samme problem -- `campaign_id` er gemt korrekt i databasen, men den lokale booking-data er stale, sa `campaign_id` er `null` i den gamle cache.

### Losning

**Fil: `src/components/vagt-flow/EditBookingDialog.tsx`**

Tilføj `vagt-market-bookings` til invalidation i `updateBookingMutation.onSuccess` (linje 653-657):

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
  queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] }); // TILFOJET
  queryClient.invalidateQueries({ queryKey: ["vagt-billing-bookings"] });
  toast.success("Booking opdateret");
  onOpenChange(false);
},
```

Dette sikrer at booking-data genindlæses fra databasen med de opdaterede felter (comment, campaign_id osv.), uanset om dialogen åbnes fra Bookings- eller Markeder-visningen.

### Omfang
- 1 linje tilfojet i 1 fil
- Ingen database-aendringer
- Loser begge problemer (bemærkning + kampagne) da begge skyldes stale cache

