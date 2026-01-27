

# Plan: Kobl "Assisterende Teamleder" til den nye rettighedsgruppe

## Baggrund

Du har oprettet en ny rettighedsgruppe i Permission Editor:
- **Rolle-nøgle:** `assisterendetm`
- **Label:** "Assisterende Teamleder TM"

Men stillingen "Assisterende Teamleder" i Stillinger-fanen peger stadig på den gamle rolle (`assisterende_teamleder_fm`), så medarbejdere med denne stilling får ikke de nye rettigheder.

## Løsning

### Trin 1: Opdater stillingens systemrolle i databasen

Jeg opdaterer `job_positions` tabellen så "Assisterende Teamleder" peger på den nye rolle:

```sql
UPDATE job_positions 
SET system_role_key = 'assisterendetm'
WHERE name = 'Assisterende Teamleder' 
  AND id = '454291a1-bd77-497c-bd84-c8ca6a5c814a';
```

### Trin 2: Synkroniser rettigheder

Efter opdateringen skal du:
1. Gå til **Rettigheder**-fanen
2. Vælge rollen **"Assisterende Teamleder TM"** i dropdown
3. Klikke **"Synkroniser alle"** for at oprette alle permission-nøgler
4. Konfigurere de ønskede rettigheder

## Resultat

- Rasmus Andie Eltong (og alle andre med stillingen "Assisterende Teamleder") vil automatisk få de rettigheder, du definerer for `assisterendetm`-rollen
- "Assisterende Teamleder FM" forbliver uændret og bruger fortsat sin egen rolle

## Tekniske detaljer

| Element | Før | Efter |
|---------|-----|-------|
| Stilling: "Assisterende Teamleder" | `system_role_key = assisterende_teamleder_fm` | `system_role_key = assisterendetm` |
| Stilling: "Assisterende Teamleder FM" | `system_role_key = assisterende_teamleder_fm` | Uændret |

