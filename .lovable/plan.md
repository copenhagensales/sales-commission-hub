
# Fortrolige kontrakter: Stop HR-kopi ved underskrift

## Problem
Når en kontrakt underskrives, sender `send-contract-signed-confirmation` edge-funktionen **altid** en kopi til `job@copenhagensales.dk` (linje 366). Der er ingen check for om kontrakten er fortrolig. Derudover uploades kontrakten også til SharePoint uden fortrolighedscheck.

## Ændringer

### 1. ContractSign.tsx — Send `is_confidential` flag med
Tilføj `isConfidential: contract.is_confidential` til body-objektet der sendes til `send-contract-signed-confirmation`.

### 2. send-contract-signed-confirmation/index.ts — Respektér fortrolighed
- Tilføj `isConfidential` til request-interfacet
- **Skip** HR-kopi (job@copenhagensales.dk) når `isConfidential === true`
- **Skip** SharePoint-upload når `isConfidential === true`
- Bekræftelses-emailen til medarbejderen selv sendes stadig (de har ret til at se deres egen kontrakt)

### Resultat
Fortrolige kontrakter: Kun medarbejderen modtager bekræftelse. Ingen kopi til HR, ingen upload til SharePoint.
Normale kontrakter: Uændret adfærd.
