-- Dataskript 2 (trin 2): menuens rækker for den nye struktur (8 områder, 26 sider). Køres 5 min før den samlede publicering.
-- Kørsel som registreret script: 'SHA' = filens sha256. Godkendt: Mathias 26/10 (»du har et go«). Testet på testkopien først.
-- FORUDSÆTNING: bundt (b1)–(b4), (c) og (e) er publiceret i samme vindue. Gamle menurækker gemmes i arkiv_2026_10 (slettes automatisk 25/12-2026).
-- Tilbagerulning: 2-menu-struktur-tilbagerulning.sql.
begin;
select core_compliance.stork_script_start('2-menu-struktur.sql', 'SHA', 'Trin 2: sidebar_menu_config får 8 områder og 26 sider (nye item_keys); gamle rækker for sider, der nu er faner, flyttes til arkiv_2026_10.sidebar_menu_config_trin2; ingen ændring i rettigheder', 'Mathias (26/10: »du har et go«)');

-- 1) Gamle rækker gemmes: sektioner og punkter, der ikke findes i den nye struktur.
create table arkiv_2026_10.sidebar_menu_config_trin2 as select * from public.sidebar_menu_config;
delete from public.sidebar_menu_config where item_key not like 'omraade_%' and item_key not like 'side_%';

-- 2) Områder (sektioner).
insert into public.sidebar_menu_config (id, item_key, parent_key, sort_order, visible, label_override, icon_name, href) values
  (gen_random_uuid(), 'omraade_mit_arbejde', null, 10, true, null, null, null),
  (gen_random_uuid(), 'omraade_mit_team', null, 20, true, null, null, null),
  (gen_random_uuid(), 'omraade_salg_og_kunder', null, 30, true, null, null, null),
  (gen_random_uuid(), 'omraade_rekruttering_og_personale', null, 40, true, null, null, null),
  (gen_random_uuid(), 'omraade_loen_og_rapporter', null, 50, true, null, null, null),
  (gen_random_uuid(), 'omraade_compliance_og_amo', null, 60, true, null, null, null),
  (gen_random_uuid(), 'omraade_administration', null, 70, true, null, null, null),
  (gen_random_uuid(), 'omraade_tavler', null, 80, true, null, null, null)
  on conflict (item_key) do update set parent_key = excluded.parent_key, sort_order = excluded.sort_order;

-- 3) Sider (punkter), item_key = sidens id i src/config/struktur.ts.
insert into public.sidebar_menu_config (id, item_key, parent_key, sort_order, visible, label_override, icon_name, href) values
  (gen_random_uuid(), 'side_hjem', 'omraade_mit_arbejde', 10, true, null, 'Home', '/home'),
  (gen_random_uuid(), 'side_mine_tal', 'omraade_mit_arbejde', 20, true, null, 'Target', '/my-goals'),
  (gen_random_uuid(), 'side_vagter', 'omraade_mit_arbejde', 30, true, null, 'Calendar', '/vagter'),
  (gen_random_uuid(), 'side_registrer_salg', 'omraade_mit_arbejde', 40, true, null, 'BadgeCheck', '/registrer-salg'),
  (gen_random_uuid(), 'side_storkbook', 'omraade_mit_arbejde', 50, true, null, 'Newspaper', '/storkbook'),
  (gen_random_uuid(), 'side_spil', 'omraade_mit_arbejde', 60, true, null, 'Trophy', '/spil'),
  (gen_random_uuid(), 'side_min_profil', 'omraade_mit_arbejde', 70, true, null, 'User', '/my-profile'),
  (gen_random_uuid(), 'side_vagtplan', 'omraade_mit_team', 10, true, null, 'CalendarDays', '/shift-planning'),
  (gen_random_uuid(), 'side_mit_team', 'omraade_mit_team', 20, true, null, 'Users', '/mit-team'),
  (gen_random_uuid(), 'side_onboarding', 'omraade_mit_team', 30, true, null, 'GraduationCap', '/onboarding-program'),
  (gen_random_uuid(), 'side_salg', 'omraade_salg_og_kunder', 5, true, null, 'ShoppingCart', '/sales'),
  (gen_random_uuid(), 'side_fieldmarketing', 'omraade_salg_og_kunder', 10, true, null, 'MapPin', '/vagt-flow'),
  (gen_random_uuid(), 'side_ret_salg', 'omraade_salg_og_kunder', 20, true, null, 'Pencil', '/ret-salg'),
  (gen_random_uuid(), 'side_tdc_vaerktoejer', 'omraade_salg_og_kunder', 30, true, null, 'Wrench', '/tdc'),
  (gen_random_uuid(), 'side_kunder_og_priser', 'omraade_salg_og_kunder', 40, true, null, 'Building2', '/kunder-og-priser'),
  (gen_random_uuid(), 'side_rekruttering', 'omraade_rekruttering_og_personale', 10, true, null, 'UserPlus', '/recruitment'),
  (gen_random_uuid(), 'side_medarbejdere', 'omraade_rekruttering_og_personale', 20, true, null, 'Users', '/employees'),
  (gen_random_uuid(), 'side_kontrakter_og_karriere', 'omraade_rekruttering_og_personale', 30, true, null, 'FileSignature', '/contracts'),
  (gen_random_uuid(), 'side_rapporter', 'omraade_loen_og_rapporter', 10, true, null, 'BarChart3', '/reports/admin'),
  (gen_random_uuid(), 'side_invoiceflow', 'omraade_loen_og_rapporter', 20, true, null, 'Receipt', '/invoiceflow'),
  (gen_random_uuid(), 'side_compliance', 'omraade_compliance_og_amo', 10, true, null, 'ShieldCheck', '/compliance'),
  (gen_random_uuid(), 'side_amo', 'omraade_compliance_og_amo', 20, true, null, 'HeartPulse', '/amo'),
  (gen_random_uuid(), 'side_administration', 'omraade_administration', 10, true, null, 'Settings', '/admin'),
  (gen_random_uuid(), 'side_tavler', 'omraade_tavler', 10, true, null, 'LayoutDashboard', '/dashboards'),
  (gen_random_uuid(), 'side_powerdag', 'omraade_tavler', 20, true, null, 'Zap', '/dashboards/powerdag'),
  (gen_random_uuid(), 'side_live_tal', 'omraade_tavler', 30, true, null, 'Activity', '/live-stats')
  on conflict (item_key) do update set parent_key = excluded.parent_key, sort_order = excluded.sort_order, href = excluded.href, icon_name = excluded.icon_name;

-- 4) Brugerspecifikke menu-overstyringer, der peger på gamle rækker, gemmes og fjernes (user_menu_permissions refererer menu_item_id).
do $do$ begin
  if to_regclass('public.user_menu_permissions') is not null then
    execute 'create table arkiv_2026_10.user_menu_permissions_trin2 as select * from public.user_menu_permissions where menu_item_id::text not in (select id::text from public.sidebar_menu_config)';
    execute 'delete from public.user_menu_permissions where menu_item_id::text not in (select id::text from public.sidebar_menu_config)';
  end if;
end $do$;

select core_compliance.stork_script_slut();
commit;
select item_key, parent_key, sort_order, href from public.sidebar_menu_config order by parent_key nulls first, sort_order;
select count(*) gamle_raekker_i_arkiv from arkiv_2026_10.sidebar_menu_config_trin2;
