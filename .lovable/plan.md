

# Restyle "Uploadet data" kolonne for TDC Erhverv

## Hvad der ændres
For TDC Erhverv-rækker i OPP-grupperet visning: "Uploadet data"-kolonnen skal visuelt matche "System (aggregeret)"-kolonnens layout med produkter i Badge-bokse og en bundlinje med omsætning.

## Ændringer i `src/components/cancellations/ApprovalQueueTab.tsx`

### 1. Opdater `buildUploadedPreview` for TDC Erhverv
Tilføj en ny returstruktur specifikt for TDC Erhverv der separerer:
- **Produkter** → array af `{ name, quantity }` objekter (til Badge-visning)
- **Bundfelter** → CPO Total og TT trin
- **Skjulte felter** → OPP-nr., Produkt: Total, Lukkedato, Provision (udover de allerede skjulte TT/TT mandat)

Konkret: Udvid `hiddenFields` for TDC Erhverv med `"OPP-nr."`, `"Produkt: Total"`, `"Lukkedato"`, og provision-relaterede felter. Tilføj et flag eller separat funktion der returnerer struktureret data for TDC.

### 2. Opdater renderingen af "Uploadet data"-cellen (linje ~1256-1268)
For TDC Erhverv OPP-rækker: erstat den flade liste med:

```text
┌────────────────────────────────┐
│ Produkter:                     │
│ ┌──────────────────────┐       │
│ │ MOBIL PROFESSIONEL   │       │
│ │ 100GB ×3             │       │
│ └──────────────────────┘       │
│ ┌──────────────────────┐       │
│ │ STANDARD OMSTILLING  │       │
│ └──────────────────────┘       │
│                                │
│ CPO Total: 8400 kr             │
│ TT trin: 0                     │
└────────────────────────────────┘
```

- Produkter vises i `Badge variant="outline"` med `×antal` (samme stil som System-kolonnen)
- Bundlinje viser CPO Total og TT trin i `text-muted-foreground`
- Ingen provision, OPP-nr., Produkt: Total eller Lukkedato

### 3. Ingen ændring for andre klienter
Andre klienter beholder den eksisterende flade felt-liste.

## Teknisk detalje
- Én fil ændres: `ApprovalQueueTab.tsx`
- Ca. 30-40 linjer ændret/tilføjet i `buildUploadedPreview` og renderingen
- Bruger `clientId === TDC_ERHVERV_CLIENT_ID` guards som allerede eksisterer

