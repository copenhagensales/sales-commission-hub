

# Rate limiting til customer-inquiry-webhook

## Tilgang
Implementer IP-baseret rate limiting direkte i edge function med en in-memory sliding window. Da edge functions kan have flere instanser, suppleres med en database-baseret check (max antal inquiries per tidsenhed).

## Ændringer

### `supabase/functions/customer-inquiry-webhook/index.ts`

**1. In-memory IP rate limiter (per instans)**
- Map af `IP → timestamps[]` med sliding window
- Grænse: max **5 requests per minut** per IP
- Returnerer `429 Too Many Requests` med `Retry-After` header

**2. Database-baseret global rate limit**
- Før insert: tæl antal inquiries fra samme email ELLER IP inden for seneste 10 minutter
- Hvis > 3 fra samme email på 10 min → afvis med 429
- Beskytter mod distribuerede angreb der omgår in-memory limiter

**3. Basis honeypot-felt**
- Acceptér et optional `_hp` felt i body — hvis det er udfyldt, ignorer stille (returnér 200 uden insert)
- Simpel bot-beskyttelse uden CAPTCHA

**4. Request size limit**
- Tjek `Content-Length` header, afvis > 10KB

### Resultat
- Spam fra samme IP: blokeret efter 5/min
- Spam fra samme email: blokeret efter 3/10min
- Bots: fanget af honeypot
- Store payloads: afvist tidligt

| Beskyttelse | Grænse | Respons |
|------------|--------|---------|
| IP per minut | 5 req/min | 429 |
| Email per 10 min | 3 req/10min | 429 |
| Honeypot | Felt udfyldt | 200 (silent drop) |
| Payload størrelse | 10 KB | 413 |

