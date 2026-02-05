

# Plan: Fix "Glemt adgangskode" Flow

## Problemanalyse

Når brugeren klikker "Glemt adgangskode" på login-siden, bruges Supabase's native `resetPasswordForEmail` flow. Problemet er:

1. **Supabase logger automatisk brugeren ind** når de klikker på recovery-linket
2. **Race condition**: Auth.tsx forsøger at detektere `PASSWORD_RECOVERY` event eller `type=recovery` i URL hash, men dette kan fejle pga. timing
3. **Resultat**: Brugeren bliver logget ind og redirected til dashboard uden at ændre adgangskode

## Løsning

Erstat Supabase's native recovery flow med det **eksisterende custom token-baserede flow** (`send-password-reset` → `/reset-password`), som allerede fungerer korrekt for admin-initierede resets.

### Arkitektur-diagram

```text
NUVÆRENDE FLOW (problematisk):
┌─────────────┐    ┌──────────────────┐    ┌────────────┐
│ Auth.tsx    │───▶│ Supabase native  │───▶│ Auth.tsx   │
│ isResetMode │    │ resetPassword-   │    │ Auto-login │
│             │    │ ForEmail()       │    │ (BUG!)     │
└─────────────┘    └──────────────────┘    └────────────┘

NYT FLOW (robust):
┌─────────────┐    ┌──────────────────┐    ┌────────────────┐    ┌──────────────┐
│ Auth.tsx    │───▶│ initiate-        │───▶│ Email med      │───▶│/reset-password│
│ isResetMode │    │ password-reset   │    │ custom token   │    │(KRÆVER kode) │
│             │    │ (Edge Function)  │    │                │    │              │
└─────────────┘    └──────────────────┘    └────────────────┘    └──────────────┘
```

## Implementering

### Del 1: Opret ny Edge Function

Opretter `initiate-password-reset` som slår brugeren op i `employee_master_data` baseret på email og genererer et reset token.

**Fil:** `supabase/functions/initiate-password-reset/index.ts`

```typescript
// Lookup employee by email (private_email OR work_email)
// Generate token, hash it, store in password_reset_tokens
// Send email via M365 med link til /reset-password?token=xxx
```

**Vigtige punkter:**
- Bruger `employee_master_data` til at finde brugerens navn
- Genbruger token-hashing logik fra `send-password-reset`
- Sender email via M365 Graph API (eksisterende setup)
- Returnerer success selv hvis brugeren ikke findes (sikkerhed)

### Del 2: Opdater Auth.tsx

Ændrer `isResetMode` submitlogik til at kalde den nye Edge Function i stedet for `supabase.auth.resetPasswordForEmail`.

**Ændringer i `src/pages/Auth.tsx` (linje ~352-362):**

```typescript
// FØR:
} else if (isResetMode) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth`,
  });
  // ...
}

// EFTER:
} else if (isResetMode) {
  const { data, error: invokeError } = await supabase.functions.invoke(
    "initiate-password-reset",
    { body: { email: email.trim().toLowerCase() } }
  );
  
  if (invokeError) throw invokeError;
  
  toast({
    title: "Email sendt",
    description: "Hvis din email er registreret, modtager du et link inden for få minutter. Tjek også spam-mappen.",
  });
  setIsResetMode(false);
}
```

### Del 3: Oprydning i Auth.tsx

Fjerner eller forenkler den eksisterende `PASSWORD_RECOVERY` og `type=recovery` detection, da dette ikke længere er nødvendigt:

- Fjern recovery-detection i `useEffect` (linje 248-260)
- Behold `onAuthStateChange` listener for andre events
- Fjern `isNewPasswordMode` state og tilhørende UI (bruger `/reset-password` i stedet)

## Tekniske detaljer

### Ny Edge Function struktur

```text
supabase/functions/initiate-password-reset/
└── index.ts
```

### Database tabeller (eksisterende)
- `password_reset_tokens` - Gemmer hashed tokens med expiry
- `employee_master_data` - Lookup af brugerinfo

### Email-afsendelse
Genbruger M365 Graph API setup fra `send-password-reset`:
- Kræver `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`, `M365_SENDER_EMAIL`

### Sikkerhed
- Returnerer altid "Email sendt" besked for at forhindre user enumeration
- Token expires efter 24 timer
- Token kan kun bruges én gang

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/initiate-password-reset/index.ts` | **NY** - Edge Function |
| `src/pages/Auth.tsx` | Opdater reset-mode submit + fjern recovery detection |
| `supabase/config.toml` | Auto-opdateret med ny function |

## Test-scenarier

1. Bruger indtaster registreret email → modtager email med link
2. Bruger klikker link → kommer til `/reset-password` med token
3. Bruger opretter ny adgangskode → redirectes til login
4. Bruger logger ind med ny adgangskode → success
5. Bruger indtaster ukendt email → modtager stadig "Email sendt" (sikkerhed)

