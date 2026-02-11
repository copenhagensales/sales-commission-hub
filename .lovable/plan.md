

## Problem: Uendelig request-loop i "DB per Klient"

Tabellen hænger på "Indlæser..." fordi der kører en uendelig fetch-loop.

### Årsag

Linje 120 i `ClientDBTab.tsx`:
```
const effectivePeriodEnd = isCapped ? new Date() : periodEnd;
```

Hver gang komponenten rendrer, laves et **nyt** `new Date()` med en ny millisekund-timestamp. Det nye objekt ender i query-keyen for `useAssistantHoursCalculation` (og den fulde-maned-variant), som medforer:

1. Nyt `Date`-objekt → ny `.toISOString()` → ny query key
2. Ny query startes → data returneres → state opdateres
3. Re-render → nyt `new Date()` → ny query key → gaa til punkt 2

### Losning

Stabiliser `effectivePeriodEnd` ved at runde `new Date()` ned til **starten af dagen** (midnat), saa den ikke aendrer sig mellem re-renders. Alternativt kan vi bruge `useMemo` til at cache vaerdien.

### Implementeringsplan

**Fil: `src/components/salary/ClientDBTab.tsx`**

1. Importer `startOfDay` fra `date-fns` (eller brug eksisterende imports)
2. AEndr linje 120 fra:
   ```
   const effectivePeriodEnd = isCapped ? new Date() : periodEnd;
   ```
   til:
   ```
   const today = useMemo(() => startOfDay(new Date()), []);
   const effectivePeriodEnd = isCapped ? today : periodEnd;
   ```
   
   Da det er en DB-rapport paa dagsniveau, er det tilstraekkeligt at cappe ved starten af dagen. Dette sikrer at `effectivePeriodEnd` er stabil mellem re-renders.

3. Fjern den gamle `const today = new Date()` paa linje 587 inde i `useMemo`-blokken og brug den nye stabile `today` i stedet.

### Teknisk detalje

`useMemo(() => startOfDay(new Date()), [])` koerer kun en gang pr. komponent-mount. Da vi kun behover at cappe ved "i dag" (ikke "lige nu"), er dette praecist nok og eliminerer loop-problemet fuldstaendigt.

