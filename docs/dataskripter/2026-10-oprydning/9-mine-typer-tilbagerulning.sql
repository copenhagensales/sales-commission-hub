-- Tilbagerulning: funktionen udsendelse_mine_typer() fjernes igen.
begin;
select core_compliance.stork_script_start('9-mine-typer-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: udsendelse_mine_typer()', 'Mathias');
drop function if exists public.udsendelse_mine_typer();
delete from core_compliance.secdef_register where funktion like '%udsendelse_mine_typer%';
select core_compliance.stork_script_slut();
commit;
