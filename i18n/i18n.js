/* ============================================================================
   IKORUN — TRADUCTION : t(), tp(), pluriels, nombres et dates, langues à la demande
   ============================================================================ */
function curLang(){ return (P&&P.lang)||'fr'; }
/* Pluriels (27/09). Une traduction peut être un objet indexé par catégorie CLDR :
     fr/en : {one:'{0} membre', other:'{0} membres'}
     ar    : {zero, one, two, few (3-10), many (11-99), other (100+)}
   tp() choisit la forme d'après le PREMIER argument via Intl.PluralRules (natif,
   iOS 13+) ; t() sans nombre rend la forme 'other'. Avant : « {0} membre(s) »,
   « 1 days » en anglais, et en arabe la forme 3-10 partout (« 25 أعضاء » est faux).
   Repli si une langue n'a pas la catégorie : 'other', puis le français, puis la clé. */
const _plRules={};
function pluralCat(n){
  const l=curLang();
  try{ return (_plRules[l]||(_plRules[l]=new Intl.PluralRules(l))).select(Math.abs(Number(n))||0); }
  catch(e){ return Math.abs(Number(n))===1?'one':'other'; }
}
function _pickForm(v,n){
  if(!v || typeof v!=='object') return v;
  return (n!=null && v[pluralCat(n)]) || v.other || v.one || '';
}
function t(key){ const l=curLang(); return _pickForm((I18N[l]&&I18N[l][key])||I18N.fr[key],null)||key; }
function tp(key,...args){
  const l=curLang();
  let s=_pickForm((I18N[l]&&I18N[l][key])||I18N.fr[key],args[0])||key;
  args.forEach((a,i)=>{ s=s.split('{'+i+'}').join(a==null?'':a); });
  return s;
}
function localeCode(){ return curLang()==='en'?'en-US':(curLang()==='ar'?'ar-DZ':'fr-FR'); }
/* Formats de nombres et de dates (V3.10.3) : n.toLocaleString(loc,{…}) recrée un formateur
   Intl à chaque appel — l'opération la plus lente du plan complet (des centaines de dates
   et de km). Un formateur par langue et par format, gardé une fois créé. */
const _ikFmt={};
function ikNum(n,k,o){ const loc=localeCode(), id='n|'+loc+'|'+k; return (_ikFmt[id]||(_ikFmt[id]=new Intl.NumberFormat(loc,o))).format(n); }
function ikDate(d,k,o){ if(!(d instanceof Date) || isNaN(d)) return String(d); // comme toLocaleDateString : pas d'exception sur une date invalide
  const loc=localeCode(), id='d|'+loc+'|'+k; return (_ikFmt[id]||(_ikFmt[id]=new Intl.DateTimeFormat(loc,o))).format(d); }
const LANGS=[['fr','FR','Français'],['en','EN','English'],['ar','AR','العربية']];

/* Langues à la demande (V4.0.0). Le français est toujours là (i18n/fr.js, dans app.min.js) ;
   l'anglais et l'arabe sont des fichiers à part (window.IK_LANG, index.html) : la page charge
   d'avance celui de la dernière langue utilisée (localStorage ik_lang, recopie non sensible de
   P.lang), sinon ikLangEnsure le charge avant d'afficher quoi que ce soit dans cette langue. */
const _ikLangP={};
function ikLangHas(l){ return l==='fr' || !!(I18N[l] && Object.keys(I18N[l]).length); }
function ikLangEnsure(l){
  if(ikLangHas(l)) return Promise.resolve(true);
  const src=window.IK_LANG&&window.IK_LANG[l]; if(!src) return Promise.resolve(false);
  return _ikLangP[l]||(_ikLangP[l]=new Promise(ok=>{
    const el=document.createElement('script'); el.src=src; el.async=true;
    el.onload=()=>{ if(window.IK_I18N_EXTRA&&window.IK_I18N_EXTRA[l]) I18N[l]=window.IK_I18N_EXTRA[l]; ok(ikLangHas(l)); };
    el.onerror=()=>{ delete _ikLangP[l]; ok(false); }; // hors ligne et pas en cache : le français s'affiche
    document.head.appendChild(el);
  }));
}
function ikLangRemember(l){ try{ localStorage.setItem('ik_lang',l); }catch(e){} }
