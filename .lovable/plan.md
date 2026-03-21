

# KPI-kort på Salgsvalidering

## Koncept
Når en kunde + periode er valgt, hentes automatisk salgsdata for den valgte periode og vises som KPI-kort øverst — uafhængigt af om der er kørt en validering endnu. Efter validering opdateres kortene med match-status.

## KPI-kort (altid synlige når kunde+periode er valgt)

| KPI | Kilde | Beskrivelse |
|-----|-------|-------------|
| **Registrerede salg** | `sales` query | Antal interne salg i perioden |
| **Samlet omsætning** | `sale_items.mapped_revenue` | Sum af omsætning for perioden |
| **Verificerede salg** | Efter validering | Salg matchet mod kundens fakturerbare liste |
| **Uverificerede salg** | Efter validering | Salg der IKKE er på kundens liste |
| **Matchede annulleringer** | Efter validering | Annulleringer med identificeret sælger |
| **Umatchede annulleringer** | Efter validering | Annulleringer uden internt match |

## Teknisk

### `src/pages/economic/SalesValidation.tsx`

1. **Ny query**: Når `clientId` og `periodMonth` er sat, hent aggregerede tal via `sale_items` join `sales` (antal salg via `SUM(quantity)`, omsætning via `SUM(mapped_revenue)`, provision via `SUM(mapped_commission)`) for den valgte kunde+periode.

2. **KPI-kort sektion**: Indsæt en grid med 4-6 `Card`-komponenter mellem kunde/periode-vælger og tekstfelterne. De første 2-3 kort (registrerede salg, omsætning, provision) vises altid. De resterende (verificerede, uverificerede, annulleringer) vises kun efter en validering er kørt — baseret på `results` state.

3. **Beregning fra results**: Udled fra eksisterende `results`-array:
   - Verificerede = `category === "verified_sale"`
   - Uverificerede = `category === "unverified_sale"`  
   - Matchede annulleringer = `category === "matched_cancellation"`
   - For omsætning på uverificerede: sumér `mapped_revenue` fra de matchede sale_items

4. **Farve-kodning**: Grøn for verificerede, rød/orange for uverificerede og annulleringer, blå for totaler.

### Fil

| Fil | Ændring |
|-----|---------|
| `src/pages/economic/SalesValidation.tsx` | Tilføj salgs-aggregat query + KPI-kort grid |

