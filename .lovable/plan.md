

## Ændring: Tæl bookinger i stedet for unikke lokationer

### Hvad ændres
Rabatberegningen for Danske Shoppingcentre ændres fra at tælle **unikke lokationer** til at tælle **totale bookinger** (antal gange en lokation er booket).

**Eksempel:** Lyngby Storcenter booket mandag + fredag i februar = **2 placeringer** (i dag tæller det kun som 1).

---

### 1. Database: Opdater regelbeskrivelser
Opdater de to eksisterende regler i `supplier_discount_rules` så beskrivelserne afspejler den nye tællemetode:
- "Rabat ved 11+ unikke placeringer pr. maaned" bliver til "Rabat ved 11+ bookinger pr. maaned"
- "Rabat ved 20+ unikke placeringer pr. maaned" bliver til "Rabat ved 20+ bookinger pr. maaned"

Tærskelværdierne (11 og 20) og rabatprocenterne (10% og 15%) forbliver uændrede -- det er kun **hvad der tælles** der ændrer sig.

### 2. Kodeændring: `src/components/billing/SupplierReportTab.tsx`
- Beregn `totalPlacements` som summen af alle bookinger på tværs af lokationer (sum af `loc.bookings.length`) i stedet for antal unikke lokationer (`locationEntries.length`)
- Brug `totalPlacements` i rabatberegningen hvor `uniqueLocations` bruges i dag
- Opdater UI-label fra "Unikke placeringer" til "Bookinger" i rapportvisningen

### 3. Kodeændring: `src/utils/supplierReportPdfGenerator.ts`
- Opdater PDF-label fra "Unikke placeringer" til "Bookinger" i rabatberegningssektionen

---

### Opsummering
- **Database:** 2 beskrivelser opdateres (ingen nye tabeller/kolonner)
- **Kode:** 2 filer ændres (tællelogik + labels)
- **Resultat:** Rabat beregnes ud fra totale bookinger, ikke unikke lokationer

