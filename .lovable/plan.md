

## Opdater DPA-references i DataTransferRegistry

Tilføj klarhed om DPA-type og links til de offentlige DPA-dokumenter.

---

### Ændringer i `src/pages/compliance/DataTransferRegistry.tsx`

**Udvid data-modellen** med `dpaType` og `dpaUrl`:

| Modtager | DPA-type | Link |
|----------|----------|------|
| Twilio | Standard DPA | https://www.twilio.com/legal/data-protection-addendum |
| Meta | Standard vilkår | https://www.facebook.com/legal/terms/dataprocessing |
| Microsoft 365 | Standard DPA | https://learn.microsoft.com/legal/cognitive-services/openai/data-privacy |
| e-conomic | Standard DPA | https://www.visma.com/trust-centre/dpa |
| Adversus | Standard DPA | https://www.adversus.io/legal/dpa |

**Tabelændringer:**
- Erstat "DPA"-kolonnen med "DPA-type" der viser fx "Standard DPA" eller "Standard vilkår"
- Gør DPA-type til et klikbart link (åbner i ny fane) så man kan finde dokumentet
- Tilføj en note i info-boksen øverst: "DPA-links henviser til leverandørernes offentligt tilgængelige databehandleraftaler"

**Links skal verificeres** — jeg slår de korrekte URLs op inden implementering.

---

### Risiko
Ingen. Kun tekstændringer på en statisk informationsside.

