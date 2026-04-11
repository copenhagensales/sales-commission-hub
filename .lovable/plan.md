

## Fix: Bedre alders- og motivations-detektion i auto-segment

### Problem
1. **Alder:** Regex kræver "jeg er X år" eller "er X år". Teksten "20 år massere af..." fanges ikke fordi "20 år" står alene uden verbum.
2. **Motivation:** Keywords som "gå påmod", "vil gerne i gang" matcher ikke listen. Kun formelle ord som "motiveret", "energisk" er dækket.

### Ændringer

**Fil: `supabase/functions/auto-segment-candidate/index.ts`**

1. **Udvid `detectAge`** — tilføj regex for selvstændigt "XX år" i starten af tekst eller efter komma/punktum:
   - `/(^|\.\s*|\,\s*)(\d{1,2})\s+år/` — fanger "20 år ..." i begyndelsen
   - `/(\d{1,2})\s+år\s+(?:gammel|og)/` — fanger "20 år gammel" og "20 år og"
   - Confidence: "medium" (da det ikke eksplicit siger "jeg er")

2. **Udvid `MOTIVATION_KEYWORDS`** — tilføj mere dagligdags vendinger:
   - "i gang", "gå på", "klar til", "vil gerne", "brænder for", "sulten", "går efter", "lyst til", "give den gas", "topmotiveret", "kæmpe for"

### Resultat for "KM tester"
- Alder: 20 (medium confidence) → isYoung = true
- Motivation: "vil bare gerne i gang" matcher "i gang" + "vil gerne" → score >= 2
- Dansk, ikke deltid → **Tier A — auto-start**

