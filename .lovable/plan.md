

## Tilføj tjekliste-checkboxes + påmindelse i VehicleReturnCallout

### Hvad bygges

Før foto-upload sektionen tilføjes **3 checkboxes** som skal afkrydses, inden upload-knapperne og bekræft-knappen bliver aktive:

1. ✅ **Udstyr båret op** — "Jeg har båret alt udstyr op fra bilen"
2. ✅ **Bil rengjort** — "Jeg har rengjort bilen indvendig"
3. ✅ **Nøgle i nøgleboks** — "Jeg har lagt nøglen tilbage i nøgleboksen"

### Flow

```text
[ Instruktioner som i dag ]
        ↓
[ ] Udstyr båret op
[ ] Bil rengjort  
[ ] Nøgle i nøgleboks
        ↓  (alle 3 checked → unlock)
[ Tag billede ] [ Upload ]
        ↓
[ Bekræft aflevering ]
```

- Foto-knapper og bekræft-knap er **disabled/skjulte** indtil alle 3 er checked
- Uafkrydsede punkter har en subtil pulserende/gul markering som visuel påmindelse
- Når man checker den sidste boks, glider foto-sektionen ind med en kort animation

### Påmindelse-mekanisme (smart)

- Hvis brugeren har været på siden i **30 sekunder** uden at checke alle bokse, vises en **toast-påmindelse**: "Husk at tjekke alle punkter før du afleverer nøglen"
- Ikke-afkrydsede bokse får en **shake-animation** efter 30s for at fange opmærksomhed
- Kun client-side — ingen DB-ændringer nødvendige

### Tekniske ændringer

**Fil: `src/components/vagt-flow/VehicleReturnCallout.tsx`**

- Tilføj 3 `useState<boolean>` for checkboxes (eller ét objekt)
- Importér `Checkbox` fra `@radix-ui/react-checkbox` (allerede installeret)
- Beregn `allChecked = equipment && cleaned && keyReturned`
- Foto-sektion og confirm-knap betinges af `allChecked`
- Tilføj `useEffect` med 30s timer der viser toast + sætter `showReminder` state for shake-animation
- Brug `cn()` til at tilføje `animate-pulse` / shake-class på uafkrydsede items efter timeout

Ingen nye filer, ingen DB-ændringer, ingen nye dependencies.

