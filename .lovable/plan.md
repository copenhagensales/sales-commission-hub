

## Tilføj forklaringsikoner til Sletningspolitikker

### Hvad sker der
Tilføj et lille info-ikon (tooltip) ved hver kampagne-række og hver datatype-række, der forklarer præcis hvad der sker ved rensning.

### Ændringer

**Fil: `src/pages/compliance/RetentionPolicies.tsx`**

1. Importér `Tooltip`, `TooltipTrigger`, `TooltipContent` og `Info`-ikonet
2. Kampagnetabellen: Tilføj en ny "Info"-kolonne med et `Info`-ikon der viser tooltip baseret på den valgte `cleanup_mode`:
   - **anonymize_customer**: "Kundedata anonymiseres: telefon → null, firma → 'Anonymiseret', raw_payload → null. Salgsdata bevares."
   - **delete_all**: "Hele salgsrækken slettes inkl. tilknyttede poster."
3. Øvrige datatyper-tabellen: Tilføj info-ikon ved datatype-navnet med en forklaring per type:
   - **customer_inquiries**: "Kundehenvendelser slettes permanent efter udløb."
   - **candidates**: "Kandidatdata anonymiseres eller slettes efter udløb."
   - **inactive_employees**: "Deaktiverede medarbejdere slettes fra master data efter udløb."
   - **integration_logs**: "Integrationslogfiler med potentielle persondata slettes."
   - **login_events**: "Login-historik (email, IP, user agent) slettes."
   - **password_reset_tokens**: "Udløbne password reset tokens slettes."
   - **communication_logs**: "Rekrutteringskommunikation (SMS/email) slettes."

### Teknisk
- Bruger eksisterende `Tooltip`-komponent fra `@/components/ui/tooltip`
- Info-ikonet placeres inline ved siden af kampagnenavn / datatype-navn
- Én fil ændres: `RetentionPolicies.tsx`

