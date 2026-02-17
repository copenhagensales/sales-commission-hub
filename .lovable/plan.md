

## Tilfoej "Gem" knap til Rediger kurv

### Oversigt
Tilfoej en groen "Gem"-knap i dialogen, som kun vises naar der er foretaget aendringer i kurven (antal aendret, produkt tilfojet eller fjernet).

### AEndringer i EditCartDialog.tsx

**Dirty-state tracking:**
- Tilfoej en `isDirty` state der saettes til `true` naar:
  - Et produkts antal aendres via `updateQuantityMutation.onSuccess`
  - Et produkt tilfojes (via `AddProductSection` callback `onAdded`)
  - Et produkt fjernes via `deleteItemMutation.onSuccess`

**Gem-knap:**
- Groen knap med teksten "Gem" i footer-omraadet
- Vises kun naar `isDirty === true`
- Klik paa knappen lukker dialogen (aendringerne er allerede gemt i databasen via mutations)
- Styling: `bg-green-600 hover:bg-green-700 text-white`

**Placering i footer:**
- "Gem"-knappen placeres som den foerste/primaere knap i footeren (til hoejre)
- Raekkefoelje: Luk | Annuller hele salget | Afvis hele salget | **Gem**

### Fil der aendres
1. `src/components/cancellations/EditCartDialog.tsx`
