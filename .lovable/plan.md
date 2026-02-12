

# Fjern "Team & Fællesskab" og fremhæv Kommende begivenheder

## Ændring
Sektionen "Team & Fællesskab" med "Velkommen til nye kolleger" fjernes fra forsiden. I stedet bliver "Kommende begivenheder" løftet ud som sit eget selvstændige kort -- samme styling som de andre kort på siden -- så det bliver mere synligt.

## Hvad sker der konkret

**Fjernes:**
- Den ydre Card med titlen "Team & Fællesskab" (linje 540-547)
- Hele "Velkommen til nye kolleger"-sektionen med badges for nye medarbejdere (linje 549-571)
- Border-top på events-sektionen (ikke længere nødvendig som separator)

**Beholdes og fremhæves:**
- "Kommende begivenheder" bliver sit eget Card med CardHeader/CardTitle i stedet for at være indlejret
- Hele event-listen med dato, titel, sted, deltagere og thumbs up/down-knapper
- "Tilføj begivenhed"-dialogen med alle felter (teams, popup-invitation osv.)
- Slet-knappen på hover

## Teknisk detalje

Fil: `src/pages/Home.tsx`

1. Erstat den ydre "Team & Fællesskab" Card (linje 540-548) med en ny Card der har titlen "Kommende begivenheder" og plus-knappen i headeren
2. Fjern "Velkommen til nye kolleger"-blokken (linje 549-571) samt den omsluttende div med border-top
3. Flyt event-indholdet direkte ind i det nye kort
4. Fjern eventuel ubrugt import af `Gift`-ikonet og `newEmployees`-data, hvis de ikke bruges andre steder

Layoutet forbliver ellers det samme -- kortet med begivenheder vil nu stå mere tydeligt som et selvstændigt element på forsiden.

