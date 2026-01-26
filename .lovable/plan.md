
# Plan: Ret Thomas Wehages rolle og permissions

## Oversigt
Retter Thomas Wehages adgang ved at fjerne duplikerede system_roles og opdatere hans position til "Assisterende Teamleder FM" så han får de korrekte Fieldmarketing permissions.

## Trin 1: Fjern duplikerede system_roles entries

Slet begge eksisterende roller i `system_roles` tabellen:

```sql
DELETE FROM system_roles 
WHERE user_id = 'cb0eb55a-f2dc-476a-b09a-f8e7cb2e3f45';
```

**Hvorfor:** `system_roles` tabellen bruges som fallback, men med den nye struktur styres permissions primært via `job_positions.system_role_key`.

## Trin 2: Opdater Thomas' position til "Assisterende Teamleder FM"

Opdater `employee_master_data` til at bruge den korrekte position:

```sql
UPDATE employee_master_data 
SET position_id = '905ecb6b-e0a2-4dee-b343-81140c2454de'
WHERE id = 'cb135e08-d329-4b64-9533-2bbfc3910515';
```

**Effekt:** Hans `system_role_key` bliver nu `assisterende_teamleder_fm` som har de præcise permissions du har konfigureret.

## Resultat efter ændring

| Dashboard | Adgang |
|-----------|--------|
| CS Top 20 | Ja |
| Eesy TM | Ja |
| Fieldmarketing | Ja |
| CPH Sales | Nej |
| TDC Erhverv | Nej |
| Relatel | Nej |
| United | Nej |

| Fieldmarketing Menu | Adgang |
|---------------------|--------|
| Booking/Vagtplan | Ja (kan redigere) |
| Lokationer | Ja (kan redigere) |
| Salgsregistrering | Ja (kan redigere) |
| Fravær | Ja (kan redigere) |
| Fakturering | Ja (kan redigere) |

## Teknisk note

Systemet bruger nu `job_positions.system_role_key` som primær kilde til permissions via `role_page_permissions` tabellen. Ved at sætte Thomas på positionen "Assisterende Teamleder FM" får han automatisk de permissions der er defineret for `assisterende_teamleder_fm` rollen.
