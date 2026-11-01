# Ret fejlen »Ikke oprettet – Ukendt fejl« ved fibersalg

## Årsag (bekræftet)
Databasen svarer `42P17 infinite recursion detected in policy for relation "sale_items"`.
Tre indsætningsregler på `sale_items` slår op i `sale_items` selv (`NOT EXISTS (SELECT 1 FROM sale_items x WHERE x.sale_id = s.id)`):
- »TDC fiber admins kan oprette salgslinje«
- »TDC fiber admins kan oprette salgslinje for saelger« (adminoprettelse – den Jeppe brugte)
- »TDC fiber saelgere kan oprette salgslinjer« (sælgerens egen registrering – rammes formentlig af samme fejl)

Postgres afviser regler, der læser deres egen tabel. Intet salg blev oprettet (hele kaldet rulles tilbage), så der er ingen halve data.

## Rettelse (én migration)
1. Ny hjælpefunktion `tdc_fiber_salg_har_linjer(p_sale_id uuid) returns boolean` – plpgsql, `SECURITY INVOKER`, `STABLE`, fast `search_path = public`. Den tjekker, om salget allerede har linjer. Da den kører som almindelig funktion, udløser den ikke rekursion, og den ser kun det, brugeren har lov at se.
2. Genskab de tre regler uændret, bortset fra at selv-opslaget erstattes af `NOT public.tdc_fiber_salg_har_linjer(s.id)`. Alle øvrige betingelser (admin-tjek, kilde, dato/periode, registreret_af, 10-minutters-vindue) bevares ord for ord.

Ingen ændringer i frontend, provision, priser, board eller andre kunders regler. Ingen SECURITY DEFINER, ingen anon-adgang.

## Kontrol
- Simulér som indlogget admin i en transaktion, der rulles tilbage (`set local role authenticated` + jwt-claims), at indsætning af salg + linje ikke længere giver 42P17 – intet gemmes.
- Kør `tdcFiber.test.ts`.
- Bed Jeppe prøve igen; intet rigtigt prøvesalg fra min side, da det giver provision.
