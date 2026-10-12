/* ============================================================================
   IKORUN — MÉTÉO (V4.0.0)
   ----------------------------------------------------------------------------
   Fournisseur unique, isolé ici : Open-Meteo (https://open-meteo.com), gratuit pour un usage
   NON COMMERCIAL, sans clé, données sous licence CC BY 4.0 (attribution affichée dans la fiche
   météo). Si l'app devient commerciale : passer par une edge function avec une offre payante
   Open-Meteo (ou un autre fournisseur) en ne remplaçant que wxFetch() ci-dessous.
   · Prévision horaire (veille + 3 jours) : température, ressenti, humidité, point de rosée,
     vent et rafales, pluie, nuages, UV, jour/nuit, code météo ; lever et coucher du soleil.
   · Poussières (API qualité de l'air) : détection du sirocco.
   · Cache : localStorage (frais 1 h, réutilisable 24 h hors ligne) + service worker.
   · Lieu : jamais demandé d'office. Géolocalisation au moment où on la choisit, sinon les
     58 wilayas ou une recherche de ville. Enregistré dans le profil (P.wxLoc).
   · Chaleur : table de Mark Hadley (somme température °F + point de rosée °F), interpolée
     dans chaque palier. Les allures de la séance sont ralenties d'autant, et le moteur
     d'adaptation juge l'exécution sur ces allures corrigées (wxForBilan → bilan.wx).
   ============================================================================ */
const WX_API='https://api.open-meteo.com/v1/forecast', WX_AQ='https://air-quality-api.open-meteo.com/v1/air-quality', WX_GEO='https://geocoding-api.open-meteo.com/v1/search';
const WX_KEY='ik_wx', WX_FRESH=3600e3, WX_STALE=24*3600e3;
// Chefs-lieux des 58 wilayas (code, nom, latitude, longitude).
const WILAYAS=[[1,'Adrar',27.874,-0.294],[2,'Chlef',36.165,1.334],[3,'Laghouat',33.8,2.865],[4,'Oum El Bouaghi',35.877,7.113],[5,'Batna',35.556,6.174],
  [6,'Béjaïa',36.751,5.056],[7,'Biskra',34.85,5.728],[8,'Béchar',31.617,-2.217],[9,'Blida',36.47,2.83],[10,'Bouira',36.375,3.902],[11,'Tamanrasset',22.785,5.523],
  [12,'Tébessa',35.404,8.124],[13,'Tlemcen',34.878,-1.315],[14,'Tiaret',35.371,1.317],[15,'Tizi Ouzou',36.712,4.046],[16,'Alger',36.754,3.059],[17,'Djelfa',34.673,3.263],
  [18,'Jijel',36.82,5.766],[19,'Sétif',36.19,5.414],[20,'Saïda',34.83,0.151],[21,'Skikda',36.876,6.909],[22,'Sidi Bel Abbès',35.19,-0.63],[23,'Annaba',36.9,7.767],
  [24,'Guelma',36.462,7.426],[25,'Constantine',36.365,6.615],[26,'Médéa',36.264,2.754],[27,'Mostaganem',35.931,0.089],[28,'M’Sila',35.706,4.542],[29,'Mascara',35.397,0.14],
  [30,'Ouargla',31.95,5.325],[31,'Oran',35.697,-0.633],[32,'El Bayadh',33.683,1.017],[33,'Illizi',26.507,8.48],[34,'Bordj Bou Arréridj',36.073,4.761],[35,'Boumerdès',36.766,3.477],
  [36,'El Tarf',36.767,8.313],[37,'Tindouf',27.674,-8.147],[38,'Tissemsilt',35.607,1.811],[39,'El Oued',33.368,6.867],[40,'Khenchela',35.436,7.143],[41,'Souk Ahras',36.286,7.951],
  [42,'Tipaza',36.589,2.448],[43,'Mila',36.45,6.264],[44,'Aïn Defla',36.264,1.968],[45,'Naâma',33.267,-0.317],[46,'Aïn Témouchent',35.297,-1.14],[47,'Ghardaïa',32.49,3.674],
  [48,'Relizane',35.737,0.556],[49,'Timimoun',29.263,0.241],[50,'Bordj Badji Mokhtar',21.33,0.95],[51,'Ouled Djellal',34.42,5.07],[52,'Béni Abbès',30.13,-2.17],
  [53,'In Salah',27.197,2.483],[54,'In Guezzam',19.57,5.77],[55,'Touggourt',33.105,6.058],[56,'Djanet',24.554,9.484],[57,'El M’Ghair',33.95,5.92],[58,'El Meniaa',30.58,2.88]];
