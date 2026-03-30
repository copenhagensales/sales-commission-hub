

## Fix: Eesy TM matching-logik for annulleringer og 5G Internet

### Problem
Der er to problemer i den nuværende matching-logik for Eesy TM:

1. **Telefon-matching for annulleringer**: Systemet matcher allerede Excel-telefonnummer mod Abo1/2/3 i databasen (Pass 1 via product_phone_mappings), men Excel-intern deduplikering (linje 873) kan fejlagtigt fjerne rækker med samme telefonnummer — selvom de repræsenterer forskellige annulleringer.

2. **5G Internet Ubegrænset data**: Disse rækker skal for Eesy TM IKKE matche via telefonnummer. I stedet skal de bruge Pass 2-logik: **sælgernavn** (via seller mapping) + **dato** + **produkt** (skal matche vores interne 5G Internet-produkt).

### Ændringer

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

#### 1. Excel-intern deduplikering: Undtag 5G-rækker (linje ~873)
- Før en række tilføjes til phone-dedup-gruppen, tjek om rækkens produkt matcher et `phone_excluded_products` entry (f.eks. "5G Internet")
- Hvis ja → spring dedup over for denne række (den skal behandles individuelt)

#### 2. Pass 1 (product_phone_mappings): Undtag 5G-rækker for Eesy TM (linje ~1065)
- I Pass 1-loopet: Hvis rækken resolver til et `phone_excluded` produkt → spring over (lad Pass 2 håndtere)

#### 3. Pass 1b (customer_phone matching): Allerede håndteret
- Den eksisterende logik (linje 1158-1162) springer allerede `phone_excluded` rækker over — dette er korrekt

#### 4. Post-match merge: Undtag 5G-rækker fra telefon-merge (linje ~1961)
- I Eesy-mergelogikken: Hvis en matched sale har et `phone_excluded` targetProductName → brug `sale.saleId` som grupperingsnøgle i stedet for telefonnummer
- Dette forhindrer at 5G-rækker merges med andre rækker der deler telefonnummer

### Teknisk overblik

```text
Eesy TM matching-flow (efter fix):

Excel-række med telefonnummer:
  ├── Er produktet "5G Internet"? 
  │   ├── JA → Skip telefon-match, gå til Pass 2 (sælger + dato + produkt)
  │   └── NEJ → Pass 1: Match telefon mod Abo1/Abo2/Abo3
  │            → Det matchende Abo-felt bestemmer hvilket produkt der annulleres

Excel-intern dedup:
  ├── 5G-rækker: ALDRIG dedup'et (hver er unik)
  └── Andre rækker: Dedup på telefonnummer (som nu)

Post-match merge:
  ├── 5G-salg: Gruppér via saleId (ingen telefon-merge)
  └── Andre salg: Gruppér via telefonnummer (som nu)
```

### Ingen database-ændringer
Al logik er klientside i `UploadCancellationsTab.tsx`. Forudsætter at "5G Internet" allerede er konfigureret i `phone_excluded_products` for Eesy TM.

