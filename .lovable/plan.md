

# Simplificér Salgsvalidering: Copy-paste i stedet for Excel-upload

## Koncept
Erstat Excel-upload flowet med to tekstfelter hvor brugeren kan copy-paste telefonnumre direkte:
1. Vælg kunde + måned (som nu)
2. Paste godkendte/fakturerbare telefonnumre i ét felt
3. Paste annullerede telefonnumre i et andet felt
4. Klik "Validér" → samme matching-logik som nu

Systemet parser automatisk telefonnumre (ét per linje, ignorerer tomme linjer og whitespace), normaliserer dem, og matcher mod salgsdata.

## Ændringer i `src/pages/economic/SalesValidation.tsx`

### Fjernes
- Excel upload/dropzone (hele `onDrop`, `useDropzone`, kolonne-mapping dialog)
- States: `showColumnMapping`, `uploadedRows`, `uploadedHeaders`, `fileName`, `phoneCol`, `statusCol`, `billableValue`, `cancelledValue`

### Tilføjes
- **To `<Textarea>`-felter**: "Godkendte salg (telefonnumre)" og "Annullerede salg (telefonnumre)"
- States: `billableText` og `cancelledText` (strings)
- **Parser-funktion**: Splitter tekst på newlines, trimmer, normaliserer hvert nummer
- **Tæller**: Viser live antal parsede numre under hvert felt ("23 numre registreret")

### Matching-logik
Uændret — bare med input fra textarea i stedet for Excel-rækker. `processMatching()` refaktoreres til at læse fra de to tekstfelter.

### UI-layout
```
[Kunde ▾]  [Måned ▾]

┌─────────────────────────┐  ┌─────────────────────────┐
│ Godkendte salg (tlf)    │  │ Annullerede salg (tlf)  │
│ 52512853                │  │ 40302010                │
│ 22334455                │  │ 11223344                │
│ ...                     │  │ ...                     │
│ 23 numre                │  │ 4 numre                 │
└─────────────────────────┘  └─────────────────────────┘

        [ Validér salg ]

── Resultater ──────────────
(samme 4 kategorier som nu)
```

### Excel-upload beholdes som sekundær option
En lille "Eller upload Excel-fil" knap under tekstfelterne, som åbner den eksisterende upload-flow for dem der foretrækker det.

## Fil

| Fil | Ændring |
|-----|---------|
| `src/pages/economic/SalesValidation.tsx` | Tilføj textarea-baseret input som primært flow, behold Excel som alternativ |

