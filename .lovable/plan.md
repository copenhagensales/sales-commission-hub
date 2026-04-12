

## Tilføj SMS-notifikation ved bilaflevering

### Hvad sker der nu
Når en bil afleveres, sendes kun en email til FM assistant team leaders. Ingen SMS.

### Hvad ændres
Edge function `notify-vehicle-returned` udvides til også at sende SMS via Twilio til FM assistant team leaders OG FM team leaders.

SMS-tekst: `"🔑 [Bil] afleveret d. DD/MM-YY kl. HH:MM af [Medarbejder]"`

### Modtagere
Funktionen finder allerede FM teams. Den udvides til også at hente `team_leader_id` fra `teams`-tabellen og slå telefonnumre op for både assistant leaders og team leaders.

Nuværende modtagere baseret på data:
- Thomas Wehage (assistant leader, Fieldmarketing) – `+4530141613`
- William Krogh Bornak (team leader, Fieldmarketing) – `+45 42209395`

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/notify-vehicle-returned/index.ts` | Tilføj SMS-afsendelse via Twilio efter email. Hent telefonnumre for både assistant leaders og team leaders fra FM teams. Send SMS med bilnavn, dato, klokkeslæt og medarbejdernavn. |

### Teknisk detalje
- Twilio credentials (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) er allerede konfigureret som secrets
- SMS sendes direkte via Twilio REST API (samme mønster som `send-employee-sms`)
- Telefonnumre normaliseres til E.164 format inden afsendelse
- SMS-fejl logges men blokerer ikke email-notifikationen

