# Kvalitetsfeedback på forsiden — vis alle sager, og kun den rigtige årsag

## Hvad er galt i dag (bekræftet i data og kode)

**1. Kun én sag ad gangen**
Forsidekassen er bygget som et "bladre-kort": den viser sag 1 og pile med "1 af 3". Alle sager ligger klar, men man skal klikke sig igennem dem én for én.

**2. Dobbelt årsag på samme sag**
Der vises to mærkater der betyder det samme: "OA gennemgået" og "OA ikke gennemgået". Årsagen er, at listen blander to ting:
- den fejl kontrollanten faktisk valgte ("OA ikke gennemgået" / "OA ikke godkendt")
- det tjeklistepunkt, systemet automatisk sætter som manglende ("OA gennemgået")

Databasen bekræfter mønstret: næsten alle afviste sager har præcis én valgt fejl **og** tjeklistepunktet "OA gennemgået" med i samme liste.

## Sådan skal det virke

**Alle sager synlige på én gang.**
Kassen bliver en liste. Hver sag er sin egen kompakte linje med tid, kampagne, kunde/salg, årsag, kommentar og egen kvitteringsknap. Op til 3 vises åbent; er der flere, kan man udvide med "Vis alle (n)". Ingen pile, ingen bladring. Er der mere end én sag, kommer der også "Kvitter alle".

**Én årsag — den rigtige.**
Vi viser kun det kontrollanten selv har valgt. Tjeklistepunkter bruges kun som reserve, hvis der slet ikke er valgt en fejl på sagen, så gamle sager ikke bliver tomme. Ingen historik ændres — vi ændrer kun hvad der vises.

**Tydelig forskel på de to slags beskeder.**
- Afvist: rød ramme, teksten "Afvist i kvalitetskontrollen".
- Feedback: gul ramme, teksten "Feedback — salget står ved magt".
Under begge står, at kvalitetsstatus ikke rører provision, løn eller annulleringer.

**Ledere ser hvem det handler om.**
Er man leder, står sælgerens navn og team først på linjen. Er man sælger, står ens eget navn selvfølgelig ikke.

**Uændret adfærd i øvrigt:** kassen tager ikke fokus, ingen lyd, ingen popup, og "Se som" kan stadig ikke kvittere.

## Teknisk

- Migration: genopret `get_my_quality_feedback()` og `get_quality_feedback_history(uuid)` med samme signatur og returtype. Ændringen er alene i `reason_labels`: valgte fejlkoder fra `quality_review_error_codes` prioriteres; manglende tjeklistepunkter fra `quality_review_items` bruges kun når fejlkode-listen er tom. Filtre, sortering, `effective_employee_id()`/`effective_auth_user_id()`, adgangstjek, void-filtrering og kvitteringsfiltrering er uændrede. Ingen skemaændring, ingen RLS-ændring, ingen datamutation.
- `src/components/quality/QualityFeedbackInbox.tsx`: erstat carousel-state med liste; `expanded`-state til "Vis alle"; pr.-række kvittering via eksisterende `useAcknowledgeQualityFeedback`; "Kvitter alle" kalder samme mutation i rækkefølge.
- `src/hooks/useQualityFeedback.ts`: uændret (typer og RPC-kald matcher fortsat).
- Ingen ændringer i `save_quality_review`, kontrolfladen, mails, løn, pricing eller KPI'er.

## Verifikation

- Typecheck.
- Databasetjek: afvist sag viser præcis én årsag ("OA ikke godkendt"), feedback-sag viser "Andet", gammel sag uden fejlkode viser fortsat tjeklistepunkt.
- Browsertjek på forsiden: flere sager synlige samtidig, korrekt farve pr. type, kvittering slået fra under "Se som".
