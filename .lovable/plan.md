
# Ret ASE API URL

## Problem
ASE-integrationen har en forkert API URL der forhindrer synkronisering:
- **Nuværende**: `Web: https://wshero01.herobase.com/`
- **Korrekt**: `https://wshero01.herobase.com/api`

## Løsning
Opdater `api_url` feltet i `dialer_integrations` tabellen for ASE-integrationen.

```sql
UPDATE dialer_integrations 
SET api_url = 'https://wshero01.herobase.com/api'
WHERE name = 'ase';
```

## Efter rettelsen
Når URL'en er rettet, skal du køre en ny synkronisering for ASE (45 dage) for at:
1. Hente salgsdata fra HeroBase API'et
2. Anvende de nye `conditionalRules` for produktmapping
3. Opdatere eksisterende salg med korrekte produkter

## Teknisk note
Enreach-adapteren har allerede logik til at fjerne `"Web: "` præfikset automatisk, men den manglende `/api` sti er det egentlige problem.
