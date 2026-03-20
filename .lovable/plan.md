

# Ændr straksbetaling fra lønperiode til 7-dages + månedsskift-regel

## Nuværende adfærd
Siden filtrerer salg baseret på den aktuelle lønperiode (15. – 14.). Alle salg i perioden vises og kan aktiveres/annulleres.

## Ny adfærd
- Vis alle ASE-salg fra de seneste 30 dage (for at have data at vise)
- **Aktivering tilladt** hvis: salget er maks 7 dage gammelt OG salget er fra samme kalendermåned som i dag
- **Annullering** altid tilladt på allerede aktiverede salg
- Salg der er for gamle eller fra forrige måned vises stadig, men knappen er disabled med forklaring
- Tilføj en synlig forklaringsboks øverst på siden

## Ændringer

### `src/pages/ImmediatePaymentASE.tsx`

**1. Fjern lønperiode-logik**
- Fjern `getPayrollPeriod` import og `payrollPeriod` useMemo
- Ændr query til at hente salg fra de seneste 30 dage i stedet (giver bred nok visning)
- Opdater queryKey så den ikke afhænger af payrollPeriod

**2. Tilføj eligibility-funktion**
```ts
function canActivateImmediate(saleDatetime: string): { allowed: boolean; reason?: string } {
  const saleDate = new Date(saleDatetime);
  const now = new Date();
  const daysDiff = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
  
  if (saleDate.getMonth() !== now.getMonth() || saleDate.getFullYear() !== now.getFullYear()) {
    return { allowed: false, reason: "Salget er fra forrige måned" };
  }
  if (daysDiff > 7) {
    return { allowed: false, reason: "Mere end 7 dage siden salget" };
  }
  return { allowed: true };
}
```

**3. Opdater header**
- Fjern lønperiode-visning, erstat med kort tekst om regler
- Tilføj info-boks (Alert component) med forklaring:
  > "Du kan tilføje straksbetaling op til 7 dage efter salget er registreret. Ved månedsskift kan straksbetaling kun tilføjes på salg fra den aktuelle måned."

**4. Opdater tabel-handling**
- For ikke-aktiverede salg: tjek `canActivateImmediate()` — hvis ikke tilladt, vis disabled knap med tooltip/tekst der forklarer hvorfor
- Allerede aktiverede salg: annullering forbliver uændret

**5. Opdater tom-tilstand tekst**
- Fjern reference til "lønperiode", skriv "seneste 30 dage" i stedet

| Fil | Handling |
|-----|---------|
| `src/pages/ImmediatePaymentASE.tsx` | Erstat lønperiode med 7-dages/månedsskift logik + forklaring |

