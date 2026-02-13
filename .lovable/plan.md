

# Fix: Fieldmarketing salg forsvinder ("kommer ikke ind")

## Problem fundet
Salgene BLIVER registreret -- men de havner i den **gamle** `fieldmarketing_sales` tabel. Alle dashboards og oversigter er blevet opdateret til at lase fra den **nye** centraliserede `sales` tabel (med `source = 'fieldmarketing'`). Derfor ser det ud som om salgene forsvinder.

Konkret: telefonnumrene fra dit screenshot (22747092, 93601684) findes i den gamle `fieldmarketing_sales` tabel fra d. 12. februar, men de findes IKKE i den nye `sales` tabel.

## Arsag
Den publicerede version af appen (provision.copenhagensales.dk) bruger stadig gammel kode der skriver til `fieldmarketing_sales`. Preview/test-versionen er allerede migreret til at skrive til `sales`-tabellen.

## Losning

### Trin 1: Publicer den nyeste kode
Publish den aktuelle kodebase sa den publicerede app ogsa skriver til den centraliserede `sales` tabel.

### Trin 2: Migrer manglende data fra den gamle tabel
Kør en engangs-migrering der kopierer alle salg fra `fieldmarketing_sales` som IKKE allerede findes i `sales`-tabellen. Dette sikrer at historiske og nylige FM-salg (inkl. dem fra screenshot) bliver synlige i dashboards.

SQL-logik:
```text
INSERT INTO sales (source, integration_type, sale_datetime, customer_phone, agent_name, client_campaign_id, validation_status, raw_payload)
SELECT 
  'fieldmarketing',
  'manual',
  fs.registered_at,
  fs.phone_number,
  employee.first_name || ' ' || employee.last_name,
  -- Map client_id to client_campaign_id via FM_CLIENT_CAMPAIGN_MAP
  CASE fs.client_id
    WHEN '9a92ea4c-...' THEN 'c527b6a1-...'  -- Eesy FM -> Eesy gaden
    WHEN '5011a7cd-...' THEN '743980b0-...'  -- YouSee -> Yousee gaden
  END,
  'pending',
  jsonb_build_object(
    'fm_seller_id', fs.seller_id,
    'fm_location_id', fs.location_id,
    'fm_client_id', fs.client_id,
    'fm_product_name', fs.product_name,
    'fm_comment', fs.comment
  )
FROM fieldmarketing_sales fs
LEFT JOIN employee_master_data employee ON fs.seller_id = employee.id
WHERE NOT EXISTS (
  SELECT 1 FROM sales s 
  WHERE s.source = 'fieldmarketing' 
  AND s.customer_phone = fs.phone_number
  AND s.sale_datetime = fs.registered_at
)
```

### Trin 3: Verificer
Efter publish + migrering: tjek at salgene fra screenshottet (22747092, 93601684) nu vises i dashboards.

## Tekniske detaljer

**Fil der allerede er klar**: `src/hooks/useFieldmarketingSales.ts` -- skriver allerede til `sales`-tabellen med `source = 'fieldmarketing'`. Ingen kodeandring nødvendig, kun publish.

**Data-migrering**: Engangs-SQL der kores via Cloud View > Run SQL mod Live-databasen efter publish.