const WX_DEFAULT_LOC={name:'Béjaïa',lat:36.751,lon:5.056,src:'default'};
function wxLoc(){ return (P&&P.wxLoc&&isFinite(P.wxLoc.lat)&&isFinite(P.wxLoc.lon))?P.wxLoc:null; }
function wxLocOrDefault(){ return wxLoc()||WX_DEFAULT_LOC; }
function wxSetLoc(loc){
  P.wxLoc={name:String(loc.name||'').slice(0,60),lat:Math.round(+loc.lat*100)/100,lon:Math.round(+loc.lon*100)/100,src:loc.src||'list',w:loc.w||null};
  DB.save('profile',P); _wxMem=null; try{ localStorage.removeItem(WX_KEY); }catch(e){}
  wxRefresh(true).then(()=>{ try{ refreshScreen(); }catch(e){} });
  try{ if(typeof ikTrack==='function') ikTrack('weather_location',{src:P.wxLoc.src}); }catch(e){}
}

/* ---------- données ---------- */
let _wxMem=null, _wxBusy=null;
function wxRead(){
  if(_wxMem) return _wxMem;
  try{ const v=JSON.parse(localStorage.getItem(WX_KEY)||'null'); if(v && v.h && v.h.time) _wxMem=v; }catch(e){}
  return _wxMem;
}
function wxUsable(d,loc){ return !!(d && loc && Math.abs(d.lat-loc.lat)<0.02 && Math.abs(d.lon-loc.lon)<0.02 && Date.now()-d.ts<WX_STALE); }
// Le seul endroit qui parle au fournisseur.
async function wxFetch(loc){
  const hv='temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,is_day';
  const u=WX_API+'?latitude='+loc.lat+'&longitude='+loc.lon+'&hourly='+hv+'&daily=sunrise,sunset,uv_index_max&timezone=auto&past_days=1&forecast_days=3&wind_speed_unit=kmh';
  const r=await fetch(u,{cache:'no-cache'}); if(!r.ok) throw new Error('météo '+r.status);
  const j=await r.json();
  let dust=null;
  try{ const a=await fetch(WX_AQ+'?latitude='+loc.lat+'&longitude='+loc.lon+'&hourly=dust&timezone=auto&past_days=1&forecast_days=3',{cache:'no-cache'}); if(a.ok){ const aj=await a.json(); dust=aj.hourly&&aj.hourly.dust||null; } }catch(e){}
  const H=j.hourly||{};
  return {ts:Date.now(),lat:loc.lat,lon:loc.lon,name:loc.name,tz:j.timezone||null,off:j.utc_offset_seconds||0,
    h:{time:H.time||[],t:H.temperature_2m||[],feel:H.apparent_temperature||[],rh:H.relative_humidity_2m||[],dew:H.dew_point_2m||[],rain:H.precipitation||[],
       code:H.weather_code||[],cloud:H.cloud_cover||[],wind:H.wind_speed_10m||[],gust:H.wind_gusts_10m||[],wdir:H.wind_direction_10m||[],uv:H.uv_index||[],day:H.is_day||[],dust:dust||[]},
    d:{time:(j.daily&&j.daily.time)||[],sunrise:(j.daily&&j.daily.sunrise)||[],sunset:(j.daily&&j.daily.sunset)||[],uv:(j.daily&&j.daily.uv_index_max)||[]}};
}
// Rafraîchit si besoin (plus d'une heure) ; ne fait rien sans lieu choisi ni réseau.
function wxRefresh(force){
  const loc=wxLoc(); if(!loc) return Promise.resolve(null);
  const cur=wxRead();
  if(!force && cur && wxUsable(cur,loc) && Date.now()-cur.ts<WX_FRESH) return Promise.resolve(cur);
  if(!navigator.onLine) return Promise.resolve(wxUsable(cur,loc)?cur:null);
  if(_wxBusy) return _wxBusy;
  _wxBusy=wxFetch(loc).then(d=>{ _wxMem=d; try{ localStorage.setItem(WX_KEY,JSON.stringify(d)); }catch(e){} return d; })
    .catch(e=>{ console.warn('[IKORUN] météo',e&&e.message); return wxUsable(cur,loc)?cur:null; })
    .finally(()=>{ _wxBusy=null; });
  return _wxBusy;
}
function wxData(){ const d=wxRead(), loc=wxLoc(); return wxUsable(d,loc)?d:null; }
// « 2026-10-12T18:00 » de l'heure locale du lieu ; l'Algérie est à UTC+1 toute l'année.
function wxHourKey(date,h){ return date+'T'+String(h).padStart(2,'0')+':00'; }
function wxNowLocalKey(d){ const n=new Date(Date.now()+(d.off||3600)*1000); return n.toISOString().slice(0,13)+':00'; }
function wxAt(key){
  const d=wxData(); if(!d) return null;
  const i=d.h.time.indexOf(key); if(i<0) return null;
  const g=a=>a&&a[i]!=null?+a[i]:null;
  return {i,time:key,t:g(d.h.t),feel:g(d.h.feel),rh:g(d.h.rh),dew:g(d.h.dew),rain:g(d.h.rain),code:g(d.h.code),cloud:g(d.h.cloud),wind:g(d.h.wind),gust:g(d.h.gust),wdir:g(d.h.wdir),uv:g(d.h.uv),day:g(d.h.day),dust:g(d.h.dust)};
}
function wxNow(){ const d=wxData(); return d?wxAt(wxNowLocalKey(d)):null; }

