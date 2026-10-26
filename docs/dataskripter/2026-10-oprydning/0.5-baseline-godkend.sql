-- Godkender rettighedsbaselinen (B1) efter en godkendt ændring, så kontrollerne ikke melder den som afvigelse.
-- Kørsel som registreret script: 'SHA' = filens sha256, 'BEGRUNDELSE' = hvad der er godkendt og af hvem.
begin;
select core_compliance.stork_script_start('0.5-baseline-godkend.sql', 'SHA', 'Godkend rettighedsbaseline: BEGRUNDELSE', 'Mathias');
select core_compliance.stork_godkend_rettigheder() as noegler;
select core_compliance.stork_script_slut();
commit;
select count(*) as afvigelser_efter from core_compliance.rettighed_afvigelser();
