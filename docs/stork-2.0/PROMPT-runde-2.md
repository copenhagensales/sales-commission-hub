# Stork 2.0 — Runde 2

Du har tidligere leveret et bud på Stork 2.0's arkitektur. Du får nu alle fire svar tilbage anonymt (svar-A, svar-B, svar-C, svar-D) — inklusive dit eget. Læs dem alle.

---

## Præmis du skal arbejde under

Stork 1.0 er ikke en ruin. UI virker. De fleste tal spiller. Det meste af systemet kan kopieres 1:1 til 2.0.

Men der er kerne-logikker der **gentaget fejler** — ikke fordi UI er forkert, men fordi disciplinen ikke skalerer:

- Pricing-motoren findes to steder og holdes 1:1 manuelt. Drift opstår.
- Attribution knækker når identitet ikke kan resolves via 4-trins fallback.
- Permission-bypass dør når rolle eller jobtitel skifter.
- Retroaktiv pricing-rematch rammer udbetalt løn fordi lønperiode kun er en kode-konvention.
- Cache-invalidation bygger på string-keys der staves forkert.
- Cross-session sync er ad hoc.

**Stork 2.0's job er at konsolidere de logikker der gentaget fejler — ikke at omtænke det der virker.**

Det betyder konkret:

- 10-15 kerne-logikker genskrives som single source of truth (pricing, identitet, permissions, lønperiode, attribution, cache-keys).
- ~250+ filer får deres adgangslag omplaceret mekanisk (Supabase-kald flyttes til service-lag). Logikken kopieres 1:1.
- UI røres ikke.
- Beregninger der virker i dag, kopieres.

---

## Hvad du skal levere

1. **Hvor du skifter mening efter at have læst de andre tre svar.** Vær specifik. Hvilke argumenter overbeviste dig? Hvad så du som du ikke selv havde set?

2. **Hvor du holder fast — og hvorfor det stadig er rigtigt selv efter at have set alternativerne.** Ikke gentagelse af dit første svar. Argumentet for hvorfor de andre tre tager fejl på dette punkt.

3. **Eksplicit stillingtagen til de tre centrale uenigheder mellem svarene:**

   a. **Hvor lever beregninger?** Postgres-RPC (PL/pgSQL), delt TypeScript-pakke brugt af edge+frontend, eller TypeScript-service per domæne? Du skal vælge én og begrunde mod de to andre.

   b. **Hvor smal er stammen?** Tre låste schemas (kun identity + money + compliance), eller bredere kerne der dækker mere? Du skal vælge og begrunde.

   c. **Domain events: ja eller nej?** Kun synkron RPC, eller RPC + asynkrone events til side-effekter (rematch, audit, notifikation)? Du skal vælge og begrunde.

4. **Revideret model.** Kan være tæt på dit første bud eller markant ændret. Vigtigt: tilpas omfanget til præmissen ovenfor. Hvis dit første bud forudsatte at alt skulle omtænkes, er det forkert grundlag. Det er konsolidering af kerne + mekanisk omplacering af adgangslag.

5. **Hvor du er mindst sikker.** Specifikt. Ikke generisk hedging.

---

## Hvad du ikke skal gøre

- Søg ikke kompromis med de andre tre. Du leverer dit uafhængige reviderede bud, ikke en sammensmeltning.
- Gentag ikke dit første svar med små justeringer. Hvis du ikke skifter mening på noget, sig det og forklar hvorfor de andres argumenter ikke flyttede dig.
- Underspil ikke det der gentaget fejler. UI virker, men kerne-logikker driver. Det er der 2.0 skal løse problemet.
- Overspil ikke. Det er ikke en genopbygning fra bunden. Det er konsolidering + omplacering.

---

De fire svar følger i filerne `svar-A.md`, `svar-B.md`, `svar-C.md`, `svar-D.md`.
