# Claim/Reimport pr. linje i stedet for pr. salg

## Mål
Claim/Reimport skal markeres pr. telefonnummer-linje (pr. produkt/nummer), ikke som én samlet markering for hele registreringen.

## Ændringer i UI (Telefonnumre-kortet)
- Fjern den nuværende samlede "Claim/Reimport"-boks.
- Tilføj øverst i kortet (kun for Eesy FM) en boks "Marker alle". Når den vælges, sættes alle linjer til true; når den fravælges, sættes alle til false. Den viser automatisk delvist/fuldt markeret ud fra linjerne.
- Hver telefonnummer-linje får en checkbox yderst til højre med label "Claim/Reimport". Telefonnummer-inputtet indsnævres (fast maksbredde) for at gøre plads.
- Default er false på alle linjer. Ingen tvang til at vælge.

## Validering
- Kommentar under "Salgsoplysninger" bliver påkrævet, hvis mindst én linje er markeret som Claim/Reimport (samme opførsel som i dag: toast, rød ramme, scroll til feltet).
- Nulstilles sammen med resten af formularen efter gem og ved skift ud af callback-tilstand.

## Teknisk
- `src/pages/vagt-flow/SalesRegistration.tsx`:
  - Udvid `ProductSelection` med `claimFlags: boolean[]`, holdt i sync med `phoneNumbers` i `addProduct`, `removeProduct`.
  - Ny handler `toggleClaim(productId, index, value)` og `setAllClaims(value)`.
  - Erstat `isClaimReimport`-state med udledt `hasAnyClaim` (mindst én linje true) til kommentar-validering.
  - Salgsrækkerne i `handleSubmit` sendes uændret indtil videre (flaget gemmes ikke i data endnu) — datamodel for logning afklares som aftalt bagefter.

## Uden for scope
Persistering af flaget på salget i databasen samt visning i Claims/Reimport-fanen.
