# Skjul claim/reimport-numre fra "Mangler i PowerBI"

## Mål
Et Tastselv-salg skal ikke stå som "Mangler i PowerBI", hvis dets telefonnummer matcher et nummer der findes på fanen "Claims/Reimport" — også når nummeret slet ikke findes i de uploadede PowerBI-ark.

## Sådan virker det efter ændringen
- Missing-listen sammenholder først som i dag mod PowerBI-arkene på normaliseret mobilnummer.
- Derudover bygges et sæt af alle normaliserede numre på Eesy FM-salg der er markeret som Claim/Reimport (uanset om de er godkendt eller ej, og uanset hvilket salg nummeret sidder på).
- Er salgets nummer i dette sæt, udelades linjen fra "Mangler i PowerBI".
- "Afvigelser — oversigt" og "Claims/Reimport" er uændrede.

## Teknisk
`src/hooks/useEesyFmDeviations.ts`:
- Hent claim-numre i perioden: nyt `useQuery` (key `eesy-fm-claim-phones`) mod `sales` med `source = fieldmarketing`, `raw_payload->>fm_client_id = EESY_FM_CLIENT_ID`, `raw_payload->>fm_claim_reimport = true`, og samme `effFrom`/`effTo`-vindue som Stork-opslaget. Kun `customer_phone` hentes.
- Normalisér med den eksisterende `normalizePhone` og læg i et `Set<string>`.
- I `rows`-memoet, i `mode === "missing"`-grenen: `continue` hvis `sale.phoneNormalized` findes i settet.
- Tilføj querien til `isLoading`, så listen ikke blinker med falske manglende linjer under indlæsning.
- Cache-invalidering findes allerede for `eesy-fm-claim-sales`/`eesy-fm-stork-sales` i `useUpdateEesyFmClaimSale`; den nye key tilføjes samme sted, så listen opdateres når en claim markeres eller fjernes.

Ingen DB-ændringer, ingen ændring i pricing eller løn (grøn/gul zone: kun læse-hook + visning).
