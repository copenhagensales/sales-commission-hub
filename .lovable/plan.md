

## Opdater Medarbejderhåndbog – ting der ikke passer med jeres system

### Problemer fundet

**1. Whistleblowing-politik mangler link (linje 418-427)**
Sektionen nævner "rapporteringskanaler" og "intern whistleblowing-hotline" men linker ikke til jeres faktiske ordning. Skal pege mod `https://copenhagensales.dk/whistleblower`.

**2. Timeregistrering refererer til "Intramanager" (linje 78)**
Teksten siger "Ansatte skal registrere sine timer i Intramanager" – men I har jeres eget tidsstemplingssystem i denne app (`/time-stamp`).

**3. IT-sikkerhed lister "Intramanager.com" som system (linje 362-367)**
Systemlisten inkluderer Intramanager.com – bør opdateres til at nævne jeres eget system i stedet.

### Plan

| Ændring | Detalje |
|---|---|
| Whistleblowing-sektion | Tilføj eksternt link til `https://copenhagensales.dk/whistleblower` med tekst "Brug vores whistleblowerordning her" |
| Timeregistrering | Erstat "Intramanager" med reference til jeres interne system |
| IT-sikkerhedsliste | Fjern "Intramanager.com", tilføj jeres eget system |

### Fil
| Fil | Handling |
|---|---|
| `src/components/profile/HandbookTabContent.tsx` | Opdater 3 sektioner |

