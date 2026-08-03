# Hvorfor kun "5G Internet" kan vælges — og hvorfor opsætningen var lavet så inaktive produkter blev solgt

## Rod-årsag (verificeret i DB)

`is_active` på `products` har aldrig været brugt som "synlig for sælgere". Den har været brugt som **navne-tiebreaker for FM-triggeren**.

Triggeren `create_fm_sale_items()` matcher udelukkende på produktNAVN:

```text
FROM products
WHERE LOWER(TRIM(name)) = LOWER(TRIM(v_product_name))
  AND is_active = true
ORDER BY priority DESC NULLS LAST, created_at DESC, id DESC
LIMIT 1
```

Der er ingen filtrering på `client_campaign_id`. FM-salg gemmer kun produktets navn i `raw_payload.fm_product_name` — ikke produkt-id.

Konsekvensen: to identisk navngivne produkter på **Eesy gaden** og **Eesy marked** kan ikke skelnes af triggeren. Den eneste måde at gøre navnet entydigt var at sætte den ene række inaktiv. Det skete 11. marts 2026 for de fire marked-varianter:

```text
Eesy marked (0835d092-…)
  aktiv:   5G Internet                                 (updated 15/5-2026)
  inaktiv: Eesy 99 med/uden første måned (Nuuday/IKKE)  (dine, bevidst udgået)
  inaktiv: Eesy med/uden første måned (Nuuday/IKKE)     (updated_at 11/3-2026 — ikke dig)
```

Samtidig listede salgsregistreringen ALLE produkter på bookingens kampagne uden hensyn til `is_active`, og der fandtes ingen UI-kontrol for flaget. Så:

- Sælgerne kunne stadig vælge de inaktive marked-produkter.
- Triggeren slog navnet op globalt og landede på den aktive **gaden**-række → gaden/COOP-satser på markedssalg. Det er Vorbasse-fejlen.
- Da jeg tilføjede `is_active`-filtret i salgsregistreringen, forsvandt 8 af 9 produkter fra Eesy marked, og kun 5G Internet blev tilbage.

Kort sagt: opsætningen var ikke bevidst designet til at sælge inaktive produkter. Det var en utilsigtet konsekvens af at `is_active` blev brugt til to formål på én gang — dedublering for prismotoren og (nu) synlighed for sælgere.

## Løsning

Ren reaktivering er ikke nok: to aktive rækker med samme navn gør triggeren tilfældig igen (priority/created_at afgør). Rækkefølgen skal derfor være: gør triggeren kampagne-bevidst FØRST, derefter reaktiver.

1. **Migration — kampagne-bevidst produktmatch i `create_fm_sale_items()`**
   Tilføj et første opslag der matcher navn **og** `client_campaign_id = NEW.client_campaign_id`. Kun hvis det ikke giver et hit, falder den tilbage til det nuværende globale navneopslag. Ingen ændring af prisregel-logikken (trin 2 og 3 i funktionen) og ingen ændring af eksisterende `sale_items`.

2. **Dataændring — reaktiver de fire marked-produkter**
   `is_active = true` på kampagnen Eesy marked for:
   - Eesy med første måned (Nuuday) / (IKKE Nuuday)
   - Eesy uden første måned (Nuuday) / (IKKE Nuuday)

   De fire "Eesy 99" forbliver inaktive — de skal ikke sælges længere.

3. **Ingen kodeændring i salgsregistreringen.** `is_active`-filtret bliver som det er og betyder fremover kun "synlig for sælgere", nu hvor triggeren ikke længere er afhængig af flaget for at skelne navne.

Efter dette kan sælgerne igen vælge de fire produkter — også i callback-mode — og nye marked-salg får markedssatser i stedet for gaden/COOP.

## Bemærkning til opfølgning

Kun nye salg bliver korrekte. Gamle Vorbasse-salg kræver stadig den separat aftalte backfill af `mapped_commission`/`mapped_revenue`.

## Zone

Rød: `create_fm_sale_items()` er en del af pricing-motoren. Kræver din eksplicitte godkendelse af planen ovenfor. Trin 2 er en dataændring på `products.is_active`; intet slettes, ingen prisregler røres.
