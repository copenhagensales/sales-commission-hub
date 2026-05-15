# Plan: Rul tilbage og gør kampagne obligatorisk på booking

## Hvad jeg fandt

**SalesRegistration.tsx** — mine to ændringer (cross-client fallback + is_primary-filter) skal væk. Pricing-rule-rettelserne ligger i DB-tabellen `product_pricing_rules` (separat migration), ikke i denne fil. Revert er sikkert.

**Booking-creation:** Kun ét sted opretter `booking`-rækker direkte (`BookWeekContent.tsx:229`) — det har ALLEREDE hard guard mod manglende kampagne.

**Booking-edit:** `EditBookingDialog.tsx:1077` validerer ALLEREDE at kampagne er udfyldt før save.

**DB-status:** `booking.campaign_id` er `nullable`, og **132 historiske bookinger har NULL**. Det er hullet — UI er fint, men DB tillader stadig huller (fx via direkte SQL eller fremtidige nye flows).

## Plan

### Trin 1 — Revert SalesRegistration.tsx
Reset linje 249-341 og 348 og 644-720 tilbage til original adfærd:
- Én simpel `useQuery` der kun henter produkter på `client_campaign_id = booking.campaign.id`
- `addProduct` bruger kun `products` (ingen crossClientProducts)
- Slet "Andre klienter på standen"-kortet helt

### Trin 2 — Ryd 132 NULL-bookinger
Migration der auto-udfylder `campaign_id` på eksisterende NULL-rækker via `location.client_campaign_mapping[client_id]` (samme logik som `BookWeekContent.tsx:209-210` bruger ved oprettelse). Rækker der ikke kan auto-mappes (manglende mapping) → log dem til dig som CSV via en SELECT, så du selv kan rette dem manuelt FØR vi går videre.

**Vigtigt:** Trin 3 kører IKKE før alle 132 er fixet. Ellers fejler NOT NULL-migrationen.

### Trin 3 — DB NOT NULL constraint
Når 0 rækker har NULL: migration der sætter `ALTER TABLE booking ALTER COLUMN campaign_id SET NOT NULL`. Derefter er det fysisk umuligt at oprette booking uden kampagne — uanset hvilket flow eller direkte SQL.

### Trin 4 — Lille UI-stramning (valgfri)
I `EditBookingDialog` og `BookWeekContent` — udskift `toast.error("Vælg venligst en kampagne")` med en rød border + inline fejltekst på selve felt-rækken, så det er umuligt at overse. (Begge steder har allerede `border-destructive` — bare at gøre den mere prominent.)

## Zone
- **Trin 1 (revert):** Gul → grøn (UI revert, original adfærd).
- **Trin 2 (auto-fill 132 rækker):** Gul (data-update på `booking`, ikke rød zone-tabel).
- **Trin 3 (NOT NULL):** Gul (skema-ændring på `booking`).
- **Trin 4 (UI stramning):** Grøn.

## Hvad jeg har brug for fra dig
1. **Bekræft revert** af SalesRegistration.tsx (mister "Andre klienter"-kortet helt — det er den oprindelige adfærd).
2. **Bekræft trin 2-strategien:** auto-fyld via `location.client_campaign_mapping` + CSV til dig over rækker der ikke kan mappes. Eller foretrækker du at se de 132 rækker FØRST og selv beslutte?
3. **Trin 4 (UI-stramning) — ja eller nej?** Det er ikke strengt nødvendigt da DB-constraint i trin 3 alligevel garanterer det.

Sig til så kører jeg.
