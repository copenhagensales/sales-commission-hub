

# Ryd tekstfelter efter validering

## Problem
Når man har indsat telefonnumre og klikket "Validér", forbliver teksten i begge textarea-felter. Det giver indtryk af at valideringen ikke er gennemført.

## Løsning
Efter en succesfuld validering (resultaterne er gemt i `sales_validation_uploads` og vist i UI):
1. Ryd begge textarea-felter (`billableText` og `cancelledText` sættes til `""`)
2. Resultaterne forbliver synlige i KPI-kort og resultattabellerne nedenfor

## Ændring

| Fil | Linje | Hvad |
|-----|-------|------|
| `src/pages/economic/SalesValidation.tsx` | ~258 (efter `refetchUploads()`) | Tilføj `setBillableText("")` og `setCancelledText("")` |

Én enkelt ændring — to linjer tilføjes efter den eksisterende `refetchUploads()` kald i `runMatching`-funktionen.

