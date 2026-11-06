-- Trin 3 (Udsendelser), del 5: Min profil → Notifikationer for alle brugere. udsendelsestyper kan kun læses af ejere (RLS), så listen var tom
-- for andre; og siden kaldte udsendelse_tilladt én gang pr. type (ca. 44 kald). Én funktion, der giver brugerens egne typer (kun dem,
-- brugeren er inden for modtagerreglen på) i ét kald, uden persondata og uden at åbne tabellen.
-- Kørsel som registreret skript: 'SHA' = filens sha256. Testet på testkopien først. Tilbagerulning: 9-mine-typer-tilbagerulning.sql.
-- Regler (0.5): SECURITY DEFINER-funktion (kun egne data via auth.uid(); ingen persondata), registreres automatisk som godkendt.
begin;
select core_compliance.stork_script_start('9-mine-typer.sql', 'SHA',
  'Udsendelser: funktionen udsendelse_mine_typer() – brugerens egne aktive typer inden for modtagerreglen (Min profil → Notifikationer, alle brugere, ét kald)',
  'Mathias (26/10: det oprindelige forslag »Notifikationer« – personlige til-/fravalg pr. medarbejder)');

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
comment on function public.udsendelse_mine_typer() is 'Min profil → Notifikationer: den indloggede brugers aktive udsendelsestyper inden for modtagerreglen, med brugerens eget til-/fravalg. Ingen persondata.';
revoke all on function public.udsendelse_mine_typer() from public, anon;
grant execute on function public.udsendelse_mine_typer() to authenticated;

select core_compliance.stork_script_slut();
commit;
select count(*) funktion from pg_proc where proname = 'udsendelse_mine_typer';
