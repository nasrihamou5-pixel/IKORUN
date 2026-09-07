-- ============================================================================
-- IKORUN — TESTS DE SÉCURITÉ DE LA BASE
--
-- À rejouer après toute modification du schéma, des policies ou des fonctions.
-- Où : tableau de bord Supabase -> SQL Editor -> coller -> Run.
-- Lecture : toute ligne "ECHEC" est à traiter. Zéro ECHEC = tout est en place.
--
-- Ce script ne modifie RIEN. Il ne lit que le catalogue système et tente des
-- lectures sous les rôles anon / authenticated pour vérifier ce qu'ils voient.
--
-- Chaque test encode une décision prise et vérifiée à un moment donné. Si un
-- test échoue après un changement, c'est soit une régression, soit la décision
-- qui a changé — dans ce cas, mettre le test à jour EN MÊME TEMPS.
-- ============================================================================

-- Sonde : exécute une requête sous un rôle donné et rapporte le résultat.
create or replace function pg_temp.probe(p_role text, p_sql text) returns text
language plpgsql as $$
declare n int; msg text;
begin
  execute format('set local role %I', p_role);
  execute p_sql into n;
  execute 'reset role';
  return 'LISIBLE:'||n;
exception when others then
  get stacked diagnostics msg = MESSAGE_TEXT;
  begin execute 'reset role'; exception when others then end;
  return 'REFUSE:'||msg;
end $$;

with

-- 1 ─ RLS active sur toutes les tables applicatives -------------------------
t_rls as (
  select '1. RLS' as categorie,
         'RLS activée sur public.'||c.relname as test,
         case when c.relrowsecurity then 'OK' else 'ECHEC' end as resultat,
         case when c.relrowsecurity then '' else 'table lisible sans restriction' end as detail
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname='public' and c.relkind='r'
),

-- 2 ─ Chaque table a au moins une policy SELECT ------------------------------
t_pol_select as (
  select '2. Policies' as categorie,
         'policy SELECT définie sur '||c.relname as test,
         case when exists (
           select 1 from pg_policies p
           where p.schemaname='public' and p.tablename=c.relname
             and p.cmd in ('SELECT','ALL')
         ) then 'OK' else 'ECHEC' end as resultat,
         '' as detail
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
),

-- 3 ─ Aucune policy ouverte à tous (qual = true) ----------------------------
--     C'est exactement la faille trouvée sur public_profiles : une policy
--     "using (true)" rendait tous les profils aspirables par n'importe quel
--     compte connecté.
t_pol_ouverte as (
  select '3. Policies' as categorie,
         'aucune policy ouverte à tous ('||p.tablename||'.'||p.policyname||')' as test,
         case when coalesce(btrim(p.qual),'') in ('true','(true)') then 'ECHEC' else 'OK' end as resultat,
         case when coalesce(btrim(p.qual),'') in ('true','(true)')
              then 'policy sans condition : lisible par tout le rôle visé' else '' end as detail
  from pg_policies p
  where p.schemaname='public' and p.cmd in ('SELECT','ALL')
),

-- 4 ─ Fonctions SECURITY DEFINER : search_path figé -------------------------
--     Sans SET search_path, un schéma pirate en tête de chemin peut détourner
--     les appels internes de la fonction, qui tourne avec les droits du
--     propriétaire.
t_searchpath as (
  select '4. Fonctions' as categorie,
         'search_path figé sur '||p.proname as test,
         case when exists (
           select 1 from unnest(coalesce(p.proconfig,'{}')) cfg where cfg like 'search_path=%'
         ) then 'OK' else 'ECHEC' end as resultat,
         '' as detail
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
),

-- 5 ─ Aucune fonction SECURITY DEFINER exécutable sans être connecté --------
--     Six fonctions club/profil sont restées dans ce cas jusqu'au 7/9/2026.
--     Chacune se protégeait en interne, mais le droit n'avait pas à exister.
t_acl_anon as (
  select '5. Droits' as categorie,
         'non exécutable par anon/PUBLIC : '||p.proname as test,
         case when has_function_privilege('anon', p.oid, 'EXECUTE') then 'ECHEC' else 'OK' end as resultat,
         case when has_function_privilege('anon', p.oid, 'EXECUTE')
              then 'appelable via /rest/v1/rpc/ sans session' else '' end as detail
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prosecdef
),

