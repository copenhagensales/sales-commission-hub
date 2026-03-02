

# Opdater `.lovable/plan.md`

Filen indeholder den gamle plan om at flytte Specialsalg-blokken. Den skal opdateres til at beskrive den faktiske implementering: tre opsummeringstyper som RadioGroup (Standard / Pilot / Kun 5g Fri Salg), samt pilot-formuleringerne.

**Fil: `.lovable/plan.md`**
- Erstat indholdet med en beskrivelse af den nuværende tilstand:
  - Tre opsummeringstyper via `SummaryVariant`: `"standard" | "pilot" | "5g-fri"`
  - Pilot-ændringer: Vilkår (7 hverdage), Nummervalg (nye formuleringer), Opstart skjult, Omstilling (welcome call)
  - 5g Fri: forenklet opsummering
  - Næste skridt: synkroniser `TdcOpsummeringPublic.tsx` med samme ændringer

