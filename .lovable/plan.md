# Kvalitetsfeedback vises ikke i "Se som"

## Hvad der faktisk sker

Du ser Stork som Signe Marstrand (læseadgang), men forsidekassen er tom. Det er ikke fordi Signe mangler en tilbagemelding — hun har én afvisning fra i dag, og den blev bekræftet tidligere.

Årsagen er bekræftet i databasen: de to nye kvalitetsfunktioner slår brugeren op ud fra den indloggede konto og ikke ud fra den person, man ser systemet som.

- `get_my_quality_feedback` bruger `get_current_employee_id()` og `auth.uid()`.
- `get_quality_feedback_history` bruger de samme.
- Stork har allerede færdige "se som"-varianter, som resten af systemet bruger: `effective_employee_id()` og `effective_auth_user_id()`.

Resultat: når du ser systemet som Signe, henter kassen fortsat Kaspers egne sager. Kasper har ingen, og kassen forsvinder derfor helt — præcis som den skal, når køen er tom.

## Rettelsen

Skift de to funktioner til at bruge de eksisterende "se som"-varianter, så kvalitetsfeedback opfører sig som alle andre sider i Stork under "Se som".

Vigtigt: "Se som" er ren læseadgang. Kvitteringen ("OK, set") skal derfor **ikke** kunne afgives, mens man ser systemet som en anden. Kassen viser sagerne, men kvitteringsknappen bliver deaktiveret med teksten om, at man ser systemet som en anden.

## Hvad der ikke ændres

- Ingen ændring i løn, provision, pricing, afregning, annullering eller nogen KPI.
- Ingen historik slettes eller omskrives; kvitteringer forbliver uforanderlige.
- Adgangsreglerne strammes ikke op eller løsnes: en leder ser fortsat kun sine egne hold, og kvalitetskontrollanter/ejere ser fortsat alt.

## Teknisk

1. Migration der genskaber de to funktioner uændret bortset fra opslaget af personen:
   - `get_my_quality_feedback`: `v_me := public.effective_employee_id()` og `quality_my_leader_team_ids(public.effective_auth_user_id())`.
   - `get_quality_feedback_history`: samme to udskiftninger; adgangstjekket bevares 1:1.
   - Returtyper, kolonnerækkefølge, filtre (`afvist` / `godkendt_med_bemaerkning`, ikke-voidede, ikke-kvitterede) og sortering forbliver identiske, så frontend ikke behøver ændres.
   - `acknowledge_quality_feedback` beholder `get_current_employee_id()` bevidst — en kvittering skal altid bindes til den, der faktisk er logget ind.
2. `src/components/quality/QualityFeedbackInbox.tsx`: deaktivér kvitteringsknappen, når der er et aktivt "Se som"-forløb, med kort forklarende tekst. Læs tilstanden fra den eksisterende "Se som"-kilde i frontend — ingen ny tabelopslag i komponenten.
3. Verifikation: kør funktionerne som Signes konto og som en teamleder, samt i browseren under "Se som" for at bekræfte, at kassen dukker op med afvisningen og at kvittering er slået fra.
