# Dataskripter: UI-oprydning og Udsendelser, oktober 2026

Registrerede skripter kørt i produktionen 26/10-2026 (hver kørsel er registreret i `core_compliance.script_koersel` med filens sha256; hvert skript har en tilbagerulning). Kørt via Lovable `query_database` efter test på testkopien. Rækkefølge og formål:

| Nr. | Fil | Formål |
|---|---|---|
| 1 | 1-arkiv-oprydning.sql | Trin 1: 20 tabeller, menu- og rettighedsrækker til `arkiv_2026_10` (slettes automatisk 25/12-2026) |
| 2 | 2-menu-struktur.sql | Trin 2: 8 områder + 27 sider i `sidebar_menu_config` |
| 3 | 3-salg-tilbage.sql | Salg-siden tilbage (menu_sales) |
| 4 | 4-udsendelser.sql | Trin 3: `udsendelsestyper`, `udsendelser` (log), `udsendelsespraeferencer`, view `udsendelser_historik`, cron 90 d |
| 5 | 5-cron-status-funktion.sql | `get_active_cron_jobs()` (kun ejere) |
| 6 | 6-modtagerregler.sql | Modtagerregler: `regel_roller/regel_teams/regel_noegle`, `udsendelse_tilladt`, `udsendelse_modtagere` |
| 7 | 7-push-tekster-overblik.sql | Push-tekster som data, `udsendelser_overblik()`, status `dagsloft` |
| 8 | 8-planlagte-typer.sql | Typer for køskabelonerne i `scheduled_emails` |
| 9 | 9-mine-typer.sql | `udsendelse_mine_typer()` (Min profil, alle brugere) |
| 10 | 10-send-besked-laas.sql | Lås af den manuelle Send-fane (aktiv = false på send-besked-*) |
| 11 | 11-invitationer-udloeb.sql | 207 udløbne invitationer → expired |
| 12 | 12-grupper.sql | `gruppe` + `til_medarbejdere` pr. type |
| 13 | 13-grupper-rettelse.sql | 4 typer rettet efter modtageropgørelse |
| 14 | 14-modtagerregler-ledere.sql | `regel_ledere` (teamledere/assistenter) + regler på 13 ledertyper |
| 15 | 15-team-assistent-rettelse.sql | Team Fieldmarketing: fejlagtig assistent nulstillet |
| – | 0.5-baseline-godkend.sql | Godkender rettighedsbaselinen efter hvert skript, der ændrer SECURITY DEFINER-funktioner |

`'SHA'` i hvert skript erstattes ved kørsel med filens sha256 (`sha256sum <fil>`). Tilbagerulninger hedder `<navn>-tilbagerulning.sql`.
