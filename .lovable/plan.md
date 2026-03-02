# TDC Opsummering – Nuværende tilstand

## Opsummeringstyper
Tre gensidigt udelukkende typer via `SummaryVariant`:
- **Standard** (`"standard"`) – fuld opsummering med alle sektioner
- **Pilot** (`"pilot"`) – tilpassede formuleringer:
  - Vilkår: 7 hverdages fortrydelsesret + welcome call
  - Nummervalg: nye formuleringer
  - Opstart: skjult (ikke påkrævet)
  - Omstilling: welcome call i stedet for standard
- **Kun 5g Fri Salg** (`"5g-fri"`) – forenklet opsummering kun til 5G Fri produkter

## Status
- `TdcOpsummering.tsx`: ✅ Implementeret
- `TdcOpsummeringPublic.tsx`: ❌ Mangler synkronisering

## Næste skridt
Synkroniser `TdcOpsummeringPublic.tsx` med samme ændringer som `TdcOpsummering.tsx`.
