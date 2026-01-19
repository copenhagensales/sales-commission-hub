-- Slet alle poster i system_roles tabellen
-- Dette sikrer at job_title flowet bruges til at bestemme brugeradgang
DELETE FROM system_roles;