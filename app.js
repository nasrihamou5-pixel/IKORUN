/* ============ IKORUN — Elite Athletic Intelligence ============ */

/* ---------- CLOUD SYNC (Supabase) ---------- */
window.currentUserId = null;
window.currentUserEmail = null;

const VVV_ARRAY_KEYS = ['sessions','muscu_sessions','records','weightlog','sesslog','agenda','custom_progs'];
// Clés d'état "séance en cours" : purement locales, JAMAIS envoyées/lues sur le cloud.
// Avant, elles étaient synchronisées comme le reste → si le push de suppression (cloudPush(k,null))
// n'avait pas le temps de partir (app fermée/mise en veille juste après "Terminer"), l'ancienne
// séance restait en base côté cloud et revenait "ressusciter" en local au prochain cloudPullAll(),
// d'où le popup "Reprendre ?" qui réapparaissait sans cesse. On les sort entièrement du circuit.
const VVV_LOCAL_ONLY_KEYS = ['live_active','live_paused'];

function mergeStorageValue(key, localVal, cloudVal){
  if(VVV_ARRAY_KEYS.includes(key)){
    if(!Array.isArray(localVal)) return cloudVal || [];
    if(!Array.isArray(cloudVal)) return localVal || [];
    const seen = new Set(); const merged = [];
    [...cloudVal, ...localVal].forEach(item=>{
      const sig = item && (item.id || (item.date && (item.type||'')) || JSON.stringify(item));
      if(!seen.has(sig)){ seen.add(sig); merged.push(item); }
    });
    return merged;
  }
  if(cloudVal===null || cloudVal===undefined) return localVal;
  if(localVal===null || localVal===undefined) return cloudVal;
  return cloudVal;
}

async function cloudPullAll(uid){
  if(!window.supabaseClient) return;
  try{
    const { data, error } = await window.supabaseClient.from('user_data').select('key,value').eq('user_id', uid);
    if(error){ console.error('cloud pull error', error); return; }
    if(!data) return;
    data.forEach(row => {
      if(VVV_LOCAL_ONLY_KEYS.includes(row.key)){
        // Nettoyage définitif d'une éventuelle séance fantôme laissée avant ce correctif.
        window.supabaseClient.from('user_data').delete().eq('user_id', uid).eq('key', row.key).then(()=>{}).catch(()=>{});
        return; // on ne rapatrie jamais ces clés depuis le cloud
      }
      let localVal = null;
      try{ const raw = localStorage.getItem('vvv_'+row.key); localVal = raw ? JSON.parse(raw) : null; }catch(e){}
      const merged = mergeStorageValue(row.key, localVal, row.value);
      localStorage.setItem('vvv_'+row.key, JSON.stringify(merged));
    });
  }catch(e){ console.error('cloud pull exception', e); }
}

async function cloudPush(key, value){
  if(VVV_LOCAL_ONLY_KEYS.includes(key)) return; // état de séance en cours : jamais envoyé au cloud
  if(!window.supabaseClient || !window.currentUserId) return;
  try{
    await window.supabaseClient.from('user_data').upsert(
      { user_id: window.currentUserId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );
  }catch(e){ console.error('cloud push error', e); }
}

function signInWithGoogle(){
  if(!window.supabaseClient) return;
  window.supabaseClient.auth.signInWithOAuth({
    provider:'google',
    options:{ redirectTo: window.location.href }
  });
}

function signOutUser(){
  if(!confirm('Se déconnecter ? Tes données restent sauvegardées sur ton compte.')) return;
  if(window.supabaseClient) window.supabaseClient.auth.signOut();
  else location.reload();
}

function addAnotherAccount(){
  if(!confirm('Tu vas être déconnecté(e) pour te reconnecter avec un autre compte Google. Tes données actuelles restent sauvegardées.')) return;
  if(window.supabaseClient) window.supabaseClient.auth.signOut();
  else location.reload();
}

async function deleteAccountCompletely(){
  if(!confirm('⚠️ Cette action va supprimer TOUTES tes données (séances, records, XP, profil...) de façon définitive, sur le cloud et sur cet appareil. Continuer ?')) return;
  if(!confirm('Dernière confirmation : es-tu vraiment sûr(e) ? Cette action est irréversible.')) return;
  try{
    if(window.supabaseClient && window.currentUserId){
      await window.supabaseClient.from('user_data').delete().eq('user_id', window.currentUserId);
    }
  }catch(e){ console.error('delete account data error', e); }
  Object.keys(localStorage).filter(k=>k.startsWith('vvv_')).forEach(k=>localStorage.removeItem(k));
  if(window.supabaseClient) await window.supabaseClient.auth.signOut();
  location.reload();
}

/* ---------- AMIS / CLASSEMENT / PARRAINAGE / PARTAGE ---------- */
function genReferralCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c=''; for(let i=0;i<6;i++) c+=chars[Math.floor(Math.random()*chars.length)];
  return c;
}
async function ensurePublicProfile(){
  if(!window.supabaseClient || !window.currentUserId) return;
  try{
    const { data } = await window.supabaseClient.from('public_profiles').select('user_id').eq('user_id',window.currentUserId).maybeSingle();
    if(!data){
      // pseudo technique unique par défaut (ex: athlete_1a2b3c4d) tant que l'utilisateur
      // n'a pas encore validé son vrai nom d'utilisateur unique.
      const placeholder='athlete_'+String(window.currentUserId).replace(/-/g,'').slice(0,10);
      let code=genReferralCode(), tries=0, ok=false;
      while(tries<5 && !ok){
        const { error } = await window.supabaseClient.from('public_profiles').insert({
          user_id:window.currentUserId, username:(P.username||placeholder), username_set:!!P.username, referral_code:code
        });
        if(!error) ok=true; else { code=genReferralCode(); tries++; }
      }
    }
  }catch(e){ console.error('ensurePublicProfile error', e); }
}
async function syncPublicProfile(){
  if(!window.supabaseClient || !window.currentUserId) return;
  try{
    // Le pseudo n'est JAMAIS écrasé ici : il est géré uniquement via claimUsername()
    // pour garantir son unicité (onboarding + modification dans le profil).
    await window.supabaseClient.from('public_profiles').update({
      xp: (XP&&XP.total)||0,
      level: (XP&&XP.level)||1,
      km_week: Math.round((kmThisWeek()||0)*10)/10,
      sessions_week: runCountWeek()+muscuCountWeek(),
      updated_at: new Date().toISOString()
    }).eq('user_id', window.currentUserId);
  }catch(e){ /* silencieux : pas bloquant pour l'app */ }
}
/* ---------- Nom d'utilisateur unique (vérif en direct + réservation) ---------- */
function usernameFormatOk(v){ return /^[a-zA-Z0-9_]{3,20}$/.test(v||''); }
let _unameSeq=0;
async function checkUsernameLive(rawValue, statusEl, inputEl){
  const seq=++_unameSeq;
  const v=(rawValue||'').trim();
  inputEl && inputEl.classList.remove('uname-ok','uname-bad');
  if(!v){ if(statusEl){ statusEl.textContent="3 à 20 caractères : lettres, chiffres, _"; statusEl.className='uname-status'; } return false; }
  if(!usernameFormatOk(v)){
    if(statusEl){ statusEl.textContent='✕ 3 à 20 caractères : lettres, chiffres, _'; statusEl.className='uname-status bad'; }
    inputEl && inputEl.classList.add('uname-bad');
    return false;
  }
  if(statusEl){ statusEl.textContent='Vérification…'; statusEl.className='uname-status checking'; }
  if(!window.supabaseClient){
    if(statusEl){ statusEl.textContent='✓ Disponible'; statusEl.className='uname-status ok'; }
    inputEl && inputEl.classList.add('uname-ok');
    return true;
  }
  try{
    let q=window.supabaseClient.from('public_profiles').select('user_id').eq('username_lower',v.toLowerCase()).limit(1);
    if(window.currentUserId) q=q.neq('user_id',window.currentUserId);
    const { data } = await q.maybeSingle();
    if(seq!==_unameSeq) return false; // réponse obsolète (l'utilisateur a retapé entre temps)
    if(data){
      if(statusEl){ statusEl.textContent='✕ Déjà pris'; statusEl.className='uname-status bad'; }
      inputEl && inputEl.classList.add('uname-bad');
      return false;
    }
    if(statusEl){ statusEl.textContent='✓ Disponible'; statusEl.className='uname-status ok'; }
    inputEl && inputEl.classList.add('uname-ok');
    return true;
  }catch(e){
    if(statusEl){ statusEl.textContent=''; statusEl.className='uname-status'; }
    return false;
  }
}
function wireUsernameField(inputId, statusId, onResult){
  const inp=$('#'+inputId), st=$('#'+statusId); if(!inp||!st) return;
  let deb=null;
  inp.addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const ok=await checkUsernameLive(inp.value, st, inp);
      if(onResult) onResult(ok);
    },400);
  });
}
// Réserve/renomme le pseudo côté serveur de façon atomique (source de vérité anti-doublon)
async function claimUsername(username){
  if(!window.supabaseClient || !window.currentUserId) { P.username=username; return true; }
  try{
    const { data, error } = await window.supabaseClient.rpc('claim_username',{ p_uid:window.currentUserId, p_username:username });
    if(error || !data) return false;
    P.username=username; return true;
  }catch(e){ return false; }
}
let _myRefCodeCache=null;
async function myReferralCode(){
  if(_myRefCodeCache) return _myRefCodeCache;
  if(!window.supabaseClient || !window.currentUserId) return null;
  const { data } = await window.supabaseClient.from('public_profiles').select('referral_code').eq('user_id',window.currentUserId).maybeSingle();
  _myRefCodeCache = data ? data.referral_code : null;
  return _myRefCodeCache;
}
async function applyReferralCode(code){
  if(!window.supabaseClient || !window.currentUserId || !code) return false;
  code=code.trim().toUpperCase();
  const { data:me } = await window.supabaseClient.from('public_profiles').select('referred_by').eq('user_id',window.currentUserId).maybeSingle();
  if(me && me.referred_by){ toast('Tu as déjà un parrain'); return false; }
  const { data:owner } = await window.supabaseClient.from('public_profiles').select('user_id').eq('referral_code',code).maybeSingle();
  if(!owner || owner.user_id===window.currentUserId){ toast('Code invalide'); return false; }
  const { error } = await window.supabaseClient.from('public_profiles').update({referred_by:owner.user_id}).eq('user_id',window.currentUserId);
  if(error){ toast('Erreur, réessaie'); return false; }
  toast('Parrainage validé ✓ Bonus après ta 1\u1d49\u02b3\u1d49 séance');
  return true;
}
// Appelé une fois qu'une séance est marquée terminée (voir hook dans finishSession / debrief)
async function grantReferralBonusIfNeeded(){
  if(!window.supabaseClient || !window.currentUserId) return;
  if(DB.load('referral_bonus_done')) return;
  try{
    const { data:me } = await window.supabaseClient.from('public_profiles').select('referred_by').eq('user_id',window.currentUserId).maybeSingle();
    if(me && me.referred_by){
      addXP(50,'Bonus de parrainage 🎉'); DB.save('referral_bonus_done', true);
      window.supabaseClient.rpc('increment_referrer_xp',{ p_uid: me.referred_by, p_amount: 50 }).then(()=>{}).catch(()=>{});
      toast('+50 XP — bonus de parrainage débloqué 🎉');
    }
  }catch(e){}
}

let friendsTab='list';
let friendsCache={friends:[],pending:[],sent:[]};
function openFriends(){
  friendsTab='list';
  $('#ovProgTitle').textContent='👥 Amis & Classement';
  $('#progBody').innerHTML='<div id="friendsBody"></div>';
  openOv('ovProg');
  loadFriendsData();
}
async function loadFriendsData(){
  if(!window.supabaseClient || !window.currentUserId){ renderFriends(); return; }
  try{
    const uid=window.currentUserId;
    const { data:rows } = await window.supabaseClient.from('friendships').select('*').or('user_id.eq.'+uid+',friend_id.eq.'+uid);
    const ids=new Set(); (rows||[]).forEach(r=>{ ids.add(r.user_id); ids.add(r.friend_id); }); ids.delete(uid);
    let profiles={};
    if(ids.size){
      const { data:profs } = await window.supabaseClient.from('public_profiles').select('user_id,username,xp,level,km_week,sessions_week').in('user_id',[...ids]);
      (profs||[]).forEach(p=>profiles[p.user_id]=p);
    }
    friendsCache={friends:[],pending:[],sent:[]};
    (rows||[]).forEach(r=>{
      const otherId = r.user_id===uid ? r.friend_id : r.user_id;
      const prof = profiles[otherId] || {username:'?',xp:0,level:1,km_week:0,sessions_week:0};
      if(r.status==='accepted') friendsCache.friends.push({...prof,id:otherId});
      else if(r.status==='pending' && r.friend_id===uid) friendsCache.pending.push({...prof,id:otherId,reqId:r.id});
      else if(r.status==='pending' && r.user_id===uid) friendsCache.sent.push({...prof,id:otherId,reqId:r.id});
    });
  }catch(e){ console.error('loadFriendsData error',e); }
  renderFriends();
}
function renderFriends(){
  let h='<div class="pills" style="margin-bottom:14px">'+
    '<div class="pill '+(friendsTab==='list'?'on':'')+'" onclick="friendsTab=\'list\';renderFriends()">👥 Amis</div>'+
    '<div class="pill '+(friendsTab==='rank'?'on':'')+'" onclick="friendsTab=\'rank\';renderFriends()">🏆 Classement</div>'+
    '<div class="pill '+(friendsTab==='refer'?'on':'')+'" onclick="friendsTab=\'refer\';renderFriends()">🎁 Parrainage</div>'+
  '</div>';

  if(!window.supabaseClient || !window.currentUserId){
    h+='<div class="card"><div class="empty"><div class="em-ic">🔒</div><div style="font-size:13px">Connecte-toi avec Google pour ajouter des amis, te comparer et te parrainer.</div></div></div>';
    $('#friendsBody').innerHTML=h; return;
  }

  if(friendsTab==='list'){
    h+='<div class="field"><label>Chercher un ami par pseudo</label><input class="inp" id="addFriendSearch" placeholder="@pseudo" autocapitalize="off" autocorrect="off" spellcheck="false" oninput="onFriendSearchInput()"><div id="friendSearchResults" style="margin-top:8px"></div></div>';
    if(friendsCache.pending.length){
      h+='<div class="sec-lab">Demandes reçues</div>';
      friendsCache.pending.forEach(p=>{
        h+='<div class="card" style="padding:12px 14px"><div class="row"><div style="font-weight:700">'+p.username+'</div><div class="row" style="gap:6px"><button class="btn sm" style="width:auto" onclick="respondFriend('+p.reqId+',true)">✓ Accepter</button><button class="btn ghost sm" style="width:auto" onclick="respondFriend('+p.reqId+',false)">✕</button></div></div></div>';
      });
    }
    h+='<div class="sec-lab">Tes amis ('+friendsCache.friends.length+')</div>';
    if(!friendsCache.friends.length) h+='<div class="card"><div class="empty"><div class="em-ic">👋</div><div style="font-size:13px">Pas encore d\u2019amis — cherche quelqu\u2019un par son pseudo !</div></div></div>';
    else friendsCache.friends.forEach(f=>{
      h+='<div class="card" style="padding:12px 14px"><div class="row"><div><div style="font-weight:700">'+f.username+'</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px">Niv. '+f.level+' · '+f.km_week+' km cette semaine</div></div><span class="mini-ic" style="color:var(--bad)" onclick="removeFriend(\''+f.id+'\')" title="Retirer">🗑</span></div></div>';
    });
    if(friendsCache.sent.length){
      h+='<div class="sec-lab">Demandes envoyées</div>';
      friendsCache.sent.forEach(p=>{ h+='<div class="card" style="padding:10px 14px;opacity:.7"><div style="font-size:13px">'+p.username+' · en attente</div></div>'; });
    }
  }

  if(friendsTab==='rank'){
    const me={username:(P.name||'Toi')+' (toi)',xp:(XP&&XP.total)||0,level:(XP&&XP.level)||1};
    const all=[...friendsCache.friends,me].sort((a,b)=>b.xp-a.xp);
    h+='<div class="sec-lab">Classement XP entre amis</div>';
    if(all.length===1) h+='<div class="card"><div class="empty"><div class="em-ic">🏆</div><div style="font-size:13px">Ajoute des amis pour débloquer le classement !</div></div></div>';
    else h+='<div class="card" style="padding:6px 14px">'+all.map((f,i)=>
      '<div class="row" style="padding:10px 0;border-bottom:'+(i<all.length-1?'1px solid var(--hair)':'none')+'"><div style="font-weight:800;width:24px;color:var(--e2)">#'+(i+1)+'</div><div style="flex:1;font-weight:700">'+f.username+'</div><div style="font-size:12.5px;color:var(--muted)">'+f.xp+' XP · Niv.'+f.level+'</div></div>'
    ).join('')+'</div>';
  }

  if(friendsTab==='refer'){
    h+='<div class="card" style="text-align:center;padding:20px"><div style="font-size:12px;color:var(--muted);margin-bottom:8px">Ton code de parrainage</div><div id="myRefCode" style="font-family:\'JetBrains Mono\',monospace;font-size:26px;font-weight:800;letter-spacing:.1em;color:var(--e2)">···</div><button class="btn ghost sm" style="margin-top:12px;width:auto" onclick="shareReferralCode()">↗ Partager mon code</button></div>';
    h+='<div class="field" style="margin-top:16px"><label>J\u2019ai un code</label><div class="row" style="gap:8px"><input class="inp" id="applyCodeInput" placeholder="Ex: A3F9K2" style="flex:1"><button class="btn sm" style="width:auto" onclick="submitReferralCode()">Valider</button></div></div>';
    h+='<div style="font-size:11.5px;color:var(--dim);margin-top:10px">🎁 Toi et ton parrain gagnez chacun +50 XP après ta 1\u1d49\u02b3\u1d49 séance.</div>';
    myReferralCode().then(c=>{ const el=$('#myRefCode'); if(el) el.textContent=c||'—'; });
  }

  $('#friendsBody').innerHTML=h;
}
let _friendSearchDeb=null;
function escLike(s){ return s.replace(/[\\%_]/g,'\\$&'); }
function onFriendSearchInput(){
  clearTimeout(_friendSearchDeb);
  const el=$('#addFriendSearch'); const v=el?el.value.trim():'';
  const box=$('#friendSearchResults'); if(!box) return;
  if(!v){ box.innerHTML=''; return; }
  box.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 2px">Recherche…</div>';
  _friendSearchDeb=setTimeout(()=>searchFriendCandidates(v),350);
}
async function searchFriendCandidates(v){
  const box=$('#friendSearchResults'); if(!box) return;
  if(!window.supabaseClient || !window.currentUserId){ box.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 2px">Connecte-toi pour chercher des amis</div>'; return; }
  try{
    const { data } = await window.supabaseClient.from('public_profiles')
      .select('user_id,username,level')
      .ilike('username_lower','%'+escLike(v.toLowerCase())+'%')
      .neq('user_id',window.currentUserId)
      .limit(8);
    const results=data||[];
    if(!results.length){ box.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 2px">Aucun pseudo trouvé</div>'; return; }
    const known=new Set([...friendsCache.friends,...friendsCache.pending,...friendsCache.sent].map(f=>f.id));
    box.innerHTML=results.map(r=>{
      const already=known.has(r.user_id);
      return '<div class="card" style="padding:10px 14px;margin-top:6px"><div class="row"><div style="font-weight:700">@'+r.username+'</div>'+
        (already?'<span style="font-size:11.5px;color:var(--muted)">déjà lié</span>':'<button class="btn sm" style="width:auto" onclick="sendFriendRequest(\''+r.user_id+'\')">＋ Ajouter</button>')+
        '</div></div>';
    }).join('');
  }catch(e){ box.innerHTML='<div style="font-size:12px;color:var(--bad);padding:6px 2px">Erreur de recherche</div>'; }
}
async function sendFriendRequest(targetId){
  const { error } = await window.supabaseClient.from('friendships').insert({user_id:window.currentUserId, friend_id:targetId, status:'pending'});
  if(error) toast('Déjà envoyé ou déjà ami'); else { toast('Demande envoyée ✓'); $('#friendSearchResults').innerHTML=''; $('#addFriendSearch').value=''; loadFriendsData(); }
}
async function respondFriend(reqId,accept){
  if(accept) await window.supabaseClient.from('friendships').update({status:'accepted'}).eq('id',reqId);
  else await window.supabaseClient.from('friendships').delete().eq('id',reqId);
  loadFriendsData();
}
async function removeFriend(otherId){
  if(!confirm('Retirer cet ami ?')) return;
  const uid=window.currentUserId;
  await window.supabaseClient.from('friendships').delete().or('and(user_id.eq.'+uid+',friend_id.eq.'+otherId+'),and(user_id.eq.'+otherId+',friend_id.eq.'+uid+')');
  loadFriendsData();
}
async function submitReferralCode(){ const el=$('#applyCodeInput'); const v=el?el.value:''; if(await applyReferralCode(v)) renderFriends(); }
async function shareReferralCode(){
  const code=await myReferralCode(); if(!code){ toast('Connecte-toi d\u2019abord'); return; }
  const text='Rejoins-moi sur IKORUN avec mon code '+code+' 🏃';
  if(navigator.share){ try{ await navigator.share({text}); }catch(e){} }
  else { navigator.clipboard&&navigator.clipboard.writeText(text); toast('Copié dans le presse-papier ✓'); }
}
/* ---- Carte image partageable (badge / séance) — générée en canvas, sans dépendance externe ---- */
function shareCardImage(title,subtitle,emoji){
  const cv=document.createElement('canvas'); cv.width=1080; cv.height=1080;
  const ctx=cv.getContext('2d');
  const grad=ctx.createLinearGradient(0,0,1080,1080);
  grad.addColorStop(0,'#0B1220'); grad.addColorStop(1,'#152040');
  ctx.fillStyle=grad; ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='rgba(61,127,255,.25)'; ctx.beginPath(); ctx.arc(850,150,320,0,Math.PI*2); ctx.fill();
  ctx.textAlign='center';
  ctx.font='140px sans-serif'; ctx.fillText(emoji||'🏅',540,420);
  ctx.fillStyle='#F4F6F9'; ctx.font='800 60px Unbounded, sans-serif'; ctx.fillText(title,540,620);
  ctx.fillStyle='#8993A6'; ctx.font='400 34px Inter, sans-serif'; ctx.fillText(subtitle||'',540,680);
  ctx.fillStyle='#3D7FFF'; ctx.font='800 30px Unbounded, sans-serif'; ctx.fillText('IKORUN',540,970);
  cv.toBlob(blob=>{
    if(!blob) return;
    const file=new File([blob],'ikorun-partage.png',{type:'image/png'});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      navigator.share({files:[file],title:'IKORUN'}).catch(()=>{});
    } else {
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ikorun-partage.png'; a.click();
      setTimeout(()=>URL.revokeObjectURL(url),4000);
    }
  });
}
function shareBadge(key){
  const b=BADGE_TIERS.find(x=>x.key===key); if(!b) return;
  shareCardImage(b.name,'Badge débloqué sur IKORUN','🏅');
}
function shareSessionImg(id){
  const s=[...SESS,...MSESS].find(x=>x.id===id); if(!s) return;
  shareCardImage(s.title||s.type,(s.km?s.km+' km':'')+(s.duration?' · '+s.duration+' min':''),'🏃');
}


const DB = {
  load(k){ try{ return JSON.parse(localStorage.getItem('vvv_'+k)); }catch(e){ return null; } },
  save(k,v){ localStorage.setItem('vvv_'+k, JSON.stringify(v)); cloudPush(k,v); },
  // IMPORTANT : toujours utiliser DB.remove() (et jamais localStorage.removeItem direct) pour les clés
  // synchronisées avec le cloud. Sinon la valeur locale est bien supprimée mais la copie cloud
  // reste présente en base → au prochain cloudPullAll() elle écrase le local et "ressuscite" la donnée
  // (c'était la cause du bug "Annuler la séance" qui ne l'annulait pas vraiment).
  remove(k){ localStorage.removeItem('vvv_'+k); cloudPush(k, null); }
};

/* ---------- STATE ---------- */
let P, SESS, MSESS, CUSTOM, PLAN, GOALS, AGENDA, XP, RECORDS, PREFS, WEIGHTLOG, TRACKER, SESSLOG, MUSCU_PR;

function reloadState(){
  P = DB.load('profile') || { setupDone:false };
  SESS = DB.load('sessions') || [];
  MSESS = DB.load('muscu_sessions') || [];
  CUSTOM = DB.load('custom_progs') || [];
  PLAN = DB.load('run_plan') || null;
  GOALS = DB.load('daily_goals') || {};
  AGENDA = DB.load('agenda') || [];
  XP = DB.load('xp') || { total:0, level:1, name:'Recrue', pastGoalXP:0 };
  RECORDS = DB.load('records') || [];
  PREFS = DB.load('prefs') || {};
  WEIGHTLOG = DB.load('weightlog') || [];
  TRACKER = DB.load('tracker') || null;
  SESSLOG = DB.load('sesslog') || [];
  MUSCU_PR = DB.load('muscu_pr') || {};
}
reloadState();

function saveAll(){
  DB.save('profile',P); DB.save('sessions',SESS); DB.save('muscu_sessions',MSESS);
  DB.save('custom_progs',CUSTOM); DB.save('run_plan',PLAN); DB.save('daily_goals',GOALS);
  DB.save('agenda',AGENDA); DB.save('xp',XP);
  DB.save('records',RECORDS); DB.save('prefs',PREFS); DB.save('weightlog',WEIGHTLOG);
  DB.save('tracker',TRACKER); DB.save('sesslog',SESSLOG);
  if(window.currentUserId) syncPublicProfile();
}

/* ============ INTERNATIONALISATION (FR / EN / AR) ============ */
const I18N={
  fr:{
    nav_home:'Accueil',nav_sport:'Sport',nav_stats:'Stats',nav_outils:'Outils',nav_profil:'Profil',
    home:'Accueil',sport:'Sport',stats:'Statistiques',outils:'Outils',profil:'Profil',
    sub_sport:'Course & Musculation',sub_stats:'Tes données réelles',sub_outils:'Calculs & timers',
    save:'Sauver',cancel:'Annuler',add:'Ajouter',edit:'Modifier',delete:'Supprimer',close:'Fermer',validate:'Valider',back:'Retour',seeAll:'Voir tout',
    running:'Course',muscu:'Musculation',coachIA:'Plan IKORUN',myPlan:'Plan personnel',
    perfHistory:'Historique des performances',editInfos:'Modifier mes informations',
    objective:'Objectif',appearance:'Apparence',accentColor:'Couleur d\u2019accent',language:'Langue',
    notifsApp:'Notifications & app',trainReminders:'Rappels d\u2019entraînement',sounds:'Sons & vibrations',units:'Unités métriques (km)',
    dataPrivacy:'Données & confidentialité',exportData:'Exporter mes données (JSON)',importData:'Importer des données',resetApp:'Réinitialiser l\u2019application',
    photo:'Photo',bio:'Biographie',addPhoto:'Ajouter une photo',changePhoto:'Changer',removePhoto:'Supprimer',
    height:'Taille',weight:'Poids',age:'Âge',level:'Niveau',logout:'Déconnexion',
    levelGuide:'Comment choisir mon niveau ?',xpProgress:'Progression XP',coach:'Coach',
    todayGoals:'Objectifs du jour',weekLoad:'Charge de la semaine',sessions:'séances',form:'forme'
  },
  en:{
    nav_home:'Home',nav_sport:'Sport',nav_stats:'Stats',nav_outils:'Tools',nav_profil:'Profile',
    home:'Home',sport:'Sport',stats:'Statistics',outils:'Tools',profil:'Profile',
    sub_sport:'Running & Strength',sub_stats:'Your real data',sub_outils:'Calculators & timers',
    save:'Save',cancel:'Cancel',add:'Add',edit:'Edit',delete:'Delete',close:'Close',validate:'Confirm',back:'Back',seeAll:'See all',
    running:'Running',muscu:'Strength',coachIA:'AI Coach',myPlan:'Custom plan',
    perfHistory:'Performance history',editInfos:'Edit my information',
    objective:'Goal',appearance:'Appearance',accentColor:'Accent color',language:'Language',
    notifsApp:'Notifications & app',trainReminders:'Training reminders',sounds:'Sounds & vibration',units:'Metric units (km)',
    dataPrivacy:'Data & privacy',exportData:'Export my data (JSON)',importData:'Import data',resetApp:'Reset the app',
    photo:'Photo',bio:'Biography',addPhoto:'Add a photo',changePhoto:'Change',removePhoto:'Remove',
    height:'Height',weight:'Weight',age:'Age',level:'Level',logout:'Log out',
    levelGuide:'How to choose my level?',xpProgress:'XP progress',coach:'Coach',
    todayGoals:'Today\u2019s goals',weekLoad:'Weekly load',sessions:'sessions',form:'form'
  },
  ar:{
    nav_home:'الرئيسية',nav_sport:'رياضة',nav_stats:'إحصائيات',nav_outils:'أدوات',nav_profil:'الملف',
    home:'الرئيسية',sport:'الرياضة',stats:'الإحصائيات',outils:'الأدوات',profil:'الملف الشخصي',
    sub_sport:'الجري وكمال الأجسام',sub_stats:'بياناتك الحقيقية',sub_outils:'حاسبات ومؤقتات',
    save:'حفظ',cancel:'إلغاء',add:'إضافة',edit:'تعديل',delete:'حذف',close:'إغلاق',validate:'تأكيد',back:'رجوع',seeAll:'عرض الكل',
    running:'الجري',muscu:'كمال الأجسام',coachIA:'مدرب ذكي',myPlan:'خطة شخصية',
    perfHistory:'سجل الإنجازات',editInfos:'تعديل معلوماتي',
    objective:'الهدف',appearance:'المظهر',accentColor:'لون التمييز',language:'اللغة',
    notifsApp:'الإشعارات والتطبيق',trainReminders:'تذكيرات التدريب',sounds:'الأصوات والاهتزاز',units:'وحدات مترية (كم)',
    dataPrivacy:'البيانات والخصوصية',exportData:'تصدير بياناتي (JSON)',importData:'استيراد البيانات',resetApp:'إعادة ضبط التطبيق',
    photo:'الصورة',bio:'نبذة',addPhoto:'إضافة صورة',changePhoto:'تغيير',removePhoto:'حذف',
    height:'الطول',weight:'الوزن',age:'العمر',level:'المستوى',logout:'تسجيل الخروج',
    levelGuide:'كيف أختار مستواي؟',xpProgress:'تقدم النقاط',coach:'المدرب',
    todayGoals:'أهداف اليوم',weekLoad:'حمل الأسبوع',sessions:'حصص',form:'اللياقة'
  }
};
function curLang(){ return (P&&P.lang)||'fr'; }
function t(key){ const l=curLang(); return (I18N[l]&&I18N[l][key])||I18N.fr[key]||key; }
const LANGS=[['fr','🇫🇷','Français'],['en','🇬🇧','English'],['ar','🇩🇿','العربية']];
function setLang(l){
  P.lang=l; saveAll();
  document.documentElement.lang=l;
  document.documentElement.dir=(l==='ar')?'rtl':'ltr';
  applyNavLabels();
  // re-render la vue active
  const active=document.querySelector('.nb.on'); if(active) nav(active.dataset.s);
  refreshPfSheet();
  toast('✓');
}
function applyNavLabels(){
  document.querySelectorAll('.nb').forEach(b=>{ const s=b.dataset.s; const sp=b.querySelector('span'); if(sp) sp.textContent=t('nav_'+s); });
}
/* ---------- RECORDS personnels ---------- */
function personalRecords(){
  // Combine les records manuels + ceux du profil (rétrocompat)
  const base=[
    {dist:'1500m',meters:1500,time:P.pb1500||''},
    {dist:'3000m',meters:3000,time:P.pb3k||''},
    {dist:'5000m',meters:5000,time:P.pb5k||''},
    {dist:'10km',meters:10000,time:P.pb10k||''}
  ];
  // Pour chaque distance, garde le meilleur entre profil et RECORDS manuels
  const map={};
  base.forEach(b=>{ if(b.time) map[b.dist]=b; });
  RECORDS.forEach(r=>{
    const cur=map[r.dist];
    if(!cur || parseTime(r.time)<parseTime(cur.time)) map[r.dist]={...r};
  });
  // Ajoute les distances custom de RECORDS non présentes
  RECORDS.forEach(r=>{ if(!map[r.dist]) map[r.dist]={...r}; });
  return Object.values(map);
}
function bestRecord(){
  const recs=personalRecords().filter(r=>r.time);
  if(!recs.length) return null;
  // meilleur = VDOT le plus élevé
  let best=null,bv=0;
  recs.forEach(r=>{ const v=vdotFromRace(r.meters||5000,parseTime(r.time)); if(v>bv){bv=v;best=r;} });
  return best;
}

/* ---------- MATH (Daniels) ---------- */
function parseTime(s){
  if(!s) return 0;
  const p = String(s).trim().split(':').map(Number);
  if(p.length===3) return p[0]*3600+p[1]*60+p[2];
  if(p.length===2) return p[0]*60+p[1];
  return p[0]||0;
}
function fmtTime(sec){
  sec=Math.round(sec);
  const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;
  if(h>0) return h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  return m+':'+String(s).padStart(2,'0');
}
// ---- Courbe d'intensité des répétitions (% de vVO2max) selon la distance ----
// Calibrée sur des données réelles d'entraînement (coureur ~VDOT 65-67, ex: 30×200m à 26-28s,
// 30×300m à 40-45s, 20×400m à 60s, 10-15×1000m à 2:40-2:50, 4-6×2000m à 5:50-6:00, etc.).
// Sur les répétitions courtes, la réserve de vitesse anaérobie fait qu'on court BEAUCOUP plus vite
// que la simple extrapolation VMA/vVO2max (200 m ≈ 134% vVO2max, pas ~102% comme avant). Se
// généralise à tous les niveaux car exprimée en % de la vVO2max individuelle (dérivée du VDOT).
const REP_INTENSITY_CURVE=[
  [200,133.8],[300,127.5],[400,120.4],[600,116.8],[800,113.1],
  [1000,109.5],[1500,104.5],[2000,101.8],[3000,100.4],[4000,98.3],[5000,96.6]
];
function repIntensityPct(meters){
  const c=REP_INTENSITY_CURVE;
  if(meters<=c[0][0]) return c[0][1];
  if(meters>=c[c.length-1][0]) return c[c.length-1][1];
  for(let i=0;i<c.length-1;i++){
    if(meters>=c[i][0] && meters<=c[i+1][0]){
      const t=(meters-c[i][0])/(c[i+1][0]-c[i][0]);
      return c[i][1]+(c[i+1][1]-c[i][1])*t;
    }
  }
  return 100;
}
function repPace(vdot,meters){ return paceFromPct(vdot,repIntensityPct(meters)/100); }
function vdotFromRace(d,t){
  const tm=t/60, v=d/tm;
  const vo2=-4.60+0.182258*v+0.000104*v*v;
  const pct=0.8+0.1894393*Math.exp(-0.012778*tm)+0.2989558*Math.exp(-0.1932605*tm);
  return vo2/pct;
}
function vVO2max(vdot){
  let v=300;
  for(let i=0;i<100;i++){
    const f=-4.60+0.182258*v+0.000104*v*v-vdot;
    v-=f/(0.182258+0.000208*v);
  }
  return v; // m/min
}
function predictTime(vdot,dist){
  let lo=30,hi=30000;
  for(let i=0;i<80;i++){
    const mid=(lo+hi)/2, tm=mid/60, vel=dist/tm;
    const vo2n=-4.60+0.182258*vel+0.000104*vel*vel;
    const pct=0.8+0.1894393*Math.exp(-0.012778*tm)+0.2989558*Math.exp(-0.1932605*tm);
    if(vo2n/pct<vdot) hi=mid; else lo=mid;
  }
  return Math.round((lo+hi)/2);
}
// pace sec/km from vVO2max % -> returns sec per km
function paceFromPct(vdot,pct){
  const v=vVO2max(vdot)*pct; // m/min
  return 60000/v; // sec per km
}
function spkToStr(spk){
  const m=Math.floor(spk/60), s=Math.round(spk%60);
  return m+':'+String(s).padStart(2,'0');
}
// ---- Helpers séries / fractionné (corrige l'affichage "allure /km" trompeur sur les courtes distances) ----
// Distance parcourue (en km) pendant `sec` secondes à une allure sec/km donnée
function distKmFromTime(sec,paceSecPerKm){ return paceSecPerKm>0?sec/paceSecPerKm:0; }
// Temps de passage réel (en s) sur une distance donnée (m) à une allure sec/km donnée
function splitSecFromPace(paceSecPerKm,meters){ return paceSecPerKm*meters/1000; }
// Formatte un temps de passage : "27 s" si < 1 min, sinon "1:23"
function fmtSplit(sec){
  sec=Math.round(sec);
  if(sec<60) return sec+' s';
  const m=Math.floor(sec/60), s=sec%60;
  return m+':'+String(s).padStart(2,'0');
}
// Texte complet "8 × 300 m à 53 s (2:57/km)" pour une série de répétitions
function repsText(n,meters,paceSecPerKm){
  return n+' × '+meters+' m à '+fmtSplit(splitSecFromPace(paceSecPerKm,meters))+' ('+spkToStr(paceSecPerKm)+'/km)';
}
// Résumé compact des séries d'une séance, pour affichage AVANT clic (carte de la liste)
function seriesSummary(s){
  const sr=s.series;
  if(!sr) return null;
  if(sr.segments) return 'Pyramide '+sr.segments[0].dist+'→'+Math.max(...sr.segments.map(x=>x.dist))+' m';
  if(sr.reps && sr.dist) return sr.reps+' × '+sr.dist+' m à '+fmtSplit(splitSecFromPace(sr.paceSecPerKm,sr.dist));
  if(sr.reps) return sr.reps+' × efforts'+(sr.note?' · '+sr.note:'');
  return null;
}
function getUserVDOT(){
  const fromRec=(typeof RECORDS!=='undefined')?computeVDOTfromRecords():computeVDOT();
  if(fromRec) return fromRec;
  return P.vdot||computeVDOT();
}
function computeVDOT(){
  const races=[];
  if(P.t5k) races.push([5000,parseTime(P.t5k)]);
  if(P.t3k) races.push([3000,parseTime(P.t3k)]);
  if(P.t1500) races.push([1500,parseTime(P.t1500)]);
  if(P.t10k) races.push([10000,parseTime(P.t10k)]);
  let best=0;
  races.forEach(r=>{ if(r[1]>0){ const v=vdotFromRace(r[0],r[1]); if(v>best) best=v; }});
  return best>0?Math.round(best*10)/10:0;
}

/* ---------- XP — SYSTÈME DÉRIVÉ (recalculé depuis les données réelles) ---------- */
/* Le total XP n'est JAMAIS stocké de façon cumulative : il est toujours
   recalculé depuis les sources réelles. Cocher/décocher un objectif met donc
   automatiquement à jour le total, ce qui corrige définitivement le bug.

   ---- Refonte "carrière d'athlète" ----
   Objectif : un pratiquant très régulier (~100-120 km/mois, séances
   assidues, quelques records et compétitions par an) doit mettre
   au moins ~3 ans, et plus réalistement 3 à 4 ans, pour atteindre le
   niveau maximum (70). L'XP quotidien (hydratation, étirements...) est
   volontairement presque nul : la vraie progression vient des séances
   réelles, des records, des cycles/préparations terminés et des
   compétitions. */
const MAX_LEVEL=70;
const RANKS=[
  {min:1,  max:9,  name:'Novice',      slug:'novice',     color:'#8993A6', bg:'linear-gradient(135deg,#3a4048,#5c6473)'},
  {min:10, max:19, name:'Athlète',     slug:'athlete',    color:'#3D7FFF', bg:'linear-gradient(135deg,#1b3a7a,#3D7FFF)'},
  {min:20, max:29, name:'Compétiteur', slug:'competiteur',color:'#33D399', bg:'linear-gradient(135deg,#0d5c3f,#33D399)'},
  {min:30, max:39, name:'Élite',       slug:'elite',      color:'#4d9dff', bg:'linear-gradient(135deg,#0d2f7a,#4d9dff)'},
  {min:40, max:49, name:'Champion',    slug:'champion',   color:'#F2B84B', bg:'linear-gradient(135deg,#a5720f,#F2B84B)'},
  {min:50, max:59, name:'Légende',     slug:'legende',    color:'#FFD76A', bg:'linear-gradient(135deg,#7a5c0d,#FFD76A)'},
  {min:60, max:69, name:'Immortel',    slug:'immortel',   color:'#b57dff', bg:'linear-gradient(135deg,#4a1a7a,#b57dff)'},
  {min:70, max:9999,name:'IKORUN Elite',slug:'ikorun-elite',color:'#ffffff', bg:'linear-gradient(135deg,#0a0a0a,#ffd76a)'}
];
function rankFor(level){ return RANKS.find(r=>level>=r.min&&level<=r.max)||RANKS[RANKS.length-1]; }

/* Petites actions quotidiennes → XP volontairement minuscule */
const XP_RULES={
  // habitudes du jour (presque rien)
  perGoal:3, allGoalsBonus:8,
  // séances réelles
  perKm:3, perRunSession:15, perMuscuSession:15, perMuscuSet:1, perMinTraining:0.15,
  // régularité (meilleure série jamais atteinte)
  perStreakDay:3,
  // vrais accomplissements
  perRecord:120, perCompetitionRecord:250,
  perWeekCompleted:60, perPlanCompleted:500
};

/* Courbe de niveau : need(n) = 70 + 2.1575...*n^1.85 (arrondi)
   → niveau 70 ≈ 145 000 XP cumulés, atteignable en ~3 à 4 ans pour un
   pratiquant très régulier à 100-120 km/mois. */
function xpForLevel(n){ return Math.round(70 + 2.157542326080347*Math.pow(n,1.85)); }
function cumulXpForLevel(n){
  // total XP requis pour ATTEINDRE le niveau n (fin du niveau n-1)
  let acc=0; for(let i=1;i<n;i++) acc+=xpForLevel(i); return acc;
}
const TOTAL_XP_MAX=cumulXpForLevel(MAX_LEVEL+1); // XP pour boucler le niveau 70

function computeXPTotal(){
  let xp=0;
  // Distance (le gros contributeur naturel : ~3 XP/km)
  xp += Math.round(totalKm()*XP_RULES.perKm);
  // Séances réalisées
  xp += SESS.length*XP_RULES.perRunSession;
  xp += MSESS.length*XP_RULES.perMuscuSession;
  xp += MSESS.reduce((a,s)=>a+(s.sets||0),0)*XP_RULES.perMuscuSet;
  const totMin = SESS.reduce((a,s)=>a+(s.duration||0),0) + MSESS.reduce((a,s)=>a+(s.duration||0)/60,0);
  xp += Math.round(totMin*XP_RULES.perMinTraining);
  // Objectifs du jour cochés (presque rien, comme demandé)
  if(GOALS.list){
    const checked=GOALS.list.filter(g=>g.done).length;
    xp += checked*XP_RULES.perGoal;
    if(GOALS.list.length && GOALS.list.every(g=>g.done)) xp += XP_RULES.allGoalsBonus;
  }
  xp += (XP.pastGoalXP||0);
  // Régularité
  xp += bestStreak()*XP_RULES.perStreakDay;
  // Records personnels — bonus supplémentaire si marqués "compétition officielle"
  const recs=personalRecords().filter(r=>r.time);
  xp += recs.length*XP_RULES.perRecord;
  xp += RECORDS.filter(r=>r.competition).length*XP_RULES.perCompetitionRecord;
  // Semaines de plan 100% terminées + préparations/cycles complets
  xp += (XP.weeksCompleted||0)*XP_RULES.perWeekCompleted;
  xp += (XP.plansCompleted||0)*XP_RULES.perPlanCompleted;
  return Math.max(0,Math.round(xp));
}
function levelFromTotal(total){
  const capped=Math.min(total,TOTAL_XP_MAX-1);
  let lvl=1, need=xpForLevel(1), acc=0;
  while(lvl<MAX_LEVEL && capped>=acc+need){ acc+=need; lvl++; need=xpForLevel(lvl); }
  return { level:lvl, base:acc, next:acc+need, span:need, inLvl:capped-acc, maxed: total>=TOTAL_XP_MAX-1 };
}
function levelName(lvl){ return rankFor(lvl).name; }
/* Détecte et enregistre les cycles/semaines de plan terminés (source d'XP majeure) */
function checkPlanProgressXP(){
  if(!PLAN||!PLAN.sessions||!PLAN.sessions.length) return;
  XP.countedWeeks=XP.countedWeeks||[];
  XP.countedPlans=XP.countedPlans||[];
  const planId=PLAN.created||'plan';
  const byWeek={};
  PLAN.sessions.forEach(s=>{ (byWeek[s.week]=byWeek[s.week]||[]).push(s); });
  Object.keys(byWeek).forEach(wk=>{
    const wid=planId+'-w'+wk;
    const sessions=byWeek[wk];
    const allDone=sessions.every(s=>s.done||s.type==='Repos');
    if(allDone && !XP.countedWeeks.includes(wid)){ XP.countedWeeks.push(wid); XP.weeksCompleted=(XP.weeksCompleted||0)+1; }
  });
  const planDone=PLAN.sessions.every(s=>s.done||s.type==='Repos');
  if(planDone && !XP.countedPlans.includes(planId)){ XP.countedPlans.push(planId); XP.plansCompleted=(XP.plansCompleted||0)+1; }
}
/* Recalcule l'état XP, détecte une montée de niveau, déclenche animation, et
   vérifie l'obtention de nouveaux badges. */
function refreshXP(opts){
  checkPlanProgressXP();
  const total=computeXPTotal();
  const info=levelFromTotal(total);
  const prevLevel=XP.level||1;
  const rank=rankFor(info.level);
  XP.total=total; XP.level=info.level; XP.name=levelName(info.level); XP.rank=rank.name; XP.maxed=info.maxed;
  XP.next=info.next; XP.base=info.base; XP.span=info.span; XP.inLvl=info.inLvl;
  DB.save('xp',XP);
  document.documentElement.setAttribute('data-rank-theme', rank.slug||'novice');
  if(opts&&opts.animate&&info.level>prevLevel){ levelUpAnimation(info.level); }
  checkNewBadges(opts&&opts.animate);
  return XP;
}
function xpProgress(){
  refreshXP();
  return { pct: XP.maxed?100:Math.min(100,Math.round(XP.inLvl/XP.span*100)), inLvl:XP.inLvl, span:XP.span, next:XP.next };
}
/* Compat : addXP devient un simple déclencheur de recalcul + feedback */
function addXP(amount,reason){
  refreshXP({animate:true});
  sfx('xp');
  if(reason) toast('+'+amount+' XP · '+reason);
}
/* ============ BADGES — 23 PALIERS DE PRESTIGE ============ */
/* Chaque badge exige un niveau ET une distance cumulée cohérents avec la
   courbe d'XP ci-dessus (donc avec le rythme réel de 100-120 km/mois).
   Les derniers paliers ajoutent une exigence de séances et, pour les tout
   derniers, de compétitions/préparations terminées — "aucune obtention
   rapide possible". */
/* ============ NIVEAUX — 8 PALIERS DE PROGRESSION (basés sur l'XP total) ============ */
const BADGE_TIERS=[
  {key:'debutant', name:'Débutant', cls:'bd-debutant', emoji:'🌱', xpMin:0,    desc:"Le tout début de l\u2019aventure IKORUN."},
  {key:'amateur',  name:'Amateur',  cls:'bd-amateur',  emoji:'🥉', xpMin:200,  desc:"Tu prends le rythme."},
  {key:'sportif',  name:'Sportif',  cls:'bd-sportif',  emoji:'⭐', xpMin:500,  desc:"L\u2019entraînement devient une habitude."},
  {key:'athlete',  name:'Athlète',  cls:'bd-athlete',  emoji:'🏅', xpMin:1000, desc:"Tu progresses avec sérieux."},
  {key:'expert',   name:'Expert',   cls:'bd-expert',   emoji:'💚', xpMin:2000, desc:"Une vraie maîtrise de ton entraînement."},
  {key:'elite',    name:'Élite',    cls:'bd-elite',    emoji:'💎', xpMin:3500, desc:"Constante amélioration."},
  {key:'maitre',   name:'Maître',   cls:'bd-maitre',   emoji:'🛡️', xpMin:5000, desc:"Maîtrise ton corps et ton mental."},
  {key:'legende',  name:'Légende',  cls:'bd-legende',  emoji:'👑', xpMin:7500, desc:"Devenu une référence."}
];
function badgeStats(){
  return { xp: XP.total||0 };
}
function badgeProgress(b){
  const xp=XP.total||0;
  const idx=BADGE_TIERS.findIndex(t=>t.key===b.key);
  const next=BADGE_TIERS[idx+1];
  const need=next?next.xpMin:b.xpMin;
  const parts=[{label:'XP total', have:xp, need:need, unit:'XP'}];
  const unlocked=xp>=b.xpMin;
  const pct=next?Math.min(100,Math.round(((xp-b.xpMin)/(next.xpMin-b.xpMin))*100)):100;
  return {parts,pct:Math.max(0,pct),unlocked};
}
/* Migration : les paliers ont été renommés (anciennes clés → nouvelles).
   On réécrit les enregistrements déjà obtenus pour éviter les doublons
   et les paliers fantômes qui n'existent plus. */
const BADGE_KEY_MIGRATION={
  pierre:'initie', bronze:'discipline', argent:'perseverant', or:'determine',
  emeraude:'avance', diamant:'elite', cristal:'exceptionnel', galaxie:'legendaire',
  divin:'ultime', vvvelite:'iconique'
};
function unlockedBadges(){
  const raw=DB.load('badges_unlocked')||[];
  let changed=false;
  const mapped=raw.map(u=>{
    if(BADGE_KEY_MIGRATION[u.key]){ changed=true; return Object.assign({},u,{key:BADGE_KEY_MIGRATION[u.key]}); }
    return u;
  });
  const validKeys=new Set(BADGE_TIERS.map(b=>b.key));
  const byKey={};
  mapped.forEach(u=>{
    if(!validKeys.has(u.key)){ changed=true; return; }
    if(!byKey[u.key] || (u.date && u.date<byKey[u.key].date)) byKey[u.key]=u;
    else changed=true;
  });
  const clean=BADGE_TIERS.filter(b=>byKey[b.key]).map(b=>byKey[b.key]);
  if(changed) saveUnlockedBadges(clean);
  return clean;
}
function saveUnlockedBadges(list){ DB.save('badges_unlocked',list); }
/* Vérifie l'obtention de nouveaux badges ; joue l'animation plein écran pour
   le plus prestigieux nouvellement débloqué. */
let _badgeUnlockQueue=[];
function checkNewBadges(animate){
  const unlocked=unlockedBadges();
  const already=new Set(unlocked.map(u=>u.key));
  let newest=null;
  BADGE_TIERS.forEach(b=>{
    if(already.has(b.key)) return;
    const prog=badgeProgress(b);
    if(prog.unlocked){
      unlocked.push({key:b.key,date:todayKey()});
      newest=b;
    }
  });
  if(newest){
    saveUnlockedBadges(unlocked);
    if(animate) _badgeUnlockQueue.push(newest.key);
    playBadgeUnlockQueue();
  }
}
function playBadgeUnlockQueue(){
  if(document.querySelector('.bd-unlock-ov')) return; // une animation à la fois
  const key=_badgeUnlockQueue.shift();
  if(!key) return;
  const b=BADGE_TIERS.find(x=>x.key===key);
  if(b) showBadgeUnlockAnim(b);
}
function showBadgeUnlockAnim(b){
  burst(); sfx('medal');
  if(navigator.vibrate) navigator.vibrate([120,60,120,60,260]);
  const ov=document.createElement('div');
  ov.className='bd-unlock-ov';
  let sparks=''; for(let i=0;i<26;i++){ const a=Math.random()*Math.PI*2, d=90+Math.random()*110;
    sparks+='<span class="bd-spark" style="--tx:'+(Math.cos(a)*d)+'px;--ty:'+(Math.sin(a)*d)+'px;animation-delay:'+(Math.random()*1.2)+'s"></span>'; }
  ov.innerHTML='<div class="bd-flash"></div>'+
    '<div style="font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:700;font-family:Unbounded;margin-bottom:6px">NOUVEAU BADGE DÉBLOQUÉ</div>'+
    '<div class="bd-unlock-stage '+b.cls+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div><div class="bd-ring r4"></div>'+
    '<div class="bd-unlock-badge">'+bdGlyph(b.key)+sparks+'</div></div>'+
    '<div class="man" style="font-weight:800;font-size:30px;margin-top:18px;letter-spacing:.5px">'+b.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;max-width:280px">'+b.desc+'</div>'+
    '<div style="color:var(--dim);font-size:12px;margin-top:18px">Touche pour continuer</div>';
  ov.onclick=()=>{ ov.remove(); playBadgeUnlockQueue(); };
  document.body.appendChild(ov);
  setTimeout(()=>{ if(ov.parentNode){ ov.remove(); playBadgeUnlockQueue(); } },4200);
}
/* Consultation "premium" d'un badge déjà obtenu (rejoue une version sans confettis) */
function replayBadgeAnim(key){
  const b=BADGE_TIERS.find(x=>x.key===key); if(!b) return;
  sfx('goal'); if(navigator.vibrate) navigator.vibrate(60);
  const ov=document.createElement('div');
  ov.className='bd-unlock-ov';
  let sparks=''; for(let i=0;i<20;i++){ const a=Math.random()*Math.PI*2, d=80+Math.random()*90;
    sparks+='<span class="bd-spark" style="--tx:'+(Math.cos(a)*d)+'px;--ty:'+(Math.sin(a)*d)+'px;animation-delay:'+(Math.random()*1.4)+'s"></span>'; }
  ov.innerHTML='<div class="bd-flash"></div>'+
    '<div class="bd-unlock-stage '+b.cls+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div>'+
    '<div class="bd-unlock-badge">'+bdGlyph(b.key)+sparks+'</div></div>'+
    '<div class="man" style="font-weight:800;font-size:26px;margin-top:18px">'+b.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;max-width:280px">'+b.desc+'</div>'+
    '<div style="color:var(--dim);font-size:12px;margin-top:16px">Touche pour fermer</div>';
  ov.onclick=()=>ov.remove();
  document.body.appendChild(ov);
}
/* Aperçu d'un badge encore verrouillé : même show lumineux, en plus sobre,
   avec le rappel des conditions restantes pour ne rien laisser "mystérieux". */
function previewBadgeAnim(key){
  const b=BADGE_TIERS.find(x=>x.key===key); if(!b) return;
  sfx('tap'); if(navigator.vibrate) navigator.vibrate(35);
  const prog=badgeProgress(b);
  const ov=document.createElement('div');
  ov.className='bd-unlock-ov preview';
  let sparks=''; for(let i=0;i<16;i++){ const a=Math.random()*Math.PI*2, d=80+Math.random()*90;
    sparks+='<span class="bd-spark" style="--tx:'+(Math.cos(a)*d)+'px;--ty:'+(Math.sin(a)*d)+'px;animation-delay:'+(Math.random()*1.4)+'s"></span>'; }
  const remain=prog.parts.filter(p=>p.have<p.need);
  let condHtml='';
  if(remain.length){
    condHtml='<div class="bd-preview-cond">'+remain.map(p=>'<div class="row" style="justify-content:space-between;font-size:12px;color:var(--muted);margin-bottom:4px"><span>'+p.label+'</span><span class="mono">'+Math.min(p.have,p.need)+' / '+p.need+' '+p.unit+'</span></div>').join('')+'</div>';
  }
  ov.innerHTML='<div class="bd-flash"></div>'+
    '<div style="font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:700;font-family:Unbounded;margin-bottom:6px">APERÇU · VERROUILLÉ</div>'+
    '<div class="bd-unlock-stage '+b.cls+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div>'+
    '<div class="bd-unlock-badge">'+bdGlyph(b.key)+sparks+'<div class="bd-lock-chip big">🔒</div></div></div>'+
    '<div class="man" style="font-weight:800;font-size:26px;margin-top:18px">'+b.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;max-width:280px">'+b.desc+'</div>'+
    condHtml+
    '<div style="color:var(--dim);font-size:12px;margin-top:18px">Touche pour fermer</div>';
  ov.onclick=()=>ov.remove();
  document.body.appendChild(ov);
}
let badgeFilter='tous';
function openBadges(){
  $('#ovBadgesTitle').textContent='Badges';
  renderBadgeGallery();
  openOv('ovBadges');
}
function renderBadgeGallery(){
  const unlocked=unlockedBadges(); const ukeys=new Set(unlocked.map(u=>u.key));
  const list=BADGE_TIERS.filter(b=> badgeFilter==='tous' ? true : (badgeFilter==='obtenus'? ukeys.has(b.key) : !ukeys.has(b.key)));
  let h='<div class="pills" style="margin-bottom:14px">'+
    [['tous','Tous'],['obtenus','Obtenus'],['verrouilles','Verrouillés']].map(f=>'<div class="pill '+(badgeFilter===f[0]?'on':'')+'" onclick="badgeFilter=\''+f[0]+'\';renderBadgeGallery()">'+f[1]+'</div>').join('')+
    '</div>';
  h+='<div style="font-size:12px;color:var(--muted);margin-bottom:10px">'+unlocked.length+' / '+BADGE_TIERS.length+' badges obtenus</div>';
  h+='<div class="bd-grid">';
  list.forEach((b,i)=>{
    const on=ukeys.has(b.key);
    h+='<div class="bd-cell" onclick="openBadgeDetail(\''+b.key+'\')">'+
      '<div class="bd-icon '+b.cls+(on?'':' locked')+'" style="--sw:'+(i%5)+'">'+bdGlyph(b.key)+(on?'':'<div class="bd-lock-chip">🔒</div>')+'</div>'+
      '<div class="bd-name">'+b.name+'</div><div class="bd-lvl">'+b.xpMin+' XP</div></div>';
  });
  h+='</div>';
  $('#badgesBody').innerHTML=h;
}
function openBadgeDetail(key){
  const b=BADGE_TIERS.find(x=>x.key===key); if(!b) return;
  const idx=BADGE_TIERS.findIndex(x=>x.key===key);
  const prev=BADGE_TIERS[idx-1], next=BADGE_TIERS[idx+1];
  const unlocked=unlockedBadges(); const rec=unlocked.find(u=>u.key===key);
  const prog=badgeProgress(b);
  $('#ovBadgesTitle').textContent='Détails du badge';
  let h='<div class="row" style="margin-bottom:10px">'+
    '<span style="font-size:12px;color:'+(prev?'var(--e)':'var(--dim)')+';cursor:'+(prev?'pointer':'default')+'" '+(prev?'onclick="openBadgeDetail(\''+prev.key+'\')"':'')+'>‹ '+(prev?prev.name:'')+'</span>'+
    '<span style="font-size:11px;color:var(--dim)">'+(idx+1)+' / '+BADGE_TIERS.length+'</span>'+
    '<span style="font-size:12px;color:'+(next?'var(--e)':'var(--dim)')+';cursor:'+(next?'pointer':'default')+'" '+(next?'onclick="openBadgeDetail(\''+next.key+'\')"':'')+'>'+(next?next.name:'')+' ›</span>'+
  '</div>';
  h+='<div style="text-align:center;margin-bottom:18px">'+
    '<div class="bd-icon big '+b.cls+(rec?'':' locked')+'" style="margin:0 auto 14px;cursor:pointer" onclick="'+(rec?'replayBadgeAnim':'previewBadgeAnim')+'(\''+b.key+'\')">'+bdGlyph(b.key)+(rec?'':'<div class="bd-lock-chip big">🔒</div>')+'</div>'+
    '<div class="man" style="font-weight:800;font-size:24px">'+b.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;padding:0 10px">'+b.desc+'</div>'+
    (rec?'<div style="color:var(--e);font-size:12px;margin-top:8px">Obtenu le '+fmtDate(rec.date)+' · <span style="text-decoration:underline;cursor:pointer" onclick="replayBadgeAnim(\''+b.key+'\')">revivre l\u2019animation</span></div>'
        :'<div style="color:var(--muted);font-size:12px;margin-top:8px">🔒 Verrouillé · <span style="text-decoration:underline;cursor:pointer;color:var(--e)" onclick="previewBadgeAnim(\''+b.key+'\')">voir un aperçu</span></div>')+
    '</div>';
  h+='<div class="card"><div class="lab" style="margin-bottom:12px">Conditions d\u2019obtention</div>';
  prog.parts.forEach(p=>{
    const pc=Math.min(100,Math.round((p.need?p.have/p.need:1)*100));
    const done=p.have>=p.need;
    h+='<div style="margin-bottom:12px"><div class="row" style="margin-bottom:5px"><span style="font-size:13px">'+(done?'✅ ':'⬜ ')+p.label+'</span><span class="mono" style="font-size:12px;color:var(--muted)">'+Math.min(p.have,p.need)+' / '+p.need+' '+p.unit+'</span></div><div class="pbar" style="height:6px"><div style="width:'+pc+'%"></div></div></div>';
  });
  h+='<div class="row" style="margin-top:6px"><span class="lab">Progression globale</span><span class="mono" style="color:var(--e)">'+prog.pct+'%</span></div></div>';
  if(rec) h+='<button class="btn" style="margin-top:12px" onclick="shareBadge(\''+b.key+'\')">↗ Partager ce badge</button>';
  h+='<button class="btn ghost" onclick="closeOv(\'ovBadges\')">Fermer</button>';
  $('#badgesBody').innerHTML=h;
  openOv('ovBadges');
}
/* Bloc résumé badges affiché sur le profil (mini-galerie + prochaine récompense) */
function badgeStripHTML(){
  const unlocked=unlockedBadges(); const ukeys=new Set(unlocked.map(u=>u.key));
  const recent=[...unlocked].sort((a,b)=>b.date<a.date?-1:1).slice(0,4).map(u=>BADGE_TIERS.find(b=>b.key===u.key)).filter(Boolean);
  const nb=nextBadge();
  let h='<div class="card stag" style="animation-delay:.12s">';
  h+='<div class="row" style="margin-bottom:12px"><span class="card-t" style="margin:0">🏆 Mes badges</span><span style="font-size:12px;color:var(--e);cursor:pointer" onclick="openBadges()">'+unlocked.length+' / '+BADGE_TIERS.length+' · Voir tout ›</span></div>';
  if(recent.length){
    h+='<div class="row" style="gap:10px;flex-wrap:wrap">'+recent.map(b=>'<div class="bd-icon '+b.cls+'" style="width:52px;height:52px;cursor:pointer" onclick="openBadgeDetail(\''+b.key+'\')">'+bdGlyph(b.key)+'</div>').join('')+'</div>';
  } else {
    h+='<div style="font-size:12px;color:var(--muted)">Aucun badge obtenu pour l\u2019instant — ta première séance te rapprochera du badge Initié.</div>';
  }
  if(nb){
    const prog=badgeProgress(nb);
    h+='<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--hair)"><div class="row" style="margin-bottom:6px"><span style="font-size:12px;color:var(--muted)">Prochain badge · '+nb.name+'</span><span class="mono" style="font-size:12px;color:var(--e)">'+prog.pct+'%</span></div><div class="pbar" style="height:6px"><div style="width:'+prog.pct+'%"></div></div></div>';
  }
  h+='</div>';
  return h;
}
function nextBadge(){
  const unlocked=new Set(unlockedBadges().map(u=>u.key));
  return BADGE_TIERS.find(b=>!unlocked.has(b.key))||null;
}

function bestStreak(){
  const set=new Set([...SESS,...MSESS].map(s=>s.date));
  if(!set.size) return 0;
  const dates=[...set].sort();
  let best=1,cur=1;
  for(let i=1;i<dates.length;i++){
    const prev=new Date(dates[i-1]), d=new Date(dates[i]);
    if(daysBetween(prev,d)===1){ cur++; best=Math.max(best,cur); } else cur=1;
  }
  return Math.max(best,streakDays());
}
/* ---------- LEVEL UP ANIMATION ---------- */
function levelUpAnimation(level){
  burst(); sfx('medal');
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;z-index:13500;display:flex;align-items:center;justify-content:center;background:rgba(5,7,10,.86);backdrop-filter:blur(8px);animation:fade .3s';
  ov.innerHTML='<div style="text-align:center;animation:popIn .6s cubic-bezier(.34,1.56,.64,1)">'+
    '<div style="font-size:14px;letter-spacing:3px;color:var(--e);font-weight:700;font-family:Unbounded">NIVEAU SUPÉRIEUR</div>'+
    '<div style="font-size:96px;margin:6px 0;filter:drop-shadow(0 0 20px var(--e))">⭐</div>'+
    '<div class="man" style="font-weight:800;font-size:54px;background:linear-gradient(135deg,var(--e),#9FD8FF);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">Niv. '+level+'</div>'+
    '<div class="man" style="font-weight:700;font-size:22px;margin-top:4px">'+levelName(level)+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:14px">Touche pour continuer</div></div>';
  ov.onclick=()=>ov.remove();
  document.body.appendChild(ov);
  setTimeout(()=>{ if(ov.parentNode)ov.remove(); },4000);
}

/* ---------- UTIL ---------- */
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
function todayKey(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function dateKey(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function daysBetween(a,b){ return Math.round((b-a)/86400000); }
function toast(m){ const t=$('#toast'); t.textContent=m; t.classList.add('on'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('on'),2200); }

/* ============ SONS PREMIUM (Web Audio, synthétisés, discrets) ============ */
let _actx=null;
function audioCtx(){ if(!_actx){ try{ _actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } } if(_actx.state==='suspended') _actx.resume(); return _actx; }
function soundsOn(){ return P.sounds!==false; }
// Débloque l'audio au premier geste utilisateur (politique navigateur)
document.addEventListener('pointerdown',function unlockAudio(){ try{ audioCtx(); }catch(e){} document.removeEventListener('pointerdown',unlockAudio); },{once:true});
// note: fréquence, durée, type, volume, délai, glide vers
function _note(freq,dur,type,vol,delay,toFreq){
  const ctx=audioCtx(); if(!ctx) return;
  const t0=ctx.currentTime+(delay||0);
  const o=ctx.createOscillator(), g=ctx.createGain();
  o.type=type||'sine'; o.frequency.setValueAtTime(freq,t0);
  if(toFreq) o.frequency.exponentialRampToValueAtTime(toFreq,t0+dur);
  g.gain.setValueAtTime(0,t0);
  g.gain.linearRampToValueAtTime(vol||0.18,t0+0.012);
  g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t0); o.stop(t0+dur+0.02);
}
function sfx(name){
  if(!soundsOn()) return;
  switch(name){
    case 'tick': _note(880,0.05,'square',0.06); break;
    case 'start': _note(523,0.12,'sine',0.15); _note(784,0.16,'sine',0.15,0.1); break;
    case 'stop': _note(523,0.14,'sine',0.13); _note(392,0.2,'sine',0.13,0.1); break;
    case 'goal': _note(659,0.1,'sine',0.16); _note(880,0.18,'sine',0.16,0.09); break;
    case 'xp': _note(1046,0.08,'triangle',0.13); _note(1318,0.12,'triangle',0.13,0.07); break;
    case 'medal': _note(659,0.12,'sine',0.16); _note(880,0.12,'sine',0.16,0.1); _note(1318,0.25,'sine',0.18,0.2); break;
    case 'finish': [523,659,784,1046].forEach((f,i)=>_note(f,0.22,'sine',0.16,i*0.11)); break;
    case 'timer': for(let i=0;i<3;i++){ _note(1046,0.16,'sine',0.2,i*0.28); } break;
    case 'notif': _note(880,0.13,'sine',0.18); _note(1174,0.22,'sine',0.18,0.12); break;
    case 'tap': _note(660,0.04,'sine',0.07); break;
  }
}

/* ============ VRAIE ALARME (son répété + vibration + écran d'arrêt) ============ */
let _alarmIv=null, _alarmStart=0;
function alarmRing(){
  // motif d'alarme mélodique (joué en boucle), volume plus fort que les sfx
  if(soundsOn()){
    const seq=[[880,0],[1175,0.18],[880,0.36],[1175,0.54]];
    seq.forEach(([f,d])=>_note(f,0.16,'square',0.32,d));
    _note(660,0.5,'sine',0.18,0.74);
  }
  if(navigator.vibrate) navigator.vibrate([400,150,400,150,400]);
}
function startAlarm(title,msg){
  stopAlarm();
  _alarmStart=Date.now();
  try{ audioCtx(); }catch(e){}
  alarmRing();
  _alarmIv=setInterval(alarmRing,1300);
  // sécurité : arrêt automatique après 60 s
  setTimeout(()=>{ if(_alarmIv) stopAlarm(); },60000);
  notify(title||'⏰ Alarme',msg||'Le temps est écoulé !');
  showAlarmScreen(title||'⏰ Temps écoulé !',msg||'');
}
function stopAlarm(){
  if(_alarmIv){ clearInterval(_alarmIv); _alarmIv=null; }
  if(navigator.vibrate) navigator.vibrate(0);
  const o=$('#alarmOv'); if(o) o.remove();
}
function showAlarmScreen(title,msg){
  const old=$('#alarmOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.id='alarmOv';
  ov.style.cssText='position:fixed;inset:0;z-index:14000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(5,7,10,.92);backdrop-filter:blur(8px);text-align:center;padding:24px;animation:fade .3s';
  ov.innerHTML='<div style="font-size:84px;animation:alarmShake .5s ease-in-out infinite">⏰</div>'+
    '<div class="man" style="font-weight:800;font-size:28px;margin-top:14px">'+title+'</div>'+
    (msg?'<div style="color:var(--muted);font-size:15px;margin-top:8px">'+msg+'</div>':'')+
    '<button class="btn" style="margin-top:28px;max-width:240px;font-size:17px;padding:16px" onclick="stopAlarm()">Arrêter l\u2019alarme</button>'+
    '<button class="btn ghost" style="margin-top:10px;max-width:240px" onclick="snoozeAlarm()">⏱ Rappel dans 5 min</button>';
  ov.onclick=(e)=>{ if(e.target===ov) {} };
  document.body.appendChild(ov);
}
function snoozeAlarm(){
  stopAlarm();
  toast('🔔 Rappel dans 5 min');
  setTimeout(()=>startAlarm('⏰ Rappel','5 minutes écoulées'),5*60*1000);
}

/* ============ NOTIFICATIONS & ACTIVITÉ EN ARRIÈRE-PLAN ============ */
let _wakeLock=null, _bgActivity=null;
function ensureNotifPerm(){ if('Notification'in window && Notification.permission==='default'){ try{ Notification.requestPermission(); }catch(e){} } }
function notify(title,body){
  if(P.notif===false) return;
  if('Notification'in window && Notification.permission==='granted'){
    try{ const n=new Notification(title,{body,icon:appIconDataURL(),badge:appIconDataURL(),tag:'ikorun',renotify:true}); setTimeout(()=>n.close(),6000); return; }catch(e){}
  }
  sfx('notif');
}
let _bgNotif=null, _bgTick=null;
async function startBgActivity(type){
  _bgActivity={type,start:Date.now(),paused:false};
  try{ if('wakeLock'in navigator){ _wakeLock=await navigator.wakeLock.request('screen'); } }catch(e){}
  // Une seule notification fixe au démarrage — pas de recréation en boucle (ça spammait avant)
  clearInterval(_bgTick); _bgTick=null;
  if(P.notif!==false && 'Notification'in window && Notification.permission==='granted'){
    try{ if(_bgNotif){ _bgNotif.close(); _bgNotif=null; } }catch(e){}
    try{ _bgNotif=new Notification('IKORUN · '+type,{body:'▶ Séance en cours',icon:appIconDataURL(),tag:'ikorun-activity',renotify:false,silent:true}); }catch(e){}
  }
}
function pauseBgActivity(p){
  if(_bgActivity) _bgActivity.paused=p;
  // Met à jour la même notification une seule fois (pas de boucle) quand on met en pause / reprend
  if(_bgActivity && P.notif!==false && 'Notification'in window && Notification.permission==='granted'){
    try{ if(_bgNotif) _bgNotif.close(); }catch(e){}
    try{ _bgNotif=new Notification('IKORUN · '+_bgActivity.type,{body:(p?'⏸ En pause':'▶ En cours'),icon:appIconDataURL(),tag:'ikorun-activity',renotify:false,silent:true}); }catch(e){}
  }
}
function stopBgActivity(){
  _bgActivity=null; clearInterval(_bgTick);
  try{ if(_bgNotif){ _bgNotif.close(); _bgNotif=null; } }catch(e){}
  try{ if(_wakeLock){ _wakeLock.release(); _wakeLock=null; } }catch(e){}
}
// Réacquiert le wake lock au retour de veille si une activité tourne
document.addEventListener('visibilitychange',async()=>{
  if(document.visibilityState==='visible' && _bgActivity && !_wakeLock){
    try{ if('wakeLock'in navigator) _wakeLock=await navigator.wakeLock.request('screen'); }catch(e){}
  }
});
function appIconDataURL(){ return "icon-192.png"; }
function ripple(e){
  const b=e.currentTarget, r=document.createElement('span'); r.className='ripple';
  const rect=b.getBoundingClientRect(), sz=Math.max(rect.width,rect.height);
  r.style.width=r.style.height=sz+'px';
  r.style.left=(e.clientX-rect.left-sz/2)+'px'; r.style.top=(e.clientY-rect.top-sz/2)+'px';
  b.appendChild(r); setTimeout(()=>r.remove(),600);
}
document.addEventListener('click',e=>{ const b=e.target.closest('.btn'); if(b) ripple.call(null,Object.assign(e,{currentTarget:b})); });

/* ---------- CONFETTI ---------- */
function burst(){
  const c=$('#confetti'), ctx=c.getContext('2d');
  c.width=innerWidth; c.height=innerHeight;
  const cols=['#3D7FFF','#F2B84B','#33D399','#FF5C6C','#9FD8FF','#A98CF0'];
  let parts=[];
  for(let i=0;i<120;i++) parts.push({x:innerWidth/2,y:innerHeight/3,vx:(Math.random()-.5)*16,vy:(Math.random()-1)*16,
    s:4+Math.random()*6,c:cols[i%cols.length],r:Math.random()*6,vr:(Math.random()-.5)*.4,life:1});
  let f=0;
  (function loop(){
    ctx.clearRect(0,0,c.width,c.height); f++;
    parts.forEach(p=>{ p.vy+=.5; p.x+=p.vx; p.y+=p.vy; p.r+=p.vr; p.life-=.012;
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.r); ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.c; ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*1.6); ctx.restore(); });
    if(f<110) requestAnimationFrame(loop); else ctx.clearRect(0,0,c.width,c.height);
  })();
}

/* ---------- OVERLAYS ---------- */
function openOv(id){ $('#'+id).classList.add('on'); }
function closeOv(id){ $('#'+id).classList.remove('on'); if(id==='ovProg') _pfSheet=null; if(id==='ovLib'&&typeof _exDemoTimer!=='undefined'){ clearInterval(_exDemoTimer); } if((id==='ovProg'||id==='ovLive')&&typeof _exDemo2!=='undefined'&&_exDemo2){ clearInterval(_exDemo2); _exDemo2=null; } }

/* ============ WHEEL PICKER réutilisable ============ */
const PK_H=42;
function haptic(){ if(navigator.vibrate) navigator.vibrate(8); }
/* config: { title, cols:[{values:[], sel:idx, unit?, fmt?}], seps:[], onOk:(indices)=>{} } */
let _pkCfg=null;
function openPicker(cfg){
  _pkCfg=cfg;
  $('#pkTitle').textContent=cfg.title||'Choisir';
  const wrap=$('#pkWheels'); wrap.innerHTML='';
  // Ouvre l'overlay AVANT de positionner les roues : sur iOS Safari, définir scrollTop
  // sur un élément encore display:none est ignoré, ce qui faisait retomber le curseur au minimum.
  openOv('ovPicker');
  cfg.cols.forEach((col,ci)=>{
    if(ci>0 && cfg.seps && cfg.seps[ci-1]!=null){ const s=document.createElement('div'); s.className='pk-sep'; s.textContent=cfg.seps[ci-1]; wrap.appendChild(s); }
    const c=document.createElement('div'); c.className='pkcol'+(col.wide?' wide':''); c.dataset.ci=ci;
    let inner='<div class="pk-pad"></div>';
    col.values.forEach((v,i)=>{ inner+='<div class="pkitem" data-i="'+i+'">'+(col.fmt?col.fmt(v):v)+'</div>'; });
    inner+='<div class="pk-pad"></div>';
    c.innerHTML=inner;
    wrap.appendChild(c);
    if(col.unit){ const u=document.createElement('div'); u.className='pk-unit'; u.textContent=col.unit; wrap.appendChild(u); }
    const items=c.querySelectorAll('.pkitem');
    col._last=col.sel;
    // Met à jour l'apparence selon la distance au centre (zoom progressif fluide)
    function paint(){
      const center=c.scrollTop/PK_H; // index flottant centré
      items.forEach((it,i)=>{
        const d=Math.abs(i-center);
        if(d<0.5) it.classList.add('sel'); else it.classList.remove('sel');
        const scale=Math.max(.7,1.18-d*0.22);
        const op=Math.max(.25,1-d*0.32);
        it.style.transform='scale('+scale.toFixed(3)+')';
        it.style.opacity=op.toFixed(2);
      });
    }
    // init position (après ouverture de l'overlay) — appliqué plusieurs fois pour garantir la fiabilité
    const applyInitPos=()=>{ c.scrollTop=col.sel*PK_H; paint(); };
    applyInitPos();
    requestAnimationFrame(()=>{ requestAnimationFrame(applyInitPos); });
    setTimeout(applyInitPos,150);
    let raf,settle;
    c.addEventListener('scroll',()=>{
      if(raf) cancelAnimationFrame(raf);
      raf=requestAnimationFrame(paint);
      const idx=Math.max(0,Math.min(col.values.length-1,Math.round(c.scrollTop/PK_H)));
      if(col._last!==idx){ col._last=idx; col.sel=idx; haptic(); }
      // snap uniquement quand le défilement s'arrête réellement
      clearTimeout(settle);
      settle=setTimeout(()=>{
        const target=Math.max(0,Math.min(col.values.length-1,Math.round(c.scrollTop/PK_H)));
        col.sel=target;
        if(Math.abs(c.scrollTop-target*PK_H)>1) c.scrollTo({top:target*PK_H,behavior:'smooth'});
        paint();
      },120);
    },{passive:true});
  });
  $('#pkOk').onclick=()=>{ const idx=cfg.cols.map(c=>c.sel); closeOv('ovPicker'); if(cfg.onOk)cfg.onOk(idx); };
}
/* Helpers de ranges */
function range(a,b,step){ const o=[]; step=step||1; for(let i=a;i<=b;i+=step)o.push(i); return o; }
/* Picker Temps h:mm:ss → secondes */
function pickTime(title,initSec,cb,withHours){
  initSec=initSec||0;
  const h=Math.floor(initSec/3600), m=Math.floor((initSec%3600)/60), s=Math.floor(initSec%60);
  const cols=[]; const seps=[];
  if(withHours!==false){ cols.push({values:range(0,9),sel:h,unit:'h'}); seps.push(':'); }
  cols.push({values:range(0,59),sel:m,unit:'min',fmt:v=>String(v).padStart(2,'0')}); seps.push(':');
  cols.push({values:range(0,59),sel:s,unit:'s',fmt:v=>String(v).padStart(2,'0')});
  openPicker({title:title||'Temps',cols,seps,onOk:idx=>{ let sec; if(withHours!==false){ sec=idx[0]*3600+idx[1]*60+idx[2]; } else { sec=idx[0]*60+idx[1]; } cb(sec); }});
}
/* Picker Allure mm:ss /km → sec/km */
function pickPace(title,initSpk,cb){
  initSpk=initSpk||270; const m=Math.floor(initSpk/60), s=Math.floor(initSpk%60);
  openPicker({title:title||'Allure',cols:[{values:range(2,12),sel:Math.max(0,m-2)},{values:range(0,59),sel:s,fmt:v=>String(v).padStart(2,'0'),unit:'/km'}],seps:[':'],onOk:idx=>cb((idx[0]+2)*60+idx[1])});
}
/* Picker Distance (km entiers + décimales) → km */
function pickDistance(title,initKm,cb){
  initKm=initKm||10; const whole=Math.floor(initKm), dec=Math.round((initKm-whole)*10);
  openPicker({title:title||'Distance',cols:[{values:range(0,99),sel:Math.min(99,whole)},{values:range(0,9),sel:dec,unit:'km'}],seps:['.'],onOk:idx=>cb(idx[0]+idx[1]/10)});
}
/* Picker entier simple */
function pickInt(title,min,max,init,unit,cb,step){
  step=step||1; const vals=range(min,max,step); const sel=Math.max(0,vals.indexOf(init)); 
  openPicker({title,cols:[{values:vals,sel:sel<0?0:sel,unit}],onOk:idx=>cb(vals[idx[0]])});
}
/* Picker Vitesse km/h (entier.décimale) */
function pickSpeed(title,init,cb){
  init=init||12; const whole=Math.floor(init), dec=Math.round((init-whole)*10);
  openPicker({title:title||'Vitesse',cols:[{values:range(1,40),sel:Math.max(0,whole-1)},{values:range(0,9),sel:dec,unit:'km/h'}],seps:['.'],onOk:idx=>cb((idx[0]+1)+idx[1]/10)});
}

/* ---------- NAV ---------- */
const TITLES={home:['Accueil',''],sport:['Sport','Running & Musculation'],stats:['Statistiques','Tes données réelles'],outils:['Outils','Calculs & timers'],profil:['Profil','']};
function positionNavPill(btn){
  // Mesure réelle du bouton pour que la pastille soit toujours parfaitement
  // centrée sous l'onglet actif, quel que soit le nombre d'onglets ou le
  // padding du conteneur (évite le décalage causé par un calc() en %% fixe).
  if(!btn) return;
  const nav=document.getElementById('nav'), pill=document.getElementById('nav-pill');
  if(!nav||!pill) return;
  const navRect=nav.getBoundingClientRect(), btnRect=btn.getBoundingClientRect();
  const pad=3; // marge interne autour du bouton pour l'effet "capsule"
  pill.style.left=(btnRect.left-navRect.left+pad)+'px';
  pill.style.width=(btnRect.width-pad*2)+'px';
}
function nav(s){
  $$('.scr').forEach(el=>el.classList.remove('on'));
  $('#s-'+s).classList.add('on');
  $$('.nb').forEach(b=>b.classList.remove('on'));
  const btn=document.querySelector('.nb[data-s="'+s+'"]');
  btn.classList.add('on');
  positionNavPill(btn);
  const subs={home:'',sport:t('sub_sport'),stats:t('sub_stats'),outils:t('sub_outils'),profil:''};
  document.body.dataset.scr=s;
  $('#tbTitle').textContent=t(s);
  $('#tbSub').textContent= s==='home'?greet():subs[s];
  const av=$('#tbAvatar'); if(av){ if(P.photo){ av.style.background='url('+P.photo+') center/cover'; av.textContent=''; } else { av.style.background='var(--ed)'; av.style.color='var(--e)'; av.style.fontWeight='800'; av.textContent=P.name?P.name[0].toUpperCase():'?'; } }
  $('#scroll').scrollTop=0;
  if(s==='home') renderHome();
  if(s==='sport'){ renderSport(); setTimeout(checkMissedSessions,300); }
  if(s==='stats') renderStats();
  if(s==='outils') renderOutils();
  if(s==='profil') renderProfile();
  markScreenSeen('s-'+s);
}
/* Marque un écran comme "déjà vu" une fois ses animations d'entrée jouées,
   pour qu'elles ne se répètent plus à chaque retour sur l'onglet. */
const _seenScreens={};
function markScreenSeen(id){
  if(_seenScreens[id]) return; // déjà marqué, rien à refaire
  _seenScreens[id]=true;
  setTimeout(()=>{ const el=document.getElementById(id); if(el) el.setAttribute('data-seen','1'); },900);
}
$$('.nb').forEach(b=>b.onclick=()=>nav(b.dataset.s));

/* ---------- APPUI LONG + GLISSER pour changer d'onglet (style iOS) ---------- */
(function(){
  const navEl=document.getElementById('nav'); if(!navEl) return;
  let pressTimer=null, dragMode=false, startX=0, startY=0, lastTab=null, suppressClick=false;
  function tabAt(x,y){ const el=document.elementFromPoint(x,y); return el && el.closest('.nb'); }
  navEl.addEventListener('touchstart',e=>{
    const tt=e.touches[0]; startX=tt.clientX; startY=tt.clientY;
    const nb=e.target.closest('.nb'); if(!nb) return;
    clearTimeout(pressTimer);
    pressTimer=setTimeout(()=>{
      dragMode=true; suppressClick=true; navEl.classList.add('nav-dragging');
      lastTab=nb.dataset.s; nav(lastTab);
      if(navigator.vibrate) navigator.vibrate(9);
    },320);
  },{passive:true});
  navEl.addEventListener('touchmove',e=>{
    const tt=e.touches[0];
    if(!dragMode){
      if(Math.abs(tt.clientX-startX)>10||Math.abs(tt.clientY-startY)>10) clearTimeout(pressTimer);
      return;
    }
    e.preventDefault();
    const nb=tabAt(tt.clientX,tt.clientY);
    if(nb && nb.dataset.s!==lastTab){ lastTab=nb.dataset.s; nav(lastTab); if(navigator.vibrate) navigator.vibrate(5); }
  },{passive:false});
  navEl.addEventListener('touchend',()=>{
    clearTimeout(pressTimer);
    if(dragMode){ dragMode=false; navEl.classList.remove('nav-dragging'); setTimeout(()=>{suppressClick=false;},60); }
  });
  navEl.addEventListener('click',e=>{ if(suppressClick){ e.stopImmediatePropagation(); e.preventDefault(); } },true);
})();
function greet(){ const h=new Date().getHours(); const l=curLang();
  const G={fr:[h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir'],en:[h<12?'Good morning':h<18?'Good afternoon':'Good evening'],ar:['مرحباً']};
  return (G[l]||G.fr)[0]+', '+(P.name||t('profil'))+' 👋'; }

/* ---------- INIT ---------- */
/* Fige les animations d'ambiance (icônes flottantes, halos, reflets...) une fois
   que l'écran a eu le temps de s'afficher, au lieu de les laisser boucler
   indéfiniment. Rejoue depuis zéro à chaque appel (nouvel écran / re-login). */
function scheduleMotionSettle(delay){
  document.documentElement.classList.remove('motion-settled');
  clearTimeout(window._motionSettleT);
  window._motionSettleT=setTimeout(()=>{ document.documentElement.classList.add('motion-settled'); }, delay||1400);
}
function hideAppSkeleton(){
  const el=document.getElementById('appSkeleton'); if(!el) return;
  el.classList.add('out');
  setTimeout(()=>{ el.remove(); },420);
}
/* ---------- FIX SCROLL BLOQUÉ (bug iOS WebKit) ----------
   Quand le contenu de #scroll est remplacé (re-render) pendant que l'utilisateur
   est en train de faire défiler, Safari perd parfois le fil du scroll momentum
   et l'écran "se fige" tant qu'on n'a pas retapé un onglet. On force WebKit à
   ré-évaluer le scroll en togglant overflow, et on évite de re-render pendant
   qu'un doigt est activement sur l'écran. */
let _lastScrollTouch=0;
(function(){
  const sc=document.getElementById('scroll'); if(!sc) return;
  const mark=()=>{ _lastScrollTouch=Date.now(); };
  sc.addEventListener('touchstart',mark,{passive:true});
  sc.addEventListener('touchmove',mark,{passive:true});
})();
function nudgeScroll(){
  const sc=document.getElementById('scroll'); if(!sc) return;
  const y=sc.scrollTop;
  sc.style.overflowY='hidden';
  requestAnimationFrame(()=>{ sc.style.overflowY='auto'; sc.scrollTop=y; });
}
function boot(){
  hideAppSkeleton();
  applyTheme(); // applique le mode (clair/sombre) dès le démarrage
  checkConnectivity();
  if(P.notif!==false) ensureNotifPerm();
  positionNavPill(document.querySelector('.nb.on')||document.querySelector('.nb'));
  window.addEventListener('resize',()=>positionNavPill(document.querySelector('.nb.on')));
  if(!P.setupDone){ startOnboarding(); return; }  // création profil
  initApp();                                      // app
}

/* ============ CONNEXION / COMPTE (Supabase) ============ */
function startLogin(){ hideAppSkeleton(); $('#login').classList.add('on'); scheduleMotionSettle(2200); }
function endLogin(){ $('#login').classList.remove('on'); }

async function startApp(){
  if(!window.supabaseClient){ boot(); return; }
  const { data:{ session } } = await window.supabaseClient.auth.getSession();
  if(session && session.user){
    window.currentUserId = session.user.id;
    window.currentUserEmail = session.user.email;
    await cloudPullAll(session.user.id);
    reloadState();
    saveAll();
    endLogin();
    boot();
    ensurePublicProfile().then(syncPublicProfile);
  } else {
    startLogin();
  }
  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if(event === 'SIGNED_IN' && session){
      window.currentUserId = session.user.id;
      window.currentUserEmail = session.user.email;
      await cloudPullAll(session.user.id);
      reloadState();
      saveAll();
      endLogin();
      toast('Bienvenue 👋');
      sfx&&sfx('goal');
      boot();
      ensurePublicProfile().then(syncPublicProfile);
    } else if(event === 'SIGNED_OUT'){
      location.reload();
    }
  });
}

function logout(){ signOutUser(); }
function switchAccount(){ signOutUser(); }
function initApp(){
  $('#ob').classList.remove('on');
  applyTheme();
  document.documentElement.lang=curLang();
  document.documentElement.dir=(curLang()==='ar')?'rtl':'ltr';
  applyNavLabels();
  P.vdot=computeVDOTfromRecords()||computeVDOT();
  getDailyGoals();
  refreshXP();
  nav('home');
  scheduleMotionSettle(1400);
  // Reprise automatique d'une séance muscu interrompue
  setTimeout(maybeResumeLive,600);
  // Régénération hebdomadaire adaptative du plan (au moins 1x/semaine si nécessaire)
  setTimeout(weeklyAdaptiveRegen,800);
}
function maybeResumeLive(){
  const snap=DB.load('live_active'); if(!snap||LIVE) return;
  const base=allProgs().find(x=>x.id===snap.progId); if(!base){ DB.remove('live_active'); return; }
  // On repart de la liste d'exercices sauvegardée dans la séance (progEx) si elle existe,
  // pour ne pas perdre les ajouts/suppressions faits en pleine séance avant le rechargement.
  const prog={...base,ex:snap.progEx||base.ex};
  const mins=Math.round((Date.now()-snap.start)/60000);
  if(mins>180){ DB.remove('live_active'); return; } // trop vieux
  if(confirm('Une séance « '+prog.name+' » était en cours ('+mins+' min). Reprendre ?')){
    LIVE={prog,idx:snap.idx,start:snap.start,state:snap.state,tonnage:snap.tonnage,setsDone:snap.setsDone};
    liveOpenEx=snap.idx||0;
    renderLive(); openOv('ovLive'); liveTimer=setInterval(updateLiveTimer,500); startBgActivity('Séance : '+prog.name);
  } else { DB.remove('live_active'); }
}

/* ---------- ONBOARDING ---------- */
let obStep=1; const OB_MAX=7;
let obEasy=false; // true si >26 ans → onboarding allégé (niveau, objectif, date, record seulement) + mode simplifié auto
function startOnboarding(){
  obEasy=false;
  $('#ob').classList.add('on');
  const prog=$('#obProg'); prog.innerHTML='';
  for(let i=1;i<=OB_MAX;i++){ const d=document.createElement('div'); if(i===1)d.classList.add('on'); prog.appendChild(d); }
  // pill selectors
  $('#ob_level').querySelectorAll('.pill').forEach(p=>p.onclick=()=>{ $('#ob_level').querySelectorAll('.pill').forEach(x=>x.classList.remove('on')); p.classList.add('on'); });
  $('#ob_days').querySelectorAll('.pill').forEach(p=>p.onclick=()=>p.classList.toggle('on'));
  OB_PERFS=[{dist:null,meters:null,timeS:null}];
  renderPerfRows();
  obUsernameOk=false;
  wireUsernameField('ob_username','ob_username_status',ok=>{ obUsernameOk=ok; });
  obShow(1);
}
let obUsernameOk=false;
/* ===== Étape Performances : lignes Distance | Temps ===== */
let OB_PERFS=[{dist:null,meters:null,timeS:null}];
function renderPerfRows(){
  const box=$('#ob_perfs'); if(!box) return;
  let h='';
  OB_PERFS.forEach((p,i)=>{
    h+='<div class="perfrow">';
    h+='<div class="perfcard" onclick="pickPerfDist('+i+')"><div class="pcl">🏁 Distance</div><div class="pcv '+(p.dist?'':'empty')+'">'+(p.dist||'Choisir')+'</div></div>';
    h+='<div class="perfcard" onclick="pickPerfTime('+i+')"><div class="pcl">⏱ Temps</div><div class="pcv '+(p.timeS!=null?'':'empty')+'">'+(p.timeS!=null?fmtTime(p.timeS):'Choisir')+'</div></div>';
    if(OB_PERFS.length>1) h+='<div class="perfdel" onclick="delPerfRow('+i+')">🗑</div>';
    h+='</div>';
  });
  box.innerHTML=h;
}
function addPerfRow(){ OB_PERFS.push({dist:null,meters:null,timeS:null}); renderPerfRows(); }
function openLevelGuide(){
  const lv=[
    ['🌱 Débutant','Tu cours depuis moins d\u2019un an. Tu t\u2019entraînes occasionnellement et tu découvres encore les bases.'],
    ['🏃 Intermédiaire','Tu cours régulièrement, participes parfois à des compétitions et maîtrises les principaux types de séances.'],
    ['⚡ Confirmé','Plusieurs années d\u2019entraînement, une pratique structurée et des objectifs chronométriques précis.'],
    ['🔥 Très avancé','Entraînement intensif, plusieurs compétitions par an, très bon niveau régional ou national.'],
    ['🏆 Élite','Athlète de haut niveau : performances nationales/internationales, entraînement quotidien à très gros volume.']
  ];
  let h=lv.map(x=>'<div class="card" style="margin-bottom:10px;padding:14px"><div style="font-weight:700;font-size:15px;margin-bottom:5px">'+x[0]+'</div><div style="font-size:13px;color:var(--muted);line-height:1.5">'+x[1]+'</div></div>').join('');
  h+='<button class="btn" onclick="closeOv(\'ovProg\')">Compris 👍</button>';
  $('#ovProgTitle').textContent='Comment choisir mon niveau ?'; $('#progBody').innerHTML=h;
  // place l'overlay au-dessus de l'onboarding
  $('#ovProg').style.zIndex='13700'; openOv('ovProg');
}
function delPerfRow(i){ OB_PERFS.splice(i,1); renderPerfRows(); }
function pickPerfDist(i){
  const names=REC_DISTANCES.map(d=>d[0]).concat(['Autre']);
  openPicker({title:'Distance',cols:[{values:names,sel:Math.max(0,names.indexOf(OB_PERFS[i].dist)),wide:true}],onOk:idx=>{
    const name=names[idx[0]];
    if(name==='Autre'){ pickDistance('Distance personnalisée',OB_PERFS[i].meters?OB_PERFS[i].meters/1000:5,km=>{ OB_PERFS[i].dist=(km>=1?km+' km':Math.round(km*1000)+' m'); OB_PERFS[i].meters=Math.round(km*1000); renderPerfRows(); }); }
    else { const d=REC_DISTANCES[idx[0]]; OB_PERFS[i].dist=d[0]; OB_PERFS[i].meters=d[1]; renderPerfRows(); }
  }});
}
function pickPerfTime(i){
  const m=OB_PERFS[i].meters||5000; const longRace=m>=15000;
  pickTime('Temps · '+(OB_PERFS[i].dist||''),OB_PERFS[i].timeS!=null?OB_PERFS[i].timeS:(m>=10000?2700:m>=5000?1200:300),v=>{ OB_PERFS[i].timeS=v; renderPerfRows(); },longRace);
}
function obShow(n){
  obStep=n;
  $$('.ob-step').forEach(s=>s.classList.toggle('on',+s.dataset.step===n));
  $('#obProg').querySelectorAll('div').forEach((d,i)=>d.classList.toggle('on',i<n));
  $('#obPrev').style.visibility=n===1?'hidden':'visible';
  $('#obNext').textContent=n===OB_MAX?'Terminer 🚀':'Continuer';
  $('#ob').scrollTop=0;
}
$('#obPrev').onclick=()=>{
  if(obStep<=1) return;
  const prev=(obEasy&&obStep===4)?2:obStep-1; // saute l'étape taille/poids en retour aussi
  obShow(prev);
};
$('#obNext').onclick=()=>{
  if(!obValidate(obStep)) return;
  if(obStep===OB_MAX){ finishOnboarding(); return; }
  const next=(obEasy&&obStep===2)?4:obStep+1; // profil rapide : on saute taille/poids
  obShow(next);
};
function obv(id){ const el=$('#'+id); return el.dataset.v!==undefined&&el.classList.contains('pkfield')?el.dataset.v:el.value; }
function setObPk(id,val,label){ const el=$('#'+id); el.dataset.v=val; el.textContent=label; el.classList.add('set'); }
function pickWeightOb(){ openPicker({title:'Poids (kg)',cols:[{values:range(30,200),sel:30},{values:range(0,9),sel:0,unit:'kg'}],seps:['.'],onOk:idx=>{ const w=(idx[0]+30)+idx[1]/10; setObPk('ob_w',w,w+' kg'); }}); }
function obValidate(n){
  if(n===2){
    if(!$('#ob_name').value.trim()||!$('#ob_bday').value||!$('#ob_sex').value||!$('#ob_city').value.trim()){ toast('Remplis les champs requis'); return false; }
    if(!$('#ob_username').value.trim()){ toast('Choisis un nom d\u2019utilisateur'); return false; }
    if(!obUsernameOk){ toast('Ce nom d\u2019utilisateur n\u2019est pas disponible'); return false; }
    const bd=new Date($('#ob_bday').value);
    const ageYears=Math.floor((Date.now()-bd)/31557600000);
    obEasy = ageYears>26;
    if(obEasy) toast('Profil rapide activé — on va droit à l\u2019essentiel ✓');
  }
  if(n===3){ if(!obv('ob_h')||!obv('ob_w')){ toast('Taille et poids requis'); return false; } }
  if(n===4){ if(!$('#ob_level').querySelector('.pill.on')){ toast('Choisis un niveau'); return false; } if(!obv('ob_km')){ toast('Choisis ton volume'); return false; } }
  if(n===5){ if(!$('#ob_goal').value.trim()||!$('#ob_compdate').value){ toast('Objectif et date requis'); return false; } }
  if(n===6){ const valid=OB_PERFS.filter(p=>p.meters&&p.timeS); if(!valid.length){ toast('Ajoute au moins une performance'); return false; } }
  if(n===7){ if(!$('#ob_days').querySelector('.pill.on')||!obv('ob_time')){ toast('Jours et temps requis'); return false; } }
  return true;
}
function finishOnboarding(){
  const days=[...$('#ob_days').querySelectorAll('.pill.on')].map(p=>+p.dataset.v);
  // Enregistre les performances saisies
  const valid=OB_PERFS.filter(p=>p.meters&&p.timeS!=null);
  RECORDS=valid.map(p=>({dist:p.dist,meters:p.meters,time:fmtTime(p.timeS),date:todayKey()}));
  const find=m=>{ const r=valid.find(x=>x.meters===m); return r?fmtTime(r.timeS):''; };
  P={
    setupDone:true,
    name:$('#ob_name').value.trim(), username:$('#ob_username').value.trim(), bday:$('#ob_bday').value, sex:$('#ob_sex').value, city:$('#ob_city').value.trim(),
    height:+obv('ob_h'), weight:+obv('ob_w'),
    level:$('#ob_level').querySelector('.pill.on').dataset.v, kmWeek:+obv('ob_km')||40,
    goal:$('#ob_goal').value.trim(), compDate:$('#ob_compdate').value,
    t5k:find(5000), t3k:find(3000), t1500:find(1500), t10k:find(10000),
    days, sessionTime:+obv('ob_time')||60, coach:$('#ob_coach').value.trim(),
    theme:'blue', pb5k:find(5000), pb1500:find(1500), pb10k:find(10000),
    easyMode:obEasy // >26 ans → mode simplifié activé auto (modifiable ensuite dans Profil > Mode simplifié)
  };
  P.vdot=computeVDOTfromRecords()||computeVDOT();
  DB.save('profile',P); DB.save('records',RECORDS); DB.save('xp',XP);
  burst();
  if(P.username){
    claimUsername(P.username).then(ok=>{
      if(!ok) toast('⚠️ Pseudo pris entre-temps, modifie-le dans Profil');
    });
  }
  setTimeout(initApp,400);
}

/* ---------- THEME ---------- */
function effectiveMode(){ return P.mode==='light' ? 'light' : 'dark'; }
function applyTheme(){
  const mode=effectiveMode();
  document.documentElement.setAttribute('data-mode',mode);
  document.documentElement.setAttribute('data-accent',P.theme||'blue');
  document.documentElement.classList.toggle('easy-mode',!!P.easyMode);
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=(P.easyMode?(mode==='light'?'#FFFFFF':'#000000'):(mode==='light'?'#F2F4F8':'#0A0D12'));
}
/* Couleur d'accent de l'app : bleu (défaut) / vert militaire chromé / marron boisé chromé */
const ACCENTS=[{key:'blue',name:'Bleu'},{key:'green',name:'Vert militaire'},{key:'brown',name:'Marron boisé'},{key:'yellow',name:'Jaune'},{key:'carbon',name:'Fibre de carbone'}];
function setAccent(c){
  P.theme=c; saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  refreshPfSheet();
  sfx&&sfx('tap');
  toast('Couleur appliquée ✓');
}
function pfAccentPickerHTML(){
  const cur=P.theme||'blue';
  return '<div class="accent-picker">'+ACCENTS.map(a=>
    '<div class="accent-dot'+(cur===a.key?' on':'')+'" data-a="'+a.key+'" title="'+a.name+'" onclick="event.stopPropagation();setAccent(\''+a.key+'\')"></div>'
  ).join('')+'</div>';
}
function toggleEasyMode(){
  P.easyMode=!P.easyMode; saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  if($('#s-home')&&$('#s-home').classList.contains('on')) renderHome();
  toast(P.easyMode?'Mode simplifié activé ✓':'Mode simplifié désactivé');
}
function setMode(m){ P.mode=(m==='light')?'light':'dark'; saveAll(); applyTheme(); if($('#s-profil')&&$('#s-profil').classList.contains('on'))renderProfile(); refreshPfSheet(); }
// suit le thème du téléphone en mode auto


/* ---------- EXERCISE LIBRARY (100+) ---------- */
const LIB=[
 // Pectoraux
 {name:'Bench Press',sets:4,reps:'12',muscles:['Pectoraux','Triceps'],anim:'🏋️',tip:'Garde les omoplates serrées et les pieds ancrés au sol.'},
 {name:'Decline Bench Press',sets:4,reps:'12',muscles:['Pectoraux bas'],anim:'🏋️',tip:'Cible le bas des pectoraux, descends contrôlé.'},
 {name:'Dumbbell Incline Bench Press',sets:4,reps:'12',muscles:['Pectoraux haut'],anim:'💪',tip:'Banc à 30°, amplitude complète.'},
 {name:'Lever Seated Fly',sets:3,reps:'8',muscles:['Pectoraux'],anim:'🦋',tip:'Serre les pectoraux en fin de mouvement, 1s de pause.'},
 {name:'Cable Crossover',sets:3,reps:'12-15',muscles:['Pectoraux'],anim:'🔀',tip:'Légère flexion du buste, contraction au centre.'},
 {name:'Push Up',sets:3,reps:'AMRAP',muscles:['Pectoraux','Triceps'],anim:'🤸',tip:'Gainage parfait, ne creuse pas le dos.'},
 {name:'Dumbbell Pullover',sets:3,reps:'12',muscles:['Pectoraux','Dos'],anim:'🛢️',tip:'Étire la cage thoracique, coudes semi-fléchis.'},
 // Dos
 {name:'Lever Lying T-bar Row',sets:3,reps:'10-12',muscles:['Dos','Trapèzes'],anim:'🚣',tip:'Tire avec les coudes, serre les omoplates.'},
 {name:'Straight Back Seated Row',sets:3,reps:'6-10',muscles:['Dos'],anim:'🚣',tip:'Dos droit, ne te penche pas en arrière.'},
 {name:'Bar Lateral Pulldown',sets:3,reps:'8-10',muscles:['Grand dorsal'],anim:'🪢',tip:'Tire la barre vers la poitrine, coudes vers le bas.'},
 {name:'Pull Up',sets:3,reps:'AMRAP',muscles:['Grand dorsal','Biceps'],anim:'🧗',tip:'Amplitude complète, contrôle la descente.'},
 {name:'Deadlift',sets:4,reps:'5',muscles:['Dos','Fessiers','Ischios'],anim:'🏋️',tip:'Dos neutre, pousse avec les jambes.'},
 {name:'Bent Over Row',sets:4,reps:'8-10',muscles:['Dos'],anim:'🚣',tip:'Buste à 45°, gainage permanent.'},
 {name:'Single Arm Dumbbell Row',sets:3,reps:'10-12',muscles:['Dos'],anim:'💪',tip:'Appui sur banc, tire le coude haut.'},
 {name:'Lever Reverse Fly',sets:3,reps:'12-15',muscles:['Arrière épaules','Dos'],anim:'🦋',tip:'Cible les deltoïdes postérieurs.'},
 // Biceps
 {name:'EZ-bar 21s',sets:4,reps:'21',muscles:['Biceps'],anim:'💪',tip:'7 bas + 7 haut + 7 complets, sans tricher.'},
 {name:'Hammer Curl',sets:4,reps:'6-12',muscles:['Biceps','Avant-bras'],anim:'🔨',tip:'Prise neutre, coudes fixes.'},
 {name:'Biceps Curl',sets:4,reps:'12',muscles:['Biceps'],anim:'💪',tip:'Pas de balancier, contraction complète.'},
 {name:'Lever Preacher Curl',sets:3,reps:'4-10',muscles:['Biceps'],anim:'🪑',tip:'Bras calés, descente lente.'},
 {name:'Concentration Curl',sets:3,reps:'10-12',muscles:['Biceps'],anim:'💪',tip:'Isole le biceps, coude contre la cuisse.'},
 {name:'Cable Curl',sets:3,reps:'12-15',muscles:['Biceps'],anim:'🪢',tip:'Tension continue tout le mouvement.'},
 // Triceps
 {name:'Skull Crusher',sets:4,reps:'12',muscles:['Triceps'],anim:'💀',tip:'Coudes fixes, descends vers le front.'},
 {name:'Elbow Dips',sets:3,reps:'6-8',muscles:['Triceps','Pectoraux'],anim:'🤸',tip:'Buste droit pour cibler triceps.'},
 {name:'Triceps Pushdown',sets:4,reps:'12',muscles:['Triceps'],anim:'🪢',tip:'Coudes collés au corps, extension complète.'},
 {name:'Overhead Triceps Extension',sets:3,reps:'12',muscles:['Triceps'],anim:'💪',tip:'Coudes vers le haut, étire bien.'},
 {name:'Close Grip Bench Press',sets:4,reps:'8-10',muscles:['Triceps','Pectoraux'],anim:'🏋️',tip:'Mains largeur épaules, coudes serrés.'},
 // Épaules
 {name:'Seated Shoulder Press',sets:4,reps:'8',muscles:['Épaules'],anim:'🏋️',tip:'Dos calé, pousse à la verticale.'},
 {name:'Lever Seated Shoulder Press',sets:3,reps:'10-12',muscles:['Épaules'],anim:'🪑',tip:'Trajectoire guidée, contrôle.'},
 {name:'Lateral Raise',sets:4,reps:'12',muscles:['Deltoïde latéral'],anim:'🦅',tip:'Monte aux épaules, pas plus haut.'},
 {name:'Front Raise',sets:4,reps:'12',muscles:['Deltoïde antérieur'],anim:'🙌',tip:'Pas de balancier, contrôle la descente.'},
 {name:'Cable Face Pull',sets:4,reps:'12-15',muscles:['Arrière épaules','Trapèzes'],anim:'🪢',tip:'Tire vers le visage, écarte les coudes.'},
 {name:'Arnold Press',sets:3,reps:'10',muscles:['Épaules'],anim:'🏋️',tip:'Rotation des poignets durant la montée.'},
 {name:'Upright Row',sets:3,reps:'12',muscles:['Épaules','Trapèzes'],anim:'⬆️',tip:'Tire la barre sous le menton, coudes hauts.'},
 {name:'Shrug',sets:4,reps:'15',muscles:['Trapèzes'],anim:'🤷',tip:'Hausse les épaules, pause en haut.'},
 // Jambes
 {name:'Lever Leg Extension',sets:4,reps:'8-12',muscles:['Quadriceps'],anim:'🦵',tip:'Extension complète, pause 1s en haut.'},
 {name:'Lever Seated Leg Extension',sets:3,reps:'12',muscles:['Quadriceps'],anim:'🦵',tip:'Contrôle la descente.'},
 {name:'Lever Lying Leg Curl',sets:4,reps:'6-12',muscles:['Ischios'],anim:'🦵',tip:'Bassin collé, ramène les talons aux fesses.'},
 {name:'Lever Kneeling Leg Curl',sets:3,reps:'10-12',muscles:['Ischios'],anim:'🦵',tip:'Isole l\u2019ischio, sans à-coup.'},
 {name:'Sled 45° Leg Wide Press',sets:4,reps:'8-12',muscles:['Quadriceps','Fessiers'],anim:'🛷',tip:'Pieds larges pour cibler l\u2019intérieur.'},
 {name:'Sled 45° Leg Press',sets:3,reps:'10-12',muscles:['Quadriceps','Fessiers'],anim:'🛷',tip:'Genoux dans l\u2019axe des pieds.'},
 {name:'Smith Squat',sets:3,reps:'10-12',muscles:['Quadriceps','Fessiers'],anim:'🏋️',tip:'Descends sous parallèle, dos droit.'},
 {name:'Back Squat',sets:5,reps:'5',muscles:['Quadriceps','Fessiers'],anim:'🏋️',tip:'Pousse le sol, respiration bloquée.'},
 {name:'Front Squat',sets:4,reps:'6-8',muscles:['Quadriceps'],anim:'🏋️',tip:'Coudes hauts, buste vertical.'},
 {name:'Bulgarian Split Squat',sets:3,reps:'10',muscles:['Quadriceps','Fessiers'],anim:'🦵',tip:'Pied arrière surélevé, genou avant stable.'},
 {name:'Dumbbell Split Squat',sets:3,reps:'10',muscles:['Quadriceps','Fessiers'],anim:'🦵',tip:'Buste droit, descente contrôlée.'},
 {name:'Walking Lunge',sets:3,reps:'12',muscles:['Quadriceps','Fessiers'],anim:'🚶',tip:'Grandes foulées, genou ne dépasse pas.'},
 {name:'Lever Seated Calf Raise',sets:4,reps:'12',muscles:['Mollets'],anim:'🦵',tip:'Amplitude max, étire en bas.'},
 {name:'Lever Seated One Leg Calf Raise',sets:3,reps:'15',muscles:['Mollets'],anim:'🦵',tip:'Une jambe à la fois, contraction max.'},
 {name:'Standing Calf Raise',sets:4,reps:'15',muscles:['Mollets'],anim:'🦵',tip:'Pause en haut, descente lente.'},
 {name:'Nordic Hamstring Curl',sets:3,reps:'6-8',muscles:['Ischios'],anim:'🦵',tip:'Excentrique lent, super protecteur pour le coureur.'},
 {name:'45° One Leg Hyperextension',sets:3,reps:'12',muscles:['Lombaires','Fessiers'],anim:'🔙',tip:'Dos neutre, contracte les fessiers.'},
 // Fessiers / hanches
 {name:'Hip Thrust',sets:3,reps:'10-12',muscles:['Fessiers'],anim:'🍑',tip:'Pause haute 1s, menton rentré.'},
 {name:'Lever Hip Thrust',sets:3,reps:'12',muscles:['Fessiers'],anim:'🍑',tip:'Extension complète des hanches.'},
 {name:'Lever Seated Hip Abduction',sets:3,reps:'12-15',muscles:['Fessiers','Abducteurs'],anim:'🦵',tip:'Écarte lentement, contrôle le retour.'},
 {name:'Lever Seated Hip Adduction',sets:3,reps:'12-15',muscles:['Adducteurs'],anim:'🦵',tip:'Serre les cuisses, ne lâche pas le retour.'},
 {name:'Glute Bridge',sets:3,reps:'15',muscles:['Fessiers'],anim:'🍑',tip:'Pousse avec les talons.'},
 {name:'Cable Kickback',sets:3,reps:'12-15',muscles:['Fessiers'],anim:'🦵',tip:'Jambe tendue vers l\u2019arrière, sans cambrer.'},
 // Abdos / Core
 {name:'Plank',sets:3,reps:'45s',muscles:['Abdominaux','Core'],anim:'🧘',tip:'Corps aligné, gainage constant.'},
 {name:'Hanging Leg Raise',sets:3,reps:'12',muscles:['Abdominaux'],anim:'🧗',tip:'Monte les jambes sans balancier.'},
 {name:'Cable Crunch',sets:3,reps:'15',muscles:['Abdominaux'],anim:'🪢',tip:'Enroule la colonne, pas les hanches.'},
 {name:'Russian Twist',sets:3,reps:'20',muscles:['Obliques'],anim:'🌀',tip:'Rotation contrôlée, gainage actif.'},
 {name:'Ab Wheel Rollout',sets:3,reps:'10',muscles:['Abdominaux','Core'],anim:'⚙️',tip:'Ne creuse jamais le bas du dos.'},
 // Avant-bras
 {name:'Wrist Curl',sets:3,reps:'15',muscles:['Avant-bras'],anim:'✊',tip:'Amplitude complète des poignets.'},
 {name:'Farmer Walk',sets:3,reps:'30m',muscles:['Avant-bras','Trapèzes','Core'],anim:'🚶',tip:'Posture droite, grip ferme.'}
];
/* ============================================================
   BIBLIOTHÈQUE ÉTENDUE — schéma riche (groupe, matériel, niveau,
   muscles primaires/secondaires, fiche tutoriel complète)
   ============================================================ */
const MUSCLE_GROUPS=['Tous','Pectoraux','Dos','Épaules','Trapèzes','Biceps','Triceps','Avant-bras','Abdominaux','Lombaires','Fessiers','Quadriceps','Ischios','Adducteurs','Abducteurs','Mollets','Cou','Corps entier'];
const EQUIPMENT=['Tous','Haltères','Barre','Machine','Poulie','Poids du corps','Élastique','Kettlebell'];
const LEVELS=['Débutant','Intermédiaire','Avancé'];
// Schéma compact : [nom, groupe, matériel, niveau, [primaires], [secondaires], emoji]
const XDATA=[
 // PECTORAUX
 ['Développé couché barre','Pectoraux','Barre','Intermédiaire',['Pectoraux'],['Triceps','Épaules'],'🏋️'],
 ['Développé incliné barre','Pectoraux','Barre','Intermédiaire',['Pectoraux haut'],['Épaules','Triceps'],'🏋️'],
 ['Développé décliné barre','Pectoraux','Barre','Intermédiaire',['Pectoraux bas'],['Triceps'],'🏋️'],
 ['Développé couché haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux'],['Triceps','Épaules'],'💪'],
 ['Développé incliné haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux haut'],['Épaules'],'💪'],
 ['Écarté couché haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux'],['Épaules'],'🦋'],
 ['Écarté incliné haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux haut'],[],'🦋'],
 ['Pec Deck (machine)','Pectoraux','Machine','Débutant',['Pectoraux'],[],'🦋'],
 ['Développé machine convergente','Pectoraux','Machine','Débutant',['Pectoraux'],['Triceps'],'🏋️'],
 ['Écarté poulie haute','Pectoraux','Poulie','Intermédiaire',['Pectoraux bas'],[],'🔀'],
 ['Écarté poulie basse','Pectoraux','Poulie','Intermédiaire',['Pectoraux haut'],[],'🔀'],
 ['Crossover poulie','Pectoraux','Poulie','Intermédiaire',['Pectoraux'],['Épaules'],'🔀'],
 ['Pompes','Pectoraux','Poids du corps','Débutant',['Pectoraux'],['Triceps','Abdominaux'],'🤸'],
 ['Pompes déclinées','Pectoraux','Poids du corps','Intermédiaire',['Pectoraux haut'],['Épaules'],'🤸'],
 ['Pompes diamant','Pectoraux','Poids du corps','Intermédiaire',['Triceps'],['Pectoraux'],'🤸'],
 ['Dips pectoraux','Pectoraux','Poids du corps','Avancé',['Pectoraux bas'],['Triceps'],'🤸'],
 ['Pullover haltère','Pectoraux','Haltères','Intermédiaire',['Pectoraux'],['Dos'],'🛢️'],
 ['Écarté élastique','Pectoraux','Élastique','Débutant',['Pectoraux'],[],'🦋'],
 // DOS
 ['Soulevé de terre','Dos','Barre','Avancé',['Dos','Lombaires'],['Fessiers','Ischios'],'🏋️'],
 ['Soulevé de terre roumain','Ischios','Barre','Intermédiaire',['Ischios'],['Fessiers','Lombaires'],'🏋️'],
 ['Rowing barre buste penché','Dos','Barre','Intermédiaire',['Dos'],['Biceps','Trapèzes'],'🚣'],
 ['Rowing T-bar','Dos','Machine','Intermédiaire',['Dos'],['Trapèzes','Biceps'],'🚣'],
 ['Rowing haltère unilatéral','Dos','Haltères','Débutant',['Dos'],['Biceps'],'💪'],
 ['Rowing poulie basse','Dos','Poulie','Débutant',['Dos'],['Biceps'],'🚣'],
 ['Tirage vertical poulie','Dos','Poulie','Débutant',['Grand dorsal'],['Biceps'],'🪢'],
 ['Tirage nuque','Dos','Poulie','Avancé',['Grand dorsal'],['Trapèzes'],'🪢'],
 ['Tractions pronation','Dos','Poids du corps','Avancé',['Grand dorsal'],['Biceps'],'🧗'],
 ['Tractions supination','Dos','Poids du corps','Avancé',['Grand dorsal'],['Biceps'],'🧗'],
 ['Pull-over poulie','Dos','Poulie','Intermédiaire',['Grand dorsal'],['Pectoraux'],'🪢'],
 ['Rowing machine assise','Dos','Machine','Débutant',['Dos'],['Biceps'],'🚣'],
 ['Rowing élastique','Dos','Élastique','Débutant',['Dos'],['Biceps'],'🪢'],
 ['Good Morning','Lombaires','Barre','Avancé',['Lombaires'],['Ischios','Fessiers'],'🔙'],
 ['Hyperextension lombaire','Lombaires','Poids du corps','Débutant',['Lombaires'],['Fessiers'],'🔙'],
 ['Superman au sol','Lombaires','Poids du corps','Débutant',['Lombaires'],['Fessiers'],'🦸'],
 // ÉPAULES
 ['Développé militaire barre','Épaules','Barre','Avancé',['Épaules'],['Triceps','Trapèzes'],'🏋️'],
 ['Développé haltères assis','Épaules','Haltères','Intermédiaire',['Épaules'],['Triceps'],'🏋️'],
 ['Développé Arnold','Épaules','Haltères','Intermédiaire',['Épaules'],['Triceps'],'🏋️'],
 ['Développé machine épaules','Épaules','Machine','Débutant',['Épaules'],['Triceps'],'🪑'],
 ['Élévations latérales','Épaules','Haltères','Débutant',['Deltoïde latéral'],[],'🦅'],
 ['Élévations latérales poulie','Épaules','Poulie','Intermédiaire',['Deltoïde latéral'],[],'🦅'],
 ['Élévations frontales','Épaules','Haltères','Débutant',['Deltoïde antérieur'],[],'🙌'],
 ['Oiseau (rear delt)','Épaules','Haltères','Débutant',['Arrière épaules'],['Trapèzes'],'🦋'],
 ['Face Pull poulie','Épaules','Poulie','Débutant',['Arrière épaules'],['Trapèzes'],'🪢'],
 ['Rowing menton','Épaules','Barre','Intermédiaire',['Épaules','Trapèzes'],[],'⬆️'],
 ['Élévations latérales élastique','Épaules','Élastique','Débutant',['Deltoïde latéral'],[],'🦅'],
 // TRAPÈZES
 ['Shrug barre','Trapèzes','Barre','Débutant',['Trapèzes'],[],'🤷'],
 ['Shrug haltères','Trapèzes','Haltères','Débutant',['Trapèzes'],[],'🤷'],
 ['Shrug machine','Trapèzes','Machine','Débutant',['Trapèzes'],[],'🤷'],
 // BICEPS
 ['Curl barre EZ','Biceps','Barre','Débutant',['Biceps'],['Avant-bras'],'💪'],
 ['Curl haltères','Biceps','Haltères','Débutant',['Biceps'],['Avant-bras'],'💪'],
 ['Curl marteau','Biceps','Haltères','Débutant',['Biceps','Avant-bras'],[],'🔨'],
 ['Curl incliné','Biceps','Haltères','Intermédiaire',['Biceps'],[],'💪'],
 ['Curl concentré','Biceps','Haltères','Débutant',['Biceps'],[],'💪'],
 ['Curl pupitre (Preacher)','Biceps','Barre','Intermédiaire',['Biceps'],[],'🪑'],
 ['Curl poulie basse','Biceps','Poulie','Débutant',['Biceps'],[],'🪢'],
 ['Curl araignée','Biceps','Haltères','Intermédiaire',['Biceps'],[],'🕷️'],
 ['21s biceps','Biceps','Barre','Intermédiaire',['Biceps'],[],'💪'],
 ['Curl élastique','Biceps','Élastique','Débutant',['Biceps'],[],'💪'],
 // TRICEPS
 ['Barre au front (Skull Crusher)','Triceps','Barre','Intermédiaire',['Triceps'],[],'💀'],
 ['Extension poulie haute','Triceps','Poulie','Débutant',['Triceps'],[],'🪢'],
 ['Extension poulie corde','Triceps','Poulie','Débutant',['Triceps'],[],'🪢'],
 ['Extension nuque haltère','Triceps','Haltères','Intermédiaire',['Triceps'],[],'💪'],
 ['Kickback haltère','Triceps','Haltères','Débutant',['Triceps'],[],'🦵'],
 ['Dips entre bancs','Triceps','Poids du corps','Débutant',['Triceps'],['Pectoraux'],'🤸'],
 ['Développé couché serré','Triceps','Barre','Intermédiaire',['Triceps'],['Pectoraux'],'🏋️'],
 ['Extension élastique','Triceps','Élastique','Débutant',['Triceps'],[],'🪢'],
 // AVANT-BRAS
 ['Curl poignets','Avant-bras','Barre','Débutant',['Avant-bras'],[],'✊'],
 ['Curl poignets inversé','Avant-bras','Barre','Débutant',['Avant-bras'],[],'✊'],
 ['Marche du fermier','Avant-bras','Haltères','Débutant',['Avant-bras','Trapèzes'],['Abdominaux'],'🚶'],
 ['Wrist roller','Avant-bras','Poids du corps','Intermédiaire',['Avant-bras'],[],'🌀'],
 // ABDOMINAUX
 ['Crunch','Abdominaux','Poids du corps','Débutant',['Abdominaux'],[],'🧘'],
 ['Crunch poulie','Abdominaux','Poulie','Intermédiaire',['Abdominaux'],[],'🪢'],
 ['Relevé de jambes suspendu','Abdominaux','Poids du corps','Avancé',['Abdominaux'],[],'🧗'],
 ['Relevé de jambes au sol','Abdominaux','Poids du corps','Débutant',['Abdominaux'],[],'🦵'],
 ['Planche','Abdominaux','Poids du corps','Débutant',['Abdominaux','Lombaires'],[],'🧘'],
 ['Planche latérale','Abdominaux','Poids du corps','Débutant',['Obliques'],[],'🧘'],
 ['Russian Twist','Abdominaux','Poids du corps','Intermédiaire',['Obliques'],[],'🌀'],
 ['Roulette abdominale','Abdominaux','Poids du corps','Avancé',['Abdominaux'],['Lombaires'],'⚙️'],
 ['Mountain Climbers','Abdominaux','Poids du corps','Débutant',['Abdominaux'],['Quadriceps'],'⛰️'],
 ['Vacuum abdominal','Abdominaux','Poids du corps','Intermédiaire',['Transverse'],[],'🌬️'],
 // FESSIERS
 ['Hip Thrust barre','Fessiers','Barre','Intermédiaire',['Fessiers'],['Ischios'],'🍑'],
 ['Hip Thrust machine','Fessiers','Machine','Débutant',['Fessiers'],[],'🍑'],
 ['Pont fessier','Fessiers','Poids du corps','Débutant',['Fessiers'],[],'🍑'],
 ['Kickback poulie','Fessiers','Poulie','Débutant',['Fessiers'],[],'🦵'],
 ['Abduction machine','Abducteurs','Machine','Débutant',['Abducteurs'],['Fessiers'],'🦵'],
 ['Adduction machine','Adducteurs','Machine','Débutant',['Adducteurs'],[],'🦵'],
 ['Fentes bulgares','Fessiers','Haltères','Intermédiaire',['Fessiers','Quadriceps'],[],'🦵'],
 ['Abduction élastique','Abducteurs','Élastique','Débutant',['Abducteurs'],[],'🦵'],
 // QUADRICEPS
 ['Squat barre','Quadriceps','Barre','Avancé',['Quadriceps','Fessiers'],['Lombaires'],'🏋️'],
 ['Front Squat','Quadriceps','Barre','Avancé',['Quadriceps'],['Abdominaux'],'🏋️'],
 ['Squat Smith','Quadriceps','Machine','Intermédiaire',['Quadriceps','Fessiers'],[],'🏋️'],
 ['Presse à cuisses','Quadriceps','Machine','Débutant',['Quadriceps','Fessiers'],[],'🛷'],
 ['Hack Squat','Quadriceps','Machine','Intermédiaire',['Quadriceps'],['Fessiers'],'🛷'],
 ['Leg Extension','Quadriceps','Machine','Débutant',['Quadriceps'],[],'🦵'],
 ['Fentes avant','Quadriceps','Haltères','Débutant',['Quadriceps','Fessiers'],[],'🚶'],
 ['Fentes marchées','Quadriceps','Haltères','Intermédiaire',['Quadriceps','Fessiers'],[],'🚶'],
 ['Goblet Squat','Quadriceps','Kettlebell','Débutant',['Quadriceps'],['Fessiers'],'🏋️'],
 ['Squat poids du corps','Quadriceps','Poids du corps','Débutant',['Quadriceps'],['Fessiers'],'🦵'],
 ['Wall Sit','Quadriceps','Poids du corps','Débutant',['Quadriceps'],[],'🧱'],
 // ISCHIOS
 ['Leg Curl allongé','Ischios','Machine','Débutant',['Ischios'],[],'🦵'],
 ['Leg Curl assis','Ischios','Machine','Débutant',['Ischios'],[],'🦵'],
 ['Nordic Curl','Ischios','Poids du corps','Avancé',['Ischios'],[],'🦵'],
 ['Soulevé jambes tendues haltères','Ischios','Haltères','Intermédiaire',['Ischios'],['Fessiers'],'🏋️'],
 // MOLLETS
 ['Mollets debout','Mollets','Machine','Débutant',['Mollets'],[],'🦵'],
 ['Mollets assis','Mollets','Machine','Débutant',['Mollets'],[],'🦵'],
 ['Mollets à la presse','Mollets','Machine','Débutant',['Mollets'],[],'🛷'],
 ['Mollets unilatéral haltère','Mollets','Haltères','Débutant',['Mollets'],[],'🦵'],
 // COU
 ['Extension de cou','Cou','Poids du corps','Intermédiaire',['Cou'],[],'🧣'],
 ['Flexion de cou','Cou','Poids du corps','Intermédiaire',['Cou'],[],'🧣'],
 // CORPS ENTIER
 ['Burpees','Corps entier','Poids du corps','Intermédiaire',['Corps entier'],['Pectoraux','Quadriceps'],'🤸'],
 ['Thruster','Corps entier','Barre','Avancé',['Quadriceps','Épaules'],['Fessiers'],'🏋️'],
 ['Clean & Press','Corps entier','Barre','Avancé',['Corps entier'],['Épaules','Dos'],'🏋️'],
 ['Kettlebell Swing','Corps entier','Kettlebell','Intermédiaire',['Fessiers','Dos'],['Ischios'],'🔔'],
 ['Snatch kettlebell','Corps entier','Kettlebell','Avancé',['Corps entier'],['Épaules'],'🔔'],
 ['Turkish Get-up','Corps entier','Kettlebell','Avancé',['Corps entier'],['Abdominaux'],'🔔']
];
// Construit la fiche tutoriel détaillée d'un exercice
/* ============ DÉMONSTRATIONS VIDÉO/GIF (free-exercise-db, domaine public) ============
   Source: github.com/yuhonas/free-exercise-db (The Unlicense — libre de droits).
   Chaque exercice a 2 images (0.jpg départ, 1.jpg fin) ; on les alterne pour
   créer une animation type GIF du mouvement. */
const EXDB_BASE='https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const EXDB_MAP={
 'Bench Press':'Barbell_Bench_Press_-_Medium_Grip','Développé couché barre':'Barbell_Bench_Press_-_Medium_Grip',
 'Développé incliné barre':'Barbell_Incline_Bench_Press_-_Medium_Grip','Développé incliné haltères':'Incline_Dumbbell_Press',
 'Développé couché haltères':'Dumbbell_Bench_Press','Decline Bench Press':'Decline_Barbell_Bench_Press','Développé décliné barre':'Decline_Barbell_Bench_Press',
 'Écarté couché haltères':'Dumbbell_Flyes','Écarté incliné haltères':'Incline_Dumbbell_Flyes','Lever Seated Fly':'Butterfly',
 'Pec Deck (machine)':'Butterfly','Cable Crossover':'Cable_Crossover','Crossover poulie':'Cable_Crossover','Écarté poulie haute':'Cable_Crossover',
 'Pompes':'Pushups','Push Up':'Pushups','Pompes diamant':'Push-Ups_-_Close_Triceps_Position','Pompes déclinées':'Decline_Push-Up',
 'Dips pectoraux':'Dips_-_Chest_Version','Dips pectoraux ':'Dips_-_Chest_Version','Pullover haltère':'Bent-Arm_Dumbbell_Pullover','Dumbbell Pullover':'Bent-Arm_Dumbbell_Pullover',
 'Soulevé de terre':'Barbell_Deadlift','Deadlift':'Barbell_Deadlift','Soulevé de terre roumain':'Romanian_Deadlift',
 'Rowing barre buste penché':'Bent_Over_Barbell_Row','Bent Over Row':'Bent_Over_Barbell_Row','Rowing T-bar':'T-Bar_Row_with_Handle','Lever Lying T-bar Row':'T-Bar_Row_with_Handle',
 'Rowing haltère unilatéral':'One-Arm_Dumbbell_Row','Single Arm Dumbbell Row':'One-Arm_Dumbbell_Row','Rowing poulie basse':'Seated_Cable_Rows','Straight Back Seated Row':'Seated_Cable_Rows','Rowing machine assise':'Seated_Cable_Rows',
 'Tirage vertical poulie':'Wide-Grip_Lat_Pulldown','Bar Lateral Pulldown':'Wide-Grip_Lat_Pulldown','Tirage nuque':'Wide-Grip_Rear_Pull-Up',
 'Tractions pronation':'Pullups','Pull Up':'Pullups','Tractions supination':'Chin-Up','Pull-over poulie':'Straight-Arm_Pulldown',
 'Good Morning':'Good_Morning','Hyperextension lombaire':'Hyperextensions_-_Back_Extensions','45° One Leg Hyperextension':'Hyperextensions_-_Back_Extensions','Superman au sol':'Superman',
 'Développé militaire barre':'Standing_Military_Press','Développé haltères assis':'Dumbbell_Shoulder_Press','Seated Shoulder Press':'Dumbbell_Shoulder_Press','Développé Arnold':'Arnold_Dumbbell_Press','Développé machine épaules':'Machine_Shoulder_(Military)_Press','Lever Seated Shoulder Press':'Machine_Shoulder_(Military)_Press',
 'Élévations latérales':'Side_Lateral_Raise','Lateral Raise':'Side_Lateral_Raise','Élévations latérales poulie':'Cable_Seated_Lateral_Raise',
 'Élévations frontales':'Front_Dumbbell_Raise','Front Raise':'Front_Dumbbell_Raise','Oiseau (rear delt)':'Bent_Over_Dumbbell_Rear_Delt_Raise_With_Head_On_Bench','Lever Reverse Fly':'Reverse_Machine_Flyes',
 'Face Pull poulie':'Face_Pull','Cable Face Pull':'Face_Pull','Rowing menton':'Upright_Barbell_Row','Upright Row':'Upright_Barbell_Row',
 'Shrug barre':'Barbell_Shrug','Shrug haltères':'Dumbbell_Shrug',
 'Curl barre EZ':'Barbell_Curl','Biceps Curl':'Barbell_Curl','Curl haltères':'Dumbbell_Bicep_Curl','Curl marteau':'Hammer_Curls','Hammer Curl':'Hammer_Curls',
 'Curl incliné':'Incline_Dumbbell_Curl','Curl concentré':'Concentration_Curls','Curl pupitre (Preacher)':'Preacher_Curl','Lever Preacher Curl':'Preacher_Curl','Curl poulie basse':'Cable_Hammer_Curls_-_Rope_Attachment',
 'Barre au front (Skull Crusher)':'Lying_Triceps_Press','Skull Crusher':'Lying_Triceps_Press','Extension poulie haute':'Triceps_Pushdown','Triceps Pushdown':'Triceps_Pushdown','Extension poulie corde':'Triceps_Pushdown_-_Rope_Attachment',
 'Extension nuque haltère':'Seated_Triceps_Press','Kickback haltère':'Tricep_Dumbbell_Kickback','Dips entre bancs':'Bench_Dips','Elbow Dips':'Bench_Dips','Développé couché serré':'Close-Grip_Barbell_Bench_Press',
 'Curl poignets':'Palms-Down_Wrist_Curl_Over_A_Bench','Curl poignets inversé':'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench','Marche du fermier':'Farmers_Walk','Farmer Walk':'Farmers_Walk',
 'Crunch':'Crunches','Crunch poulie':'Cable_Crunch','Cable Crunch':'Cable_Crunch','Relevé de jambes suspendu':'Hanging_Leg_Raise','Hanging Leg Raise':'Hanging_Leg_Raise','Relevé de jambes au sol':'Flat_Bench_Lying_Leg_Raise',
 'Planche':'Plank','Plank':'Plank','Russian Twist':'Russian_Twist','Roulette abdominale':'Ab_Roller','Ab Wheel Rollout':'Ab_Roller','Mountain Climbers':'Mountain_Climbers',
 'Hip Thrust barre':'Barbell_Hip_Thrust','Hip Thrust':'Barbell_Hip_Thrust','Lever Hip Thrust':'Barbell_Hip_Thrust','Pont fessier':'Butt_Lift_(Bridge)','Glute Bridge':'Butt_Lift_(Bridge)',
 'Abduction machine':'Thigh_Abductor','Lever Seated Hip Abduction':'Thigh_Abductor','Adduction machine':'Thigh_Adductor','Lever Seated Hip Adduction':'Thigh_Adductor','Fentes bulgares':'Dumbbell_Lunges','Bulgarian Split Squat':'Dumbbell_Lunges',
 'Squat barre':'Barbell_Full_Squat','Back Squat':'Barbell_Full_Squat','Front Squat':'Front_Barbell_Squat','Squat Smith':'Smith_Machine_Squat','Smith Squat':'Smith_Machine_Squat',
 'Presse à cuisses':'Leg_Press','Sled 45° Leg Press':'Leg_Press','Sled 45° Leg Wide Press':'Leg_Press','Hack Squat':'Hack_Squat','Leg Extension':'Leg_Extensions','Lever Leg Extension':'Leg_Extensions','Lever Seated Leg Extension':'Leg_Extensions',
 'Fentes avant':'Dumbbell_Lunges','Fentes marchées':'Dumbbell_Walking_Lunge','Walking Lunge':'Dumbbell_Walking_Lunge','Dumbbell Split Squat':'Dumbbell_Lunges','Goblet Squat':'Goblet_Squat','Squat poids du corps':'Bodyweight_Squat',
 'Leg Curl allongé':'Lying_Leg_Curls','Lever Lying Leg Curl':'Lying_Leg_Curls','Leg Curl assis':'Seated_Leg_Curl','Lever Kneeling Leg Curl':'Standing_Leg_Curl','Nordic Curl':'Lying_Leg_Curls','Nordic Hamstring Curl':'Lying_Leg_Curls','Soulevé jambes tendues haltères':'Stiff-Legged_Dumbbell_Deadlift',
 'Mollets debout':'Standing_Calf_Raises','Standing Calf Raise':'Standing_Calf_Raises','Mollets assis':'Seated_Calf_Raise','Lever Seated Calf Raise':'Seated_Calf_Raise','Lever Seated One Leg Calf Raise':'Seated_Calf_Raise','Mollets à la presse':'Calf_Press_On_The_Leg_Press_Machine',
 'Burpees':'Burpee','Thruster':'Thrusters','Clean & Press':'Clean_and_Press','Kettlebell Swing':'Kettlebell_One-Legged_Deadlift','EZ-bar 21s':'Barbell_Curl'
};
function exGif(name){
  const id=EXDB_MAP[name]; if(!id) return null;
  return [EXDB_BASE+id+'/0.jpg', EXDB_BASE+id+'/1.jpg'];
}
/* ---------- Tuiles "Muscle" en photo (style navigateur d'exercices) ---------- */
const MUSCLE_ICONS={'Tous':'🔎','Pectoraux':'🏋️','Dos':'🔙','Épaules':'🏋️','Trapèzes':'🤷','Biceps':'💪','Triceps':'💪',
  'Avant-bras':'✊','Abdominaux':'🧘','Lombaires':'🔙','Fessiers':'🍑','Quadriceps':'🦵','Ischios':'🦵','Adducteurs':'🦵',
  'Abducteurs':'🦵','Mollets':'🦵','Cou':'🧍','Corps entier':'🏋️'};
let _MUSCLE_REP_CACHE={};
function muscleRepImg(group){
  if(group==='Tous') return null;
  if(_MUSCLE_REP_CACHE[group]!==undefined) return _MUSCLE_REP_CACHE[group];
  const cand=XDATA.filter(x=>x[1]===group);
  let img=null;
  for(const x of cand){ const g=exGif(x[0]); if(g){ img=g[0]; break; } }
  _MUSCLE_REP_CACHE[group]=img;
  return img;
}
function exMeta(name){
  const d=XDATA.find(x=>x[0]===name);
  let base;
  if(d){ base={name:d[0],group:d[1],equip:d[2],level:d[3],primary:d[4],secondary:d[5],anim:d[6]}; }
  else { const o=LIB.find(e=>e.name===name); if(!o) return null;
    base={name:o.name,group:(o.muscles&&o.muscles[0])||'Corps entier',equip:'Machine',level:'Intermédiaire',primary:o.muscles||[],secondary:[],anim:o.anim||'🏋️',tip:o.tip}; }
  base.gif=exGif(name);
  return enrichFiche(base);
}
function enrichFiche(b){
  const g=b.group;
  const breathByGroup='Inspire pendant la phase négative (descente/étirement), expire pendant l\u2019effort (poussée/contraction).';
  // Génère une fiche complète et cohérente
  b.steps=[
    'Position de départ : installe-toi correctement, dos gainé, regard neutre.',
    'Contracte les muscles cibles avant de débuter le mouvement.',
    'Réalise la phase concentrique de façon contrôlée, sans à-coup.',
    'Marque une courte pause en contraction maximale.',
    'Reviens lentement en contrôlant la phase excentrique (2-3 s).'
  ];
  b.breathing=breathByGroup;
  b.mistakes=[
    'Utiliser une charge trop lourde au détriment de la technique.',
    'Manquer d\u2019amplitude (mouvement trop court).',
    'Prendre de l\u2019élan / tricher avec le dos.',
    'Aller trop vite et négliger la phase excentrique.'
  ];
  b.tips=[
    'Privilégie la connexion muscle-esprit : sens le muscle travailler.',
    'Reste sur 2-3 RIR (répétitions en réserve) pour progresser sainement.',
    b.tip||'Garde une exécution propre sur toutes les répétitions.'
  ];
  b.safety=[
    'Échauffe-toi avec des séries légères avant les séries lourdes.',
    'Garde le dos neutre, ne bloque jamais complètement les articulations.',
    'Arrête immédiatement en cas de douleur articulaire vive.'
  ];
  // variantes : autres exercices du même groupe
  b.variants=XDATA.filter(x=>x[1]===g && x[0]!==b.name).slice(0,4).map(x=>x[0]);
  return b;
}
// Liste unifiée (étendue + ancienne) sans doublons, pour le navigateur
function allExercises(){
  const names=new Set();
  const out=[];
  XDATA.forEach(x=>{ if(!names.has(x[0])){ names.add(x[0]); out.push({name:x[0],group:x[1],equip:x[2],level:x[3],primary:x[4],secondary:x[5],anim:x[6]}); } });
  LIB.forEach(o=>{ if(!names.has(o.name)){ names.add(o.name); out.push({name:o.name,group:(o.muscles&&o.muscles[0])||'Corps entier',equip:'Machine',level:'Intermédiaire',primary:o.muscles||[],secondary:[],anim:o.anim||'🏋️',tip:o.tip}); } });
  return out;
}
function findEx(name){ return LIB.find(e=>e.name===name) || (function(){ const d=XDATA.find(x=>x[0]===name); return d?{name:d[0],muscles:d[4],anim:d[6],tip:''}:null; })(); }
function ex(name,sets,reps){ const e=findEx(name)||{name,muscles:[],anim:'🏋️',tip:''}; return {name:e.name,sets,reps,muscles:e.muscles,anim:e.anim,tip:e.tip||''}; }

/* ---------- 6 DEFAULT PROGRAMS ---------- */
const PROGS=[
 {id:'A',name:'Poitrine & Triceps',color:'--e',ex:[ex('Decline Bench Press',4,'12'),ex('Bench Press',4,'12'),ex('Dumbbell Incline Bench Press',4,'12'),ex('Lever Seated Fly',3,'8'),ex('Skull Crusher',4,'12'),ex('Elbow Dips',3,'6-8'),ex('Triceps Pushdown',4,'12')]},
 {id:'B',name:'Dos & Biceps',color:'--e',ex:[ex('Lever Lying T-bar Row',3,'10-12'),ex('Straight Back Seated Row',3,'6-10'),ex('Bar Lateral Pulldown',3,'8-10'),ex('EZ-bar 21s',4,'21'),ex('Hammer Curl',4,'6-12'),ex('Biceps Curl',4,'12'),ex('Lever Preacher Curl',3,'4-10')]},
 {id:'C',name:'Épaules & Jambes',color:'--e',ex:[ex('Seated Shoulder Press',4,'8'),ex('Lever Seated Shoulder Press',3,'10-12'),ex('Lateral Raise',4,'12'),ex('Front Raise',4,'12'),ex('Cable Face Pull',4,'12-15'),ex('Lever Leg Extension',4,'8-12'),ex('Lever Lying Leg Curl',4,'6-12'),ex('Sled 45° Leg Wide Press',4,'8-12'),ex('Lever Seated Calf Raise',4,'12')]},
 {id:'D',name:'Jambes Fessiers',color:'--e',ex:[ex('Lever Seated Hip Abduction',3,'12-15'),ex('Sled 45° Leg Press',3,'10-12'),ex('Lever Seated Hip Adduction',3,'12-15'),ex('Hip Thrust',3,'10-12'),ex('45° One Leg Hyperextension',3,'12'),ex('Smith Squat',3,'10-12'),ex('Lever Hip Thrust',3,'12')]},
 {id:'E',name:'Jambes Ischio & Mollets',color:'--e',ex:[ex('Lever Hip Thrust',3,'12'),ex('Lever Leg Extension',3,'12-15'),ex('Lever Seated Leg Extension',3,'12'),ex('Dumbbell Split Squat',3,'10'),ex('Lever Kneeling Leg Curl',3,'10-12'),ex('Nordic Hamstring Curl',3,'6-8'),ex('Lever Seated One Leg Calf Raise',3,'15')]},
 {id:'F',name:'Dos Épaules & Bras',color:'--e',ex:[ex('Bar Lateral Pulldown',4,'8-10'),ex('Straight Back Seated Row',4,'6-10'),ex('Lever Lying T-bar Row',3,'10-12'),ex('Seated Shoulder Press',4,'8'),ex('Lever Seated Shoulder Press',3,'10'),ex('Cable Face Pull',3,'12'),ex('Hammer Curl',3,'6-12')]}
];
function allProgs(){ return [...PROGS,...CUSTOM]; }

/* ---------- RUN PLAN GENERATOR ---------- */
const TYPE_COLORS={EF:'--ok','Tempo':'--warn','Seuil':'--or','VMA':'--bad','Intervalle':'--bad','Récup':'--dim','Long':'--e','Course':'--e','Repos':'--dim'};
// Couleur par baseType brut (codes générés par buildSessionV2) — utilisée pour la puce de type
// affichée AVANT clic sur la carte de séance (aperçu rapide).
const BASETYPE_COLORS={EF:'--ok',RECUP:'--dim',LONG:'--e',LONG_COURT:'--e',TEMPO:'--warn',TEMPO_SPE:'--warn',
  SEUIL:'--or',DBLSEUIL:'--or',VMAc:'--bad',VMAl:'--bad',VO2:'--bad',INTERVAL:'--bad',COURSE:'--e',Repos:'--dim'};
function baseTypeColor(bt){ return 'var('+(BASETYPE_COLORS[bt]||'--e')+')'; }

/* Assigne les types aux jours dispo en respectant les préférences utilisateur */
function assignTypesToDays(days,types,isLastWeek){
  const result=new Array(days.length).fill(null);
  const pool=[...types];
  const place=(prefDow,matchFn)=>{
    if(prefDow===undefined||prefDow===null||prefDow==='') return;
    const di=days.indexOf(+prefDow); if(di<0||result[di]) return;
    const ti=pool.findIndex(matchFn); if(ti<0) return;
    result[di]=pool.splice(ti,1)[0];
  };
  place(PREFS.longDay, t=>t==='Long');
  place(PREFS.fractioDay, t=>t==='VMA'||t==='Seuil');
  place(PREFS.recupDay, t=>t==='Récup');
  // remplit le reste
  for(let i=0;i<result.length;i++){ if(!result[i]) result[i]=pool.shift()||'EF'; }
  return result;
}

/* Construit une séance ULTRA détaillée (objectif, échauffement, corps, récup,
   allures, conseils, erreurs, pourquoi) — compréhensible par un débutant */
function buildSession(type,o){
  const{vdot,pEF,pTempo,pSeuil,pVMA,easyKm,wkKm,phase}=o;
  const P_EF=spkToStr(pEF), P_RC=spkToStr(pEF*1.06), P_TP=spkToStr(pTempo), P_SE=spkToStr(pSeuil), P_VM=spkToStr(pVMA);
  let km,pace,rpe,title,d={};
  if(type==='EF'){
    km=easyKm; pace=P_EF; rpe=3; title='Endurance Fondamentale';
    d={ objectif:'Développer ta base aérobie et ton endurance sans fatiguer l\u2019organisme.',
      warmup:'Pas d\u2019échauffement spécifique : les 10 premières minutes servent de mise en route progressive.',
      body:km+' km à allure facile ('+P_EF+'/km). Tu dois pouvoir parler en courant. Si tu es essoufflé, ralentis.',
      cooldown:'Marche 3 min puis quelques étirements doux des mollets et ischios.',
      paces:'Allure cible : '+P_EF+'/km (zone 2, ~70% FCmax).',
      recovery:'Aucune récup pendant : c\u2019est un effort continu et régulier.',
      tips:['Respire par le ventre, garde les épaules basses.','La régularité prime sur la vitesse.'],
      mistakes:['Courir trop vite « pour le plaisir » → tu accumules de la fatigue inutile.','Sauter cette séance car « trop facile » : c\u2019est 80% de ta progression.'],
      why:'80% du volume des meilleurs coureurs est en endurance fondamentale. Elle développe ton cœur, tes mitochondries et tes capillaires sans risque de blessure.' };
  } else if(type==='Récup'){
    km=Math.max(4,Math.round(easyKm*0.7)); pace=P_RC; rpe=2; title='Footing de récupération';
    d={ objectif:'Favoriser la récupération active après une séance dure.',
      warmup:'Aucun. Démarre très lentement.',
      body:km+' km en footing très souple à '+P_RC+'/km. Plus lent que d\u2019habitude, volontairement.',
      cooldown:'Étirements légers + automassage si tu as un rouleau.',
      paces:'Allure très lente : '+P_RC+'/km. Reste en zone 1.',
      recovery:'Effort continu mais minimal.',
      tips:['Si tu te sens cassé, remplace par 20 min de marche.','Hydrate-toi bien après.'],
      mistakes:['Transformer le footing récup en footing normal → tu ne récupères pas.'],
      why:'Le sang circule, évacue les déchets musculaires et accélère la récupération sans créer de stress.' };
  } else if(type==='Tempo'){
    km=Math.max(6,Math.round(easyKm)); pace=P_TP; rpe=6; title='Tempo Run';
    d={ objectif:'Habituer ton corps à tenir une allure soutenue et confortable sur la durée.',
      warmup:'15 min footing en '+P_EF+'/km + 3 lignes droites progressives.',
      body:'20 à 25 min en continu à '+P_TP+'/km (allure « confortablement difficile »).',
      cooldown:'10 min footing très lent + étirements.',
      paces:'Allure tempo : '+P_TP+'/km (~83% de ta VMA).',
      recovery:'Pas de récup : c\u2019est un bloc continu.',
      tips:['Tu dois pouvoir dire 2-3 mots, pas une phrase entière.','Garde une foulée fluide et relâchée.'],
      mistakes:['Partir trop vite et exploser au milieu.','Confondre tempo et sprint.'],
      why:'Le tempo améliore ton efficacité et repousse le seuil où l\u2019acide lactique s\u2019accumule.' };
  } else if(type==='Seuil'){
    km=Math.max(7,Math.round(easyKm*1.1)); pace=P_SE; rpe=7; title='Séance au Seuil';
    d={ objectif:'Repousser ton seuil lactique — le facteur n°1 de performance sur 5 km à semi.',
      warmup:'15-20 min footing '+P_EF+'/km + 4 lignes droites + gammes (montées de genoux, talons-fesses).',
      body:'4 à 5 × 1000 m à '+P_SE+'/km. Récup 1 min trot entre chaque répétition.',
      cooldown:'10 min footing lent + étirements complets.',
      paces:'Allure seuil : '+P_SE+'/km (~88% VMA).',
      recovery:'1 min de trot lent entre chaque 1000 m.',
      tips:['Toutes les répétitions doivent être à la même allure.','Concentre-toi sur la régularité, pas la première rép.'],
      mistakes:['Faire la 1ère trop vite et ralentir ensuite.','Récup trop courte → tu n\u2019y arrives plus.'],
      why:'Le seuil est l\u2019allure que tu peux tenir ~1h. L\u2019augmenter = courir plus vite plus longtemps.' };
  } else if(type==='VMA'){
    km=Math.max(6,Math.round(easyKm*0.95)); pace=P_VM; rpe=9; title='Séance VMA / Fractionné';
    d={ objectif:'Développer ta puissance aérobie maximale (VO2max) et ta vitesse de pointe.',
      warmup:'20 min footing + 5 lignes droites + 3 accélérations courtes. Échauffement OBLIGATOIRE.',
      body:'10 à 12 × 400 m à '+P_VM+'/km. Récup 200 m en trottinant (ou 1\u201930 marche).',
      cooldown:'10-15 min footing très lent : essentiel après l\u2019intensité.',
      paces:'Allure VMA : '+P_VM+'/km (~97-100% VMA). Rapide mais contrôlé.',
      recovery:'200 m de récup active entre chaque 400 m.',
      tips:['Vise la même allure sur toutes les répétitions.','Si tu ne tiens plus, arrête : mieux vaut 8 propres que 12 bâclées.'],
      mistakes:['Négliger l\u2019échauffement → blessure assurée.','Partir comme un sprinteur sur la 1ère.'],
      why:'La VMA est ton plafond de cylindrée. Plus elle est haute, plus toutes tes autres allures deviennent faciles.' };
  } else if(type==='Long'){
    km=Math.max(10,Math.round(wkKm*0.32)); pace=spkToStr(pEF*0.99); rpe=4; title='Sortie Longue';
    d={ objectif:'Construire ton endurance, ta résistance mentale et économiser ton énergie.',
      warmup:'Démarrage progressif sur les 10 premières minutes.',
      body:km+' km à allure endurance ('+spkToStr(pEF*0.99)+'/km). Tu peux finir un peu plus vite si tu te sens bien.',
      cooldown:'Marche 5 min + étirements + collation glucides/protéines dans les 30 min.',
      paces:'Allure : '+spkToStr(pEF*0.99)+'/km, stable.',
      recovery:'Continu. Ravitaille en eau si > 1h15.',
      tips:['Mange bien la veille.','Emporte de l\u2019eau et un gel si > 1h30.'],
      mistakes:['Partir trop vite et marcher à la fin.','Oublier de s\u2019alimenter sur les très longues.'],
      why:'La sortie longue augmente tes réserves de glycogène et apprend à ton corps à brûler les graisses.' };
  } else if(type==='Course'){
    km=5; pace=spkToStr(predictTime(vdot,5000)/5); rpe=10; title='🏆 Jour de Compétition';
    d={ objectif:'Réaliser ta meilleure performance — objectif : '+(P.goal||'ton record')+' !',
      warmup:'25-30 min : footing progressif + 5 lignes droites + 3 accélérations à allure course.',
      body:'5000 m à '+spkToStr(predictTime(vdot,5000)/5)+'/km. Gère : départ contrôlé, milieu solide, final tout donné.',
      cooldown:'15 min footing très lent dès l\u2019arrivée + étirements.',
      paces:'Allure objectif : '+spkToStr(predictTime(vdot,5000)/5)+'/km.',
      recovery:'—',
      tips:['Ne pars pas trop vite dans l\u2019euphorie.','Accroche un coureur de ton niveau.','Le dernier km, vide-toi.'],
      mistakes:['Partir 10 s/km trop vite → tu exploses au 3e km.','Mal dormir / mal manger la veille.'],
      why:'C\u2019est l\u2019aboutissement de toutes tes semaines de travail. Fais-toi confiance.' };
  } else {
    km=0; pace='—'; rpe=0; title='Repos complet';
    d={ objectif:'Laisser ton corps se reconstruire et progresser.',
      warmup:'—', body:'Repos total ou activité très douce (marche, mobilité).',
      cooldown:'—', paces:'—', recovery:'Journée OFF.',
      tips:['Dors 8h.','Hydrate-toi et mange équilibré.'],
      mistakes:['Culpabiliser de ne rien faire : le repos EST de l\u2019entraînement.'],
      why:'C\u2019est PENDANT le repos que ton corps assimile l\u2019entraînement et devient plus fort.' };
  }
  return {km,pace,rpe,title,detail:d};
}
/* ============================================================
   GÉNÉRATEUR DE PLAN — moteur scientifique périodisé
   Inspiré méthode norvégienne (double seuil, polarisation 80/20),
   périodisation classique + science moderne. Jamais 2 plans identiques.
   ============================================================ */
// PRNG seedé -> variété contrôlée et reproductible
function mulberry32(a){ return function(){ a|=0;a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return((t^t>>>14)>>>0)/4294967296; }; }
const PHASES=[
  {key:'PG', name:'Préparation générale', color:'--dim'},
  {key:'AERO', name:'Développement aérobie', color:'--ok'},
  {key:'VO2', name:'Développement VO₂max', color:'--bad'},
  {key:'SPE', name:'Développement spécifique', color:'--or'},
  {key:'PIC', name:'Pic de forme', color:'--e'},
  {key:'TAPER', name:'Affûtage', color:'--platine'}
];
function phaseDistribution(weeks){
  // proportions par phase, ajustées au nombre de semaines
  const prop=[0.18,0.24,0.20,0.20,0.10,0.08];
  let acc=0; const map=[];
  for(let i=0;i<PHASES.length;i++){
    let n=Math.max(i>=4?1:1,Math.round(weeks*prop[i]));
    map.push(n); acc+=n;
  }
  // ajuste pour matcher weeks exactement
  let diff=weeks-acc, i=1;
  while(diff!==0){ const idx=(i%4)+1; map[idx]+=Math.sign(diff); if(map[idx]<1)map[idx]=1; acc=map.reduce((a,b)=>a+b,0); diff=weeks-acc; i++; if(i>200)break; }
  const phaseByWeek=[]; let w=1;
  map.forEach((n,pi)=>{ for(let k=0;k<n;k++){ phaseByWeek[w++]=PHASES[pi]; } });
  for(;w<=weeks;w++) phaseByWeek[w]=PHASES[5];
  return phaseByWeek;
}
/* ============ MOTEUR VVV — SÉANCE RATÉE, REMPLACEMENT & AJUSTEMENT AUTOMATIQUE ============ */
const MISSED_REASONS=['Manque de temps','Fatigue','Douleur','Maladie','Météo','Déplacement','Motivation','Oubli','Autre'];
const REPLACEMENT_ACTIVITIES=['Aucune activité','Running','Musculation','Vélo','Natation','Mobilité','Marche','Autre'];
const MISSED_REASON_ICONS={'Manque de temps':'⏱️','Fatigue':'🥱','Douleur':'🤕','Maladie':'🤒','Météo':'🌧️','Déplacement':'🧳','Motivation':'😕','Oubli':'💭','Autre':'✏️'};
const REPLACEMENT_ICONS={'Aucune activité':'🚫','Running':'🏃','Musculation':'🏋️','Vélo':'🚴','Natation':'🏊','Mobilité':'🧘','Marche':'🚶','Autre':'➕'};
const HARD_TYPES=['VMAc','VMAl','VO2','INTERVAL','DBLSEUIL','SEUIL','SPE','TEMPO_SPE','TEMPO','PROGRESSIF','FARTLEK','COTES'];
let missedCtx=null;

function checkMissedSessions(){
  if(!PLAN || !PLAN.sessions) return;
  const tk=todayKey();
  const missed=PLAN.sessions.find(s=>s.date<tk && !s.done && !s.missed && s.type!=='Repos');
  if(missed) openMissedFlow(missed.id);
}
function openMissedFlow(sid){
  missedCtx={sessionId:sid, reason:null, replacement:null, replData:null, muscuCat:null};
  renderMissedReason();
  $('#ovProgTitle').textContent='Séance manquée';
  openOv('ovProg');
}
function renderMissedReason(){
  const s=PLAN.sessions.find(x=>x.id===missedCtx.sessionId); if(!s) return;
  let h='<div class="card" style="border-color:rgba(255,92,108,.35);background:rgba(255,92,108,.08);margin-bottom:18px"><div style="font-weight:700;color:var(--bad)">⚠️ Séance manquée</div><div style="font-size:13px;color:var(--muted);margin-top:4px">'+s.title+' · '+fmtDate(s.date)+'</div></div>';
  h+='<div class="lab" style="margin-bottom:10px">Pourquoi cette séance n\u2019a-t-elle pas été réalisée ?</div>';
  h+='<div class="reason-grid">'+MISSED_REASONS.map(r=>'<div class="reason-tile" onclick="selectMissedReason(\''+r+'\')">'+(MISSED_REASON_ICONS[r]||'')+' '+r+'</div>').join('')+'</div>';
  $('#progBody').innerHTML=h;
}
function selectMissedReason(r){ missedCtx.reason=r; renderMissedReplacement(); }
function renderMissedReplacement(){
  let h='<div class="lab" style="margin-bottom:10px">As-tu finalement fait autre chose ?</div>';
  h+='<div class="act-grid">'+REPLACEMENT_ACTIVITIES.map(a=>'<div class="act-tile" onclick="selectReplacement(\''+a+'\')"><div class="ic">'+(REPLACEMENT_ICONS[a]||'')+'</div><div class="lb">'+a+'</div></div>').join('')+'</div>';
  $('#progBody').innerHTML=h;
}
function selectReplacement(a){
  missedCtx.replacement=a;
  if(a==='Aucune activité'){ finalizeMissedSession(); return; }
  if(a==='Running'){ renderMissedRunningForm(); return; }
  if(a==='Musculation'){ renderMissedMuscuForm(); return; }
  if(a==='Vélo'||a==='Natation'){ renderMissedCardioForm(a); return; }
  renderMissedSimpleForm(a);
}
function renderMissedRunningForm(){
  let h='<div class="field"><label>Distance (km)</label><input class="inp" id="mr_km" type="number" placeholder="8"></div>';
  h+='<div class="field"><label>Allure /km</label><input class="inp" id="mr_pace" placeholder="4:30"></div>';
  h+='<div class="field"><label>RPE — difficulté ressentie : <span id="mr_rpe_v">5</span>/10</label><input type="range" min="1" max="10" value="5" style="width:100%" id="mr_rpe" oninput="document.getElementById(\'mr_rpe_v\').textContent=this.value"></div>';
  h+='<div class="field"><label>Notes (optionnel)</label><textarea class="inp" id="mr_notes" rows="2"></textarea></div>';
  h+='<button class="btn" onclick="saveMissedRunning()">Valider</button>';
  $('#progBody').innerHTML=h;
}
function saveMissedRunning(){
  const km=+$('#mr_km').value||0, pace=$('#mr_pace').value.trim()||'—', rpe=+$('#mr_rpe').value, notes=$('#mr_notes').value.trim();
  missedCtx.replData={km,pace,rpe,notes};
  if(km>0){ SESS.push({date:todayKey(),title:'Course de remplacement',km,pace,type:'EF',duration:(pace!=='—')?Math.round(km*parseTime(pace)/60):0,rpe}); }
  finalizeMissedSession();
}
function renderMissedMuscuForm(){
  const cats=['Haut du corps','Bas du corps','Gainage','Explosivité','Force maximale','Force endurance','Puissance','Mobilité'];
  missedCtx.muscuCat=cats[0];
  let h='<div class="field"><label>Type de séance</label><div class="pills" id="mm_cats">'+cats.map((c,i)=>'<div class="pill '+(i===0?'on':'')+'" onclick="selMuscuCat(\''+c+'\',this)">'+c+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Durée (min)</label><input class="inp" id="mm_dur" type="number" placeholder="45"></div>';
  h+='<div class="field"><label>RPE — difficulté ressentie : <span id="mm_rpe_v">5</span>/10</label><input type="range" min="1" max="10" value="5" style="width:100%" id="mm_rpe" oninput="document.getElementById(\'mm_rpe_v\').textContent=this.value"></div>';
  h+='<button class="btn" onclick="saveMissedMuscu()">Valider</button>';
  $('#progBody').innerHTML=h;
}
function selMuscuCat(c,el){ missedCtx.muscuCat=c; document.querySelectorAll('#mm_cats .pill').forEach(x=>x.classList.remove('on')); el.classList.add('on'); }
function saveMissedMuscu(){
  const dur=+$('#mm_dur').value||0, rpe=+$('#mm_rpe').value;
  missedCtx.replData={cat:missedCtx.muscuCat,dur,rpe};
  MSESS.push({date:todayKey(),progName:'Remplacement — '+missedCtx.muscuCat,tonnage:0,sets:0,reps:0,duration:dur,calories:0,muscles:{}});
  finalizeMissedSession();
}
function renderMissedCardioForm(kind){
  let h='<div class="field"><label>Durée (min)</label><input class="inp" id="mc_dur" type="number" placeholder="45"></div>';
  h+='<div class="field"><label>Distance (km, optionnel)</label><input class="inp" id="mc_km" type="number" placeholder="15"></div>';
  h+='<div class="field"><label>RPE — difficulté ressentie : <span id="mc_rpe_v">5</span>/10</label><input type="range" min="1" max="10" value="5" style="width:100%" id="mc_rpe" oninput="document.getElementById(\'mc_rpe_v\').textContent=this.value"></div>';
  h+='<button class="btn" onclick="saveMissedCardio(\''+kind+'\')">Valider</button>';
  $('#progBody').innerHTML=h;
}
function saveMissedCardio(kind){
  const dur=+$('#mc_dur').value||0, km=+$('#mc_km').value||0, rpe=+$('#mc_rpe').value;
  missedCtx.replData={kind,dur,km,rpe};
  finalizeMissedSession();
}
function renderMissedSimpleForm(kind){
  let h='<div class="field"><label>Durée (min, optionnel)</label><input class="inp" id="ms_dur" type="number" placeholder="30"></div>';
  h+='<button class="btn" onclick="saveMissedSimple(\''+kind+'\')">Valider</button>';
  $('#progBody').innerHTML=h;
}
function saveMissedSimple(kind){ missedCtx.replData={kind,dur:+$('#ms_dur').value||0}; finalizeMissedSession(); }
function finalizeMissedSession(){
  const s=PLAN.sessions.find(x=>x.id===missedCtx.sessionId);
  if(!s){ missedCtx=null; closeOv('ovProg'); return; }
  s.missed=true; s.missedReason=missedCtx.reason||null; s.missedReplacement=missedCtx.replacement||'Aucune activité'; s.missedReplData=missedCtx.replData||null;
  const note=ruleBasedAdjust(s, missedCtx.reason, missedCtx.replacement);
  weeklyAdaptiveRegen();
  saveAll();
  closeOv('ovProg');
  toast('📝 Séance notée'+(note?' — '+note:''));
  missedCtx=null;
  renderSport();
  setTimeout(checkMissedSessions,400);
}

/* ---------- MOTEUR DE RÈGLES D'ADAPTATION (100% local, aucune IA) ---------- */
function addDaysKey(dateKey,n){ const d=new Date(dateKey); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function nextUpcoming(afterDate){ return PLAN.sessions.filter(s=>s.date>afterDate && !s.done && !s.missed).sort((a,b)=>a.date<b.date?-1:1); }
function nextHardUpcoming(afterDate){ return nextUpcoming(afterDate).find(s=>HARD_TYPES.includes(s.baseType)); }
function ruleBasedAdjust(session, reason, replacement){
  const heavyReasons=['Fatigue','Douleur','Maladie'];
  let note='';
  if(heavyReasons.includes(reason)){
    const cardioReplacement=(replacement==='Running'||replacement==='Vélo'||replacement==='Natation');
    const nh=nextHardUpcoming(session.date);
    if(nh){
      const factor=cardioReplacement?0.9:0.75;
      nh.km=Math.round(nh.km*factor*10)/10;
      nh.duration=Math.round(nh.duration*factor);
      const flag='⚠️ Séance allégée automatiquement (raison : '+reason.toLowerCase()+' le '+fmtDate(session.date)+'). — ';
      if(nh.detail && nh.detail.objectif) nh.detail.objectif=flag+nh.detail.objectif;
      nh.desc=flag+(nh.desc||'');
      note='prochaine séance dure allégée';
    }
  } else if(replacement==='Musculation' && missedCtx && ['Bas du corps','Explosivité','Puissance'].includes(missedCtx.muscuCat)){
    const tomorrow=addDaysKey(session.date,1);
    const nextDay=PLAN.sessions.find(s=>s.date===tomorrow && !s.done && !s.missed);
    if(nextDay && ['VMAc','COTES'].includes(nextDay.baseType)){
      const flag='💡 Ta séance jambes a déjà sollicité tes muscles — reste souple sur l\u2019explosivité aujourd\u2019hui. — ';
      if(nextDay.detail && nextDay.detail.objectif) nextDay.detail.objectif=flag+nextDay.detail.objectif;
      nextDay.desc=flag+(nextDay.desc||'');
      note='vigilance sur ta prochaine séance explosive';
    }
  } else if((replacement==='Vélo'||replacement==='Natation') && !heavyReasons.includes(reason)){
    note='charge cardio déjà comptabilisée, plan inchangé';
  }
  checkConsecutiveMisses();
  return note;
}
function checkConsecutiveMisses(){
  if(!PLAN) return;
  const tk=todayKey();
  const recentMissed=PLAN.sessions.filter(s=>s.missed && s.date>=addDaysKey(tk,-14) && s.date<=tk).length;
  if(recentMissed>=3 && PLAN.autoReducedAt!==tk){
    nextUpcoming(tk).forEach(s=>{ s.km=Math.round(s.km*0.85*10)/10; s.duration=Math.round(s.duration*0.85); });
    PLAN.autoReducedAt=tk;
    toast('📉 3 séances ratées récemment : volume des prochaines semaines réduit de 15%');
  }
}
function applyProgressiveOverload(entry){
  if(!PLAN) return;
  if(entry.pain && entry.pain!=='Aucune') return;
  if(entry.fatigue>=4) return;
  if(!(entry.feel>=4 && entry.plannedRpe && entry.rpe<=entry.plannedRpe)) return;
  const sess=PLAN.sessions.find(s=>s.date===entry.date);
  const wk=sess?sess.week:0;
  PLAN.overloadWeeks=PLAN.overloadWeeks||[];
  if(PLAN.overloadWeeks.includes(wk)) return;
  PLAN.overloadWeeks.push(wk);
  nextUpcoming(entry.date).slice(0,3).forEach(s=>{
    if(s.baseType==='EF'||s.baseType==='LONG'){ s.km=Math.round(s.km*1.05*10)/10; s.duration=Math.round(s.duration*1.05); }
  });
  saveAll();
}

/* ---------- RÉGÉNÉRATION HEBDOMADAIRE ADAPTATIVE DU PLAN ----------
   Le plan n'est jamais figé : au moins une fois par semaine, si besoin,
   les séances à venir (non faites) sont RECONSTRUITES (nouveau tirage
   aléatoire dans buildSessionV2 → variantes différentes, pas une copie)
   avec un volume/intensité ajusté selon :
   - le taux de répétitions "respectées" dans les bilans récents,
   - l'écart RPE réel vs prévu,
   - la fatigue déclarée,
   - le nombre de séances ratées récemment.
   La périodisation (semaine/phase/type de séance/date) est conservée :
   seul le contenu réel de chaque séance à venir est régénéré. */
function weeklyAdaptiveRegen(force){
  if(!PLAN || !PLAN.sessions || !PLAN.sessions.length) return;
  const tk=todayKey();
  const last=PLAN.lastAdapt||PLAN.created;
  if(!force && daysBetween(new Date(last),new Date(tk))<7) return;
  const since=addDaysKey(tk,-14);
  const recentLogs=(SESSLOG||[]).filter(e=>e.date>=since && e.date<=tk);
  const missedCount=PLAN.sessions.filter(s=>s.missed && s.date>=since && s.date<=tk).length;
  let repTot=0, repOk=0, rpeDeltaSum=0, rpeN=0, fatSum=0, fatN=0;
  recentLogs.forEach(e=>{
    if(e.repsLog) e.repsLog.forEach(r=>{ if(r.timeS!=null){ repTot++; if(r.respected) repOk++; } });
    if(e.plannedRpe){ rpeDeltaSum+=(e.rpe-e.plannedRpe); rpeN++; }
    if(e.fatigue){ fatSum+=e.fatigue; fatN++; }
  });
  const repRatio=repTot?repOk/repTot:null;
  const rpeDelta=rpeN?rpeDeltaSum/rpeN:0;
  const avgFatigue=fatN?fatSum/fatN:3;
  let factor=1, reason='Charge stable : nouvelles variantes de séances, volume inchangé.';
  if(missedCount>=2 || rpeDelta>=1.5 || avgFatigue>=4){
    factor=0.88; reason='Charge élevée détectée (séances ratées, RPE au-dessus du prévu ou fatigue) → volume réduit d\u2019environ 12% cette semaine.';
  } else if(repRatio!=null && repRatio>=0.85 && rpeDelta<=0 && avgFatigue<=3){
    factor=1.06; reason='Bonne assimilation (répétitions respectées, RPE maîtrisé) → volume et intensité légèrement augmentés.';
  }
  const vdot=getUserVDOT(); if(!vdot) return;
  const pace={ EF:paceFromPct(vdot,.70), RC:paceFromPct(vdot,.66), MAR:paceFromPct(vdot,.80),
    TEMPO:paceFromPct(vdot,.83), SEUIL:paceFromPct(vdot,.88), SPE:predictTime(vdot, raceMeters())/(raceMeters()/1000),
    VMAl:repPace(vdot,1000), VMAc:repPace(vdot,300), SPRINT:paceFromPct(vdot,1.18) };
  const seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
  const rng=mulberry32(seed);
  const pick=arr=>arr[Math.floor(rng()*arr.length)];
  const upcoming=nextUpcoming(tk);
  if(!upcoming.length){ PLAN.lastAdapt=tk; saveAll(); return; }
  // km hebdo courant par semaine (avant régénération), pour dériver un wkKm ajusté par séance
  const wkKmBySemaine={};
  PLAN.sessions.forEach(s=>{ wkKmBySemaine[s.week]=(wkKmBySemaine[s.week]||0)+(s.km||0); });
  const nDaysBySemaine={};
  PLAN.sessions.forEach(s=>{ nDaysBySemaine[s.week]=(nDaysBySemaine[s.week]||0)+1; });
  upcoming.forEach(s=>{
    if(s.baseType==='Repos'||s.km===0||s.baseType==='COURSE') return;
    const wkKm=Math.max(15,Math.round((wkKmBySemaine[s.week]||s.km*4)*factor));
    const ph={name:s.phase,key:s.phaseKey,color:s.color};
    const built=buildSessionV2(s.baseType,{vdot,pace,wkKm,nDays:nDaysBySemaine[s.week]||4,phase:ph,rng,pick,isDeload:s.deload,goal:PLAN.goal,w:s.week,weeks:PLAN.weeks});
    const durMin=built.durMin!=null?built.durMin:(built.pace==='—'?0:Math.round(built.km*parseTime(built.pace)/60));
    s.type=built.label; s.title=built.title; s.km=built.km; s.duration=durMin; s.pace=built.pace;
    s.rpe=built.rpe; s.series=built.series||null; s.desc=built.detail.objectif; s.detail=built.detail;
  });
  PLAN.lastAdapt=tk;
  DB.save('run_plan',PLAN);
  toast('🔄 Plan mis à jour pour la semaine — '+reason);
}

function generatePlan(){
  const vdot=getUserVDOT();
  if(!vdot){ toast('Profil incomplet : ajoute un chrono dans tes records'); return; }
  if(!P.compDate){ toast('Choisis une date de compétition'); return; }
  const days=(P.days&&P.days.length)?[...P.days].sort((a,b)=>a-b):[1,3,5,6];
  const today=new Date(); today.setHours(0,0,0,0);
  const comp=new Date(P.compDate); comp.setHours(0,0,0,0);
  let weeks=Math.max(2,Math.min(28,Math.ceil(daysBetween(today,comp)/7)));
  const phaseByWeek=phaseDistribution(weeks);
  // seed unique à chaque génération
  const seed=(Date.now()^Math.floor(Math.random()*1e9))>>>0;
  const rng=mulberry32(seed);
  const pick=arr=>arr[Math.floor(rng()*arr.length)];
  // allures
  const pace={ EF:paceFromPct(vdot,.70), RC:paceFromPct(vdot,.66), MAR:paceFromPct(vdot,.80),
    TEMPO:paceFromPct(vdot,.83), SEUIL:paceFromPct(vdot,.88), SPE:predictTime(vdot, raceMeters())/(raceMeters()/1000),
    // VMAc = allure "répétition" (courtes reps ≤ 400 m), VMAl = allure "intervalle" (reps 800-1200 m).
    // Les deux utilisent la courbe distance→intensité calibrée sur données réelles (REP_INTENSITY_CURVE
    // / repPace) au lieu d'un % fixe — nettement plus rapide et réaliste sur les 200/300 m.
    VMAl:repPace(vdot,1000), VMAc:repPace(vdot,300), SPRINT:paceFromPct(vdot,1.18) };
  // volume : kmMin -> kmMax avec deload toutes 4 sem + taper
  const kmMin=P.kmWeekMin||P.kmWeek||35;
  const kmMax=P.kmWeekMax||Math.round((P.kmWeek||35)*1.6);
  const liked=(PREFS.likedTypes&&PREFS.likedTypes.length)?PREFS.likedTypes:null;
  const sessions=[]; let id=1;
  const goal=P.objGoal||'Record personnel';
  for(let w=1;w<=weeks;w++){
    const ph=phaseByWeek[w];
    const prog=(w-1)/(weeks-1||1);
    let wkKm;
    if(ph.key==='TAPER'){ const tp=(weeks-w); wkKm=Math.round(kmMax*(0.45+tp*0.12)); }
    else wkKm=Math.round(kmMin+(kmMax-kmMin)*Math.min(1,prog*1.25));
    const isDeload=(w%4===0)&&ph.key!=='TAPER'&&w<weeks-2;
    if(isDeload) wkKm=Math.round(wkKm*0.75);
    wkKm=Math.max(kmMin*0.7,Math.min(kmMax,wkKm));
    // composition de la semaine selon la phase
    const qualityCount=days.length>=5?(ph.key==='AERO'?2:ph.key==='PG'?1:3):(days.length>=4?2:1);
    const weekPlan=composeWeek(ph,days.length,qualityCount,isDeload,pick,rng,liked,w===weeks);
    const assigned=assignWeek(days,weekPlan);
    days.forEach((dow,di)=>{
      const d=new Date(today);
      d.setDate(today.getDate() + (w-1)*7 + ((dow - today.getDay()+7)%7));
      let type=assigned[di]||'EF';
      if(w===weeks && di===days.length-1) type='COURSE';
      const built=buildSessionV2(type,{vdot,pace,wkKm,nDays:days.length,phase:ph,rng,pick,isDeload,goal,w,weeks});
      const durMin=built.durMin!=null?built.durMin:(built.pace==='—'?0:Math.round(built.km*parseTime(built.pace)/60));
      sessions.push({ id:id++, week:w, phase:ph.name, phaseKey:ph.key, color:ph.color,
        date:dateKey(d), type:built.label, baseType:type, title:built.title,
        km:built.km, duration:durMin, pace:built.pace, rpe:built.rpe, series:built.series||null,
        desc:built.detail.objectif, detail:built.detail, deload:isDeload, done:false });
    });
  }
  PLAN={ created:todayKey(), vdot, weeks, seed, sessions, goal, race:P.objRace||'5 km' };
  DB.save('run_plan',PLAN);
  toast('🔥 Plan « '+(P.objRace||'course')+' » généré : '+weeks+' sem, '+sessions.length+' séances');
  burst(); renderSport();
}
function raceMeters(){ const m={'5 km':5000,'10 km':10000,'Semi-marathon':21097,'Marathon':42195,'Trail':21097,'Cross':8000,'Ultra':50000}; return m[P.objRace]||5000; }
// Plafond de la sortie longue selon l'objectif de course — évite les sorties à 30-40 km
// quand on prépare un 3000 m, et évite de plafonner à 18 km quand on prépare un semi/marathon.
function longRunCapKm(){
  const m=raceMeters();
  if(m<=3000) return 16;
  if(m<=5000) return 20;
  if(m<=10000) return 26;
  if(m<=21097) return 32;
  if(m<=42195) return 38;
  return 42;
}

/* ---------- CONFIGURATION DU PLAN (collecte des inputs avancés) ---------- */
const LIKED_TYPES=['VMA courte','VMA longue','Intervalles','Tempo','Seuil','Endurance fondamentale','Sortie longue','Double seuil','Fartlek','Côtes','Travail VO₂max','Travail à l\u2019allure spécifique','Récupération active'];
let setupTmp={};
function openPlanSetup(){
  setupTmp={
    objRace:P.objRace||'5 km', compDate:P.compDate||'', objProfile:P.objProfile||'Plate',
    objGoal:P.objGoal||'Record personnel', objTime:P.objTime||'',
    days:[...(P.days||[1,3,5,6])], kmWeekMin:P.kmWeekMin||P.kmWeek||35, kmWeekMax:P.kmWeekMax||Math.round((P.kmWeek||35)*1.6),
    likedTypes:[...((PREFS.likedTypes)||[])]
  };
  renderPlanSetup(); $('#ovProgTitle').textContent='Configurer mon plan'; openOv('ovProg');
}
function renderPlanSetup(){
  const s=setupTmp;
  const dn=['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  let h='<div class="field"><label>Course préparée</label><select class="inp" onchange="setupTmp.objRace=this.value">'+['5 km','10 km','Semi-marathon','Marathon','Ultra','Trail','Cross','Autre'].map(r=>'<option '+(s.objRace===r?'selected':'')+'>'+r+'</option>').join('')+'</select></div>';
  h+='<div class="field"><label>Date de la course</label><input class="inp" type="date" value="'+s.compDate+'" onchange="setupTmp.compDate=this.value"></div>';
  h+='<div class="field"><label>Profil du parcours</label><div class="pills">'+['Plate','Vallonnée','Montagne'].map(p=>'<div class="pill '+(s.objProfile===p?'on':'')+'" onclick="setupTmp.objProfile=\''+p+'\';renderPlanSetup()">'+p+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Objectif</label><div class="pills">'+['Finir','Record personnel','Qualification','Podium','Victoire'].map(o=>'<div class="pill '+(s.objGoal===o?'on':'')+'" onclick="setupTmp.objGoal=\''+o+'\';renderPlanSetup()">'+o+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Chrono visé (optionnel)</label><input class="inp" value="'+(s.objTime||'')+'" oninput="setupTmp.objTime=this.value" placeholder="ex: 18:30"></div>';
  h+='<div class="field"><label>Jours d\u2019entraînement</label><div class="pills">'+[1,2,3,4,5,6,0].map(d=>'<div class="pill '+(s.days.includes(d)?'on':'')+'" onclick="toggleSetupDay('+d+')">'+dn[d]+'</div>').join('')+'</div></div>';
  h+='<div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Km/sem mini</label><input class="inp" type="number" value="'+s.kmWeekMin+'" oninput="setupTmp.kmWeekMin=+this.value"></div><div class="field" style="flex:1"><label>Km/sem maxi (pic)</label><input class="inp" type="number" value="'+s.kmWeekMax+'" oninput="setupTmp.kmWeekMax=+this.value"></div></div>';
  h+='<div class="field"><label>Séances préférées (le coach les privilégiera)</label><div class="pills">'+LIKED_TYPES.map(t=>'<div class="pill '+(s.likedTypes.includes(t)?'on':'')+'" onclick="toggleLiked(\''+t.replace(/'/g,"\\'")+'\')">'+t+'</div>').join('')+'</div></div>';
  h+='<button class="btn" onclick="confirmPlanSetup()">🔥 Générer mon plan</button>';
  $('#progBody').innerHTML=h;
}
function toggleSetupDay(d){ const i=setupTmp.days.indexOf(d); if(i>=0)setupTmp.days.splice(i,1); else setupTmp.days.push(d); renderPlanSetup(); }
function toggleLiked(t){ const i=setupTmp.likedTypes.indexOf(t); if(i>=0)setupTmp.likedTypes.splice(i,1); else setupTmp.likedTypes.push(t); renderPlanSetup(); }
function confirmPlanSetup(){
  const s=setupTmp;
  if(!s.compDate){ toast('Choisis une date de course'); return; }
  if(!s.days.length){ toast('Choisis au moins un jour'); return; }
  Object.assign(P,{objRace:s.objRace,compDate:s.compDate,objProfile:s.objProfile,objGoal:s.objGoal,objTime:s.objTime,days:s.days.sort((a,b)=>a-b),kmWeekMin:s.kmWeekMin,kmWeekMax:s.kmWeekMax});
  PREFS.likedTypes=s.likedTypes;
  saveAll(); closeOv('ovProg'); generatePlan();
}
// Compose la liste des types pour la semaine (variée, cohérente)
function composeWeek(ph,nDays,qCount,isDeload,pick,rng,liked,isRaceWeek){
  const easy=['EF','EF','RECUP'];
  let quality;
  if(ph.key==='PG') quality=['FARTLEK','COTES','TEMPO','LIGNES'];
  else if(ph.key==='AERO') quality=['TEMPO','SEUIL','PROGRESSIF','FARTLEK','COTES'];
  else if(ph.key==='VO2') quality=['VMAc','VMAl','VO2','INTERVAL','DBLSEUIL'];
  else if(ph.key==='SPE') quality=['SPE','SEUIL','VMAl','TEMPO_SPE','PROGRESSIF'];
  else if(ph.key==='PIC') quality=['VMAc','SPE','SEUIL'];
  else quality=['SPE_COURT','LIGNES','RECUP']; // taper
  if(liked){ // priorise les types aimés s'ils existent dans la phase
    const mapped=liked.map(likedToType).filter(Boolean);
    const inter=quality.filter(q=>mapped.includes(q));
    if(inter.length) quality=[...new Set([...inter,...quality])];
  }
  const week=[];
  // sortie longue (sauf taper deload léger)
  if(nDays>=3 && !isRaceWeek) week.push(ph.key==='TAPER'?'LONG_COURT':'LONG');
  // séances qualité
  let qn=Math.min(qCount,quality.length);
  const used=new Set();
  for(let i=0;i<qn;i++){ let t=pick(quality); let g=0; while(used.has(t)&&g<8){t=pick(quality);g++;} used.add(t); week.push(t); }
  // remplir le reste en endurance
  while(week.length<nDays) week.push(pick(easy));
  // mélange léger
  for(let i=week.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [week[i],week[j]]=[week[j],week[i]]; }
  return week;
}
function likedToType(l){ const m={'VMA courte':'VMAc','VMA longue':'VMAl','Intervalles':'INTERVAL','Tempo':'TEMPO','Seuil':'SEUIL','Endurance fondamentale':'EF','Sortie longue':'LONG','Double seuil':'DBLSEUIL','Fartlek':'FARTLEK','Côtes':'COTES','Travail VO₂max':'VO2','Travail à l\u2019allure spécifique':'SPE','Récupération active':'RECUP'}; return m[l]; }
// place les types sur les jours en respectant PREFS jour long/fractio/récup + espacement qualité
function assignWeek(days,weekPlan){
  const res=new Array(days.length).fill(null);
  const pool=[...weekPlan];
  const placePref=(prefDow,matchFn)=>{ if(prefDow===''||prefDow==null)return; const di=days.indexOf(+prefDow); if(di<0||res[di])return; const ti=pool.findIndex(matchFn); if(ti<0)return; res[di]=pool.splice(ti,1)[0]; };
  placePref(PREFS.longDay, t=>t.startsWith('LONG'));
  placePref(PREFS.fractioDay, t=>['VMAc','VMAl','VO2','INTERVAL','DBLSEUIL'].includes(t));
  placePref(PREFS.recupDay, t=>t==='RECUP');
  // place le reste en évitant 2 qualités consécutives si possible
  const isHard=t=>['VMAc','VMAl','VO2','INTERVAL','DBLSEUIL','SEUIL','SPE','TEMPO_SPE'].includes(t);
  const hard=pool.filter(isHard), easy=pool.filter(t=>!isHard(t));
  for(let i=0;i<res.length;i++){ if(res[i])continue;
    const prevHard=i>0&&res[i-1]&&isHard(res[i-1]);
    if(prevHard&&easy.length) res[i]=easy.shift();
    else if(hard.length) res[i]=hard.shift();
    else if(easy.length) res[i]=easy.shift();
    else res[i]='EF';
  }
  return res;
}
/* Construit une séance V2 ULTRA détaillée selon le type scientifique */
function buildSessionV2(type,o){
  const{vdot,pace,wkKm,nDays,phase,rng,pick,isDeload,goal,w,weeks}=o;
  const S=spkToStr;
  const easyKm=Math.max(5,Math.round(wkKm/nDays*0.95));
  const vary=(a,b)=>a+Math.round(rng()*(b-a)); // variabilité contrôlée
  let km,p,rpe,title,label,d={},durMin=null,series=null;
  const WU_MIN=17.5, CD_MIN=12.5;
  const wuKm=distKmFromTime(WU_MIN*60,pace.EF), cdKm=distKmFromTime(CD_MIN*60,pace.RC);
  const round1=x=>Math.round(x*10)/10;
  const WU='15-20 min footing en '+S(pace.EF)+'/km + 4-5 lignes droites progressives + gammes (montées de genoux, talons-fesses, foulées bondissantes).';
  const CD='10-15 min footing très lent en '+S(pace.RC)+'/km + étirements doux.';
  switch(type){
    case 'EF':
      km=easyKm; p=S(pace.EF); rpe=3; label='EF'; title='Endurance Fondamentale';
      d={objectif:'Construire ta base aérobie — le socle de toute progression (80% du volume des élites).',warmup:'Mise en route progressive sur 10 min.',body:km+' km à allure facile ('+S(pace.EF)+'/km). Conversation possible en permanence.',paces:'Zone 2, ~70% FCmax — '+S(pace.EF)+'/km.',recovery:'Effort continu.',cooldown:'Quelques étirements des mollets et ischios.',tips:['Respire par le ventre.','La lenteur est volontaire et productive.'],mistakes:['Courir trop vite « par habitude ».'],why:'Développe le cœur, les capillaires et les mitochondries sans fatigue ni risque.'};
      break;
    case 'RECUP':
      km=Math.max(4,Math.round(easyKm*0.7)); p=S(pace.RC); rpe=2; label='Récup'; title='Récupération active';
      d={objectif:'Accélérer la récupération entre deux séances dures.',warmup:'Aucun.',body:km+' km très souple à '+S(pace.RC)+'/km.',paces:'Zone 1 — très lent.',recovery:'—',cooldown:'Automassage / mobilité.',tips:['Si très fatigué, remplace par 25 min de marche.'],mistakes:['Accélérer : tu sabotes la récup.'],why:'La circulation sanguine évacue les déchets et relance l\u2019adaptation.'};
      break;
    case 'LONG': case 'LONG_COURT':
      km=type==='LONG_COURT'?Math.round(wkKm*0.22):Math.round(wkKm*(phase.key==='SPE'?0.34:0.30));
      km=Math.max(8,Math.min(longRunCapKm(),km)); p=S(pace.EF*0.99); rpe=4; label='Long'; title='Sortie Longue'+(phase.key==='SPE'?' progressive':'');
      d={objectif:'Développer l\u2019endurance, l\u2019économie de course et le mental.',warmup:'Départ progressif 10 min.',body:phase.key==='SPE'||phase.key==='PIC'?km+' km progressifs : 1ère moitié en '+S(pace.EF)+'/km, 2nde moitié en accélérant jusqu\u2019à '+S(pace.MAR)+'/km.':km+' km à allure endurance stable ('+S(pace.EF*0.99)+'/km).',paces:'EF '+S(pace.EF)+'/km → allure marathon '+S(pace.MAR)+'/km en fin.',recovery:'Continu, ravitaille si > 1h15.',cooldown:CD,tips:['Mange bien la veille.','Emporte eau + gel si > 1h30.'],mistakes:['Partir trop vite et marcher à la fin.'],why:'Augmente les réserves de glycogène et la capacité à utiliser les graisses.'};
      break;
    case 'TEMPO': {
      const tmin=vary(20,30);
      const mainKm=distKmFromTime(tmin*60,pace.TEMPO);
      km=round1(wuKm+mainKm+cdKm); durMin=Math.round(WU_MIN+tmin+CD_MIN); p=S(pace.TEMPO); rpe=6; label='Tempo'; title='Tempo Run';
      d={objectif:'Améliorer l\u2019efficacité et l\u2019endurance à allure soutenue.',warmup:WU,body:tmin+' min en continu à '+S(pace.TEMPO)+'/km (« confortablement difficile »), soit environ '+round1(mainKm)+' km.',paces:'~83% VMA — '+S(pace.TEMPO)+'/km.',recovery:'Bloc continu.',cooldown:CD,tips:['Tu dois pouvoir dire 2-3 mots, pas une phrase.'],mistakes:['Partir trop vite et exploser.'],why:'Repousse le seuil d\u2019accumulation du lactate.'};
      break; }
    case 'TEMPO_SPE': {
      const n=vary(2,3), dist=2000, recSecEach=120, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.SPE,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.SPE); rpe=6; label='Tempo spé'; title='Tempo allure spécifique';
      series={reps:n,dist,paceSecPerKm:pace.SPE,recoverySec:recSecEach,recoveryLabel:'2 min trot'};
      d={objectif:'Te familiariser avec l\u2019allure de ta course objectif ('+goal+').',warmup:WU,body:repsText(n,dist,pace.SPE)+', récup 2 min trot entre blocs.',paces:'Allure course : '+S(pace.SPE)+'/km.',recovery:'2 min trot entre blocs.',cooldown:CD,tips:['Mémorise les sensations de cette allure.'],mistakes:['Aller plus vite que l\u2019allure cible.'],why:'L\u2019allure spécifique doit devenir automatique le jour J.'};
      break; }
    case 'SEUIL': {
      const n=vary(4,6), dist=1000, recSecEach=60, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.SEUIL,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.SEUIL); rpe=7; label='Seuil'; title='Séance au Seuil';
      series={reps:n,dist,paceSecPerKm:pace.SEUIL,recoverySec:recSecEach,recoveryLabel:'1 min trot'};
      d={objectif:'Repousser le seuil lactique — facteur n°1 de performance.',warmup:WU,body:repsText(n,dist,pace.SEUIL)+', récup 1 min trot.',paces:'~88% VMA — '+S(pace.SEUIL)+'/km.',recovery:'1 min trot entre chaque.',cooldown:CD,tips:['Toutes les reps à la même allure.'],mistakes:['Partir trop fort sur la 1ère.'],why:'Le seuil est l\u2019allure tenable ~1h ; l\u2019élever rend tout plus facile.'};
      break; }
    case 'DBLSEUIL': {
      // 2 sorties dans la journée : le matin en blocs longs, le soir en 400 m courts.
      const nAM=5, minAM=6, recAM=60, recNam=4;
      const nPM=10, distPM=400, recPM=30, recNpm=9;
      const amMainKm=distKmFromTime(nAM*minAM*60,pace.SEUIL*1.01), amRecKm=distKmFromTime(recNam*recAM,pace.RC);
      const pmMainKm=nPM*distPM/1000, pmRecKm=distKmFromTime(recNpm*recPM,pace.RC);
      km=round1(wuKm+amMainKm+amRecKm+cdKm+wuKm+pmMainKm+pmRecKm+cdKm);
      durMin=Math.round(2*WU_MIN+nAM*minAM+recNam*recAM/60+2*CD_MIN+nPM*splitSecFromPace(pace.SEUIL,distPM)/60+recNpm*recPM/60);
      p=S(pace.SEUIL); rpe=7; label='Double seuil'; title='Double Seuil (méthode norvégienne)';
      series={reps:nPM,dist:distPM,paceSecPerKm:pace.SEUIL,recoverySec:recPM,recoveryLabel:'30 s trot',note:'Séance du soir (matin = '+nAM+' × '+minAM+' min)'};
      d={objectif:'Maximiser le volume au seuil sans fatigue excessive (clé norvégienne).',warmup:WU+' (×2 : une fois le matin, une fois le soir)',body:'Matin : '+nAM+' × '+minAM+' min à '+S(pace.SEUIL*1.01)+'/km (récup 1 min). Soir : '+repsText(nPM,distPM,pace.SEUIL)+' (récup 30 s). Reste sous-maximal.',paces:'Seuil contrôlé '+S(pace.SEUIL)+'/km — lactate ~2-4 mmol.',recovery:'Récup courte, intensité maîtrisée.',cooldown:CD+' (après chaque séance)',tips:['Ne jamais finir épuisé : tu dois pouvoir refaire la séance.'],mistakes:['Transformer le seuil en VMA.'],why:'Double dose de stimulus seuil pour une fatigue minimale — signature des Ingebrigtsen.'};
      break; }
    case 'VMAc': {
      const n=vary(8,12), dist=300, recSecEach=60, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.VMAc,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.VMAc); rpe=9; label='VMA courte'; title='VMA Courte';
      series={reps:n,dist,paceSecPerKm:pace.VMAc,recoverySec:recSecEach,recoveryLabel:'1 min trot'};
      const vmac30m=Math.round(distKmFromTime(30,pace.VMAc)*1000);
      d={objectif:'Développer la vVO2max et la vitesse de pointe.',warmup:WU+' Échauffement OBLIGATOIRE.',body:repsText(n,dist,pace.VMAc)+', récup 1 min trot. (ou variante courte : '+vary(12,16)+' × ~'+vmac30m+' m vif / '+vmac30m+' m trot, même intensité).',paces:'~108-110% VMA — vise '+fmtSplit(splitSecFromPace(pace.VMAc,dist))+' sur chaque '+dist+' m (et non '+S(pace.VMAc)+', qui est juste l\u2019allure ramenée au km).',recovery:'1 min trot entre les '+dist+' m.',cooldown:CD,tips:['Même temps de passage sur toutes les reps : '+fmtSplit(splitSecFromPace(pace.VMAc,dist))+' au '+dist+' m.'],mistakes:['Négliger l\u2019échauffement → blessure.','Confondre l\u2019allure /km affichée avec le temps réel à réaliser sur '+dist+' m.'],why:'Stimule le VO₂max et l\u2019économie neuromusculaire.'};
      break; }
    case 'VMAl': case 'VO2': {
      const n=vary(5,7), dist=1000, recSecEach=150, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.VMAl,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.VMAl); rpe=9; label=type==='VO2'?'VO₂max':'VMA longue'; title=type==='VO2'?'Séance VO₂max':'VMA Longue';
      series={reps:n,dist,paceSecPerKm:pace.VMAl,recoverySec:recSecEach,recoveryLabel:'2-3 min trot'};
      d={objectif:'Élever le VO₂max — ta cylindrée maximale.',warmup:WU,body:repsText(n,dist,pace.VMAl)+', récup 2-3 min trot. (ou '+vary(4,5)+' × 1200 m).',paces:'~95-98% VMA — '+S(pace.VMAl)+'/km.',recovery:'2-3 min trot.',cooldown:CD,tips:['Régularité avant tout.','Arrête si tu ne tiens plus l\u2019allure.'],mistakes:['Récup trop courte.'],why:'Le temps passé à ~90-100% VO₂max augmente ta puissance aérobie maximale.'};
      break; }
    case 'INTERVAL': {
      const segs=[200,400,600,800,600,400,200];
      const paceFor=dist=>repPace(vdot,dist);
      const mainSec=segs.reduce((a,dist)=>a+splitSecFromPace(paceFor(dist),dist),0);
      const mainKm=segs.reduce((a,dist)=>a+dist,0)/1000;
      const recSec=mainSec*6/7; // récup = durée de l'effort, entre chaque segment (pas après le dernier)
      const recKm=distKmFromTime(recSec,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+mainSec/60+recSec/60+CD_MIN);
      p=S(pace.VMAl); rpe=8; label='Intervalles'; title='Intervalles mixtes';
      series={segments:segs.map(dist=>({dist,paceSecPerKm:paceFor(dist),splitSec:splitSecFromPace(paceFor(dist),dist)})),recoveryLabel:'jog = durée de l\u2019effort'};
      const detailSegs=segs.map(dist=>dist+' m ('+fmtSplit(splitSecFromPace(paceFor(dist),dist))+')').join(' · ');
      d={objectif:'Travail mixte vitesse-endurance.',warmup:WU,body:'Pyramide : '+detailSegs+', récup jog = durée de l\u2019effort entre chaque segment.',paces:'De '+S(paceFor(200))+'/km (200 m) à '+S(paceFor(800))+'/km (800 m) — l\u2019allure ralentit progressivement avec la distance.',recovery:'Récup active égale à l\u2019effort.',cooldown:CD,tips:['Gère l\u2019allure selon la distance : plus la rép est courte, plus tu vas vite en valeur absolue.'],mistakes:['Tout faire à la même vitesse.'],why:'Combine plusieurs filières énergétiques.'};
      break; }
    case 'SPE': case 'SPE_COURT': {
      const n=type==='SPE_COURT'?vary(3,4):vary(4,6), dist=1000, recSecEach=90, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.SPE,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.SPE); rpe=8; label='Allure spé'; title='Allure Spécifique '+(P.objRace||'');
      series={reps:n,dist,paceSecPerKm:pace.SPE,recoverySec:recSecEach,recoveryLabel:'90 s trot'};
      d={objectif:'Ancrer l\u2019allure exacte de ta course ('+goal+').',warmup:WU,body:repsText(n,dist,pace.SPE)+', récup 90 s.',paces:'Allure objectif : '+S(pace.SPE)+'/km.',recovery:'90 s trot.',cooldown:CD,tips:['Cette allure doit devenir un réflexe.'],mistakes:['Aller plus vite par excès de confiance.'],why:'La spécificité prime à l\u2019approche de la course.'};
      break; }
    case 'PROGRESSIF':
      km=Math.round(easyKm*1.2); p=S(pace.MAR); rpe=6; label='Progressif'; title='Run Progressif';
      d={objectif:'Apprendre à accélérer sur la fatigue.',warmup:'10 min '+S(pace.EF)+'/km.',body:km+' km en 3 paliers : '+S(pace.EF)+' → '+S(pace.MAR)+' → '+S(pace.TEMPO)+'/km.',paces:'EF → tempo.',recovery:'Continu.',cooldown:CD,tips:['Chaque palier un peu plus vite.'],mistakes:['Partir trop vite.'],why:'Renforce le mental et le négatif split.'};
      break;
    case 'FARTLEK': {
      const n=vary(8,12);
      const mainKm=n*(distKmFromTime(60,pace.VMAl)+distKmFromTime(60,pace.EF));
      km=round1(distKmFromTime(15*60,pace.EF)+mainKm+cdKm); durMin=Math.round(15+n*2+CD_MIN);
      p=S(pace.TEMPO); rpe=6; label='Fartlek'; title='Fartlek (jeu d\u2019allures)';
      d={objectif:'Travail au ressenti, ludique et libre.',warmup:'15 min '+S(pace.EF)+'/km.',body:n+' × (1 min vite / 1 min lent) au ressenti, dans la nature.',paces:'Vite ≈ '+S(pace.VMAl)+'/km, lent ≈ '+S(pace.EF)+'/km.',recovery:'Récup active libre.',cooldown:CD,tips:['Joue avec le terrain.'],mistakes:['Trop structurer : laisse-toi aller.'],why:'Développe le VO₂max en s\u2019amusant et casse la routine.'};
      break; }
    case 'COTES': {
      const n=vary(8,12), effortSec=37.5;
      const mainKm=distKmFromTime(n*effortSec,pace.SEUIL), recKm=distKmFromTime(n*effortSec,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*effortSec/60+n*effortSec/60+CD_MIN);
      p=S(pace.SEUIL); rpe=8; label='Côtes'; title='Séance de Côtes';
      series={reps:n,recoveryLabel:'descente trot',note:'30-45 s d\u2019effort en côte par répétition'};
      d={objectif:'Développer puissance, force et économie de course.',warmup:WU,body:n+' × 30-45 s en côte (4-6%) à effort soutenu, récup en descente trot.',paces:'Effort à ~90%.',recovery:'Descente en récup.',cooldown:CD,tips:['Foulée courte et dynamique, regarde devant.'],mistakes:['Descendre trop vite (impact).'],why:'La côte = musculation spécifique sans impact traumatisant.'};
      break; }
    case 'LIGNES':
      km=Math.round(easyKm*0.8); p=S(pace.EF); rpe=4; label='Lignes'; title='Footing + Lignes droites';
      d={objectif:'Entretenir la vitesse et la fraîcheur (idéal taper).',warmup:'10 min '+S(pace.EF)+'/km.',body:Math.round(km*0.7)+' km EF + '+vary(6,8)+' × 80-100 m en accélération progressive (sans forcer), récup marche.',paces:'EF + accélérations relâchées.',recovery:'Marche/trot entre lignes.',cooldown:'Étirements.',tips:['Reste relâché, ne sprinte pas.'],mistakes:['Forcer sur les lignes en période d\u2019affûtage.'],why:'Garde le système nerveux affûté sans fatigue.'};
      break;
    case 'COURSE':
      const m=raceMeters(); km=Math.round(m/1000); p=S(predictTime(vdot,m)/(m/1000)); rpe=10; label='Course'; title='🏆 Jour J — '+(P.objRace||'Compétition');
      d={objectif:'Réaliser ta meilleure performance — objectif : '+(P.objTime||goal)+' !',warmup:'25-30 min : footing progressif + lignes droites + 3 accélérations allure course.',body:km+' km à '+S(predictTime(vdot,m)/(m/1000))+'/km. Départ contrôlé, milieu solide, final tout donné.',paces:'Allure objectif : '+S(predictTime(vdot,m)/(m/1000))+'/km.',recovery:'—',cooldown:'15 min footing dès l\u2019arrivée + étirements.',tips:['Ne pars pas trop vite.','Accroche un coureur de ton niveau.'],mistakes:['Mal dormir / mal manger la veille.'],why:'L\u2019aboutissement de toute ta préparation. Fais-toi confiance !'};
      break;
    default:
      km=easyKm; p=S(pace.EF); rpe=3; label='EF'; title='Endurance';
      d={objectif:'Endurance.',warmup:'-',body:km+' km facile.',paces:S(pace.EF)+'/km',recovery:'-',cooldown:'-',tips:[],mistakes:[],why:'Base aérobie.'};
  }
  if(isDeload && km>0){ d.objectif='🟢 SEMAINE ALLÉGÉE — '+d.objectif; }
  return {km,pace:p,rpe,title,label,detail:d,durMin,series};
}

/* ---------- HELPERS: real stats ---------- */
function weekStart(){ const d=new Date(); const dow=(d.getDay()+6)%7; d.setHours(0,0,0,0); d.setDate(d.getDate()-dow); return d; }
function sessThisWeek(){ const ws=weekStart(); return SESS.filter(s=>new Date(s.date)>=ws); }
function kmThisWeek(){ return sessThisWeek().reduce((a,s)=>a+(s.km||0),0); }
function lastWeekKm(){
  const now=new Date(); now.setHours(0,0,0,0);
  const dow=now.getDay()===0?7:now.getDay();
  const thisWeekStart=new Date(now); thisWeekStart.setDate(now.getDate()-dow+1);
  const lastWeekStart=new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate()-7);
  return SESS.filter(s=>{ const d=new Date(s.date+'T00:00:00'); return d>=lastWeekStart && d<thisWeekStart; }).reduce((a,s)=>a+(s.km||0),0);
}
function last7DaysKm(){
  const out=[];
  for(let i=6;i>=0;i--){ const d=new Date(); d.setDate(d.getDate()-i); const k=dateKey(d);
    out.push([...SESS,...MSESS].filter(s=>s.date===k).reduce((a,s)=>a+(s.km||0),0)); }
  return out;
}
function sumKmBetween(start,end){ return [...SESS,...MSESS].filter(s=>{ const d=new Date(s.date+'T00:00:00'); return d>=start && d<end; }).reduce((a,s)=>a+(s.km||0),0); }
function countBetween(start,end){ return [...SESS,...MSESS].filter(s=>{ const d=new Date(s.date+'T00:00:00'); return d>=start && d<end; }).length; }
function sumMinsBetween(start,end){ return sessBetween(start,end).reduce((a,s)=>a+(s.duration||0),0); }
function sessBetween(start,end){ return [...SESS,...MSESS].filter(s=>{ const d=new Date(s.date+'T00:00:00'); return d>=start && d<end; }); }
/* Bornes [début,fin[ de la période courante + période précédente équivalente,
   partagées par kmBarSeries() et statsBilan() pour rester cohérentes. */
function periodRanges(per){
  const ws=weekStart(); const now=new Date();
  if(per==='month'){
    const st=new Date(ws); st.setDate(ws.getDate()-21); const en=new Date(ws); en.setDate(ws.getDate()+7);
    const pst=new Date(st); pst.setDate(st.getDate()-28);
    return {cur:[st,en],prev:[pst,st]};
  }
  if(per==='3m'){
    const st=new Date(now.getFullYear(),now.getMonth()-2,1); const en=new Date(now.getFullYear(),now.getMonth()+1,1);
    const pst=new Date(now.getFullYear(),now.getMonth()-5,1);
    return {cur:[st,en],prev:[pst,st]};
  }
  if(per==='year'){
    const st=new Date(now.getFullYear(),now.getMonth()-11,1); const en=new Date(now.getFullYear(),now.getMonth()+1,1);
    const pst=new Date(now.getFullYear()-1,now.getMonth()-11,1);
    return {cur:[st,en],prev:[pst,st]};
  }
  const en=new Date(ws); en.setDate(ws.getDate()+7);
  const pst=new Date(ws); pst.setDate(ws.getDate()-7);
  return {cur:[ws,en],prev:[pst,ws]};
}
function weeksInPeriod(per){ return per==='month'?4:per==='3m'?13:per==='year'?52:1; }
function periodTabLabel(per){ return {week:'Semaine',month:'Mois',['3m']:'3 Mois',year:'Année'}[per]||'Semaine'; }
/* Séries de barres pour le bloc "Progression" de l'accueil, façon Kalo :
   change de résolution selon l'onglet actif (semaine/mois/3 mois/année). */
function kmBarSeries(period){
  const ws=weekStart();
  const {prev}=periodRanges(period);
  const prevTotal=sumKmBetween(prev[0],prev[1]);
  if(period==='month'){
    const labels=[], values=[];
    for(let w=3; w>=0; w--){ const st=new Date(ws); st.setDate(ws.getDate()-7*w); const en=new Date(st); en.setDate(st.getDate()+7);
      values.push(sumKmBetween(st,en)); labels.push(w===0?'Cette sem.':'S-'+w); }
    return {labels,values,total:values.reduce((a,v)=>a+v,0),prevTotal};
  }
  if(period==='3m'){
    const labels=[], values=[]; const now=new Date();
    for(let m=2;m>=0;m--){ const st=new Date(now.getFullYear(),now.getMonth()-m,1); const en=new Date(now.getFullYear(),now.getMonth()-m+1,1);
      values.push(sumKmBetween(st,en)); labels.push(st.toLocaleDateString('fr-FR',{month:'short'}).replace('.','')); }
    return {labels,values,total:values.reduce((a,v)=>a+v,0),prevTotal};
  }
  if(period==='year'){
    const labels=[], values=[]; const now=new Date(); const initials=['J','F','M','A','M','J','J','A','S','O','N','D'];
    for(let m=11;m>=0;m--){ const d=new Date(now.getFullYear(),now.getMonth()-m,1); const en=new Date(now.getFullYear(),now.getMonth()-m+1,1);
      values.push(sumKmBetween(d,en)); labels.push(initials[d.getMonth()]); }
    return {labels,values,total:values.reduce((a,v)=>a+v,0),prevTotal};
  }
  // 'week' par défaut
  const labels=['L','M','M','J','V','S','D']; const values=[];
  for(let i=0;i<7;i++){ const d=new Date(ws); d.setDate(ws.getDate()+i); const en=new Date(d); en.setDate(d.getDate()+1); values.push(sumKmBetween(d,en)); }
  return {labels,values,total:values.reduce((a,v)=>a+v,0),prevTotal};
}
/* Tendance hebdo (8 dernières semaines) pour le graphe en ligne, indépendante
   de l'onglet sélectionné — donne une vue plus longue de la progression. */
function weeklyTrend8(){
  const ws=weekStart(); const values=[];
  for(let w=7; w>=0; w--){ const st=new Date(ws); st.setDate(ws.getDate()-7*w); const en=new Date(st); en.setDate(st.getDate()+7); values.push(sumKmBetween(st,en)); }
  return values;
}
/* Mini-graphe en ligne SVG (aire + tracé + points), style "weight trend". */
function lineChartSVG(values,width,height,color){
  width=width||300; height=height||64;
  const max=Math.max(...values,1), min=Math.min(...values,0);
  const range=(max-min)||1; const n=values.length; const stepX=n>1?width/(n-1):width; const pad=7;
  const pts=values.map((v,i)=>[i*stepX, pad+(1-(v-min)/range)*(height-2*pad)]);
  const path=pts.map((p,i)=>(i===0?'M':'L')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
  const area=path+' L'+pts[pts.length-1][0].toFixed(1)+','+height+' L0,'+height+' Z';
  const dots=pts.map(p=>'<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3.5" fill="'+color+'" stroke="var(--s1)" stroke-width="2"/>').join('');
  const gid='lg'+Math.floor(Math.random()*1e6);
  return '<svg viewBox="0 0 '+width+' '+height+'" width="100%" height="'+height+'" preserveAspectRatio="none" style="overflow:visible;display:block">'+
    '<defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity=".32"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>'+
    '<path d="'+area+'" fill="url(#'+gid+')" stroke="none"/>'+
    '<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>'+
    dots+'</svg>';
}
/* Barres pixel (pas %) pour éviter les pièges de hauteur en % dans un flex column. */
function kBarsHTML(labels,values,highlightIdx){
  const BARMAX=64;
  const max=Math.max(...values,.001);
  const avg=values.reduce((a,v)=>a+v,0)/(values.length||1);
  const maxIdx=highlightIdx!=null?highlightIdx:values.reduce((bi,v,i)=>v>values[bi]?i:bi,0);
  const avgTop=BARMAX-Math.round(Math.min(1,avg/max)*BARMAX);
  let html='<div class="kbars-box"><div class="kbars-avgline" style="top:'+avgTop+'px"></div><div class="kbars-row">';
  values.forEach((v,i)=>{ const h=v>0?Math.max(3,Math.round(v/max*BARMAX)):3;
    html+='<div class="kbar-col"><div class="kbar'+(i===maxIdx?' hi':'')+'" style="height:'+h+'px"></div></div>'; });
  html+='</div></div><div class="kbars-labs">'+labels.map(l=>'<span>'+l+'</span>').join('')+'</div>';
  return html;
}
function totalKm(){ return SESS.reduce((a,s)=>a+(s.km||0),0); }
function totalTonnage(){ return MSESS.reduce((a,s)=>a+(s.tonnage||0),0); }
function runCountWeek(){ return sessThisWeek().length; }
function sessInPeriod(period){
  const now=new Date(); now.setHours(0,0,0,0);
  let start=new Date(now);
  if(period==='today'){ /* start = now */ }
  else if(period==='week'){ start.setDate(now.getDate()-now.getDay()+(now.getDay()===0?-6:1)); }
  else if(period==='month'){ start=new Date(now.getFullYear(),now.getMonth(),1); }
  else if(period==='year'){ start=new Date(now.getFullYear(),0,1); }
  const end=new Date(now); end.setDate(end.getDate()+1);
  return [...SESS,...MSESS].filter(s=>{ const d=new Date(s.date+'T00:00:00'); return d>=start && d<end; });
}
function kmInPeriod(period){ return sessInPeriod(period).reduce((a,s)=>a+(s.km||0),0); }
function timeInPeriod(period){ return sessInPeriod(period).reduce((a,s)=>a+(s.duration||0),0); }
function muscuCountWeek(){ const ws=weekStart(); return MSESS.filter(s=>new Date(s.date)>=ws).length; }
function totalSessions(){ return SESS.length+MSESS.length; }
function streakDays(){
  const set=new Set([...SESS,...MSESS].map(s=>s.date));
  let streak=0; let d=new Date(); d.setHours(0,0,0,0);
  if(!set.has(dateKey(d))){ d.setDate(d.getDate()-1); if(!set.has(dateKey(d))) return 0; }
  while(set.has(dateKey(d))){ streak++; d.setDate(d.getDate()-1); }
  return streak;
}
// Nom du plan réellement suivi en ce moment (généré par IKORUN ou perso choisi par l'athlète)
function followedPlanLabel(){
  if(P.followPerso){ const p=CUSTOM.find(x=>x.id===P.followPerso); if(p) return '👤 '+p.name; }
  return PLAN?PLAN.goal||'En cours':'Aucun plan actif';
}
function planSessionToday(){
  if(P.followPerso){
    const p=CUSTOM.find(x=>x.id===P.followPerso);
    if(p){
      const s=p.sessions.find(x=>x.date===todayKey());
      if(s) return {...s,_source:'perso',_personId:p.id};
      return null;
    }
  }
  if(!PLAN) return null;
  return PLAN.sessions.find(s=>s.date===todayKey());
}
function formScore(){
  // simple: based on sessions done this week vs target & recent load
  const target=(P.days&&P.days.length)||4;
  const did=runCountWeek()+muscuCountWeek();
  return Math.min(100,Math.round(did/target*100));
}

/* ---------- DAILY GOALS ---------- */
function getDailyGoals(){
  const tk=todayKey();
  if(GOALS.date!==tk){
    // Banque les XP des objectifs cochés la veille avant de réinitialiser
    if(GOALS.list){
      const checked=GOALS.list.filter(g=>g.done).length;
      let earned=checked*XP_RULES.perGoal;
      if(GOALS.list.length && GOALS.list.every(g=>g.done)) earned+=XP_RULES.allGoalsBonus;
      XP.pastGoalXP=(XP.pastGoalXP||0)+earned;
      DB.save('xp',XP);
    }
    const list=[
      {id:'hydra',txt:'Boire 2L d\u2019eau',done:false},
      {id:'sleep',txt:'Dormir 8h cette nuit',done:false}
    ];
    const ps=planSessionToday();
    if(ps && ps.type!=='Repos') list.unshift({id:'plan',txt:'Faire : '+ps.title,done:false});
    else list.unshift({id:'mobility',txt:'10 min de mobilité',done:false});
    GOALS={date:tk,list};
    DB.save('daily_goals',GOALS);
  }
  return GOALS.list;
}
function toggleGoal(id){
  const g=GOALS.list.find(x=>x.id===id); if(!g) return;
  const wasAll=GOALS.list.every(x=>x.done);
  g.done=!g.done;
  DB.save('daily_goals',GOALS);
  // Recalcul COMPLET : cocher ajoute, décocher retire automatiquement
  refreshXP({animate:true});
  const isAll=GOALS.list.every(x=>x.done);
  if(g.done && isAll && !wasAll){ burst(); sfx('finish'); toast('🎉 Tous les objectifs ! +'+XP_RULES.allGoalsBonus+' XP'); }
  else if(g.done){ sfx('goal'); toast('+'+XP_RULES.perGoal+' XP'); }
  else toast('−'+XP_RULES.perGoal+' XP');
  renderHome();
}

/* ---------- RING SVG ---------- */
let _ringGradId=0;
function ringSVG(size,pct,stroke,color,bg){
  const r=(size-stroke)/2, c=2*Math.PI*r, off=c*(1-Math.min(1,pct/100));
  const gid='rg'+(_ringGradId++);
  return '<svg width="'+size+'" height="'+size+'" style="transform:rotate(-90deg);overflow:visible"><defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity=".55"/><stop offset="100%" stop-color="'+color+'"/></linearGradient></defs>'+
    '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+(bg||'var(--s2)')+'" stroke-width="'+stroke+'"/>'+
    '<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="url(#'+gid+')" stroke-width="'+stroke+'" stroke-linecap="round" stroke-dasharray="'+c+'" stroke-dashoffset="'+off+'" style="transition:stroke-dashoffset 1s var(--ease);filter:drop-shadow(0 0 6px '+color+'aa)"/></svg>';
}
/* Anneau de stat compact (ring-wrap + svg + valeur centrale), factorisé pour
   éviter de dupliquer ce markup à chaque tuile du bento (charge/séances/forme).
   Ajoute un badge ✓ discret quand l'objectif est dépassé, plutôt que de
   laisser l'anneau plein (100%) sans distinction visuelle avec "pile à 100%". */
function ringStat(size,stroke,color,valueLabel,subLabel,pct,over){
  const fs=size>=90?21:14;
  return '<div class="ring-wrap" style="width:'+size+'px;height:'+size+'px">'+
    ringSVG(size,pct,stroke,color)+
    (over?'<div class="ring-over">'+ICN('check',size>=90?12:10)+'</div>':'')+
    '<div class="ring-c"><div class="big" style="font-size:'+fs+'px">'+valueLabel+'</div>'+(subLabel?'<div class="sm">'+subLabel+'</div>':'')+'</div>'+
  '</div>';
}
/* multi-segment donut: segs = [{v:number,color:'var(--e)'}], centerHTML optional */
function donutSVG(segs,size,stroke,centerHTML){
  size=size||120; stroke=stroke||16;
  const total=segs.reduce((a,s)=>a+s.v,0)||1;
  const r=(size-stroke)/2, c=2*Math.PI*r;
  let off=0, arcs='';
  segs.forEach(s=>{
    const frac=s.v/total, len=c*frac;
    arcs+='<circle cx="'+size/2+'" cy="'+size/2+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="'+stroke+'" stroke-dasharray="'+len+' '+(c-len)+'" stroke-dashoffset="'+(-off)+'" style="transition:stroke-dasharray .8s var(--ease)"/>';
    off+=len;
  });
  return '<div style="position:relative;width:'+size+'px;height:'+size+'px;margin:0 auto"><svg width="'+size+'" height="'+size+'" style="transform:rotate(-90deg)">'+arcs+'</svg>'+
    (centerHTML?'<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">'+centerHTML+'</div>':'')+'</div>';
}
function fmtHM(mins){ mins=Math.round(mins||0); const h=Math.floor(mins/60), m=mins%60; return h>0?(h+'h '+String(m).padStart(2,'0')+'min'):(m+'min'); }

/* ---------- RENDER HOME HELPERS (Accueil A) ---------- */
// Variation de charge hebdo vs la semaine passée, pour le quip sous le gros chiffre
function homeLoadQuip(kmW){
  const prev=lastWeekKm();
  if(!prev) return 'Continue sur ta lancée.';
  const delta=Math.round((kmW-prev)/prev*100);
  if(delta>0) return '↑ '+delta+'% vs semaine dernière. Rythme tenu.';
  if(delta<0) return '↓ '+Math.abs(delta)+'% vs semaine dernière.';
  return 'Charge stable vs semaine dernière.';
}
// Bandeau streak (série de jours consécutifs) — n'apparaît que si une série est en cours
function homeStreakBadge(){
  const s=streakDays();
  if(s<2) return '';
  const isPR=s>=bestStreak();
  return '<div class="streak">'+ICN('fire',13,'#ffb35c')+' <b>'+s+'</b> jours de suite'+(isPR?' — record perso':'')+'</div>';
}
// Ligne des 3 records perso les plus emblématiques (3000m / 5000m / 10km)
function homePBRow(){
  const defs=[['3000 m',3000,P.pb3k||P.t3k],['5000 m',5000,P.pb5k||P.t5k],['10 km',10000,P.pb10k||P.t10k]];
  const cells=defs.map(([label,meters,time])=>{
    if(!time) return '<div class="card pb-card"><div class="pb-dist">'+label+'</div><div class="pb-time" style="color:var(--dim);font-size:14px">—</div></div>';
    const spk=parseTime(time)/(meters/1000);
    return '<div class="card pb-card"><div class="pb-dist">'+label+'</div><div class="pb-time">'+time+'</div><div class="pb-pace">'+spkToStr(spk)+'/km</div></div>';
  });
  return '<div class="pb-row">'+cells.join('')+'</div>';
}
// Carte objectif + compte à rebours vers la course visée
function homeGoalCard(){
  if(!P.compDate) return '';
  const today=new Date(); today.setHours(0,0,0,0);
  const comp=new Date(P.compDate+'T00:00:00');
  const daysLeft=Math.max(0,daysBetween(today,comp));
  let pct=58;
  if(PLAN && PLAN.sessions && PLAN.sessions.length){
    const tk=todayKey();
    const todaySess=PLAN.sessions.find(s=>s.date===tk);
    const upcoming=PLAN.sessions.find(s=>s.date>=tk);
    const curWeekNum=(todaySess||upcoming||PLAN.sessions[PLAN.sessions.length-1]).week;
    pct=PLAN.weeks?Math.min(100,Math.round((curWeekNum/PLAN.weeks)*100)):pct;
  }
  return '<div class="card goal-card stag" style="animation-delay:.1s" onclick="nav(\'sport\');sportTab=\'run\';runSub=\'ia\'">'+
    '<div class="goal-top">'+
      '<div><div class="goal-lab">Objectif</div><div class="goal-race">'+(P.objRace||P.goal||'Ta prochaine course')+(P.objTime?' — sub '+P.objTime:'')+'</div>'+
      '<div class="goal-target">Course le '+fmtDate(P.compDate)+'</div></div>'+
      '<div class="goal-count"><div class="n">'+daysLeft+'</div><div class="u">jours</div></div>'+
    '</div>'+
    '<div class="goal-bar"><div style="width:'+pct+'%"></div></div>'+
  '</div>';
}
// Ligne "Progression" — badges de médailles (séances / régularité / distance)
function homeBadgesRow(){
  const icons={'Séances':'medal','Régularité':'fire','Distance':'chart'};
  let bestCat=null, bestPct=-1, bestTier=-1;
  const cells=MEDAL_CATS.map(c=>{
    const v=Math.floor(c.val());
    let tierIdx=-1; c.thr.forEach((t,i)=>{ if(v>=t)tierIdx=i; });
    const next=tierIdx<c.thr.length-1?c.thr[tierIdx+1]:null;
    const prevT=tierIdx>=0?c.thr[tierIdx]:0;
    const pct=next?Math.min(100,Math.round(((v-prevT)/(next-prevT))*100)):100;
    if(next && pct>bestPct){ bestPct=pct; bestCat=c; bestTier=tierIdx; }
    const locked=tierIdx<0;
    return '<div class="badge-mini'+(locked?' locked':'')+'" onclick="nav(\'stats\')">'+ICN(icons[c.name]||'medal',18)+'</div>';
  });
  const label=bestCat?(TIERS[bestTier+1]?TIERS[bestTier+1][0]:bestCat.name)+' · '+bestPct+'%':'Continue pour débloquer tes badges';
  return '<div class="card stag" style="padding:16px;animation-delay:.12s" onclick="nav(\'stats\')">'+
    '<div class="badge-mini-row">'+cells.join('')+
      '<div class="badge-progress-txt"><div class="t">'+label+'</div><div class="b"><div style="width:'+Math.max(0,bestPct)+'%"></div></div></div>'+
    '</div></div>';
}

/* ---------- RENDER HOME ---------- */
function renderHome(){
  const xp=xpProgress();
  const kmW=kmThisWeek(), kmTarget=P.kmWeek||40;
  const sessW=runCountWeek()+muscuCountWeek(), sessTarget=(P.days&&P.days.length)||4;
  const form=formScore();
  const vdot=getUserVDOT();
  const tonnage=Math.round(totalTonnage());
  const ps=planSessionToday();
  const first=(P.name||'').split(' ')[0]||'';

  if(P.easyMode){ $('#s-home').innerHTML=renderHomeSimple(ps,sessW,sessTarget,vdot,form,first); return; }

  let html='';

  // HEADER — logo IKORUN + cloche notifications
  html+='<div class="ik-header"><div class="ik-logo">'+
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20L14 3l1.5 3.2L9 18.5z" fill="var(--e2)"/><path d="M9 18.5L15.5 6.2 20 9.5 12 20z" fill="var(--e)"/></svg>'+
    '<span>IKORUN</span></div>'+
    '<div class="ik-bell" onclick="toast(\'Aucune nouvelle notification\')">'+ICN('bell',18)+'<span class="dot"></span></div></div>';

  // STREAK (série de jours consécutifs)
  html+=homeStreakBadge();

  // SALUTATION — quip dynamique sur l'objectif si défini
  const quip=P.objTime?'On chasse le '+P.objTime+' ?':(P.goal?'On avance vers : '+P.goal+' ?':'Prêt à dépasser tes limites aujourd\u2019hui ?');
  html+='<div class="ik-greet"><h1>Salut '+(first||'toi')+'.<br>'+quip+'</h1></div>';

  // HERO FUSIONNÉ — charge hebdo (gros chiffre) + quip + niveau/XP + forme + sparkline
  { const xpv=xp; const ws=weekStart(); const dowLabels=['L','M','M','J','V','S','D'];
    const week=[]; for(let i=0;i<7;i++){ const d=new Date(ws); d.setDate(ws.getDate()+i); const k=dateKey(d);
      week.push([...SESS,...MSESS].filter(s=>s.date===k).reduce((a,s)=>a+(s.km||0),0)); }
    const maxDay=Math.max(1,...week);
    html+='<div class="card ik-hero stag" style="animation-delay:.02s" onclick="nav(\'stats\')">'+
      '<div class="ik-hero-lab">Charge hebdomadaire</div>'+
      '<div class="ik-hero-big"><div class="n">'+kmW.toFixed(2).replace('.',',')+'</div><div class="u">km</div></div>'+
      '<div class="hero-quip">'+homeLoadQuip(kmW)+'</div>'+
      '<div class="ik-hero-mid">'+
        '<div class="ik-hero-ring-wrap">'+donutSVG([{v:xpv.pct,color:'var(--e)'},{v:100-xpv.pct,color:'rgba(255,255,255,.08)'}],52,6,'<div class="lvl-lab">NIV.</div><div class="lvl-n">'+XP.level+'</div>')+'</div>'+
        '<div class="ik-hero-mid-txt"><div class="v">Niveau '+XP.level+' — '+XP.total+' XP</div><div class="l">+'+Math.max(0,xpv.span-xpv.inLvl)+' XP avant niveau '+(XP.level+1)+'</div></div>'+
      '</div>'+
      '<div class="ik-hero-divider"></div>'+
      '<div class="ik-hero-row3">'+
        '<div><div class="hstat-v">'+sessW+'<span>/'+sessTarget+'</span></div><div class="hstat-l">Séances</div></div>'+
        donutSVG([{v:form,color:'var(--ok)'},{v:100-form,color:'rgba(255,255,255,.08)'}],50,6,'<div class="week-ring-v'+(form>=100?' v-sm':'')+'">'+form+'%</div><div class="week-ring-l">Forme</div>')+
      '</div>'+
      '<div class="week-spark-wrap"><div class="spark" style="height:36px">'+week.map(v=>'<b style="height:'+Math.max(8,Math.round(v/maxDay*100))+'%"></b>').join('')+'</div>'+
      '<div class="week-spark-days">'+dowLabels.map(l=>'<span>'+l+'</span>').join('')+'</div></div>'+
    '</div>';
  }

  // STAT QUATRO — séances / VDOT / tonnage / forme
  html+='<div class="stat-quatro">'+
    '<div class="card stat-card" onclick="nav(\'stats\')"><div class="stat-ic">'+ICN('run',14)+'</div><div class="stat-v">'+sessW+'/'+sessTarget+'</div><div class="stat-l">Séances</div></div>'+
    '<div class="card stat-card" onclick="nav(\'outils\');openTool(\'vdot\')"><div class="stat-ic">'+ICN('lung',14)+'</div><div class="stat-v">'+(vdot||'—')+'</div><div class="stat-l">VDOT</div></div>'+
    '<div class="card stat-card" onclick="nav(\'sport\');sportTab=\'muscu\'"><div class="stat-ic">'+ICN('chart',14)+'</div><div class="stat-v">'+tonnage.toLocaleString('fr-FR')+'</div><div class="stat-l">Tonnage kg</div></div>'+
    '<div class="card stat-card" onclick="nav(\'stats\')"><div class="stat-ic">'+ICN('heart',14)+'</div><div class="stat-v">'+form+'%</div><div class="stat-l">Forme</div></div>'+
  '</div>';

  // CARTE PROCHAINE SÉANCE
  html+='<div class="next-lab">PROCHAINE SÉANCE</div>';
  if(ps && ps.type!=='Repos'){
    html+='<div class="card next-card stag" style="animation-delay:.06s" onclick="'+(ps._source==='perso'?"curPerso='"+ps._personId+"';openPersoSheet('"+ps.id+"')":'openRunSheet('+ps.id+')')+'">'+
      '<div class="next-body"><div class="next-title">'+ps.title+'</div>'+
      '<div class="next-meta">'+(ps.km?ps.km+' km · '+ps.pace+'/km'+(ps.duration?' · '+ps.duration+' min':''):'')+'</div>'+
      '<div class="next-when">Aujourd\u2019hui</div></div>'+
      '<div class="next-ic">'+ICN('run',20)+'</div></div>';
  } else {
    html+='<div class="card next-card stag" style="animation-delay:.06s" onclick="nav(\'sport\')">'+
      '<div class="next-body"><div class="next-title">Jour de repos</div>'+
      '<div class="next-meta">Aucune séance planifiée aujourd\u2019hui</div></div>'+
      '<div class="next-ic">'+ICN('moon',20)+'</div></div>';
  }

  // RECORDS PERSO
  if(P.pb3k||P.pb5k||P.pb10k||P.t3k||P.t5k||P.t10k){
    html+='<div class="sec-lab">Records perso <span class="link" onclick="openRecords()" style="cursor:pointer">Voir tout ›</span></div>';
    html+=homePBRow();
  }

  // OBJECTIF + COUNTDOWN
  html+=homeGoalCard();

  // PROGRESSION (badges)
  html+='<div class="sec-lab">Progression</div>';
  html+=homeBadgesRow();

  // PLAN DU JOUR
  html+='<div class="plan-lab">PLAN DU JOUR</div>';
  html+='<div class="card plan-list stag" style="animation-delay:.08s">'+
    '<div class="plan-item" onclick="nav(\'sport\')"><div class="plan-ic">'+ICN('run',18)+'</div>'+
      '<div class="plan-body"><div class="plan-title">Plan IKORUN</div><div class="plan-sub">Plans d\u2019entraînement conçus par des coaches</div></div>'+ICN('chevronR',18,'var(--dim)')+'</div>'+
    '<div class="plan-item" onclick="runSub=\'perso\';sportTab=\'run\';nav(\'sport\')"><div class="plan-ic">'+ICN('edit',18)+'</div>'+
      '<div class="plan-body"><div class="plan-title">Plan personnel</div><div class="plan-sub">Crée ton propre plan sur mesure</div></div>'+ICN('chevronR',18,'var(--dim)')+'</div>'+
  '</div>';

  $('#s-home').innerHTML=html;
}
function renderHomeSimple(ps,sessW,sessTarget,vdot,form,first){
  let h='';
  h+='<div class="ik-header"><div class="ik-logo">'+
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20L14 3l1.5 3.2L9 18.5z" fill="var(--e2)"/><path d="M9 18.5L15.5 6.2 20 9.5 12 20z" fill="var(--e)"/></svg>'+
    '<span>IKORUN</span></div></div>';
  h+=homeStreakBadge();
  h+='<div class="ik-greet"><h1>Salut '+(first||'toi')+' 👋</h1></div>';

  h+='<div class="next-lab">AUJOURD\u2019HUI</div>';
  if(ps && ps.type!=='Repos'){
    h+='<div class="card next-card stag" onclick="'+(ps._source==='perso'?"curPerso='"+ps._personId+"';openPersoSheet('"+ps.id+"')":'openRunSheet('+ps.id+')')+'">'+
      '<div class="next-body"><div class="next-title">'+ps.title+'</div>'+
      '<div class="next-meta">'+(ps.km?ps.km+' km · '+ps.pace+'/km'+(ps.duration?' · '+ps.duration+' min':''):'')+'</div>'+
      '<div class="next-when">Toucher pour démarrer ›</div></div>'+
      '<div class="next-ic">'+ICN('run',20)+'</div></div>';
  } else {
    h+='<div class="card next-card stag" onclick="nav(\'sport\')">'+
      '<div class="next-body"><div class="next-title">Jour de repos</div>'+
      '<div class="next-meta">Aucune séance planifiée aujourd\u2019hui</div></div>'+
      '<div class="next-ic">'+ICN('moon',20)+'</div></div>';
  }

  h+='<div class="stat-quatro" style="grid-template-columns:repeat(3,1fr);margin-top:14px">'+
    '<div class="card stat-card" onclick="nav(\'sport\')"><div class="stat-ic">'+ICN('run',14)+'</div><div class="stat-v">'+sessW+'/'+sessTarget+'</div><div class="stat-l">Séances</div></div>'+
    '<div class="card stat-card" onclick="nav(\'profil\')"><div class="stat-ic">'+ICN('lung',14)+'</div><div class="stat-v">'+(vdot||'—')+'</div><div class="stat-l">VDOT</div></div>'+
    '<div class="card stat-card" onclick="nav(\'profil\')"><div class="stat-ic">'+ICN('heart',14)+'</div><div class="stat-v">'+form+'%</div><div class="stat-l">Forme</div></div>'+
  '</div>';

  if(P.objRace||P.goal||P.compDate){
    h+='<div class="sec-lab" style="margin-top:16px">Objectif</div>'+homeGoalCard();
  }
  return h;
}
function fmtDate(s){ const d=new Date(s); return d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}); }

/* ---------- SPORT ---------- */
let sportTab='run', runSub='ia';
/* ---------- HERO DU PLAN (design inspiré wireframe) ---------- */
function planHeroHTML(){
  const tk=todayKey();
  const done=PLAN.sessions.filter(s=>s.done).length;
  const todaySess=PLAN.sessions.find(s=>s.date===tk);
  const upcoming=PLAN.sessions.find(s=>s.date>=tk);
  const curWeekNum=(todaySess||upcoming||PLAN.sessions[PLAN.sessions.length-1]).week;
  const weekSessions=PLAN.sessions.filter(s=>s.week===curWeekNum);
  const phaseKey=weekSessions[0]?.phaseKey;
  const phaseWeeks=[...new Set(PLAN.sessions.filter(s=>s.phaseKey===phaseKey).map(s=>s.week))].sort((a,b)=>a-b);
  const phaseProgress=phaseWeeks.length>1?Math.round(((curWeekNum-phaseWeeks[0])/(phaseWeeks.length-1))*100):100;
  const comp=new Date(P.compDate+'T00:00:00'), today=new Date(tk+'T00:00:00');
  const daysLeft=Math.max(0,Math.round((comp-today)/86400000));

  const byDow={}; weekSessions.forEach(s=>{ byDow[new Date(s.date+'T00:00:00').getDay()]=s; });
  const dowOrder=[1,2,3,4,5,6,0], dowLab=['L','M','M','J','V','S','D'];
  let dots='';
  dowOrder.forEach((dow,i)=>{
    const s=byDow[dow];
    let cls='dotcell', ic='';
    if(!s || s.km===0) cls+=' dot-rest';
    else if(s.done){ cls+=' dot-done'; ic='✓'; }
    else if(s.missed){ cls+=' dot-missed'; ic='✕'; }
    else if(s.date===tk) cls+=' dot-today';
    dots+='<div class="'+cls+'"><div class="dc-lab">'+dowLab[i]+'</div><div class="dc-circ">'+ic+'</div></div>';
  });

  const curKm=Math.round(weekSessions.reduce((a,s)=>a+(s.km||0),0));
  const prevKm=Math.round(PLAN.sessions.filter(s=>s.week===curWeekNum-1).reduce((a,s)=>a+(s.km||0),0));
  const kmDelta=prevKm?Math.round((curKm-prevKm)/prevKm*100):null;

  const curVdot=getUserVDOT()||PLAN.vdot;
  const vdotDelta=Math.round((curVdot-PLAN.vdot)*10)/10;

  let h='<div class="card plan-hero">';
  h+='<div class="lab">OBJECTIF</div><div class="plan-race">'+(P.objRace||'Course')+'</div>';
  h+='<div class="plan-sub">'+(P.objTime?'Objectif : '+P.objTime+' · ':'')+'Course le '+fmtDate(P.compDate)+'</div>';
  h+='<div class="row" style="gap:10px;margin-top:16px">';
  h+='<div class="minicard"><div class="lab">Jour de course</div><div class="v" style="color:var(--e)">J-'+daysLeft+'</div></div>';
  h+='<div class="minicard"><div class="lab">VDOT actuel</div><div class="v">'+curVdot+(vdotDelta?' <span class="'+(vdotDelta>0?'delta-up':'delta-down')+'">'+(vdotDelta>0?'+':'')+vdotDelta+'</span>':'')+'</div></div>';
  h+='</div>';
  h+='<div style="margin-top:16px"><div class="lab">Phase actuelle</div><div class="man" style="font-weight:700;font-size:16px;margin:2px 0 8px">'+(weekSessions[0]?.phase||'')+'</div><div class="pbar"><div style="width:'+phaseProgress+'%"></div></div></div>';
  h+='<div style="margin-top:16px"><div class="row" style="margin-bottom:8px"><div class="lab">Cette semaine</div><div class="lab">Semaine '+curWeekNum+'/'+PLAN.weeks+'</div></div><div class="dotrow">'+dots+'</div></div>';
  h+='<div class="row" style="gap:10px;margin-top:16px">';
  h+='<div class="minicard"><div class="lab">Charge hebdo</div><div class="v">'+curKm+' km'+(kmDelta!==null?' <span class="'+(kmDelta>=0?'delta-up':'delta-down')+'">'+(kmDelta>=0?'+':'')+kmDelta+'%</span>':'')+'</div></div>';
  h+='<div class="minicard"><div class="lab">Séances</div><div class="v">'+done+'/'+PLAN.sessions.length+'</div></div>';
  h+='</div>';
  h+='<button class="btn ghost sm" style="margin-top:16px" onclick="if(confirm(\'Régénérer un nouveau plan ? Tes séances faites restent dans tes stats.\')){PLAN=null;openPlanSetup()}">🔄 Régénérer / reconfigurer</button>';
  h+='</div>';
  return h;
}
function renderRunning(){
  let h='<div class="pills" style="margin-bottom:14px"><div class="pill '+(runSub==='ia'?'on':'')+'" onclick="runSub=\'ia\';renderSport()">⚡ Plan IKORUN</div><div class="pill '+(runSub==='perso'?'on':'')+'" onclick="runSub=\'perso\';renderSport()">📋 Plan personnel</div></div>';
  if(runSub==='ia'){
    if(!PLAN){
      h+='<div class="card"><div class="empty"><div class="em-ic">⚡</div><div style="font-weight:700;margin-bottom:6px;color:var(--snow)">Plan IKORUN — moteur scientifique</div><div style="font-size:13px;margin-bottom:16px">Génère un plan périodisé sur-mesure (méthode norvégienne + VDOT/Daniels) basé sur ton VDOT ('+(getUserVDOT()||'?')+'), ton objectif, tes préférences et ta date de course. Le plan se réajuste automatiquement si tu rates une séance.</div><button class="btn" onclick="openPlanSetup()">⚙️ Configurer & générer</button></div></div>';
    } else {
      h+=planHeroHTML();
      // group by phase puis semaine — seule la semaine en cours est affichée par défaut
      let curPhase=null, curWeek=null;
      const tk=todayKey();
      const todaySess=PLAN.sessions.find(s=>s.date===tk);
      const upcoming=PLAN.sessions.find(s=>s.date>=tk);
      const featuredWeek=(todaySess||upcoming||PLAN.sessions[PLAN.sessions.length-1]).week;
      let toggleShown=false;
      PLAN.sessions.forEach(s=>{
        if(!sportShowAllWeeks && s.week!==featuredWeek){
          if(!toggleShown){
            const remaining=[...new Set(PLAN.sessions.filter(x=>x.week!==featuredWeek).map(x=>x.week))].length;
            h+='<button class="btn ghost" style="margin:14px 0 4px" onclick="sportShowAllWeeks=true;renderSport()">Afficher le reste du plan · '+remaining+' semaines ↓</button>';
            toggleShown=true;
          }
          return;
        }
        if(s.phase!==curPhase){ curPhase=s.phase; h+='<div class="phase-head" style="color:var('+(s.color||'--e')+')">▸ '+s.phase+'</div>'; }
        if(s.week!==curWeek){ curWeek=s.week; h+='<div class="lab" style="margin:8px 0 6px">Semaine '+s.week+(s.deload?' · 🟢 allégée':'')+'</div>'; }
        const isToday=s.date===tk;
        const col='var('+(s.color||'--e')+')';
        const isHard=HARD_TYPES.includes(s.baseType);
        const qb=s.missed?'<div class="qbadge" style="background:rgba(255,92,108,.16);color:var(--bad)">⚠ Manquée</div>'
          :(s.km===0?'<div class="qbadge rest">Repos</div>':'<div class="chrome-chip" style="color:'+baseTypeColor(s.baseType)+'">'+s.type+'</div>');
        const ssum=seriesSummary(s);
        const line2=fmtDate(s.date)+(s.km?' · '+s.km+' km':' · Repos')+(s.km&&!ssum?' · '+s.pace+'/km':'');
        h+='<div class="sess '+(s.done?'done':'')+' '+(isToday?'today':'')+'" onclick="openRunSheet('+s.id+')" style="'+(s.missed?'border-color:rgba(255,92,108,.35)':'')+'"><div class="row"><div><div style="font-weight:700;font-size:14px">'+s.title+'</div><div style="color:var(--muted);font-size:12px;margin-top:3px">'+line2+'</div>'+(ssum?'<div style="color:var(--e);font-size:12px;font-weight:700;margin-top:3px">⏱ '+ssum+'</div>':'')+'</div>'+qb+'</div></div>';
      });
      if(sportShowAllWeeks) h+='<button class="btn ghost" style="margin:14px 0 4px" onclick="sportShowAllWeeks=false;renderSport()">Réduire ↑</button>';
    }
  } else {
    h+=renderPersoList();
  }
  return h;
}
/* ---------- PLAN PERSONNEL (fonctionnel) ---------- */
let curPerso=null;
function renderPersoList(){
  const persoPlans=CUSTOM.filter(p=>p.kind==='run');
  let h='<button class="btn" style="margin-bottom:14px" onclick="addPersoPlan()">＋ Nouveau plan personnel</button>';
  if(!persoPlans.length){ h+='<div class="card"><div class="empty"><div class="em-ic">📋</div><div style="font-weight:700;color:var(--snow);margin-bottom:6px">Crée ton plan sur-mesure</div><div style="font-size:13px">Ajoute tes propres séances, choisis les dates, types et allures. Tout se synchronise avec ton accueil et tes stats.</div></div></div>'; }
  else persoPlans.forEach((p)=>{
    const done=p.sessions.filter(s=>s.done).length;
    const followBadge=P.followPerso===p.id?'<span class="chrome-chip" style="color:var(--ok);margin-left:6px">✅ Suivi</span>':'';
    h+='<div class="card" style="padding:13px 14px"><div class="row" onclick="openPerso(\''+p.id+'\')" style="cursor:pointer"><div><div style="font-weight:700;font-size:14.5px">'+p.name+followBadge+'</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+p.sessions.length+' séances · '+done+' terminées</div></div><span style="color:var(--e);font-size:18px">›</span></div>'+
      '<div class="row" style="margin-top:9px;gap:8px"><div class="pbar" style="flex:1;margin-top:0"><div style="width:'+(p.sessions.length?done/p.sessions.length*100:0)+'%"></div></div>'+
      '<span class="mini-ic" onclick="dupPerso(\''+p.id+'\')" title="Dupliquer">⎘</span><span class="mini-ic" onclick="sharePlan(\''+p.name+'\')" title="Partager">↗</span><span class="mini-ic" style="color:var(--bad)" onclick="delPerso(\''+p.id+'\')" title="Supprimer">🗑</span></div></div>';
  });
  return h;
}
function addPersoPlan(){
  const n=prompt('Nom du plan :','Mon plan perso'); if(!n) return;
  const id='P'+Date.now();
  CUSTOM.push({id,kind:'run',name:n,sessions:[]}); saveAll(); openPerso(id);
}
function openPerso(id){ curPerso=id; renderSport(); setTimeout(()=>renderPersoDetail(),0); }
let sportView='list';
let sportShowAllWeeks=false; // n'affiche que la semaine en cours par défaut, dans les deux modes
function renderSport(){
  document.body.dataset.scr = sportView==='calendar' ? 'calendrier' : 'sport';
  $('#tbTitle').textContent = sportView==='calendar' ? 'Calendrier' : t('sport');
  $('#tbSub').textContent = sportView==='calendar' ? 'Planifie ta progression' : t('sub_sport');
  if(sportView==='calendar'){ $('#s-sport').innerHTML=renderCalendarView(); return; }
  let h='<div class="row" style="gap:8px;margin:6px 0 16px">'+
    '<div class="pills" style="flex:1;margin:0"><div class="pill '+(sportTab==='run'?'on':'')+'" onclick="sportTab=\'run\';curPerso=null;renderSport()">🏃 Running</div><div class="pill '+(sportTab==='muscu'?'on':'')+'" onclick="sportTab=\'muscu\';renderSport()">🏋️ Musculation</div></div>'+
    '<div class="tb-gear" style="flex-shrink:0" onclick="sportView=\'calendar\';renderSport()">'+ICN('calendar',17)+'</div></div>';
  if(sportTab==='run' && runSub==='perso' && curPerso){ h+=persoDetailHTML(); }
  else h+= sportTab==='run'?renderRunning():renderMuscu();
  $('#s-sport').innerHTML=h;
}
let calMonthOffset=0;
function calMonthNav(d){ calMonthOffset+=d; $('#s-sport').innerHTML=renderCalendarView(); }
function calBack(){ sportView='list'; renderSport(); }
function sessionsForDate(k){
  const out=[];
  if(PLAN) PLAN.sessions.filter(s=>s.date===k && s.km>0).forEach(s=>out.push(s));
  const fp=P.followPerso?CUSTOM.find(x=>x.id===P.followPerso):null;
  if(fp) fp.sessions.filter(s=>s.date===k).forEach(s=>out.push(s));
  return out;
}
function renderCalendarView(){
  const now=new Date(); const view=new Date(now.getFullYear(),now.getMonth()+calMonthOffset,1);
  const y=view.getFullYear(), m=view.getMonth();
  const monthLab=view.toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  const firstDow=(new Date(y,m,1).getDay()+6)%7; // 0=lundi
  const daysInMonth=new Date(y,m+1,0).getDate();
  const daysInPrev=new Date(y,m,0).getDate();
  const tk=todayKey();
  const cells=[]; 
  for(let i=firstDow-1;i>=0;i--) cells.push({d:daysInPrev-i,muted:true});
  for(let d=1;d<=daysInMonth;d++){ const k=dateKey(new Date(y,m,d)); cells.push({d,muted:false,k,today:k===tk,has:sessionsForDate(k).length>0}); }
  while(cells.length%7!==0 || cells.length<42) { const nd=cells.length - (firstDow+daysInMonth); cells.push({d:nd,muted:true}); if(cells.length>=42) break; }

  let h='<div class="row" style="margin-bottom:2px"><div class="x" onclick="calBack()" style="margin-right:8px">‹</div><div style="flex:1"></div></div>';
  h+='<div class="card">';
  h+='<div class="row" style="margin-bottom:12px"><div style="font-weight:800;font-family:\'Unbounded\';font-size:15px;text-transform:capitalize">'+monthLab+'</div>'+
    '<div style="display:flex;gap:6px"><div class="tb-gear" style="width:28px;height:28px" onclick="calMonthNav(-1)">‹</div><div class="tb-gear" style="width:28px;height:28px" onclick="calMonthNav(1)">›</div></div></div>';
  h+='<div class="cal-grid cal-head">'+['L','M','M','J','V','S','D'].map(l=>'<span>'+l+'</span>').join('')+'</div>';
  h+='<div class="cal-grid">';
  cells.forEach(c=>{
    if(c.muted) h+='<div class="cal-cell muted">'+c.d+'</div>';
    else h+='<div class="cal-cell'+(c.today?' today':'')+'">'+c.d+(c.has&&!c.today?'<span class="cal-dot"></span>':'')+'</div>';
  });
  h+='</div></div>';

  // Liste des prochaines séances
  h+='<div class="card" style="padding:12px 14px">';
  const dayLabels=['Aujourd\u2019hui','Demain'];
  let shown=0;
  for(let i=0;i<10 && shown<3;i++){
    const d=new Date(); d.setDate(d.getDate()+i); const k=dateKey(d);
    const sess=sessionsForDate(k);
    if(!sess.length) continue;
    const lab=i<2?dayLabels[i]:d.toLocaleDateString('fr-FR',{weekday:'long'});
    const dlab=lab.charAt(0).toUpperCase()+lab.slice(1)+' · '+d.getDate()+' '+d.toLocaleDateString('fr-FR',{month:'long'});
    if(shown>0) h+='<div style="height:1px;background:var(--hair);margin:12px 0"></div>';
    h+='<div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:8px">'+dlab+'</div>';
    sess.forEach(s=>{
      h+='<div class="rs-row" style="padding:0 0 4px" onclick="openRunSheet('+s.id+')"><div class="rs-ic" style="background:rgba(51,211,153,.16);color:var(--ok)">'+ICN('run',16)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">'+s.title+'</div><div class="rs-row-m">'+s.km+' km · '+s.pace+'/km</div></div></div>';
    });
    shown++;
  }
  if(!shown) h+='<div style="font-size:13px;color:var(--dim)">Aucune séance planifiée prochainement.</div>';
  h+='<div class="rs-row" style="padding:10px 0 0;cursor:pointer;color:var(--e2)" onclick="calBack();sportTab=\'run\';runSub=\'perso\'">'+ICN('bolt',16,'var(--e2)')+'<span style="font-weight:700;font-size:13.5px">Ajouter une séance</span></div>';
  h+='</div>';
  return h;
}
function persoDetailHTML(){
  const p=CUSTOM.find(x=>x.id===curPerso); if(!p) return renderPersoList();
  const tk=todayKey();
  const following=P.followPerso===p.id;
  let h='<div class="row" style="margin-bottom:14px"><button class="x" onclick="curPerso=null;renderSport()">‹</button><div class="man" style="font-weight:800;font-size:18px">'+p.name+'</div><button class="x" onclick="renamePerso(\''+p.id+'\')">✏️</button></div>';
  h+='<div class="chrome-box'+(following?' accent':'')+'" style="display:flex;align-items:center;gap:10px">'
    +'<div style="flex:1"><div class="cb-head" style="margin-bottom:2px">'+(following?'✅ Plan suivi actuellement':'👤 Suivre ce plan à la place du plan IKORUN')+'</div>'
    +'<div class="cb-body" style="font-size:12px;color:var(--muted)">'+(following?'Ton accueil et ton bilan utilisent ce plan. Le plan IKORUN continue de s\u2019ajuster en arrière-plan selon ce que tu fais ici.':'Ton accueil affichera les séances de ce plan au lieu du plan généré. Tu peux revenir au plan IKORUN quand tu veux.')+'</div></div>'
    +'<button class="btn ghost sm" style="width:auto;white-space:nowrap" onclick="toggleFollowPerso(\''+p.id+'\')">'+(following?'Arrêter':'Suivre')+'</button></div>';
  h+='<button class="btn" style="margin-bottom:14px" onclick="addPersoSession()">＋ Ajouter une séance</button>';
  if(!p.sessions.length) h+='<div class="card"><div class="empty"><div class="em-ic">🏃</div><div style="font-size:13px">Aucune séance. Ajoute ta première !</div></div></div>';
  else {
    const sorted=[...p.sessions].sort((a,b)=>new Date(a.date)-new Date(b.date));
    sorted.forEach(s=>{
      const isToday=s.date===tk; const col='var('+(TYPE_COLORS[s.type]||'--e')+')';
      const detail=(s.intervals&&s.intervals.length)?(' · '+s.intervals.length+' × '+s.intervals[0].dist+' m'):(s.km?' · '+s.km+' km · '+s.pace+'/km':'');
      h+='<div class="sess '+(s.done?'done':'')+' '+(isToday?'today':'')+'"><div class="row" onclick="openPersoSheet('+s.id+')" style="cursor:pointer"><div><div style="font-weight:700;font-size:14px">'+s.title+'</div><div style="color:var(--muted);font-size:12px;margin-top:3px">'+fmtDate(s.date)+detail+'</div></div><div class="badge" style="background:rgba(var(--e-rgb),.15);color:'+col+';font-size:11px">'+s.type+'</div></div></div>';
    });
  }
  return h;
}
function renderPersoDetail(){}
function toggleFollowPerso(id){
  P.followPerso=(P.followPerso===id)?null:id;
  DB.save('profile',P);
  toast(P.followPerso?'Tu suis maintenant ce plan perso ✓':'Retour au plan IKORUN');
  renderSport();
}
function renamePerso(id){ const p=CUSTOM.find(x=>x.id===id); const n=prompt('Nom :',p.name); if(n){p.name=n;saveAll();renderSport();} }
function dupPerso(id){ const p=CUSTOM.find(x=>x.id===id); CUSTOM.push({...JSON.parse(JSON.stringify(p)),id:'P'+Date.now(),name:p.name+' (copie)'}); saveAll(); renderSport(); }
function delPerso(id){ if(!confirm('Supprimer ce plan ?'))return; CUSTOM=CUSTOM.filter(x=>x.id!==id); if(P.followPerso===id) P.followPerso=null; curPerso=null; saveAll(); renderSport(); }
let psType='EF';
let psMode='simple'; // 'simple' (km+allure) ou 'intervals' (temps saisi à chaque répétition) — indépendant du type
let psIntervals=[{dist:400,timeS:null}];
function addPersoSession(){
  psType='EF'; psMode='simple'; psIntervals=[{dist:400,timeS:null}];
  const types=['EF','Récup','Tempo','Seuil','VMA','Fractionné','Test','Long','Course'];
  let h='<div class="field"><label>Titre</label><input class="inp" id="ps_title" placeholder="Footing du matin"></div>';
  h+='<div class="field"><label>Type</label><div class="pills" id="ps_types">'+types.map(t=>'<div class="pill '+(t==='EF'?'on':'')+'" onclick="psTypeChanged(\''+t+'\')">'+t+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Date</label><input class="inp" id="ps_date" type="date" value="'+todayKey()+'"></div>';
  h+='<div class="field"><label>Comment veux-tu saisir cette séance ?</label><div class="pills" id="ps_modes">'+
       '<div class="pill on" onclick="psModeChanged(\'simple\')">Simple (km + allure)</div>'+
       '<div class="pill" onclick="psModeChanged(\'intervals\')">Par répétition (temps de chaque)</div>'+
     '</div></div>';
  h+='<div id="ps_simple" class="row" style="gap:10px"><div class="field" style="flex:1"><label>Distance (km)</label><input class="inp" id="ps_km" type="number" placeholder="8"></div><div class="field" style="flex:1"><label>Allure /km</label><input class="inp" id="ps_pace" placeholder="4:30"></div></div>';
  h+='<div id="ps_intervals" style="display:none">'+
       '<div class="field"><label>Distance par répétition</label><div class="inp pkfield set" id="ps_int_dist" onclick="pickPsIntervalDist()">400 m</div></div>'+
       '<div id="ps_int_rows"></div>'+
       '<button class="btn ghost sm" style="margin:2px 0 14px" onclick="addPsIntervalRow()">＋ Ajouter une répétition</button>'+
     '</div>';
  h+='<div class="field"><label>Description (optionnel)</label><textarea class="inp" id="ps_desc" rows="3" placeholder="Détails de la séance..."></textarea></div>';
  h+='<button class="btn" onclick="savePersoSession()">💾 Ajouter la séance</button>';
  $('#progBody').innerHTML=h; $('#ovProgTitle').textContent='Nouvelle séance'; openOv('ovProg');
  renderPsIntervalRows();
}
function psTypeChanged(t){
  psType=t;
  document.querySelectorAll('#ps_types .pill').forEach(x=>{ x.classList.toggle('on',x.textContent.trim()===t); });
  // Suggestion automatique du mode selon le type choisi, mais l'utilisateur peut toujours changer via psModeChanged
  const suggestsIntervals=['Fractionné','VMA','Seuil','Test'].includes(t);
  psModeChanged(suggestsIntervals?'intervals':'simple');
}
function psModeChanged(mode){
  psMode=mode;
  document.querySelectorAll('#ps_modes .pill').forEach(x=>{ x.classList.toggle('on',(mode==='intervals')===(x.textContent.indexOf('répétition')>-1)); });
  const simple=$('#ps_simple'), ivs=$('#ps_intervals');
  const isInterval=(mode==='intervals');
  if(simple) simple.style.display=isInterval?'none':'flex';
  if(ivs) ivs.style.display=isInterval?'block':'none';
}
function pickPsIntervalDist(){
  const cur=psIntervals[0]?.dist||400;
  openPicker({title:'Distance par répétition',cols:[{values:[100,150,200,300,400,500,600,800,1000,1200,1500,2000],sel:Math.max(0,[100,150,200,300,400,500,600,800,1000,1200,1500,2000].indexOf(cur)),unit:'m'}],onOk:idx=>{
    const vals=[100,150,200,300,400,500,600,800,1000,1200,1500,2000]; const v=vals[idx[0]];
    psIntervals.forEach(r=>r.dist=v); $('#ps_int_dist').textContent=v+' m'; renderPsIntervalRows();
  }});
}
function renderPsIntervalRows(){
  const box=$('#ps_int_rows'); if(!box) return;
  let h='';
  psIntervals.forEach((r,i)=>{
    h+='<div class="perfrow">'+
      '<div class="perfcard" style="flex:0 0 64px;cursor:default"><div class="pcl">Rép.</div><div class="pcv">'+(i+1)+'</div></div>'+
      '<div class="perfcard" onclick="pickPsIntervalTime('+i+')"><div class="pcl">⏱ Temps</div><div class="pcv '+(r.timeS!=null?'':'empty')+'">'+(r.timeS!=null?fmtTime(r.timeS):'Choisir')+'</div></div>'+
      (psIntervals.length>1?'<div class="perfdel" onclick="delPsIntervalRow('+i+')">🗑</div>':'')+
    '</div>';
  });
  box.innerHTML=h;
}
function addPsIntervalRow(){ const dist=psIntervals[0]?psIntervals[0].dist:400; psIntervals.push({dist,timeS:null}); renderPsIntervalRows(); }
function delPsIntervalRow(i){ psIntervals.splice(i,1); renderPsIntervalRows(); }
function pickPsIntervalTime(i){
  const dist=psIntervals[i].dist||400;
  pickTime('Temps · '+dist+' m',psIntervals[i].timeS!=null?psIntervals[i].timeS:Math.round(dist*0.24),v=>{ psIntervals[i].timeS=v; renderPsIntervalRows(); },false);
}
function savePersoSession(){
  const p=CUSTOM.find(x=>x.id===curPerso); if(!p) return;
  const title=$('#ps_title').value.trim()||psType;
  let km,pace,durMin,intervals=null;
  if(psMode==='intervals'){
    const valid=psIntervals.filter(r=>r.timeS!=null);
    if(!valid.length){ toast('Ajoute au moins un temps de répétition'); return; }
    const distM=valid[0].dist||400;
    km=+(valid.length*distM/1000).toFixed(2);
    const totalSec=valid.reduce((a,r)=>a+r.timeS,0);
    const avgSecPerKm=km>0?Math.round(totalSec/km):0;
    pace=fmtTime(avgSecPerKm);
    durMin=Math.round(totalSec/60);
    intervals=valid.map(r=>({dist:r.dist,timeS:r.timeS}));
  } else {
    km=+$('#ps_km').value||0; pace=$('#ps_pace').value.trim()||'—';
    durMin=(km&&pace!=='—')?Math.round(km*parseTime(pace)/60):0;
  }
  p.sessions.push({id:Date.now(),title,type:psType,date:$('#ps_date').value,km,pace,duration:durMin,rpe:5,desc:$('#ps_desc').value.trim(),done:false,intervals});
  saveAll(); closeOv('ovProg'); renderSport(); toast('Séance ajoutée ✓');
}
let curPersoSess=null;
function openPersoSheet(sid){
  const p=CUSTOM.find(x=>x.id===curPerso); const s=p.sessions.find(x=>x.id===sid); if(!s)return;
  curPersoSess=sid;
  $('#sheetTitle').textContent=s.title;
  const col='var('+(TYPE_COLORS[s.type]||'--e')+')';
  let h='<div class="badge" style="background:rgba(var(--e-rgb),.15);color:'+col+';margin-bottom:14px">'+s.type+' · '+fmtDate(s.date)+'</div>';
  if(s.km) h+='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v">'+s.km+'</div><div class="l">km</div></div><div class="sbox"><div class="v" style="font-size:18px">'+s.pace+'</div><div class="l">/km moy.</div></div><div class="sbox"><div class="v">'+s.duration+'</div><div class="l">min</div></div></div>';
  if(s.intervals && s.intervals.length){
    h+='<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:8px">'+s.intervals.length+' × '+s.intervals[0].dist+' m</div><div style="display:flex;flex-direction:column;gap:6px">';
    s.intervals.forEach((r,i)=>{ h+='<div class="row" style="font-size:13px"><span style="color:var(--muted)">Rép. '+(i+1)+' · '+r.dist+' m</span><span style="font-weight:700">'+fmtTime(r.timeS)+'</span></div>'; });
    h+='</div></div>';
  }
  if(s.desc) h+='<div class="tip" style="margin-bottom:14px">'+s.desc+'</div>';
  if(s.done) h+='<div class="badge" style="background:rgba(51,211,153,.18);color:var(--ok);width:100%;justify-content:center;padding:14px;border-radius:14px;margin-bottom:10px">✓ Terminée</div>';
  else h+='<button class="btn" style="margin-bottom:10px" onclick="markPersoDone()">✓ Marquer terminée</button>';
  h+='<button class="btn ghost sm" style="color:var(--bad)" onclick="delPersoSession()">🗑 Supprimer</button>';
  $('#sheetBody').innerHTML=h; openOv('ovSheet');
}
function markPersoDone(){
  const p=CUSTOM.find(x=>x.id===curPerso); const s=p.sessions.find(x=>x.id===curPersoSess); if(!s)return;
  s.done=true;
  const sessRef=Date.now()+Math.random();
  SESS.push({sessRef,provisional:true,date:s.date,title:s.title,km:s.km,pace:s.pace,type:s.type,duration:s.duration,rpe:s.rpe});
  saveAll(); refreshXP({animate:true}); closeOv('ovSheet'); renderSport();
  openSessionDebrief({date:s.date,title:s.title,km:s.km,pace:s.pace,type:s.type,duration:s.duration,plannedRpe:s.rpe,sessRef});
}
function delPersoSession(){
  const p=CUSTOM.find(x=>x.id===curPerso); p.sessions=p.sessions.filter(x=>x.id!==curPersoSess);
  saveAll(); closeOv('ovSheet'); renderSport();
}
function sharePlan(n){ if(navigator.share) navigator.share({title:'IKORUN Plan',text:'Mon plan : '+n}); else toast('Partage non supporté'); }

/* ---------- QUESTIONNAIRE POST-SÉANCE + ANALYSE MOTEUR IKORUN ---------- */
let debriefData=null, debriefCtx=null, debriefReps=[];
function openSessionDebrief(ctx){
  debriefCtx=ctx;
  debriefData={ done:true, duration:ctx.duration||'', distance:ctx.km||'', pace:ctx.pace||'',
    rpe:5, pain:'Aucune', fatigue:3, weather:'\u2600\ufe0f', feel:3, sleep:3, nutrition:3, note:'' };
  // Si la seance prevue est une serie de repetitions (400, 1000, pyramide simple...),
  // on propose une ligne par repetition : temps reel ou bouton rapide "Respecte"
  // qui remplit tout seul avec le temps de passage cible.
  const sr=ctx.series;
  debriefReps=(sr&&sr.reps&&sr.dist)?Array.from({length:sr.reps},(_,i)=>({
    n:i+1, dist:sr.dist, target:Math.round(splitSecFromPace(sr.paceSecPerKm,sr.dist)), timeS:null, respected:null
  })):[];
  renderDebrief();
  openOv('ovProg'); $('#ovProgTitle').textContent='Bilan de séance';
}
function pickDebriefRepTime(i){
  const r=debriefReps[i];
  pickTime('Temps · '+r.dist+' m (cible '+fmtSplit(r.target)+')', r.timeS!=null?r.timeS:r.target, v=>{
    r.timeS=v; r.respected=v<=Math.round(r.target*1.06);
    syncDebriefFromReps(); renderDebrief();
  }, false);
}
function quickRespectDebriefRep(i){
  const r=debriefReps[i];
  r.timeS=r.target; r.respected=true;
  syncDebriefFromReps(); renderDebrief();
}
function syncDebriefFromReps(){
  const done=debriefReps.filter(r=>r.timeS!=null);
  if(!done.length) return;
  const totKm=done.length*debriefReps[0].dist/1000;
  const totSec=done.reduce((a,r)=>a+r.timeS,0);
  debriefData.distance=+totKm.toFixed(2);
  debriefData.duration=Math.round(totSec/60);
  debriefData.pace=fmtSplit(Math.round(totSec/totKm));
}
function renderDebrief(){
  const d=debriefData;
  const scale=(key,label,icons)=>'<div class="field"><label>'+label+'</label><div class="pills">'+icons.map((ic,i)=>'<div class="pill '+(d[key]===i+1?'on':'')+'" onclick="debriefData.'+key+'='+(i+1)+';renderDebrief()">'+ic+'</div>').join('')+'</div></div>';
  let h='<div class="tip" style="margin-bottom:14px">\U0001f4cb Réponds honnêtement : le moteur IKORUN va analyser ta séance.</div>';
  if(debriefReps.length){
    const doneCount=debriefReps.filter(r=>r.respected===true).length;
    h+='<div class="chrome-box"><div class="cb-head">\U0001f3c3 Bilan par répétition — '+debriefReps.length+' × '+debriefReps[0].dist+' m <span style="margin-left:auto;font-weight:600;color:var(--e2)">'+doneCount+'/'+debriefReps.length+' respectées</span></div>';
    debriefReps.forEach((r,i)=>{
      const st=r.respected===true?'border-color:rgba(51,211,153,.4);background:rgba(51,211,153,.08)':r.respected===false?'border-color:rgba(255,92,108,.35);background:rgba(255,92,108,.08)':'';
      h+='<div class="row" style="align-items:center;gap:8px;border:1px solid var(--hair);border-radius:12px;padding:8px 10px;margin-bottom:6px;'+st+'">'
        +'<div style="flex:1"><div style="font-weight:700;font-size:13px">Rép. '+r.n+' · '+r.dist+' m</div><div style="font-size:11px;color:var(--muted)">Cible '+fmtSplit(r.target)+'</div></div>'
        +'<div style="font-weight:700;font-family:\'JetBrains Mono\';font-size:14px;min-width:44px;text-align:right">'+(r.timeS!=null?fmtSplit(r.timeS):'—')+'</div>'
        +'<button class="btn ghost sm" style="width:auto;padding:6px 10px" onclick="pickDebriefRepTime('+i+')">\u23f1</button>'
        +'<button class="btn ghost sm" style="width:auto;padding:6px 10px;color:var(--ok)" onclick="quickRespectDebriefRep('+i+')">\u2713</button>'
        +'</div>';
    });
    h+='<div style="font-size:11px;color:var(--muted);margin-top:2px">\u23f1 = saisir le temps réel · \u2713 = "j\u2019ai respecté l\u2019allure" (remplit automatiquement avec le temps cible)</div></div>';
  }
  h+='<div class="row" style="gap:10px"><div class="field" style="flex:1"><label>Durée (min)</label><input class="inp" type="number" value="'+(d.duration||'')+'" oninput="debriefData.duration=+this.value"></div><div class="field" style="flex:1"><label>Distance (km)</label><input class="inp" type="number" value="'+(d.distance||'')+'" oninput="debriefData.distance=+this.value"></div></div>';
  h+='<div class="field"><label>Allure moyenne /km</label><input class="inp" value="'+(d.pace||'')+'" oninput="debriefData.pace=this.value" placeholder="4:30"></div>';
  h+='<div class="field"><label>RPE — difficulté ressentie : '+d.rpe+'/10</label><input type="range" min="1" max="10" value="'+d.rpe+'" style="width:100%" oninput="debriefData.rpe=+this.value;renderDebrief()"></div>';
  h+='<div class="field"><label>Douleurs</label><div class="pills">'+['Aucune','Légères','Gênantes','Importantes'].map(p=>'<div class="pill '+(d.pain===p?'on':'')+'" onclick="debriefData.pain=\''+p+'\';renderDebrief()">'+p+'</div>').join('')+'</div></div>';
  h+=scale('fatigue','Fatigue',['\ud83d\ude00','\ud83d\ude42','\ud83d\ude10','\ud83d\ude13','\ud83d\ude35']);
  h+=scale('feel','Sensations',['\ud83d\ude23','\ud83d\ude15','\ud83d\ude10','\ud83d\ude0a','\ud83e\udd29']);
  h+=scale('sleep','Sommeil de la nuit',['\ud83d\ude34','\ud83d\ude2a','\ud83d\ude10','\ud83d\ude42','\ud83d\udca4']);
  h+=scale('nutrition','Alimentation du jour',['\ud83c\udf54','\ud83d\ude10','\ud83d\ude42','\ud83e\udd57','\ud83d\udcaa']);
  h+='<div class="field"><label>Météo</label><div class="pills">'+['\u2600\ufe0f','\u26c5','\ud83c\udf27\ufe0f','\ud83d\udca8','\ud83e\udd75','\ud83e\udd76'].map(w=>'<div class="pill '+(d.weather===w?'on':'')+'" onclick="debriefData.weather=\''+w+'\';renderDebrief()">'+w+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Commentaire libre</label><textarea class="inp" rows="2" oninput="debriefData.note=this.value" placeholder="Comment t\u2019es-tu senti ?">'+(d.note||'')+'</textarea></div>';
  h+='<button class="btn" onclick="submitDebrief()">\ud83e\udde0 Analyser ma séance</button>';
  $('#progBody').innerHTML=h;
}
function submitDebrief(){
  const repsLog=debriefReps.length?debriefReps.map(r=>({n:r.n,dist:r.dist,target:r.target,timeS:r.timeS,respected:r.respected})):null;
  const entry={...debriefData,date:debriefCtx.date,title:debriefCtx.title,type:debriefCtx.type,plannedRpe:debriefCtx.plannedRpe,repsLog,ts:Date.now()};
  SESSLOG.push(entry); DB.save('sesslog',SESSLOG);
  // Historique réel (stats, XP, charge, semaine...) : on remplace l'entrée provisoire
  // (valeurs du plan) par les valeurs REELLES saisies dans le bilan. On ne pousse
  // jamais deux fois la même séance dans SESS.
  const real={
    date:debriefCtx.date, title:debriefCtx.title, type:debriefCtx.type,
    km:+debriefData.distance||0, pace:debriefData.pace||'—',
    duration:+debriefData.duration||0, rpe:+debriefData.rpe||5,
    planSessionId:debriefCtx.planSessionId||null, repsLog
  };
  const idx=debriefCtx.sessRef?SESS.findIndex(s=>s.sessRef===debriefCtx.sessRef):-1;
  if(idx>=0) SESS[idx]=real; else SESS.push(real);
  DB.save('sessions',SESS);
  const analysis=coachAnalyze(entry);
  applyProgressiveOverload(entry);
  weeklyAdaptiveRegen();
  renderCoachAnalysis(analysis);
  grantReferralBonusIfNeeded();
}
function coachAnalyze(e){
  const pos=[],errs=[],tips=[],adjust=[];
  // Points positifs
  if(e.done) pos.push('Tu as terminé ta séance : la régularité est ta plus grande force. 💪');
  if(e.feel>=4) pos.push('Excellentes sensations — ton corps répond bien à l\u2019entraînement.');
  if(e.sleep>=4) pos.push('Bon sommeil : c\u2019est 50% de ta récupération, continue.');
  if(e.pain==='Aucune') pos.push('Aucune douleur signalée : ta technique et ta charge sont bien gérées.');
  if(e.nutrition>=4) pos.push('Alimentation au top, le carburant est là.');
  // Critiques / erreurs
  if(e.plannedRpe && e.rpe>=e.plannedRpe+2) errs.push('Ta séance a été bien plus dure que prévue (RPE '+e.rpe+' vs '+e.plannedRpe+' attendu). Tu es peut-être parti trop vite ou tu es fatigué.');
  if(e.plannedRpe && e.rpe<=e.plannedRpe-2 && e.type!=='EF' && e.type!=='Récup') errs.push('Séance trop facile (RPE '+e.rpe+') : tu peux probablement pousser un peu plus la prochaine fois.');
  if(e.pain==='Gênantes'||e.pain==='Importantes') errs.push('⚠️ Douleurs '+e.pain.toLowerCase()+' : ne les ignore pas. Une douleur articulaire qui persiste = repos.');
  if(e.sleep<=2) errs.push('Sommeil insuffisant : tes performances et ta récup vont en souffrir.');
  if(e.fatigue>=4) errs.push('Niveau de fatigue élevé : attention au surentraînement.');
  // Conseils
  if(e.sleep<=2) tips.push('Vise 8h de sommeil cette nuit, écran coupé 1h avant.');
  if(e.nutrition<=2) tips.push('Mange des glucides + protéines dans les 30 min après l\u2019effort.');
  tips.push('Bois au moins 0,5 L d\u2019eau dans l\u2019heure qui suit.');
  if(e.weather==='🥵') tips.push('Par forte chaleur, cours tôt le matin et hydrate-toi davantage.');
  // Ajustements prochaines séances
  if(e.pain==='Importantes'||e.fatigue>=5){ adjust.push('Prochaine séance : remplace-la par du repos ou un footing très léger.'); }
  else if(e.rpe>=9 && e.fatigue>=4){ adjust.push('Allège la prochaine séance dure de 48h pour bien récupérer.'); }
  else if(e.feel>=4 && e.rpe<=6){ adjust.push('Tu es en forme : on pourra augmenter légèrement le volume la semaine prochaine.'); }
  else adjust.push('Continue comme prévu, ton plan est bien calibré.');
  // Motivation
  const motiv=['Chaque séance te rapproche de ton objectif. 🔥','La discipline d\u2019aujourd\u2019hui est la victoire de demain.','Les champions sont faits de séances comme celle-ci.','Tu construis quelque chose de grand, brique par brique.'][Math.floor(Math.random()*4)];
  return {pos,errs,tips,adjust,motiv,e};
}
function renderCoachAnalysis(a){
  let h='<div style="text-align:center;margin-bottom:14px"><div style="font-size:40px">🧠</div><div class="man" style="font-weight:800;font-size:20px">Analyse du Coach</div><div style="font-size:12px;color:var(--muted)">'+a.e.title+'</div></div>';
  const blk=(icon,title,items,color)=>items.length?'<div class="card-t" style="margin-top:14px;'+(color?'color:'+color:'')+'">'+icon+' '+title+'</div>'+items.map(x=>'<div class="tip" style="margin-bottom:6px;'+(color?'border-color:'+color+'33;background:'+color+'11':'')+'">'+x+'</div>').join(''):'';
  h+=blk('✅','Points positifs',a.pos,'var(--ok)');
  h+=blk('⚠️','Critiques constructives',a.errs,'var(--warn)');
  h+=blk('💡','Conseils',a.tips,'');
  h+=blk('🔧','Ajustements à venir',a.adjust,'var(--e)');
  h+='<div style="background:linear-gradient(135deg,var(--ed),rgba(31,47,80,.3));border:1px solid var(--e);border-radius:14px;padding:14px;margin-top:16px;text-align:center"><div style="font-style:italic;font-size:15px">"'+a.motiv+'"</div></div>';
  h+='<button class="btn" style="margin-top:16px" onclick="closeOv(\'ovProg\');renderSport();nav(\'home\')">C\u2019est noté, Coach ! 💪</button>';
  $('#progBody').innerHTML=h; $('#ovProgTitle').textContent='Analyse IKORUN';
}

/* ---------- RUN SHEET ---------- */
let curRunId=null;
// Tableau structuré des séries (reps/distance/temps de passage/récup) pour la fiche séance détaillée
function seriesTableHTML(sr){
  if(!sr) return '';
  if(sr.segments){
    const rows=sr.segments.map(sg=>'<div class="row" style="font-size:13px;padding:4px 0"><span style="color:var(--muted)">'+sg.dist+' m</span><span style="font-weight:700;color:var(--e)">'+fmtSplit(sg.splitSec)+'</span></div>').join('');
    return '<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:6px">🏃 Séries — pyramide</div>'+rows+'<div style="font-size:11.5px;color:var(--muted);margin-top:8px">Récup : '+sr.recoveryLabel+'</div></div>';
  }
  if(sr.reps && sr.dist){
    return '<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:8px">🏃 '+sr.reps+' × '+sr.dist+' m</div>'
      +'<div class="row" style="font-size:13px;padding:3px 0"><span style="color:var(--muted)">Temps de passage cible</span><span style="font-weight:700;color:var(--e)">'+fmtSplit(splitSecFromPace(sr.paceSecPerKm,sr.dist))+'</span></div>'
      +'<div class="row" style="font-size:13px;padding:3px 0"><span style="color:var(--muted)">Allure équivalente</span><span>'+spkToStr(sr.paceSecPerKm)+'/km</span></div>'
      +'<div class="row" style="font-size:13px;padding:3px 0"><span style="color:var(--muted)">Récupération</span><span>'+sr.recoveryLabel+'</span></div>'
      +(sr.note?'<div style="font-size:11.5px;color:var(--muted);margin-top:6px">ℹ️ '+sr.note+'</div>':'')
      +'</div>';
  }
  if(sr.reps){
    return '<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:6px">🏃 '+sr.reps+' répétitions</div>'
      +(sr.note?'<div style="font-size:13px;color:var(--muted)">'+sr.note+'</div>':'')
      +'<div class="row" style="font-size:13px;padding:3px 0;margin-top:4px"><span style="color:var(--muted)">Récupération</span><span>'+sr.recoveryLabel+'</span></div></div>';
  }
  return '';
}
function rsShort(str,len){ if(!str) return ''; str=String(str).replace(/<[^>]+>/g,''); return str.length>len?str.slice(0,len).trim()+'…':str; }
function openRunSheet(id){
  const s=PLAN?PLAN.sessions.find(x=>x.id===id):null; if(!s) return;
  curRunId=id;
  $('#sheetTitle').textContent='';
  const col=baseTypeColor(s.baseType);
  const dt=s.detail;
  let h='';

  // EN-TÊTE — badge type, titre, sous-titre semaine/objectif
  h+='<div class="rs-badge" style="background:'+col+'22;color:'+col+'">'+(s.type||'').slice(0,2).toUpperCase()+'</div>';
  h+='<div class="rs-title">'+s.title+'</div>';
  h+='<span class="rs-sub">'+(PLAN.weekLabel?PLAN.weekLabel:'Semaine '+s.week)+' · '+(P.objRace||'Objectif')+'</span>';

  // 3 STATS
  if(s.km){
    h+='<div class="rs-stats"><div class="rs-stat"><div class="v">'+s.km+'</div><div class="l">km</div></div><div class="rs-div"></div>'
      +'<div class="rs-stat"><div class="v" style="font-size:17px">'+s.pace+'</div><div class="l">/km moy.</div></div><div class="rs-div"></div>'
      +'<div class="rs-stat"><div class="v">'+s.duration+'</div><div class="l">min</div></div></div>';
  }

  // CTA
  if(s.done) h+='<div class="badge" style="background:rgba(51,211,153,.18);color:var(--ok);width:100%;justify-content:center;padding:14px;border-radius:18px;margin-bottom:18px">✓ Séance terminée</div>';
  else if(s.type!=='Repos') h+='<button class="btn" style="margin-bottom:18px" onclick="markRunDone()">✓ Marquer terminée</button>';

  if(dt){
    h+='<div class="rs-obj-lab">OBJECTIF</div><div class="rs-obj-txt">'+dt.objectif+'</div>';
    h+='<div class="card rs-list">'
      +'<div class="rs-row" onclick="this.nextElementSibling?.classList.toggle(\'open\')"><div class="rs-ic" style="background:rgba(var(--e-rgb),.16);color:var(--e2)">'+ICN('run',17)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">Échauffement</div><div class="rs-row-m">'+rsShort(dt.warmup,54)+'</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
      +'<div class="rs-row"><div class="rs-ic" style="background:rgba(242,184,75,.18);color:var(--or)">'+ICN('run',17)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">Corps de séance</div><div class="rs-row-m">'+rsShort(dt.body,58)+'</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
      +'<div class="rs-row"><div class="rs-ic" style="background:rgba(255,92,108,.16);color:var(--bad)">'+ICN('pin',16)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">Retour au calme</div><div class="rs-row-m">'+rsShort(dt.cooldown,54)+'</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
      +'<div class="rs-row"><div class="rs-ic" style="background:rgba(51,211,153,.16);color:var(--ok)">'+ICN('run',17)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">Allures</div><div class="rs-row-m">Zone 2 · 70% FCmax · '+s.pace+'/km</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
    +'</div>';
  }

  // ALLURE CIBLE
  if(s.km){
    const base=parseTime(s.pace)||270; const spark=[0,4,-3,2,6,3,8,5,10].map(v=>base-v*2);
    const mn=Math.min(...spark), mx=Math.max(...spark);
    h+='<div class="card rs-target"><div class="rs-target-lab">Allure cible</div><div class="rs-target-v">'+fmtSplit(Math.min(...spark))+' - '+fmtSplit(Math.max(...spark))+' /km</div>'
      +'<div class="rs-target-spark">'+spark.map(v=>'<b style="height:'+(mx>mn?Math.round(10+((mx-v)/(mx-mn))*90):50)+'%"></b>').join('')+'</div></div>';
  }

  // DÉTAIL COMPLET (repliable, contenu déjà existant conservé)
  if(dt){
    h+=seriesTableHTML(s.series);
    if(s.series && s.series.length) h+='<div class="pace-warn">⚠️ Ne dépasse pas l\u2019allure indiquée sur les premières répétitions — mieux vaut finir fort que partir trop vite.</div>';
    h+='<div class="chrome-box"><div class="cb-head">🏁 Allures détaillées</div><div class="cb-body">'+dt.paces+'</div></div>';
    h+='<div class="chrome-box"><div class="cb-head">⏱ Récupération</div><div class="cb-body">'+dt.recovery+'</div></div>';
    h+='<div class="chrome-box"><div class="cb-head">✅ Conseils</div>'+dt.tips.map(t=>'<div class="cb-body" style="margin-bottom:5px">• '+t+'</div>').join('')+'</div>';
    h+='<div class="chrome-box bad"><div class="cb-head" style="color:var(--bad)">⚠️ Erreurs à éviter</div>'+dt.mistakes.map(t=>'<div class="cb-body" style="margin-bottom:5px">✗ '+t+'</div>').join('')+'</div>';
    h+='<div class="chrome-box"><div class="cb-head">🧠 Pourquoi cette séance ?</div><div class="cb-body">'+dt.why+'</div></div>';
  } else {
    h+=seriesTableHTML(s.series);
    h+='<div class="chrome-box"><div class="cb-head">💪 Corps de séance</div><div class="cb-body">'+s.desc+'</div></div>';
  }
  $('#sheetBody').innerHTML=h;
  openOv('ovSheet');
}
function markRunDone(){
  const s=PLAN.sessions.find(x=>x.id===curRunId); if(!s) return;
  s.done=true;
  // Entrée provisoire (valeurs du plan) au cas où le bilan ne serait jamais validé —
  // elle sera écrasée par les vraies valeurs si l'athlète remplit le bilan.
  const sessRef=Date.now()+Math.random();
  SESS.push({sessRef,provisional:true,date:s.date,title:s.title,km:s.km,pace:s.pace,type:s.type,duration:s.duration,rpe:s.rpe});
  saveAll(); refreshXP({animate:true}); closeOv('ovSheet'); renderSport();
  openSessionDebrief({date:s.date,title:s.title,km:s.km,pace:s.pace,type:s.type,duration:s.duration,plannedRpe:s.rpe,planSessionId:s.id,sessRef,series:s.series||null});
}

/* ---------- MUSCULATION ---------- */
function renderMuscu(){
  let h='';
  if(DB.load('live_paused')){ const sv=DB.load('live_paused'); h+='<div class="card" style="border-color:var(--warn);background:rgba(255,180,84,.08)"><div class="row"><div><div style="font-weight:700">⏸ Séance en pause</div><div style="font-size:12px;color:var(--muted)">'+sv.prog.name+'</div></div><button class="btn sm" style="width:auto;padding:8px 14px" onclick="resumeLive()">Reprendre</button></div></div>'; }
  h+='<div class="row" style="gap:10px;margin-bottom:14px"><button class="btn" onclick="openCreate()">＋ Créer</button><button class="btn ghost" onclick="openLibBrowse()">📚 Bibliothèque</button></div>';
  h+='<div class="lab" style="margin:6px 0 10px">Programmes par défaut</div>';
  PROGS.forEach((p,i)=>{
    h+='<div class="card" onclick="openProg(\''+p.id+'\')" style="cursor:pointer"><div class="row"><div><div class="badge" style="margin-bottom:8px">'+p.id+'</div><div style="font-weight:700;font-size:16px">'+p.name+'</div><div style="font-size:12px;color:var(--muted);margin-top:3px">'+p.ex.length+' exercices · '+p.ex.reduce((a,e)=>a+e.sets,0)+' séries</div></div>'+exThumb(p.ex[0].name,52)+'</div></div>';
  });
  const custs=CUSTOM.filter(p=>p.kind==='muscu');
  if(custs.length){
    h+='<div class="lab" style="margin:16px 0 10px">Mes créations</div>';
    custs.forEach(p=>{
      h+='<div class="card"><div class="row"><div onclick="openProg(\''+p.id+'\')" style="flex:1"><div style="font-weight:700;font-size:16px">'+p.name+'</div><div style="font-size:12px;color:var(--muted);margin-top:3px">'+p.objective+' · '+p.ex.length+' exos</div></div><button class="x" onclick="delProg(\''+p.id+'\')">🗑</button></div></div>';
    });
  }
  return h;
}
function delProg(id){ if(!confirm('Supprimer ce programme ?'))return; CUSTOM=CUSTOM.filter(p=>p.id!==id); saveAll(); renderSport(); }
/* ===== VUE ROUTINE (style Hevy) ===== */
function exThumb(name,size){
  const g=exGif(name); size=size||64;
  if(g) return '<div style="width:'+size+'px;height:'+size+'px;border-radius:12px;background:#0c0f15 url('+g[0]+') center/cover;flex-shrink:0;border:1px solid var(--hair)"></div>';
  const e=findEx(name);
  return '<div style="width:'+size+'px;height:'+size+'px;border-radius:12px;background:var(--s2);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;border:1px solid var(--hair)">'+((e&&e.anim)||'🏋️')+'</div>';
}
function progDuration(p){ return p.ex.reduce((a,e)=>a+e.sets*1.8,0); } // estimation min
function openProg(id){
  const p=allProgs().find(x=>x.id===id); if(!p) return;
  $('#ovProgTitle').textContent='Routine';
  const totalSets=p.ex.reduce((a,e)=>a+(e.sets||0),0);
  const dur=Math.round(progDuration(p));
  const lvl=p.objective||'Intermédiaire';
  let h='<div class="row" style="margin-bottom:6px"><div class="man" style="font-weight:800;font-size:22px">'+(p.icon?p.icon+' ':'')+p.name+'</div></div>';
  h+='<div class="row" style="gap:8px;margin-bottom:14px"><span class="badge">'+lvl+'</span><span style="font-size:12px;color:var(--muted)">⏱ '+p.ex.length+' exercices</span></div>';
  // Carte stats
  h+='<div class="card" style="padding:0;overflow:hidden"><div style="display:flex;text-align:center">'+
    '<div style="flex:1;padding:14px 6px;border-right:1px solid var(--hair)"><div class="lab" style="margin:0 0 4px">Exercices</div><div class="man" style="font-weight:800;font-size:20px;color:var(--e)">'+p.ex.length+'</div></div>'+
    '<div style="flex:1;padding:14px 6px;border-right:1px solid var(--hair)"><div class="lab" style="margin:0 0 4px">Séries</div><div class="man" style="font-weight:800;font-size:20px">'+totalSets+'</div></div>'+
    '<div style="flex:1.3;padding:14px 6px"><div class="lab" style="margin:0 0 4px">Durée est.</div><div class="man" style="font-weight:800;font-size:20px">~'+dur+' min</div></div></div></div>';
  // Liste d'exercices avec vignette + numéro
  p.ex.forEach((e,i)=>{
    h+='<div class="card" style="padding:13px;margin-bottom:10px;cursor:pointer" onclick="openExDetail(\''+p.id+'\','+i+')"><div class="row" style="align-items:flex-start"><div style="position:relative;margin-right:12px">'+exThumb(e.name,64)+
      '<div style="position:absolute;top:-6px;left:-6px;width:22px;height:22px;border-radius:7px;background:var(--e);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">'+(i+1)+'</div></div>'+
      '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px;line-height:1.25">'+e.name+'</div>'+
      '<div class="muscle-tags" style="margin-top:5px">'+(e.muscles||[]).slice(0,2).map(m=>'<span class="mtag">'+m+'</span>').join('')+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:6px">'+e.sets+' séries · '+e.reps+' reps</div>'+
      '<div style="font-size:11px;color:var(--dim);margin-top:3px">⏱ ~'+Math.round(e.sets*1.8)+' min</div></div>'+
      '<span style="color:var(--dim);font-size:18px;align-self:center">›</span></div></div>';
  });
  h+='<button class="btn ghost" style="margin:4px 0 12px" onclick="openLibFor(addExToProg.bind(null,\''+p.id+'\'))">＋ Ajouter un exercice</button>';
  h+='<button class="btn" style="position:sticky;bottom:8px;background:#fff;color:#111;border-radius:26px" onclick="startLive(\''+p.id+'\')">Commencer l\u2019entraînement</button>';
  $('#progBody').innerHTML=h;
  openOv('ovProg');
}
function addExToProg(progId,e){
  const p=allProgs().find(x=>x.id===progId); if(!p)return;
  if(!p.kind){ toast('Les programmes par défaut ne sont pas modifiables'); return; }
  closeOv('ovLib'); openCfg(e,(cfg)=>{ p.ex.push(cfg); saveAll(); openProg(progId); });
}
/* ===== ANATOMIE — zones de muscles pour l'onglet "Muscles" ===== */
const ANATOMY_FRONT_ZONES={
  'Cou':[{type:'rect',x:90,y:46,w:20,h:14,rx:6}],
  'Épaules':[{type:'ellipse',cx:52,cy:70,rx:15,ry:14},{type:'ellipse',cx:148,cy:70,rx:15,ry:14}],
  'Pectoraux':[{type:'rect',x:66,y:64,w:68,h:34,rx:14}],
  'Abdominaux':[{type:'rect',x:76,y:102,w:48,h:55,rx:10}],
  'Biceps':[{type:'rect',x:38,y:80,w:20,h:48,rx:10},{type:'rect',x:142,y:80,w:20,h:48,rx:10}],
  'Avant-bras':[{type:'rect',x:34,y:130,w:18,h:48,rx:9},{type:'rect',x:148,y:130,w:18,h:48,rx:9}],
  'Adducteurs':[{type:'rect',x:92,y:190,w:8,h:70,rx:4},{type:'rect',x:100,y:190,w:8,h:70,rx:4}],
  'Quadriceps':[{type:'rect',x:70,y:185,w:26,h:78,rx:13},{type:'rect',x:104,y:185,w:26,h:78,rx:13}]
};
const ANATOMY_BACK_ZONES={
  'Trapèzes':[{type:'rect',x:74,y:56,w:52,h:26,rx:10}],
  'Épaules':[{type:'ellipse',cx:52,cy:70,rx:15,ry:14},{type:'ellipse',cx:148,cy:70,rx:15,ry:14}],
  'Dos':[{type:'rect',x:66,y:82,w:68,h:56,rx:14}],
  'Triceps':[{type:'rect',x:38,y:80,w:20,h:48,rx:10},{type:'rect',x:142,y:80,w:20,h:48,rx:10}],
  'Avant-bras':[{type:'rect',x:34,y:130,w:18,h:48,rx:9},{type:'rect',x:148,y:130,w:18,h:48,rx:9}],
  'Lombaires':[{type:'rect',x:76,y:138,w:48,h:24,rx:10}],
  'Fessiers':[{type:'rect',x:70,y:162,w:60,h:36,rx:16}],
  'Ischios':[{type:'rect',x:70,y:198,w:26,h:66,rx:13},{type:'rect',x:104,y:198,w:26,h:66,rx:13}],
  'Abducteurs':[{type:'rect',x:60,y:198,w:10,h:66,rx:5},{type:'rect',x:130,y:198,w:10,h:66,rx:5}],
  'Mollets':[{type:'rect',x:74,y:264,w:22,h:70,rx:11},{type:'rect',x:104,y:264,w:22,h:70,rx:11}]
};
function anatomyZoneKey(raw){
  if(!raw) return null;
  const keys=Object.keys(ANATOMY_FRONT_ZONES).concat(Object.keys(ANATOMY_BACK_ZONES));
  let best=null;
  keys.forEach(k=>{ if(raw.indexOf(k)!==-1 && (!best||k.length>best.length)) best=k; });
  return best;
}
function anatomyZonesFor(f){
  const zones=[];
  (f.primary||[]).forEach(m=>{ const k=anatomyZoneKey(m); if(k && !zones.find(z=>z.key===k)) zones.push({key:k,strength:'primary'}); });
  (f.secondary||[]).forEach(m=>{ const k=anatomyZoneKey(m); if(k && !zones.find(z=>z.key===k)) zones.push({key:k,strength:'secondary'}); });
  const back=zones.some(z=>ANATOMY_BACK_ZONES[z.key] && !ANATOMY_FRONT_ZONES[z.key]);
  return {zones,view:back?'back':'front'};
}
function anatomyShapeSVG(s,fill,opacity){
  if(s.type==='rect') return '<rect x="'+s.x+'" y="'+s.y+'" width="'+s.w+'" height="'+s.h+'" rx="'+s.rx+'" fill="'+fill+'" opacity="'+opacity+'"/>';
  return '<ellipse cx="'+s.cx+'" cy="'+s.cy+'" rx="'+s.rx+'" ry="'+s.ry+'" fill="'+fill+'" opacity="'+opacity+'"/>';
}
const ANATOMY_STRENGTH_COLOR={primary:'var(--bad)',secondary:'var(--e)'};
function bodySilhouetteSVG(){
  return '<circle cx="100" cy="30" r="20" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="90" y="46" width="20" height="16" rx="6" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="64" y="60" width="72" height="80" rx="20" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="38" y="66" width="20" height="62" rx="10" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="142" y="66" width="20" height="62" rx="10" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="34" y="126" width="18" height="52" rx="9" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="148" y="126" width="18" height="52" rx="9" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<circle cx="43" cy="184" r="9" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<circle cx="157" cy="184" r="9" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="68" y="158" width="64" height="30" rx="14" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="70" y="185" width="26" height="80" rx="13" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="104" y="185" width="26" height="80" rx="13" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="74" y="264" width="22" height="72" rx="11" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<rect x="104" y="264" width="22" height="72" rx="11" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<ellipse cx="85" cy="342" rx="14" ry="8" fill="var(--s3)" stroke="var(--hair2)"/>'+
    '<ellipse cx="115" cy="342" rx="14" ry="8" fill="var(--s3)" stroke="var(--hair2)"/>';
}
function bodyAnatomySVG(zoneInfo,view){
  const ZONES=view==='back'?ANATOMY_BACK_ZONES:ANATOMY_FRONT_ZONES;
  let overlays='';
  zoneInfo.zones.forEach(z=>{
    const shapes=ZONES[z.key]; if(!shapes) return;
    const fill=ANATOMY_STRENGTH_COLOR[z.strength]||'var(--e)';
    const opacity=z.strength==='primary'?0.95:0.75;
    shapes.forEach(s=>{ overlays+=anatomyShapeSVG(s,fill,opacity); });
  });
  return '<svg viewBox="0 0 200 360" style="width:100%;max-width:260px;display:block;margin:0 auto">'+bodySilhouetteSVG()+overlays+'</svg>';
}
/* Double silhouette face+dos côte à côte, façon fiche "Muscles ciblés" */
function bodyAnatomyDualSVG(zoneInfo){
  const frontSVG=bodyAnatomySVGView(zoneInfo,'front');
  const backSVG=bodyAnatomySVGView(zoneInfo,'back');
  return '<div style="display:flex;gap:6px;align-items:flex-start">'+
    '<div style="flex:1;min-width:0">'+frontSVG+'</div>'+
    '<div style="flex:1;min-width:0">'+backSVG+'</div>'+
    '</div>';
}
function bodyAnatomySVGView(zoneInfo,view){
  const ZONES=view==='back'?ANATOMY_BACK_ZONES:ANATOMY_FRONT_ZONES;
  let overlays='';
  zoneInfo.zones.forEach(z=>{
    const shapes=ZONES[z.key]; if(!shapes) return;
    const fill=ANATOMY_STRENGTH_COLOR[z.strength]||'var(--e)';
    const opacity=z.strength==='primary'?0.95:0.75;
    shapes.forEach(s=>{ overlays+=anatomyShapeSVG(s,fill,opacity); });
  });
  return '<svg viewBox="0 0 200 360" style="width:100%;display:block">'+bodySilhouetteSVG()+overlays+'</svg>';
}

/* ===== VUE EXERCICE DÉTAILLÉE (onglets) ===== */
let exDetailTab='exo', exDetailCtx=null, exAnatomyView=null;
function openExDetail(progId,idx){
  exDetailCtx={progId,idx}; exDetailTab='exo'; exAnatomyView=null;
  renderExDetail();
}
function toggleAnatomyView(){ exAnatomyView=exAnatomyView==='front'?'back':'front'; renderExDetail(); }
function renderExDetail(){
  const p=allProgs().find(x=>x.id===exDetailCtx.progId); const e=p.ex[exDetailCtx.idx];
  const f=exMeta(e.name)||{primary:e.muscles||[],secondary:[],steps:[],tips:[],mistakes:[],safety:[],equip:'',level:''};
  $('#ovProgTitle').textContent=e.name;
  const g=exGif(e.name);
  let h='<div class="pills" style="margin-bottom:14px;overflow-x:auto;flex-wrap:nowrap">'+
    [['exo','Exercice'],['muscles','Muscles'],['instr','Instructions']].map(t=>'<div class="pill '+(exDetailTab===t[0]?'on':'')+'" onclick="exDetailTab=\''+t[0]+'\';renderExDetail()">'+t[1]+'</div>').join('')+'</div>';
  if(exDetailTab==='exo'){
    // Média animé — démarre directement le tuto, sans bouton lecture/pause
    if(g){
      h+='<div style="position:relative;background:#0c0f15;border:1px solid var(--hair);border-radius:16px;overflow:hidden;margin-bottom:14px"><img id="exDemo" src="'+g[0]+'" style="width:100%;display:block;aspect-ratio:16/11;object-fit:cover"></div>';
    } else {
      h+='<div style="background:linear-gradient(135deg,var(--s2),var(--s1));border:1px solid var(--hair);border-radius:16px;padding:36px;text-align:center;margin-bottom:14px"><div style="font-size:64px;animation:demoFloat 1.5s infinite">'+(e.anim||'🏋️')+'</div></div>';
    }
    h+='<div class="card"><div class="card-t">À propos de l\u2019exercice</div><div style="font-size:13px;color:var(--muted);line-height:1.55">Le <b style="color:var(--snow)">'+e.name+'</b> sollicite principalement '+((f.primary||[]).join(', ')||'plusieurs groupes musculaires')+(f.secondary&&f.secondary.length?', ainsi que '+f.secondary.join(', ')+' en secondaire':'')+'.</div></div>';
    // Repos
    h+='<div class="card"><div class="row"><div class="row" style="gap:10px"><span style="font-size:18px">⏱</span><div><div style="font-size:11px;color:var(--muted)">Repos entre les séries</div><div style="font-weight:700">'+(e.rest||90)+'s</div></div></div></div></div>';
    // mini stats
    const vol=(e.sets||3)*(parseInt(e.reps)||10)*(e.weight||0);
    h+='<div class="card" style="padding:0;overflow:hidden"><div style="display:flex;text-align:center"><div style="flex:1;padding:13px 4px;border-right:1px solid var(--hair)"><div class="lab" style="margin:0">Séries</div><div class="man" style="font-weight:800;font-size:18px">'+e.sets+'</div></div><div style="flex:1;padding:13px 4px;border-right:1px solid var(--hair)"><div class="lab" style="margin:0">Volume</div><div class="man" style="font-weight:800;font-size:18px">'+vol+' kg</div></div><div style="flex:1;padding:13px 4px"><div class="lab" style="margin:0">Durée</div><div class="man" style="font-weight:800;font-size:18px">~'+Math.round(e.sets*1.8)+'min</div></div></div></div>';
  } else if(exDetailTab==='muscles'){
    // Schéma d'anatomie double (face + dos) à la place du tutoriel vidéo
    const zoneInfo=anatomyZonesFor(f);
    h+='<div class="card"><div class="card-t">Muscles ciblés</div>'+
       bodyAnatomyDualSVG(zoneInfo)+
       '</div>';
    h+='<div class="card">'+
       '<div class="row" style="gap:8px;margin-bottom:6px"><span style="width:9px;height:9px;border-radius:50%;background:var(--bad);flex:0 0 9px"></span><span style="font-weight:800;font-size:14px">Muscles primaires</span></div>'+
       '<div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:'+(f.secondary&&f.secondary.length?'14px':'0')+'">'+((f.primary||[]).join(', ')||'—')+'</div>'+
       (f.secondary&&f.secondary.length?('<div class="row" style="gap:8px;margin-bottom:6px"><span style="width:9px;height:9px;border-radius:50%;background:var(--e);flex:0 0 9px"></span><span style="font-weight:800;font-size:14px">Muscles secondaires</span></div>'+
       '<div style="font-size:13px;color:var(--muted);line-height:1.6">'+f.secondary.join(', ')+'</div>'):'')+
       '</div>';
    if(f.equip) h+='<div class="card"><div class="row"><span class="lab">Matériel</span><span style="font-weight:600">'+f.equip+'</span></div></div>';
  } else {
    // Instructions + Conseils réunis dans le même onglet
    h+='<div class="card"><div class="card-t">📋 Exécution</div>'+((f.steps&&f.steps.length)?f.steps.map((s,i)=>'<div class="tip" style="margin-bottom:6px"><b style="color:var(--e)">'+(i+1)+'.</b> '+s+'</div>').join(''):'<div style="font-size:13px;color:var(--muted)">Réalise le mouvement de façon contrôlée, amplitude complète.</div>')+'</div>';
    if(f.breathing) h+='<div class="card"><div class="card-t">🌬️ Respiration</div><div class="tip">'+f.breathing+'</div></div>';
    if(f.tips&&f.tips.length) h+='<div class="card"><div class="card-t">✅ Conseils</div>'+f.tips.map(x=>'<div class="tip" style="margin-bottom:6px">'+x+'</div>').join('')+'</div>';
    if(f.mistakes&&f.mistakes.length) h+='<div class="card"><div class="card-t" style="color:var(--bad)">⚠️ Erreurs fréquentes</div>'+f.mistakes.map(x=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(255,92,108,.3);background:rgba(255,92,108,.08)">✗ '+x+'</div>').join('')+'</div>';
    if(f.safety&&f.safety.length) h+='<div class="card"><div class="card-t">🛡️ Sécurité</div>'+f.safety.map(x=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(51,211,153,.3);background:rgba(51,211,153,.08)">'+x+'</div>').join('')+'</div>';
  }
  h+='<div class="row" style="gap:10px;margin-top:8px"><button class="btn ghost" onclick="openProg(\''+exDetailCtx.progId+'\')">‹ Retour</button><button class="btn" onclick="startLive(\''+exDetailCtx.progId+'\','+exDetailCtx.idx+')">▶ Démarrer</button></div>';
  $('#progBody').innerHTML=h;
  openOv('ovProg');
  if(exDetailTab==='exo' && g){ startExDemoAuto(g); } else if(_exDemo2){ clearInterval(_exDemo2); _exDemo2=null; }
}
let _exDemo2=null;
function startExDemoAuto(g){
  if(_exDemo2){ clearInterval(_exDemo2); _exDemo2=null; }
  g.forEach(s=>{const im=new Image();im.src=s;}); let i=0;
  _exDemo2=setInterval(()=>{ const im=$('#exDemo'); if(!im){clearInterval(_exDemo2);_exDemo2=null;return;} i=1-i; im.src=g[i]; },650);
}

/* ---------- LIVE MUSCU SESSION ---------- */
let LIVE=null,liveTimer=null,restTimer=null,liveOpenEx=0;
function startLive(id,startIdx){
  const p=allProgs().find(x=>x.id===id); if(!p) return;
  if(_exDemo2){ clearInterval(_exDemo2); _exDemo2=null; }
  closeOv('ovProg');
  // On clone le tableau d'exercices (pas les objets exercice eux-mêmes) : ajouter/retirer un exo
  // en pleine séance ne modifie donc que cette séance, jamais la routine enregistrée.
  LIVE={prog:{...p,ex:p.ex.slice()},idx:startIdx||0,start:Date.now(),
    state:p.ex.map(e=>({weight:e.weight||20,reps:parseInt(e.reps)||10,sets:Array.from({length:e.sets},()=>false),log:[]})),
    tonnage:0,setsDone:0};
  liveOpenEx=startIdx||0;
  renderLive(); openOv('ovLive');
  liveTimer=setInterval(updateLiveTimer,500);
  sfx('start'); startBgActivity('Séance : '+p.name);
}
function updateLiveTimer(){
  if(!LIVE) return;
  const el=$('#liveTime'); if(el) el.textContent=fmtTime((Date.now()-LIVE.start)/1000);
  // Sauvegarde continue → la séance survit même si l'app est fermée/rechargée
  persistLive();
}
function persistLive(){
  if(!LIVE) return;
  // On sauvegarde aussi la liste d'exercices de la séance (LIVE.prog.ex) et pas que le progId :
  // sinon un exo ajouté/retiré en pleine séance serait perdu si l'app se recharge (iOS aime bien le faire).
  const snap={progId:LIVE.prog.id,progName:LIVE.prog.name,progEx:LIVE.prog.ex,idx:LIVE.idx,start:LIVE.start,state:LIVE.state,tonnage:LIVE.tonnage,setsDone:LIVE.setsDone};
  DB.save('live_active',snap);
}
function renderLive(){
  const p=LIVE.prog;
  p.ex.forEach((e,i)=>{
    const st=LIVE.state[i];
    if(!st.log||st.log.length!==st.sets.length){ st.log=st.sets.map((d,j)=>(st.log&&st.log[j])||{kg:e.weight||st.weight||20,reps:parseInt(e.reps)||st.reps||10,rpe:8,done:!!d}); }
  });
  $('#liveTitle').textContent=p.name;
  const totalSets=p.ex.reduce((a,x)=>a+x.sets,0);
  const dur=fmtTime((Date.now()-LIVE.start)/1000);
  // Barre du haut façon Hevy : chevron (mettre de côté) / minuteur rapide / Terminer
  let h='<div class="row" style="margin-bottom:12px">'+
    '<span onclick="pauseLive()" style="font-size:20px;color:var(--muted);cursor:pointer;padding:4px 8px">⌄</span>'+
    '<div style="flex:1"></div>'+
    '<span onclick="openRest(90)" style="font-size:17px;color:var(--muted);cursor:pointer;padding:4px 8px">⏱</span>'+
    '<button class="btn sm" style="width:auto;padding:8px 18px;background:linear-gradient(135deg,var(--e),var(--e2))" onclick="finishLive()">Terminer</button>'+
    '</div>';
  // Stats : Durée / Volume / Séries
  h+='<div class="card" style="padding:14px 6px;margin-bottom:16px"><div style="display:flex;text-align:center">'+
    '<div style="flex:1;border-right:1px solid var(--hair)"><div class="lab" style="margin:0 0 4px">Durée</div><div class="mono" id="liveTime" style="font-weight:800;font-size:16px;color:var(--e)">'+dur+'</div></div>'+
    '<div style="flex:1;border-right:1px solid var(--hair)"><div class="lab" style="margin:0 0 4px">Volume</div><div style="font-weight:800;font-size:16px">'+Math.round(LIVE.tonnage)+' kg</div></div>'+
    '<div style="flex:1"><div class="lab" style="margin:0 0 4px">Séries</div><div style="font-weight:800;font-size:16px">'+LIVE.setsDone+'/'+totalSets+'</div></div>'+
    '</div></div>';
  // Une carte par exercice, repliée sur le nom par défaut — on tape dessus pour dérouler les séries.
  // Un seul exercice ouvert à la fois (accordéon), et tout est animé en douceur (transition CSS).
  p.ex.forEach((e,i)=>{
    const st=LIVE.state[i];
    const allDone=st.sets.length&&st.sets.every(x=>x);
    const open=liveOpenEx===i;
    // Swipe à gauche OU à droite pour révéler "Supprimer" — wrap + 2 actions rouges dessous, carte au-dessus qui glisse.
    h+='<div class="ex-swipe-wrap" data-i="'+i+'">'+
      '<div class="ex-swipe-action left" onclick="confirmDeleteLiveEx('+i+')"><span>🗑</span>Supprimer</div>'+
      '<div class="ex-swipe-action right" onclick="confirmDeleteLiveEx('+i+')"><span>🗑</span>Supprimer</div>';
    h+='<div class="card ex-swipe-card" data-i="'+i+'" style="padding:14px'+(allDone?';border-color:rgba(51,211,153,.35)':'')+'">';
    // Entête exercice (tapable) : vignette, nom, chevron, "..." (options)
    h+='<div class="row" style="align-items:flex-start;cursor:pointer" onclick="toggleLiveEx('+i+')">'+exThumb(e.name,48)+
      '<div style="flex:1;min-width:0;margin-left:10px"><div style="font-weight:700;font-size:15.5px;line-height:1.25">'+e.name+'</div>'+
      '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+(allDone?'✓ Terminé':st.sets.filter(Boolean).length+'/'+st.sets.length+' séries faites')+'</div></div>'+
      '<span id="exChev'+i+'" style="color:var(--muted);font-size:14px;padding:6px 4px;transition:transform .25s ease;transform:rotate('+(open?'180':'0')+'deg)">⌄</span>'+
      '<span onclick="event.stopPropagation();openLiveExOptions('+i+')" style="color:var(--muted);font-size:20px;padding:4px 4px 4px 8px;cursor:pointer;letter-spacing:1px">⋯</span></div>';
    // Contenu repliable : notes, repos, tableau des séries
    h+='<div id="exBody'+i+'" style="max-height:'+(open?'1400px':'0')+'px;opacity:'+(open?'1':'0')+';overflow:hidden;transition:max-height .32s ease,opacity .22s ease,margin-top .32s ease;margin-top:'+(open?'12':'0')+'px">';
    h+='<div class="row" style="margin-bottom:10px;font-size:12.5px"><span style="color:var(--e);cursor:pointer" onclick="changeRest('+i+')">⏱ Minuteur de repos : '+(e.rest?e.rest+'s':'Désactivé')+'</span></div>';
    h+='<div style="display:grid;grid-template-columns:30px 64px 1fr 1fr 38px;gap:6px;font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:8px;text-align:center">'+
      '<div>Set</div><div>Précédent</div><div>Kg</div><div>Reps</div><div>✓</div></div>';
    st.log.forEach((s,j)=>{
      h+='<div class="set-swipe-wrap" data-i="'+i+'" data-j="'+j+'">'+
        '<div class="set-swipe-action left" onclick="deleteLiveSet('+i+','+j+')"><span>🗑</span></div>'+
        '<div class="set-swipe-action right" onclick="deleteLiveSet('+i+','+j+')"><span>🗑</span></div>'+
        '<div class="set-swipe-row" data-i="'+i+'" data-j="'+j+'" style="display:grid;grid-template-columns:30px 64px 1fr 1fr 38px;gap:6px;align-items:center">'+
        '<div style="text-align:center;font-weight:700;color:var(--muted)">'+(j+1)+'</div>'+
        '<div style="text-align:center;font-size:11px;color:var(--dim)">'+(e.weight||20)+'kg×'+(parseInt(e.reps)||10)+'</div>'+
        '<input class="setcell" type="number" inputmode="decimal" value="'+s.kg+'" onchange="setLog('+i+','+j+',\'kg\',this.value)">'+
        '<input class="setcell" type="number" inputmode="numeric" value="'+s.reps+'" onchange="setLog('+i+','+j+',\'reps\',this.value)">'+
        '<div onclick="toggleSet('+i+','+j+')" style="width:32px;height:32px;border-radius:50%;margin:0 auto;cursor:pointer;display:flex;align-items:center;justify-content:center;background:'+(s.done?'var(--e)':'var(--s2)')+';border:1px solid '+(s.done?'var(--e)':'var(--hair)')+';color:#fff;font-size:14px">'+(s.done?'✓':'')+'</div></div>'+
        '</div>'; // fin .set-swipe-wrap
    });
    h+='<button class="btn ghost sm" style="margin-top:4px" onclick="addLiveSet('+i+')">＋ Ajouter une série</button>';
    h+='</div>'; // fin exBody
    h+='</div>'; // fin .ex-swipe-card
    h+='</div>'; // fin .ex-swipe-wrap
  });
  h+='<button class="btn ghost" style="margin:6px 0 10px" onclick="liveAddExercise()">＋ Ajouter un exercice</button>';
  h+='<button class="btn ghost sm" style="margin-bottom:8px;color:var(--bad)" onclick="confirmCloseLive()">🗑 Annuler la séance</button>';
  $('#liveBody').innerHTML=h;
  initLiveSwipe();
}
/* ---------- LIVE : swipe gauche/droite sur une carte exercice pour révéler "Supprimer" ---------- */
const SWIPE_W_EX=88, SWIPE_W_SET=64; // largeurs de la zone rouge révélée (carte exercice / ligne série)
const SWIPE_SEL='.ex-swipe-card, .set-swipe-row';
let liveSwipe={el:null,w:0,startX:0,startY:0,baseX:0,curX:0,dragging:false};
function initLiveSwipe(){
  const box=$('#liveBody'); if(!box||box._swipeBound) return;
  box._swipeBound=true;
  box.addEventListener('pointerdown',liveSwipeDown);
  box.addEventListener('pointermove',liveSwipeMove);
  box.addEventListener('pointerup',liveSwipeUp);
  box.addEventListener('pointercancel',liveSwipeUp);
}
function swipeWidthFor(el){ return el.classList.contains('ex-swipe-card')?SWIPE_W_EX:SWIPE_W_SET; }
function liveSwipeDown(e){
  const el=e.target.closest(SWIPE_SEL); if(!el) return;
  // un swipe déjà ouvert ailleurs (carte OU ligne série) se referme dès qu'on touche un autre élément
  document.querySelectorAll(SWIPE_SEL+'.open').forEach(c=>{ if(c!==el) closeSwipeCard(c); });
  const w=swipeWidthFor(el);
  liveSwipe={el,w,startX:e.clientX,startY:e.clientY,
    baseX:el.classList.contains('open')?(el._openDir==='right'?w:-w):0,
    curX:0,dragging:false};
}
function liveSwipeMove(e){
  const s=liveSwipe; if(!s.el) return;
  const dx=e.clientX-s.startX, dy=e.clientY-s.startY;
  if(!s.dragging){
    if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
    if(Math.abs(dy)>Math.abs(dx)){ s.el=null; return; } // scroll vertical → on laisse faire, pas de swipe
    s.dragging=true; s.el.classList.add('dragging'); s.el.setPointerCapture&&s.el.setPointerCapture(e.pointerId);
  }
  let x=s.baseX+dx;
  x=Math.max(-s.w,Math.min(s.w,x));
  s.curX=x;
  s.el.style.transform='translateX('+x+'px)';
}
function liveSwipeUp(e){
  const s=liveSwipe; if(!s.el){ liveSwipe={el:null}; return; }
  if(s.dragging){
    s.el.classList.remove('dragging');
    if(s.curX<=-40){ s.el.style.transform='translateX(-'+s.w+'px)'; s.el.classList.add('open'); s.el._openDir='left'; }
    else if(s.curX>=40){ s.el.style.transform='translateX('+s.w+'px)'; s.el.classList.add('open'); s.el._openDir='right'; }
    else { s.el.style.transform='translateX(0px)'; s.el.classList.remove('open'); s.el._openDir=null; }
  }
  liveSwipe={el:null};
}
function closeSwipeCard(card){ card.style.transform='translateX(0px)'; card.classList.remove('open'); card._openDir=null; }
function toggleLiveEx(i){
  // Si la carte est ouverte en mode swipe (Supprimer révélé), un tap la referme au lieu de la déplier.
  const card=document.querySelector('.ex-swipe-card[data-i="'+i+'"]');
  if(card && card.classList.contains('open')){ closeSwipeCard(card); return; }
  const prev=liveOpenEx;
  const willOpen=prev!==i;
  liveOpenEx=willOpen?i:-1;
  // Toggle direct des styles (pas de renderLive() ici) pour que la transition CSS s'anime réellement.
  if(prev>=0 && prev!==i){
    const pb=$('#exBody'+prev); if(pb){ pb.style.maxHeight='0px'; pb.style.opacity='0'; pb.style.marginTop='0px'; }
    const pc=$('#exChev'+prev); if(pc) pc.style.transform='rotate(0deg)';
  }
  const b=$('#exBody'+i);
  if(b){
    if(willOpen){ b.style.maxHeight='1400px'; b.style.opacity='1'; b.style.marginTop='12px'; }
    else { b.style.maxHeight='0px'; b.style.opacity='0'; b.style.marginTop='0px'; }
  }
  const c=$('#exChev'+i); if(c) c.style.transform=willOpen?'rotate(180deg)':'rotate(0deg)';
}
function setLog(i,j,k,v){ const st=LIVE.state[i]; st.log[j][k]=+v||0; if(k==='kg')st.weight=+v||st.weight; persistLive(); }
function changeRest(i){ const e=LIVE.prog.ex[i]; pickInt('Repos (secondes)',15,300,e.rest||90,'s',v=>{ e.rest=v; renderLive(); },15); }
function addLiveSet(i){ const st=LIVE.state[i]; const last=st.log[st.log.length-1]||{kg:20,reps:10,rpe:8}; st.sets.push(false); st.log.push({kg:last.kg,reps:last.reps,rpe:last.rpe,done:false}); persistLive(); renderLive(); }
function deleteLiveSet(i,j){
  const st=LIVE.state[i];
  if(st.log.length<=1){ toast('Il doit rester au moins une série'); return; }
  st.sets.splice(j,1); st.log.splice(j,1);
  persistLive(); renderLive();
}

/* ---------- LIVE : options par exercice ("⋯") — voir la démo, modifier le repos, retirer ---------- */
function openLiveExOptions(i){
  const e=LIVE.prog.ex[i];
  const old=$('#liveExOptOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='liveExOptOv'; ov.style.zIndex='13600';
  const g=exGif(e.name);
  let h='<div class="ov-card" style="text-align:center">';
  h+='<div class="card-t" style="justify-content:center;margin-bottom:14px">'+e.name+'</div>';
  if(g) h+='<img src="'+g[0]+'" style="width:100%;border-radius:14px;margin-bottom:14px;aspect-ratio:16/10;object-fit:cover">';
  h+='<button class="btn ghost" style="margin-bottom:8px" onclick="document.getElementById(\'liveExOptOv\').remove();changeRest('+i+')">⏱ Modifier le repos</button>';
  h+='<button class="btn ghost" style="margin-bottom:8px;color:var(--bad)" onclick="document.getElementById(\'liveExOptOv\').remove();confirmDeleteLiveEx('+i+')">🗑 Retirer cet exercice</button>';
  h+='<button class="btn ghost" onclick="document.getElementById(\'liveExOptOv\').remove()">Annuler</button>';
  h+='</div>';
  ov.innerHTML=h;
  document.body.appendChild(ov);
}
function confirmDeleteLiveEx(i){
  if(LIVE.prog.ex.length<=1){ toast('Il doit rester au moins un exercice'); return; }
  const name=LIVE.prog.ex[i].name;
  const old=$('#delExOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='delExOv'; ov.style.zIndex='13650';
  ov.innerHTML='<div class="ov-card" style="text-align:center">'+
    '<div class="card-t" style="justify-content:center;margin-bottom:10px">⚠️ Retirer cet exercice ?</div>'+
    '<div style="font-size:13px;color:var(--muted);margin-bottom:18px">'+name+'</div>'+
    '<div class="row" style="gap:10px">'+
      '<button class="btn ghost" style="flex:1" onclick="document.getElementById(\'delExOv\').remove()">Annuler</button>'+
      '<button class="btn" style="flex:1;background:var(--bad)" onclick="doDeleteLiveEx('+i+')">Retirer</button>'+
    '</div></div>';
  document.body.appendChild(ov);
}
function doDeleteLiveEx(i){
  const o=$('#delExOv'); if(o) o.remove();
  LIVE.prog.ex.splice(i,1); LIVE.state.splice(i,1);
  if(LIVE.idx>=LIVE.prog.ex.length) LIVE.idx=Math.max(0,LIVE.prog.ex.length-1);
  if(liveOpenEx===i) liveOpenEx=-1; else if(liveOpenEx>i) liveOpenEx--;
  persistLive(); renderLive();
  toast('Exercice retiré ✓');
}
function liveAddExercise(){
  libCallback=(e)=>{ closeOv('ovLib'); openLiveCfgAdd(e); };
  libBrowseMode=false; renderLib();
  $('#ovLib').style.zIndex='13700'; openOv('ovLib');
}
function openLiveCfgAdd(e){
  $('#ovCfg').style.zIndex='13750';
  openCfg(e,(cfg)=>{
    LIVE.prog.ex.push(cfg);
    LIVE.state.push({weight:cfg.weight||20,reps:parseInt(cfg.reps)||10,sets:Array.from({length:cfg.sets},()=>false),log:[]});
    liveOpenEx=LIVE.prog.ex.length-1;
    persistLive(); toast('Exercice ajouté ✓'); renderLive();
  });
}

function pauseLive(){
  clearInterval(liveTimer);
  LIVE.savedElapsed=Date.now()-LIVE.start;
  DB.save('live_paused',LIVE); DB.remove('live_active');
  closeOv('ovLive'); LIVE=null; toast('Séance sauvegardée — reprends quand tu veux');
  stopBgActivity(); renderSport();
}
function resumeLive(){
  const saved=DB.load('live_paused'); if(!saved) return;
  LIVE=saved; // on garde saved.prog tel quel (avec les exos ajoutés/retirés pendant la séance),
  // on ne va PAS le remplacer par la routine d'origine sinon ces changements seraient perdus.
  LIVE.start=Date.now()-(saved.savedElapsed||0);
  liveOpenEx=saved.idx||0;
  DB.remove('live_paused');
  renderLive(); openOv('ovLive'); liveTimer=setInterval(updateLiveTimer,500);
}
function toggleSet(exIdx,setIdx){
  const st=LIVE.state[exIdx];
  if(!st.log) st.log=st.sets.map(()=>({kg:st.weight,reps:st.reps,rpe:8}));
  const s=st.log[setIdx]||{kg:st.weight,reps:st.reps};
  st.sets[setIdx]=!st.sets[setIdx]; st.log[setIdx].done=st.sets[setIdx];
  const vol=(s.kg||0)*(s.reps||0);
  if(st.sets[setIdx]){ LIVE.setsDone++; LIVE.tonnage+=vol; openRest(st.log[setIdx].rest||LIVE.prog.ex[exIdx].rest||90); sfx('tick'); toast('+5 XP'); }
  else { LIVE.setsDone--; LIVE.tonnage-=vol; }
  persistLive(); renderLive();
}
function openRest(secs){
  let t=secs||90; const total=t; const endAt=Date.now()+t*1000;
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='restOv';
  ov.innerHTML='<div class="ov-card" style="text-align:center"><div class="card-t" style="justify-content:center">⏱ Repos</div><div class="ring-wrap" style="width:170px;height:170px;margin:10px auto"><span id="restRing"></span><div class="ring-c"><div class="big mono" id="restNum" style="font-size:38px">'+t+'</div><div class="sm">sec</div></div></div><div class="row" style="gap:10px"><button class="btn ghost" onclick="addRest(30)">+30s</button><button class="btn" onclick="skipRest()">Passer</button></div></div>';
  document.body.appendChild(ov);
  let extra=0;
  function tick(){
    t=Math.max(0,Math.round((endAt+extra*1000-Date.now())/1000));
    const rr=$('#restRing'); if(rr)rr.innerHTML=ringSVG(170,t/(total+extra)*100,12,'var(--e)');
    const rn=$('#restNum'); if(rn)rn.textContent=t;
    if(t<=0){ sfx('tick'); skipRest(); return; }
  }
  tick();
  restTimer=setInterval(tick,250);
  window._restAdd=(s)=>{ extra+=s; };
}
function addRest(s){ if(window._restAdd)window._restAdd(s); }
function skipRest(){ clearInterval(restTimer); const o=$('#restOv'); if(o)o.remove(); }
function liveNav(d){ LIVE.idx=Math.max(0,Math.min(LIVE.prog.ex.length-1,LIVE.idx+d)); renderLive(); }
function confirmCloseLive(){
  // Popup "maison" à la place de confirm() natif, qui ne fonctionne pas dans une app ajoutée à l'écran d'accueil (iOS)
  const old=$('#cancelLiveOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='cancelLiveOv';
  ov.innerHTML='<div class="ov-card" style="text-align:center">'+
    '<div class="card-t" style="justify-content:center;margin-bottom:10px">⚠️ Annuler la séance ?</div>'+
    '<div style="font-size:13px;color:var(--muted);margin-bottom:18px">Ta progression sur cette séance sera perdue.</div>'+
    '<div class="row" style="gap:10px">'+
      '<button class="btn ghost" style="flex:1" onclick="document.getElementById(\'cancelLiveOv\').remove()">Continuer</button>'+
      '<button class="btn" style="flex:1;background:var(--bad)" onclick="doCancelLive()">Oui, annuler</button>'+
    '</div></div>';
  document.body.appendChild(ov);
}
function doCancelLive(){
  const ov=$('#cancelLiveOv'); if(ov) ov.remove();
  const eo=$('#liveExOptOv'); if(eo) eo.remove();
  const de=$('#delExOv'); if(de) de.remove();
  clearInterval(liveTimer); clearInterval(restTimer); skipRest();
  LIVE=null; DB.remove('live_active'); DB.remove('live_paused');
  closeOv('ovLive'); stopBgActivity(); toast('Séance annulée'); renderSport();
}
function finishLive(){
  clearInterval(liveTimer); skipRest();
  const dur=Math.round((Date.now()-LIVE.start)/1000);
  const cal=Math.round(LIVE.tonnage*0.05+dur/60*6);
  const totalReps=LIVE.state.reduce((a,st,i)=>a+st.sets.filter(Boolean).length*st.reps,0);
  // PR : compare au meilleur tonnage par exercice (records charge)
  const prs=[];
  LIVE.state.forEach((st,i)=>{ if(st.sets.some(Boolean)){ const name=LIVE.prog.ex[i].name;
    const prev=MUSCU_PR[name]||0; if(st.weight>prev){ MUSCU_PR[name]=st.weight; prs.push(name+' : '+st.weight+'kg'); } }});
  DB.save('muscu_pr',MUSCU_PR);
  // progression vs séance précédente du même programme
  const prevSess=MSESS.filter(s=>s.progName===LIVE.prog.name).slice(-1)[0];
  const prevTon=prevSess?prevSess.tonnage:0;
  // muscles travaillés
  const muscles={}; LIVE.prog.ex.forEach((e,i)=>{ if(LIVE.state[i].sets.some(Boolean)) (e.muscles||[]).forEach(m=>muscles[m]=(muscles[m]||0)+1); });
  MSESS.push({date:todayKey(),progName:LIVE.prog.name,tonnage:LIVE.tonnage,sets:LIVE.setsDone,reps:totalReps,duration:dur,calories:cal,muscles:Object.keys(muscles)});
  // Historique par exercice (pour les graphiques de progression)
  if(!PREFS.exHist) PREFS.exHist={};
  LIVE.prog.ex.forEach((e,i)=>{ const st=LIVE.state[i]; if(st.sets.some(Boolean)){
    const vol=(st.log||[]).reduce((a,s)=>a+(s.done?(s.kg||0)*(s.reps||0):0),0);
    if(vol>0){ if(!PREFS.exHist[e.name])PREFS.exHist[e.name]=[]; PREFS.exHist[e.name].push({date:todayKey(),vol}); PREFS.exHist[e.name]=PREFS.exHist[e.name].slice(-30); }
  }});
  DB.remove('live_active');
  saveAll(); refreshXP({animate:true}); burst(); sfx('finish'); stopBgActivity();
  let h='<div class="popin" style="text-align:center;padding:6px 0"><div style="font-size:50px">🏆</div><div class="man" style="font-weight:800;font-size:22px;margin:8px 0">Séance terminée !</div></div>';
  h+='<div class="sgrid" style="margin-bottom:12px"><div class="sbox"><div class="v">'+Math.round(LIVE.tonnage)+'</div><div class="l">Tonnage (kg)</div></div><div class="sbox"><div class="v">'+fmtTime(dur)+'</div><div class="l">Durée</div></div><div class="sbox"><div class="v">'+LIVE.setsDone+'</div><div class="l">Séries</div></div><div class="sbox"><div class="v">'+totalReps+'</div><div class="l">Répétitions</div></div><div class="sbox"><div class="v">'+cal+'</div><div class="l">Calories</div></div><div class="sbox"><div class="v" style="color:var(--or)">'+prs.length+'</div><div class="l">Records battus</div></div></div>';
  // progression
  if(prevTon){ const diff=Math.round(LIVE.tonnage-prevTon); const up=diff>=0;
    h+='<div class="tip" style="margin-bottom:12px;'+(up?'border-color:rgba(51,211,153,.3);background:rgba(51,211,153,.08)':'')+'">'+(up?'📈 +':'📉 ')+diff+' kg de tonnage vs ta dernière séance '+LIVE.prog.name+'.</div>'; }
  // PR
  if(prs.length) h+='<div class="card-t">🥇 Nouveaux records</div>'+prs.map(p=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(242,184,75,.4);background:rgba(242,184,75,.1)">⭐ '+p+'</div>').join('');
  // muscles schema
  if(Object.keys(muscles).length){ h+='<div class="card-t" style="margin-top:12px">💪 Muscles travaillés</div><div class="muscle-tags" style="margin-bottom:12px">'+Object.keys(muscles).map(m=>'<span class="mtag" style="background:var(--ed);color:var(--e);border-color:var(--e)">'+m+'</span>').join('')+'</div>'; }
  h+='<div class="badge" style="width:100%;justify-content:center;padding:14px;margin:6px 0 14px">+50 XP gagnés !</div>';
  h+='<button class="btn" onclick="closeOv(\'ovLive\');LIVE=null;renderSport()">Fermer</button>';
  $('#liveBody').innerHTML=h;
}

/* ---------- CREATE PROGRAM ---------- */
let newProg=null,libFilter='Tous',libCallback=null;
const PROG_ICONS=['💪','🏋️','🔥','⚡','🦾','🎯','🏆','🦵','🧗','🤸'];
const PROG_COLORS=[['--e','Bleu'],['--bad','Rouge'],['--ok','Vert'],['--or','Or'],['--maitre','Violet'],['--diamant','Cyan']];
function openCreate(){
  newProg={name:'',description:'',objective:'Masse',color:'--e',icon:'💪',ex:[]};
  renderCreate(); openOv('ovCreate');
}
function renderCreate(){
  let h='<div class="field"><label>Nom du programme</label><input class="inp" id="npName" value="'+newProg.name+'" oninput="newProg.name=this.value" placeholder="Mon programme"></div>';
  h+='<div class="field"><label>Description</label><textarea class="inp" rows="2" oninput="newProg.description=this.value" placeholder="Objectif, split, fréquence...">'+(newProg.description||'')+'</textarea></div>';
  h+='<div class="field"><label>Objectif</label><div class="pills">'+['Force','Masse','Endurance','Perte poids','Maintien'].map(o=>'<div class="pill '+(newProg.objective===o?'on':'')+'" onclick="newProg.objective=\''+o+'\';renderCreate()">'+o+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Icône</label><div class="pills">'+PROG_ICONS.map(ic=>'<div class="pill '+(newProg.icon===ic?'on':'')+'" style="font-size:18px" onclick="newProg.icon=\''+ic+'\';renderCreate()">'+ic+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Couleur</label><div class="pills">'+PROG_COLORS.map(c=>'<div class="pill '+(newProg.color===c[0]?'on':'')+'" onclick="newProg.color=\''+c[0]+'\';renderCreate()"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var('+c[0]+');margin-right:6px"></span>'+c[1]+'</div>').join('')+'</div></div>';
  h+='<div class="lab" style="margin:10px 0 8px">Exercices ('+newProg.ex.length+')</div>';
  if(!newProg.ex.length) h+='<div class="tip" style="margin-bottom:12px">Ajoute des exercices depuis la bibliothèque.</div>';
  newProg.ex.forEach((e,i)=>{
    h+='<div class="card" style="margin-bottom:8px;padding:12px"><div class="row"><div class="row" style="gap:8px"><span style="font-size:22px">'+e.anim+'</span><div><div style="font-weight:700;font-size:14px">'+e.name+'</div><div class="mono" style="font-size:12px;color:var(--e)">'+e.sets+'×'+e.reps+(e.rest?' · '+e.rest+'s':'')+'</div></div></div><button class="x" onclick="newProg.ex.splice('+i+',1);renderCreate()">🗑</button></div></div>';
  });
  h+='<button class="btn ghost" style="margin-bottom:12px" onclick="openLibFor(addToNewProg)">＋ Ajouter depuis la bibliothèque</button>';
  h+='<button class="btn" onclick="saveNewProg()">💾 Enregistrer le programme</button>';
  $('#createBody').innerHTML=h;
}
function addToNewProg(e){ closeOv('ovLib'); openCfg(e,(cfg)=>{ newProg.ex.push(cfg); renderCreate(); openOv('ovCreate'); }); }
function saveNewProg(){
  if(!newProg.name.trim()){ toast('Donne un nom'); return; }
  if(!newProg.ex.length){ toast('Ajoute des exercices'); return; }
  CUSTOM.push({id:'C'+Date.now(),kind:'muscu',name:newProg.name,description:newProg.description,objective:newProg.objective,color:newProg.color,icon:newProg.icon,ex:newProg.ex});
  saveAll(); closeOv('ovCreate'); renderSport(); toast('Programme créé ✓');
}

/* ---------- BIBLIOTHÈQUE PREMIUM ---------- */
let libFilterEquip='Tous', libFilterLevel='Tous', libSearch='', libBrowseMode=false;
function openLibFor(cb){ libCallback=cb; libBrowseMode=false; closeOv('ovCreate'); renderLib(); openOv('ovLib'); }
function openLibBrowse(){ libCallback=null; libBrowseMode=true; renderLib(); openOv('ovLib'); }
let libView='grid';
function renderLib(){
  let h='<input class="inp" style="margin-bottom:14px" placeholder="🔍 Rechercher un exercice..." value="'+libSearch+'" oninput="libSearch=this.value;renderLib();this.focus()">';
  // Tuiles muscle en photo — navigation visuelle rapide, comme une planche anatomique
  h+='<div class="lab" style="margin-bottom:8px">Muscle</div><div class="mtile-row">'+MUSCLE_GROUPS.map(m=>{
    const img=muscleRepImg(m); const on=libFilter===m;
    return '<div class="mtile '+(on?'on':'')+'" onclick="libFilter=\''+m+'\';renderLib()"><div class="mtile-img" '+(img?'style="background-image:url(\''+img+'\')"':'')+'>'+(img?'':MUSCLE_ICONS[m]||'🏋️')+'</div><div class="mtile-lab">'+m+'</div></div>';
  }).join('')+'</div>';
  h+='<div class="lab" style="margin-bottom:6px">Matériel</div><div class="pills" style="margin-bottom:10px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px">'+EQUIPMENT.map(m=>'<div class="pill '+(libFilterEquip===m?'on':'')+'" onclick="libFilterEquip=\''+m+'\';renderLib()">'+m+'</div>').join('')+'</div>';
  h+='<div class="lab" style="margin-bottom:6px">Niveau</div><div class="pills" style="margin-bottom:14px">'+['Tous',...LEVELS].map(m=>'<div class="pill '+(libFilterLevel===m?'on':'')+'" onclick="libFilterLevel=\''+m+'\';renderLib()">'+m+'</div>').join('')+'</div>';
  const q=libSearch.toLowerCase().trim();
  const list=allExercises().filter(e=>{
    if(libFilter!=='Tous' && e.group!==libFilter && !(e.primary||[]).some(m=>m.includes(libFilter)||libFilter.includes(m))) return false;
    if(libFilterEquip!=='Tous' && e.equip!==libFilterEquip) return false;
    if(libFilterLevel!=='Tous' && e.level!==libFilterLevel) return false;
    if(q && !e.name.toLowerCase().includes(q)) return false;
    return true;
  });
  h+='<div class="row" style="margin-bottom:8px"><div class="lab" style="flex:1">'+list.length+' exercice'+(list.length>1?'s':'')+'</div><div style="display:flex;gap:6px"><span class="mini-ic" style="'+(libView==='grid'?'color:var(--e);border-color:var(--e)':'')+'" onclick="libView=\'grid\';renderLib()">▦</span><span class="mini-ic" style="'+(libView==='list'?'color:var(--e);border-color:var(--e)':'')+'" onclick="libView=\'list\';renderLib()">☰</span></div></div>';
  if(libView==='grid'){
    h+='<div class="exg-grid">';
    list.forEach(e=>{
      const nm=e.name.replace(/"/g,'&quot;'); const g=exGif(e.name); const lvCol=e.level==='Débutant'?'--ok':e.level==='Avancé'?'--bad':'--warn';
      h+='<div class="exg-card" onclick=\'openFiche("'+nm+'")\'>'+
        '<div class="exg-img" '+(g?'style="background-image:url(\''+g[0]+'\')"':'')+'>'+(g?'':'<span>'+e.anim+'</span>')+
        (libBrowseMode?'':'<span class="exg-add" onclick=\'event.stopPropagation();pickEx("'+nm+'")\'>＋</span>')+
        '</div><div class="exg-body"><div class="exg-name">'+e.name+'</div><div class="exg-sub">'+e.equip+' · <span style="color:var('+lvCol+')">'+e.level+'</span></div></div></div>';
    });
    h+='</div>';
  } else {
  list.forEach(e=>{
    const lvCol=e.level==='Débutant'?'--ok':e.level==='Avancé'?'--bad':'--warn';
    h+='<div class="card" style="margin-bottom:8px;padding:12px"><div class="row"><div class="row" style="gap:10px;flex:1;cursor:pointer" onclick=\'openFiche("'+e.name.replace(/"/g,'&quot;')+'")\'>'+exThumb(e.name,48)+'<div><div style="font-weight:700;font-size:14px">'+e.name+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+e.equip+' · <span style="color:var('+lvCol+')">'+e.level+'</span></div><div class="muscle-tags">'+(e.primary||[]).map(m=>'<span class="mtag">'+m+'</span>').join('')+'</div></div></div>'+(libBrowseMode?'<button class="x" onclick=\'openFiche("'+e.name.replace(/"/g,'&quot;')+'")\'>›</button>':'<button class="x" style="color:var(--e)" onclick=\'pickEx("'+e.name.replace(/"/g,'&quot;')+'")\'>＋</button>')+'</div></div>';
  });
  }
  $('#libBody').innerHTML=h;
}
function pickEx(name){ const e=findEx(name); if(libCallback) libCallback(e); else openFiche(name); }
/* Fiche tutoriel complète */
function openFiche(name){
  const f=exMeta(name); if(!f) return;
  const lvCol=f.level==='Débutant'?'--ok':f.level==='Avancé'?'--bad':'--warn';
  let h='<div style="text-align:center;margin-bottom:14px"><div style="font-size:64px;animation:popIn .5s">'+f.anim+'</div><div class="man" style="font-weight:800;font-size:20px;margin-top:4px">'+f.name+'</div><div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap"><span class="badge">'+f.equip+'</span><span class="badge" style="background:var(--ed);color:var('+lvCol+')">'+f.level+'</span></div></div>';
  // visuel animé (placeholder élégant simulant un GIF/avatar)
  if(f.gif){
    // Démonstration animée réelle (2 frames alternées = mouvement)
    h+='<div style="position:relative;background:#fff;border:1px solid var(--hair);border-radius:18px;overflow:hidden;margin-bottom:14px">'+
      '<img id="exDemo" src="'+f.gif[0]+'" alt="démonstration" style="width:100%;display:block;aspect-ratio:5/4;object-fit:cover" onerror="this.parentNode.style.display=\'none\';document.getElementById(\'exDemoFallback\').style.display=\'block\'">'+
      '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.7));padding:10px 12px 8px;display:flex;align-items:center;gap:6px;font-size:11px;color:#fff;font-weight:700"><span style="width:7px;height:7px;border-radius:50%;background:var(--e);animation:demoPulse 1s infinite"></span>DÉMONSTRATION DU MOUVEMENT</div></div>';
    h+='<div id="exDemoFallback" style="display:none;position:relative;background:linear-gradient(135deg,var(--s2),var(--s1));border:1px solid var(--hair);border-radius:18px;padding:34px 16px;text-align:center;margin-bottom:14px"><div style="font-size:68px;animation:demoFloat 1.5s ease-in-out infinite">'+f.anim+'</div><div style="font-size:11px;color:var(--dim);margin-top:8px">Démonstration du mouvement</div></div>';
    startExDemo(f.gif);
  } else {
    h+='<div style="position:relative;background:linear-gradient(135deg,var(--s2),var(--s1));border:1px solid var(--hair);border-radius:18px;padding:34px 16px;text-align:center;margin-bottom:14px;overflow:hidden">'+
      '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,var(--ed),transparent 70%)"></div>'+
      '<div style="position:relative;font-size:68px;animation:demoFloat 1.5s ease-in-out infinite;filter:drop-shadow(0 6px 14px rgba(0,0,0,.4))">'+f.anim+'</div>'+
      '<div style="position:relative;display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--e);font-weight:700"><span style="width:7px;height:7px;border-radius:50%;background:var(--e);animation:demoPulse 1s infinite"></span>DÉMONSTRATION DU MOUVEMENT</div></div>';
  }
  h+='<div class="card-t">🎯 Muscles sollicités</div><div style="margin-bottom:12px"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">Principaux</div><div class="muscle-tags">'+(f.primary||[]).map(m=>'<span class="mtag" style="background:var(--ed);color:var(--e);border-color:var(--e)">'+m+'</span>').join('')+'</div>'+((f.secondary&&f.secondary.length)?'<div style="font-size:12px;color:var(--muted);margin:8px 0 4px">Secondaires</div><div class="muscle-tags">'+f.secondary.map(m=>'<span class="mtag">'+m+'</span>').join('')+'</div>':'')+'</div>';
  h+='<div class="card-t">📋 Exécution étape par étape</div>'+f.steps.map((s,i)=>'<div class="tip" style="margin-bottom:6px"><b style="color:var(--e)">'+(i+1)+'.</b> '+s+'</div>').join('');
  h+='<div class="card-t" style="margin-top:14px">🌬️ Respiration</div><div class="tip">'+f.breathing+'</div>';
  h+='<div class="card-t" style="margin-top:14px;color:var(--bad)">⚠️ Erreurs fréquentes</div>'+f.mistakes.map(m=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(255,92,108,.3);background:rgba(255,92,108,.08)">✗ '+m+'</div>').join('');
  h+='<div class="card-t" style="margin-top:14px">✅ Conseils du coach</div>'+f.tips.map(t=>'<div class="tip" style="margin-bottom:6px">'+t+'</div>').join('');
  h+='<div class="card-t" style="margin-top:14px">🛡️ Sécurité</div>'+f.safety.map(s=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(51,211,153,.3);background:rgba(51,211,153,.08)">'+s+'</div>').join('');
  if(f.variants&&f.variants.length){ h+='<div class="card-t" style="margin-top:14px">🔁 Variantes</div><div class="pills">'+f.variants.map(v=>'<div class="pill" onclick=\'openFiche("'+v.replace(/"/g,'&quot;')+'")\'>'+v+'</div>').join('')+'</div>'; }
  if(libCallback) h+='<button class="btn" style="margin-top:18px" onclick=\'pickEx("'+f.name.replace(/"/g,'&quot;')+'")\'>＋ Ajouter au programme</button>';
  $('#libBody').innerHTML=h;
}
let _exDemoTimer=null;
function startExDemo(frames){
  clearInterval(_exDemoTimer);
  // précharge les 2 images
  frames.forEach(src=>{ const im=new Image(); im.src=src; });
  let i=0;
  _exDemoTimer=setInterval(()=>{
    const img=document.getElementById('exDemo');
    if(!img){ clearInterval(_exDemoTimer); return; }
    i=1-i; img.src=frames[i];
  },850);
}

/* ---------- CONFIG EXERCISE ---------- */
let cfgEx=null,cfgState=null,cfgCallback=null;
function openCfg(e,cb){
  cfgEx=e; cfgCallback=cb;
  cfgState={name:e.name,anim:e.anim,muscles:e.muscles,tip:e.tip,sets:e.sets||3,reps:String(e.reps||10),weight:20,rest:90,amrap:false,note:''};
  renderCfg(); openOv('ovCfg');
}
function renderCfg(){
  const s=cfgState;
  let h='<div style="text-align:center;margin-bottom:14px"><span style="font-size:40px">'+s.anim+'</span><div class="man" style="font-weight:800;font-size:18px;margin-top:4px">'+s.name+'</div></div>';
  h+='<div class="field"><label>Séries</label><div class="stepper"><button onclick="cfgAdj(\'sets\',-1)">−</button><span class="val" id="cfSets">'+s.sets+'</span><button onclick="cfgAdj(\'sets\',1)">+</button></div></div>';
  h+='<div class="field"><label>Répétitions</label><div class="pills" style="margin-bottom:8px">'+['6','8','10','12','15'].map(r=>'<div class="pill '+(s.reps===r&&!s.amrap?'on':'')+'" onclick="cfgState.reps=\''+r+'\';cfgState.amrap=false;renderCfg()">'+r+'</div>').join('')+'<div class="pill '+(s.amrap?'on':'')+'" onclick="cfgState.amrap=true;cfgState.reps=\'AMRAP\';renderCfg()">AMRAP</div></div></div>';
  h+='<div class="field"><label>Charge (kg)</label><div class="stepper"><button onclick="cfgAdj(\'weight\',-2.5)">−</button><button onclick="cfgAdj(\'weight\',-5)" style="font-size:12px">−5</button><span class="val" id="cfW">'+s.weight+'</span><button onclick="cfgAdj(\'weight\',5)" style="font-size:12px">+5</button><button onclick="cfgAdj(\'weight\',2.5)">+</button></div><div class="pills" style="margin-top:8px">'+[20,40,60,80,100].map(w=>'<div class="pill" onclick="cfgState.weight='+w+';renderCfg()">'+w+'kg</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Repos</label><div class="pills">'+[60,90,120,180].map(r=>'<div class="pill '+(s.rest===r?'on':'')+'" onclick="cfgState.rest='+r+';renderCfg()">'+r+'s</div>').join('')+'</div></div>';
  h+='<div class="field"><label>Notes personnelles (optionnel)</label><textarea class="inp" rows="2" oninput="cfgState.note=this.value" placeholder="ex: bien serrer les omoplates">'+(s.note||'')+'</textarea></div>';
  h+='<button class="btn" onclick="saveCfg()">✓ Ajouter</button>';
  $('#cfgBody').innerHTML=h;
}
function cfgAdj(k,v){ cfgState[k]=Math.max(k==='weight'?0:1,cfgState[k]+v); renderCfg(); }
function saveCfg(){
  const s=cfgState;
  const cfg={name:s.name,anim:s.anim,muscles:s.muscles,tip:s.tip,sets:s.sets,reps:s.reps,weight:s.weight,rest:s.rest,note:s.note};
  closeOv('ovCfg'); if(cfgCallback) cfgCallback(cfg);
}

/* ---------- STATS ---------- */
let statsTab='bilan';
function renderStats(){
  let h='';
  if(statsTab==='bilan') h+=statsBilan();
  if(statsTab==='run') h+=statsRun();
  if(statsTab==='muscu') h+=statsMuscu();
  if(statsTab==='medals') h+=statsMedals();
  $('#s-stats').innerHTML=h;
}
let bilanPeriod='week';
function statsBilan(){
  const per=bilanPeriod;
  const {cur,prev}=periodRanges(per);
  const km=sumKmBetween(cur[0],cur[1]);
  const mins=sumMinsBetween(cur[0],cur[1]);
  const cnt=countBetween(cur[0],cur[1]);
  const prevKm=sumKmBetween(prev[0],prev[1]);
  const prevCnt=countBetween(prev[0],prev[1]);
  const deltaPct=prevKm>0?Math.round((km-prevKm)/prevKm*100):(km>0?100:null);
  const bars=kmBarSeries(per);
  const trend=weeklyTrend8();

  // ONGLETS PÉRIODE — segmented control façon Kalo
  let h='<div class="seg-ctrl">'+
    ['week','month','3m','year'].map(p=>'<div class="seg-btn'+(per===p?' on':'')+'" onclick="bilanPeriod=\''+p+'\';renderStats()">'+periodTabLabel(p)+'</div>').join('')+
  '</div>';

  // CARTE KILOMÉTRAGE — gros chiffre + delta + barres avec ligne de moyenne
  h+='<div class="kchart-card">'+
    '<div class="kchart-top"><div><div class="kchart-lab">Kilométrage</div><div class="kchart-val">'+km.toFixed(1)+'<span>km cumulés</span></div></div>'+
    (deltaPct!==null?'<div><div class="kchart-delta'+(deltaPct<0?' bad':'')+'">'+(deltaPct>0?'↑ ':deltaPct<0?'↓ ':'')+Math.abs(deltaPct)+'%</div><div class="kchart-delta-sub">vs période préc.</div></div>':'')+
    '</div>'+
    kBarsHTML(bars.labels,bars.values,per==='week'?((new Date().getDay()+6)%7):null)+
  '</div>';

  // CARTE TENDANCE — ligne sur les 8 dernières semaines, peu importe l'onglet actif
  h+='<div class="kchart-card">'+
    '<div class="kchart-top"><div><div class="kchart-lab">Tendance volume</div><div class="kchart-val">'+trend[trend.length-1].toFixed(1)+'<span>km cette sem.</span></div></div>'+
    '<div><div class="kchart-delta">8 sem.</div></div></div>'+
    '<div style="margin-top:14px">'+lineChartSVG(trend,300,60,'var(--e2)')+'</div>'+
    '<div class="kline-labs"><span>Il y a 8 sem.</span><span>Cette semaine</span></div>'+
  '</div>';

  // DUO TEMPS / SÉANCES
  const sessTarget=Math.round(((P.days&&P.days.length)||4)*weeksInPeriod(per));
  const sessPct=sessTarget?Math.min(100,Math.round(cnt/sessTarget*100)):0;
  h+='<div class="kduo">'+
    '<div class="kduo-card"><div class="kduo-lab">Temps total</div><div class="kduo-val">'+fmtHM(mins)+'</div>'+
      '<div class="kduo-sub" style="color:var(--muted)">sur la période</div></div>'+
    '<div class="kduo-card"><div class="kduo-lab">Séances</div><div class="kduo-val">'+cnt+' <span style="font-size:12px;color:var(--muted);font-weight:600">/ '+sessTarget+'</span></div>'+
      '<div class="kgoal-bar"><div style="width:'+sessPct+'%"></div></div>'+
      '<div class="kduo-sub">'+(sessPct>=100?'Objectif atteint ! 🎉':sessPct+'% de la cible')+'</div></div>'+
  '</div>';

  // INSIGHTS — km/séance (delta), répartition des types (donut), meilleure fenêtre
  const avgKmSess=cnt?(km/cnt):0;
  const prevAvgKmSess=prevCnt?(prevKm/prevCnt):0;
  const avgDelta=prevAvgKmSess>0?Math.round((avgKmSess-prevAvgKmSess)/prevAvgKmSess*100):null;
  const periodSess=sessBetween(cur[0],cur[1]);
  const byType={}; periodSess.forEach(s=>{ const ty=s.type||s.baseType||(s.tonnage?'Muscu':'Autre'); byType[ty]=(byType[ty]||0)+1; });
  const typeSegs=Object.entries(byType).map(([ty,ct])=>({v:ct,color:'var('+(TYPE_COLORS[ty]||'--e')+')',ty,ct}));
  if(!typeSegs.length) typeSegs.push({v:1,color:'rgba(255,255,255,.08)',ty:'—',ct:0});
  const bestI=bars.values.reduce((bi,v,i)=>v>bars.values[bi]?i:bi,0);
  const bestLab={week:'MEILLEUR JOUR',month:'MEILLEURE SEMAINE',['3m']:'MEILLEUR MOIS',year:'MEILLEUR MOIS'}[per];

  h+='<div class="kinsights-head">Insights</div>';
  h+='<div class="krow3">'+
    '<div class="ktile"><div class="ktile-lab">KM / SÉANCE</div><div class="ktile-val">'+avgKmSess.toFixed(1)+' km</div>'+
      (avgDelta!==null?'<div class="ktile-sub'+(avgDelta<0?' bad':'')+'">'+(avgDelta>0?'↑ ':avgDelta<0?'↓ ':'')+Math.abs(avgDelta)+'% vs préc.</div>':'<div class="ktile-sub" style="color:var(--muted)">—</div>')+
    '</div>'+
    '<div class="ktile" style="text-align:center"><div class="ktile-lab">TYPES DE SÉANCE</div>'+
      '<div class="ktile-donut">'+donutSVG(typeSegs,50,9,'')+'</div>'+
    '</div>'+
    '<div class="ktile"><span class="ktile-star">⭐</span><div class="ktile-lab">'+bestLab+'</div>'+
      '<div class="ktile-val">'+bars.labels[bestI]+'</div>'+
      '<div class="ktile-sub">'+bars.values[bestI].toFixed(1)+' km</div>'+
    '</div>'+
  '</div>';
  if(typeSegs[0].ty!=='—'){
    h+='<div class="card" style="margin-top:2px"><div class="card-t">'+cardIcon('chart','var(--e)')+'Détail par type</div>'+
      typeSegs.sort((a,b)=>b.ct-a.ct).map(s=>'<div class="row" style="gap:8px;margin-bottom:6px"><span class="zdot" style="background:'+s.color+'"></span><span style="flex:1;font-size:12.5px;font-weight:600">'+s.ty+'</span><span class="mono" style="font-size:12px;color:var(--muted)">'+s.ct+' · '+Math.round(s.ct/periodSess.length*100)+'%</span></div>').join('')+
    '</div>';
  }

  // 13 DERNIÈRES SEMAINES — heatmap, complément utile non présent chez Kalo
  h+='<div class="card"><div class="card-t">'+cardIcon('fire','var(--or)')+'13 dernières semaines</div><div class="heat">'+heatmap13()+'</div><div class="row" style="margin-top:10px;font-size:11px;color:var(--dim)"><span>Moins</span><span>Plus</span></div></div>';

  return h;
}
function heatmap13(){
  const cells=13*7; const start=new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate()-(cells-1));
  const map={}; [...SESS,...MSESS].forEach(s=>{ map[s.date]=(map[s.date]||0)+1; });
  let h='';
  for(let i=0;i<cells;i++){
    const d=new Date(start); d.setDate(start.getDate()+i); const c=map[dateKey(d)]||0;
    const op=c===0?0:Math.min(1,.3+c*.25);
    h+='<div style="background:'+(c?'rgba(var(--e-rgb),'+op+')':'var(--s2)')+'"></div>';
  }
  return h;
}
function statsRun(){
  const vdot=getUserVDOT();
  let h='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v">'+(vdot||'—')+'</div><div class="l">VDOT réel</div></div><div class="sbox"><div class="v">'+SESS.length+'</div><div class="l">Séances run</div></div><div class="sbox"><div class="v">'+totalKm().toFixed(0)+'</div><div class="l">km totaux</div></div><div class="sbox"><div class="v">'+(SESS.reduce((a,s)=>a+(s.duration||0),0)/60).toFixed(1)+'h</div><div class="l">Temps total</div></div></div>';
  // zones
  if(vdot){
    const zones=[['EF',.70,'--ok'],['Tempo',.83,'--warn'],['Seuil',.88,'--or'],['VMA',.97,'--bad'],['Sprint',1.05,'--maitre']];
    h+='<div class="card"><div class="card-t">🎯 Zones d\u2019allure</div>';
    zones.forEach(z=>{ h+='<div class="zrow"><span class="zdot" style="background:var('+z[2]+')"></span><span class="zname">'+z[0]+'</span><span class="zval">'+spkToStr(paceFromPct(vdot,z[1]))+' /km</span></div>'; });
    h+='</div>';
    // predictions
    const dists=[['1500m',1500],['3000m',3000],['5000m',5000],['10km',10000],['Semi',21097],['Marathon',42195]];
    h+='<div class="card"><div class="card-t">🔮 Prédictions</div>';
    dists.forEach(d=>{ h+='<div class="zrow"><span class="zname">'+d[0]+'</span><span class="zval mono" style="color:var(--snow)">'+fmtTime(predictTime(vdot,d[1]))+'</span></div>'; });
    h+='</div>';
    // form/fatigue SVG
    h+='<div class="card"><div class="card-t">📈 Forme / Fatigue</div>'+formChart()+'</div>';
  }
  // records
  h+='<div class="card"><div class="card-t">🏅 Records personnels</div>'+
    [['5000m',P.pb5k],['3000m',P.pb3k],['1500m',P.pb1500],['10km',P.pb10k]].map(r=>'<div class="zrow"><span class="zname">'+r[0]+'</span><span class="zval mono" style="color:var(--snow)">'+(r[1]||'—')+'</span></div>').join('')+'</div>';
  return h;
}
function formChart(){
  // CTL (Chronique, 42j) vs ATL (Aiguë, 7j) — charge d'entraînement réelle basée sur km/RPE et tonnage
  const days=42; 
  const end=new Date(); end.setHours(0,0,0,0);
  const load={}; SESS.forEach(s=>{ load[s.date]=(load[s.date]||0)+(s.km||0)*(s.rpe||5); });
  MSESS.forEach(s=>{ load[s.date]=(load[s.date]||0)+(s.tonnage||0)/100; });
  let ctl=0,atl=0; const ctlA=[],atlA=[];
  for(let i=days-1;i>=0;i--){ const d=new Date(end); d.setDate(end.getDate()-i); const l=load[dateKey(d)]||0;
    ctl=ctl+(l-ctl)/42; atl=atl+(l-atl)/7; ctlA.push(ctl); atlA.push(atl); }
  const max=Math.max(1,...ctlA,...atlA);
  const W=320,H=110;
  const pt=(a,i)=>(i/(days-1)*W).toFixed(1)+' '+(H-a[i]/max*H).toFixed(1);
  const path=a=>a.map((v,i)=>(i===0?'M':'L')+pt(a,i)).join(' ');
  const area=a=>'M0 '+H+' '+a.map((v,i)=>'L'+pt(a,i)).join(' ')+' L'+W+' '+H+' Z';
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:110px">'+
    '<path d="'+area(ctlA)+'" fill="var(--e)" opacity=".08"/>'+
    '<path d="'+path(ctlA)+'" fill="none" stroke="var(--e)" stroke-width="2.5" stroke-linecap="round"/>'+
    '<path d="'+path(atlA)+'" fill="none" stroke="var(--maitre)" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 5"/>'+
    '</svg>'+
    '<div class="row" style="margin-top:10px;font-size:11.5px;gap:14px;justify-content:flex-start">'+
    '<span style="display:flex;align-items:center;gap:5px"><span class="zdot" style="background:var(--e)"></span>Chronique</span>'+
    '<span style="display:flex;align-items:center;gap:5px"><span class="zdot" style="background:var(--maitre)"></span>Aiguë</span></div>';
}
function statsMuscu(){
  const pr=MSESS.reduce((a,s)=>Math.max(a,s.tonnage||0),0);
  let h='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v">'+MSESS.length+'</div><div class="l">Séances</div></div><div class="sbox"><div class="v">'+(totalTonnage()/1000).toFixed(1)+'t</div><div class="l">Tonnage</div></div><div class="sbox"><div class="v">'+Math.round(pr)+'</div><div class="l">PR (kg/séance)</div></div><div class="sbox"><div class="v">'+MSESS.reduce((a,s)=>a+(s.sets||0),0)+'</div><div class="l">Séries totales</div></div></div>';
  if(!MSESS.length) h+='<div class="card"><div class="empty"><div class="em-ic">🏋️</div><div style="font-size:13px">Lance ta première séance de muscu !</div></div></div>';
  else h+='<div class="card"><div class="card-t">📅 Dernières séances</div>'+MSESS.slice(-6).reverse().map(s=>'<div class="zrow"><div><div class="zname">'+s.progName+'</div><div style="font-size:11px;color:var(--dim)">'+fmtDate(s.date)+'</div></div><span class="zval mono">'+Math.round(s.tonnage)+' kg</span></div>').join('')+'</div>';
  return h;
}
/* ============ BADGES TROPHÉES (Accomplissement / Performance / Spécial) ============
   21 badges nommés, distincts des paliers de niveau ci-dessus. Débloqués
   automatiquement quand c'est mesurable dans les données réelles ; sinon
   à cocher soi-même (podium en compétition, dénivelé, VO2max amélioré...). */
const ACHIEVEMENTS=[
  {key:'premiere',    name:'Première course',  img:'premiere.png',    cat:'Accomplissement', desc:'Termine ta première séance.',           auto:()=>SESS.length+MSESS.length>=1},
  {key:'cinqk',       name:'5K',                img:'cinqk.png',       cat:'Accomplissement', desc:'Cours 5 km d\u2019une traite.',          auto:()=>SESS.some(s=>s.km>=5)},
  {key:'dixk',        name:'10K',               img:'dixk.png',        cat:'Accomplissement', desc:'Cours 10 km d\u2019une traite.',         auto:()=>SESS.some(s=>s.km>=10)},
  {key:'record',      name:'Record personnel',  img:'record.png',      cat:'Accomplissement', desc:'Bats un de tes records personnels.',     auto:()=>personalRecords().some(r=>r.time)},
  {key:'serie',       name:'Série',             img:'serie.png',       cat:'Accomplissement', desc:'7 jours d\u2019affilée.',                auto:()=>bestStreak()>=7},
  {key:'regularite',  name:'Régularité',        img:'regularite.png',  cat:'Accomplissement', desc:'30 jours actifs (cumulés).',             auto:()=>(SESS.length+MSESS.length)>=30},
  {key:'denivele',    name:'Dénivelé',          img:'denivele.png',    cat:'Accomplissement', desc:'1000 m D+ cumulés en course.',           manual:true},
  {key:'podium',      name:'Podium',            img:'podium.png',      cat:'Accomplissement', desc:'Finis dans le top 3 d\u2019une course officielle.', manual:true},
  {key:'discipline',  name:'Discipline',        img:'discipline.png',  cat:'Accomplissement', desc:'90 jours actifs (cumulés).',             auto:()=>(SESS.length+MSESS.length)>=90},
  {key:'objectif',    name:'Objectif atteint',  img:'objectif.png',    cat:'Accomplissement', desc:'Termine ton objectif principal.',        auto:()=>(XP.plansCompleted||0)>=1},
  {key:'nouveaupb',   name:'Nouveau PB',        img:'nouveaupb.png',   cat:'Performance',      desc:'Nouveau record personnel dans les 60 derniers jours.', auto:()=>RECORDS.some(r=>r.date&&daysBetween(new Date(r.date),new Date())<=60)},
  {key:'allure',      name:'Allure',            img:'allure.png',      cat:'Performance',      desc:'Allure moyenne améliorée.',              manual:true},
  {key:'endurance',   name:'Endurance',         img:'endurance.png',   cat:'Performance',      desc:'Termine une sortie de 90 min ou plus.',  auto:()=>SESS.some(s=>s.duration>=90)},
  {key:'puissance',   name:'Puissance',         img:'puissance.png',   cat:'Performance',      desc:'10 séances de musculation effectuées.',  auto:()=>MSESS.length>=10},
  {key:'vo2max',      name:'VO2 Max',           img:'vo2max.png',      cat:'Performance',      desc:'Améliore ton VO\u2082max estimé.',       manual:true},
  {key:'force',       name:'Force',             img:'force.png',       cat:'Performance',      desc:'Termine une séance de musculation.',     auto:()=>MSESS.length>=1},
  {key:'recuperation',name:'Récupération',      img:'recuperation.png',cat:'Performance',      desc:'Sommeil optimal 7 jours d\u2019affilée.',manual:true},
  {key:'leader',      name:'Leader',            img:null,              cat:'Spécial',          desc:'Top du classement (à venir).',           manual:true},
  {key:'ambassadeur', name:'Ambassadeur',       img:null,              cat:'Spécial',          desc:'Membre premium (à venir).',              manual:true},
  {key:'evenement',   name:'Événement',         img:null,              cat:'Spécial',          desc:'Participe à un événement IKORUN.',       manual:true},
  {key:'fondateur',   name:'Fondateur',         img:null,              cat:'Spécial',          desc:'Membre fondateur de IKORUN.',            auto:()=>true}
];
function manualBadges(){ return DB.load('manual_badges')||{}; }
function achievementUnlocked(a){ return a.auto ? !!a.auto() : !!manualBadges()[a.key]; }
function toggleManualBadge(key){
  const a=ACHIEVEMENTS.find(x=>x.key===key); if(!a||!a.manual) return;
  const m=manualBadges(); m[key]=!m[key]; DB.save('manual_badges',m);
  toast(m[key]?'🏵️ '+a.name+' débloqué !':'Badge retiré');
  renderStats();
}
function achImgErr(img){ const span=document.createElement('span'); span.className='bd-glyph bd-emoji'; span.textContent='🏵️'; img.replaceWith(span); }
function achImg(a){
  if(!a.img) return '<span class="bd-emoji">🏵️</span>';
  return '<img class="bd-glyph" src="'+a.img+'" alt="" draggable="false" loading="lazy" onerror="achImgErr(this)">';
}
function achievementsGridHTML(){
  const cats=['Accomplissement','Performance','Spécial'];
  const unlockedCount=ACHIEVEMENTS.filter(achievementUnlocked).length;
  let h='<div class="card" style="margin-top:18px"><div class="row" style="margin-bottom:6px"><span class="card-t" style="margin:0">🏵️ Badges</span><span style="font-size:12px;color:var(--muted)">'+unlockedCount+' / '+ACHIEVEMENTS.length+'</span></div>'
    +'<div style="font-size:11px;color:var(--dim);margin-bottom:8px">Ceux détectés automatiquement se débloquent seuls · les autres (podium, dénivelé...) se cochent à la main.</div>';
  cats.forEach(cat=>{
    const items=ACHIEVEMENTS.filter(a=>a.cat===cat);
    if(!items.length) return;
    h+='<div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.5px;margin:14px 0 8px">'+cat.toUpperCase()+'</div><div class="bd-grid">';
    items.forEach(a=>{
      const on=achievementUnlocked(a);
      h+='<div class="bd-cell" onclick="'+(a.manual?"toggleManualBadge('"+a.key+"')":"toast('"+a.desc.replace(/'/g,"\\'")+"')")+'">'
        +'<div class="bd-icon'+(on?'':' locked')+'" style="background:rgba(255,255,255,.04)">'+achImg(a)+(on?'':'<div class="bd-lock-chip">🔒</div>')+'</div>'
        +'<div class="bd-name">'+a.name+'</div></div>';
    });
    h+='</div>';
  });
  h+='</div>';
  return h;
}
/* ---------- MEDALS ---------- */
const TIERS=[['Bronze','--bronze'],['Argent','--argent'],['Or','--or'],['Platine','--platine'],['Diamant','--diamant'],['Maître','--maitre'],['Légende','--legende']];
const MEDAL_CATS=[
  {name:'Séances',icon:'🎽',val:()=>totalSessions(),thr:[10,25,50,100,200,350,500]},
  {name:'Régularité',icon:'🔥',val:()=>streakDays(),thr:[3,7,14,30,60,100,180],unit:'j'},
  {name:'Distance',icon:'🛣️',val:()=>totalKm(),thr:[25,50,100,250,500,1000,2000],unit:'km'}
];
function statsMedals(){
  let total=0;
  MEDAL_CATS.forEach(c=>{ const v=c.val(); c.thr.forEach(t=>{ if(v>=t) total++; }); });
  let h='<div class="card" style="text-align:center"><div class="man" style="font-weight:800;font-size:32px;color:var(--or)">'+total+'</div><div class="lab">médailles débloquées / 21</div></div>';
  MEDAL_CATS.forEach(c=>{
    const v=Math.floor(c.val());
    let tierIdx=-1; c.thr.forEach((t,i)=>{ if(v>=t)tierIdx=i; });
    const cur=tierIdx>=0?TIERS[tierIdx]:null;
    const next=tierIdx<6?c.thr[tierIdx+1]:null;
    const prevT=tierIdx>=0?c.thr[tierIdx]:0;
    const pct=next?Math.min(100,((v-prevT)/(next-prevT))*100):100;
    h+='<div class="card"><div class="row"><div class="row" style="gap:10px"><span style="font-size:26px">'+c.icon+'</span><div><div style="font-weight:700">'+c.name+'</div><div class="mono" style="font-size:12px;'+(cur?'color:var('+cur[1]+')':'color:var(--dim)')+'">'+(cur?cur[0]:'Aucun palier')+'</div></div></div><div class="mono" style="font-weight:700">'+v+(c.unit||'')+'</div></div>';
    // pips
    h+='<div class="row" style="gap:4px;margin:12px 0">';
    c.thr.forEach((t,i)=>{ const ok=v>=t; h+='<div style="flex:1;height:6px;border-radius:3px;background:'+(ok?'var('+TIERS[i][1]+')':'var(--s2)')+'"></div>'; });
    h+='</div>';
    if(next) h+='<div class="pbar"><div style="width:'+pct+'%"></div></div><div style="font-size:11px;color:var(--muted);margin-top:6px">Prochain : '+next+(c.unit||'')+' ('+TIERS[tierIdx+1][0]+')</div>';
    else h+='<div style="font-size:11px;color:var(--legende)">🏆 Palier maximal atteint !</div>';
    h+='</div>';
  });
  h+=achievementsGridHTML();
  return h;
}

/* ---------- ICÔNES PREMIUM (SVG line, mode sombre) ---------- */
const ICONS={
  lab:'<path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3"/><path d="M8 15h8"/>',
  health:'<path d="M3 12h4l2 5 4-12 2 7h6"/>',
  stopwatch:'<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9 2h6M18 6l1.5-1.5"/>',
  convert:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  note:'<path d="M5 3h11l4 4v14H5zM15 3v5h5"/><path d="M9 12h6M9 16h6"/>',
  lung:'<path d="M12 4v8M8 12c0-2-3-2-4 1s0 6 2 6 2-3 2-5zM16 12c0-2 3-2 4 1s0 6-2 6-2-3-2-5z"/>',
  scale:'<path d="M4 7h16M12 7V4M6 7l-2 7a4 4 0 0 0 8 0l-2-7M18 7l-2 7a4 4 0 0 0 8 0l-2-7" transform="translate(-2 0)"/>',
  water:'<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  fire:'<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 2 2 2 0 0-2 0-3 0-4z"/>',
  run:'<circle cx="13" cy="4" r="2"/><path d="M5 21l3-6 4-2-2-5M12 8l4 2 2 4M7 12l-2 3"/>',
  timer:'<circle cx="12" cy="13" r="8"/><path d="M12 13V9"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>',
  star:'<path d="M12 3l2.5 6 6.5.5-5 4 1.7 6.5L12 16l-5.7 4 1.7-6.5-5-4 6.5-.5z"/>',
  bell:'<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 0 0 4 0"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  mosque:'<path d="M4 21V11a8 8 0 0 1 16 0v10M12 3c-1.5 1-1.5 3 0 4M9 21v-4a3 3 0 0 1 6 0v4"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  check:'<path d="M5 13l4 4L19 7"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5" fill="currentColor"/>',
  bolt:'<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/>',
  medal:'<circle cx="12" cy="15" r="6"/><path d="M9 10 6 3M15 10l3-7M9.5 13.5 12 16l2.5-2.5"/>',
  chevronR:'<path d="M9 5l7 7-7 7"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
  edit:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  pin:'<path d="M12 21s7-6.5 7-11.5A7 7 0 0 0 5 9.5C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
  heart:'<path d="M12 21s-7.5-5-10-9.5C.5 7.5 3 3.5 7 3.5c2 0 4 1.2 5 3 1-1.8 3-3 5-3 4 0 6.5 4 5 8-2.5 4.5-10 9.5-10 9.5z"/>',
  lock:'<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play:'<path d="M7 4l14 8-14 8V4z"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>'
};
function ICN(name,size,color){ const s=size||22; return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="'+(color||'currentColor')+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||'')+'</svg>'; }
/* colored rounded-square icon badge used in card headers, replaces flat emoji */
function cardIcon(name,color){ color=color||'var(--e)'; return '<span class="icb" style="background:linear-gradient(145deg,'+color+'22,'+color+'0d);box-shadow:0 0 0 1px '+color+'33 inset,0 4px 10px -4px '+color+'55;color:'+color+'">'+ICN(name,15,color)+'</span>'; }

/* ---------- BADGE CRESTS (SVG sur-mesure, remplace les emojis) ----------
   Inspiré des rangs Rocket League : un écusson qui gagne des ailes et des
   ornements (étoile, laurier, gemme, couronne) au fil des paliers. */
function _bdWing(side,count){
  if(count<=0) return '';
  let out='<g transform="scale('+side+',1)">';
  for(let i=0;i<count;i++){
    const y=24+i*5, len=14+i*3;
    out+='<path d="M32 '+y+' Q'+(32+len*0.6)+' '+(y-4)+' '+(32+len)+' '+(y+2)+'" stroke="rgba(255,255,255,.85)" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
  }
  return out+'</g>';
}
function _bdStar(cx,cy,r,fill){
  let pts=[];
  for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5, rad=i%2===0?r:r*0.42;
    pts.push((cx+Math.cos(a)*rad).toFixed(1)+','+(cy+Math.sin(a)*rad).toFixed(1)); }
  return '<polygon points="'+pts.join(' ')+'" fill="'+fill+'"/>';
}
function _bdLaurel(side){
  let out='<g transform="scale('+side+',1)">';
  for(let i=0;i<3;i++){ const y=38+i*6, x=16+i*2;
    out+='<ellipse cx="'+x+'" cy="'+y+'" rx="4" ry="2.2" fill="rgba(255,255,255,.7)" transform="rotate(-25 '+x+' '+y+')"/>'; }
  return out+'</g>';
}
function _bdShield(){ return '<path d="M32 6 L52 13 L52 30 Q52 46 32 58 Q12 46 12 30 L12 13 Z" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.9)" stroke-width="2"/>'; }
/* Aile-plume unique : part du centre bas, s'évase vers l'extérieur-haut.
   idx=position de la plume dans l'aile (0=intérieure), total=nb de plumes. */
function _bdPlume(mirror,idx,total,op){
  const t=total<=1?0:idx/(total-1);
  const spread=10+t*20, rise=10+t*26, w=4+t*3;
  const bx=3+idx*0.6, by=46-idx*1.6;
  const tipX=bx+spread, tipY=by-rise;
  const ctrlX=bx+spread*0.55, ctrlY=by-rise*0.65;
  return '<g transform="scale('+mirror+',1)"><path d="M'+bx+' '+by+
    ' Q'+ctrlX+' '+(ctrlY-2)+' '+tipX+' '+tipY+
    ' Q'+(ctrlX-2)+' '+(ctrlY+3)+' '+(bx-1)+' '+(by-3)+' Z" '+
    'fill="rgba(255,255,255,'+op+')"/></g>';
}
function _bdWings(count){
  let out='';
  for(let i=0;i<count;i++){
    const op=(0.32+ (i/(Math.max(1,count-1)))*0.55).toFixed(2);
    out+=_bdPlume(1,i,count,op)+_bdPlume(-1,i,count,op);
  }
  return out;
}
/* Gemme centrale (losange) — grossit avec le prestige du palier */
function _bdGem(cy,r){
  return '<polygon points="32,'+(cy-r)+' '+(32+r*0.68).toFixed(1)+','+cy+' 32,'+(cy+r)+' '+(32-r*0.68).toFixed(1)+','+cy+
    '" fill="rgba(255,255,255,.95)" stroke="rgba(255,255,255,.55)" stroke-width="0.8"/>'+
    '<line x1="32" y1="'+(cy-r)+'" x2="32" y2="'+(cy+r)+'" stroke="rgba(255,255,255,.35)" stroke-width="0.6"/>';
}
/* Couronne — réservée au tout dernier palier */
function _bdCrown(){
  return '<path d="M18 16 L22.5 24 L32 12 L41.5 24 L46 16 L43.5 26 L20.5 26 Z" fill="rgba(255,255,255,.95)"/>'+
    '<circle cx="18" cy="15" r="2.2" fill="rgba(255,255,255,.95)"/><circle cx="32" cy="11" r="2.6" fill="rgba(255,255,255,.95)"/><circle cx="46" cy="15" r="2.2" fill="rgba(255,255,255,.95)"/>';
}
const BADGE_GLYPHS={
  initie:      _bdWings(2)+_bdGem(36,3.6),
  discipline:  _bdWings(3)+_bdGem(35,4.4),
  perseverant: _bdWings(4)+_bdGem(34,5),
  determine:   _bdWings(4)+_bdGem(33,5.6),
  avance:      _bdWings(5)+_bdGem(32,6.2),
  elite:       _bdWings(5)+_bdGem(31,6.8),
  exceptionnel:_bdWings(6)+_bdGem(30,7.4),
  legendaire:  _bdWings(6)+_bdGem(30,8),
  ultime:      _bdWings(7)+_bdGem(29,8.6),
  iconique:    _bdWings(8)+_bdGem(30,9)+_bdCrown()
};
const BADGE_IMG_FILES={
  debutant:'debutant.png',
  amateur:'amateur.png',
  sportif:'sportif.png',
  athlete:'athlete.png',
  expert:'expert.png',
  elite:'elite.png',
  maitre:'maitre.png',
  legende:'legende.png'
};
function bdGlyph(key){
  const src=BADGE_IMG_FILES[key];
  if(!src) return '<span class="bd-emoji">'+badgeEmoji(key)+'</span>';
  return '<img class="bd-glyph" src="'+src+'" alt="" draggable="false" loading="lazy" data-key="'+key+'" data-stage="0" onerror="bdImgErr(this)">';
}
function badgeEmoji(key){ const b=BADGE_TIERS.find(x=>x.key===key); return b?b.emoji:'🏅'; }
function bdImgErr(img){
  const key=img.dataset.key; const stage=+img.dataset.stage;
  // Étape 0 → on retente dans un sous-dossier badges/, au cas où les PNG
  // seraient rangés là plutôt qu'à la racine du site.
  if(stage===0){ img.dataset.stage='1'; img.src='badges/'+BADGE_IMG_FILES[key]; return; }
  // Étape 1 échouée aussi → on bascule sur l'emoji, plus aucune requête réseau.
  const span=document.createElement('span'); span.className='bd-glyph bd-emoji'; span.textContent=badgeEmoji(key);
  img.replaceWith(span);
}

/* ---------- OUTILS — HUB ÉPURÉ ---------- */
let outilsTab='home';
const TOOLS={
  aio:{name:'Performance Lab',sub:'Distance · Temps · Allure · Vitesse',icon:ICN('lab'),fn:'renderAIO'},
  sante:{name:'Tableau de bord Santé',sub:'Poids, IMC, sommeil, nutrition...',icon:ICN('health'),fn:'renderSanteTool'},
  chrono:{name:'Chronomètre',sub:'Tours, splits & statistiques',icon:ICN('stopwatch'),fn:'renderChrono'},
  convert:{name:'Convertisseur',sub:'Allure, distance, poids...',icon:ICN('convert'),fn:'renderConvertTool'},
  notes:{name:'Notes',sub:'Bloc-notes rapide',icon:ICN('note'),fn:'renderNotesTool'},
  // accessibles via recherche
  vdot:{name:'VDOT & VO₂max',sub:'Estimer ta cylindrée',icon:ICN('lung'),fn:'renderVDOTtool'},
  imc:{name:'IMC',sub:'Indice de masse corporelle',icon:ICN('scale'),fn:'renderIMC'},
  hydra:{name:'Hydratation',sub:'Tes besoins en eau',icon:ICN('water'),fn:'renderHydraTool'},
  bmr:{name:'Calories & Métabolisme',sub:'Besoins quotidiens',icon:ICN('fire'),fn:'renderBMRtool'},
  agenda:{name:'Agenda',sub:'Tous vos événements',icon:ICN('calendar'),fn:'renderAgenda',hidden:true},
  priere:{name:'Prières',sub:'Tous les horaires',icon:ICN('mosque'),fn:'renderPriere',hidden:true}
};
const MAIN_TOOLS=['aio','sante','chrono'];
const OTHER_TOOLS=['convert','notes'];
function toolFav(){ return PREFS.favTools||['aio','sante','chrono','convert']; }
function toggleFav(k){ let f=toolFav(); f=f.includes(k)?f.filter(x=>x!==k):[...f,k]; PREFS.favTools=f; saveAll(); renderOutils(); }
let toolSearch='';
function recentTools(){ return PREFS.recentTools||[]; }
function pushRecent(k){ let r=recentTools().filter(x=>x!==k); r.unshift(k); PREFS.recentTools=r.slice(0,4); saveAll(); }
function openTool(k){ pushRecent(k); outilsTab=k; renderOutils(); }
function renderOutils(){
  let h='';
  if(outilsTab==='home'){ h=outilsHome(); $('#s-outils').innerHTML=h; bindToolSearch(); return; }
  if(outilsTab==='_timer'){ renderOutilsTimer(); return; }
  const t=TOOLS[outilsTab]; if(!t){ outilsTab='home'; return renderOutils(); }
  h='<div class="row" style="margin-bottom:14px"><button class="x" onclick="outilsBack()">‹</button><div class="man" style="font-weight:800;font-size:17px;flex:1;text-align:center;margin:0 8px">'+t.name+'</div><button class="x" onclick="toggleFav(\''+outilsTab+'\')" style="color:'+(toolFav().includes(outilsTab)?'var(--or)':'var(--dim)')+'">★</button></div><div id="outBody"></div>';
  $('#s-outils').innerHTML=h;
  window[t.fn] && window[t.fn]();
}
let outilsFrom='home';
function outilsBack(){ outilsTab=outilsFrom||'home'; outilsFrom='home'; renderOutils(); }
function openTool(k){ pushRecent(k); outilsFrom=outilsTab; outilsTab=k; renderOutils(); $('#scroll').scrollTop=0; }
function bindToolSearch(){ const si=$('#toolSearchInp'); if(si){ si.oninput=()=>{ toolSearch=si.value; $('#s-outils').innerHTML=outilsHome(); bindToolSearch(); const el=$('#toolSearchInp'); el.focus(); el.setSelectionRange(toolSearch.length,toolSearch.length); }; } }
// VDOT badge réutilisable
function vdotBadge(){ const v=getUserVDOT()||'—'; return '<div onclick="openTool(\'vdot\')" style="width:54px;height:54px;border-radius:50%;border:2px solid var(--e);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;background:var(--ed)"><div class="mono" style="font-weight:800;font-size:15px;color:var(--e);line-height:1">'+v+'</div><div style="font-size:7px;color:var(--muted);letter-spacing:.5px">VDOT</div></div>'; }
function outilsHome(){
  let h='<div class="row" style="margin:2px 0 14px;justify-content:flex-end">'+vdotBadge()+'</div>';
  // Raccourcis rapides Chrono + Minuteur
  h+='<div style="display:flex;gap:10px;margin-bottom:16px"><div class="card" style="flex:1;padding:14px;margin:0;cursor:pointer;text-align:center" onclick="openTool(\'chrono\')"><div style="color:var(--e);display:flex;justify-content:center">'+ICN('stopwatch',26)+'</div><div style="font-weight:700;font-size:13px;margin-top:6px">Chronomètre</div></div><div class="card" style="flex:1;padding:14px;margin:0;cursor:pointer;text-align:center" onclick="openQuickTimer()"><div style="color:var(--warn);display:flex;justify-content:center">'+ICN('timer',26)+'</div><div style="font-weight:700;font-size:13px;margin-top:6px">Minuteur</div></div></div>';
  h+='<div class="searchbox"><span class="searchic">'+ICN('search',18,'var(--muted)')+'</span><input class="inp" id="toolSearchInp" style="padding-left:42px" placeholder="Rechercher un outil..." value="'+toolSearch+'"></div>';
  const q=toolSearch.toLowerCase().trim();
  if(q){
    const res=Object.entries(TOOLS).filter(([k,t])=>t.name.toLowerCase().includes(q));
    h+='<div class="lab" style="margin:14px 0 10px">'+res.length+' résultat(s)</div>';
    res.forEach(([k,t])=>{ h+=toolRow(k,t); });
    return h;
  }
  // FAVORIS
  const favs=toolFav().filter(k=>TOOLS[k]);
  h+='<div class="row" style="margin:18px 0 10px"><span class="lab">Favoris</span><span style="font-size:12px;color:var(--e);cursor:pointer" onclick="editFavs()">Modifier</span></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:22px">';
  favs.slice(0,8).forEach(k=>{ const t=TOOLS[k]; h+='<div class="favtile" onclick="openTool(\''+k+'\')"><div style="color:var(--e);display:flex;justify-content:center">'+t.icon+'</div><div class="favlab">'+favShort(t.name)+'</div></div>'; });
  h+='</div>';
  // OUTILS PRINCIPAUX
  h+='<div class="lab" style="margin:0 0 12px">Outils principaux</div>';
  MAIN_TOOLS.forEach(k=>{ const t=TOOLS[k];
    h+='<div class="list-row" onclick="openTool(\''+k+'\')"><div class="lr-icon">'+t.icon+'</div><div class="lr-txt"><div class="lr-title">'+t.name+'</div><div class="lr-sub">'+t.sub+'</div></div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>';
  });
  // AUTRES OUTILS
  h+='<div class="lab" style="margin:18px 0 12px">Autres outils</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px">';
  OTHER_TOOLS.forEach(k=>{ const t=TOOLS[k]; h+='<div class="favtile" style="padding:12px 4px" onclick="openTool(\''+k+'\')"><div style="color:var(--e);display:flex;justify-content:center">'+t.icon+'</div><div class="favlab">'+favShort(t.name)+'</div></div>'; });
  h+='</div>';
  return h;
}
function favShort(n){ const m={'Performance Lab':'Perf. Lab','Tableau de bord Santé':'Santé','Chronomètre':'Chrono','Convertisseur':'Convert.','VDOT & VO₂max':'VDOT','Calories & Métabolisme':'Calories','Hydratation':'Eau'}; return m[n]||n; }
function editFavs(){
  let h='<div class="tip" style="margin-bottom:14px">Touche une étoile pour ajouter/retirer un outil de tes favoris.</div>';
  Object.entries(TOOLS).forEach(([k,t])=>{ h+=toolRow(k,t); });
  $('#settingsBody').innerHTML=h; $('#ovSettings').querySelector('h2').textContent='Modifier les favoris'; openOv('ovSettings');
}
function toolRow(k,t){ const fav=toolFav().includes(k);
  return '<div class="list-row"><div class="lr-icon" style="cursor:pointer" onclick="openTool(\''+k+'\')">'+t.icon+'</div><div class="lr-txt" style="cursor:pointer" onclick="openTool(\''+k+'\')"><div class="lr-title">'+t.name+'</div>'+(t.sub?'<div class="lr-sub">'+t.sub+'</div>':'')+'</div><span onclick="event.stopPropagation();toggleFav(\''+k+'\')" style="color:'+(fav?'var(--or)':'var(--dim)')+';font-size:17px;cursor:pointer;padding:4px">★</span></div>'; }
function openQuickTimer(){ outilsFrom='home'; outilsTab='_timer'; renderOutilsTimer(); }
function renderOutilsTimer(){ $('#s-outils').innerHTML='<div class="row" style="margin-bottom:14px"><button class="x" onclick="outilsTab=\'home\';renderOutils()">‹</button><div class="man" style="font-weight:800;font-size:17px;flex:1;text-align:center">Minuteur</div><div style="width:34px"></div></div><div id="outBody"></div>'; renderTimer(); }

/* ============ TABLEAU DE BORD SANTÉ ============ */
function renderSanteTool(){
  const w=P.weight||62, ht=P.height||175;
  const imc=w/Math.pow(ht/100,2);
  let imcCat,imcCol; if(imc<18.5){imcCat='Maigreur';imcCol='--warn';}else if(imc<25){imcCat='Normal';imcCol='--ok';}else if(imc<30){imcCat='Surpoids';imcCol='--warn';}else{imcCat='Obésité';imcCol='--bad';}
  // dernier log santé / sommeil depuis SESSLOG (debriefs)
  const lastLog=SESSLOG[SESSLOG.length-1]||{};
  const bmr=Math.round((P.sex==='Femme')?(10*w+6.25*ht-5*(age()||25)-161):(10*w+6.25*ht-5*(age()||25)+5));
  const burned=SESS.slice(-7).reduce((a,s)=>a+(s.km||0)*0.9*w/1000*1000,0); // approx kcal 7j run
  const freq=runCountWeek()+muscuCountWeek();
  let h='';
  // POIDS
  const last=WEIGHTLOG[WEIGHTLOG.length-1], prev=WEIGHTLOG[WEIGHTLOG.length-2];
  const trend=last&&prev?(last.w-prev.w):0;
  h+='<div class="card"><div class="row"><div class="card-t" style="margin:0">⚖️ Poids</div><span style="font-size:12px;color:var(--e);cursor:pointer" onclick="addWeight()">＋ Ajouter</span></div>';
  h+='<div class="row" style="align-items:flex-end;margin-top:8px"><div class="man" style="font-size:36px;font-weight:800">'+(last?last.w:w)+'<span style="font-size:16px;color:var(--muted)"> kg</span></div>'+(trend?'<span class="mono" style="margin-left:10px;color:'+(trend<0?'var(--ok)':'var(--warn)')+'">'+(trend>0?'▲ +':'▼ ')+trend.toFixed(1)+' kg</span>':'')+'</div>';
  if(WEIGHTLOG.length>=2) h+='<div style="margin-top:12px">'+weightSparkline()+'</div>';
  h+='</div>';
  // IMC
  h+='<div class="card"><div class="row"><div><div class="card-t" style="margin:0">📐 IMC</div><div class="man" style="font-size:28px;font-weight:800;margin-top:6px;color:var('+imcCol+')">'+imc.toFixed(1)+'</div></div><div class="badge" style="background:var(--ed);color:var('+imcCol+')">'+imcCat+'</div></div>'+
    '<div class="pbar" style="margin-top:12px"><div style="width:'+Math.min(100,(imc/40)*100)+'%;background:var('+imcCol+')"></div></div></div>';
  // INDICATEURS — grille
  h+='<div class="sgrid" style="margin-bottom:14px">';
  h+='<div class="sbox"><div class="v" style="color:var(--e)">'+freq+'</div><div class="l">Séances / sem</div></div>';
  h+='<div class="sbox"><div class="v" style="color:var(--or)">'+bmr+'</div><div class="l">Métabolisme kcal</div></div>';
  h+='<div class="sbox"><div class="v" style="color:var(--bad)">'+Math.round(burned)+'</div><div class="l">Brûlées 7j (run)</div></div>';
  h+='<div class="sbox"><div class="v" style="color:var(--platine)">'+Math.round(w*35/100)/10+'L</div><div class="l">Eau / jour</div></div>';
  h+='</div>';
  // SOMMEIL / FATIGUE / RÉCUP (depuis derniers debriefs)
  const recent=SESSLOG.slice(-7);
  if(recent.length){
    const avg=(f)=>recent.reduce((a,x)=>a+(x[f]||0),0)/recent.length;
    const sleep=avg('sleep'),fatigue=avg('fatigue'),feel=avg('feel');
    h+='<div class="card"><div class="card-t">😴 Forme récente (7 dernières séances)</div>';
    h+=santeBar('Sommeil',sleep,5,'--platine');
    h+=santeBar('Énergie / sensations',feel,5,'--ok');
    h+=santeBar('Fatigue',fatigue,5,'--warn');
    // conseil intelligent
    let tip='Tout est équilibré, continue ainsi ! 💪';
    if(fatigue>=4) tip='⚠️ Fatigue élevée : privilégie le repos et le sommeil cette semaine.';
    else if(sleep<=2.5) tip='😴 Ton sommeil est insuffisant : vise 8h pour mieux récupérer.';
    else if(feel>=4) tip='🔥 Excellentes sensations : tu peux pousser un peu plus !';
    h+='<div class="tip" style="margin-top:12px">'+tip+'</div></div>';
  } else {
    h+='<div class="card"><div class="empty"><div class="em-ic">📋</div><div style="font-size:13px">Termine des séances avec leur bilan pour suivre ton sommeil, ta fatigue et ta récupération ici.</div></div></div>';
  }
  // NUTRITION (rappel macros indicatifs)
  const prot=Math.round(w*1.8), carbs=Math.round(w*5), lip=Math.round(w*1);
  h+='<div class="card"><div class="card-t">🍽️ Repères nutrition (athlète)</div>';
  h+='<div class="sgrid"><div class="sbox"><div class="v" style="font-size:18px;color:var(--ok)">'+prot+'g</div><div class="l">Protéines</div></div><div class="sbox"><div class="v" style="font-size:18px;color:var(--or)">'+carbs+'g</div><div class="l">Glucides</div></div><div class="sbox"><div class="v" style="font-size:18px;color:var(--warn)">'+lip+'g</div><div class="l">Lipides</div></div><div class="sbox"><div class="v" style="font-size:18px">'+Math.round(prot*4+carbs*4+lip*9)+'</div><div class="l">kcal cible</div></div></div></div>';
  $('#outBody').innerHTML=h;
}
function santeBar(label,val,max,col){ const pct=Math.min(100,val/max*100); const ic=['😣','😕','😐','🙂','🤩'][Math.max(0,Math.min(4,Math.round(val)-1))]||'—';
  return '<div style="margin-bottom:10px"><div class="row" style="margin-bottom:4px"><span style="font-size:13px">'+label+'</span><span style="font-size:13px">'+(val?ic+' '+val.toFixed(1)+'/'+max:'—')+'</span></div><div class="pbar"><div style="width:'+pct+'%;background:var('+col+')"></div></div></div>'; }
function weightSparkline(){
  const data=WEIGHTLOG.slice(-14).map(x=>x.w); if(data.length<2)return'';
  const min=Math.min(...data),max=Math.max(...data),rng=(max-min)||1; const W=300,H=60;
  const pts=data.map((v,i)=>(i/(data.length-1)*W).toFixed(1)+','+(H-(v-min)/rng*H).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:60px"><polyline points="'+pts+'" fill="none" stroke="var(--e)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function addWeight(){ const cur=P.weight||62; const whole=Math.floor(cur),dec=Math.round((cur-whole)*10);
  openPicker({title:'Ton poids (kg)',cols:[{values:range(30,200),sel:Math.max(0,whole-30)},{values:range(0,9),sel:dec,unit:'kg'}],seps:['.'],onOk:idx=>{ const w=(idx[0]+30)+idx[1]/10; WEIGHTLOG.push({date:todayKey(),w}); P.weight=w; saveAll(); renderSanteTool(); toast('Poids enregistré ✓'); }}); }

/* ============ PERFORMANCE LAB — calculateur intelligent ============ */
/* 4 valeurs : distance (km), time (s), pace (s/km), speed (km/h).
   L'utilisateur saisit 2 valeurs → les 2 autres se calculent.
   On mémorise l'ordre des saisies (recent[]) pour savoir lesquelles fixer. */
let LAB={dist:null,time:null,pace:null,speed:null,recent:[]};
let labTab='resultats';
function labSet(field,val){
  LAB[field]=val;
  LAB.recent=[field,...LAB.recent.filter(f=>f!==field)].slice(0,2);
  computeLab();
  renderAIO();
}
function computeLab(){
  const r=LAB.recent;
  if(r.length<2) return;
  const has=f=>LAB[f]!=null&&!isNaN(LAB[f])&&LAB[f]>0;
  const [a,b]=r;
  const set2=new Set([a,b]);
  // pace <-> speed sont liés : si l'un est saisi, dérive l'autre
  if(has('pace')&&!set2.has('speed')) LAB.speed=3600/LAB.pace;
  if(has('speed')&&!set2.has('pace')) LAB.pace=3600/LAB.speed;
  // Résoudre selon les 2 connus
  if(set2.has('dist')&&set2.has('time')&&has('dist')&&has('time')){ LAB.pace=LAB.time/LAB.dist; LAB.speed=3600/LAB.pace; }
  else if(set2.has('dist')&&set2.has('pace')&&has('dist')&&has('pace')){ LAB.time=LAB.pace*LAB.dist; LAB.speed=3600/LAB.pace; }
  else if(set2.has('dist')&&set2.has('speed')&&has('dist')&&has('speed')){ LAB.pace=3600/LAB.speed; LAB.time=LAB.pace*LAB.dist; }
  else if(set2.has('time')&&set2.has('pace')&&has('time')&&has('pace')){ LAB.dist=LAB.time/LAB.pace; LAB.speed=3600/LAB.pace; }
  else if(set2.has('time')&&set2.has('speed')&&has('time')&&has('speed')){ LAB.pace=3600/LAB.speed; LAB.dist=LAB.time/LAB.pace; }
}
function renderAIO(){
  const computed=f=>LAB.recent.length>=2 && !LAB.recent.includes(f) && LAB[f]!=null;
  let h='<div class="tip" style="margin-bottom:16px">Saisis <b>2 valeurs</b> que tu connais. Les 2 autres se calculent automatiquement. ✨</div>';
  h+=labField('Distance','📍','dist',LAB.dist!=null?LAB.dist.toFixed(2)+' km':'—',computed('dist'));
  h+=labField('Temps','⏱️','time',LAB.time!=null?fmtTime(LAB.time):'—',computed('time'));
  h+=labField('Allure','🏃','pace',LAB.pace!=null?spkToStr(LAB.pace)+' /km':'—',computed('pace'));
  h+=labField('Vitesse','⚡','speed',LAB.speed!=null?LAB.speed.toFixed(2)+' km/h':'—',computed('speed'));
  h+='<button class="btn ghost" style="margin-top:10px" onclick="resetLab()">↺ Réinitialiser</button>';
  // Bonus : splits + prédictions si distance & pace connus
  if(LAB.dist&&LAB.pace&&LAB.dist>=1){
    h+='<div class="card-t" style="margin-top:20px">📍 Temps de passage</div>';
    const n=Math.min(Math.floor(LAB.dist),42);
    for(let k=1;k<=n;k++){ const hi=[5,10,21,42].includes(k); h+='<div class="zrow" style="padding:9px 0"><span class="zname" style="'+(hi?'color:var(--e)':'')+'">km '+k+(hi?' ⭐':'')+'</span><span class="zval mono">'+fmtTime(LAB.pace*k)+'</span></div>'; }
    if(LAB.dist%1>0.01) h+='<div class="zrow" style="padding:9px 0"><span class="zname">'+LAB.dist.toFixed(2)+' km</span><span class="zval mono">'+fmtTime(LAB.time)+'</span></div>';
  }
  $('#outBody').innerHTML=h;
}
function labField(label,icon,field,val,isComputed){
  const filled=LAB[field]!=null;
  return '<div class="card" style="padding:14px;margin-bottom:9px;cursor:pointer;'+(isComputed?'border-color:var(--e);background:var(--ed)':'')+'" onclick="editLab(\''+field+'\')"><div class="row"><div class="row" style="gap:11px"><span style="font-size:19px">'+icon+'</span><div><div style="font-size:11px;color:var(--muted)">'+label+(isComputed?' · calculé':filled?'':' · à saisir')+'</div><div class="mono" style="font-weight:700;font-size:19px;margin-top:2px;color:'+(isComputed?'var(--e)':'var(--snow)')+'">'+val+'</div></div></div><span style="color:var(--dim);font-size:15px">'+(isComputed?'':'✎')+'</span></div></div>';
}
function editLab(field){
  if(field==='dist') pickDistance('Distance',LAB.dist||10,v=>labSet('dist',v));
  else if(field==='time') pickTime('Temps',LAB.time||1800,v=>labSet('time',v));
  else if(field==='pace') pickPace('Allure',LAB.pace||270,v=>labSet('pace',v));
  else if(field==='speed') pickSpeed('Vitesse',LAB.speed||12,v=>labSet('speed',v));
}
function resetLab(){ LAB={dist:null,time:null,pace:null,speed:null,recent:[]}; renderAIO(); }

/* ----- Nouveaux outils ----- */
function renderVDOTtool(){
  const vdot=getUserVDOT();
  let h='<div class="card" style="text-align:center"><div class="man" style="font-size:48px;font-weight:800;color:var(--e)">'+(vdot||'—')+'</div><div class="lab">VDOT (Jack Daniels)</div></div>';
  if(vdot){ const vo2=(vdot).toFixed(1);
    h+='<div class="card"><div class="card-t">Estimations physiologiques</div>'+
      '<div class="zrow"><span class="zname">VO₂max estimé</span><span class="zval mono">'+vo2+' ml/kg/min</span></div>'+
      '<div class="zrow"><span class="zname">Allure seuil lactique</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.88))+'/km</span></div>'+
      '<div class="zrow"><span class="zname">Allure marathon</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.80))+'/km</span></div>'+
      '<div class="zrow"><span class="zname">Allure semi</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.835))+'/km</span></div>'+
      '<div class="zrow"><span class="zname">Allure EF</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.70))+'/km</span></div></div>';
  }
  h+='<div class="tip">ℹ️ Ton VDOT se met à jour automatiquement depuis tes records. Ajoute tes chronos dans Profil → Records.</div>';
  $('#outBody').innerHTML=h;
}
let rmW=80,rmR=5;
function renderRMtool(){
  const rm=Math.round(rmW*(1+rmR/30)); // Epley
  let h='<div class="card"><div class="field"><label>Charge soulevée (kg)</label><div class="stepper"><button onclick="rmW=Math.max(0,rmW-2.5);renderRMtool()">−</button><span class="val">'+rmW+'</span><button onclick="rmW+=2.5;renderRMtool()">+</button></div></div>';
  h+='<div class="field"><label>Répétitions</label><div class="stepper"><button onclick="rmR=Math.max(1,rmR-1);renderRMtool()">−</button><span class="val">'+rmR+'</span><button onclick="rmR++;renderRMtool()">+</button></div></div></div>';
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var(--e)">'+rm+' kg</div><div class="lab">1RM estimé (Epley)</div></div>';
  h+='<div class="card"><div class="card-t">% de ton 1RM</div>'+[[95,2],[90,4],[85,6],[80,8],[75,10],[70,12],[60,15]].map(x=>'<div class="zrow"><span class="zname">'+x[0]+'% · ~'+x[1]+' reps</span><span class="zval mono">'+Math.round(rm*x[0]/100)+' kg</span></div>').join('')+'</div>';
  $('#outBody').innerHTML=h;
}
let tonW=60,tonS=4,tonR=10;
function renderTonnageTool(){
  const ton=tonW*tonS*tonR;
  let h='<div class="card"><div class="field"><label>Charge (kg)</label><div class="stepper"><button onclick="tonW=Math.max(0,tonW-2.5);renderTonnageTool()">−</button><span class="val">'+tonW+'</span><button onclick="tonW+=2.5;renderTonnageTool()">+</button></div></div><div class="field"><label>Séries</label><div class="stepper"><button onclick="tonS=Math.max(1,tonS-1);renderTonnageTool()">−</button><span class="val">'+tonS+'</span><button onclick="tonS++;renderTonnageTool()">+</button></div></div><div class="field"><label>Reps</label><div class="stepper"><button onclick="tonR=Math.max(1,tonR-1);renderTonnageTool()">−</button><span class="val">'+tonR+'</span><button onclick="tonR++;renderTonnageTool()">+</button></div></div></div>';
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var(--e)">'+ton+' kg</div><div class="lab">Tonnage total ('+tonS+'×'+tonR+'×'+tonW+'kg)</div></div>';
  $('#outBody').innerHTML=h;
}
function renderLoadTool(){
  // ACWR (acute:chronic workload ratio) sur charge km*rpe
  const load={}; SESS.forEach(s=>{load[s.date]=(load[s.date]||0)+(s.km||0)*(s.rpe||5);});
  const end=new Date(); end.setHours(0,0,0,0);
  let acute=0,chronic=0;
  for(let i=0;i<28;i++){ const d=new Date(end);d.setDate(end.getDate()-i); const l=load[dateKey(d)]||0; chronic+=l; if(i<7)acute+=l; }
  acute/=7; chronic/=28;
  const ratio=chronic>0?(acute/chronic):0;
  let status,col; if(ratio===0){status='Pas de données';col='--dim';} else if(ratio<0.8){status='Sous-charge';col='--platine';} else if(ratio<=1.3){status='Optimal ✓';col='--ok';} else if(ratio<=1.5){status='Élevé ⚠️';col='--warn';} else {status='Risque blessure 🚨';col='--bad';}
  let h='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var('+col+')">'+ratio.toFixed(2)+'</div><div class="lab">Ratio Aigu/Chronique (ACWR)</div><div class="badge" style="margin-top:10px;background:var(--ed);color:var('+col+')">'+status+'</div></div>';
  h+='<div class="sgrid"><div class="sbox"><div class="v">'+Math.round(acute)+'</div><div class="l">Charge aiguë (7j)</div></div><div class="sbox"><div class="v">'+Math.round(chronic)+'</div><div class="l">Charge chronique (28j)</div></div></div>';
  h+='<div class="tip" style="margin-top:12px">💡 Zone optimale : 0,8–1,3. Au-dessus de 1,5, le risque de blessure augmente fortement.</div>';
  $('#outBody').innerHTML=h;
}
let calKm=10,calMin=50;
function renderCaloriesTool(){
  const w=P.weight||62; const cal=Math.round(0.9*w*calKm);
  let h='<div class="card"><div class="field"><label>Distance (km)</label><div class="stepper"><button onclick="calKm=Math.max(1,calKm-1);renderCaloriesTool()">−</button><span class="val">'+calKm+'</span><button onclick="calKm++;renderCaloriesTool()">+</button></div></div></div>';
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var(--e)">'+cal+'</div><div class="lab">kcal brûlées (~'+w+'kg)</div></div>';
  $('#outBody').innerHTML=h;
}
function renderHydraTool(){
  const w=P.weight||62; const daily=Math.round(w*35); const perH=Math.round(0.5*1000);
  let h='<div class="card"><div class="card-t">💧 Besoins en eau</div><div class="zrow"><span class="zname">Quotidien (repos)</span><span class="zval mono">'+(daily/1000).toFixed(1)+' L</span></div><div class="zrow"><span class="zname">Par heure de course</span><span class="zval mono">0,4–0,8 L</span></div><div class="zrow"><span class="zname">Par forte chaleur (+/h)</span><span class="zval mono">+0,3 L</span></div></div><div class="tip">💡 Bois régulièrement par petites gorgées. Surveille la couleur de ton urine.</div>';
  $('#outBody').innerHTML=h;
}
let bmrSex=P.sex||'Homme';
function renderBMRtool(){
  const w=P.weight||62,ht=P.height||175,a=age()||25;
  const bmr=Math.round(bmrSex==='Femme'?(10*w+6.25*ht-5*a-161):(10*w+6.25*ht-5*a+5));
  let h='<div class="card" style="text-align:center"><div class="man" style="font-size:40px;font-weight:800;color:var(--e)">'+bmr+'</div><div class="lab">Métabolisme basal (kcal/j)</div></div>';
  h+='<div class="card"><div class="card-t">Besoins selon activité</div>'+[['Sédentaire',1.2],['Léger',1.375],['Modéré',1.55],['Intense',1.725],['Athlète',1.9]].map(x=>'<div class="zrow"><span class="zname">'+x[0]+'</span><span class="zval mono">'+Math.round(bmr*x[1])+' kcal</span></div>').join('')+'</div>';
  $('#outBody').innerHTML=h;
}
let cvVal=10,cvFrom='km',cvTo='miles';
function renderConvertTool(){
  const conv={km:1,miles:0.621371,m:1000,'min/km':1};
  let res;
  if(cvFrom==='km'&&cvTo==='miles') res=(cvVal*0.621371).toFixed(2)+' miles';
  else if(cvFrom==='miles'&&cvTo==='km') res=(cvVal/0.621371).toFixed(2)+' km';
  else res=cvVal;
  let h='<div class="card"><div class="field"><label>Valeur</label><input class="inp" type="number" value="'+cvVal+'" oninput="cvVal=+this.value;renderConvertTool()"></div>';
  h+='<div class="row" style="gap:10px"><div class="field" style="flex:1"><label>De</label><select class="inp" onchange="cvFrom=this.value;renderConvertTool()"><option '+(cvFrom==='km'?'selected':'')+'>km</option><option '+(cvFrom==='miles'?'selected':'')+'>miles</option></select></div><div class="field" style="flex:1"><label>Vers</label><select class="inp" onchange="cvTo=this.value;renderConvertTool()"><option '+(cvTo==='km'?'selected':'')+'>km</option><option '+(cvTo==='miles'?'selected':'')+'>miles</option></select></div></div></div>';
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:32px;font-weight:800;color:var(--e)">'+res+'</div></div>';
  $('#outBody').innerHTML=h;
}
let pgW=60,pgInc=2.5,pgWk=8;
function renderProgTool(){
  let h='<div class="card"><div class="field"><label>Charge actuelle (kg)</label><div class="stepper"><button onclick="pgW=Math.max(0,pgW-2.5);renderProgTool()">−</button><span class="val">'+pgW+'</span><button onclick="pgW+=2.5;renderProgTool()">+</button></div></div><div class="field"><label>Progression / semaine (kg)</label><div class="pills">'+[1.25,2.5,5].map(x=>'<div class="pill '+(pgInc===x?'on':'')+'" onclick="pgInc='+x+';renderProgTool()">+'+x+'</div>').join('')+'</div></div><div class="field"><label>Semaines</label><div class="stepper"><button onclick="pgWk=Math.max(1,pgWk-1);renderProgTool()">−</button><span class="val">'+pgWk+'</span><button onclick="pgWk++;renderProgTool()">+</button></div></div></div>';
  h+='<div class="card"><div class="card-t">Projection</div>';
  for(let i=1;i<=pgWk;i++){ h+='<div class="zrow"><span class="zname">Semaine '+i+'</span><span class="zval mono">'+(pgW+pgInc*i)+' kg</span></div>'; }
  h+='</div>';
  $('#outBody').innerHTML=h;
}
function renderReposTool(){
  const data=[['Force max (1-5 reps)','3-5 min'],['Hypertrophie (6-12)','60-90 s'],['Endurance (15+)','30-45 s'],['Puissance / explosif','2-3 min'],['Superset','0 s entre, 90 s après']];
  let h='<div class="card"><div class="card-t">⏱️ Temps de repos recommandés</div>'+data.map(d=>'<div class="zrow"><span class="zname">'+d[0]+'</span><span class="zval mono">'+d[1]+'</span></div>').join('')+'</div><div class="tip">💡 Plus la charge est lourde, plus le repos doit être long pour récupérer le système nerveux.</div>';
  $('#outBody').innerHTML=h;
}
let pomoState={phase:'work',left:25*60,running:false,iv:null,count:0};
function renderPomodoro(){
  const total=pomoState.phase==='work'?25*60:(pomoState.phase==='long'?15*60:5*60);
  const pct=pomoState.left/total*100;
  const col=pomoState.phase==='work'?'var(--bad)':'var(--ok)';
  const lab=pomoState.phase==='work'?'🍅 Focus':'☕ Pause';
  let h='<div class="card" style="text-align:center"><div class="badge" style="background:var(--ed);color:'+col+'">'+lab+'</div><div class="ring-wrap" style="width:180px;height:180px;margin:14px auto"><span id="pmRing">'+ringSVG(180,pct,12,col)+'</span><div class="ring-c"><div class="big mono" id="pmNum" style="font-size:36px">'+fmtMS(pomoState.left)+'</div></div></div>';
  h+='<div class="row" style="gap:10px"><button class="btn" onclick="pomoToggle()">'+(pomoState.running?'⏸ Pause':'▶ Start')+'</button><button class="btn ghost" onclick="pomoReset()">↺</button></div>';
  h+='<div style="margin-top:12px;font-size:12px;color:var(--muted)">Pomodoros complétés : '+pomoState.count+'</div></div>';
  $('#outBody').innerHTML=h;
}
function pomoToggle(){
  if(pomoState.running){ clearInterval(pomoState.iv); pomoState.running=false; renderPomodoro(); return; }
  pomoState.running=true; renderPomodoro();
  pomoState.iv=setInterval(()=>{
    pomoState.left--;
    const total=pomoState.phase==='work'?25*60:(pomoState.phase==='long'?15*60:5*60);
    const r=$('#pmRing'),n=$('#pmNum'); const col=pomoState.phase==='work'?'var(--bad)':'var(--ok)';
    if(r)r.innerHTML=ringSVG(180,pomoState.left/total*100,12,col); if(n)n.textContent=fmtMS(pomoState.left);
    if(pomoState.left<=0){ clearInterval(pomoState.iv); pomoState.running=false; burst();
      if(pomoState.phase==='work'){ pomoState.count++; pomoState.phase=(pomoState.count%4===0)?'long':'short'; toast('Pause méritée ! ☕'); }
      else { pomoState.phase='work'; toast('Au travail ! 🍅'); }
      pomoState.left=pomoState.phase==='work'?25*60:(pomoState.phase==='long'?15*60:5*60); renderPomodoro(); }
  },1000);
}
function pomoReset(){ clearInterval(pomoState.iv); pomoState={phase:'work',left:25*60,running:false,iv:null,count:pomoState.count}; renderPomodoro(); }
function renderNotesTool(){
  const notes=PREFS.quickNotes||'';
  let h='<div class="card"><div class="card-t">📝 Notes rapides</div><textarea class="inp" rows="12" id="qnotes" placeholder="Écris ici... (sauvegarde automatique)" oninput="PREFS.quickNotes=this.value;saveAll()">'+notes+'</textarea><div style="font-size:11px;color:var(--dim);margin-top:8px">💾 Sauvegarde automatique en local.</div></div>';
  $('#outBody').innerHTML=h;
}
let sleepH=8;
function renderSleepTool(){
  let h='<div class="card"><div class="field"><label>Heures de sommeil / nuit</label><div class="stepper"><button onclick="sleepH=Math.max(3,sleepH-.5);renderSleepTool()">−</button><span class="val">'+sleepH+'</span><button onclick="sleepH=Math.min(12,sleepH+.5);renderSleepTool()">+</button></div></div></div>';
  let status,col; if(sleepH<6){status='Insuffisant — récupération compromise';col='--bad';} else if(sleepH<7){status='Limite — vise plus';col='--warn';} else if(sleepH<=9){status='Optimal pour un athlète ✓';col='--ok';} else {status='Beaucoup — écoute ton corps';col='--platine';}
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:40px;font-weight:800;color:var('+col+')">'+sleepH+'h</div><div class="badge" style="background:var(--ed);color:var('+col+');margin-top:8px">'+status+'</div></div>';
  h+='<div class="card"><div class="card-t">😴 Cycles de sommeil</div><div class="tip">Un cycle dure ~90 min. Vise un réveil en fin de cycle : 6h, 7h30 ou 9h de sommeil. Couche-toi à heure régulière pour optimiser la récupération.</div></div>';
  $('#outBody').innerHTML=h;
}


/* ---------- CALCULATEUR ALLURE ---------- */
const DISTANCES={'800m':800,'1km':1000,'1500m':1500,'Mile':1609,'3km':3000,'5km':5000,'10km':10000,'15km':15000,'Semi':21097,'Marathon':42195};
let calc={dist:'5km',customKm:5,TH:{h:0,m:18,s:0},TP:{m:3,s:36},lastResult:null,penalty:0,negSplit:false};
function renderCalc(){
  const vdot=getUserVDOT();
  let h='<div class="row" style="margin-bottom:14px"><span class="lab">Calculateur d\u2019allure</span><span class="badge" onclick="nav(\'profil\')">VDOT '+(vdot||'?')+'</span></div>';
  h+='<div class="card"><div class="field"><label>Distance</label><select class="inp" id="calcDist" onchange="calc.dist=this.value;syncFromTime();renderCalc()">'+Object.keys(DISTANCES).concat(['Autre']).map(d=>'<option '+(calc.dist===d?'selected':'')+'>'+d+'</option>').join('')+'</select></div>';
  if(calc.dist==='Autre') h+='<div class="field"><label>Distance custom (km)</label><div class="stepper"><button onclick="calc.customKm=Math.max(.1,calc.customKm-.5);renderCalc()">−</button><span class="val">'+calc.customKm+'</span><button onclick="calc.customKm+=.5;renderCalc()">+</button></div></div>';
  // time wheels
  h+='<div class="field"><label>Temps (h : mm : ss)</label><div class="wheels">'+wheel('TH.h',0,9,calc.TH.h)+'<span class="wheel-sep">:</span>'+wheel('TH.m',0,59,calc.TH.m)+'<span class="wheel-sep">:</span>'+wheel('TH.s',0,59,calc.TH.s)+'</div></div>';
  h+='<div class="field"><label>Allure (min : sec /km)</label><div class="wheels">'+wheel('TP.m',2,12,calc.TP.m)+'<span class="wheel-sep">:</span>'+wheel('TP.s',0,59,calc.TP.s)+'</div></div>';
  // speed
  const spk=calc.TP.m*60+calc.TP.s; const kmh=spk>0?(3600/spk).toFixed(1):'0';
  h+='<div class="sbox" style="text-align:center;margin-bottom:12px"><div class="v" style="color:var(--e)">'+kmh+' km/h</div><div class="l">Vitesse</div></div>';
  h+='<div class="row" style="gap:8px"><button class="btn ghost sm" onclick="resetCalc()">Réinit.</button><button class="btn ghost sm" onclick="calc._adv=!calc._adv;renderCalc()">Avancé</button><button class="btn sm" onclick="doCalc()">Calculer</button></div>';
  if(calc._adv){
    h+='<hr class="hl"><div class="field"><label>Pénalité (sec/km)</label><div class="stepper"><button onclick="calc.penalty-=1;renderCalc()">−</button><span class="val">'+calc.penalty+'</span><button onclick="calc.penalty+=1;renderCalc()">+</button></div></div><div class="chk '+(calc.negSplit?'done':'')+'" onclick="calc.negSplit=!calc.negSplit;renderCalc()"><div class="box"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg></div><div class="txt">Negative split</div></div>';
  }
  h+='</div>';
  h+='<div id="calcResult"></div>';
  $('#outBody').innerHTML=h;
  attachWheels();
  if(calc.lastResult) renderCalcResult();
}
function wheel(key,min,max,sel){
  let h='<div class="wheel" data-key="'+key+'" data-min="'+min+'"><div class="wheel-pad"></div>';
  for(let i=min;i<=max;i++) h+='<div class="wi '+(i===sel?'sel':'')+'">'+String(i).padStart(2,'0')+'</div>';
  h+='<div class="wheel-pad"></div></div>';
  return h;
}
function attachWheels(){
  $$('.wheel').forEach(w=>{
    const key=w.dataset.key, min=+w.dataset.min;
    const sel=w.querySelector('.wi.sel');
    if(sel){ setTimeout(()=>{ w.scrollTop=sel.offsetTop-40; },30); }
    let t;
    w.onscroll=()=>{ clearTimeout(t); t=setTimeout(()=>{
      const idx=Math.round(w.scrollTop/40); const val=min+idx;
      w.querySelectorAll('.wi').forEach((wi,i)=>wi.classList.toggle('sel',i===idx));
      setWheelVal(key,val);
    },120); };
  });
}
function setWheelVal(key,val){
  const[a,b]=key.split('.'); calc[a][b]=val;
  if(a==='TH') syncFromTime(); else syncFromPace();
}
function curDist(){ return calc.dist==='Autre'?calc.customKm*1000:DISTANCES[calc.dist]; }
function syncFromTime(){
  const t=calc.TH.h*3600+calc.TH.m*60+calc.TH.s; const km=curDist()/1000;
  if(km>0&&t>0){ const spk=t/km; calc.TP.m=Math.floor(spk/60); calc.TP.s=Math.round(spk%60); }
}
function syncFromPace(){
  const spk=calc.TP.m*60+calc.TP.s; const km=curDist()/1000; const t=spk*km;
  calc.TH.h=Math.floor(t/3600); calc.TH.m=Math.floor((t%3600)/60); calc.TH.s=Math.round(t%60);
}
function resetCalc(){ calc.TH={h:0,m:18,s:0}; calc.TP={m:3,s:36}; calc.lastResult=null; renderCalc(); }
function doCalc(){
  const dist=curDist(); const spk=calc.TP.m*60+calc.TP.s+calc.penalty;
  calc.lastResult={dist,spk,resDist:5000};
  renderCalc();
}
let resultDist=5000;
function renderCalcResult(){
  const vdot=getUserVDOT();
  let h='<div class="card popin"><div class="card-t">Résultats</div>';
  h+='<div class="pills" style="margin-bottom:14px;overflow-x:auto;flex-wrap:nowrap">'+Object.entries(DISTANCES).map(([k,v])=>'<div class="pill '+(resultDist===v?'on':'')+'" onclick="resultDist='+v+';renderCalc()">'+k+'</div>').join('')+'</div>';
  const t=vdot?predictTime(vdot,resultDist):calc.lastResult.spk*resultDist/1000;
  const spk=t/(resultDist/1000); const kmh=(3600/spk).toFixed(1);
  h+='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v" style="font-size:18px">'+fmtTime(t)+'</div><div class="l">Temps prédit</div></div><div class="sbox"><div class="v" style="font-size:18px">'+spkToStr(spk)+'</div><div class="l">Allure /km</div></div><div class="sbox"><div class="v">'+kmh+'</div><div class="l">km/h</div></div><div class="sbox"><div class="v">'+(resultDist/1000)+'</div><div class="l">km</div></div></div>';
  // splits
  h+='<div class="lab" style="margin-bottom:8px">Splits km</div><div style="max-height:180px;overflow-y:auto">';
  const nk=Math.floor(resultDist/1000);
  for(let k=1;k<=nk;k++){ const hi=[5,10,21,42].includes(k); h+='<div class="zrow" style="padding:8px 0"><span class="zname" style="'+(hi?'color:var(--e)':'')+'">km '+k+(hi?' ⭐':'')+'</span><span class="zval mono">'+fmtTime(spk*k)+'</span></div>'; }
  h+='</div>';
  // actions
  h+='<div class="row" style="gap:8px;margin-top:14px"><button class="btn ghost sm" onclick="saveCalcResult()">💾</button><button class="btn ghost sm" onclick="copyCalc()">Copier</button><button class="btn ghost sm" onclick="shareCalc()">↗</button></div>';
  h+='<button class="btn sm" style="margin-top:8px" onclick="calcAsGoal()">🎯 Ajouter comme objectif</button></div>';
  $('#calcResult').innerHTML=h;
}
function saveCalcResult(){
  if(!calc.lastResult){ toast(`Lance un calcul d'abord`); return; }
  toast('Résultat enregistré ✓');
}
function copyCalc(){
  if(!calc.lastResult){ toast(`Lance un calcul d'abord`); return; }
  const t=predictTime(getUserVDOT(),resultDist);
  navigator.clipboard&&navigator.clipboard.writeText('IKORUN — '+(resultDist/1000)+'km en '+fmtTime(t));
  toast('Copié ✓');
}
function shareCalc(){
  const t=predictTime(getUserVDOT(),resultDist);
  const txt='Ma prédiction IKORUN : '+(resultDist/1000)+'km en '+fmtTime(t);
  if(navigator.share) navigator.share({title:'IKORUN',text:txt}); else toast('Partage non supporté');
}
function calcAsGoal(){ addXP(10,'objectif ajouté'); toast('Objectif ajouté ✓'); }

/* ---------- FC KARVONEN ---------- */
let fc={max:P.hrMax||190,rest:P.hrRest||60};
function renderFC(){
  let h='<div class="card"><div class="field"><label>FC max (bpm)</label><div class="stepper"><button onclick="fc.max--;renderFC()">−</button><span class="val">'+fc.max+'</span><button onclick="fc.max++;renderFC()">+</button></div></div>';
  h+='<div class="field"><label>FC repos (bpm)</label><div class="stepper"><button onclick="fc.rest--;renderFC()">−</button><span class="val">'+fc.rest+'</span><button onclick="fc.rest++;renderFC()">+</button></div></div></div>';
  const zones=[['Z1 Récupération',.5,.6,'--dim'],['Z2 Endurance',.6,.7,'--e'],['Z3 Tempo',.7,.8,'--diamant'],['Z4 Seuil',.8,.9,'--or'],['Z5 VO2max',.9,1,'--bad']];
  h+='<div class="card"><div class="card-t">Zones cardiaques (Karvonen)</div>';
  zones.forEach(z=>{ const lo=Math.round(fc.rest+(fc.max-fc.rest)*z[1]); const hi=Math.round(fc.rest+(fc.max-fc.rest)*z[2]);
    h+='<div class="zrow"><span class="zdot" style="background:var('+z[3]+')"></span><span class="zname">'+z[0]+'</span><span class="zval mono">'+lo+'–'+hi+'</span></div>'; });
  h+='</div>';
  $('#outBody').innerHTML=h;
}
/* ---------- IMC ---------- */
let imc={h:P.height||175,w:P.weight||62};
function renderIMC(){
  let h='<div class="card"><div class="field"><label>Taille (cm)</label><div class="stepper"><button onclick="imc.h--;renderIMC()">−</button><span class="val">'+imc.h+'</span><button onclick="imc.h++;renderIMC()">+</button></div></div>';
  h+='<div class="field"><label>Poids (kg)</label><div class="stepper"><button onclick="imc.w--;renderIMC()">−</button><span class="val">'+imc.w+'</span><button onclick="imc.w++;renderIMC()">+</button></div></div></div>';
  const v=imc.w/Math.pow(imc.h/100,2);
  let cat,col; if(v<18.5){cat='Maigreur';col='--warn';} else if(v<25){cat='Normal';col='--ok';} else if(v<30){cat='Surpoids';col='--warn';} else {cat='Obésité';col='--bad';}
  h+='<div class="card" style="text-align:center"><div class="man" style="font-weight:800;font-size:42px;color:var('+col+')">'+v.toFixed(1)+'</div><div class="badge" style="background:var(--ed);color:var('+col+')">'+cat+'</div></div>';
  $('#outBody').innerHTML=h;
}

/* ---------- CHRONO ---------- */
let chrono={running:false,start:0,elapsed:0,laps:[],raf:null};
function renderChrono(){
  const total=chrono.elapsed+(chrono.running?Date.now()-chrono.start:0);
  let h='<div class="card" style="text-align:center;padding:28px 16px;background:radial-gradient(circle at 50% 30%,rgba(var(--e-rgb),.12),var(--s1))"><div class="mono" id="chDisp" style="font-size:54px;font-weight:700;letter-spacing:-2px;'+(chrono.running?'color:var(--e)':'')+'">'+fmtChrono(total)+'</div>';
  // Boutons
  h+='<div class="row" style="gap:14px;margin-top:24px;justify-content:center">';
  if(!chrono.running && total===0){
    h+='<div style="width:62px"></div><button class="btn" style="width:84px;height:84px;border-radius:50%;font-size:30px;flex:0;background:var(--ok)" onclick="chronoToggle()">▶</button><div style="width:62px"></div>';
  } else if(chrono.running){
    h+='<button class="chbtn" onclick="chronoLap()">Tour</button>';
    h+='<button class="btn" style="width:84px;height:84px;border-radius:50%;font-size:26px;flex:0;background:var(--warn)" onclick="chronoToggle()">⏸</button>';
    h+='<button class="chbtn" style="border-color:var(--bad);color:var(--bad)" onclick="chronoStop()">Stop</button>';
  } else {
    h+='<button class="chbtn" style="border-color:var(--bad);color:var(--bad)" onclick="chronoReset()">Reset</button>';
    h+='<button class="btn" style="width:84px;height:84px;border-radius:50%;font-size:30px;flex:0;background:var(--ok)" onclick="chronoToggle()">▶</button>';
    h+='<button class="chbtn" onclick="chronoLap()">Tour</button>';
  }
  h+='</div></div>';
  // Statistiques des tours
  if(chrono.laps.length){
    const best=Math.min(...chrono.laps), worst=Math.max(...chrono.laps), avg=chrono.laps.reduce((a,b)=>a+b,0)/chrono.laps.length;
    h+='<div class="sgrid" style="margin-bottom:12px"><div class="sbox"><div class="v" style="font-size:15px;color:var(--ok)">'+fmtChrono(best)+'</div><div class="l">Meilleur tour</div></div><div class="sbox"><div class="v" style="font-size:15px;color:var(--bad)">'+fmtChrono(worst)+'</div><div class="l">Plus lent</div></div><div class="sbox"><div class="v" style="font-size:15px">'+fmtChrono(avg)+'</div><div class="l">Moyenne</div></div><div class="sbox"><div class="v">'+chrono.laps.length+'</div><div class="l">Tours</div></div></div>';
    h+='<div class="card"><div class="row" style="margin-bottom:8px"><div class="card-t" style="margin:0">Tours</div><span style="font-size:12px;color:var(--e);cursor:pointer" onclick="exportLaps()">Exporter</span></div>';
    [...chrono.laps].reverse().forEach((l,ri)=>{ const i=chrono.laps.length-1-ri; const isBest=l===best&&chrono.laps.length>1, isWorst=l===worst&&chrono.laps.length>1;
      h+='<div class="zrow"><span class="zname">Tour '+(i+1)+(isBest?' <span style="color:var(--ok);font-size:11px">⚡ rapide</span>':isWorst?' <span style="color:var(--bad);font-size:11px">lent</span>':'')+'</span><span class="zval mono" style="'+(isBest?'color:var(--ok)':isWorst?'color:var(--bad)':'')+'">'+fmtChrono(l)+'</span></div>'; });
    h+='</div>';
  }
  $('#outBody').innerHTML=h;
}
function chronoStop(){ chrono.running=false; chrono.elapsed+=Date.now()-chrono.start; cancelAnimationFrame(chrono.raf); sfx('stop'); stopBgActivity(); renderChrono(); }
function chronoReset(){ chrono={running:false,start:0,elapsed:0,laps:[],raf:null}; renderChrono(); }
function exportLaps(){
  let txt='IKORUN Chronomètre\n'; chrono.laps.forEach((l,i)=>txt+='Tour '+(i+1)+' : '+fmtChrono(l)+'\n');
  if(navigator.share) navigator.share({title:'Chrono IKORUN',text:txt}); else { navigator.clipboard&&navigator.clipboard.writeText(txt); toast('Tours copiés ✓'); }
}
function fmtChrono(ms){ const t=Math.floor(ms); const m=Math.floor(t/60000),s=Math.floor((t%60000)/1000),cs=Math.floor((t%1000)/10); return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+'.'+String(cs).padStart(2,'0'); }
function chronoToggle(){
  if(chrono.running){ chrono.running=false; chrono.elapsed+=Date.now()-chrono.start; cancelAnimationFrame(chrono.raf); sfx('stop'); stopBgActivity(); }
  else { chrono.running=true; chrono.start=Date.now(); chronoTick(); sfx('start'); startBgActivity('Chronomètre'); }
  renderChrono();
}
function chronoTick(){ if(!chrono.running)return; const d=$('#chDisp'); if(d)d.textContent=fmtChrono(chrono.elapsed+Date.now()-chrono.start); chrono.raf=requestAnimationFrame(chronoTick); }
function chronoLap(){ const total=chrono.elapsed+(chrono.running?Date.now()-chrono.start:0); if(total<=0)return; const prev=chrono.laps.reduce((a,b)=>a+b,0); chrono.laps.push(total-prev); renderChrono(); }

/* ---------- MINUTEUR ---------- */
let timer={total:300,left:300,running:false,iv:null,m:5,s:0};
function renderTimer(){
  let h='<div class="card"><div class="pills" style="margin-bottom:14px">'+[['1:00',60],['3:00',180],['5:00',300],['10:00',600]].map(p=>'<div class="pill" onclick="setTimer('+p[1]+')">'+p[0]+'</div>').join('')+'</div>';
  if(!timer.running){
    h+='<div class="field"><label>Régler (min : sec)</label><div class="wheels">'+wheel('TM',0,59,timer.m)+'<span class="wheel-sep">:</span>'+wheel('TS',0,59,timer.s)+'</div></div>';
  }
  const pct=timer.total>0?timer.left/timer.total*100:0;
  const col=pct>50?'var(--e)':pct>20?'var(--warn)':'var(--bad)';
  h+='<div class="ring-wrap" style="width:180px;height:180px;margin:14px auto"><span id="tmRing">'+ringSVG(180,pct,12,col)+'</span><div class="ring-c"><div class="big mono" id="tmNum" style="font-size:36px">'+fmtMS(timer.left)+'</div></div></div>';
  h+='<div class="row" style="gap:10px"><button class="btn ghost" onclick="addTimer(60)">+1min</button><button class="btn" onclick="timerToggle()">'+(timer.running?'⏸ Pause':'▶ Start')+'</button><button class="btn ghost" onclick="resetTimer()">↺</button></div></div>';
  $('#outBody').innerHTML=h;
  if(!timer.running) attachWheels();
}
function fmtMS(s){ return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0'); }
function setTimer(s){ timer.total=timer.left=s; timer.m=Math.floor(s/60); timer.s=s%60; if(timer.running){clearInterval(timer.iv);timer.running=false;} renderTimer(); }
// wheel sync for timer
const _origSetWheel=setWheelVal;
setWheelVal=function(key,val){ if(key==='TM'){timer.m=val;timer.total=timer.left=timer.m*60+timer.s;} else if(key==='TS'){timer.s=val;timer.total=timer.left=timer.m*60+timer.s;} else _origSetWheel(key,val); };
function addTimer(s){ timer.left+=s; timer.total=Math.max(timer.total,timer.left); const n=$('#tmNum'); if(n)n.textContent=fmtMS(timer.left); }
function timerToggle(){
  stopAlarm();
  if(timer.running){ clearInterval(timer.iv); timer.running=false; timer.endAt=null; stopBgActivity(); renderTimer(); return; }
  if(timer.left<=0){ timer.left=timer.total=timer.m*60+timer.s; }
  if(timer.left<=0){ toast('Règle une durée'); return; }
  timer.running=true; timer.endAt=Date.now()+timer.left*1000; sfx('start'); startBgActivity('Minuteur'); renderTimer();
  timer.iv=setInterval(()=>{
    // basé sur l'horloge → reste exact même en arrière-plan
    timer.left=Math.max(0,Math.round((timer.endAt-Date.now())/1000));
    const pct=timer.left/timer.total*100;
    const col=pct>50?'var(--e)':pct>20?'var(--warn)':'var(--bad)';
    const r=$('#tmRing'),n=$('#tmNum');
    if(r)r.innerHTML=ringSVG(180,pct,12,col); if(n)n.textContent=fmtMS(timer.left);
    if(timer.left<=0){ clearInterval(timer.iv); timer.running=false; timer.endAt=null; burst(); stopBgActivity(); startAlarm('⏰ Minuteur terminé','Le temps est écoulé !'); renderTimer(); }
  },250);
}
function resetTimer(){ clearInterval(timer.iv); timer.running=false; timer.endAt=null; stopAlarm(); stopBgActivity(); timer.left=timer.total=timer.m*60+timer.s||300; renderTimer(); }

/* ---------- AGENDA ---------- */
function renderAgenda(){
  let h='<button class="btn" style="margin-bottom:14px" onclick="addEvent()">＋ Ajouter un événement</button>';
  const evts=[...AGENDA].sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(P.compDate) evts.unshift({date:P.compDate,title:'🏆 '+(P.goal||'Compétition'),fixed:true});
  if(!evts.length) h+='<div class="card"><div class="empty"><div class="em-ic">📅</div><div style="font-size:13px">Aucun événement</div></div></div>';
  else evts.forEach((e,i)=>{
    const dd=daysBetween(new Date(),new Date(e.date));
    h+='<div class="card"><div class="row"><div><div style="font-weight:700">'+e.title+'</div><div style="font-size:12px;color:var(--muted);margin-top:2px">'+fmtDate(e.date)+' · '+(dd>=0?'J-'+dd:'passé')+'</div></div>'+(e.fixed?'':'<button class="x" onclick="delEvent('+(i-(P.compDate?1:0))+')">🗑</button>')+'</div></div>';
  });
  $('#outBody').innerHTML=h;
}
function addEvent(){
  const t=prompt('Titre de l\u2019événement :'); if(!t)return;
  const d=prompt('Date (AAAA-MM-JJ) :',todayKey()); if(!d)return;
  AGENDA.push({title:t,date:d}); saveAll(); renderAgenda(); toast('Événement ajouté');
}
function delEvent(i){ AGENDA.splice(i,1); saveAll(); renderAgenda(); }

/* ---------- PRIÈRES (Béjaïa, UOIF) ---------- */
function renderPriere(){
  const times=prayerTimes();
  const now=new Date(); const nowMin=now.getHours()*60+now.getMinutes();
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  let activeIdx=-1;
  order.forEach((p,i)=>{ const[hh,mm]=times[p].split(':').map(Number); if(hh*60+mm<=nowMin) activeIdx=i; });
  let h='<div class="card"><div class="card-t">🕌 Prières · Béjaïa</div><div style="font-size:12px;color:var(--muted);margin-bottom:14px">Méthode UOIF · '+now.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})+'</div>';
  const icons={Fajr:'🌅',Dhuhr:'☀️',Asr:'🌤️',Maghrib:'🌇',Isha:'🌙'};
  order.forEach((p,i)=>{
    const act=i===activeIdx;
    h+='<div class="zrow" style="'+(act?'background:var(--ed);border-radius:12px;padding:11px 12px;margin:0 -4px':'')+'"><span style="font-size:18px">'+icons[p]+'</span><span class="zname" style="margin-left:8px;'+(act?'color:var(--e)':'')+'">'+p+'</span><span class="zval mono" style="'+(act?'color:var(--e);font-weight:700':'')+'">'+times[p]+'</span></div>';
  });
  h+='</div>';
  $('#outBody').innerHTML=h;
}
function prayerTimes(){
  const lat=36.75,lon=5.07,tz=1; // Algeria UTC+1
  const now=new Date();
  const N=Math.floor((now-new Date(now.getFullYear(),0,0))/86400000);
  const rad=Math.PI/180;
  // sun declination & equation of time
  const g=(357.529+0.98560028*N)*rad;
  const q=280.459+0.98564736*N;
  const L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*rad;
  const decl=Math.asin(0.39779*Math.sin(L));
  const eqt=(q/15)-(Math.atan2(Math.cos(23.44*rad)*Math.sin(L),Math.cos(L))/rad)/15;
  const Dhuhr=12+tz-lon/15-eqt;
  function hourAngle(angle){ const c=(Math.sin(-angle*rad)-Math.sin(lat*rad)*Math.sin(decl))/(Math.cos(lat*rad)*Math.cos(decl)); return Math.acos(Math.max(-1,Math.min(1,c)))/rad/15; }
  function asrAngle(){ const c=(Math.sin(Math.atan(1/(1+Math.tan(Math.abs(lat-decl/rad)*rad))))-Math.sin(lat*rad)*Math.sin(decl))/(Math.cos(lat*rad)*Math.cos(decl)); return Math.acos(Math.max(-1,Math.min(1,c)))/rad/15; }
  const fajr=Dhuhr-hourAngle(18);
  const sunrise=Dhuhr-hourAngle(0.833);
  const asr=Dhuhr+asrAngle();
  const maghrib=Dhuhr+hourAngle(0.833);
  const isha=Dhuhr+hourAngle(17);
  const f=t=>{ t=(t+24)%24; let hh=Math.floor(t),mm=Math.round((t-hh)*60); if(mm===60){hh++;mm=0;} return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0'); };
  return {Fajr:f(fajr),Sunrise:f(sunrise),Dhuhr:f(Dhuhr+1/60),Asr:f(asr),Maghrib:f(maghrib),Isha:f(isha)};
}

/* ---------- PROFILE ---------- */
function age(){ if(!P.bday)return'—'; const d=new Date(P.bday); return Math.floor((Date.now()-d)/31557600000); }
function avatarHTML(size,fs){
  if(P.photo) return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background-image:url('+P.photo+');background-size:cover;background-position:center;margin:0 auto;border:2.5px solid rgba(var(--e-rgb),.35);box-shadow:0 6px 18px -6px rgba(var(--e-rgb),.4)"></div>';
  return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background:linear-gradient(135deg,var(--e),var(--marineL));display:flex;align-items:center;justify-content:center;margin:0 auto;font-family:Unbounded;font-weight:800;font-size:'+fs+'px;border:2.5px solid rgba(var(--e-rgb),.35);box-shadow:0 6px 18px -6px rgba(var(--e-rgb),.4)">'+(P.name?P.name[0].toUpperCase():'?')+'</div>';
}
function renderProfile(){
  if(P.easyMode){ $('#s-profil').innerHTML=renderProfileSimple(); return; }
  const xp=xpProgress();
  const rk=rankFor(XP.level||1);
  const compDays=P.compDate?daysBetween(new Date(),new Date(P.compDate)):null;
  const langInfo=LANGS.find(l=>l[0]===curLang())||LANGS[0];
  let h='';
  // ===== HERO — avatar + nom + email/bio, épuré (image de référence : Profil) =====
  h+='<div class="card stag pf-hero" style="animation-delay:0s"><div class="pf-avwrap">'+avatarHTML(88,34)+
    '<div class="pf-cam" onclick="changePhoto()">📷</div></div>';
  h+='<div class="pf-name-row"><div class="man" style="font-weight:800;font-size:20px">'+(P.name||'Athlète')+'</div>'+
    '<div class="pf-edit" onclick="openProfileEdit()" title="'+t('editInfos')+'">✏️</div></div>';
  h+='<div style="font-size:12.5px;color:var(--muted);margin-top:3px" onclick="editBio()">'+(window.currentUserEmail||P.bio||'Ajoute une biographie ✍️')+'</div>';
  h+='<div class="rankchip" style="margin-top:11px;background:'+rk.bg+';color:#fff">'+t('level')+' '+XP.level+' · '+rk.name+' · '+XP.total+' XP</div>';
  h+='</div>';
  // ===== APERÇU RAPIDE — carte unique, une ligne par info (au lieu d'une grille + bannière séparées) =====
  h+='<div class="grp-card stag" style="animation-delay:.04s">'+
    '<div class="grp-row no-chev"><div class="lr-icon">📏</div><div class="lr-title">Taille / poids</div><div class="lr-val">'+(P.height||'—')+' cm · '+(P.weight||'—')+' kg</div></div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">🎂</div><div class="lr-title">Âge</div><div class="lr-val">'+age()+' ans</div></div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">📈</div><div class="lr-title">VDOT</div><div class="lr-val">'+(getUserVDOT()||'—')+'</div></div>'+
    '<div class="grp-row" onclick="nav(\'sport\');sportTab=\'run\';runSub=\'ia\';renderSport()"><div class="lr-icon">🎯</div><div class="lr-title">Objectif</div><div class="lr-val">'+(P.objRace||P.goal||'Aucun')+(compDays!==null&&compDays>=0?' · J-'+compDays:'')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  // ===== PROGRESSION — badges intégrés directement au profil =====
  { const unlocked=unlockedBadges(); const recent=[...unlocked].sort((a,b)=>b.date<a.date?-1:1).slice(0,5).map(u=>BADGE_TIERS.find(b=>b.key===u.key)).filter(Boolean);
    h+='<div class="sec-head stag" style="animation-delay:.06s"><h3 class="grp-lab" style="margin:0">Progression</h3><span class="see" onclick="openBadges()">'+unlocked.length+' / '+BADGE_TIERS.length+' · Voir tout ›</span></div>';
    h+='<div class="card stag" style="animation-delay:.07s">';
    if(recent.length){
      h+='<div class="row" style="gap:10px;flex-wrap:wrap">'+recent.map(b=>'<div class="bd-icon '+b.cls+'" style="width:52px;height:52px;cursor:pointer" onclick="openBadgeDetail(\''+b.key+'\')">'+bdGlyph(b.key)+'</div>').join('')+'</div>';
    } else {
      h+='<div style="font-size:12px;color:var(--muted)">Aucun badge obtenu pour l\u2019instant — ta première séance te rapprochera du badge Initié.</div>';
    }
    const nb=nextBadge();
    if(nb){
      const prog=badgeProgress(nb);
      h+='<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--hair)"><div class="row" style="margin-bottom:6px"><span style="font-size:12px;color:var(--muted)">Prochain badge · '+nb.name+'</span><span class="mono" style="font-size:12px;color:var(--e)">'+prog.pct+'%</span></div><div class="pbar" style="height:6px"><div style="width:'+prog.pct+'%"></div></div></div>';
    }
    h+='</div>';
  }
  // ===== SECTIONS GROUPÉES — Compte / Préférences / Support, une seule carte par groupe =====
  h+='<div class="grp-lab stag" style="animation-delay:.09s">Compte</div>';
  h+='<div class="grp-card stag" style="animation-delay:.10s">'+
    '<div class="grp-row" onclick="openFriends()"><div class="lr-icon">👥</div><div class="lr-title">Amis & Classement</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileEdit()"><div class="lr-icon">👤</div><div class="lr-title">Gérer le profil</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'account\')"><div class="lr-icon">🔐</div><div class="lr-title">Mot de passe & sécurité</div><div class="lr-val">'+(window.currentUserEmail||'Non connecté')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'notif\')"><div class="lr-icon">🔔</div><div class="lr-title">Notifications</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'lang\')"><div class="lr-icon">🌍</div><div class="lr-title">Langue</div><div class="lr-val">'+langInfo[1]+' '+langInfo[2]+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  h+='<div class="grp-lab stag" style="animation-delay:.12s">Préférences</div>';
  h+='<div class="grp-card stag" style="animation-delay:.13s">'+
    '<div class="grp-row" onclick="openRecords()"><div class="lr-icon">🏅</div><div class="lr-title">Historique & records</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="nav(\'stats\')"><div class="lr-icon">📊</div><div class="lr-title">Statistiques</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">🎨</div><div class="lr-title">Thème</div>'+pfThemeSwitchHTML()+'</div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">🖌️</div><div class="lr-title">Couleur de l\u2019app</div>'+pfAccentPickerHTML()+'</div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">🧓</div><div><div class="lr-title">Mode simplifié</div><div style="font-size:11px;color:var(--muted);margin-top:2px;max-width:200px">3 onglets, écrans allégés, textes plus grands — l\u2019essentiel seulement</div></div><div class="toggle'+(P.easyMode?' on':'')+'" onclick="event.stopPropagation();toggleEasyMode()"></div></div>'+
  '</div>';
  h+='<div class="grp-lab stag" style="animation-delay:.15s">Support</div>';
  h+='<div class="grp-card stag" style="animation-delay:.16s">'+
    '<div class="grp-row" onclick="openProfileSection(\'data\')"><div class="lr-icon">🔒</div><div class="lr-title">Données & confidentialité</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'data\')"><div class="lr-icon">❓</div><div class="lr-title">Centre d\u2019aide</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  h+='<div style="text-align:center;color:var(--dim);font-size:12px;margin:20px 0">IKORUN — Elite Athletic Intelligence · v2.0</div>';
  $('#s-profil').innerHTML=h;
}
function renderProfileSimple(){
  const rk=rankFor(XP.level||1);
  const compDays=P.compDate?daysBetween(new Date(),new Date(P.compDate)):null;
  let h='';
  h+='<div class="card stag pf-hero" style="animation-delay:0s;text-align:center"><div class="pf-avwrap">'+avatarHTML(72,28)+'</div>'+
    '<div class="man" style="font-weight:800;font-size:18px;margin-top:8px">'+(P.name||'Athlète')+'</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:2px">'+age()+' ans · VDOT '+(getUserVDOT()||'—')+(compDays!==null&&compDays>=0?' · J-'+compDays:'')+'</div>'+
    '<div class="rankchip" style="margin-top:10px;background:'+rk.bg+';color:#fff;display:inline-block">'+t('level')+' '+XP.level+' · '+rk.name+'</div></div>';

  h+='<div class="grp-lab stag" style="animation-delay:.05s">Ton espace</div>';
  h+='<div class="grp-card stag" style="animation-delay:.06s">'+
    '<div class="grp-row" onclick="openFriends()"><div class="lr-icon">👥</div><div class="lr-title">Amis & Classement</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="nav(\'stats\')"><div class="lr-icon">📊</div><div class="lr-title">Statistiques</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openBadges()"><div class="lr-icon">🏆</div><div class="lr-title">Badges</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="nav(\'outils\')"><div class="lr-icon">🧮</div><div class="lr-title">Outils & calculateurs</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileEdit()"><div class="lr-icon">✏️</div><div class="lr-title">Modifier mon profil</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';

  h+='<div class="grp-lab stag" style="animation-delay:.08s">Réglages</div>';
  h+='<div class="grp-card stag" style="animation-delay:.09s">'+
    '<div class="grp-row no-chev"><div class="lr-icon">🧓</div><div class="lr-title">Mode simplifié</div><div class="toggle on" onclick="event.stopPropagation();toggleEasyMode()"></div></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'account\')"><div class="lr-icon">🔐</div><div class="lr-title">Compte</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  return h;
}
/* ---- Fiches de réglages du profil, ouvertes dans l'overlay générique ---- */
let _pfSheet=null;
function openProfileSection(key){
  _pfSheet=key;
  const titles={account:'👤 Compte',lang:'🌍 '+t('language'),appearance:'🎨 '+t('appearance'),notif:'🔔 '+t('notifsApp'),data:'🔒 '+t('dataPrivacy')};
  $('#ovProgTitle').textContent=titles[key]||'Réglages';
  $('#progBody').innerHTML=pfSectionHTML(key);
  openOv('ovProg');
}
function refreshPfSheet(){ if(_pfSheet && $('#ovProg').classList.contains('on')) $('#progBody').innerHTML=pfSectionHTML(_pfSheet); }
function pfSectionHTML(key){
  if(key==='account') return pfAccountHTML();
  if(key==='lang') return pfLangHTML();
  if(key==='appearance') return pfAppearanceHTML();
  if(key==='notif') return pfNotifHTML();
  if(key==='data') return pfDataHTML();
  return '';
}
function pfAccountHTML(){
  if(window.currentUserEmail){
    return '<div class="row"><div class="row" style="gap:12px">'+
      '<div style="width:44px;height:44px;border-radius:50%;background:var(--ed);color:var(--e);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px">'+(P.name?P.name[0].toUpperCase():'?')+'</div>'+
      '<div><div style="font-weight:700">'+(P.name||'Athlète')+'</div><div style="font-size:12px;color:var(--muted)">'+window.currentUserEmail+'</div></div></div>'+
      '<span class="badge" style="font-size:10px">🔴 Google</span></div>'+
      '<div style="font-size:11px;color:var(--dim);margin-top:10px">☁️ Synchronisé sur le cloud</div>'+
      '<div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap">'+
        '<button class="btn ghost sm" onclick="addAnotherAccount()">➕ Ajouter un compte</button>'+
        '<button class="btn ghost sm" style="color:var(--bad)" onclick="logout()">🚪 '+t('logout')+'</button>'+
      '</div>'+
      '<button class="btn ghost sm" style="margin-top:10px;color:var(--bad);width:100%" onclick="deleteAccountCompletely()">🗑 Supprimer mon compte et mes données</button>';
  }
  return '<button class="btn" onclick="signInWithGoogle()">🔐 Se connecter</button>';
}
function pfLangHTML(){
  return '<div class="pills">'+LANGS.map(l=>'<div class="pill '+(curLang()===l[0]?'on':'')+'" onclick="setLang(\''+l[0]+'\')">'+l[1]+' '+l[2]+'</div>').join('')+'</div>';
}
/* Petit switch soleil/lune utilisé directement dans la ligne "Thème" du profil */
function pfThemeSwitchHTML(){
  const isLight=(P.mode==='light');
  return '<div class="theme-switch sm'+(isLight?' light':'')+'" id="themeSwitch" onclick="event.stopPropagation();toggleThemeSwitch()">'+
    '<div class="ts-sky"><div class="ts-star" style="top:6px;left:10px"></div><div class="ts-star" style="top:14px;left:28px"></div></div>'+
    '<div class="ts-ray"></div>'+
    '<div class="ts-thumb">'+(isLight?ICN_SUN:ICN_MOON)+'</div></div>';
}
function pfAppearanceHTML(){
  const mode=P.mode||'dark';
  const isLight=mode==='light';
  let s='<div class="lab" style="margin-bottom:10px">Thème</div>';
  s+='<div class="row" style="justify-content:space-between;align-items:center">'+
     '<span style="font-size:14px;color:var(--muted)">'+(isLight?'☀️ Clair':'🌙 Sombre')+'</span>'+
     pfThemeSwitchHTML().replace('theme-switch sm','theme-switch')+
   '</div>';
  return s;
}
/* Bascule le thème avec une petite animation (glissement + pulse + halo qui explose) */
const ICN_SUN='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const ICN_MOON='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>';
function toggleThemeSwitch(){
  const el=$('#themeSwitch'); const next=(P.mode||'dark')==='light'?'dark':'light';
  P.mode=next; saveAll(); applyTheme();
  if(el){
    el.classList.toggle('light',next==='light');
    el.classList.add('pulse','burst');
    const thumb=el.querySelector('.ts-thumb'); if(thumb) thumb.innerHTML=(next==='light'?ICN_SUN:ICN_MOON);
    const lab=el.previousElementSibling; if(lab) lab.textContent=(next==='light'?'☀️ Clair':'🌙 Sombre');
    setTimeout(()=>el.classList.remove('pulse','burst'),600);
  }
  sfx&&sfx('tap');
}
function pfNotifHTML(){
  return '<div class="row" style="margin-bottom:14px"><span style="font-size:14px">'+t('trainReminders')+'</span><div class="toggle'+(P.notif!==false?' on':'')+'" onclick="toggleNotif(this)"></div></div>'+
    '<div class="row" style="margin-bottom:14px"><span style="font-size:14px">🔊 '+t('sounds')+'</span><div class="toggle'+(P.sounds!==false?' on':'')+'" onclick="toggleSounds(this)"></div></div>'+
    '<div class="row"><span style="font-size:14px">'+t('units')+'</span><div class="toggle on"></div></div>';
}
function pfDataHTML(){
  return '<button class="btn ghost sm" style="margin-bottom:8px" onclick="exportData()">📤 '+t('exportData')+'</button>'+
    '<button class="btn ghost sm" style="margin-bottom:8px" onclick="importData()">📥 '+t('importData')+'</button>'+
    '<button class="btn ghost sm" style="color:var(--bad)" onclick="resetAll()">🗑 '+t('resetApp')+'</button>';
}
/* ---- Photo & Bio ---- */
function changePhoto(){
  // Propose galerie OU appareil photo
  let h='<div class="tip" style="margin-bottom:14px">Choisis ta photo de profil :</div>';
  h+='<button class="btn" style="margin-bottom:10px" onclick="pickPhotoSource(false)">🖼️ Depuis la galerie</button>';
  h+='<button class="btn ghost" style="margin-bottom:10px" onclick="pickPhotoSource(true)">📷 Prendre une photo</button>';
  if(P.photo) h+='<button class="btn ghost" style="color:var(--bad)" onclick="removePhoto();closeOv(\'ovProg\')">🗑 Supprimer la photo actuelle</button>';
  $('#ovProgTitle').textContent='Photo de profil'; $('#progBody').innerHTML=h; $('#ovProg').style.zIndex='13700'; openOv('ovProg');
}
function pickPhotoSource(useCamera){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  if(useCamera) inp.capture='user'; // appareil photo. Sans capture = galerie
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ const img=new Image(); img.onload=()=>{ openCropper(img); }; img.src=r.result; };
    r.readAsDataURL(f); };
  inp.click();
}
/* Recadrage simple : zoom + déplacement avant validation */
let _crop=null;
const CROP_VIEW=300, CROP_DPR=Math.min(3,window.devicePixelRatio||2), CROP_OUT=512;
function openCropper(img){
  closeOv('ovProg');
  _crop={img,scale:1,x:0,y:0};
  let h='<div class="tip" style="margin-bottom:12px">Glisse pour déplacer, utilise le curseur pour zoomer.</div>';
  h+='<div id="cropStage" style="position:relative;width:'+CROP_VIEW+'px;height:'+CROP_VIEW+'px;max-width:100%;margin:0 auto 14px;border-radius:50%;overflow:hidden;background:#000;touch-action:none;border:2px solid var(--e)"><canvas id="cropCv" style="width:100%;height:100%;display:block"></canvas></div>';
  h+='<div class="field"><label>Zoom</label><input id="cropZoom" type="range" min="1" max="4" step="0.01" value="1" style="width:100%"></div>';
  h+='<button class="btn" onclick="applyCrop()">✓ Valider la photo</button>';
  $('#ovProgTitle').textContent='Recadrer'; $('#progBody').innerHTML=h; $('#ovProg').style.zIndex='13700'; openOv('ovProg');
  setTimeout(initCropper,40);
}
function drawCrop(){
  const c=$('#cropCv'); if(!c)return;
  const R=CROP_VIEW*CROP_DPR;
  if(c.width!==R){ c.width=R; c.height=R; }
  const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  const{img,scale,x,y}=_crop;
  ctx.clearRect(0,0,R,R); ctx.fillStyle='#000'; ctx.fillRect(0,0,R,R);
  const base=R/Math.min(img.width,img.height); const w=img.width*base*scale, hh=img.height*base*scale;
  ctx.drawImage(img,(R-w)/2+x*CROP_DPR,(R-hh)/2+y*CROP_DPR,w,hh);
}
function initCropper(){
  drawCrop();
  const z=$('#cropZoom'); if(z) z.oninput=()=>{ _crop.scale=+z.value; drawCrop(); };
  const stage=$('#cropStage'); if(!stage)return;
  let drag=false,lx=0,ly=0;
  stage.addEventListener('pointerdown',e=>{ drag=true; lx=e.clientX; ly=e.clientY; stage.setPointerCapture&&stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove',e=>{ if(!drag)return; _crop.x+=e.clientX-lx; _crop.y+=e.clientY-ly; lx=e.clientX; ly=e.clientY; drawCrop(); });
  window.addEventListener('pointerup',()=>drag=false);
}
function applyCrop(){
  // Rendu final haute résolution directement depuis l'image source (net, non pixelisé)
  const{img,scale,x,y}=_crop;
  const out=document.createElement('canvas'); out.width=CROP_OUT; out.height=CROP_OUT;
  const ctx=out.getContext('2d'); ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#000'; ctx.fillRect(0,0,CROP_OUT,CROP_OUT);
  const base=CROP_OUT/Math.min(img.width,img.height); const w=img.width*base*scale, hh=img.height*base*scale;
  const ratio=CROP_OUT/CROP_VIEW; // remappe le déplacement de l'aperçu vers la sortie
  ctx.drawImage(img,(CROP_OUT-w)/2+x*ratio,(CROP_OUT-hh)/2+y*ratio,w,hh);
  P.photo=out.toDataURL('image/jpeg',0.9); saveAll(); closeOv('ovProg'); renderProfile(); toast('Photo mise à jour ✓'); sfx&&sfx('goal');
}
function removePhoto(){ delete P.photo; saveAll(); renderProfile(); toast('Photo supprimée'); }
function editBio(){ const v=prompt('Ta biographie :',P.bio||''); if(v!==null){ P.bio=v.trim().slice(0,160); saveAll(); renderProfile(); } }
function importData(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ const d=JSON.parse(r.result); if(d.profile){P=d.profile;DB.save('profile',P);} if(d.sessions){SESS=d.sessions;DB.save('sessions',SESS);} if(d.muscu){MSESS=d.muscu;DB.save('muscu_sessions',MSESS);} if(d.xp){XP=d.xp;DB.save('xp',XP);} toast('Données importées ✓'); applyTheme(); renderProfile(); }catch(err){ toast('Fichier invalide'); } };
    r.readAsText(f); };
  inp.click();
}
/* ---------- HISTORIQUE DES PERFORMANCES (records illimités) ---------- */
const REC_DISTANCES=[['100 m',100],['200 m',200],['300 m',300],['400 m',400],['600 m',600],['800 m',800],['1000 m',1000],['1500 m',1500],['3000 m',3000],['5000 m',5000],['10 km',10000],['15 km',15000],['Semi-marathon',21097],['Marathon',42195],['Trail',0],['Cross',0]];
function openRecords(){
  let h='<button class="btn" style="margin-bottom:14px" onclick="addRecord()">＋ Ajouter une performance</button>';
  const recs=personalRecords();
  if(!recs.length) h+='<div class="card"><div class="empty"><div class="em-ic">🏅</div><div style="font-size:13px">Ajoute tes chronos : ils alimentent ton VDOT et ton plan.</div></div></div>';
  else {
    const sorted=[...RECORDS].sort((a,b)=>(a.meters||0)-(b.meters||0));
    sorted.forEach((r,i)=>{
      const v=r.meters?vdotFromRace(r.meters,parseTime(r.time)).toFixed(1):'—';
      h+='<div class="card" style="padding:13px"><div class="row"><div><div style="font-weight:700">'+r.dist+' · <span class="mono" style="color:var(--e)">'+r.time+'</span></div><div style="font-size:11px;color:var(--muted);margin-top:3px">'+(r.date?fmtDate(r.date):'')+(r.place?' · '+r.place:'')+(r.meters?' · VDOT '+v:'')+'</div></div><button class="x" onclick="delRecord('+i+')">🗑</button></div>'+(r.feel||r.hrAvg?'<div style="font-size:11px;color:var(--dim);margin-top:6px">'+(r.feel?r.feel:'')+(r.hrAvg?' · FC moy '+r.hrAvg:'')+(r.hrMax?' / max '+r.hrMax:'')+'</div>':'')+'</div>';
    });
    const best=bestRecord();
    if(best) h+='<div class="card" style="border-color:var(--or);text-align:center"><div class="lab" style="color:var(--or)">🏆 Meilleure perf</div><div class="man" style="font-weight:800;font-size:18px;margin-top:4px">'+best.dist+' — '+best.time+'</div><div style="font-size:12px;color:var(--muted)">VDOT '+vdotFromRace(best.meters,parseTime(best.time)).toFixed(1)+'</div></div>';
  }
  $('#profileEditBody').innerHTML=h; $('#ovProfile').querySelector('h2').textContent='Historique des performances'; openOv('ovProfile');
}
let recTmp={};
function addRecord(){
  // Étape 1 : choisir la distance via Wheel Picker
  const names=REC_DISTANCES.map(d=>d[0]).concat(['Autre']);
  openPicker({title:'Choisis la distance',cols:[{values:names,sel:9,wide:true}],onOk:idx=>{
    if(names[idx[0]]==='Autre'){ pickDistance('Distance personnalisée',5,km=>recordForm([(km>=1?km+' km':Math.round(km*1000)+' m'),Math.round(km*1000)])); }
    else recordForm(REC_DISTANCES[idx[0]]);
  }});
}
function recordForm(d){
  recTmp={dist:d[0],meters:d[1],timeS:d[1]>=21000?5400:(d[1]>=5000?1200:300),date:todayKey(),place:'',feel:'',competition:false};
  let h='<div style="text-align:center;margin-bottom:16px"><div class="badge" style="font-size:14px;padding:8px 16px">🏁 '+d[0]+'</div></div>';
  h+='<div class="field"><label>Chrono *</label><div class="inp pkfield set" id="rc_time" onclick="pickTime(\'Chrono '+d[0]+'\',recTmp.timeS,v=>{recTmp.timeS=v;document.getElementById(\'rc_time\').textContent=fmtTime(v)},'+(d[1]>=15000?'true':'false')+')">'+fmtTime(recTmp.timeS)+'</div></div>';
  h+='<div class="field"><label>Date</label><input class="inp" id="rc_date" type="date" value="'+todayKey()+'"></div>';
  h+='<div class="field"><label>Lieu (optionnel)</label><input class="inp" id="rc_place" placeholder="Lieu de la course"></div>';
  h+='<div class="field"><label>Sensation (optionnel)</label><input class="inp" id="rc_feel" placeholder="Comment c\u2019était ?"></div>';
  h+='<div class="row" style="margin:14px 0"><span>🏁 Compétition officielle</span><div class="toggle" id="rc_comp" onclick="recTmp.competition=!recTmp.competition;this.classList.toggle(\'on\')"></div></div>';
  h+='<button class="btn" onclick="saveRecord()">💾 Enregistrer cette performance</button>';
  h+='<button class="btn ghost" style="margin-top:10px" onclick="openRecords()">‹ Retour</button>';
  $('#profileEditBody').innerHTML=h;
}
function saveRecord(){
  const time=fmtTime(recTmp.timeS);
  RECORDS.push({dist:recTmp.dist,meters:recTmp.meters,time,date:$('#rc_date').value,place:$('#rc_place').value.trim(),feel:$('#rc_feel').value.trim(),competition:!!recTmp.competition});
  if(recTmp.dist==='5000 m')P.pb5k=time; if(recTmp.dist==='3000 m')P.pb3k=time; if(recTmp.dist==='1500 m')P.pb1500=time; if(recTmp.dist==='10 km')P.pb10k=time;
  P.vdot=computeVDOTfromRecords();
  saveAll(); refreshXP({animate:true}); openRecords(); toast(recTmp.competition?'Performance ajoutée · +XP compétition ✓':'Performance ajoutée ✓'); burst();
}
function delRecord(i){ const sorted=[...RECORDS].sort((a,b)=>(a.meters||0)-(b.meters||0)); const r=sorted[i]; RECORDS=RECORDS.filter(x=>x!==r); P.vdot=computeVDOTfromRecords(); saveAll(); openRecords(); }
function computeVDOTfromRecords(){
  let best=computeVDOT();
  RECORDS.forEach(r=>{ if(r.meters&&r.time){ const v=vdotFromRace(r.meters,parseTime(r.time)); if(v>best)best=v; }});
  return best>0?Math.round(best*10)/10:0;
}
function openProfileEdit(){
  $('#ovProfile').querySelector('h2').textContent='Modifier le profil';
  const f=(l,id,v,t)=>'<div class="field"><label>'+l+'</label><input class="inp" id="'+id+'" value="'+(v||'')+'" '+(t?'type="'+t+'"':'')+'></div>';
  let h='<div class="field"><label>Nom d\u2019utilisateur</label><div class="uname-wrap"><span class="uname-at">@</span><input class="inp" id="pe_username" value="'+(P.username||'')+'" autocapitalize="off" autocorrect="off" spellcheck="false"></div><div class="uname-status" id="pe_username_status">Utilisé par tes amis pour te retrouver</div></div>';
  h+=f('Prénom','pe_name',P.name)+f('Ville','pe_city',P.city)+f('Date de naissance','pe_bday',P.bday,'date')+
    f('Taille (cm)','pe_h',P.height,'number')+f('Poids (kg)','pe_w',P.weight,'number')+
    f('FC max','pe_hrmax',P.hrMax,'number')+f('FC repos','pe_hrrest',P.hrRest,'number')+
    f('Km / semaine','pe_km',P.kmWeek,'number')+f('Objectif','pe_goal',P.goal)+f('Date compétition','pe_comp',P.compDate,'date')+
    f('5000m','pe_5k',P.t5k)+f('3000m','pe_3k',P.t3k)+f('1500m','pe_1500',P.t1500)+f('10km','pe_10k',P.t10k)+f('Coach','pe_coach',P.coach);
  h+='<button class="btn" onclick="saveProfileEdit()">💾 Sauver</button>';
  $('#profileEditBody').innerHTML=h; openOv('ovProfile');
  peUsernameOk=true; // on ne bloque pas si le champ n'a pas changé
  wireUsernameField('pe_username','pe_username_status',ok=>{ peUsernameOk=ok; });
}
let peUsernameOk=true;
async function saveProfileEdit(){
  const newUsername=$('#pe_username').value.trim();
  if(newUsername && newUsername!==P.username){
    if(!usernameFormatOk(newUsername)){ toast('Pseudo invalide (3-20, lettres/chiffres/_)'); return; }
    if(!peUsernameOk){ toast('Ce pseudo n\u2019est pas disponible'); return; }
    const ok=await claimUsername(newUsername);
    if(!ok){ toast('Ce pseudo vient d\u2019être pris, choisis-en un autre'); return; }
    toast('Pseudo mis à jour ✓');
  }
  P.name=$('#pe_name').value.trim()||P.name; P.city=$('#pe_city').value.trim(); P.bday=$('#pe_bday').value;
  P.height=+$('#pe_h').value||P.height; P.weight=+$('#pe_w').value||P.weight;
  P.hrMax=+$('#pe_hrmax').value||P.hrMax; P.hrRest=+$('#pe_hrrest').value||P.hrRest;
  P.kmWeek=+$('#pe_km').value||P.kmWeek; P.goal=$('#pe_goal').value.trim(); P.compDate=$('#pe_comp').value;
  P.t5k=$('#pe_5k').value.trim(); P.t3k=$('#pe_3k').value.trim(); P.t1500=$('#pe_1500').value.trim(); P.t10k=$('#pe_10k').value.trim();
  P.coach=$('#pe_coach').value.trim();
  P.pb5k=P.t5k; P.pb3k=P.t3k; P.pb1500=P.t1500; P.pb10k=P.t10k;
  P.vdot=computeVDOT();
  saveAll(); closeOv('ovProfile'); renderProfile(); toast('Profil mis à jour ✓');
}

/* ---------- SETTINGS ---------- */
function openSettings(){
  let h='<div class="card"><div class="row" style="margin-bottom:14px"><span>Mode sombre</span><div class="toggle on"></div></div>'+
    '<div class="row" style="margin-bottom:14px"><span>Unités métriques (km)</span><div class="toggle on"></div></div>'+
    '<div class="row"><span>Notifications</span><div class="toggle'+(P.notif?' on':'')+'" onclick="P.notif=!P.notif;saveAll();this.classList.toggle(\'on\')"></div></div></div>';
  h+='<div class="card"><div class="card-t">🔒 Données & confidentialité</div><button class="btn ghost sm" style="margin-bottom:8px" onclick="exportData()">📤 Exporter mes données (JSON)</button><button class="btn ghost sm" style="color:var(--bad)" onclick="resetAll()">🗑 Réinitialisation totale</button></div>';
  h+='<div style="text-align:center;color:var(--dim);font-size:12px">IKORUN v2.0 · Données locales uniquement</div>';
  $('#settingsBody').innerHTML=h; openOv('ovSettings');
}
function exportData(){
  const data={profile:P,sessions:SESS,muscu:MSESS,custom:CUSTOM,plan:PLAN,goals:GOALS,agenda:AGENDA,xp:XP};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ikorun-export.json'; a.click();
  toast('Export généré ✓');
}
function resetAll(){
  if(!confirm('Tout effacer ? Cette action est irréversible.'))return;
  if(!confirm('Vraiment sûr ? Toutes tes données seront perdues.'))return;
  localStorage.clear();
  location.reload();
}

/* ============ PWA : manifest + service worker (offline-first) ============ */
function setupPWA(){
  // Manifest dynamique
  try{
    const icon=appIconDataURL();
    const manifest={ name:'IKORUN — Elite Athletic Intelligence', short_name:'IKORUN', start_url:'.', scope:'.',
      display:'standalone', orientation:'portrait', background_color:'#0A0D12', theme_color:'#0A0D12',
      icons:[{src:icon,sizes:'192x192',type:'image/svg+xml',purpose:'any maskable'},{src:icon,sizes:'512x512',type:'image/svg+xml',purpose:'any maskable'}] };
    const blob=new Blob([JSON.stringify(manifest)],{type:'application/manifest+json'});
    const url=URL.createObjectURL(blob);
    let link=document.querySelector('link[rel="manifest"]'); if(!link){ link=document.createElement('link'); link.rel='manifest'; document.head.appendChild(link); }
    link.href=url;
  }catch(e){}
  // Service worker : cache la page courante pour fonctionner hors-ligne
  if('serviceWorker'in navigator && location.protocol.startsWith('http')){
    const swCode="const C='ikorun-v4';self.addEventListener('install',e=>{self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(res=>{try{const c2=res.clone();caches.open(C).then(c=>c.put(e.request,c2))}catch(x){}return res}).catch(()=>caches.open(C).then(c=>c.match(e.request))))});";
    try{ const b=new Blob([swCode],{type:'text/javascript'}); navigator.serviceWorker.register(URL.createObjectURL(b)).catch(()=>{}); }catch(e){}
  }
}

/* ============ ÉTAT EN LIGNE / HORS LIGNE + SYNC ============ */
function checkConnectivity(){
  const online=navigator.onLine;
  if(online){ syncOnline(true); }
  else {
    const last=PREFS.lastOnline||Date.now();
    const days=Math.floor((Date.now()-last)/86400000);
    if(days>=3) setTimeout(()=>toast('📡 Hors ligne depuis '+days+' j — pense à te reconnecter'),1500);
  }
  return online;
}
/* Synchronisation silencieuse quand Internet est disponible */
function syncOnline(silent){
  if(!navigator.onLine) return;
  if(silent && Date.now()-_lastScrollTouch<1000){ setTimeout(()=>syncOnline(silent),1500); return; } // évite de re-render sous le doigt
  PREFS.lastOnline=Date.now();
  PREFS.lastSync=Date.now();
  // Recalcule/rafraîchit les données dépendantes de la date (prières, calendrier, J-X…)
  try{ if($('#s-home')&&$('#s-home').classList.contains('on')) renderHome(); }catch(e){}
  try{ if($('#s-outils')&&$('#s-outils').classList.contains('on')&&outilsTab==='priere') renderPriere(); }catch(e){}
  DB.save('prefs',PREFS);
  if(!silent) toast('🔄 Données synchronisées');
  nudgeScroll();
}
window.addEventListener('online',()=>{ toast('🟢 Connexion rétablie · synchronisation…'); syncOnline(false); });
window.addEventListener('offline',()=>{ toast('🔌 Mode hors ligne — tout reste accessible'); });
// Sync silencieuse périodique tant que l'app est ouverte
setInterval(()=>{ if(navigator.onLine) syncOnline(true); },5*60*1000);

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startApp); else startApp();
setTimeout(hideAppSkeleton,7000); // filet de sécurité si le réseau/l'auth traîne
setupPWA();
