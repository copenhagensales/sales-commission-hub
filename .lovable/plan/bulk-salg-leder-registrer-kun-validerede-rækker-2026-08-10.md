# Bulk Salg (Leder): registrer kun validerede rækker

## Formål
Ved klik på "Registrer salg" må kun de rækker, der bestod kontrollen ("klar"), sendes videre. Fejlrækker sendes slet ikke.

## Nuværende adfærd (verificeret)
- Kontrol-fasen (`dry_run: true`) og den endelige kørsel bruger samme validering i `bulk_import`; fejlrækker afvises altid før insert, så de aldrig når dagsrapport eller løn.
- Men "Registrer salg" sender i dag hele filen igen, så antal oprettede kan blive lavere end det viste "klar"-tal.

## Ændringer

### Backend (`supabase/functions/manual-sales/index.ts`, kun `bulk_import`)
- I dry-run: opsaml indeks på hver række der passerer alle tjek, og returnér dem som `valid_indices` sammen med `would_create`.
- Ingen ændring i valideringsregler, dedupe eller insert-logik. Den endelige kørsel validerer fortsat alt igen (sidste forsvarslinje mod ændringer mellem de to klik).

### Hook (`src/hooks/useLederneSales.ts`)
- Udvid `BulkImportResult`-typen med `valid_indices?: number[]`.

### UI (`src/pages/TastSelvSalg.tsx`)
- Gem de validerede rækker efter kontrol (udvalgt via `valid_indices`) i stedet for kun hele sættet.
- "Registrer salg" sender kun de validerede rækker.
- Efter registrering: hvis antal oprettede er lavere end antal "klar", vis fejlene fra svaret i "Fejl i upload" som i dag (uændret).

## Afgrænsning
- Rører kun bulk-import-flowet. Tast selv-registrering, løn, pricing og øvrige navneopslag er uændrede.
- Ingen DB-migration, ingen skemaændring.

## Verifikation
- Upload testfil med en blanding af gode rækker, en dublet, en ukendt sælger og en ikke-Succes: kontrol viser korrekt "X klar · Y fejl", og efter registrering er antal oprettede = X, og de Y rækker findes ikke i `sales`.
