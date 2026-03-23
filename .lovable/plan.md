

# Gør hotelpris obligatorisk ved booking

## Ændring

### `src/components/vagt-flow/AssignHotelDialog.tsx`

1. **Valideringsguard i `handleSubmit`** (linje 85): Tilføj check at `pricePerNight` skal være udfyldt og > 0 før submit tillades — vis toast-fejl hvis mangler
2. **Submit-knap disabled**: Disable knappen når `pricePerNight` er tom
3. **Visuelt krav**: Tilføj `*` ved pris-label og rød border hvis tom ved submit-forsøg

| Fil | Ændring |
|-----|---------|
| `src/components/vagt-flow/AssignHotelDialog.tsx` | Gør pris obligatorisk med validering + visuelt krav |

