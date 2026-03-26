

## Tillad samme værdi på flere produkter

### Problem
Badget "Allerede mappet" antyder at en værdi kun bør tilknyttes ét produkt. Men sammensætningen af værdier på tværs af kolonner (Operator, Subscription Name, Sales Department) er det der bestemmer produktet — så samme værdi skal kunne bruges på flere produkter.

### Løsning

#### 1. Ændre badge-visning i dialogen (`SellerMappingTab.tsx`)
- Fjern det afskrækkende "Allerede mappet" badge
- Erstat med en informativ tekst der viser *hvilke* produkter værdien allerede er tilknyttet (fx "Også på: Fri tale + 170GB")
- Behold fuld valgfrihed — ingen visuel forskel i checkbox-tilstand

#### 2. Verificér upsert-logik
- Den nuværende `upsert` bruger `onConflict: "client_id,excel_product_name"` — men da samme `excel_product_name` nu skal kunne eksistere med *forskellige* `product_id`, er upsert-nøglen forkert
- Ændre til insert med duplikat-check: tjek om kombinationen `(client_id, excel_product_name, product_id)` allerede eksisterer før insert, eller brug upsert med den korrekte unikke constraint

#### 3. Tjek database-constraint
- `cancellation_product_mappings` har formentlig en unik constraint på `(client_id, excel_product_name)` — denne skal ændres til `(client_id, excel_product_name, product_id)` via migration, så samme excel-navn kan mappes til flere produkter

### Berørte filer
- `src/components/cancellations/SellerMappingTab.tsx` — badge-visning og save-logik
- Database migration — ændre unik constraint

