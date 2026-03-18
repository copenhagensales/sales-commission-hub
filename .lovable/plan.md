

## Meta "Lead" Conversion Event ved quiz-gennemførelse

Quizzen på test.copenhagensales.dk er en ekstern side. For at tracke et "Lead"-event i Meta når nogen gennemfører quizzen, skal vi oprette et nyt endpoint som den eksterne quiz kan kalde.

### Plan

**1. Ny Edge Function: `send-meta-lead`**
- Modtager data fra den eksterne quiz (email, navn, telefon, fbclid, event_source_url)
- Hasher email med SHA-256 (som eksisterende `send-meta-conversion`)
- Sender et `Lead` event til Meta Conversions API med `action_source: "website"`
- Bruger eksisterende `FB_PIXEL_ID` og `FB_ACCESS_TOKEN` secrets
- `verify_jwt = false` så den eksterne side kan kalde den
- CORS headers tillader kald fra test.copenhagensales.dk

**2. Kald fra ekstern quiz**
- Den eksterne quiz på test.copenhagensales.dk skal kalde dette endpoint når brugeren submitter sine oplysninger (efter "Tak! Vi har modtaget dit resultat")
- URL: `https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/send-meta-lead`
- Body: `{ email, first_name, last_name, phone, fbclid, event_source_url }`

**3. Config**
- Tilføj `verify_jwt = false` for funktionen i `supabase/config.toml`

### Filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/send-meta-lead/index.ts` | Ny edge function |
| `supabase/config.toml` | Tilføj verify_jwt = false |

> **Bemærk**: Den eksterne quiz-side (test.copenhagensales.dk) skal opdateres separat til at kalde dette endpoint. Det sker uden for dette projekt.

