
## Tilføj "Opret nyt felt" direkte i Standard felt-dropdown

### Hvad der ændres
I `IntegrationMappingEditor.tsx` tilføjes en "Opret nyt felt"-knap nederst i Standard felt-dropdown'en. Når brugeren klikker på den, åbnes den eksisterende `FieldDefinitionDialog` i oprettelsestilstand. Når feltet er oprettet, opdateres dropdown'en automatisk med det nye felt.

### Brugeroplevelse
1. Bruger åbner "Standard felt"-dropdown for en API-feltrække
2. Nederst i listen ses en separator og en "+ Opret nyt felt"-knap
3. Klik åbner `FieldDefinitionDialog` (samme dialog som bruges i Feltdefinitioner-fanen)
4. Efter oprettelse lukkes dialogen, felt-listen genindlæses, og det nye felt er tilgængeligt i dropdown'en

### Tekniske detaljer

**Fil: `src/components/mg-test/IntegrationMappingEditor.tsx`**

1. Importer `FieldDefinitionDialog` og tilføj state for dialog-åbning:
   ```typescript
   import { FieldDefinitionDialog } from "./FieldDefinitionDialog";
   // ...
   const [createFieldOpen, setCreateFieldOpen] = useState(false);
   ```

2. Tilføj `FieldDefinitionDialog` i komponentens return (uden for tabellen):
   ```typescript
   <FieldDefinitionDialog
     open={createFieldOpen}
     onOpenChange={setCreateFieldOpen}
     field={null}
   />
   ```

3. I hver "Standard felt"-Select dropdown (`SelectContent`), tilføj nederst efter alle kategorigrupper:
   ```typescript
   <SelectSeparator />
   <div
     className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-primary hover:bg-accent"
     onPointerDown={(e) => {
       e.preventDefault();
       e.stopPropagation();
       setCreateFieldOpen(true);
     }}
   >
     <Plus className="absolute left-2 h-3.5 w-3.5" />
     Opret nyt felt
   </div>
   ```
   Brugen af `onPointerDown` med `preventDefault`/`stopPropagation` forhindrer at dropdown'en lukker og vælger en værdi.

4. Importer `SelectSeparator` fra select-komponenten og `Plus`-ikonet.

### Hvorfor denne tilgang
- Genbruger den eksisterende `FieldDefinitionDialog` -- ingen duplikering af logik
- `queryKey: ["data-field-definitions"]` invalideres allerede af dialogen ved oprettelse, så dropdown'en opdateres automatisk
- Kræver kun ændringer i én fil
