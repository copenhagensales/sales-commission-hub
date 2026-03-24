

# Sælger-mapping: Manuelt match + persistent mapping-tabel

## Overblik
Når systemet ikke kan matche en sælger fra Excel-filen automatisk, skal brugeren kunne vælge den korrekte medarbejder fra en dropdown. Denne kobling gemmes permanent i en ny tabel, så fremtidige uploads matcher automatisk. En ny "Mapping"-fane viser og administrerer alle gemte mappings.

## Database

### Ny tabel: `cancellation_seller_mappings`
```sql
CREATE TABLE public.cancellation_seller_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  excel_seller_name TEXT NOT NULL,
  employee_id UUID NOT NULL REFERENCES employee_master_data(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (client_id, excel_seller_name)
);
ALTER TABLE cancellation_seller_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage seller mappings"
  ON cancellation_seller_mappings FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

## Kodeændringer

### 1. `UploadCancellationsTab.tsx` — Sælger-matching med fallback til dropdown

**I `handleMatch`** (efter produkt-phone matching):
- For rækker uden telefonnummer (5GI): hent sælgernavn fra Excel (`Employee Name`-kolonnen)
- Slå op i `cancellation_seller_mappings` om der allerede findes en mapping for dette navn + client
- Hvis ja → brug den mappede `employee_id` til at finde agent_email → match mod salg via agent + dato
- Hvis nej → marker rækken som "umatched seller" og vis i preview

**I preview-steget**:
- Vis umatchede rækker med en dropdown der lister alle aktive medarbejdere (fra `employee_master_data`)
- Når bruger vælger en medarbejder → gem mapping i `cancellation_seller_mappings` og kør re-match
- Dropdown viser "Fornavn Efternavn" og gemmer `employee_id`

### 2. Ny komponent: `SellerMappingTab.tsx`
- Henter alle rækker fra `cancellation_seller_mappings` for den valgte client
- Joiner med `employee_master_data` for at vise medarbejdernavn
- Viser tabel: Excel-sælgernavn | Mappet medarbejder | Oprettet | Slet-knap
- Mulighed for at slette/redigere mappings

### 3. `Cancellations.tsx` — Ny fane
- Tilføj `{ value: 'mapping', label: 'Mapping' }` i `autoTabs` efter 'history'
- Render `<SellerMappingTab clientId={selectedClientId} />` i TabsContent

## Flow
1. Upload fil → filter → matching kører
2. Rækker med telefon → matches via produkt-phone (eksisterende)
3. Rækker uden telefon → systemet slår `excel_seller_name` op i `cancellation_seller_mappings`
   - Fundet → bruger employee_id til agent-lookup → matcher via sælger + dato + produkt
   - Ikke fundet → vises som "umatched" med medarbejder-dropdown
4. Bruger vælger medarbejder i dropdown → mapping gemmes → re-match køres
5. Næste upload → automatisk match via den gemte mapping

## Teknisk detalje: Sælger+dato+produkt matching
Når en seller-mapping er resolved (enten automatisk eller manuelt):
- Find medarbejderens agent_email via `employee_master_data.work_email` → `agents.email` → `sales.agent_email`
- Match salg hvor `agent_email` matcher OG `sale_datetime` er samme dag som Excel-datoen
- Tjek at salget har et `sale_item` med `adversus_product_title` der matcher (f.eks. "5GI" for "5G Internet")
- Config bruges til at mappe Excel-produktnavne til DB-produktnavne via `fallback_product_mappings`

