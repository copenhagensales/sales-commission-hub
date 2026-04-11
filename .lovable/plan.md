

## Restyle booking-siden til Copenhagen Sales-designet

Booking-siden skal visuelt matche [Copenhagen Sales Replica](/projects/974e0597-901c-4bee-afcc-ed1dcfe40a42) — hvid baggrund, Figtree font, grøn primary (#52c68d), mørke sektioner, rounded-2xl elementer, og en ren/moderne æstetik.

### Design-tokens fra Copenhagen Sales

- **Font**: Figtree (allerede importeret i replica)
- **Primary**: hsl(152 69% 53%) — frisk grøn
- **Baggrund**: Hvid (#ffffff)
- **Dark sections**: hsl(0 0% 7%) med hvid tekst
- **Border-radius**: 0.75rem (rounded-2xl på containere)
- **Stil**: Ren, lys, professionel — ingen muted/grå gradients

### Ændringer

**`src/pages/recruitment/PublicCandidateBooking.tsx`**
- Importer Figtree-fonten via Google Fonts link (eller inline style)
- Erstat `bg-gradient-to-b from-muted/30 to-background` med ren hvid baggrund
- Header-badge: Brug dark pill-stil som SectionLabel (`bg-[#2e3136] text-[#e6f0f1]`) i stedet for `bg-primary/10`
- Overskrift: Figtree, semibold, tight tracking (`tracking-[-0.02em]`)
- Dag-knapper: Hvid baggrund, tynde borders, rounded-xl. Selected = grøn primary med hvid tekst
- Slot-knapper: Samme mønster — hvide med border, selected = grøn
- Book-knap: Rounded-full (pill-form), grøn primary, semibold, som CTA-knapperne på replica-siden
- "Anbefalet"-badge: Behold men tilpas til grøn primary-farve
- Bekræftelses- og afmeldt-states: Hvid card med rounded-2xl, ingen grå gradient-baggrund
- Unsubscribe-link: Samme stil men tilpasset farverne
- Tilføj en simpel logo/brand-element øverst (Copenhagen Sales tekst i en dark pill)

**`src/components/recruitment/BookingPreviewTab.tsx`**
- Samme visuelle tilpasninger som ovenfor, så preview matcher

### Resultat

Kandidaten oplever en side der ser ud som Copenhagen Sales' offentlige hjemmeside — professionel, frisk og troværdig — i stedet for et internt admin-system.

