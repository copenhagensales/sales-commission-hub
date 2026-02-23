

# Test ASE /leads: Hent et enkelt Success-lead med fuld data

## Formaal

Teste om `/leads/{uniqueId}` (enkelt-lead endpoint) returnerer `data`-feltet med kundeinfo, da list-endpointet returnerer `data: {}` for alle leads.

## Aendring

### `supabase/functions/test-ase-leads/index.ts` - Omskriv til fokuseret test

Erstat hele indholdet med en simpel 2-trins test:

1. **Hent liste**: `/leads?SearchName=cphsales2&ModifiedFrom={3dageBack}&Include=data,campaign,lastModifiedByUser,firstProcessedByUser` -- find Success-leads og vis deres `data`-felt
2. **Hent enkelt lead**: `/leads/{uniqueId}?Include=data,campaign,lastModifiedByUser,firstProcessedByUser` -- hent fuld detalje for foerste Success-lead og vis ALLE felter og data

Returnerer et JSON-objekt med:
- `totalLeads`, `successCount` -- oversigt
- `firstSuccessFromList` -- data-feltet som listen returnerer (forventet tomt)
- `singleLeadDetail` -- data-feltet fra enkelt-lead endpoint (muligvis udfyldt)

### Deploy og kald

Efter deploy, kald funktionen og analyser om `singleLeadDetail.dataFull` indeholder kundefelter (Navn1, Telefon1, A-kasse salg osv.).
