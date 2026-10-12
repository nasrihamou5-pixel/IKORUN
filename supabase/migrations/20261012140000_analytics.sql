-- IKORUN V4.0.0 — Statistiques d'usage anonymes
-- ---------------------------------------------------------------------------
-- · events : un événement = un nom (open, plan_created, bilan_done…), quelques propriétés
--   sans donnée personnelle, la langue, la plateforme (ios/android/desktop/other), « app
--   installée ou non » et la version. Identifiant : un nombre aléatoire tiré par l'app à
--   l'installation (aid), JAMAIS relié au compte, et effacé si l'utilisateur refuse les
--   statistiques (Profil › Compte et données).
-- · Écriture uniquement par ikorun_track (lots de 50 au plus, 600 événements par heure et par
--   adresse IP ; l'IP n'est pas enregistrée, seule son empreinte du jour sert de compteur).
-- · Lecture : aucune ligne n'est lisible par les clients ; l'admin de l'app reçoit seulement
--   des agrégats (ikorun_analytics).
-- · Conservation : 400 jours (tâche planifiée quotidienne).
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  ts          timestamptz not null default now(),
  day         date not null,
  aid         uuid not null,
  name        text not null check (name ~ '^[a-z][a-z0-9_]{1,39}$'),
  props       jsonb check (props is null or (jsonb_typeof(props) = 'object' and length(props::text) <= 300)),
  lang        text check (lang is null or lang in ('fr','en','ar')),
  platform    text check (platform is null or platform in ('ios','android','desktop','other')),
  standalone  boolean,
  app_version text check (app_version is null or app_version ~ '^[0-9A-Za-z.\-]{1,20}$')
);
comment on table public.events is 'Statistiques d''usage anonymes (identifiant aléatoire non relié au compte). Écriture : ikorun_track ; lecture : agrégats admin (ikorun_analytics).';
create index if not exists events_day_idx on public.events (day);
create index if not exists events_name_day_idx on public.events (name, day);
create index if not exists events_aid_day_idx on public.events (aid, day);
alter table public.events enable row level security;
alter table public.events force row level security;
revoke all on public.events from anon, authenticated;

create table if not exists public.events_rate (
  k            text primary key,
  window_start timestamptz not null,
  count        int not null
);
comment on table public.events_rate is 'Compteur anti-abus de ikorun_track (empreinte du jour de l''IP, jamais l''IP). Purgé chaque jour.';
alter table public.events_rate enable row level security;
alter table public.events_rate force row level security;
revoke all on public.events_rate from anon, authenticated;

create or replace function public.ikorun_try_ts(t text)
returns timestamptz language plpgsql immutable set search_path = '' as $$
begin
  if t is null or t !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}' then return null; end if;
  return t::timestamptz;
exception when others then return null;
end $$;

create or replace function public.ikorun_track(p_events jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_hdr jsonb; v_ip text; v_k text; v_n int; v_count int; v_ins int;
begin
  if p_events is null or jsonb_typeof(p_events) <> 'array' then return 0; end if;
  v_n := jsonb_array_length(p_events);
  if v_n = 0 then return 0; end if;
  if v_n > 50 then raise exception 'too_many'; end if;
  begin v_hdr := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then v_hdr := null; end;
  v_ip := coalesce(v_hdr->>'cf-connecting-ip', split_part(v_hdr->>'x-forwarded-for', ',', 1), 'inconnu');
  v_k := md5(trim(v_ip) || '|' || current_date::text || '|ikorun');
  insert into public.events_rate (k, window_start, count) values (v_k, now(), v_n)
  on conflict (k) do update
    set window_start = case when now() - public.events_rate.window_start > interval '1 hour' then now() else public.events_rate.window_start end,
        count = case when now() - public.events_rate.window_start > interval '1 hour' then v_n else public.events_rate.count + v_n end
  returning count into v_count;
  if v_count > 600 then return 0; end if;

  insert into public.events (ts, day, aid, name, props, lang, platform, standalone, app_version)
  select x.ts, (x.ts at time zone 'Africa/Algiers')::date, x.aid, x.name, x.props, x.lang, x.platform, x.standalone, x.app_version
  from (
    select
      -- heure de l'événement (file d'attente hors ligne) : 7 jours en arrière au plus, sinon maintenant
      case when public.ikorun_try_ts(e->>'ts') between now() - interval '7 days' and now() + interval '5 minutes'
           then public.ikorun_try_ts(e->>'ts') else now() end as ts,
      case when (e->>'aid') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (e->>'aid')::uuid end as aid,
      e->>'n' as name,
      case when jsonb_typeof(e->'p') = 'object' and length((e->'p')::text) <= 300 then e->'p' end as props,
      case when e->>'l' in ('fr','en','ar') then e->>'l' end as lang,
      case when e->>'pf' in ('ios','android','desktop','other') then e->>'pf' end as platform,
      case when jsonb_typeof(e->'st') = 'boolean' then (e->>'st')::boolean end as standalone,
      case when (e->>'v') ~ '^[0-9A-Za-z.\-]{1,20}$' then e->>'v' end as app_version
    from jsonb_array_elements(p_events) e
    where jsonb_typeof(e) = 'object'
  ) x
  where x.aid is not null and x.name ~ '^[a-z][a-z0-9_]{1,39}$';
  get diagnostics v_ins = row_count;
  return v_ins;
