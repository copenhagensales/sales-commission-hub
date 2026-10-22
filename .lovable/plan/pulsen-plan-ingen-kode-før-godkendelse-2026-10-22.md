# Pulsen – plan (ingen kode før godkendelse)

Mærkning: **[B]** bekræftet i kode/DB i denne runde · **[U]** udledt · **[?]** ukendt, verificeres i trin 0.

## 1. Sådan virker det i dag

**Reaktioner/kommentarer**
- [B] `feed_reactions` (id, target_type, target_key, user_id, emoji, created_at) og `feed_comments` (id, target_type, target_key, user_id, body, created_at). Eneste kode-adgang: `src/hooks/useFeedReactions.ts`; emoji-mapping i `src/lib/feedReactions.ts` (5 faste reaktioner, gamle grupperes kun i visning).
- [B] Målnøgler: `birthday:<employee_id>:<år>`, `anniversary:<employee_id>:<år>`, `league_round:<season_id>:<employee_id>`.
- [B] Komponenter: `FeedReactionRow.tsx`, `FeedCommentList.tsx`, `CelebrationStrip.tsx`, `CompactLeagueView.tsx` i `src/components/home/`.
- [B] Kendt afvigelse fra forrige ordre: skift/fjern af reaktion sletter brugerens egne ældre rækker. Skal afklares før Pulsen bygger ovenpå (se risici).
- [?] RLS-politikkerne på `feed_reactions`/`feed_comments` (target_type-whitelist? CHECK?) – læses i trin 0.

**Begivenheder**
- [B] `src/pages/Home.tsx` laver opret/slet direkte med `supabase.from("company_events")` + `event_team_invitations` inline i siden (linje ~285–400) – bryder hook-reglen. Rettighed: `canEditPermission("action_manage_company_events")` (Home.tsx:92).
- [B] Visning: `EventRsvpCard.tsx`, `EditEventDialog.tsx`, `EventDetailDialog.tsx`, `EventInvitationPopup.tsx`. Tilmelding til `event_attendees` (attending/maybe/not_attending).
- [?] Den præcise regel for teammålrettede events (filtreres i frontend i Home.tsx eller af RLS?). Hvis kun frontend, er det et eksisterende hul, som Pulsen ikke må arve – rapporteres, ikke rettes uden ordre.

**Menu og rettigheder**
- [B] `src/config/permissionKeys.ts` er eneste kilde: `menu_home` (section `mit_hjem`, parent `menu_section_personal`), `action_manage_company_events` (parent `menu_home`), `menu_pulse_survey` findes (section test).
- [B] Sidebar: `src/components/layout/AppSidebar.tsx`, `PreviewSidebar.tsx`, `MenuEditor.tsx` + `sidebar_menu_config`. Route-guard: `src/routes/config.tsx` med `access: "role"` + `positionPermission`.
- [U] Permission-auto-healing (memory "Permission Hierarchy") opretter `role_page_permissions`-rækker for nye nøgler; defaults pr. rolle verificeres i trin 0.

**Salgsdata og profilstatistik**
- [B] `employee_profile_stats` genberegnes af `recalc_employee_profile_stats()` via cron `20 3 * * *` UTC (= 05:20 dansk sommertid). Altså natlig – ubrugelig til live, men brugbar som **historisk baseline** for rekorder.
- [B] `resolve_sales_employee_id(agent_email)` findes og bruges af profilstatistikken.
- [?] Om resolveren dækker feltsælgere uden dialer-kobling (FM-salg attribueres via `fieldmarketing_sales`/work_email). Testes i trin 0 med aggregerede tal: antal FM-salg i dag med/uden resolvet medarbejder.
- [?] Lønperiode-funktion i DB: der findes 15.–14.-helpers i `supabase/functions/_shared/date-helpers.ts`; en DB-funktion er ikke bekræftet. Findes den ikke, bruges profilstatistikkens egen periodelogik (samme som i dag) – ingen ny definition.
- [?] Autoritativ "salg i dag pr. team" for toplinjen: kandidater er `get_sales_aggregates_v2` (memory Core) og TV-boardenes cache. Afgøres i trin 0.
- [B] Salgssync: Adversus-integration kører ca. hvert 5. min med 60 min overlap (ændret tidligere); salg kan derfor dukke op forsinket.

## 2. Datamodel (ny migration, ingen ændring af eksisterende tabeller)

Projektregler: RLS altid til, ingen anon, **ingen nye SECURITY DEFINER**, visninger med `security_invoker`. Derfor bygges RLS på eksisterende hjælpefunktioner (`effective_employee_id()`, `effective_is_owner()`, `effective_is_teamleder_or_above()` – [?] signaturer bekræftes) plus én ny SECURITY INVOKER-funktion.