/* ---------- chaleur : table de Hadley ---------- */
// Somme T(°F) + rosée(°F) → ralentissement d'allure. Paliers publiés (borne haute de chaque
// palier) : ≤100 : 0 % · 101–110 : ≤0,5 % · 111–120 : ≤1 % · 121–130 : ≤2 % · 131–140 : ≤3 %
// · 141–150 : ≤4,5 % · 151–160 : ≤6 % · 161–170 : ≤8 % · 171–180 : ≤10 % · >180 : pas d'effort dur.
const HADLEY=[[100,0],[110,0.005],[120,0.01],[130,0.02],[140,0.03],[150,0.045],[160,0.06],[170,0.08],[180,0.10]];
const cToF=c=>c*9/5+32;
function heatCorr(tC,dewC){
  if(tC==null||dewC==null) return {sum:null,corr:0,noHard:false};
  const s=cToF(tC)+cToF(dewC);
  if(s<=100) return {sum:Math.round(s),corr:0,noHard:false};
  if(s>180) return {sum:Math.round(s),corr:0.10,noHard:true};
  for(let i=1;i<HADLEY.length;i++) if(s<=HADLEY[i][0]){ const [a,ca]=HADLEY[i-1],[b,cb]=HADLEY[i]; return {sum:Math.round(s),corr:ca+(cb-ca)*(s-a)/(b-a),noHard:false}; }
  return {sum:Math.round(s),corr:0.10,noHard:true};
}

