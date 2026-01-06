# Microsoft 365 SSO Implementation

## Overblik
Tilføj Microsoft login med validering mod employee_master_data, så kun eksisterende medarbejdere kan tilgå systemet.

## Trin 1: Azure Portal Opsætning (Admin)
1. Gå til Azure Portal → App registrations → New registration
2. Navn: "CPH Sales Platform"
3. Redirect URI: `https://jwlimmeijpfmaksvmuru.supabase.co/auth/v1/callback`
4. Kopier: Client ID, Tenant ID
5. Opret Client Secret og kopier værdien

## Trin 2: Backend Konfiguration
- Tilføj secrets: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
- Konfigurer Azure provider i auth-settings

## Trin 3: Login UI
- Tilføj "Log ind med Microsoft" knap på Auth-siden
- Bruger eksisterende Supabase OAuth flow

## Trin 4: Medarbejder-Validering
- Udvid ProtectedRoute til at tjekke employee_master_data
- Hvis bruger IKKE findes i employee_master_data → log ud + vis fejl
- Matcher på work_email ELLER private_email

## Sikkerhed
- Kun medarbejdere i employee_master_data får adgang
- Azure Conditional Access policies gælder automatisk (MFA, lokation, etc.)
- Unauthorized brugere kan ikke tilgå systemet

## Filer der ændres
- `src/pages/Auth.tsx` - Microsoft login knap
- `src/components/RoleProtectedRoute.tsx` - Medarbejder-validering
- `src/hooks/useAuth.tsx` - Validerings-logik
