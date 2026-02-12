

## Tilføj debug-logging til lederlønsberegningen

For at kunne se præcis hvilke tal der bruges til at beregne Finansforbundets lederallokering, tilføjer vi console.log-statements i beregningslogikken.

### Hvad logges

Inde i teamets leder-beregningsloop (linje ~751-769 i `ClientDBTab.tsx`) tilføjes to log-statements:

**1. Per team (efter linje 754):**
- `teamId`, `percentageRate`, `minimumSalary`
- `teamTotalDBBeforeLeader`
- `calculatedLeaderSalary` (DB * procentsats)
- `proratedMinimumSalary` (minimumsløn * prorationFactor)
- `finalTeamLeaderSalary` (MAX af de to)
- `prorationFactor`, `workdaysInPeriod`

**2. Per klient (efter linje 764):**
- `clientName`, `dbBeforeLeader`, `dbShare`
- `leaderAllocation`, `leaderVacationPay`
- `finalDB`

### Fil
- `src/components/salary/ClientDBTab.tsx` -- to console.log-blokke tilføjes i useMemo-beregningen.

Disse logs kan fjernes igen når vi har verificeret tallene.
