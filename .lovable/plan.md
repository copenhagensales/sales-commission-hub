

## Tilføj "Anbefalinger" KPI-sektion til rekrutterings-dashboardet

### Hvad der bygges
En ny, adskilt KPI-sektion for medarbejderhenvisninger (referrals) med egne kort, så de ikke blandes sammen med de øvrige kandidat-KPI'er.

### KPI-kort i sektionen
1. **Aktive anbefalinger** — antal med status `pending` eller `contacted`
2. **Ansat via anbefaling (30d)** — antal med status `hired` de seneste 30 dage
3. **Konvertering** — procent af anbefalinger der er endt med `hired`
4. **Afventende bonus** — antal med status `eligible_for_bonus`

### Ændringer

| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/RecruitmentDashboard.tsx` | Tilføj `useQuery` for `employee_referrals`-tabellen. Beregn KPI'er (aktive, hired 30d, konverteringsrate, bonus-afventende). Render en ny sektion med overskrift "Anbefalinger" og 4 KPI-kort i et grid, placeret efter ghost%-kortene og før funnel-diagrammerne. Importér `Handshake`-ikon fra lucide. |

### Teknisk detalje
```ts
const { data: referrals = [] } = useQuery({
  queryKey: ["referral-kpis"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("employee_referrals")
      .select("id, status, created_at, hired_date")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

const referralStats = useMemo(() => {
  const active = referrals.filter(r => ["pending","contacted"].includes(r.status)).length;
  const total = referrals.length;
  const hired = referrals.filter(r => r.status === "hired" || r.status === "eligible_for_bonus" || r.status === "bonus_paid").length;
  const rate = total > 0 ? Math.round((hired / total) * 1000) / 10 : 0;
  const recentHired = referrals.filter(r => 
    (r.status === "hired" || r.status === "eligible_for_bonus" || r.status === "bonus_paid") &&
    r.hired_date && new Date(r.hired_date) >= subDays(new Date(), 30)
  ).length;
  const awaitingBonus = referrals.filter(r => r.status === "eligible_for_bonus").length;
  return { active, total, hired, rate, recentHired, awaitingBonus };
}, [referrals]);
```

