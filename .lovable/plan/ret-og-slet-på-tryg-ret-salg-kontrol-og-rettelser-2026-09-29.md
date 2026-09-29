# Ret og Slet på "Tryg - Ret salg" – kontrol og rettelser

## Hvad kontrollen viste
- **Slet** fjerner salget helt: selve salget og dets salgslinjer, annulleringskø, Tryg-gennemgang og prisrettelser slettes automatisk med. Provisionsposteringer bevares, men mister koblingen (historik). Rapporter/dashboards genberegnes af de automatiske kørsler (hvert minut og fuld opdatering hver time), så salget forsvinder derfra inden for få minutter.
- **Ret** retter sælger, dato, telefon og produkt direkte på salget. Ved produktskift genberegnes provision og omsætning af prismotoren. Rapporter følger med samme vej som ovenfor.
- **Fejl fundet:** Kun ejere og teamledere (fx Filip) har lov til at rette/slette i databasen. Annika har medarbejder-rollen. Når hun trykker Ret eller Slet, afviser databasen det uden fejlbesked, og siden viser "lykkedes", selvom intet ændres.
- **Kendt risiko (uændret):** Et slettet dialer-salg kan komme tilbage, hvis dialeren sender emnet igen.
- **Ved datoskift genberegnes provisionen ikke.** Prisregler kan afhænge af dato, så et salg der flyttes over en prisændring kan beholde den gamle provision.

## Ændringer
1. **Giv Annika og Filip adgang til at rette og slette (kun Tryg/United-kunderne).** Samme mønster som den eksisterende TDC-adgang: en databasefunktion afgør, om brugeren må rette Tryg-salg (ejer eller en af adresserne på listen), og en anden afgør, om salget hører til United-teamets kunder. Nye regler tillader visning, retning og sletning af de salg og deres salgslinjer for de brugere. Andre kunder berøres ikke.
2. **Aldrig falsk succes.** Ret og Slet tjekker, at databasen faktisk ændrede salget. Ellers vises en tydelig fejl: "Du har ikke adgang, eller salget findes ikke længere."
3. **Genberegn provision ved datoskift** (samme genberegning som ved produktskift).
4. **Test:** Opret et testsalg, ret produkt, sælger og dato, og kontrollér at provisionen og rapporttallet ændres. Slet det derefter og kontrollér, at det er væk fra salg, salgslinjer og rapportlaget. Testsalget ryddes op.

## Teknisk
- Migration: `can_edit_tryg_sales(uuid)` og `sale_is_united_client(uuid)` (SECURITY DEFINER, søgesti public). Den første er true for `is_owner`, eller når auth-mailen findes i en DB-liste. Listen spejler `BULK_SALES_EMAILS`, fordi en database ikke kan læse fra frontend-koden. Den anden er true, når salgets kampagne-kunde ligger i `team_clients` for United. Nye SELECT/UPDATE/DELETE-politikker på `sales` og `sale_items`, med GRANT EXECUTE til authenticated.
- `useUpdateUnitedSale.ts` og `useDeleteTrygKanvasSale(s)`: brug `.select("id")` og smid en fejl ved 0 rækker. Kald rematch også ved `saleDatetime`.
- Rød zone (auth/RLS). Scope godkendt via svaret "Giv Annika lov".
