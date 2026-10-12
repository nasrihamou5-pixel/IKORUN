-- IKORUN V4.0.0 — Statut d'entraînement partagé avec le club (moteur d'adaptation)
-- ---------------------------------------------------------------------------
-- Chaque athlète peut, s'il le veut (share_club), montrer aux encadrants de ses clubs
-- (propriétaire et admins) : charge aiguë/chronique, ACWR, monotonie, forme du jour et
-- « douleur oui/non ». La zone et l'intensité de la douleur ne sont visibles que s'il a
-- AUSSI accepté le détail (share_detail). Sans consentement, aucune ligne n'est envoyée.
-- RLS : chacun ne lit et n'écrit QUE sa propre ligne ; les encadrants passent par la
-- fonction ikorun_club_member_status, qui vérifie leur rôle et filtre le consentement.
-- ---------------------------------------------------------------------------
create table if not exists public.athlete_status (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  share_club   boolean not null default false,
  share_detail boolean not null default false,
  acute        numeric(7,1)  check (acute   is null or (acute   >= 0 and acute   <= 5000)),
  chronic      numeric(7,1)  check (chronic is null or (chronic >= 0 and chronic <= 5000)),
  acwr         numeric(4,2)  check (acwr    is null or (acwr    >= 0 and acwr    <= 20)),
  monotony     numeric(4,1)  check (monotony is null or (monotony >= 0 and monotony <= 50)),
  readiness    smallint      check (readiness is null or (readiness between 0 and 100)),
  pain_on      boolean not null default false,
  pain_zone    text          check (pain_zone is null or pain_zone ~ '^[a-zA-Z]{2,12}(_[LR])?$'),
  pain_level   smallint      check (pain_level is null or (pain_level between 0 and 10)),
  updated_at   timestamptz not null default now()
);
comment on table public.athlete_status is 'Charge, forme et douleur oui/non partagées avec les encadrants des clubs (consentement share_club ; détail de la douleur seulement si share_detail).';

alter table public.athlete_status enable row level security;
alter table public.athlete_status force row level security;

drop policy if exists athlete_status_select_own on public.athlete_status;
drop policy if exists athlete_status_insert_own on public.athlete_status;
drop policy if exists athlete_status_update_own on public.athlete_status;
drop policy if exists athlete_status_delete_own on public.athlete_status;
create policy athlete_status_select_own on public.athlete_status for select to authenticated using (user_id = (select auth.uid()));
create policy athlete_status_insert_own on public.athlete_status for insert to authenticated with check (user_id = (select auth.uid()));
create policy athlete_status_update_own on public.athlete_status for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy athlete_status_delete_own on public.athlete_status for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.athlete_status from anon;
grant select, insert, update, delete on public.athlete_status to authenticated;

-- Écritures limitées : 120 par heure (un bilan, un check du matin, un changement de jour…),
-- la date de mise à jour est toujours celle du serveur, et le détail de la douleur est
-- effacé si l'athlète ne l'a pas accepté.
create or replace function public.ikorun_athlete_status_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.ikorun_check_rate_limit('athlete_status', 120, 3600) then
    raise exception 'rate_limited';
  end if;
  new.updated_at := now();
  if not new.share_detail then new.pain_zone := null; new.pain_level := null; end if;
  if not new.pain_on then new.pain_zone := null; new.pain_level := null; end if;
  return new;
end; $$;
revoke all on function public.ikorun_athlete_status_guard() from public, anon, authenticated;
drop trigger if exists athlete_status_guard on public.athlete_status;
create trigger athlete_status_guard before insert or update on public.athlete_status
  for each row execute function public.ikorun_athlete_status_guard();

-- Tableau de bord du club : réservé au propriétaire et aux admins de CE club.
create or replace function public.ikorun_club_member_status(p_club_id uuid)
returns table (user_id uuid, username text, acute numeric, chronic numeric, acwr numeric, monotony numeric,
               readiness smallint, pain_on boolean, pain_zone text, pain_level smallint, updated_at timestamptz)
language plpgsql security definer set search_path = public stable as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.clubs c where c.id = p_club_id and c.owner_id = v_uid)
     and not exists (select 1 from public.club_members m where m.club_id = p_club_id and m.user_id = v_uid and m.role = 'admin') then
    raise exception 'not_admin';
  end if;
  return query
    select s.user_id, p.username, s.acute, s.chronic, s.acwr, s.monotony, s.readiness, s.pain_on,
           case when s.share_detail then s.pain_zone end, case when s.share_detail then s.pain_level end, s.updated_at
    from public.club_members m
    join public.athlete_status s on s.user_id = m.user_id and s.share_club
    left join public.public_profiles p on p.user_id = m.user_id
    where m.club_id = p_club_id and m.user_id <> v_uid
    order by s.updated_at desc;
end; $$;
revoke all on function public.ikorun_club_member_status(uuid) from public, anon;
grant execute on function public.ikorun_club_member_status(uuid) to authenticated;
