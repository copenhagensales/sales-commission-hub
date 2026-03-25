

## Dropdown med Excel-produktnavne fra uploads

### Problem
"Produktnavn fra Excel"-feltet er et fritekst-input. Brugeren vil i stedet have en dropdown med de produktnavne, der allerede er modtaget via uploads for den valgte kunde.

### Datakilde
`cancellation_queue` tabellen har feltet `target_product_name`, som indeholder produktnavne fra uploads. Vi henter distinkte, ikke-null værdier filtreret på `client_id`.

### Ændring

**Fil:** `src/components/cancellations/SellerMappingTab.tsx` — `ProductMappingSection`

1. **Ny query** — hent unikke Excel-produktnavne fra `cancellation_queue`:
   ```typescript
   const { data: excelProductNames = [] } = useQuery({
     queryKey: ["excel-product-names", clientId],
     queryFn: async () => {
       const { data, error } = await supabase
         .from("cancellation_queue")
         .select("target_product_name")
         .eq("client_id", clientId)
         .not("target_product_name", "is", null);
       if (error) throw error;
       const unique = [...new Set((data || []).map(d => d.target_product_name).filter(Boolean))];
       return unique.sort((a, b) => a.localeCompare(b, "da"));
     },
     enabled: !!clientId,
   });
   ```

2. **Erstat `Input`** med en anden `Popover`/`Command` combobox (samme mønster som "Internt produkt"-dropdown'en), der viser de hentede `excelProductNames`. Brugeren kan søge og vælge et produktnavn fra listen.

3. **Tilføj "Andet" mulighed** — behold mulighed for fritekst via `CommandInput`, så brugeren også kan skrive et nyt navn der ikke findes i listen endnu.

4. **Fjern allerede mappede navne** — filtrer `excelProductNames` så navne der allerede har en mapping (fra `mappings`-listen) ikke vises, da de allerede er koblet.

### Resultat
- Dropdown viser alle unikke produktnavne fra tidligere uploads for kunden.
- Allerede mappede navne fjernes fra listen.
- Brugeren kan stadig indtaste et nyt navn manuelt via søgefeltet.

