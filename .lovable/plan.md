

## Erstat "Engelsk opsummering" radio med toggle switch (kun internt)

### Ændring
Kun i `src/pages/TdcOpsummering.tsx` (intern version — `TdcOpsummeringPublic.tsx` røres IKKE):

1. **Fjern** den fjerde `RadioGroupItem` for `"engelsk"` fra `RadioGroup`-blokken.
2. **Fjern** `"engelsk"` fra `SummaryVariant`-typen (tilbage til `"standard" | "pilot" | "5g-fri"`).
3. **Tilføj** ny separat state: `const [isEnglish, setIsEnglish] = useState(false)`.
4. **Tilføj** en `Switch`-komponent (fra `@/components/ui/switch`) placeret ved siden af RadioGroup'en med label "English" til højre for switchen.
   - Default: slået fra → dansk (ingen label-indikation, da dansk er standard).
   - Slået til → engelsk.

### Adfærd
- Toggle er rent visuel for nu — `summaryLines`-genereringslogikken røres ikke.
- Når oversættelser leveres senere, bruges `isEnglish`-flag til at vælge dansk/engelsk tekstvariant parallelt med `summaryVariant`.
- Toggle fungerer uafhængigt af radio-valget (dvs. man kan have fx "Pilot" + engelsk).

### Layout
Switch + "English"-label placeres i samme række som RadioGroup'en, adskilt visuelt med `border-l` divider eller `gap`, så det er tydeligt at det er to uafhængige valg.

### Filer berørt
- `src/pages/TdcOpsummering.tsx` (kun denne)

### Eksplicit IKKE berørt
- `src/pages/TdcOpsummeringPublic.tsx` — paritet brydes midlertidigt med vilje. Kan synkroniseres senere når oversættelser er klar.

