-- Purge invalid OPP numbers (Lead IDs incorrectly saved as OPP numbers)
-- Valid OPP numbers are: 4-6 digits OR start with "OPP-"
-- Invalid: Long IDs like 950265538 (9+ digits)

UPDATE sales 
SET adversus_opp_number = NULL 
WHERE adversus_opp_number IS NOT NULL
  AND length(adversus_opp_number) > 6 
  AND adversus_opp_number NOT ILIKE 'OPP-%';