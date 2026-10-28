create or replace function public.opstartshold_dage(p_cohort_ids uuid[], p_ad_hoc_datoer date[], p_dage integer default 10)
returns table (hold_noegle text, hold_navn text, start_dato date, employee_id uuid, navn text, slut_dato date, dag integer, dato date, linjer integer, hiper integer)
language sql
stable
security invoker
set search_path = public
as $$
  with hold as (
    select c.id::text as noegle, c.name as navn, c.start_date as start from onboarding_cohorts c where c.id = any(coalesce(p_cohort_ids, '{}'))
    union all
    select 'adhoc:' || d::text, 'Start ' || to_char(d, 'DD/MM-YYYY'), d from unnest(coalesce(p_ad_hoc_datoer, '{}')) d
  ),
  medlem as (
    select h.noegle, cm.employee_id from hold h join cohort_members cm on cm.cohort_id::text = h.noegle where cm.employee_id is not null
    union
    select h.noegle, e.id from hold h join employee_master_data e on h.noegle like 'adhoc:%' and e.employment_start_date = h.start
  ),
  dage as (
    select h.noegle, x.dato, x.dag from hold h
    cross join lateral (
      select g::date as dato, row_number() over (order by g)::int as dag
      from generate_series(h.start, h.start + (least(greatest(coalesce(p_dage, 10), 1), 40) * 2 + 7), interval '1 day') g
      where extract(isodow from g) < 6
    ) x
    where x.dag <= least(greatest(coalesce(p_dage, 10), 1), 40)
  ),
  mail as (
    select distinct m.noegle, m.employee_id, lower(a.email) as email
    from medlem m join employee_agent_mapping eam on eam.employee_id = m.employee_id join agents a on a.id = eam.agent_id
    where a.email is not null
  ),
  linje as (
    select ml.noegle, ml.employee_id, (s.sale_datetime at time zone 'Europe/Copenhagen')::date as dato,
      count(*)::int as linjer, count(*) filter (where cc.name = 'Hiper Bredbånd')::int as hiper
    from mail ml
    join hold h on h.noegle = ml.noegle
    join sales s on lower(s.agent_email) = ml.email
      and s.sale_datetime >= (h.start::timestamp at time zone 'Europe/Copenhagen')
      and s.sale_datetime < ((h.start + 90)::timestamp at time zone 'Europe/Copenhagen')
    join sale_items si on si.sale_id = s.id
    left join client_campaigns cc on cc.id = s.client_campaign_id
    where s.source = 'Eesy TM' or cc.name ilike '%eesy tm%' or cc.name = 'Hiper Bredbånd'
    group by 1, 2, 3
  )
  select h.noegle, h.navn, h.start, m.employee_id,
    trim(coalesce(e.first_name, '') || ' ' || coalesce(e.last_name, '')), e.employment_end_date,
    d.dag, d.dato, coalesce(l.linjer, 0), coalesce(l.hiper, 0)
  from hold h
  join medlem m on m.noegle = h.noegle
  left join employee_master_data e on e.id = m.employee_id
  join dage d on d.noegle = h.noegle
  left join linje l on l.noegle = h.noegle and l.employee_id = m.employee_id and l.dato = d.dato
  order by h.start desc, h.noegle, m.employee_id, d.dag;
$$;

revoke all on function public.opstartshold_dage(uuid[], date[], integer) from public, anon;
grant execute on function public.opstartshold_dage(uuid[], date[], integer) to authenticated;