```text
pulsen_posts
  id uuid pk, author_employee_id uuid not null, audience text ('house'|'team'),
  team_id uuid null (påkrævet når audience='team'), post_type text
  ('post'|'praise'|'question'|'image'|'event'), body text (maks 2000),
  praised_employee_id uuid null, event_id uuid null -> company_events,
  image_path text null, best_answer_comment_id uuid null,
  hidden_at timestamptz, hidden_by uuid, deleted_at timestamptz,
  created_at, updated_at
pulsen_milestones
  id uuid pk, milestone_type text, employee_id uuid null, team_id uuid null,
  period_key text (fx '2026-10-22', '2026-W43', 'lp-2026-10'), level int,
  value numeric, payload jsonb (kun tal/navne-id, aldrig kunde), rarity int,
  shown_in_house bool, occurred_at, updated_at,
  UNIQUE (milestone_type, coalesce(employee_id,team_id), period_key, level)
pulsen_config (én række pr. nøgle)
  key text pk, value jsonb  -- house_daily_max=10, team_daily_max=25,
  house_per_person_max=1, rarity_order=[...], team_thresholds=[50,100,...],
  streak_step=10, club_levels=[50000,100000,200000]
pulsen_last_seen
  employee_id uuid pk, last_seen_house timestamptz, last_seen_team jsonb
```

Målnøgler i `feed_reactions`/`feed_comments`: `pulsen_post:<id>`, `milestone:<id>`. Fødselsdage/jubilæer genbruger de eksisterende nøgler uændret, så reaktioner deles med forsiden. Events: `event:<event_id>` (ny, men samme tabel).

**Hjælpefunktion (SECURITY INVOKER, STABLE, search_path fast)**
`pulsen_visible_team_ids()` → team-id'er hvor brugeren er i `team_members`, er `teams.team_leader_id` eller i `team_assistant_leaders`. Ejer → alle via `effective_is_owner()`. [?] Kræver at brugeren må læse egne rækker i de tre tabeller under nuværende RLS – testes; ellers stop og tag gennem ændringsproceduren.

**RLS (skrevet ud)**
```sql
-- pulsen_posts
GRANT SELECT, INSERT, UPDATE ON public.pulsen_posts TO authenticated;
GRANT ALL ON public.pulsen_posts TO service_role;
CREATE POLICY pp_read ON pulsen_posts FOR SELECT TO authenticated USING (
  deleted_at IS NULL AND (hidden_at IS NULL OR author_employee_id = effective_employee_id()
     OR effective_is_owner())
  AND (audience = 'house' OR team_id = ANY (pulsen_visible_team_ids())));
CREATE POLICY pp_insert ON pulsen_posts FOR INSERT TO authenticated WITH CHECK (
  author_employee_id = effective_employee_id()
  AND (audience = 'team' AND team_id = ANY (pulsen_visible_team_ids())
       OR audience = 'house')  -- action_pulsen_post_house tjekkes i trigger
  AND (post_type <> 'event' OR event_id IS NOT NULL));
CREATE POLICY pp_update_own ON pulsen_posts FOR UPDATE TO authenticated
  USING (author_employee_id = effective_employee_id())
  WITH CHECK (author_employee_id = effective_employee_id());
CREATE POLICY pp_moderate ON pulsen_posts FOR UPDATE TO authenticated
  USING (effective_is_owner() OR (effective_is_teamleder_or_above()
         AND team_id = ANY (pulsen_visible_team_ids())));
-- ingen DELETE-politik: "slet" = deleted_at (historik bevares)

-- pulsen_milestones: kun læsning, skrives af service_role-job
GRANT SELECT ON pulsen_milestones TO authenticated; GRANT ALL ... TO service_role;
CREATE POLICY pm_read ON pulsen_milestones FOR SELECT TO authenticated USING (
  shown_in_house OR team_id = ANY (pulsen_visible_team_ids()) OR effective_is_owner());

-- pulsen_config: alle indloggede læser, kun ejer skriver
CREATE POLICY pc_read ... USING (true);   -- ingen persondata i tabellen
CREATE POLICY pc_write ... USING (effective_is_owner()) WITH CHECK (effective_is_owner());

-- pulsen_last_seen: kun egen række
CREATE POLICY pls_own FOR ALL USING (employee_id = effective_employee_id())
  WITH CHECK (employee_id = effective_employee_id());
```
Valideringstrigger (BEFORE INSERT/UPDATE, invoker): body-længde, team/audience-sammenhæng, forfatter må kun ændre body/image (ikke audience/author), moderator må kun sætte hidden_*. Rettighedstjek af `action_pulsen_post_house`/`action_pulsen_moderate` mod `role_page_permissions` – [?] om det kan læses invoker-mæssigt; ellers moderation = ejer/teamleder via eksisterende funktioner.

**Kommentar-sikkerhed:** i dag kan alle indloggede formentlig læse alle `feed_comments` [?]. For team-indlæg ville kommentarer så kunne læses af ikke-medlemmer. Forslag: ny politik på `feed_comments`/`feed_reactions`, der for `target_type in ('pulsen_post','milestone')` kræver at målet er synligt. Det er en ændring i eksisterende tabellers RLS → kræver din eksplicitte godkendelse.

