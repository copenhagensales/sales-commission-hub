

## Powerdag Dashboard

### Koncept
En special event-dag hvor teams konkurrerer om point. Salg tastes manuelt, og hvert team/klient har en pointværdi pr. salg. Boardet viser live standings.

### Datastruktur (fra Excel)

**Teams og deres regler:**
- **TDC Erhverv**: 1 salg = 2 point
- **Eesy TM**: 1 salg = 1.3 point
- **Fieldmarketing**: Sammensat af sub-klienter (YouSee: 1 point, Eesy FM: 0.6 point) + bonus pr. medregnet
- **Relatel**: 1 salg = 3.2 point
- **United**: Sammensat af sub-klienter (Tryg/Codan: 0.4, FF/AKA: 1.2, ASE: 2, Tryg Bonus: 0.3)

Forsiden viser ét samlet KPI pr. team (total point). FM og United er "composite" teams med flere underleverandører.

---

### Database (2 nye tabeller)

**1. `powerdag_events`** — definition af en Powerdag
- `id`, `name`, `event_date`, `is_active`, `created_at`

**2. `powerdag_point_rules`** — pointregler pr. team/klient
- `id`, `event_id` (FK), `team_name`, `sub_client_name` (nullable), `points_per_sale`, `created_at`

Eksempel-rækker:
- (event_id, "TDC Erhverv", null, 2.0)
- (event_id, "United", "ASE", 2.0)
- (event_id, "United", "Tryg/Codan", 0.4)

**3. `powerdag_scores`** — manuelle salgstal
- `id`, `event_id` (FK), `rule_id` (FK til point_rules), `sales_count` int, `updated_by` uuid, `updated_at`

Point beregnes: `sales_count × points_per_sale` — ingen separat point-kolonne, det beregnes live.

---

### Frontend (3 komponenter)

**1. Powerdag Live Board (`/dashboards/powerdag`)**
- Stort scoreboard med alle teams rangeret efter point
- Hvert team viser: Teamnavn, Total Point (stort tal), detaljer-accordion for composite teams (FM, United) der viser sub-klienter
- Auto-refresh hvert 10 sek
- Eventuel confetti/celebration ved milepæle
- TV-mode kompatibel

**2. Powerdag Score Input (`/dashboards/powerdag/input`)**
- Tabel med alle teams/sub-klienter
- Editable input-felter for "Antal Salg"
- Beregnet point vises live ved siden af
- Gem-knap gemmer til `powerdag_scores`

**3. Powerdag Admin/Settings**
- Opret/rediger Powerdag event
- Konfigurer pointregler pr. team/sub-klient
- Tilføj/fjern teams og sub-klienter

---

### Berørte filer

| Fil | Handling |
|---|---|
| Migration SQL | Opret 3 tabeller + RLS |
| `src/pages/dashboards/PowerdagBoard.tsx` | Live scoreboard |
| `src/pages/dashboards/PowerdagInput.tsx` | Manuel score-input |
| `src/components/powerdag/PowerdagSettings.tsx` | Admin: regler |
| `src/hooks/usePowerdagData.ts` | Data hook |
| `src/config/dashboards.ts` | Tilføj powerdag slug |
| `src/routes/config.tsx` | Tilføj routes |

### Implementeringsrækkefølge
1. Database migration (tabeller + RLS + seed default event med regler fra Excel)
2. Data hook
3. Live board (forsiden)
4. Score input side
5. Settings/admin side
6. Routes og dashboard config

