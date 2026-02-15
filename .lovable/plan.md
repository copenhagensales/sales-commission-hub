

# Annuller-knap med produktoversigt og individuel annullering

## Oversigt
Annuller-knappen erstattes med en popup-dialog der viser alle produkter (sale_items) for det valgte salg, inkl. provision pr. produkt. Brugeren kan annullere hele salget eller kun udvalgte produkter.

## Trin 1: Database-migration
Tilfoej en `is_cancelled` boolean-kolonne til `sale_items` tabellen (default: false). Dette goer det muligt at annullere individuelle produkter uden at annullere hele salget.

```text
ALTER TABLE sale_items ADD COLUMN is_cancelled boolean NOT NULL DEFAULT false;
```

## Trin 2: Ny komponent - CancellationDialog
Opret `src/components/cancellations/CancellationDialog.tsx` med foelgende funktionalitet:

- **Input**: Modtager et `saleId` og `open/onClose` props
- **Data**: Henter `sale_items` for det paagaeldende salg (produkt-titel via `display_name` eller `adversus_product_title`, `mapped_commission`, `mapped_revenue`, `quantity`, `is_cancelled`)
- **Visning**: Tabel med produktnavn, antal, provision (kr), og en annuller-knap pr. produkt
- **Handlinger**:
  - "Annuller hele salget" - saetter `sales.validation_status = 'cancelled'` OG `sale_items.is_cancelled = true` for alle items
  - "Annuller produkt" (pr. raekke) - saetter kun `sale_items.is_cancelled = true` for det specifikke item
  - Allerede annullerede produkter vises med gennemstreget tekst og uden knap

## Trin 3: Opdater ManualCancellationsTab
- Fjern den eksisterende `AlertDialog` fra annuller-knappen
- Annuller-knappen aabner i stedet den nye `CancellationDialog` med det relevante `saleId`
- Tilfoej state til at tracke hvilket salg der er valgt (`selectedSaleId`)

## Brugerflow
1. Bruger klikker "Annuller" ud for et salg
2. Dialog aabnes med en liste over produkter og deres provision
3. Bruger kan:
   - Klikke "Annuller produkt" paa individuelle raekker
   - Klikke "Annuller hele salget" i bunden for at annullere alt
4. Dialog lukkes og tabellen opdateres

## Tekniske detaljer
- Produktnavn vises som `display_name ?? adversus_product_title`
- Provision vises formateret i DKK (fx "600 kr")
- Brug `useMutation` til begge annulleringstyper med `invalidateQueries` efter succes
- Dialog bruger eksisterende `Dialog`-komponent fra shadcn/ui
- Bekraeftelses-step inden annullering (inline confirm eller dobbelt-klik-beskyttelse)