**Storage:** privat bucket `pulsen-images`, 10 MB grænse, sti `<employee_id>/<post_id>.webp`, klient-komprimering før upload, signed URLs (1 t). Politikker: skriv kun egen mappe; læs hvis tilhørende post er synlig.

## 3. Milepæls-jobbet

- Edge-funktion `pulsen-milestones` (service role, ingen kundefelter læses), kaldt af cron hvert 5. min (288 kørsler/døgn – lille forespørgsel, men holder databasen vågen; alternativ hvert 15. min). Kun SELECT på salg/sale_items; skriver kun `pulsen_milestones`.
- Dag i Europe/Copenhagen; lønperiode via eksisterende helper.
- Baseline for rekorder = `employee_profile_stats` (natlig) + dagens/ugens/periodens live-sum fra samme salgskilde som profilstatistikken (provision = `sale_items.mapped_commission`). Overstiger live baseline → upsert på unik nøgle; stiger den igen samme periode → `UPDATE value`.
- Første salg: ingen tidligere salg via resolveren. Klub: periode-sum krydser niveau første gang (tjek `club_*_count = 0` for niveauet). Stribe: fra `current_streak_days` + i dag. Teamfejring: salgstal pr. team via samme kilde som toplinjen. Husrekord: dagens salg > højeste historiske dag (beregnes én gang og caches i config).
- Huset-udvælgelse: sorter kandidater efter `rarity_order` fra config, max 1 pr. person, max `house_daily_max`; resten kun i team. Annulleringer ændrer intet bagudrettet.
- Realistisk live-grad: 5–10 min efter salget er synligt i Stork; Adversus-forsinkelse kan give op til ca. 60 min.

## 4. Genbrug vs. nyt

Genbruges: `useFeedReactions`, `FeedReactionRow`, `FeedCommentList`, `CelebrationStrip`-datahook (`useCelebrationData`), `EventRsvpCard`, `EditEventDialog`, avatar-hooks, permission-hooks, route-guard.
Flyttes (adfærd uændret): event-opret/slet/RSVP fra `Home.tsx` til ny `src/hooks/useCompanyEvents.ts`, så forside og Pulsen bruger samme kode.
Nyt: `src/pages/Pulsen.tsx`; `src/components/pulsen/` (PulsenHeader, Composer, PostCard, MilestoneBar, MilestoneHeroCard, ComingSoon, UnansweredQuestions, TeamSwitcher, skeletons/tomme tilstande); hooks `usePulsenFeed`, `usePulsenPosts` (mutations), `usePulsenMilestones`, `usePulsenLastSeen`, `usePulsenTodayTicker`; `src/lib/pulsen/rarity.ts` (+test) og `src/lib/pulsen/feedMerge.ts` (+test).
Udskudt (spørg): ros på profil – kun hvis profilsiden har et oplagt sted.

## 5. Risici og ukendte

- Reaktionshooken sletter i dag ældre egne rækker – strider mod din tidligere ordre. Skal besluttes før genbrug.
- Kommentar/reaktions-RLS på eksisterende tabeller (se ovenfor).
- Teammålrettede events: regel ikke bekræftet; muligvis kun frontend.
- Resolver og FM-sælgere: ikke bekræftet.
- Hjælpefunktioner og deres SECURITY DEFINER-status: kan ikke oprette nye; afhænger af eksisterende.
- Én medarbejder i to teams: håndteres af teamvælger; holdets salgstal må ikke tælles dobbelt i huset.
- GDPR-forslag (ikke bygget): (a) art. 30-post "Intern kommunikation – Pulsen" i compliance-fanen, (b) slettepolitik: indlæg/billeder anonymiseres 24 mdr. efter oprettelse og ved fratræden + 30 dage, (c) fast tekst "Del aldrig kundeoplysninger", (d) moderationsflow ved kundedata. Afventer din godkendelse.
- Ulæst-badge: kræver lille ekstra forespørgsel pr. sidebar-render – caches 2 min.

## 6. Byggerækkefølge

0. Read-only verifikation af alle [?] (RLS på feed-tabeller, event-regel, resolver/FM, lønperiode-funktion, toplinje-kilde, hjælpefunktioner). Rapport til dig.
1. Rettighedsnøgler `menu_pulsen`, `action_pulsen_moderate`, `action_pulsen_post_house` + menupunkt + tom side bag guard.
2. Flyt event-logik til `useCompanyEvents` (ingen adfærdsændring), test forsiden.
3. Migration: posts, config, last_seen, hjælpefunktion, RLS, trigger. Test RLS med to brugere i hvert sit team.
4. Feed-UI med indlæg, ros, spørgsmål, events og fødselsdage/jubilæer.
5. Billeder + bucket.
6. Milepælstabel + edge-funktion i tør-kørsel (logger kun antal), derefter cron.
7. Toplinje, højrekolonne, ulæst-badge, tomme/fejl-tilstande.
8. Compliance-tekst og slettepolitik efter din godkendelse.

Hvert trin er én leverance med egen færdigrapport.
