## Endelig plan — godkendt scope

**Trin 1 — Ret booking (1 række):**
- UPDATE `booking c05bc7bd-a246-442b-8664-24be4967b5ff` (Ganløse Kræmmermarked plads 2, 8–10/5) → `campaign_id = 0835d092-2504-43e4-b818-55d4dd7ddedb` (Eesy marked).

**Trin 2 — Ret 26 salg (`client_campaign_id` → Eesy marked):**

| Dato | Location | Antal salg |
|---|---|---|
| 8/5 | Ganløse Kræmmermarked (plads 2) | 2 |
| 9/5 | Ganløse Kræmmermarked (plads 2) | 7 |
| 10/5 | Ganløse Kræmmermarked (plads 2) | 5 |
| 15/5 | Lillebælt Marked (plads 1) | 7 |
| 15/5 | Lillebælt Marked (plads 2) | 5 |
| **Total** | | **26** |

Filter: `source='fieldmarketing'` AND `(raw_payload->>'fm_location_id')::uuid` IN de 3 location-IDs AND `client_campaign_id IN ('eesy FM Gaden Products'-id, 'Eesy gaden'-id)` AND `sale_datetime` i de relevante datointervaller.

**Trin 3 — Rematch pricing:**
- Kald `rematch-pricing-rules` edge function (uden filter, så alle 26 sale_items genberegnes med marked-priser: 295/385 kr).

**Trin 4 — Verifikation:**
- Kør samme audit-query som ovenfor → bekræft at INGEN markeds-locations 4–15/5 har gade-kampagne længere.
- Rapportér ny provi-sum pr. dato + difference.

**Forventet samlet effekt:** ~26 salg × ~65 kr provi-reduktion ≈ **−1.700 kr i provi** der korrekt afregnes som markedssalg i stedet for gadesalg.

**Zone:** Rød (pricing-data + booking). Ramme-aftale dækker sammen-hængende fix af samme bug-mønster fra i går.

Klar til at køre. Bekræft med "kør" eller "ja".
