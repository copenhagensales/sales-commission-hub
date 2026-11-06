-- Tilbagerulning: grupper og flag fjernes; udsendelse_mine_typer() tilbage til udgaven fra skript 9 (uden gruppe).
begin;
select core_compliance.stork_script_start('12-grupper-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning: gruppe/til_medarbejdere på udsendelsestyper, udsendelse_mine_typer() uden gruppe', 'Mathias');
drop function if exists public.udsendelse_mine_typer();
create function public.udsendelse_mine_typer()
returns table (noegle text, navn text, kanal text, beskrivelse text, aktiv boolean)
language sql
security definer
set search_path = ''
stable
as $$
  select t.noegle, t.navn, t.kanal, t.beskrivelse,
         coalesce((select p.aktiv from public.udsendelsespraeferencer p where p.user_id = auth.uid() and p.type_noegle = t.noegle and p.kanal = t.kanal), true) aktiv
  from public.udsendelsestyper t
  where auth.uid() is not null
    and t.aktiv
    and public.udsendelse_tilladt(auth.uid(), t.noegle)
  order by t.kanal, t.navn;
$$;
revoke all on function public.udsendelse_mine_typer() from public, anon;
grant execute on function public.udsendelse_mine_typer() to authenticated;
alter table public.udsendelsestyper drop column gruppe, drop column til_medarbejdere;
select core_compliance.stork_script_slut();
commit;
