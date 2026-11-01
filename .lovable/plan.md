# »Slet salg«-knap under »Tastet i dag«

## Vigtigt om »slet«
Salg må aldrig slettes fysisk i Stork (fast regel: medarbejdere og salg slettes aldrig). Knappen »Slet salg« fjerner derfor salget ved at markere det som afvist – samme metode som rettelserne allerede bruger til leaddelen. Afviste salg giver 0 kr. provision/omsætning, tæller ikke på boards (fibertælleren ignorerer afviste), og historikken bevares.

## Sådan virker det
- Knappen »Slet« står ved siden af »Ret« på hvert salg i »Tastet i dag«, kun for admins (ejere, Rasmus, Johannes) – samme som »Ret«.
- Tryk åbner en bekræftelse: »Vil du slette salget? Det giver 0 kr. og tæller ikke længere.« med Ja/Nej.
- Ved lukket salg slettes både lukkerens del og leadgiverens del.
- Salget forsvinder fra listen »Tastet i dag«.
- Det gælder kun dagens salg (som »Ret«); tilbagedaterede salg er ikke med.

## Teknisk
- Ny databasefunktion `tdc_fiber_slet_salg(p_salg_id)` (SECURITY INVOKER, fast search_path): kræver `tdc_fiber_er_admin()`, kilde `tdc_fiber_manual`, dagens dato; sætter `validation_status='rejected'` på salget og evt. tilknyttet leaddel; skriver en linje i `tdc_fiber_rettelser` (handling »slettet«, admin, tidspunkt). Bruger eksisterende UPDATE-regler; ingen nye adgange.
- `useTdcFiberSales.ts`: ny mutation + skjul afviste lukker-/fuldt-salg i listen; invalidér samme query keys som rettelse.
- `TdcErhvervFiberPladsholder.tsx`: Slet-knap (44 px) + bekræftelsesdialog/skuffe.
- Test i `tdcFiber.test.ts` hvis logik flyttes til `tdcFiber.ts`.
- Intet prøve-slet på rigtige salg; preview ved 360/393/430 + desktop.
