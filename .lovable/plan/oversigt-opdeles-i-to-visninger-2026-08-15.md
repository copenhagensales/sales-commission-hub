# Oversigt opdeles i to visninger

Under "Oversigt" på Eesy FM afvigelser (Leder) tilføjes to valgbokse øverst, så man skifter mellem to visninger.

## Sådan ser det ud

```text
[ Afvigelser — oversigt ]   [ Mangler i PowerBI ]
        (aktiv)                  (inaktiv)

<indhold for den valgte visning>
```

- To klikbare kort side om side øverst i Oversigt-fanen. Aktivt kort markeres med primær kant/baggrund.
- **Afvigelser — oversigt**: præcis som i dag (filterrække + tabel med Salgsdato, Sælger, Mobil, Afvigelse, Tastselv, PowerBI, Type).
- **Mangler i PowerBI**: samme visuelle opsætning (titel, beskrivelse, filterrække, tabel), men tom tilstand "Ingen data endnu." indtil datalogikken bygges.
- Standardvisning ved åbning: Afvigelser — oversigt.

## Teknisk

- Kun `src/pages/vagt-flow/EesyFmDeviations.tsx` ændres (grøn zone: layout).
- Ny lokal state `overviewView: "deviations" | "missing"` i `OverviewTab`; de to kort er `Card`-baserede knapper.
- Eksisterende filterrække + tabel udtrækkes til en lille genbrugelig underkomponent i samme fil, så begge visninger deler layout med forskellige kolonner/titler.
- Ingen datahentning, ingen DB-, RLS- eller pricing-ændringer.
