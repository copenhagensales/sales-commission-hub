

## Opret Medarbejderhåndbog som ny fane under Min Profil

### Status
Der er **ingen** eksisterende medarbejderhåndbog i systemet. Indholdet fra den uploadede DOCX (17 sider) skal omdannes til en læsbar fane.

### Plan

**1. Ny komponent: `src/components/profile/HandbookTabContent.tsx`**
- Opretter en accordion-baseret visning af alle 30+ sektioner fra håndbogen
- Grupperet i logiske kategorier (Ansættelse, Adfærd & Etik, Praktisk, IT & Sikkerhed, Disciplinære forhold, Trivsel & Inklusion, Whistleblowing & Brand)
- Statisk indhold – ingen database nødvendig, da håndbogen er et fast dokument
- Inkluderer en "Sidst opdateret: 29. august 2025" badge

**2. Opdater `src/pages/MyProfile.tsx`**
- Tilføj en ny `TabsTrigger` for "Håndbog" med `BookOpen`-ikon (fra lucide-react)
- Tilføj tilhørende `TabsContent` der renderer `<HandbookTabContent />`

**3. Indhold der medtages (alle sektioner fra DOCX)**
- Indledning & Om Copenhagen Sales
- Ansættelsesvilkår, Arbejdstid, Løn, Ferie, Ferielukning
- Opførsel & Etik, Arbejdstøj, Drikkevarer, Mobning & Chikane, Fortrolighed
- Alkohol & Rusmidler, Mobilpolitik, Sociale medier, Internet, Sprog
- Pauser, Kantine, Parkering, Orlov, Kørselsgodtgørelse, Leje af biler
- Lægebesøg, Lønudbetaling, Nøgler/adgangskort, Medie/presse, MUS, Mødekultur
- Forsikring, Førstehjælp, Henvisningshonorar, Straffeattest, Sygdom, Timeregistrering
- Overenskomst, Børnearbejde, AMO, Pensionsordning, Personalefester, Piercinger, Rygning, Skattekort
- Kontrol/overvågning/lagring
- Trivsel & Stresshåndtering, Mangfoldighed & Inklusion, Klageprocedure
- Advarsler (trin 1-3), Grov misligholdelse, Disciplinære forseelser
- IT-sikkerhed, Adgangskoder, Adgange, Computere, Hacking
- Anti-korruption & Whistleblower, Psykologi & Krisehjælp
- Brandsikkerhed & Beredskab
- Grønt fokus, Førstehjælpskasse

### Filer
| Fil | Handling |
|---|---|
| `src/components/profile/HandbookTabContent.tsx` | Ny komponent med accordion-sektioner |
| `src/pages/MyProfile.tsx` | Tilføj "Håndbog" tab |

