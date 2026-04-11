

## Problem: Tallene stemmer ikke overens

**Database-fakta (30 dage):**
- 18 hired kandidater: 7 med "Salgskonsulent", 0 med Fieldmarketing, **11 med `null`**
- 5 hired anbefalinger
- Total: 23

**Hvad du ser:**
- "Ansat (30 dage)": 23 (18 kandidater + 5 anbefalinger) — korrekt
- "Salgskonsulent: 7 af 144 ansat (30d)" — kun de 7 med position sat
- 11 hired kandidater har **ingen stilling** og tælles hverken under Salgskonsulent eller Fieldmarketing

**Årsag:** Kandidater fra anbefalinger (og evt. manuelt oprettede) får ikke sat `applied_position`. De falder i en "other"-kategori der aldrig vises.

### Løsning
Tæl kandidater uden `applied_position` med under **Salgskonsulent** som default, da det er den primære stilling. Ændre `categorize`-funktionen:

```ts
const categorize = (pos: string | null) => {
  if (!pos) return "sales"; // default til salgskonsulent
  const lower = pos.toLowerCase();
  if (lower.includes("field") || lower.includes("marketing")) return "field";
  return "sales"; // alt andet er også salg
};
```

### Ændring

| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/RecruitmentDashboard.tsx` | Opdater `categorize`-funktionen (linje 173-179) så `null` og ukendte positioner defaulter til "sales" i stedet for "other" |

Herefter vil Salgskonsulent-kortet vise **18 af 178 ansat (30d)**, og det samlede tal (23 = 18 + 5 anbefalinger) giver mening.

