-- Tilbagerulning af dataskript 2: de gamle menurækker tilbage, de nye væk.
begin;
select core_compliance.stork_script_start('2-menu-struktur-tilbagerulning.sql', 'tilbagerulning', 'Tilbagerulning af trin 2 (menurækker)', 'Mathias');
delete from public.sidebar_menu_config where item_key like 'omraade_%' or item_key like 'side_%';
do $do$ begin
  if to_regclass('arkiv_2026_10.sidebar_menu_config_trin2') is null then raise exception 'arkiv_2026_10.sidebar_menu_config_trin2 findes ikke: dataskript 2 er ikke kørt (eller er allerede rullet tilbage)'; end if;
  execute 'insert into public.sidebar_menu_config select * from arkiv_2026_10.sidebar_menu_config_trin2 on conflict (item_key) do nothing';
end $do$;
do $do$ begin
  if to_regclass('arkiv_2026_10.user_menu_permissions_trin2') is not null then
    execute 'insert into public.user_menu_permissions select * from arkiv_2026_10.user_menu_permissions_trin2 on conflict do nothing';
  end if;
end $do$;
drop table arkiv_2026_10.sidebar_menu_config_trin2;
drop table if exists arkiv_2026_10.user_menu_permissions_trin2;
select core_compliance.stork_script_slut();
commit;
select count(*) menu_raekker from public.sidebar_menu_config;
