

## Ingen dedikerede database-tabeller at slette

Efter gennemgang af de 4 sider kan jeg bekræfte:

- **CommissionLeagueTest** — bruger kun mock/genereret data, ingen database
- **LeagueAdminDashboard** — læser fra `league_enrollments`, `league_qualification_standings`, `league_seasons` — alle delt med Salgsligaen
- **H2HAdminBoard** — læser fra `h2h_challenges` og `employee_master_data` — delt med Head to Head
- **TeamH2H** — læser fra `h2h_challenges` via `TeamH2HOverview` — delt med Head to Head

**Alle tabeller bruges af de hovedfunktioner vi beholder** (Salgsligaen og Head to Head). Der er ingen tabeller, funktioner eller database-objekter der udelukkende tilhører disse 4 sider.

### Hvad der skal slettes (kun frontend)

| Slet fil | Grund |
|----------|-------|
| `src/pages/CommissionLeagueTest.tsx` | Kun brugt af test-route |
| `src/pages/admin/LeagueAdminDashboard.tsx` | Kun brugt af admin-route |
| `src/pages/H2HAdminBoard.tsx` | Kun brugt af admin-route |
| `src/pages/TeamH2H.tsx` | Kun brugt af team-route |
| `src/components/h2h/TeamH2HOverview.tsx` | Kun importeret af TeamH2H.tsx |

| Ændre fil | Hvad |
|-----------|------|
| `src/routes/config.tsx` | Fjern 4 routes + imports |
| `src/routes/pages.ts` | Fjern 4 lazy exports |
| `src/components/layout/AppSidebar.tsx` | Fjern 4 sidebar-links |
| `src/components/system-stability/SystemStatusMap.tsx` | Fjern "Team H2H" fra ZoneCard |

Databasen skal **ikke** røres — alt data og tabeller deles med de features vi beholder.

