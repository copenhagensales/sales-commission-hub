

# Fix: Dubletter for TDC Erhverv baseret på OPP-nummer

## Problem
Dubletter-fanen grupperer kun på telefonnummer. For TDC Erhverv er det OPP-nummeret der definerer om noget er et dublet — samme OPP kan have flere salg (lovligt, da et OPP kan deles mellem sælgere), men det er også der man finder reelle dubletter. Med telefonnummer-logik finder systemet "ingen dubletter" fordi TDC-salg ofte har dummy-telefonnumre.

## Løsning
Gør grupperingslogikken i `DuplicatesTab.tsx` kundespecifik:
- **TDC Erhverv** → gruppér på OPP-nummer (fra `raw_payload`)
- **Alle andre kunder** → behold nuværende telefonnummer-gruppering

## Ændringer i `DuplicatesTab.tsx`

### 1. Importér `CLIENT_IDS` og tilføj OPP-ekstraktion
- Importér `CLIENT_IDS` fra `@/utils/clientIds`
- Tilføj `extractOpp()` funktion (samme som i `UploadCancellationsTab`)

### 2. Betinget gruppering i `duplicateGroups` useMemo
- Hvis `selectedClientId === CLIENT_IDS["TDC Erhverv"]`: gruppér salg på OPP-nummer i stedet for telefon
- Ellers: behold nuværende telefon-gruppering
- OPP-grupper viser OPP-nummeret som group key i stedet for telefon

### 3. UI-tilpasning
- Vis "OPP" label i stedet for telefon-ikon når det er TDC
- Vis OPP-nummer i stedet for telefonnummer i gruppeoverskriften

| Fil | Ændring |
|-----|---------|
| `DuplicatesTab.tsx` | Tilføj OPP-ekstraktion, betinget gruppering per kunde |