end; $$;
revoke all on function public.ikorun_track(jsonb) from public;
grant execute on function public.ikorun_track(jsonb) to anon, authenticated;

-- ---------- tableau de bord (admin de l'app) ----------
create or replace function public.ikorun_analytics(p_days int default 30)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare
  v_today date := (now() at time zone 'Africa/Algiers')::date;
  v_days int := least(greatest(coalesce(p_days, 30), 7), 365);
  v_from date := v_today - v_days + 1;
  v jsonb;
begin
  if not public.ikorun_is_app_admin() then raise exception 'not_admin'; end if;
  with per as (select * from public.events where day >= v_from),
  firsts as (select aid, min(day) as d0 from public.events where day >= v_today - 120 group by aid),
  ret as (
    select n, count(*) as cohort,
           count(*) filter (where exists (select 1 from public.events e where e.aid = f.aid and e.day = f.d0 + n)) as kept
    from (values (1),(7),(30)) as r(n)
    join firsts f on f.d0 between v_today - 90 and v_today - n
    group by n
  )
  select jsonb_build_object(
    'days', v_days,
    'from', v_from,
    'today', v_today,
    'dau', coalesce((select jsonb_agg(jsonb_build_array(d, c) order by d) from (
             select g::date as d, (select count(distinct aid) from per where per.day = g::date) as c
             from generate_series(v_from, v_today, interval '1 day') g) s), '[]'::jsonb),
    'dau_today', (select count(distinct aid) from per where day = v_today),
    'wau', (select count(distinct aid) from per where day > v_today - 7),
    'mau', (select count(distinct aid) from public.events where day > v_today - 30),
    'active', (select count(distinct aid) from per),
    'funnel', jsonb_build_array(
      jsonb_build_array('open',         (select count(distinct aid) from per where name = 'open')),
      jsonb_build_array('ob_done',      (select count(distinct aid) from per where name in ('ob_done','guest_start'))),
      jsonb_build_array('plan_created', (select count(distinct aid) from per where name = 'plan_created')),
      jsonb_build_array('bilan_done',   (select count(distinct aid) from per where name = 'bilan_done'))),
    'retention', coalesce((select jsonb_agg(jsonb_build_object('n', n, 'cohort', cohort, 'kept', kept) order by n) from ret), '[]'::jsonb),
    'features', coalesce((select jsonb_agg(jsonb_build_array(name, c, u) order by c desc) from (
             select name, count(*) as c, count(distinct aid) as u from per group by name order by count(*) desc limit 40) f), '[]'::jsonb),
    'langs', coalesce((select jsonb_agg(jsonb_build_array(coalesce(lang,'?'), c) order by c desc) from (
             select lang, count(distinct aid) as c from per group by lang) l), '[]'::jsonb),
    'platforms', coalesce((select jsonb_agg(jsonb_build_array(coalesce(platform,'?'), c) order by c desc) from (
             select platform, count(distinct aid) as c from per group by platform) p), '[]'::jsonb),
    'installed', (select count(distinct aid) from per where standalone),
    'versions', coalesce((select jsonb_agg(jsonb_build_array(coalesce(app_version,'?'), c) order by c desc) from (
             select app_version, count(distinct aid) as c from per where day > v_today - 7 group by app_version order by 2 desc limit 6) vv), '[]'::jsonb)
  ) into v;
  return v;
end; $$;
revoke all on function public.ikorun_analytics(int) from public, anon;
grant execute on function public.ikorun_analytics(int) to authenticated;

-- ---------- conservation ----------
create or replace function public.ikorun_events_purge()
returns void language sql security definer set search_path = public as $$
  delete from public.events where day < (now() at time zone 'Africa/Algiers')::date - 400;
  delete from public.events_rate where window_start < now() - interval '1 day';
$$;
revoke all on function public.ikorun_events_purge() from public, anon, authenticated;
select cron.unschedule('ikorun-events-purge') where exists (select 1 from cron.job where jobname = 'ikorun-events-purge');
select cron.schedule('ikorun-events-purge', '17 3 * * *', $$select public.ikorun_events_purge();$$);
