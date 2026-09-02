# Send annulleringsmail fra "Tryg - Ret salg"

Ja, vi har mønstret allerede: mails sendes fra backend-funktioner via Microsoft 365 (Graph), fx `send-supplier-report` og `send-career-wish-notification`, og flere steder har en "send nu"-knap med dialog. Vi genbruger samme opsætning.

## Hvad der bygges

En ny knap **"Send til Tryg"** ved siden af "Kopiér markerede" i `Tryg - Ret salg`.

Flow:
1. Du markerer de afviste salg (samme markering som i dag).
2. Klik på "Send til Tryg" åbner en dialog med:
   - Modtagere vist som faste: `jm@copenhagensales.dk` og `fk@copenhagensales.dk`
   - Emne (kan rettes før afsendelse), fx "Annullering af Kanvas-møder - 02/09/2026"
   - Beskedfelt forudfyldt med den eksisterende skabelon, hvor telefonnumrene på de markerede salg allerede er indsat — præcis samme udfyldning som "Kopiér markerede" laver i dag
   - Antal numre der sendes
3. "Send" sender mailen og viser bekræftelse. Fejl vises tydeligt med årsag.

Knappen er inaktiv hvis ingen linjer er markeret. Adgang er uændret (ejere + Filip og Annika).

## Afgrænsning

- Ingen ændringer i salgsdata, provision, priser eller status-markeringer. Mailen læser kun det du har markeret.
- Modtagerlisten er hardkodet i denne runde (ét sted i koden, nemt at udvide senere til en administrerbar liste).
- Ingen automatisk/planlagt afsendelse — kun manuelt klik.

## Teknisk

1. Ny edge function `supabase/functions/send-tryg-cancellation/index.ts`
   - Validerer JWT og at brugeren har Tryg-ret-adgang (samme regel som `useTrygEditAccess`: ejer/superadmin eller de to tilladte mails) — ellers 403.
   - Validerer input med zod: `subject` (1-200), `body` (1-10000), `phones` (array af strenge, max 200).
   - Sender via M365 Graph `sendMail` med samme token-helper som de øvrige send-funktioner; modtagere hardkodet i funktionen (`TRYG_RECIPIENTS`).
   - Returnerer `{ success: true, recipients }` eller `{ error }` med korrekt HTTP-status og CORS-headers.
2. Ny hook `src/hooks/useSendTrygCancellation.ts` — mutation der kalder funktionen og læser fejltekst fra `FunctionsHttpError`-context.
3. Ny komponent `src/components/reports/SendTrygMailDialog.tsx` — dialog med modtager-badges, emne, besked (forudfyldt), antal numre og send-knap. Bygget som `SendToSupplierDialog`.
4. `src/pages/reports/TrygEditSales.tsx` — ny knap + dialog-state. Beskeden forudfyldes med den eksisterende `fillPhonePlaceholders(template, selectedPhones)`, så skabelon-logikken forbliver ét sted.
5. `src/config/trygMailRecipients.ts` — samme liste som i edge function, kun til visning i dialogen (kommentar om at edge function er sandheden).

Ingen migration, ingen RLS-ændringer, ingen ændringer i pricing/løn.
