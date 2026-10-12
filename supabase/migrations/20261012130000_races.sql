-- IKORUN V4.0.0 — Calendrier des courses algériennes
-- ---------------------------------------------------------------------------
-- · races            : les courses. Lecture publique (même sans compte), écriture réservée
--                      aux administrateurs de l'app (table app_admins).
-- · race_proposals   : propositions des coureurs et des clubs, validées par un admin.
-- · race_follows     : « me rappeler cette course » (J-30, J-7, la veille), chacun ses lignes.
-- · race_reminder_log: rappels déjà envoyés (lu et écrit par l'Edge Function seulement).
-- Dédoublonnage : le nom est normalisé (accents, petits mots, ordre des mots). Une course de
-- même nom (et même wilaya) à moins de 45 jours est la MÊME édition : même date → fusion des
-- champs vides ; autre date → la date existante est gardée et la contradiction est signalée
-- (date_conflict + note) pour qu'un admin tranche.
-- Collecte automatique sur des sites tiers : NON activée (voir docs/COURSES_SOURCES.md).
-- ---------------------------------------------------------------------------

-- ---------- administrateurs de l'app ----------
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text check (note is null or length(note) <= 120),
  created_at timestamptz not null default now()
);
comment on table public.app_admins is 'Administrateurs de l''app (calendrier des courses, statistiques). Ajout à la main dans le SQL Editor uniquement.';
alter table public.app_admins enable row level security;
alter table public.app_admins force row level security;
drop policy if exists app_admins_select_own on public.app_admins;
create policy app_admins_select_own on public.app_admins for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.app_admins from anon, authenticated;
grant select on public.app_admins to authenticated;

create or replace function public.ikorun_is_app_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
revoke all on function public.ikorun_is_app_admin() from public, anon;
grant execute on function public.ikorun_is_app_admin() to authenticated;