/* ---------- conditions, scènes, conseils ---------- */
// Codes WMO d'Open-Meteo → scène : clear, partly, cloudy, fog, drizzle, rain, snow, storm ; plus
// wind (≥ 30 km/h), dust (sirocco : poussières ≥ 150 µg/m³ et chaleur), night.
function wxScene(w){
  if(!w) return 'cloudy';
  const c=w.code|0;
  let k=c===0?'clear':c<=2?'partly':c===3?'cloudy':(c===45||c===48)?'fog':(c>=51&&c<=57)?'drizzle':((c>=61&&c<=67)||(c>=80&&c<=82))?'rain':((c>=71&&c<=77)||c===85||c===86)?'snow':c>=95?'storm':'cloudy';
  if(w.dust!=null && w.dust>=150 && (k==='clear'||k==='partly'||k==='cloudy')) k='dust';
  else if(w.wind!=null && w.wind>=30 && (k==='clear'||k==='partly'||k==='cloudy')) k='wind';
  return {k,night:w.day===0};
}
function wxIcon(k,night){ return k==='clear'?(night?'moon':'sun'):k==='rain'||k==='drizzle'||k==='storm'?'rain':k==='snow'?'snow':k==='wind'||k==='dust'?'wind':night?'moon':'sun'; }
// Les heures les plus fraîches de la journée, entre 5 h et 22 h (créneaux d'une heure).
function wxCoolHours(date,n){
  const d=wxData(); if(!d) return [];
  const out=[];
  for(let h=5;h<=21;h++){ const w=wxAt(wxHourKey(date,h)); if(w && w.t!=null) out.push({h,t:w.t,feel:w.feel,hc:heatCorr(w.t,w.dew).corr,rain:w.rain||0,code:w.code}); }
  return out.sort((a,b)=>(a.feel!=null?a.feel:a.t)-(b.feel!=null?b.feel:b.t)).slice(0,n||3).sort((a,b)=>a.h-b.h);
}
// Conseils pour une séance à une heure donnée (texte, jamais d'alarme inutile).
function wxAdvice(date,h){
  const w=wxAt(wxHourKey(date,h)); if(!w) return [];
  const out=[], hc=heatCorr(w.t,w.dew);
  if(hc.noHard) out.push({k:'wxAdvNoHard',p:[],lvl:'bad'});
  else if(hc.corr>=0.01) out.push({k:'wxAdvHeat',p:[fmt1(Math.round(hc.corr*1000)/10)],lvl:'warn'});
  if(w.t>=24 || hc.corr>=0.02){ const cool=wxCoolHours(date,2).filter(x=>x.h!==h); if(cool.length && (w.feel||w.t)-(cool[0].feel!=null?cool[0].feel:cool[0].t)>=3) out.push({k:'wxAdvCooler',p:[cool.map(x=>String(x.h).padStart(2,'0')+' h').join(', ')],lvl:'info'}); }
  if(w.t>=22) out.push({k:'wxAdvHydrate',p:[w.t>=30?'0,6–0,8':'0,4–0,6'],lvl:'info'});
  if(w.uv!=null && w.uv>=6) out.push({k:'wxAdvUv',p:[Math.round(w.uv)],lvl:'warn'});
  if(w.wind!=null && w.wind>=30) out.push({k:'wxAdvWind',p:[Math.round(w.wind),Math.round(w.gust||w.wind)],lvl:'warn'});
  if(w.code>=95) out.push({k:'wxAdvStorm',p:[],lvl:'bad'});
  else if(w.rain>=4) out.push({k:'wxAdvRain',p:[fmt1(w.rain)],lvl:'info'});
  if(w.dust!=null && w.dust>=150) out.push({k:'wxAdvDust',p:[],lvl:'warn'});
  if(w.t<=3) out.push({k:'wxAdvCold',p:[],lvl:'info'});
  return out;
}
// Heure habituelle des séances (réglée dans la fiche météo), sinon 18 h.
function wxSessHour(){ const r=P&&+P.runHour; return (r>=5&&r<=22)?r:18; }
function wxSetRunHour(h){ P.runHour=h; DB.save('profile',P); wxRenderSheet(); haptic(); }
function wxForSession(s){
  if(!s||!s.date) return null;
  const rh=(typeof ramadanRunHour==='function')?ramadanRunHour(s):null; // jeûne : avant ou après l'iftar
  const h=rh!=null?rh:wxSessHour(), w=wxAt(wxHourKey(s.date,h)); if(!w) return null;
  return Object.assign({h},w,{hc:heatCorr(w.t,w.dew)});
}
// Conditions d'une séance faite, pour le bilan (moteur d'adaptation) : l'heure qui précède le
// bilan si c'est aujourd'hui, sinon l'heure habituelle. null si aucune donnée.
function wxForBilan(date){
  const d=wxData(); if(!d) return null;
  let key;
  if(date===todayKey()){ const k=wxNowLocalKey(d), h=Math.max(5,(+k.slice(11,13))-1); key=wxHourKey(date,h); }
  else key=wxHourKey(date,wxSessHour());
  const w=wxAt(key); if(!w || w.t==null) return null;
  const hc=heatCorr(w.t,w.dew);
  return {t:w.t,dew:w.dew,corr:Math.round(hc.corr*1000)/1000,wind:w.wind,code:w.code,src:'open-meteo'};
}
// Allure corrigée de la chaleur (s/km) : plus lente de corr %.
function wxPace(spk,corr){ return spk*(1+(corr||0)); }

