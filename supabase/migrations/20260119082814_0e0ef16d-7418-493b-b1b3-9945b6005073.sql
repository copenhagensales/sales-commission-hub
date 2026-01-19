-- Slet Williams forældede system_roles poster så systemet bruger hans job_title korrekt
DELETE FROM system_roles 
WHERE user_id = '09a12eda-3e04-43d6-a065-8565345b59a9';