-- 6 ─ Fonctions internes : réservées au service ------------------------------
--     Générateur de code de club, déclencheurs, compteur anti-abus : jamais
--     appelables depuis un client.
t_acl_internes as (
  select '6. Droits' as categorie,
         'réservée au service : '||p.proname as test,
         case when has_function_privilege('authenticated', p.oid, 'EXECUTE')
                or has_function_privilege('anon', p.oid, 'EXECUTE')
              then 'ECHEC' else 'OK' end as resultat,
         '' as detail
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname in ('ikorun_generate_club_code','ikorun_check_rate_limit',
                      'ikorun_limit_user_data_rows','ikorun_validate_user_data',
                      'ikorun_enforce_profile_stats','ikorun_enforce_friendship_insert',
                      'ikorun_enforce_friendship_update','ikorun_enforce_friend_request_rate')
),

-- 7 ─ Un visiteur non connecté ne lit aucune donnée utilisateur --------------
t_anon_lecture as (
  select '7. Rôle anon' as categorie,
         'anon ne lit rien dans '||tbl as test,
         case when pg_temp.probe('anon','select count(*) from public.'||tbl) like 'REFUSE:%' then 'OK'
              when pg_temp.probe('anon','select count(*) from public.'||tbl) = 'LISIBLE:0' then 'OK'
              else 'ECHEC' end as resultat,
         pg_temp.probe('anon','select count(*) from public.'||tbl) as detail
  from unnest(array['user_data','public_profiles','friendships','clubs','club_members',
                    'push_subscriptions','daily_reminder_state','rate_limits']) as tbl
),

-- 8 ─ Le compteur anti-abus est hors de portée des clients -------------------
t_ratelimits as (
  select '8. Anti-abus' as categorie,
         'rate_limits inaccessible au rôle '||r as test,
         case when pg_temp.probe(r,'select count(*) from public.rate_limits') like 'REFUSE:%'
               or pg_temp.probe(r,'select count(*) from public.rate_limits') = 'LISIBLE:0'
              then 'OK' else 'ECHEC' end as resultat,
         pg_temp.probe(r,'select count(*) from public.rate_limits') as detail
  from unnest(array['anon','authenticated']) as r
),

-- 9 ─ Index attendus sur les chemins chauds ---------------------------------
t_index as (
  select '9. Performance' as categorie,
         'index présent : '||idx as test,
         case when exists (select 1 from pg_indexes where schemaname='public' and indexname=idx)
              then 'OK' else 'ECHEC' end as resultat,
         '' as detail
  from unnest(array['idx_public_profiles_xp','idx_daily_reminder_pending','idx_push_prayer_enabled']) as idx
),

-- 10 ─ Tables sensibles : policy DELETE présente ----------------------------
--      Sans DELETE, l'utilisateur ne peut pas exercer son droit d'effacement.
t_delete as (
  select '10. RGPD' as categorie,
         'policy DELETE (droit à l''effacement) sur '||tbl as test,
         case when exists (
           select 1 from pg_policies p
           where p.schemaname='public' and p.tablename=tbl and p.cmd in ('DELETE','ALL')
         ) then 'OK' else 'ECHEC' end as resultat,
         '' as detail
  from unnest(array['user_data','public_profiles','push_subscriptions','daily_reminder_state']) as tbl
),

tous as (
  select * from t_rls
  union all select * from t_pol_select
  union all select * from t_pol_ouverte
  union all select * from t_searchpath
  union all select * from t_acl_anon
  union all select * from t_acl_internes
  union all select * from t_anon_lecture
  union all select * from t_ratelimits
  union all select * from t_index
  union all select * from t_delete
)

select
  case when resultat='ECHEC' then '>>> ECHEC' else 'ok' end as etat,
  categorie, test, detail
from tous
order by (resultat='ECHEC') desc, categorie, test;
