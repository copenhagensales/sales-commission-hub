

# Plan: Opret Feltmappings for Alle 5 Integrationer

## Oversigt
Baseret på analyse af alle 5 integrationer og deres faktiske raw_payload data vil jeg oprette komplette feltmappings. Der er **ingen eksisterende mappings** for nogen integration endnu.

---

## Integrationer og Feltstruktur

### 1. Lovablecph (Adversus)
**ID:** `26fac751-c2d8-4b5b-a6df-e33a32e3c6e7`

| Kilde-sti | Standard felt | Bemærkning |
|-----------|---------------|------------|
| `leadResultData[Kontakt nummer]` | phone_number | Kundetelefon |
| `leadResultData[OPP nr]` | opp_number | OPP-nummer |
| `leadResultData[Omstilling]` | - | Ekskluderes (internt flag) |
| `ownedBy` | agent_external_id | Adversus bruger-ID |
| `lines[0].title` | product_name | Produktnavn |
| `lines[0].quantity` | product_quantity | Antal |
| `lines[0].unitPrice` | product_price | Enhedspris |
| `closedTime` | sale_datetime | Salgstidspunkt |
| `leadId` | lead_id | Lead ID |
| `campaignId` | campaign_id | Kampagne ID |
| `state` | sale_status | Closure status |

### 2. Relatel_CPHSALES (Adversus)
**ID:** `657c2050-1faa-4233-a964-900fb9e7b8c6`

| Kilde-sti | Standard felt | Bemærkning |
|-----------|---------------|------------|
| `leadResultData[Sales ID]` | opp_number | Bruges som OPP-reference |
| `leadResultData[Bindingsperiode]` | subscription_type | Bindingsperiode |
| `leadResultData[Tilskud]` | coverage_amount | **Bruges i pricing rules!** |
| `leadResultData[Tilfredshedsgaranti - Switch]` | - | Produktspecifikt |
| `leadResultData[Tilfredshedsgaranti - MBB]` | - | Produktspecifikt |
| `ownedBy` | agent_external_id | Adversus bruger-ID |
| `lines[0].title` | product_name | Produktnavn |
| `lines[0].quantity` | product_quantity | Antal |
| `lines[0].totalPrice` | product_price | Total pris |
| `closedTime` | sale_datetime | Salgstidspunkt |
| `leadId` | lead_id | Lead ID |
| `campaignId` | campaign_id | Kampagne ID |
| `state` | sale_status | Closure status |

### 3. ASE (Enreach/HeroBase)
**ID:** `a76cf63a-4b02-4d99-b6b5-20a8e4552ba5`

| Kilde-sti | Standard felt | Bemærkning |
|-----------|---------------|------------|
| `data.Fornavn` | customer_name | Kombineres med efternavn via transform |
| `data.Efternavn` | - | Del af customer_name transform |
| `data.Email` | customer_email | Kunde email |
| `data.Telefon` | phone_number | Kundetelefon |
| `data.Adresse` | - | Ekskluderes (PII ikke nødvendig) |
| `data.Postnummer` | customer_zip | Postnummer |
| `data.Forening` | association_type | **Bruges i pricing rules!** |
| `data.Dækningssum` | coverage_amount | **Bruges i pricing rules!** |
| `data.Dækningsperiode` | subscription_type | Abonnementsperiode |
| `data.A-kasse salg` | - | Nyt felt: akasse_sale **Bruges i pricing rules!** |
| `data.A-kasse type` | - | Nyt felt: akasse_type **Bruges i pricing rules!** |
| `data.Lønsikring` | - | Nyt felt: lonsikring_type |
| `data.Medlemsnummer` | - | Nyt felt: member_number |
| `data.Nuværende a-kasse` | - | Nyt felt: current_akasse |
| `data.OPP` | opp_number | OPP-nummer |
| `firstProcessedByUser.orgCode` | agent_email | Sælger email |
| `firstProcessedTime` | sale_datetime | Salgstidspunkt |
| `campaign.code` | campaign_name | Kampagnenavn |
| `campaign.uniqueId` | campaign_id | Kampagne ID |
| `uniqueId` | lead_id | Lead ID |
| `closure` | sale_status | Closure status |
| `data.ASE-id` | - | Ekskluderes (internt ID) |
| `data.Intern Kommentar` | - | Ekskluderes (intern note) |

### 4. Eesy (Enreach/HeroBase)
**ID:** `d79b9632-1cac-4744-ab30-7768e580c794`

| Kilde-sti | Standard felt | Bemærkning |
|-----------|---------------|------------|
| `data.Forename` | customer_name | Kombineres med Lastname |
| `data.Lastname` | - | Del af customer_name |
| `data.Email` | customer_email | Kunde email |
| `data.SUBSCRIBER_ID` | phone_number | Telefonnummer |
| `data.Abonnement1` | subscription_type | Valgt abonnement |
| `data.Antal abonnementer` | product_quantity | Antal |
| `data.Kampagne` | campaign_name | Kampagnenavn |
| `data.LeadType` | lead_type | Lead type |
| `data.SurveyLeverandør` | - | Ekskluderes |
| `firstProcessedByUser.orgCode` | agent_email | Sælger email |
| `firstProcessedTime` | sale_datetime | Salgstidspunkt |
| `campaign.uniqueId` | campaign_id | Kampagne ID |
| `uniqueId` | lead_id | Lead ID |
| `closure` | sale_status | Closure status |
| `data.Bemærkninger:` | - | Ekskluderes (noter) |
| `customData.CSID` | external_reference | CS ID reference |