-- ---------- normalisation du nom (dédoublonnage) ----------
create or replace function public.ikorun_race_norm(p text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(string_agg(w, ' ' order by w), '')
  from (
    select distinct w
    from regexp_split_to_table(
      regexp_replace(
        translate(lower(coalesce(p, '')),
          'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœ’''',
          'aaaaaaceeeeiiiinooooouuuuyyo  '),
        '[^a-z0-9؀-ۿ]+', ' ', 'g'),
      ' ') as w
    where length(w) > 2
      and w not in ('les','des','une','international','internationale','internationaux','edition','course','ere','eme','the','and')
      and w !~ '^(19|20)[0-9]{2}$'
  ) t;
$$;

create or replace function public.ikorun_race_dist_ok(d numeric[])
returns boolean language sql immutable set search_path = '' as $$
  select d is null or (coalesce(array_length(d, 1), 0) <= 8 and not exists (select 1 from unnest(d) x where x is null or x < 0.1 or x > 400));
$$;

-- ---------- courses ----------
create table if not exists public.races (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(name) between 3 and 140),
  date          date not null check (date between '2020-01-01' and '2100-12-31'),
  date_end      date check (date_end is null or date_end >= date),
  start_time    time,
  city          text not null check (length(city) between 2 and 80),
  wilaya        smallint check (wilaya is null or wilaya between 1 and 58),
  lat           numeric(8,5) check (lat is null or lat between 18 and 38),
  lon           numeric(8,5) check (lon is null or lon between -9 and 12.5),
  kind          text not null default 'route' check (kind in ('route','cross','trail','piste','ultra','marche','autre')),
  distances     numeric(6,3)[] check (public.ikorun_race_dist_ok(distances)),
  organizer     text check (organizer is null or length(organizer) <= 120),
  url           text check (url is null or (length(url) <= 300 and url ~ '^https?://[^\s<>"'']+$')),
  reg_url       text check (reg_url is null or (length(reg_url) <= 300 and reg_url ~ '^https?://[^\s<>"'']+$')),
  description   text check (description is null or length(description) <= 1500),
  source        text not null default 'admin' check (source in ('admin','proposal','import')),
  source_url    text check (source_url is null or (length(source_url) <= 300 and source_url ~ '^https?://[^\s<>"'']+$')),
  status        text not null default 'published' check (status in ('published','cancelled','postponed')),
  date_conflict boolean not null default false,
  conflict_note text check (conflict_note is null or length(conflict_note) <= 500),
  norm_key      text not null default '',
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.races is 'Calendrier des courses en Algérie. Lecture publique ; écriture : administrateurs de l''app (ikorun_is_app_admin).';
create index if not exists races_date_idx on public.races (date);
create index if not exists races_norm_idx on public.races (norm_key, date);

create or replace function public.ikorun_races_touch()
returns trigger language plpgsql set search_path = public as $$
begin
  new.norm_key := public.ikorun_race_norm(new.name);
  new.updated_at := now();
  if tg_op = 'INSERT' then new.created_by := coalesce(new.created_by, auth.uid()); new.created_at := now(); end if;
  return new;
end; $$;
revoke all on function public.ikorun_races_touch() from public, anon, authenticated;
drop trigger if exists races_touch on public.races;
create trigger races_touch before insert or update on public.races for each row execute function public.ikorun_races_touch();

alter table public.races enable row level security;
alter table public.races force row level security;
drop policy if exists races_read on public.races;
drop policy if exists races_admin_insert on public.races;
drop policy if exists races_admin_update on public.races;
drop policy if exists races_admin_delete on public.races;
create policy races_read on public.races for select to anon, authenticated using (true);
create policy races_admin_insert on public.races for insert to authenticated with check ((select public.ikorun_is_app_admin()));
create policy races_admin_update on public.races for update to authenticated using ((select public.ikorun_is_app_admin())) with check ((select public.ikorun_is_app_admin()));
create policy races_admin_delete on public.races for delete to authenticated using ((select public.ikorun_is_app_admin()));
revoke all on public.races from anon, authenticated;
grant select on public.races to anon, authenticated;
grant insert, update, delete on public.races to authenticated;

-- ---------- contrôle d'une course reçue en JSON (admin, import, proposition) ----------
-- Rend un code d'erreur (champ fautif) ou null.
create or replace function public.ikorun_race_check(p jsonb)
returns text language plpgsql immutable set search_path = public as $$
declare v_d date; v_e date; v_n numeric; x text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then return 'format'; end if;
  if length(coalesce(trim(p->>'name'), '')) not between 3 and 140 then return 'name'; end if;
  v_d := public.ikorun_try_date(p->>'date');
  if v_d is null or v_d < '2020-01-01' or v_d > '2100-12-31' then return 'date'; end if;
  if nullif(p->>'date_end', '') is not null then
    v_e := public.ikorun_try_date(p->>'date_end'); if v_e is null or v_e < v_d then return 'date_end'; end if;
  end if;
  if nullif(p->>'start_time', '') is not null and (p->>'start_time') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return 'start_time'; end if;
  if length(coalesce(trim(p->>'city'), '')) not between 2 and 80 then return 'city'; end if;
  if nullif(p->>'wilaya', '') is not null then
    v_n := public.ikorun_try_num(p->>'wilaya'); if v_n is null or v_n <> trunc(v_n) or v_n < 1 or v_n > 58 then return 'wilaya'; end if;
  end if;
  if nullif(p->>'lat', '') is not null or nullif(p->>'lon', '') is not null then
    if public.ikorun_try_num(p->>'lat') is null or public.ikorun_try_num(p->>'lon') is null
       or public.ikorun_try_num(p->>'lat') not between 18 and 38 or public.ikorun_try_num(p->>'lon') not between -9 and 12.5 then return 'coords'; end if;
  end if;
  if coalesce(nullif(p->>'kind', ''), 'route') not in ('route','cross','trail','piste','ultra','marche','autre') then return 'kind'; end if;
  if p ? 'distances' and jsonb_typeof(p->'distances') <> 'null' then
    if jsonb_typeof(p->'distances') <> 'array' or jsonb_array_length(p->'distances') > 8 then return 'distances'; end if;
    for x in select jsonb_array_elements_text(p->'distances') loop
      v_n := public.ikorun_try_num(x); if v_n is null or v_n < 0.1 or v_n > 400 then return 'distances'; end if;
    end loop;
  end if;
  foreach x in array array['url','reg_url','source_url'] loop
    if nullif(p->>x, '') is not null and (length(p->>x) > 300 or (p->>x) !~ '^https?://[^\s<>"'']+$') then return x; end if;
  end loop;
  if length(coalesce(p->>'organizer', '')) > 120 then return 'organizer'; end if;
  if length(coalesce(p->>'description', '')) > 1500 then return 'description'; end if;
  if coalesce(nullif(p->>'status', ''), 'published') not in ('published','cancelled','postponed') then return 'status'; end if;
  return null;
end; $$;
grant execute on function public.ikorun_race_check(jsonb) to authenticated;

-- ---------- ajout avec dédoublonnage (admin) ----------
-- Rend {action:'inserted'|'merged'|'conflict'|'new'|'invalid', id?, error?, existing_date?}.
-- p_dry = true : simulation (aperçu d'un import), rien n'est écrit.
create or replace function public.ikorun_race_upsert(p jsonb, p_source text default 'admin', p_dry boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_err text; v_key text; v_d date; v_w smallint; v_ex public.races; v_id uuid; v_dist numeric[];
begin
  if not public.ikorun_is_app_admin() then raise exception 'not_admin'; end if;
  if p_source not in ('admin','proposal','import') then raise exception 'bad_source'; end if;
  v_err := public.ikorun_race_check(p);
  if v_err is not null then return jsonb_build_object('action','invalid','error',v_err); end if;
  v_key := public.ikorun_race_norm(p->>'name');
  v_d := public.ikorun_try_date(p->>'date');
  v_w := nullif(p->>'wilaya','')::numeric::smallint;
  v_dist := case when jsonb_typeof(p->'distances') = 'array'
                 then array(select x::numeric from jsonb_array_elements_text(p->'distances') x) end;
  select * into v_ex from public.races r
   where r.norm_key = v_key and abs(r.date - v_d) <= 45 and (r.wilaya is null or v_w is null or r.wilaya = v_w)
   order by abs(r.date - v_d) limit 1;
  if found then
    if v_ex.date = v_d then
      if not p_dry then
        update public.races set
          date_end   = coalesce(date_end, public.ikorun_try_date(p->>'date_end')),
          start_time = coalesce(start_time, nullif(p->>'start_time','')::time),
          wilaya     = coalesce(wilaya, v_w),
          lat        = coalesce(lat, public.ikorun_try_num(p->>'lat')),
          lon        = coalesce(lon, public.ikorun_try_num(p->>'lon')),
          distances  = coalesce(distances, v_dist),
          organizer  = coalesce(organizer, nullif(trim(p->>'organizer'),'')),
          url        = coalesce(url, nullif(p->>'url','')),
          reg_url    = coalesce(reg_url, nullif(p->>'reg_url','')),
          description= coalesce(description, nullif(trim(p->>'description'),'')),
          source_url = coalesce(source_url, nullif(p->>'source_url',''))
        where id = v_ex.id;
      end if;
      return jsonb_build_object('action','merged','id',v_ex.id);
    end if;
    if not p_dry then
      update public.races set date_conflict = true,
        conflict_note = left(coalesce(conflict_note || ' · ', '') || p_source || ' : ' || to_char(v_d, 'DD/MM/YYYY')
                             || coalesce(' (' || nullif(p->>'source_url','') || ')', ''), 500)
      where id = v_ex.id;
    end if;
    return jsonb_build_object('action','conflict','id',v_ex.id,'existing_date',v_ex.date,'new_date',v_d);
  end if;
  if p_dry then return jsonb_build_object('action','new'); end if;
  insert into public.races (name, date, date_end, start_time, city, wilaya, lat, lon, kind, distances, organizer, url, reg_url, description, source, source_url, status)
  values (trim(p->>'name'), v_d, public.ikorun_try_date(p->>'date_end'), nullif(p->>'start_time','')::time, trim(p->>'city'), v_w,
          public.ikorun_try_num(p->>'lat'), public.ikorun_try_num(p->>'lon'), coalesce(nullif(p->>'kind',''),'route'), v_dist,
          nullif(trim(p->>'organizer'),''), nullif(p->>'url',''), nullif(p->>'reg_url',''), nullif(trim(p->>'description'),''),
          p_source, nullif(p->>'source_url',''), coalesce(nullif(p->>'status',''),'published'))
  returning id into v_id;
  return jsonb_build_object('action','inserted','id',v_id);
end; $$;
revoke all on function public.ikorun_race_upsert(jsonb, text, boolean) from public, anon;
grant execute on function public.ikorun_race_upsert(jsonb, text, boolean) to authenticated;

-- Import CSV/JSON (saison de cross FAA, etc.) : 500 lignes au plus, une réponse par ligne.
create or replace function public.ikorun_races_import(p_rows jsonb, p_dry boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb := '[]'::jsonb; i int := 0; r jsonb;
begin
  if not public.ikorun_is_app_admin() then raise exception 'not_admin'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'format'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'too_many'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    v_out := v_out || jsonb_build_array(public.ikorun_race_upsert(r, 'import', p_dry) || jsonb_build_object('i', i));
    i := i + 1;
  end loop;
  return v_out;
end; $$;
revoke all on function public.ikorun_races_import(jsonb, boolean) from public, anon;
grant execute on function public.ikorun_races_import(jsonb, boolean) to authenticated;

-- ---------- propositions des coureurs et des clubs ----------
create table if not exists public.race_proposals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  club_id     uuid references public.clubs(id) on delete set null,
  data        jsonb not null check (jsonb_typeof(data) = 'object' and length(data::text) <= 4000),
  note        text check (note is null or length(note) <= 500),
  status      text not null default 'pending' check (status in ('pending','accepted','rejected')),
  review_note text check (review_note is null or length(review_note) <= 300),
  race_id     uuid references public.races(id) on delete set null,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists race_proposals_status_idx on public.race_proposals (status, created_at);
alter table public.race_proposals enable row level security;
alter table public.race_proposals force row level security;
drop policy if exists race_proposals_insert_own on public.race_proposals;
drop policy if exists race_proposals_select on public.race_proposals;
drop policy if exists race_proposals_delete_own on public.race_proposals;
create policy race_proposals_insert_own on public.race_proposals for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and race_id is null and reviewed_by is null and reviewed_at is null and review_note is null
              -- un invité (session anonyme) ne propose pas : il faut un vrai compte
              and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
create policy race_proposals_select on public.race_proposals for select to authenticated
  using (user_id = (select auth.uid()) or (select public.ikorun_is_app_admin()));
create policy race_proposals_delete_own on public.race_proposals for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');
revoke all on public.race_proposals from anon, authenticated;
grant select, insert, delete on public.race_proposals to authenticated;

-- 10 propositions par jour ; données contrôlées ; un club n'est cité que par son propriétaire
-- ou un de ses admins.
create or replace function public.ikorun_race_proposal_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_err text;
begin
  if not public.ikorun_check_rate_limit('race_proposal', 10, 86400) then raise exception 'rate_limited'; end if;
  v_err := public.ikorun_race_check(new.data);
  if v_err is not null then raise exception 'invalid_%', v_err; end if;
  if new.club_id is not null
     and not exists (select 1 from public.clubs c where c.id = new.club_id and c.owner_id = new.user_id)
     and not exists (select 1 from public.club_members m where m.club_id = new.club_id and m.user_id = new.user_id and m.role = 'admin') then
    raise exception 'not_club_admin';
  end if;
  new.created_at := now();
  return new;
end; $$;
revoke all on function public.ikorun_race_proposal_guard() from public, anon, authenticated;
drop trigger if exists race_proposal_guard on public.race_proposals;
create trigger race_proposal_guard before insert on public.race_proposals for each row execute function public.ikorun_race_proposal_guard();

-- Liste pour l'admin, avec le pseudo et le club (lecture seule).
create or replace function public.ikorun_race_proposals_pending()
returns table (id uuid, data jsonb, note text, created_at timestamptz, username text, club_name text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.ikorun_is_app_admin() then raise exception 'not_admin'; end if;
  return query select p.id, p.data, p.note, p.created_at, pp.username, c.name
    from public.race_proposals p
    left join public.public_profiles pp on pp.user_id = p.user_id
    left join public.clubs c on c.id = p.club_id
    where p.status = 'pending' order by p.created_at limit 200;
end; $$;
revoke all on function public.ikorun_race_proposals_pending() from public, anon;
grant execute on function public.ikorun_race_proposals_pending() to authenticated;

-- Validation : p_data permet à l'admin de corriger la proposition avant de l'accepter.
create or replace function public.ikorun_race_review(p_id uuid, p_accept boolean, p_note text default null, p_data jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_p public.race_proposals; v_r jsonb;
begin
  if not public.ikorun_is_app_admin() then raise exception 'not_admin'; end if;
  select * into v_p from public.race_proposals where id = p_id for update;
  if not found or v_p.status <> 'pending' then raise exception 'not_pending'; end if;
  if p_accept then
    v_r := public.ikorun_race_upsert(coalesce(p_data, v_p.data), 'proposal', false);
    if v_r->>'action' = 'invalid' then return v_r; end if;
    update public.race_proposals set status = 'accepted', race_id = (v_r->>'id')::uuid, reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(p_note, 300) where id = p_id;
    return v_r;
  end if;
  update public.race_proposals set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(p_note, 300) where id = p_id;
  return jsonb_build_object('action','rejected');
end; $$;
revoke all on function public.ikorun_race_review(uuid, boolean, text, jsonb) from public, anon;
grant execute on function public.ikorun_race_review(uuid, boolean, text, jsonb) to authenticated;

-- ---------- courses suivies (rappels J-30, J-7, veille) ----------
create table if not exists public.race_follows (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  race_id    uuid not null references public.races(id) on delete cascade,
  remind     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, race_id)
);
create index if not exists race_follows_race_idx on public.race_follows (race_id);
alter table public.race_follows enable row level security;
alter table public.race_follows force row level security;
drop policy if exists race_follows_own_select on public.race_follows;
drop policy if exists race_follows_own_insert on public.race_follows;
drop policy if exists race_follows_own_update on public.race_follows;
drop policy if exists race_follows_own_delete on public.race_follows;
create policy race_follows_own_select on public.race_follows for select to authenticated using (user_id = (select auth.uid()));
create policy race_follows_own_insert on public.race_follows for insert to authenticated with check (user_id = (select auth.uid()));
create policy race_follows_own_update on public.race_follows for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy race_follows_own_delete on public.race_follows for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.race_follows from anon, authenticated;
grant select, insert, update, delete on public.race_follows to authenticated;

create or replace function public.ikorun_race_follow_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.ikorun_check_rate_limit('race_follow', 120, 3600) then raise exception 'rate_limited'; end if;
  if tg_op = 'INSERT' and (select count(*) from public.race_follows where user_id = new.user_id) >= 50 then raise exception 'too_many'; end if;
  return new;
end; $$;
revoke all on function public.ikorun_race_follow_guard() from public, anon, authenticated;
drop trigger if exists race_follow_guard on public.race_follows;
create trigger race_follow_guard before insert or update on public.race_follows for each row execute function public.ikorun_race_follow_guard();

create table if not exists public.race_reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  race_id uuid not null references public.races(id) on delete cascade,
  kind    text not null check (kind in ('j30','j7','j1')),
  sent_at timestamptz not null default now(),
  primary key (user_id, race_id, kind)
);
comment on table public.race_reminder_log is 'Rappels de course déjà envoyés (Edge Function send-race-reminders, service_role). RLS sans policy : inaccessible aux clients.';
alter table public.race_reminder_log enable row level security;
alter table public.race_reminder_log force row level security;
revoke all on public.race_reminder_log from anon, authenticated;

-- ---------- rappels : la fonction planifiée est ajoutée à la liste autorisée ----------
create or replace function public.ikorun_trigger_cron(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
  v_anon text;
  v_url text;
begin
  select value into v_secret from public.app_secrets where key = 'CRON_SECRET';
  select value into v_anon   from public.app_secrets where key = 'SUPABASE_ANON_KEY';
  if v_secret is null or v_anon is null then
    raise exception 'app_secrets incomplet';
  end if;
  if p_slug not in ('send-prayer-notifs','send-daily-reminders','send-social-notifs','send-race-reminders') then
    raise exception 'slug non autorisé: %', p_slug;
  end if;
  v_url := 'https://bsrbzuhvqtjkkmpmxyzw.supabase.co/functions/v1/' || p_slug;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || v_anon,
      'x-ikorun-cron', v_secret
    ),
    body := '{}'::jsonb
  );
end;
$$;
revoke all on function public.ikorun_trigger_cron(text) from public, anon, authenticated;

-- 9 h en Algérie (UTC+1) chaque jour.
select cron.unschedule('send-race-reminders-9h') where exists (select 1 from cron.job where jobname = 'send-race-reminders-9h');
select cron.schedule('send-race-reminders-9h', '0 8 * * *', $$select public.ikorun_trigger_cron('send-race-reminders');$$);
