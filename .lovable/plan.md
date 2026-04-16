

# Plan: Send besked tilbage til indberetteren med anmodning om uddybning

## Nuværende situation
- `system_feedback` tabellen har allerede en `admin_response` kolonne (ubrugt)
- Admin kan ændre status og skrive interne noter, men kan ikke sende en synlig besked tilbage til indberetteren
- Der er allerede en `notify-feedback-status-change` Edge Function der sender email via M365

## Løsning
Tilføj et "Bed om uddybning"-felt i admin-dialogen, som gemmer beskeden i `admin_response`, sætter status til `needs_clarification`, og sender en email til indberetteren med spørgsmålet.

## Tekniske ændringer

### 1. Tilføj ny status
I `SystemFeedback.tsx`, tilføj til `STATUSES`:
```typescript
{ value: "needs_clarification", label: "Afventer svar", color: "bg-purple-500/20 text-purple-400" }
```

### 2. Udvid admin-dialogen
I detail-dialogen (linje ~605-636), tilføj:
- Et tekstfelt "Besked til indberetteren" der gemmer i `admin_response`
- En "Send & bed om uddybning" knap der sætter status til `needs_clarification`, gemmer `admin_response`, og sender email
- Vis eksisterende `admin_response` i dialogen hvis den allerede er sat

### 3. Opdater updateMutation
- Inkluder `admin_response` i `.update()`-kaldet
- Send `adminResponse` med i notification-data

### 4. Opdater `notify-feedback-status-change` Edge Function
- Accepter `adminResponse` parameter
- Når status er `needs_clarification`, brug en anden email-skabelon med beskeden og en opfordring til at svare/kontakte admin

### 5. Vis admin-svar for indberetteren
- I feedback-listen (for ikke-owners), vis `admin_response` som en synlig besked på den pågældende feedback-post, så indberetteren kan se hvad der bliver spurgt om

## Filer der ændres
- `src/pages/SystemFeedback.tsx` — ny status, admin_response felt, vis svar
- `supabase/functions/notify-feedback-status-change/index.ts` — håndter uddybnings-email

Ingen database-migration nødvendig — `admin_response`-kolonnen eksisterer allerede.

