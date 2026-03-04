

## Bonustrappe for Teammål

### Koncept
Erstat det frie tekstfelt "Bonus beskrivelse" med en struktureret 3-trins bonustrappe baseret på forecast-procenterne (+5%, +10%, +15%). Hver trin har et fast beløb pr. medarbejder og en beskrivelse.

### Database-ændring
Tilføj 3 nye kolonner til `team_monthly_goals`:
- `bonus_tier1_amount` (integer, default 500) — beløb pr. medarbejder ved +5%
- `bonus_tier1_description` (text, default 'Spisning på Retour Steak')
- `bonus_tier2_amount` (integer, default 750) — beløb pr. medarbejder ved +10%
- `bonus_tier2_description` (text, nullable)
- `bonus_tier3_amount` (integer, default 1000) — beløb pr. medarbejder ved +15%
- `bonus_tier3_description` (text, default 'Valgfrit')

Behold `bonus_description` for bagudkompatibilitet (men skjul i UI).

### UI-ændringer i TeamGoals.tsx

**Opret/Rediger dialog:**
- Erstat det frie tekstfelt med en visuel "trappe" med 3 trin
- Hvert trin viser: procentmærke (+5/+10/+15%), forecast-baseret salgsmål, beløb pr. medarbejder (redigerbart), og kort beskrivelse (redigerbart)
- Standardværdier udfyldes automatisk: 500/750/1.000 DKK

**Tabel-visning:**
- Erstat "Bonus beskrivelse" kolonnen med en kompakt visning af de 3 bonustrin (f.eks. "500 → 750 → 1.000 kr/medarbejder")

### Teknisk implementering
1. **Migration**: Tilføj de 6 nye kolonner
2. **Form state**: Udvid `GoalForm` interface med bonus-trin felter
3. **Dialog UI**: 3 rækker med ikon (trappe/medal), procent-badge, input for beløb, input for beskrivelse
4. **Tabel**: Vis trinene kompakt i én kolonne
5. **Upsert mutation**: Gem de nye felter ved opret/opdater

