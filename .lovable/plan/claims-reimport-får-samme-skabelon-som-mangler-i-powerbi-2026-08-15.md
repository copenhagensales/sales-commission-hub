# Claims/Reimport får samme skabelon som "Mangler i PowerBI"

## Ændring
Fanen **Claims/Reimport** (Eesy FM afvigelser) bruger samme opsætning som "Mangler i PowerBI": overskrift, filtre (hurtig valg, fra/til dato, søg, medarbejder) og tabel.

Kolonner:

```text
Salgsdato | Sælger | Mobil | Tastselv | Notat | [blyant]
```

- **Notat** er den bredeste kolonne (fylder resten af pladsen).
- Blyant-ikonet længst til højre pr. række, ligesom under "Mangler i PowerBI" (kun UI indtil logikken er klar).

## Teknisk
- Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx`
- Tilføj `CLAIMS_COLUMNS = ["Salgsdato", "Sælger", "Mobil", "Tastselv", "Notat"]`.
- Genbrug `DeviationsPanel` i `TabsContent value="raw"` med titel "Claims/Reimport", kort beskrivelse, `columns={CLAIMS_COLUMNS}` og `showRowActions`.
- Lad `DeviationsPanel` sætte `className="w-full min-w-[240px]"` på Notat-kolonnen (bred kolonne), øvrige `whitespace-nowrap` som i dag.
- Ingen data-/backend-ændringer.
