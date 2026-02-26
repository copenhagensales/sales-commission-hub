

## Hotel-administration for Jylland/Fyn bookinger

### Idé
Når lokationer i Jylland eller Fyn bookes, skal der automatisk vises en oversigt hvor man kan tildele hoteller. Systemet husker tidligere brugte hoteller per by, så man hurtigt kan genbruge dem.

### Database (nye tabeller)

**1. `hotel` -- hotelregister**
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid | PK |
| name | text | Hotelnavn (f.eks. "Zleep Hotel Kolding") |
| city | text | By (f.eks. "Kolding") |
| address | text | Adresse |
| phone | text | Telefonnummer |
| email | text | Email til booking |
| notes | text | Bemærkninger (parkering, check-in tid osv.) |
| times_used | integer | Antal gange brugt (for sortering) |
| created_at | timestamptz | |

**2. `booking_hotel` -- kobling mellem booking og hotel**
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid | PK |
| booking_id | uuid | FK til booking |
| hotel_id | uuid | FK til hotel |
| check_in | date | Check-in dato |
| check_out | date | Check-out dato |
| rooms | integer | Antal værelser |
| confirmation_number | text | Bekræftelsesnummer |
| status | text | "pending" / "confirmed" / "cancelled" |
| price_per_night | numeric | Pris pr. nat |
| notes | text | |
| created_at | timestamptz | |

### Ny fane: "Hoteller" (Hotel-ikon)

Fanen vises i BookingManagement med permission key `tab_fm_hotels`.

**Indhold i tre sektioner:**

**Sektion 1: Kommende bookinger der kræver hotel**
- Automatisk filtreret liste over bookinger hvor lokationen er i Jylland eller Fyn
- Viser: Lokation, by, datoer, antal medarbejdere, hotelstatus (mangler/booket)
- Farvekodning: Rod = intet hotel, gul = hotel tildelt men ubekræftet, gron = bekræftet
- Knap "Tildel hotel" per booking

**Sektion 2: Tildel hotel (dialog)**
- Når man klikker "Tildel hotel" åbnes en dialog
- Viser foreslåede hoteller baseret på by (sorteret efter `times_used`)
- Mulighed for at tilføje nyt hotel hvis det ikke findes i listen
- Felter: check-in, check-out (auto-udfyldt fra booking-datoer), antal værelser, bekræftelsesnummer, pris

**Sektion 3: Hotelregister**
- Samlet liste over alle kendte hoteller, grupperet per by
- Viser antal gange brugt, kontaktinfo
- Mulighed for at redigere/tilføje hoteller

### Tekniske ændringer

**Nye filer:**
- `src/pages/vagt-flow/HotelsContent.tsx` -- Hovedkomponent for hotel-fanen
- `src/components/vagt-flow/AssignHotelDialog.tsx` -- Dialog til at tildele hotel
- `src/components/vagt-flow/HotelRegistry.tsx` -- Hotelregister-oversigt
- `src/hooks/useBookingHotels.ts` -- React Query hooks til hotel-data

**Ændrede filer:**
- `src/pages/vagt-flow/BookingManagement.tsx` -- Tilføj "Hoteller" fane
- Database migration -- Opret `hotel` og `booking_hotel` tabeller med RLS

### Smart funktionalitet
- Hoteller foreslås automatisk baseret på by-match (f.eks. booking i Kolding viser "Kolding hoteller" først)
- `times_used` tæller op automatisk, så mest brugte hoteller vises øverst
- Overblik over alle kommende bookinger der mangler hotel (rød indikator)
- Historik-visning: "Sidst brugt til [markedsnavn] den [dato]"