/* ---------- écrans ---------- */
function wxCondLabel(w){ const s=wxScene(w); return t('wxCond_'+s.k+(s.night&&(s.k==='clear'||s.k==='partly')?'N':'')); }
function wxSceneAttr(w){ const s=wxScene(w); return 'data-wx="'+s.k+'"'+(s.night?' data-night="1"':'')+(w&&w.rain!=null?' data-mm="'+(+w.rain)+'"':'')+(w&&w.wind!=null?' data-wind="'+(+w.wind)+'"':'')+(w&&w.wdir!=null?' data-wdir="'+(+w.wdir)+'"':''); }
// Carte d'accueil : conditions maintenant et pour la séance du jour, scène animée en fond.
function wxHomeCardHTML(){
  if(!P || P.wxOff) return '';
  const loc=wxLoc();
  if(!loc){
    if(P.wxAskHide) return '';
    return '<section class="wx-card wx-ask"><div class="wx-ask-t">'+ICN('sun',18)+' <b>'+t('wxAskTitle')+'</b></div><p>'+t('wxAskSub')+'</p>'+
      '<div class="wx-ask-b"><button type="button" class="ad-btn main" onclick="wxLocate()">'+t('wxLocateBtn')+'</button><button type="button" class="ad-btn" onclick="wxPickPlace()">'+t('wxPickBtn')+'</button>'+
      '<button type="button" class="ad-btn ghost" onclick="P.wxAskHide=true;DB.save(\'profile\',P);refreshScreen()">'+t('mcLater')+'</button></div></section>';
  }
  const w=wxNow();
  if(!w){ wxRefresh(); return '<section class="wx-card wx-empty" onclick="openWeather()"><div class="wx-row"><b>'+escHtml(loc.name)+'</b><span>'+t(navigator.onLine?'loadingLab':'wxOffline')+'</span></div></section>'; }
  if(Date.now()-wxRead().ts>WX_FRESH) wxRefresh();
  const ps=(typeof planSessionToday==='function')?planSessionToday():null, ws=ps&&ps.km>0&&ps.type!=='Repos'?wxForSession(ps):null;
  let sub='';
  if(ws){ const pct=Math.round(ws.hc.corr*1000)/10; sub=tp(pct>=0.5?'wxSessHeat':'wxSessOk',String(ws.h).padStart(2,'0'),Math.round(ws.t),fmt1(pct)); }
  return '<section class="wx-card" '+wxSceneAttr(w)+' role="button" tabindex="0" onclick="openWeather()" aria-label="'+escHtml(t('wxTitle')+' · '+loc.name)+'">'+
    '<canvas class="wx-scene" aria-hidden="true"></canvas><div class="wx-in">'+
    '<div class="wx-top"><span class="wx-place">'+ICN('pin',13)+' '+escHtml(loc.name)+'</span><span class="wx-cond">'+escHtml(wxCondLabel(w))+'</span></div>'+
    '<div class="wx-main"><b class="wx-t">'+Math.round(w.t)+'°</b><div class="wx-meta"><span>'+tp('wxFeels',Math.round(w.feel!=null?w.feel:w.t))+'</span><span>'+ICN('wind',12)+' '+Math.round(w.wind||0)+' km/h</span>'+(w.uv!=null?'<span>UV '+Math.round(w.uv)+'</span>':'')+'</div></div>'+
    (sub?'<div class="wx-sess">'+escHtml(sub)+'</div>':'')+'</div></section>';
}
// Bloc météo de la fiche séance : conditions à l'heure prévue, correction, conseils.
function wxSessionHTML(s){
  if(!s||!s.km||s.type==='Repos'||P.wxOff) return '';
  const loc=wxLoc();
  if(!loc) return '<div class="card wx-rs wx-rs-ask"><div class="row" style="gap:8px">'+ICN('sun',16)+'<span>'+t('wxSessAsk')+'</span></div><div class="wx-ask-b"><button type="button" class="ad-btn" onclick="wxLocate()">'+t('wxLocateBtn')+'</button><button type="button" class="ad-btn" onclick="wxPickPlace()">'+t('wxPickBtn')+'</button></div></div>';
  const ws=wxForSession(s); if(!ws) return '';
  const pct=Math.round(ws.hc.corr*1000)/10, adv=wxAdvice(s.date,ws.h);
  let h='<div class="card wx-rs" '+wxSceneAttr(ws)+'><canvas class="wx-scene" aria-hidden="true"></canvas><div class="wx-in">'+
    '<div class="wx-top"><span class="wx-place">'+tp('wxAtHour',String(ws.h).padStart(2,'0'))+' · '+escHtml(loc.name)+'</span><span class="wx-cond">'+escHtml(wxCondLabel(ws))+'</span></div>'+
    '<div class="wx-main"><b class="wx-t">'+Math.round(ws.t)+'°</b><div class="wx-meta"><span>'+tp('wxFeels',Math.round(ws.feel!=null?ws.feel:ws.t))+'</span><span>'+tp('wxDew',Math.round(ws.dew))+'</span><span>'+ICN('wind',12)+' '+Math.round(ws.wind||0)+' km/h</span></div></div>';
  if(pct>=0.5){
    const parts=planPaceParts(s).filter(p=>p.k==='work'||p.k==='run');
    h+='<div class="wx-corr"><b>'+tp('wxCorrTitle',fmt1(pct))+'</b><span>'+parts.map(p=>escHtml(planPartLabel(p,s))+' <bdi dir="ltr">'+spkToStr(p.pace)+' → '+spkToStr(wxPace(p.pace,ws.hc.corr))+'/km</bdi>').join(' · ')+'</span><small>'+tp('wxCorrWhy',ws.hc.sum)+'</small></div>';
  }
  if(adv.length) h+='<ul class="wx-adv">'+adv.map(a=>'<li class="'+a.lvl+'">'+escHtml(tp(a.k,...a.p))+'</li>').join('')+'</ul>';
  return h+'</div></div>';
}
/* ---------- fiche météo ---------- */
function openWeather(){
  const loc=wxLoc();
  openOv('ovProg'); $('#ovProgTitle').textContent=t('wxTitle');
  wxRenderSheet();
  if(loc) wxRefresh().then(()=>{ if(document.getElementById('wxSheet')) wxRenderSheet(); });
  try{ if(typeof ikTrack==='function') ikTrack('weather_open',{}); }catch(e){}
}
function wxRenderSheet(){
  const loc=wxLoc(), d=wxData();
  let h='<div id="wxSheet">';
  h+='<div class="wx-locrow"><span>'+ICN('pin',15)+' <b>'+escHtml(loc?loc.name:t('wxNoPlace'))+'</b></span><span class="wx-locb"><button type="button" class="ad-btn" onclick="wxLocate()">'+t('wxLocateBtn')+'</button><button type="button" class="ad-btn" onclick="wxPickPlace()">'+t('wxChangeBtn')+'</button></span></div>';
  if(loc && d){
    const tk=todayKey(), now=wxNow();
    if(now) h+='<div class="wx-card wx-big" '+wxSceneAttr(now)+'><canvas class="wx-scene" aria-hidden="true"></canvas><div class="wx-in"><div class="wx-top"><span class="wx-cond">'+escHtml(wxCondLabel(now))+'</span><span>'+tp('wxUpdated',ikDate(new Date(d.ts),'hm',{hour:'2-digit',minute:'2-digit'}))+'</span></div>'+
      '<div class="wx-main"><b class="wx-t">'+Math.round(now.t)+'°</b><div class="wx-meta"><span>'+tp('wxFeels',Math.round(now.feel))+'</span><span>'+tp('wxHum',Math.round(now.rh))+'</span><span>'+tp('wxDew',Math.round(now.dew))+'</span><span>'+ICN('wind',12)+' '+Math.round(now.wind)+' km/h · '+tp('wxGust',Math.round(now.gust||now.wind))+'</span>'+(now.uv!=null?'<span>UV '+Math.round(now.uv)+'</span>':'')+'</div></div></div></div>';
    // les 24 prochaines heures
    const start=d.h.time.indexOf(wxNowLocalKey(d));
    if(start>=0){
      h+='<div class="db-sec">'+t('wxNext24')+'</div><div class="wx-hours">';
      for(let i=start;i<Math.min(d.h.time.length,start+24);i++){
        const w=wxAt(d.h.time[i]), sc=wxScene(w), hc=heatCorr(w.t,w.dew).corr;
        h+='<div class="wx-h"><span>'+d.h.time[i].slice(11,13)+' h</span>'+ICN(wxIcon(sc.k,sc.night),16)+'<b>'+Math.round(w.t)+'°</b><small>'+(w.rain>0.05?fmt1(w.rain)+' mm':hc>=0.005?'+'+fmt1(hc*100)+' %':'')+'</small></div>';
      }
      h+='</div>';
    }
    const cool=wxCoolHours(tk,3);
    if(cool.length) h+='<div class="db-sec">'+t('wxCoolest')+'</div><div class="wx-cool">'+cool.map(c=>'<span><b>'+String(c.h).padStart(2,'0')+' h</b> '+Math.round(c.t)+'°</span>').join('')+'</div>';
    const di=d.d.time.indexOf(tk);
    if(di>=0 && d.d.sunrise[di]) h+='<div class="wx-sun"><span>'+ICN('sun',14)+' '+t('wxSunrise')+' '+escHtml(d.d.sunrise[di].slice(11,16))+'</span><span>'+ICN('moon',14)+' '+t('wxSunset')+' '+escHtml(d.d.sunset[di].slice(11,16))+'</span></div>';
    const adv=wxAdvice(tk,wxSessHour());
    if(adv.length) h+='<div class="db-sec">'+tp('wxAdviceFor',String(wxSessHour()).padStart(2,'0'))+'</div><ul class="wx-adv">'+adv.map(a=>'<li class="'+a.lvl+'">'+escHtml(tp(a.k,...a.p))+'</li>').join('')+'</ul>';
    h+='<div class="db-sec">'+t('wxRunHour')+'</div><div class="wx-cool wx-hourpick" role="radiogroup">'+[6,7,8,9,10,12,16,17,18,19,20,21].map(x=>'<button type="button" role="radio" aria-checked="'+(wxSessHour()===x)+'" class="'+(wxSessHour()===x?'on':'')+'" onclick="wxSetRunHour('+x+')">'+String(x).padStart(2,'0')+' h</button>').join('')+'</div>';
    h+='<div class="db-sec">'+t('wxHeatTable')+'</div><p class="ad-foot" style="margin-top:0">'+t('wxHeatExplain')+'</p>';
  } else if(loc) h+='<div class="card"><div class="lab">'+t(navigator.onLine?'loadingLab':'wxOffline')+'</div></div>';
  h+='<div class="ap-opt" style="margin-top:16px"><div><b>'+t('wxShowHome')+'</b><span>'+t('wxShowHomeSub')+'</span></div><div class="toggle'+(!P.wxOff?' on':'')+'" role="switch" aria-checked="'+!P.wxOff+'" aria-label="'+t('wxShowHome')+'" onclick="P.wxOff=!P.wxOff;DB.save(\'profile\',P);wxRenderSheet()"></div></div>';
  h+='<p class="ad-foot"><a href="https://open-meteo.com/" target="_blank" rel="noopener">'+t('wxAttribution')+'</a></p></div>';
  $('#progBody').innerHTML=h;
  wxMountScenes(document.getElementById('progBody'));
}
// Lieu : géolocalisation (demandée seulement ici, sur un geste), wilaya, ou recherche.
function wxLocate(){
  if(!navigator.geolocation){ toast(t('wxGeoNo')); return wxPickPlace(); }
  toast(t('wxGeoAsk'));
  navigator.geolocation.getCurrentPosition(pos=>{
    const lat=pos.coords.latitude, lon=pos.coords.longitude;
    // nom : la wilaya la plus proche (sans appel réseau supplémentaire)
    let best=null, bd=1e9; WILAYAS.forEach(w=>{ const dd=Math.pow(w[2]-lat,2)+Math.pow((w[3]-lon)*Math.cos(lat*Math.PI/180),2); if(dd<bd){ bd=dd; best=w; } });
    const near=best && bd<0.6*0.6;
    wxSetLoc({name:near?best[1]:(fmtN(lat,2)+', '+fmtN(lon,2)),lat,lon,src:'gps',w:near?best[0]:null});
    toast(t('wxGeoOk'));
    if(document.getElementById('wxSheet')) wxRenderSheet();
  },err=>{ toast(t(err&&err.code===1?'wxGeoDenied':'wxGeoFail')); wxPickPlace(); },{enableHighAccuracy:false,timeout:12000,maximumAge:3600e3});
}
let _wxQ='', _wxRes=null, _wxSearchT=null;
function wxPickPlace(){
  openOv('ovProg'); $('#ovProgTitle').textContent=t('wxPickTitle');
  _wxQ=''; _wxRes=null; wxRenderPicker();
}
function wxRenderPicker(){
  const q=_wxQ.trim().toLowerCase();
  const norm=x=>x.normalize('NFD').replace(/[̀-ͯ’']/g,'').toLowerCase();
  const list=WILAYAS.filter(w=>!q || norm(w[1]).includes(norm(q)) || String(w[0])===q);
  let h='<div class="fr-search wx-search">'+ICN('search',16)+'<input id="wxQ" value="'+escHtml(_wxQ)+'" placeholder="'+t('wxSearchPh')+'" autocomplete="off" oninput="_wxQ=this.value;wxSearchSoon()"></div>';
  if(_wxRes && _wxRes.length) h+='<div class="db-sec">'+t('wxSearchRes')+'</div><div class="wx-list">'+_wxRes.map((r,i)=>'<button type="button" class="wx-li" onclick="wxPickRes('+i+')"><b>'+escHtml(r.name)+'</b><span>'+escHtml([r.admin1,r.country].filter(Boolean).join(', '))+'</span></button>').join('')+'</div>';
  h+='<div class="db-sec">'+t('wxWilayas')+'</div><div class="wx-list">'+list.map(w=>'<button type="button" class="wx-li" onclick="wxPickWilaya('+w[0]+')"><b><span class="wx-code">'+String(w[0]).padStart(2,'0')+'</span> '+escHtml(w[1])+'</b></button>').join('')+'</div>';
  $('#progBody').innerHTML=h;
  const i=document.getElementById('wxQ'); if(i && _wxQ){ i.focus(); i.setSelectionRange(i.value.length,i.value.length); }
}
function wxSearchSoon(){
  clearTimeout(_wxSearchT);
  _wxSearchT=setTimeout(async()=>{
    const q=_wxQ.trim();
    if(q.length>=3 && navigator.onLine){
      try{ const r=await fetch(WX_GEO+'?name='+encodeURIComponent(q)+'&count=8&language='+curLang()+'&format=json'); const j=await r.json();
        _wxRes=(j.results||[]).map(x=>({name:x.name,lat:x.latitude,lon:x.longitude,admin1:x.admin1||'',country:x.country||''})); }catch(e){ _wxRes=null; }
    } else _wxRes=null;
    wxRenderPicker();
  },350);
  wxRenderPicker();
}
function wxPickRes(i){ const r=_wxRes&&_wxRes[i]; if(!r) return; wxSetLoc({name:r.name,lat:r.lat,lon:r.lon,src:'search'}); closeOv('ovProg'); toast(tp('wxPlaceSet',r.name)); }
function wxPickWilaya(code){ const w=WILAYAS.find(x=>x[0]===code); if(!w) return; wxSetLoc({name:w[1],lat:w[2],lon:w[3],src:'wilaya',w:code}); closeOv('ovProg'); toast(tp('wxPlaceSet',w[1])); }
// Scènes animées : module chargé à la demande (weather/scene.js), une fois une carte affichée.
function wxMountScenes(root){
  root=root||document;
  const cs=root.querySelectorAll('canvas.wx-scene'); if(!cs.length) return;
  if(typeof ikLoad!=='function') return;
  ikLoad('scene').then(()=>{ if(typeof wxSceneMount==='function') cs.forEach(c=>wxSceneMount(c)); }).catch(()=>{});
}
