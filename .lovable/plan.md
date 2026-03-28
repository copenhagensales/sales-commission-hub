

## Ret DPA-tekst i AdminDocumentation

### Problem
Linje 119 i `src/pages/compliance/AdminDocumentation.tsx` siger:
> *"Bekræft at DPA'er er underskrevet og arkiveret."*

Dette er forkert — I bruger leverandørernes offentlige standard-DPA'er, ikke individuelt underskrevne aftaler.

### Ændring

Erstat teksten med noget i stil med:

> *"Alle leverandører anvender deres offentligt tilgængelige standard-DPA, som accepteres ved brug af tjenesten. Se [Dataoverførsler til tredjeparter](/compliance/data-transfers) for links til de enkelte DPA'er."*

Dette linker direkte til den opdaterede DataTransferRegistry-side, hvor alle DPA-links allerede er dokumenteret.

### Fil
- `src/pages/compliance/AdminDocumentation.tsx` (linje 118-120)

### Risiko
Ingen. Kun en tekstrettelse.

