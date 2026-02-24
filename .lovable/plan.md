

# Plan: Tillad bagudrettet booking (maks 2 maaneder)

## Overblik

Kalenderne i booking-dialogen blokerer i dag alle datoer foer i dag. Aendringen tillader at vaelge datoer op til 2 maaneder tilbage, saa man kan registrere bookinger retroaktivt.

## Aendringer

### Fil: `src/pages/vagt-flow/BookWeekContent.tsx`

**1. Tilfoej en beregnet graense for 2 maaneder tilbage**

Tilfoej en konstant tidligt i komponenten:

```typescript
const twoMonthsAgo = useMemo(() => {
  const d = new Date();
  d.setMonth(d.getMonth() - 2);
  return startOfDay(d);
}, []);
```

**2. Opdater "Fra dato" kalender (linje 577)**

Erstat:
```typescript
disabled={(date) => isBefore(date, startOfDay(new Date()))}
```
Med:
```typescript
disabled={(date) => isBefore(date, twoMonthsAgo)}
```

**3. Opdater "Til dato" kalender (linje 606-608)**

Erstat:
```typescript
disabled={(date) => 
  isBefore(date, startOfDay(new Date())) || 
  (marketStartDate ? isBefore(date, marketStartDate) : false)
}
```
Med:
```typescript
disabled={(date) => 
  isBefore(date, twoMonthsAgo) || 
  (marketStartDate ? isBefore(date, marketStartDate) : false)
}
```

## Omfang

- 1 fil aendres, 3 linjer pavirkes
- Ingen database-aendringer
- Ugenavigationen (`handlePrevWeek`) har allerede ingen begransning, saa butik-bookinger kan ogsaa laves bagudrettet

