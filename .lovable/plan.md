

## Problem: `tab_fm_hotels` mangler i permission-gruppen

Rettigheden `tab_fm_hotels` er korrekt defineret i `permissionKeys.ts` med `parent: 'menu_fm_booking'`, men den er **ikke tilføjet** til `children`-arrayet i `permissionGroups.ts` under `menu_fm_booking`.

Det betyder at Hotel-fanen ikke vises som en del af Booking-gruppen i Permission Editor, og derfor kan den ikke tildeles til Thomas' rolle.

### Fix

**Fil: `src/components/employees/permissions/permissionGroups.ts`** (linje 13)

Tilføj `'tab_fm_hotels'` til `menu_fm_booking.children`:

```typescript
// Fra:
children: ['tab_fm_book_week', 'tab_fm_bookings', 'tab_fm_markets', 'tab_fm_locations', 'tab_fm_vagtplan']

// Til:
children: ['tab_fm_book_week', 'tab_fm_bookings', 'tab_fm_markets', 'tab_fm_locations', 'tab_fm_vagtplan', 'tab_fm_hotels']
```

Derefter skal rettigheden `tab_fm_hotels` tildeles Thomas' rolle (via Permission Editor), og han vil kunne se og redigere hoteller.

