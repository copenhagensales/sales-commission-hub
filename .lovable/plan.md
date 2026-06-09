**Konklusion**
`BNA4` er gyldig og aktiv i databasen. Fejlen kommer fordi `https://stork.copenhagensales.dk/t/BNA4` stadig kører en gammel publiceret frontend, der prøver at læse `tv_board_access` direkte. Den adgang blev lukket i sikkerhedsfixet, og den nye kode bruger i stedet den sikre `verify_tv_board_code`-funktion.

**Evidens**
- Database: `BNA4` findes, `is_active = true`, `expires_at = null`, `dashboard_slugs = [eesy-tm]`.
- Backend-funktion: `verify_tv_board_code('BNA4')` returnerer Eesy TM-data korrekt.
- Custom domain: browseren kalder stadig direkte `GET /rest/v1/tv_board_access?...access_code=eq.BNA4` og får `[]`, hvilket udløser “Ugyldig adgangskode”.
- Preview: ny kode kalder korrekt `POST /rest/v1/rpc/verify_tv_board_code` og dashboardet loader.

**Plan**
1. Publicér den aktuelle version af appen til custom domains, så `stork.copenhagensales.dk` får den nye TV-link-kode.
2. Test `https://stork.copenhagensales.dk/t/BNA4` efter publicering.
3. Bekræft i browserens network-log at siden bruger `rpc/verify_tv_board_code` og ikke længere direkte `tv_board_access`.
4. Hvis fejlen stadig ses efter publicering, laver jeg en minimal kompatibilitetsfix i TV-link flowet — men vi skal ikke genåbne anonym læseadgang til `tv_board_access`, fordi det netop var sikkerhedshullet der blev lukket.