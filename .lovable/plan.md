

## Tilføj CophagenSales-mail til holddeltagere

### Hvad bliver bygget
Et nyt inputfelt under hver deltagers navn i holdobersigten, hvor du kan skrive deres CophenhagenSales-mailadresse (f.eks. `shha@copenhagensales.dk`). Mailen gemmes pa deltagerens record og bruges automatisk, nar medarbejderen oprettes via "Start hold og send invitationer".

### Brugeroplevelse
- Under hver deltagers navn og stilling vises et lille mail-inputfelt (eller teksten pa den gemte mail)
- Du kan klikke pa blyants-ikonet (som allerede er der) for at redigere -- eller mailen redigeres inline
- Nar "Start hold og send invitationer" korer, oprettes en agent + agent-mapping automatisk for den nye medarbejder

### Tekniske ændringer

**1. Database: Ny kolonne pa `cohort_members`**
- Tilfojer `agent_email TEXT` pa `cohort_members`-tabellen til at gemme den planlagte CophenhagenSales-mail

**2. Udvid `EditMemberClientDialog.tsx`**
- Tilfojer et inputfelt til "CophenhagenSales mail" (med `@copenhagensales.dk` som placeholder)
- Gemmer vaerdien til `cohort_members.agent_email` sammen med dagsbonuskunden
- Omdober dialogen til noget mere generelt, f.eks. "Rediger deltager"

**3. Vis mailen i deltagerlisten (`UpcomingStarts.tsx`)**
- Under deltagerens navn/stilling vises den gemte agent_email i en lille tekst med mail-ikon
- Fetch agent_email i member-queryen (allerede `select *`, sa den kommer automatisk)

**4. Brug mailen ved medarbejderoprettelse (`UpcomingStarts.tsx` - `startCohortAndInviteMutation`)**
- Nar en medarbejder oprettes fra en kandidat, tjekkes om `member.agent_email` er udfyldt
- Hvis ja: opret en record i `agents`-tabellen med den mail og opret en `employee_agent_mapping` der kobler den nye medarbejder til agenten
- Dette sikrer at medarbejderens salg kan spores fra dag et

### Resultat
- Du kan notere CophenhagenSales-mailen pa deltagere for de starter
- Nar holdet startes, oprettes agent-mappingen automatisk sa provision og salgsstatistik virker med det samme

