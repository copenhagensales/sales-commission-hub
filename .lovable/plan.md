

## Fix: Fjern dobbelt-multiplikation i get_sales_aggregates_v2

### Problem
RPC-funktionen `get_sales_aggregates_v2` ganger `mapped_commission` og `mapped_revenue` med `quantity`, men disse vaerdier er allerede praemultipliceret med quantity under synkroniseringen. Det giver dobbelte tal for omsaetning og provision overalt i systemet, der bruger denne RPC.

### Linje der skal aendres (i en ny migration)

**Fra:**
```sql
COALESCE(SUM(fs.mapped_commission * fs.quantity), 0) AS total_commission,
COALESCE(SUM(fs.mapped_revenue * fs.quantity), 0) AS total_revenue
```

**Til:**
```sql
COALESCE(SUM(fs.mapped_commission), 0) AS total_commission,
COALESCE(SUM(fs.mapped_revenue), 0) AS total_revenue
```

### Implementation
Opret en ny SQL-migration med `CREATE OR REPLACE FUNCTION get_sales_aggregates_v2(...)` der er identisk med den eksisterende, bortset fra at linje 58-59 fjerner `* fs.quantity` fra commission og revenue summerne.

Salgstal-linjen (linje 57) forbliver uaendret, da `quantity` korrekt bruges til at taelle antal solgte enheder.

### Effekt
Alle komponenter der bruger `useSalesAggregatesExtended` (og dermed RPC'en) vil automatisk vise korrekte tal - inklusiv den nye daglige DB-graf, Client DB-rapporten, og dashboards.

