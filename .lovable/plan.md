

# Slet tomme Enreach webhook-salg og deaktiver webhook

## Baggrund
5.907 salg oprettet via Enreach webhook (`enreach-` prefix) er tomme skaller: ingen sale_items, ingen agent, ingen kampagne, ingen kundedata. API-sync dækker allerede alle reelle salg (5.167 stk). Webhooket sender ubrugelige payloads og skaber kun støj.

## Plan

### 1. Slet de 5.907 tomme webhook-salg fra databasen
Kør DELETE mod `sales` tabellen for alle records med `adversus_external_id LIKE 'enreach-%'`. Da der er 0 tilknyttede sale_items, er der ingen kaskade-effekt.

```text
DELETE FROM sales WHERE adversus_external_id LIKE 'enreach-%';
```

Rydder også relaterede events op:
```text
DELETE FROM adversus_events WHERE external_id LIKE 'enreach-%';
```

### 2. Deaktiver webhook-modtagelse for Enreach i koden
Opdater `dialer-webhook` parseren (`parsers/enreach.ts`) så den returnerer en kontrolleret "ignored" response når den modtager Enreach webhooks, i stedet for at oprette tomme salg. Alternativt kan Enreach-parseren fjernes fra factory, så webhook-kaldet får en "unknown provider" response.

Konkret ændring i `parsers/factory.ts`: Fjern eller deaktiver `EnreachWebhookParser` fra parser-listen, så webhook-requests fra Enreach ignoreres med en log-besked.

### 3. Ryd op i integration_logs
Slet gamle webhook-relaterede logs for at holde tabellen ren (valgfrit).

## Hvad vi IKKE rører
- API-sync via `integration-engine` fortsætter uændret (henter salg hvert 15. minut)
- `enreach-manage-webhooks` edge function beholdes (bruges til at administrere webhooks i HeroBase UI)
- Enrichment-healer og øvrig logik påvirkes ikke

## Forventet effekt
- 5.907 ubrugelige records fjernet
- "Salg uden sale_items" health check falder markant
- Ingen flere tomme webhook-salg oprettes fremover
- API-sync er eneste datakilde for Enreach = renere data

