
## Lås System for Medarbejdere med Afvist Kontrakt

### Problemet
Når en medarbejder afviser en kontrakt, beholder de stadig fuld adgang til systemet. Der er aktuelt **7 medarbejdere** med afviste kontrakter som alle stadig er aktive (`is_active: true`).

### Løsning
Opret en ny "Rejected Contract Lock" der låser systemet for medarbejdere med afviste kontrakter og viser en besked om at kontakte nærmeste leder.

---

### Implementeringsplan

#### 1. Opret hook: `useRejectedContractLock`
**Ny fil:** `src/hooks/useRejectedContractLock.ts`

Formål: Tjek om den aktuelle bruger har en afvist kontrakt.

Logik:
- Hent employee_id for den loggede bruger
- Tjek om der findes kontrakter med `status = 'rejected'` for denne medarbejder
- Returnér `isLocked: true` hvis der findes afviste kontrakter

#### 2. Opret overlay-komponent: `RejectedContractLockOverlay`
**Ny fil:** `src/components/layout/RejectedContractLockOverlay.tsx`

Design:
- Fuld-skærm overlay (som eksisterende locks)
- Rød/destructive farvetema
- Ikon: `XCircle` eller `Ban`
- Titel: "Adgang spærret"
- Besked: "Du kan ikke bruge systemet, da du har afvist en kontrakt. Kontakt venligst din nærmeste leder for at løse dette."
- Kun "Log ud" knap (ingen handling de selv kan udføre)

#### 3. Integrér i `LockOverlays.tsx`
**Fil:** `src/components/layout/LockOverlays.tsx`

Ændringer:
- Importér `useRejectedContractLock` og `RejectedContractLockOverlay`
- Tilføj hook-kald
- Afvist-kontrakt-lock skal have **højeste prioritet** - vises FØR pending contract lock
- Hvis `isRejectedContractLocked === true` → vis `RejectedContractLockOverlay`

---

### Prioriteringsrækkefølge for locks

1. **Afvist kontrakt** (ny) - Højeste prioritet, ingen vej ud
2. Pending kontrakt (>5 dage)
3. Car Quiz
4. MFA
5. Goal

---

### UI Design

Overlay-strukturen:

```
┌─────────────────────────────────────┐
│                                     │
│            🚫 (ikon)                │
│                                     │
│        Adgang spærret               │
│                                     │
│   Du kan ikke bruge systemet,       │
│   da du har afvist en kontrakt.     │
│   Kontakt venligst din nærmeste     │
│   leder for at løse dette.          │
│                                     │
│        [Log ud]                     │
│                                     │
└─────────────────────────────────────┘
```

---

### Tekniske Detaljer

**Hook query:**
```typescript
const { data: rejectedContracts } = await supabase
  .from("contracts")
  .select("id, title")
  .eq("employee_id", employeeData)
  .eq("status", "rejected")
  .limit(1);

return { 
  isLocked: rejectedContracts && rejectedContracts.length > 0,
  contract: rejectedContracts?.[0] ?? null 
};
```

**Filer der oprettes:**
1. `src/hooks/useRejectedContractLock.ts`
2. `src/components/layout/RejectedContractLockOverlay.tsx`

**Fil der ændres:**
1. `src/components/layout/LockOverlays.tsx`

### Forventet Resultat
- Medarbejdere med afviste kontrakter kan ikke bruge systemet
- De ser kun et overlay med instruktion om at kontakte deres leder
- Eneste handling er at logge ud
- Ejere/admins i preview-mode kan stadig teste systemet
