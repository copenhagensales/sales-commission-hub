
# Plan: Debug PASSWORD_RECOVERY Event Handling

## Problemanalyse

### Nuværende flow for Supabase Password Reset (fra login-siden):
1. Bruger klikker "Glemt adgangskode?" på `/auth`
2. Supabase sender en email med link til: `https://[project].lovableproject.com/auth#access_token=XXX&type=recovery...`
3. Bruger klikker linket → browser navigerer til `/auth` med hash-fragmentet
4. Supabase SDK parser hash-fragmentet og trigger `PASSWORD_RECOVERY` event
5. `Auth.tsx` skal fange dette event og sætte `isNewPasswordMode = true`

### Identificeret problem:
I `src/routes/guards.tsx` (linje 15-20):
```typescript
export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;  // ⚠️ PROBLEM HER
  return <>{children}</>;
}
```

**Race condition:** Når brugeren klikker på reset-linket:
1. Supabase SDK parser hash-fragmentet og logger brugeren ind (for at lade dem skifte password)
2. `AuthRoute` ser at `user` eksisterer og redirecter straks til `/`
3. `PASSWORD_RECOVERY` eventet når aldrig at blive fanget i `Auth.tsx`
4. Brugeren ender på forsiden - stadig logget ind, men uden mulighed for at oprette ny adgangskode

### Yderligere problem i Auth.tsx:
`useEffect` (linje 234-258) registrerer `onAuthStateChange` listeneren, men:
- SDK'et har muligvis allerede parset hash-fragmentet før listeneren er sat op
- Eventet kan være "mistet" hvis det sker under initial render

---

## Løsningsplan

### Trin 1: Tilføj URL-baseret recovery detection i AuthRoute
**Fil:** `src/routes/guards.tsx`

Opdater `AuthRoute` til at tjekke om URL'en indeholder `type=recovery` i hash-fragmentet:
- Hvis ja, tillad rendering af Auth-siden (skip redirect)
- Dette sikrer at brugeren kan se password-formularen

```typescript
export function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  // Check if this is a password recovery flow - don't redirect even if logged in
  const isRecoveryFlow = window.location.hash.includes('type=recovery');
  
  if (loading) return <PageLoader />;
  if (user && !isRecoveryFlow) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

### Trin 2: Tilføj robust recovery detection i Auth.tsx
**Fil:** `src/pages/Auth.tsx`

Forbedre `useEffect` til også at tjekke URL hash for `type=recovery`:

```typescript
useEffect(() => {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const errorDescription = hashParams.get('error_description');
  const error = hashParams.get('error');
  const tokenType = hashParams.get('type');
  
  // Detect recovery from URL hash (in case event was missed)
  if (tokenType === 'recovery' && !error) {
    console.log('[Auth] Recovery flow detected from URL hash');
    setIsNewPasswordMode(true);
    setIsResetMode(false);
    setExpiredLinkError(false);
  } else if (error || errorDescription) {
    setExpiredLinkError(true);
    setIsResetMode(true);
    window.history.replaceState(null, '', window.location.pathname);
  }

  // Listen for password recovery event (backup)
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    console.log('[Auth] Auth state changed:', event);
    if (event === 'PASSWORD_RECOVERY') {
      setIsNewPasswordMode(true);
      setIsResetMode(false);
      setExpiredLinkError(false);
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

### Trin 3: Tilføj debug logging
Tilføj console.log statements for at spore:
- Om hash-fragmentet indeholder recovery token
- Om `PASSWORD_RECOVERY` event bliver modtaget
- Om brugeren redirectes væk

---

## Tekniske detaljer

### Ændrede filer:
1. `src/routes/guards.tsx` - AuthRoute komponent
2. `src/pages/Auth.tsx` - useEffect med recovery detection

### Test-scenarie:
1. Send password reset email fra login-siden
2. Klik på linket i emailen
3. Verificer at bruger ser "Vælg ny adgangskode" formularen
4. Indtast ny adgangskode og bekræft

### Forventet resultat:
- Bruger bliver ikke længere redirectet væk fra `/auth`
- Password-formularen vises korrekt
- Bruger kan oprette ny adgangskode
