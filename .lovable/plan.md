

# "Hvor kender de os fra?" — dynamisk dropdown på kandidatdetalje

## Hvad
Et nyt felt på kandidatdetaljesiden hvor man kan vælge fra en dropdown, hvordan kandidaten kender jer. Dropdown-valgmulighederne lagres i en separat tabel, så nye muligheder kan tilføjes løbende direkte fra UI'et.

## Database

### 1. Ny tabel: `candidate_sources`
Holder de dynamiske dropdown-valgmuligheder.
```sql
CREATE TABLE public.candidate_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.candidate_sources ENABLE ROW LEVEL SECURITY;
-- Authenticated users can read/insert
CREATE POLICY "Auth read" ON public.candidate_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert" ON public.candidate_sources FOR INSERT TO authenticated WITH CHECK (true);

-- Seed defaults
INSERT INTO public.candidate_sources (label) VALUES
  ('Jobindex'), ('LinkedIn'), ('Facebook'), ('Instagram'), ('TikTok'),
  ('Anbefaling/mund til mund'), ('Hjemmeside'), ('Jobmesse'), ('Andet');
```

### 2. Ny kolonne på `candidates`
```sql
ALTER TABLE public.candidates ADD COLUMN heard_about_us text;
```

## UI-ændringer

**Fil:** `src/pages/recruitment/CandidateDetail.tsx`

- I info-båndet (ved Email/Telefon/Kilde/Ansøgningsdato) tilføj et nyt felt **"Kender os fra"**.
- Vises som en **klikbar dropdown** (Select + combobox-lignende) der:
  - Henter valgmuligheder fra `candidate_sources`.
  - Gemmer valget direkte på `candidates.heard_about_us` via mutation.
  - Har en **"+ Tilføj ny"** knap nederst der åbner et lille input-felt, indsætter i `candidate_sources`, og vælger den med det samme.
- Opdater også `NewCandidateDialog.tsx` med samme dropdown.

## Teknisk flow
1. `useQuery(['candidate-sources'])` → henter fra `candidate_sources` tabel
2. Ved valg: `updateCandidateMutation` opdaterer `heard_about_us` på kandidaten
3. "Tilføj ny": insert i `candidate_sources`, invalidate query, sæt som valgt

