

## Fjern inaktive og ikke-sælgere fra ligaen

### Hvem skal fjernes

**12 stoppede medarbejdere** (is_active = false):
- Liva Holmbom, Alem Dajic, Conrad Willadsen, Daniel Johansen, Flora Klug, Hjalte Christensen, Lucas Havmann, Noah Duus, Rasmus Krabsen, Sascha Jensen, Saxo Skibye, William Heegaard, Alfred Rud (SOME)

**9 aktive stab/ledere** (ikke sælgere):
- Eline-Kirstine Jørgensen (Ass. Teamleder)
- Thomas Wehage (Ass. Teamleder FM)
- Kasper Mikkelsen (Ejer)
- William Seiding (Ejer)
- Oscar Belcher (Rekruttering)
- Filip Møller (Teamleder)
- Jonas Jensen (Teamleder)
- Rasmus Hansen (Teamleder)

**I alt: 21 tilmeldinger fjernes** (ud af 76).

### Teknisk plan

**2 database-operationer** via insert-tool:

1. Sæt `is_active = false` på de 21 enrollments (soft delete)
2. Slet tilhørende rækker i `league_qualification_standings`

Ingen kodeændringer nødvendige — det er ren data-oprydning.

