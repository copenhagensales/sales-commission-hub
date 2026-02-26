

## Fix: Kampagne nulstilles ved åbning af Rediger-dialog

### Problem
Når du åbner Rediger-dialogen, sættes både kunde og kampagne med det samme (fra bookingdata). Men kampagne-listen hentes asynkront baseret på den valgte kunde. I det korte øjeblik hvor listen endnu ikke er hentet, har Select-komponenten en værdi (`campaignId`) men ingen matchende valgmuligheder - så den viser "Vælg kampagne" i stedet for den korrekte kampagne.

Det betyder at du skal vælge kampagnen igen, selvom den allerede var sat.

### Løsning
Tilføj kampagnens aktuelle ID og navn som et fallback-element i Select-listen, så den altid kan vise den korrekte værdi - også mens kampagne-listen loader.

### Ændring

**`src/components/vagt-flow/EditBookingDialog.tsx`**

I kampagne-Select (linje ~1004-1010): Tilføj et fallback `<SelectItem>` når `campaignId` er sat men ikke findes i den loadede `campaigns`-liste. Bookingen indeholder allerede kampagnenavnet (via join), så vi kan vise det korrekt.

Konkret:
- Tjek om `campaignId` allerede findes i `campaigns`-listen
- Hvis ikke (fx fordi listen stadig loader), vis et midlertidigt SelectItem med booking-kampagnens navn
- Når listen loader færdig, overtager de rigtige items automatisk

Det er en ~5-linjers ændring der fjerner behovet for at genvælge kampagnen.
