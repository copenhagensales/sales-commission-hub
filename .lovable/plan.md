

# Opdater lokationstyper: Erstat "Butik" med "Coop butik" og "Meny butik"

## Aendring

### Fil: `src/pages/vagt-flow/LocationDetail.tsx` (linje ~196-200)

Fjern `<SelectItem value="Butik">Butik</SelectItem>` og tilfoej to nye muligheder i stedet:

```
<SelectItem value="Coop butik">Coop butik</SelectItem>
<SelectItem value="Meny butik">Meny butik</SelectItem>
```

Den fulde liste bliver:
1. Coop butik
2. Meny butik
3. Danske Shoppingcentre
4. Ocean Outdoor
5. Markeder
6. Messer

Standardprisen forbliver 1.000 kr for de nye typer (kun "Danske Shoppingcentre" har 1.500 kr).

