/* Initialisation du client Supabase — sortie du <script> en ligne d'index.html le
   25/09 pour pouvoir charger supabase.js, ce fichier et app.js en `defer` : ils
   s'exécutent dans cet ordre, APRÈS le premier affichage (intro du logo), au lieu
   de retenir l'écran noir le temps de lire ~1,3 Mo de JavaScript. */
try{
  window.supabaseClient = supabase.createClient(
    'https://bsrbzuhvqtjkkmpmxyzw.supabase.co',
    'sb_publishable_d1eInkDkCJG-Fx4S8UqNgw_Bm6uQuKw',
    { auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } }
  );
}catch(e){
  console.error('[IKORUN] Le script Supabase n\'a pas pu s\'initialiser.', e);
}
// Le try/catch ci-dessus n'attrape que l'échec de createClient() — si supabase.js
// lui-même ne charge pas, aucune erreur n'est levée ici : window.supabaseClient
// reste simplement indéfini et chaque fonction qui le vérifie ("if(!window.supabaseClient)
// return") s'arrêterait en silence. On affiche donc un message clair.
if(!window.supabaseClient){
  document.addEventListener('DOMContentLoaded',()=>{
    const b=document.body;
    if(b) b.insertAdjacentHTML('afterbegin','<div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#E0394A;color:#fff;padding:12px 16px;font:600 13px/1.4 system-ui,sans-serif;text-align:center">Connexion au serveur impossible. Vérifie ta connexion et recharge la page.</div>');
  });
}
