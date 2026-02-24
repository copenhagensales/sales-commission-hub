

# Plan: Tilfoej konsulent-markering i Saelgerloensninger

## Overblik

Tilfoej en visuel markering for freelance-konsulenter i saelgerloenningstabellen, saa de nemt kan skelnes fra almindelige medarbejdere.

## Aendringer

### 1. `src/hooks/useSellerSalariesCached.ts`

- Tilfoej `is_freelance_consultant` til employee-query'ens select-felter
- Udvid `SellerData` interfacet med `isFreelanceConsultant: boolean`
- Map vaerdien i seller-data: `isFreelanceConsultant: emp.is_freelance_consultant ?? false`

### 2. `src/components/salary/SellerSalariesTab.tsx`

- Vis en "Konsulent" badge ved siden af navnet (ligesom "Inaktiv" badge) for medarbejdere hvor `isFreelanceConsultant` er `true`
- Gaelder baade desktop-tabel og mobil-visning

### Eksempel paa badge

Medarbejdernavnet vil se saadan ud:

```
Oscar Hansen [Konsulent]
```

eller for en inaktiv konsulent:

```
Oscar Hansen [Konsulent] [Inaktiv]
```

---

## Tekniske detaljer

| Fil | Aendring |
|-----|---------|
| `src/hooks/useSellerSalariesCached.ts` | Tilfoej `is_freelance_consultant` til select, udvid interface |
| `src/components/salary/SellerSalariesTab.tsx` | Vis "Konsulent" badge i tabel og mobil-view |

Ingen database-aendringer - `is_freelance_consultant` feltet eksisterer allerede i `employee_master_data`.

