-- Trin 2, tillæg: siden »Salg« (/sales, salgsfeedet) tilbage for de roller, der havde den (ejer, teamleder, assisterende TM).
-- Rettighedsrækkerne for nøglen menu_sales blev arkiveret i oprydning trin 1 og lægges tilbage uændret.
-- Kørsel som registreret script: 'SHA' = filens sha256. Godkendt: Mathias 26/10 (»kan vi få salg siden tilbage? finde bedste placering for det«).
-- Køres sammen med 2-menu-struktur.sql (som indeholder menurækken side_salg) efter publicering af den kode, der genskaber siden.
begin;
select core_compliance.stork_script_start('3-salg-tilbage.sql', 'SHA',
  'Siden Salg (/sales) tilbage: rettighedsrækker for menu_sales lægges tilbage fra arkiv_2026_10 (uændret kreds: ejer, teamleder, assisterende TM)',
  'Mathias (26/10: »kan vi få salg siden tilbage?«)');
insert into public.role_page_permissions
  select * from arkiv_2026_10.role_page_permissions where permission_key = 'menu_sales'
  on conflict (id) do nothing;
delete from arkiv_2026_10.role_page_permissions where permission_key = 'menu_sales';
update arkiv_2026_10._indhold set note = note || '; menu_sales lagt tilbage ' || now()::date where hvad = 'rettigheder' and navn = 'role_page_permissions';
select core_compliance.stork_script_slut();
commit;
select role_key, can_view from public.role_page_permissions where permission_key = 'menu_sales' order by 1;
