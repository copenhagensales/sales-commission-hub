

# Ny fane: Dubletter

## Hvad bygges
En tredje fane "Dubletter" paa Annulleringer-siden, der finder og viser salg hvor samme kunde er lukket mere end een gang. Dubletter detekteres via telefonnummer, kundenavn (customer_company) og CVR-nummer (fra normalized_data).

## Duplet-detekterings-logik

Systemet finder dubletter ved at gruppere salg paa foelgende felter (mindst eet match):
1. **Telefonnummer** (`customer_phone`) - eksakt match, ignorerer tomme/dummy-numre (0000000, 00000000, 99999999)
2. **Virksomhedsnavn** (`customer_company`) - case-insensitiv match, ignorerer tomme
3. **Kundenavn** (`raw_payload->>'CustomerName'`) - case-insensitiv match som supplement

Salg med status `cancelled` ekskluderes fra dublet-soegningen.

## UI-design

### Filtre (samme stil som eksisterende faner)
- **Vaelg kunde** - dropdown med klienter
- **Fra dato / Til dato** - datovaegler
- **Minimum dubletter** - dropdown (2, 3, 4+)

### Resultattabel
Grupperet visning per dublet-gruppe:
- Telefonnummer / Virksomhed / Kundenavn
- Antal salg i gruppen
- Expand/collapse for at se individuelle salg med:
  - Salgsdato, saelger, telefon, virksomhed, kilde (source), status
  - Knap til at annullere individuelt salg (genbruger CancellationDialog)

### Opsummering
- Antal dublet-grupper fundet
- Samlet antal salg involveret

## Tekniske detaljer

### Ny fil: `src/components/cancellations/DuplicatesTab.tsx`
- Hook der henter salg med filtre og grupperer client-side paa telefonnummer
- SQL-query der finder telefonnumre med flere salg via subquery
- Bruger Collapsible fra Radix UI til expand/collapse per gruppe
- Genbruger `CancellationDialog` til annullering
- Genbruger `getStatusBadge`-logikken fra ManualCancellationsTab

### AEndring: `src/pages/salary/Cancellations.tsx`
- Tilfoej tredje tab "Dubletter" i TabsList (grid-cols-3)
- Importer og render `DuplicatesTab` i TabsContent

### Query-strategi
Henter alle salg for valgt kunde hvor telefonnummeret forekommer mere end een gang:
```text
1. Foerst: find telefonnumre med count > 1
2. Derefter: hent alle salg for disse numre
3. Client-side: grupper og vis
```

### Komponenter der genbruges
- Table, Badge, Button, Select, Input fra UI-biblioteket
- CancellationDialog til annullering
- Collapsible til gruppevisning
- Loader2, AlertCircle ikoner fra lucide
