-- ============================================================================
-- IKORUN — audit de sécurité de la base Supabase.
-- À coller dans le SQL Editor du projet (bsrbzuhvqtjkkmpmxyzw) et à rejouer
-- après toute migration touchant les tables, policies ou fonctions RPC.
-- Chaque bloc doit renvoyer un résultat VIDE (sinon, il y a quelque chose à
-- regarder) — sauf mention contraire dans son commentaire.
-- Audit du 29/09/2026 : voir le résumé donné à l'utilisateur pour l'état des
-- lieux à cette date (RLS complet, fonctions SECURITY DEFINER toutes bornées
-- à auth.uid(), secrets des Edge Functions à sortir du code — seul point
-- réellement actionnable relevé).
-- ============================================================================

-- 1) Toute table de public doit avoir RLS activé. Résultat vide = OK.
select schemaname, tablename
from pg_tables
where schemaname = 'public'
  and not rowsecurity;

-- 2) Table avec RLS activé mais AUCUNE policy : personne (pas même le
--    propriétaire authentifié) ne peut la lire/écrire via l'API — c'est donc
--    fail-closed, jamais une fuite. Normal pour une table alimentée uniquement
--    par les Edge Functions (service_role, qui contourne RLS). À vérifier au
--    cas par cas si une table apparaît ici sans que ce soit voulu.
select t.tablename
from pg_tables t
where t.schemaname = 'public' and t.rowsecurity
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = t.schemaname and p.tablename = t.tablename
  );

-- 3) Toutes les policies de public, pour relecture manuelle : chaque `qual`/
--    `with_check` scopé sur une table qui contient des données par personne
--    (user_data, public_profiles, push_subscriptions, daily_reminder_state,
--    friendships, club_members, clubs) doit obligatoirement comparer une
--    colonne à `auth.uid()` (directement, via une jointure vers une ligne qui
--    appartient à l'appelant, ou via une fonction SECURITY DEFINER qui le
--    fait). Une ligne avec qual = 'true' (accès total) sur une de ces tables
--    est une fuite immédiate.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;

-- 4) Policies dangereusement permissives : qual/with_check vide ou "true"
--    littéral sur une commande autre que INSERT-avec-check-explicite. Résultat
--    vide = OK.
select tablename, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and (qual = 'true' or with_check = 'true');

-- 5) Fonctions SECURITY DEFINER exposées en RPC (callables par le client) :
--    à relire une par une après toute modification. Chacune DOIT commencer
--    par vérifier auth.uid() (non nul, et égal au paramètre visé quand l'appel
--    agit sur un compte précis) avant de lire ou écrire quoi que ce soit.
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef  -- SECURITY DEFINER
  and exists (
    select 1 from information_schema.routine_privileges rp
    where rp.routine_schema = 'public' and rp.routine_name = p.proname
      and rp.grantee in ('anon','authenticated')
  )
order by p.proname;

-- 6) Fonctions SECURITY DEFINER (donc capables de contourner RLS) exécutables
--    par `anon` (utilisateur PAS connecté, pas même en invité) : à examiner
--    avec la plus grande attention, résultat attendu vide dans IKORUN (même
--    les comptes invités passent par `authenticated`, jamais `anon`, une fois
--    la session ouverte). Note : des fonctions pures sans SECURITY DEFINER
--    (ikorun_try_num, ikorun_level_from_xp…) apparaissent normalement en
--    `anon` ailleurs — elles ne touchent aucune table et ne sont pas un
--    risque ; ce bloc les exclut expressément.
--    (Le 04/10 : ikorun_trigger_cron y apparaissait — n'importe qui pouvait
--    relancer les envois push via /rest/v1/rpc. EXECUTE retiré à public, anon
--    et authenticated : seul pg_cron, qui tourne en postgres, l'appelle.)
select rp.routine_name, rp.grantee
from information_schema.routine_privileges rp
join pg_proc p on p.proname = rp.routine_name
join pg_namespace n on n.oid = p.pronamespace and n.nspname = rp.routine_schema
where rp.routine_schema = 'public' and rp.grantee = 'anon' and p.prosecdef;

-- 7) Colonnes texte librement saisissables par l'utilisateur, sans aucune
--    contrainte de forme ni de taille (CHECK) : à croiser avec le code client
--    pour confirmer qu'elles passent par escHtml() avant tout innerHTML.
--    (Le 29/09 : shared_plan/meetup des clubs, texte libre sans CHECK au
--    niveau colonne — mais validés par ikorun_set_club_plan et échappés côté
--    client ; voir clubPlanHTML()/renderClubTab() dans app.js.)
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public' and data_type in ('text','jsonb')
  and table_name not in ('rate_limits')
order by table_name, column_name;

-- 8) Extensions installées dans le schéma public (à déplacer si possible ;
--    pg_net y est toléré chez Supabase pour permettre au cron d'appeler les
--    Edge Functions — c'est un avertissement de linter, pas une fuite tant que
--    ses fonctions restent réservées à service_role/postgres, voir bloc 9).
select extname, extnamespace::regnamespace as schema
from pg_extension
where extnamespace::regnamespace::text = 'public';

-- 9) Qui peut exécuter les fonctions pg_net (envoi de requêtes HTTP sortantes
--    depuis la base — un risque de SSRF si un rôle client peut les appeler) ?
--    pg_net s'installe avec EXECUTE accordé à PUBLIC par défaut : ce résultat
--    n'est PAS vide, et c'est normal — ce qui compte est que le schéma `net`
--    ne soit pas dans les schémas exposés par l'API (Dashboard › Settings ›
--    API › Exposed schemas, doit rester "public" seul, jamais "net") ET
--    qu'aucune fonction de `public` accessible au client n'appelle
--    net.http_* avec une URL ou des en-têtes venant d'un paramètre non
--    contrôlé. Vérifié à la main le 29/09 sur les fonctions publiques
--    existantes : aucune ne le fait.
select p.proname, rp.grantee
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join information_schema.routine_privileges rp
  on rp.routine_schema = n.nspname and rp.routine_name = p.proname
where n.nspname = 'net'
order by p.proname, rp.grantee;

-- 10) Comptes créés récemment vs abonnements push actifs — une divergence
--     énorme peut signaler un abus (création de comptes en masse). Purement
--     informatif, pas un verdict en soi.
select date_trunc('day', created_at) as jour, count(*) as comptes_crees
from auth.users
where created_at > now() - interval '30 days'
group by 1 order by 1 desc;
