

## Udvid salgsgrænsen og tydeliggør limit-advarsel

### Problem
Annulleringssiden henter maksimalt 100 salg. Relatel har 423+ salg i perioden, og medarbejdere med salg uden for de 100 nyeste vises ikke i dropdown.

### Ændringer

**Fil:** `src/components/cancellations/ManualCancellationsTab.tsx`

1. **Hæv grænsen** fra `.limit(100)` til `.limit(1000)` i Supabase-forespørgslen (linje 83).
2. **Opdater advarslen** i bunden (linje ~188) til at vise en mere tydelig besked med et advarselikon, der klart fortæller brugeren at der er flere salg end vist, og at de bør indsnævre med filtre.

### Resultat
- Op til 1000 salg hentes nu, så Jonas og andre medarbejdere med ældre salg i perioden bliver synlige.
- Brugeren ser tydeligt en advarsel, hvis der er præcis 1000 resultater, hvilket indikerer at der kan være flere salg bag grænsen.

