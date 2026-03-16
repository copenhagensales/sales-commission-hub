

## Fjern decimaler fra provision i Salgsligaen

Provision-værdien i QualificationBoard vises med decimaler (f.eks. "3.599,25 kr") fordi `toLocaleString("da-DK")` kaldes uden `maximumFractionDigits: 0`.

### Ændring
**1 fil, 1 linje:**
- `src/components/league/QualificationBoard.tsx` linje 259: Tilføj `{ maximumFractionDigits: 0 }` til `toLocaleString`-kaldet, så det vises som "3.599 kr" i stedet for "3.599,25 kr".

