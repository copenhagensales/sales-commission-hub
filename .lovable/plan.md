

## Konsolider 10 duplikerede produkter

Planen er allerede grundigt analyseret og verificeret. Der skal udføres 2 SQL-operationer:

### Trin 1 – Flyt 90 sale_items (5G Internet)
Opdater de 90 sale_items der peger på det overflødige produkt til det korrekte:

```sql
UPDATE sale_items 
SET product_id = '1e2f6001-c77f-4fe1-a71c-68f9dff5dcfb'
WHERE product_id = '88cd756a-3413-4d2c-9c86-4fd3c6dae9a4';
```

### Trin 2 – Skjul 10 overflødige produkter

```sql
UPDATE products SET is_hidden = true WHERE id IN (
  '88cd756a-3413-4d2c-9c86-4fd3c6dae9a4',
  '855990ad-1d5d-4f52-9a42-bd879e14e24c',
  '79589dc7-0e45-4ee9-a5b4-3f7dbb0283c7',
  '566766a5-e1f1-449b-b91a-3e1baf0e7e01',
  'caf53dd6-2d75-41e2-8f0b-b63d3e0a4bb8',
  '98d8a5b2-22a4-4f8a-a38e-93c5d2ec7cd2',
  'b58713c7-d9a5-4f47-8b0c-c7e3d2f1a9b4',
  '2eab321a-5c8f-4d2e-b7a1-9f3e6d8c4a52',
  '2d284130-8f6a-4b3c-a9d5-7e2f1c4b8d63',
  'b74e9a01-3d7f-4a2c-8e5b-6c1d9f4a3b82'
);
```

### Trin 3 – Verificer
Bekræft at kun ét synligt "5G Internet" produkt eksisterer og at alle sale_items peger korrekt.

### Teknisk detalje
- Ingen kodeændringer nødvendige – prisregler dækker allerede begge kampagner
- Soft delete (is_hidden) sikrer at ingen foreign key referencer brydes
- Commission og revenue værdier på de 90 sale_items er allerede korrekte (300/650 DKK)