### 5. Tryg (Enreach/HeroBase)
**ID:** `a5068f85-da1c-43e1-8e57-92cc5c4749f1`

| Kilde-sti | Standard felt | Bemærkning |
|-----------|---------------|------------|
| `data.Navn1` | customer_name | Kombineres med Navn2 |
| `data.Navn2` | - | Del af customer_name (efternavn) |
| `data.Telefon1` | phone_number | Primær telefon |
| `data.Telefon2` | - | Sekundær (ekskluderes) |
| `data.Telefon3` | - | Tertiær (ekskluderes) |
| `data.Adresse` | customer_address | Adresse |
| `data.By` | customer_city | By |
| `data.Postnummer` | customer_zip | Postnummer |
| `data.Mødedato` | - | Nyt felt: meeting_date |
| `data.Resultat` | sale_status | Resultat |
| `data.Notater` | - | Ekskluderes (noter) |
| `data.SerioID` | external_reference | Serio ID |
| `firstProcessedByUser.orgCode` | agent_email | Sælger email |
| `firstProcessedTime` | sale_datetime | Salgstidspunkt |
| `campaign.code` | campaign_name | Kampagnenavn |
| `campaign.uniqueId` | campaign_id | Kampagne ID |
| `uniqueId` | lead_id | Lead ID |
| `closure` | sale_status | Closure status |

---

## Nye Field Definitions

Følgende standardfelter mangler i systemet og oprettes:

| field_key | display_name | category | is_pii | Beskrivelse |
|-----------|--------------|----------|--------|-------------|
| akasse_sale | A-kasse salg | sale | false | Flag for A-kasse salg (Ja/Nej) |
| akasse_type | A-kasse type | sale | false | Type af A-kasse |
| lonsikring_type | Lønsikring type | sale | false | Type af lønsikring |
| member_number | Medlemsnummer | customer | true | ASE medlemsnummer |
| current_akasse | Nuværende A-kasse | customer | false | Kundens nuværende A-kasse |
| meeting_date | Mødedato | sale | false | Tryg mødebooking dato |

---

## Database-ændringer

### 1. Opret 6 nye field definitions
```sql
INSERT INTO data_field_definitions (field_key, display_name, category, data_type, is_pii)
VALUES 
  ('akasse_sale', 'A-kasse salg', 'sale', 'string', false),
  ('akasse_type', 'A-kasse type', 'sale', 'string', false),
  ('lonsikring_type', 'Lønsikring type', 'sale', 'string', false),
  ('member_number', 'Medlemsnummer', 'customer', 'string', true),
  ('current_akasse', 'Nuværende A-kasse', 'customer', 'string', false),
  ('meeting_date', 'Mødedato', 'sale', 'date', false);
```

### 2. Indsæt integration_field_mappings
Ca. 60+ mappings fordelt på de 5 integrationer:
- **Lovablecph:** 11 mappings
- **Relatel_CPHSALES:** 12 mappings  
- **ASE:** 18 mappings
- **Eesy:** 14 mappings
- **Tryg:** 13 mappings

---

## Transform Rules

Følgende felter kræver transform rules for at kombinere data:

| Integration | Transform | Beskrivelse |
|-------------|-----------|-------------|
| ASE | `data.Fornavn` + `data.Efternavn` → customer_name | Kombiner for- og efternavn |
| Eesy | `data.Forename` + `data.Lastname` → customer_name | Kombiner for- og efternavn |
| Tryg | `data.Navn1` + `data.Navn2` → customer_name | Kombiner for- og efternavn |

Transform rule format:
```json
{
  "type": "concat",
  "fields": ["data.Fornavn", "data.Efternavn"],
  "separator": " "
}
```

---

## Pricing Rule Felter (Kritiske)

Disse felter bruges aktivt i jeres pricing rules og skal mappes korrekt:

| Pricing Rule Condition | Kilde (API) | Standard Felt |
|------------------------|-------------|---------------|
| `Tilskud` | `leadResultData[Tilskud]` (Relatel) | coverage_amount |
| `Dækningssum` | `data.Dækningssum` (ASE) | coverage_amount |
| `A-kasse salg` | `data.A-kasse salg` (ASE) | akasse_sale |
| `A-kasse type` | `data.A-kasse type` (ASE) | akasse_type |

---

## Implementeringsrækkefølge

1. **Database migration:** Opret 6 nye field definitions
2. **Lovablecph mappings:** 11 mappings for Adversus-format
3. **Relatel mappings:** 12 mappings for Adversus-format
4. **ASE mappings:** 18 mappings for Enreach-format
5. **Eesy mappings:** 14 mappings for Enreach-format  
6. **Tryg mappings:** 13 mappings for Enreach-format

---

## Resultat

Efter implementering:
- Alle 5 integrationer har komplette feltmappings
- Pricing rules kan bruge normaliserede feltnavne
- GDPR-felter er korrekt markeret som PII
- Interne noter og unødvendige felter er ekskluderet
- Transform rules håndterer navn-kombinationer

Du kan derefter justere mappings direkte i Datamapping-fanen efter behov.

