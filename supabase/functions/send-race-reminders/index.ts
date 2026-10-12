// IKORUN V4.0.0 — Rappels de course : J-30, J-7 et la veille, à 9 h (heure d'Algérie).
// Appelée chaque jour par pg_cron (job send-race-reminders-9h → ikorun_trigger_cron), protégée
// par le secret partagé du cron (x-ikorun-cron), comme les autres fonctions planifiées.
// Ne lit que des données publiques (la course) et la liste « courses suivies » de chacun :
// aucune donnée d'entraînement ne sort du stockage chiffré de l'app.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Secrets (VAPID, cron) dans public.app_secrets : RLS sans policy, lisible par le service_role seul.
const { data: secretRows, error: secretErr } = await supa.from("app_secrets").select("key, value");
if (secretErr) throw new Error("secrets_unavailable: " + secretErr.message);
const SECRET: Record<string, string> = {};
(secretRows || []).forEach((r: any) => { SECRET[r.key] = r.value; });
webpush.setVapidDetails("mailto:ikorunn@gmail.com", SECRET.VAPID_PUBLIC_KEY, SECRET.VAPID_PRIVATE_KEY);
const CRON_SECRET = SECRET.CRON_SECRET;

function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Algérie = UTC+1 toute l'année.
function algeriaKey(offsetDays: number): string {
  const d = new Date(Date.now() + 3600 * 1000 + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

type Kind = "j30" | "j7" | "j1";
// Textes par langue — mêmes formulations que l'app (clés raceRem* dans app.js).
const TXT: Record<string, Record<Kind, { title: (n: string) => string; body: (c: string) => string }>> = {
  fr: {
    j30: { title: (n) => `Dans 30 jours : ${n}`, body: (c) => `${c} · Il reste un mois : c'est le moment de caler ton plan sur cette course.` },
    j7:  { title: (n) => `Dans 7 jours : ${n}`,  body: (c) => `${c} · Dernière semaine : vérifie ton inscription et récupère ton dossard.` },
    j1:  { title: (n) => `Demain : ${n}`,        body: (c) => `${c} · Prépare tes affaires ce soir, bois bien et couche-toi tôt.` },
  },
  en: {
    j30: { title: (n) => `In 30 days: ${n}`, body: (c) => `${c} · One month to go: time to set your plan for this race.` },
    j7:  { title: (n) => `In 7 days: ${n}`,  body: (c) => `${c} · Final week: check your registration and pick up your bib.` },
    j1:  { title: (n) => `Tomorrow: ${n}`,   body: (c) => `${c} · Lay out your kit tonight, drink well and get to bed early.` },
  },
  ar: {
    j30: { title: (n) => `بعد 30 يومًا: ${n}`, body: (c) => `${c} · بقي شهر: حان وقت ضبط خطتك على هذا السباق.` },
    j7:  { title: (n) => `بعد 7 أيام: ${n}`,   body: (c) => `${c} · الأسبوع الأخير: تأكد من تسجيلك واستلم رقمك.` },
    j1:  { title: (n) => `غدًا: ${n}`,          body: (c) => `${c} · جهّز أغراضك الليلة، واشرب جيدًا ونم باكرًا.` },
  },
};
// La veille, la notification reste utile jusqu'au soir ; J-30 et J-7 : une journée.
const TTL: Record<Kind, number> = { j30: 86400, j7: 86400, j1: 14 * 3600 };

Deno.serve(async (req: Request) => {
  if (!safeEqual(req.headers.get("x-ikorun-cron") || "", CRON_SECRET)) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }
  const targets: Record<string, Kind> = { [algeriaKey(30)]: "j30", [algeriaKey(7)]: "j7", [algeriaKey(1)]: "j1" };
  const { data: races, error: rErr } = await supa.from("races")
    .select("id, name, city, date").in("date", Object.keys(targets)).eq("status", "published");
  if (rErr) return new Response(JSON.stringify({ error: rErr.message }), { status: 500 });
  if (!races || !races.length) return new Response(JSON.stringify({ sent: 0, reason: "no-race" }), { headers: { "Content-Type": "application/json" } });

  const raceById: Record<string, any> = {};
  races.forEach((r: any) => { raceById[r.id] = r; });
  const { data: follows, error: fErr } = await supa.from("race_follows")
    .select("user_id, race_id").in("race_id", races.map((r: any) => r.id)).eq("remind", true);
  if (fErr) return new Response(JSON.stringify({ error: fErr.message }), { status: 500 });
  if (!follows || !follows.length) return new Response(JSON.stringify({ sent: 0, reason: "no-follower" }), { headers: { "Content-Type": "application/json" } });

  // déjà envoyé (relance du cron, deux appels le même jour) : on saute
  const { data: done } = await supa.from("race_reminder_log")
    .select("user_id, race_id, kind").in("race_id", races.map((r: any) => r.id));
  const seen = new Set((done || []).map((d: any) => d.user_id + "|" + d.race_id + "|" + d.kind));
  const todo = follows.filter((f: any) => !seen.has(f.user_id + "|" + f.race_id + "|" + targets[raceById[f.race_id].date]));
  if (!todo.length) return new Response(JSON.stringify({ sent: 0, reason: "already-sent" }), { headers: { "Content-Type": "application/json" } });

  const { data: subs, error: sErr } = await supa.from("push_subscriptions")
    .select("*").in("user_id", [...new Set(todo.map((f: any) => f.user_id))]).eq("reminder_enabled", true);
  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500 });

  let sent = 0, removed = 0;
  const logged: any[] = [];
  await Promise.allSettled(todo.map(async (f: any) => {
    const race = raceById[f.race_id], kind = targets[race.date];
    const mine = (subs || []).filter((s: any) => s.user_id === f.user_id);
    let ok = false;
    for (const s of mine) {
      const loc = (TXT[s.lang] || TXT.fr)[kind];
      const payload = JSON.stringify({ title: loc.title(race.name), body: loc.body(race.city), tag: "ikorun-race-" + race.id, open: "race:" + race.id });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: TTL[kind], urgency: "normal" });
        sent++; ok = true;
      } catch (err: any) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) { await supa.from("push_subscriptions").delete().eq("id", s.id); removed++; }
      }
    }
    if (ok) logged.push({ user_id: f.user_id, race_id: f.race_id, kind });
  }));
  if (logged.length) await supa.from("race_reminder_log").upsert(logged, { onConflict: "user_id,race_id,kind", ignoreDuplicates: true });
  return new Response(JSON.stringify({ sent, removed, candidates: todo.length }), { headers: { "Content-Type": "application/json" } });
});
