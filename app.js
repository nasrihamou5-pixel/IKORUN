/* ============ IKORUN — Elite Athletic Intelligence ============ */

/* ---------- WATCHDOG DE DÉMARRAGE (tout en haut, avant tout le reste) ----------
   Si N'IMPORTE QUOI plus bas dans ce fichier plante (erreur JS, promesse qui ne
   se résout jamais, etc.), ce timer déjà programmé continuera de tourner car il
   ne dépend d'aucune fonction définie plus loin. Après 8s, si le skeleton de
   démarrage est toujours affiché, on le force à disparaître et on affiche un
   message clair (avec le vrai message d'erreur si dispo) au lieu de laisser
   l'écran bloqué indéfiniment sans info. */
window.__ikorunLastError = null;
window.addEventListener('error', function(e){
  window.__ikorunLastError = (e && e.message) ? (e.message+' @ '+(e.filename||'')+':'+(e.lineno||'')) : String(e);
});
window.addEventListener('unhandledrejection', function(e){
  window.__ikorunLastError = 'Promise rejetée: ' + (e && e.reason ? (e.reason.message||e.reason) : e);
});
setTimeout(function(){
  try{
    var el = document.getElementById('appSkeleton');
    if(!el || el.classList.contains('out')) return; // tout s'est bien passé
    console.error('[IKORUN] Watchdog : démarrage bloqué, déblocage forcé.', window.__ikorunLastError);
    if(typeof startLogin === 'function' && !window.__ikorunLastError){
      startLogin();
    } else {
      el.remove();
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;background:#0A0D12;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-family:sans-serif;z-index:99999';
      var _escErr = function(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
      var msg = window.__ikorunLastError ? ('<div style="font-size:13px;opacity:.7;margin-top:10px;word-break:break-word">'+_escErr(window.__ikorunLastError)+'</div>') : '';
      d.innerHTML = '<div>Erreur au chargement.'+msg+'<br><br><button onclick="location.reload(true)" style="padding:10px 20px;border-radius:8px;background:#fff;color:#000;border:none;font-size:16px">Recharger</button></div>';
      document.body.appendChild(d);
    }
  }catch(e){ console.error('[IKORUN] Watchdog erreur',e); }
}, 8000);

/* ---------- CLOUD SYNC (Supabase) ---------- */
window.currentUserId = null;
window.currentUserEmail = null;

/* Logo IKORUN encodé en base64 directement dans le code : plus besoin d'un fichier logo-mark.png
   externe sur l'hébergement (c'était la cause du logo qui n'apparaissait plus). */
const LOGO_MARK_URI='data:image/webp;base64,UklGRvIjAABXRUJQVlA4WAoAAAAQAAAAngAAdwAAQUxQSF0VAAAB32e0bZs5/589OA1HRI43s0LIhQTDSFKD8N5gRvLpv2BBW4jo/wTc9/qa1a7fEvlHEuTKzE4tPGu2Wj5BA/a5Ogb7w9PYtjjndFuyJQGZqw1bb2BPhhewJ5iqKnNVJYD6CSTFWBW50npPsSOCgaBt29T8YX/vpyOIiAnIl/BgTG1M65rWBmTApM9GZm3KFWXuNvRx2PQtSZIlSZJtIYnP/U/m/z/u2qn84J7zDRExAZ6wbV/ntv2/635er/eMbNmyHWywjGFyPg7VZeauPsy8+3yWzLRiZuYwQ7lhKoWZzA5I8sD7/dwLjWicZh0RE/Cfu7oxy6aT3i3a0s2rrbZdtvWxl80tb6N6huTPPbUs7Dnvnj+f+yP3xtx270w9phs7HmsLr8qPvEcTTTZCnmnDRNb42ts2ob3RjHV+t7O0DQZNx7aIhjFsf6booltky16drbjG7LpZiwxz2Yx98RbO9mJlXcI0VoOLFlU6S9q2XKfGphBtQ6zLayW9LijEy8+pllm2lRa3NgvzszGoOab+0i2ruE+2LfmerbOs/KysZNNprppZbK2V3rMjb34mTT6+wooVxTKVduLUHU3VpSNyKCoUiTUkPHqdrqdNYtGGYdjqNrE5Z20WZ6qhqPHZQ+wx7C2h2FTMpcwsebRF5ucmex1vW2yMMx7pCw3b1rJsB33dJs2Za/OqfOc5rTNs8IWGzZvvbVW4GqxLmfa0lja2rVn3x3iNvVkyU4uoYa8F57Y2KJdc39hXdzVl36Y7nSkmGy2aVv54WIPtacEGay8zmecX7a3tz5ru1ub2xhk9q1DGRCDoEDhlIxH9/kJbAPNnTas2s9G29+a9Xma2dch23lsVErNam2Jk/bRpe1ZbG6ZOs7BjYsoYR0bpbewv7Drie0/cW6WIV9n1wp8uNvZms972LD0/t81UzzIxetqUvSmx2raIjE5Ub/N12ZBhDELR9AYvbXrfD//0J++vCKLDsExjLyibcePlnT3x1GRYbKzM9jW6tyubt9l6FvaZsbH24JSMJdz0PBj7rd/3Cz97/CsPsMRx3kbeJDNsSzFH88SYrcqwtsY0gz1U2jST7zxiw0yrFZ2wJEWVh+M3vvuXfv6syiJ7bZB4a9hs63Xs1WJ0Z0pMZX1vrUa+sxmzdxdfeTsTM1FmtJBvLyk1ugEnb79kx6YeQw4xfklGoGU1W7M7tkm3H+OLFSZn87Owsd7O2901wlkOmUtSrW9jZhQlSo7aLWd9+KIjoesqL8NgQU4Ixo09qV5v6/S9XSpsXbdY9qPxZAeZVeet20KZli9yRwTRfT5q6Maz7/rIjpMgHcAQ5eIhZKNijSnV7NEl7Gr01lxWDxuj+lNkW9wpmziSo6gBIeEOIZuwCFWNhv1T33/RWyE7FQEd0A2GDRo2r9KyFtFzd3vrOcOG2fJkmXdrUvdpcA6qSbQES8o0RgYiotFw0Lz5vTtPDZwqAkSHYDwcofeM3tOlGeaS73ljPDP2fG81wlGaxOPss6EnibRhcOd0kYCodTysJ+147zk96BQstTgE4HY86jDfm/I9Y9VfHsP89StTW21J6z3qjYueUcnP9sMmHSVCim6so7d/YPtm6BQs3w0BnG03TlPWfBfD0DKyLWkRf+JmbaZXvt/u9Hh7qz2fs7Rx4gE7rYgoTQ7aLds/uOMo6CSxQo/xhK4dLZKM0taJlWLe2Gs4w0SL0XbezIw387xDa2mj4c8gIdW+PBpvOO0DO0+GdIiVyh0T7czOjPizlbU8tvx1trA0a4Pn1N6ymYfVnsdVuaQZ+bkjUOk3Hvgt73//KZAOscpsmejOncmM548kbbVrCHvLbiXfqamTadNgq8ldcSqrlm0/7qqaGY991M73nNeDLsQqE49ZJtW1znJtokjWuumrVjR/+R5pk9hsEnU3dZYwMqQVBIpau/k87vwPbN8CnYI1fIR3l8tKaazDMIPCVutWapsNauZMcjAvc0kvTiMFBimi1DIYbj3lgzuPgU4Sa/oP3/3Dtc34lFvbp28rUmdrY9i+sLWV7w2Wd+k4NXhLJ9tSEhFNHeTmN7/3krdAOsQa289znxrdVZIua9o1y1ak2yyebIvJy6zN5twX12QMH0lARBPDjJM+vPM04Qyx1oZh7K5W+iG1YkybRV4lr2pmNq5tZV3qlt29Cmny7GJKKU2ORifvvHj7DHQK1t5Gfr+po1Kxdjb5+2NuzmoivMIkq5sdm5OKtZpXn60pJRZ8wvZ375iDTsHam67F4EF3zfy6Bymjic2eLCs0M5HLdu+2Yt2tWlMb467PPylHm8/60IVHQ0eIde3GLK1tc3VSXdU0uemH4j7nzKRFaHfBtR5Ztee0lbm+79/2X+be8f4db4J0iHXtGI9YOqja20WnrmWXV7Kzfp5nrAYtSW2Hlu8gTAqEQqL2lIPeW3e+7+3gDLHu7/lu23rP3aXqOkI2jTVrm7a9DV5jIdqkoCkCGwHUWqLmYn3rBZecG9ApmML8h++Z3m27TzUlOjI/37TZw3usmDWVmO9juybHQQoF1H4/Xy4nnvuB7RugUzCV2fqd9czbKsJ2RtbNltm49ja/hxlmj33uz1W6fBvVyOiX1rNnfXjHNugUTGmav87bMLJtrZV50JaNpTTZZDbT9dhKS+pmIFFKcddtOmPnhSdCR4hp7RL/6EN7z9jTvnNsKWPIVcr53rBJeBih27Yi1NPiwqa3vO+St0M6xBQnE6vP9bktYtq6k62oLT8qtdnzczi/km65s7lUwov1je/7ntMLzhDTbLPsHHfe4FKRRsryHR8Pa4+eJLTXH3d9egc97T7/VF/xpz58bNvSKZjmFszEbW+9d+WtGGXQchOS9RYeObRDZMRYRTLOdL7r8xdvoMtguoXNxGJWQ9t6nzIFKWlqWbSZFav5WW23QTUEkMM3nElmBIdvbfenhjbaZ8n29UdY3ooGb1b2BOM02UpZkM5gbiMOMe3GXka2z7aw1/QOGcmy28yrGXuRsNGIjLrWaSRn2zyZKQ7HZLJUNn8+p20880lHme1Ijetpkb8ssiSTkgSnu3hkT3BYDpcRHeqsWbCzu3dZs+wYREyIGko7WGV1meN23Nv3KD4sYszEhM7dx0NtsvaRTc/aQglpIyt0KzFnsb63bMWevxsz/aZlosJRQtdoU7e5a1RGhFxjs7WbonGxWWJF1jVwc2er6XPL0Eu0NEotr4fu7lzvH3eb5clmJDR70VyLNfnDiZVfNgSj8uieYqY8s/K/f0mMIVBJYQKlImhqyTrTLS4WWsuZmfkuFhkJjcZtOpMEBrJz/4lvYqY6M4K9f/gE0UKhkEqKkKtiprrpg46Y2fLIoaLOMpv3BI2VxmkHmdiNlmw2nT1m431MtbsIeOLf/3JXuENFJuwAKYp6vTLb5Kaj9nZv23jbk+rogK0hzXx3c8zP4WXnXaqZrqPtGI++2eGpcVLgmZsu/dIiZQxRhOUgS4mIXqPZmabuHx5xdO/BP+qdNFCCn+0tRTFFpH3GZk0fr5y2wEBu/NZzxUynkwLP3/z/X3oFamcoAWBRSgmpmd3aW5gfzB0xGrd33vqZHEUu8cY2WzeomUJ59P/1Coa6LvXiI5hpdFJg/xf/96YXoZAG1TBJsZvahDb1NK79bmO2besrFj778nwBOxlflWlWrFxms7m67SCLcXjsxW9h1t9JgX1fuuyWPVBIA6phh0U0FfXEeHbThhy1bTsu7b+ccOHTm3siZfyjab5nUKxgaVmk08tjRca9qXVbUuDAly67cS8U0iwtTWNStYTUb0aLm44+Ym7Utm1H9vb+6xlnPHHkNoRtUzGjyJrvZpktrj9R2GDJafoP7A+zrk5K8OJX/vduoJAtS6VanEg1mIl+bDvplNNPVmBL8OCfHcezVt3Lqw5bECTEuGbubm+rEoABj3svPCCzjk5XmP/KZbcChWxZGhEKkijRhPKV5sRTz31TA2kJ4JW/Pm3+gErA60YwU6Jv+7VUmD5XZDHRDL6JWXOnKwy+fPl1QChbJpZCWIJSmpILet1Zr39nH1ICsHhq/tyDL/ewctq6ezI9+XGzGUXtGn0uhJEFMndYa5ZZYXjrlVc/BhFdZ5aqFDsySpRahgs+/qxT5tqWJJjo4JndwwODYtvRqigrErG+alLXujtlEqGIIuYe2BOsbWaF9tarrnwEIrJNACkiUg5FNPXQoDvurLO3tm07QmKyGe4ZHxq0kEamccOzJd9BNY7CtZX7MVH0DjyiXItsK3Dn1Zd+B1QyWSpUQ0IupbobDo8/+7yj2rYdocLy5sDD4/FgQJgQlJSGeZSghpr7sVq3EmAr6sH7MKvOVhXuvfaKu0Elk6VCRTIoapHnB8edef7JbduOUMFeruXArvlB57FCDqQksbWkxvlOmRrLkmyErGjG/RSrzFZV3P+7V9wF1EyWCimqwxmllDw4PvHUi1/ftu0IFWxW2JVdi82wS1tQLbGvGrI3TEJIUY66lgwTctNeqJVlFsG3rr38DkPNbFmqcClRamlqr0/bHPGWD114DKRDrNLw/G63mdhL3xZsP2pfP/Ocbli8sNKEFc3i9s1dWS6zCL5zzRV3dFAzWyaWIkdkr0avn/LGUz5wwcmQDrFqF54bedhiTEJNHsTL2orJlkpnJl4MQygOvuHkrEzMjIAHrr7yjhZq2kxWFQ7czDS9QXfkaRef+1ZwhlhDM3xqpByPAeyH6mnbmEVhInOWXKkZ2pzVhM6zADIj4JHrL/v6GKrTTJQUQlFceqPMuVMu3PkGcIZY41eey25k2yBElbDtbZ1XJ0U4mo9Efn6sK5LuooLIjKg8dsOlXx9CdZrJEWEiVKLEwsszb/zgBaeCU8Eamz27SjqZrGCYcc3vHCcLWmUJlVRSf9cpc0kbUXn6+v/72gCq00yUSxGOKCrdcHH2vO2nv7NAp2Ad9+1lNDZgbOISsi1WY7SxOFmpaVlFSKl9/VvGlMJTN1/61XmoTjNZETQQEdWjeZ/80TNpWzoFa2/x3MEZ24BMAItMuy0hEkNro8WRFf3Y+o/5g+fVRs/9y/99cQEKaSZLURQ1Sq/XjRb1pgsvOLJt207Bejp4ZtwODWBkW4VauKvUjwUpLLq+vTTfto3f9tT4yX/6xBxQyJbJUpQopZR+v7g2J+y88IwZ6BSss7onR/7Md6kM3QtZEOZZiTR3lz4G2cDC5ZU/vPSTW4FCtiwbEagp0czU8WjDsZd86MxZ6CSxzublp1T++A4r1CRJbnkzbyXYqOZicb4lbDfbgFLESkM1a639Jsczx57xofPnoJPEupv9z3nIz6kkKWM/EpO0Zsid7LbIxQJEtocoRaxQopRwr7od1BPO+tD5W6CTxFTu3keXy8zNMDsXxsKktyw2omlSRDHYZCtWKIpCilJYPDR35gcuOgo6QkyjYddC6Vh+bynJxKLJd3llU/oelYn5aZF0LC+FApdadXDLRReecxykQ0xp8NS8k2U3I+++rnZB+9EEQRXtGA/asgASTYpALllq03uF793RtqRDTKuDXRSz0hLtRVOCjSHv2vrBVYo6fxUGqAIpmpBRLRtnXzj9x9t25BDTaxafJ8wKn+8afGBvGW9SU1vuJBZVhoy9hQibCKLU0mycbbad+SY6FTHF5uVnsFl96q2xZeS7jFBN0UpEy8z8LIRckojexv7sliOPa5CY8oO7SVaaFC8+W5TvZtIwEjtMkma12Yj1gchiXEMbjpg98m2kmG6z6yAr1WBj1v5sLJmXSqZEqi9aDYZIVIWkJOrMTB3rXduwmGqL3Qt4BUZrwtoLitC3etJwMlkM3diWWlFCIejPzB6Vgy2I6Xawayiz4gQvEWqopIzdgk7NRcvke6Hv+2QhxUY2zx5/SoOY8uBpwqzYC9te1dtxvnNFrWRfQkFjX7MpuTsXWUppms3dkUdjptwsPIfMyhVk2J+CasoIYgszF9WE5MnldN1R1Ns405vPOawpMy+/gFh19pd3g03567CSBdFqQTZOJ2STQiH1j33jSUdwGO7bhVlxKtZ1tTXZzDRRk0jDTX3wAw1HYJQh6G304KQ+mr7dBzErTlQXYVSsDNlKkc1WfYrVxBF3XYpERDRSPWIWM+XueGGeVVZwCaObTaoUle8ydpIo3/fKyV0EkkLNhvrKZqwpayvPtPIqvovQqSBlSElW851bJVHOajN9kmSrV9vFt25hyjOLDvwiYVZboq91kyxbtoIxN4JWSqbJz/pcZCKYOWbbeAOaIqeL8H//yuOYNUgYneSvKxNqGlnFKbFWarO6OtKl6Y3HJ4eZWicFeOK6f7qbwupLtRDuItGQ70FFTrrarFiU7lP/dIomOo6ewZqSzAgY3vWVG+46RJBrIN8/ZnvJEmraGgs9dTV6lPmOcZKENLNxgWOYTjuLYPdt137pUaA4Wcva3+binOrGNC7YqrQidCeIjIxUgjq3pcc0Ol2Bx7981VcOgIrTrG1+RlQoVkK2YshfVxJOpm/Sqo3GR/fRumWqwPC+G2+6ewBFmax3X9UUXadPLsWJikJ1Va7OXQII2jqzdRPJ+jpdBAdvu+6GR4FCmvXOd5NMyowqY07SsCp3xFTnQKqFlzYdB1oPpyvwxK3XfGkXqDjN1CYNYcycSiYtbQldnNnMnSOimY3xDOuZqQLju2658e4BRGQyzany1zWaQdA2FrkFFZ27I6JH78TNrLnTRbD/9htufBgopJnyIt8RIuavQyGoJd93n/sXoh+jLWGtjbsswMNfu/7Le0HFaQ7D0K985+d+1N/0ORWEDFKtpbdhE2YN7IyA+S//8vkNEDU4rAMQk0MIJvlZqCyDLVwGG47FYrVOV2Dfrde+CaAU8WooaRL1JVT+erqulK0gZmbiiDlWnaYAD37p+tv2gmoRh38kVhyUn+tHdLE6ToJxzJ64Fa3IzghYuPPGG77ZQVHw6lhipfn9a2kUHLrPx0b90e5N1WJ5pyvw7K3XfPlpoDrNq2WWSpP+GhPyXVG6+/wTCvnIrZhl0xTI+2654c55UEmbV901qHz3ZdPoc//0r1Dnm+OwljjbInjx9htv+SZQlMmrsljb/qZk97l//o9SNLuVpe66qOLJ267+4i6gOs2rtNbK/8eQKCrNMeWTP9rLyFSB9v5brr3rEERk8t1YyxAQnumr/OD3u6MIXrr9+hseBAppvjuLlVoiZsdzP7lz3ACPfeW6r78AVKd51feardIqs3vKr54G3Z033njPECIyec0oXBcu/K12zz033vQdoJDmNebCBe/757//yh5QcZrXmLbzhR8HIjJ5TWoeoDrNa0sAVlA4IG4OAAAQPgCdASqfAHgAPjEYiUMiIaET2o1gIAMEoA0EbAeb5Wn5193P3G/zfRSnL68v0P9P/Ento+YB+iv9J/oH7gf0T3APcp5hP5v/Qf8T/dPeS9JH+d9QD+w/6rrDfQA/ar0v/2g+C39jv2T+AL+Yf1v/rdYBmH+4d9g/dvx3/azQU/bz8d+W/KTwAvwn+M/2n8m/y+5tIAX5H/M/8F+Yn9q55PsH7AH6uf7b1d73by/2AP53/Yf+L9uX0n/z//M/zP5de1z81/v//M/y3wA/xn+Z/5T+2/ut/hv///5vuw9kX7Vexz+rBlygcYosBJhG5X8rw/ssPKb+0RY814XPxWPF0t1iqE6inKurYM0R0PGJ2Y5ZSkXxTfufvwF+R/pCz5/cL2oIcHYUcpjYOrF4UP8FZIX7Tk2D/02d+sKjQ70csAYTRDI8etXmzC4GW68K7ABQsoQ3nnbm4Q4z/YT7ZXqsEsH5OjLNffoTT5H7BfCht85nF/+W3nXjc5k9g3dNyiowh/xprUMID030gXpp78KNhINv/+2c/l3/xOMTvHp+MdgLz8S73vQlIxtvTo3N4r88xgV0LZcmeiIxN/UXt1TKTBTWiJwGgnLRmD2HR5dhao1uqOT6+fHTLmX7OR47/QA039lISAbciCfSLNzS5IhYmu/25Elx9vAAAP7+pbR2HODcoPD94sg3abCBT7gTStpCH3MmlE4F7lA+7jhSUO0r0rIPSeLRlux4DReXtok8anQg6KGjQssuqDyFxaOVGiumSpWPd1xMkaPvldxfFeQBFARwq3rF2kt7chqqk1UFoLWqHB/pt0xcBc6od11FPmEl+x8HqvUDiYw2FnlUxApeixAzC1nb7+rP1GOttVOlvtF1z8cX+ZnqbGIjONGoLlWF1Vfr2WEEZ95mh3mK/LghykxRNNSNizR4FeNIMTse//SZ57Eh5nAgSUmD4v9iLdxdJpx9F6CRZ15JxeOKQ6QTPpXfqqrUui1XSvENsdjJTGIQAQHyRlPR80BZTuoig4zm3MgoQYCA60ZT6H9xxQg/9PEhHCah5Tb4z9K5Y+Sw3AKgu15mXvDg/fiUB6G4WNTVOoQy9Umaq6brta0KP3zNfxLvVA3HpxmlcqwK2vobbhOcBJ4ORUHA4jmyX/anLQDTtoIzFMLHIAdbU038CdH+GwGAnWXIEJ5hMj3exwOGvRA2S02H9l6IhrizzpFn7g7l/yBjHq7yl3IGf3e0SrN7HpC9EGPipYec7f5JKmbibYLytAm0gvvh8JkKP3Kje5XDgbs31cn44LaAclzqX67iOD//8Fv2JFl2lOMsIhELOpRwHnvSLM1PFc4Kzt/rShCLNDs2vKrZfY59guc6OQ15q6rLb6iredBOY+qoNx06vI8UzB9TPGwlVC+4I2a5SKPjemC9yjJlUMnmf6SjNCuSZqf+Afse+w2ksTEH6w59Wp1xh+5zZ/R7KV5d/sjrAjaANXw1CHwu5qrLVY1fD/RbFn5EzuY4PHTlMNW6M8K0IAGb/4OScIWAu/8qBsdlmLeyPlF4H/7CEAANv/Y/7B/Rx2nWPa5Vzj8GAys2/H2fSWYvSySHeZIm9qqgTHZ7CtDn3dKENypRlTiFQ0Zvo351diEkid8s8nkYbjMceSlrKbl6bMFXX9ozKZ6nGGb7Cw1Db51dPFnSBDZsNYtHWEYRjyrgp38wbbrMKC0WoVunhG7vwc8lhY7bb3FP8g2/mHmc8dIGRZr0z1MVx/I9FOC+pHUg5nz6h/4e8aSPAafvlk+qfGODftaWomOgibzmCru6mp9JfoJgMqd5eYeK/SqLp09j50v8ewMpbzkJPfRD51BeBLkyuAHJ2zWWTYqDOAiILNKnNDz1ZKrv0KNk3xiQ2I11awdR42VG9r0z2gHxHuUtdpwaoA29SILsjHVMMlnyWrCPeE4uUoJsvRXsQ1jE7HSrWapSxyXTUPPR7sq7W4X/Dz2grQIcECivjHm4C2fJb+gEz2ykyQnlGvpxKI/nPIrTrnMcmPHsIMEcqMzWXGbpx12LhY/yTlHJV0VOnxPEHMIHeE4uxvfXn7o6p7AD3+4v6yRvh2Jju4Xatbzpxr+CPzoNvf5/6GiD6FqRXGo0r+tIey0HU09AChygKwI+fNoisATdKB/3nK5/ZH5oQjTuYK0TAKXDxDLxzLsncTzRRNHW8gcScw95B4rmOPIEj7MWW6F9aZu/nsCJe0ARG+Wg4XfJfgFdtcCqTOezzmxpQosfKPaG2/BcqHkn0V4faBcc5lWA5NRx7Cyy1I00Amye4hfuDGSXMy5ANWwFxzkDBfny9Ycv9uAyYCLGbaztE8K2l7jkaA/uiiQuLZgMhOCnofJr/sKZyINS7kzMSHxuth5DowK52bSoo6D6rULzR5zzU/jaD6fbCfxcwYpRv/zjFqPIBxfpPhqsWeISRFjY7ok245iQdD0PLZodarjvtHjnHSdTmmOXaobpSAW7M2J7dy1Pjv4URognORzA41JFqUiYSv1qyEqj5Dre425encZvNoepuI8feifQu/wyPrmzMcBA38KQPPZxC0UOFetolWL0wmYNAyxHy1ECiv26fvC4v6PywYGW8jv5HZrfh+WE/34quq3Gq2glk/H+oRn4l4QPQrOlWWLUio1Oq/LoDnUqUAF6AhlFVjLrw/F+377L2WsS+PTDPMr1c8pziTNiUTfAGUUcWFeN2BRiyeCqvc0nhIV5yxJhVU6kcjPO9qW0f2lgP2MMN8/Jb27g7tENh8N2T+ZOUSfFVY43F9kYwMm4BLDOx9TQyPDAQxt98BjMcqhHBvb8/RhO/UF8LZvgrbGcr2SRCEd85D73altU6UwYeeBLCCDCb66oO08YeR3NiS8KZ/HeR8FLlSlfzwj4HAPUC2hsT37aXAWKR3kQZ1qbBB0+agg9MsJF64Yq237/mi/FxX/jCLQZ/iTPvvX1TSUboJnuKvQc+/dU7zbIr6VfCVAzfkjTCJX38feIF5hcKdlN5U5i5PNroNLA8qjR9fLrKAfu2YNUz5mug4sDQdpuVRrHST115zSYY/Pv7NkZnab6S/3Fh4Hn5rp5ynaHlm5HcSluf1zyG4lG53OA5sziOcdBFUxH49vbYrplxd+hyanzv+pTs/F/9X7H/rnaPeIKJeWa8g1JHwVD7vE0MtT9hHkEPWZapNRC9gUpd29L/oRvNcze167PpJvjuPL2W5tXwoz2B20fgXUrcQukePxRiSuS4oKyqM26JyhdrmYVGbG2/WNqAy5lAHeZ1etxZYHW+qQfbL3LekOyDWeV/jOSQkxg6rbAhWuUAci7XOuH3UoojK05IxxValnKb6oUn068ph73+zq4UDEYMgyBOFWLNmiZ2+z6+8mmMB5l45yLcPaoQNJ9rjtt+xjpcJI1p36swmWetocefcpr07NoquZ7ZS93AIpL3bps9ugFViGk+JU73KrrRX0DUpXNz5IRKcykfdtfzsLg4ZV8zeZWFcO74HYo9APYWMUqq6SeQmk3phzJRFlB3mfZCKMbOnFfzU6BJiu8nzj5lnpvI/W+lHGVcIjDy8JkqCOjtGc0hXkQ656nYblcAG57vc4d15gpk8sRtVAKyV+wKmGyEkaXyZDEFlfTNXlClvC6E/4avgKMXBX8OwPwwTgacxGbcuKnPqBswrfGwpzqm7yfhEefPpQBTyW953TNQ9xw/jWQX5vd9UPi3z+XS6//CUK2PgOnznvlDm9s9QkACbUey6Cbk9JU9CMcmkic2WqSm8zeCLpWD+VRLPmf/oAn9Q4/NVPfx9jGByv1E9JM11g4zMO3//KgtGrLd3FTmVx7Brf9rZqGjj+6mI59f4UiqscSQ+9KWvMS7nWIh82c5uulFWU7QCOphO9B+75zNQPuQgJkX2VPJzkoeiECX0M4I8KZ+5a5cgTkMd3rXXGHUIxHOqZ9y/t/45zzmJxeEsz0OxiyDW2wtAqv/wuXCbqnICbpU16iW+BUHi/V5KoVlMecAmoiu/KFuUTEPuWTFZuJoL8371+YB6WR9qbjEp1mDPJPVk2R9JqJN5iT65Bd/G/jm4Xg6IobUqx1gAAur6TLkyNZh4ewDZeENpSuB/tUbag7Wh+rrsePAbRy+XqS90i44rzFhNXnqjC04hCkG+0yzI8u/twMDNcFtDlIsXpWCGwy5fgoFey7/D0ff76hw67u6xfkD/ZmOoXvrzN1vkxslbqtm1FcbFr7Y1xNhYv/cN689HIfeFA3vjEc8X2bhqDa7T9ZQ3UXyjzILTq8NDUCcunvlO4OxFJRbAufbL6hjmLscKuZyOQTgW7BWphze/05SRlyURGGaywDRv1XoGFZkDvQRaOsMaVX6Nn2GJxWzjYrPIy8Plvmqf4OSDPfoVDAao0jzKDm3ejBE9TT9Gf+96+TZ9SLJhmJZWUolTnAxOCF0BpZYNCtB3FkyyMUHGBTVeDEOI+aYQ3ypiqbOM+2MrfwYzQ7UkbdTpKNJRYhLGgRHZe1tmkAGFHQ5jswOt5A27ZyT74gilNveb6Zofyo5zCaQgxF3v5rhyVU8Tg/MEYBFyEta8NGHniWGOyL57wNk+afOl6gfE0Dbpm2PHiw9zW4hJ/4nyuZMbzW2jVszSTCbjSOy50zafWXlfqdMc2QDroT/+VVVPEgACS3yiw7mmj64IsvzDr5oeAijKdY7vAOrPizxrg1oTZ3S+ci11fpPjRn3h//kfNJV/SBD/cuBbmZAJfu1rj+O9TbI5FZYZj1x8kRaEph7mWiJ63ac6bld2MrmG/14xH9gC7LWCafzfp6bLRNTkN8d8lNnDAjivZ5jX63O6Ou8f1cHVV/g5e570v0BI/ToH2tmxqaEVCPTIbykIpdqIk47JrrhsKne+d//h207Whg4zmpK9xl8VJEfc1qAVqwPlpbEDjjjjaPT+/ZVfxckbiDm6AAAAAAAAAA';

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
    // Sécurité anti-course : force l'hydratation complète de la session en mémoire
    // avant la lecture. Sans ça, sur une connexion toute fraîche (1re fois sur un
    // nouvel appareil/navigateur), la lecture pouvait partir sans jeton pleinement
    // prêt -> RLS renvoie 0 ligne sans erreur -> l'app croyait le compte "neuf"
    // et relançait l'onboarding alors que les données existaient bien côté cloud.
    const { data:{ session } } = await window.supabaseClient.auth.getSession();
    if(!session){
      console.error('[IKORUN][DIAG] cloudPullAll: aucune session active au moment de la synchro');
    }
    const { data, error } = await window.supabaseClient.from('user_data').select('key,value').eq('user_id', uid);
    if(error){
      console.error('cloud pull error', error);
      if(typeof toast==='function') toast(t('syncCloudErrorToast'));
      return;
    }
    if(!data){ return; }
    if(data.length===0){
      console.warn('[IKORUN][DIAG] cloudPullAll: 0 ligne renvoyée pour uid='+uid);
    }
    data.forEach(row => {
      if(VVV_LOCAL_ONLY_KEYS.includes(row.key)){
        // Nettoyage définitif d'une éventuelle séance fantôme laissée avant ce correctif.
        window.supabaseClient.from('user_data').delete().eq('user_id', uid).eq('key', row.key).then(()=>{}).catch(()=>{});
        return; // on ne rapatrie jamais ces clés depuis le cloud
      }
      const localVal = DB.load(row.key);
      const merged = mergeStorageValue(row.key, localVal, row.value);
      DB._cache[row.key]=merged; DB._persist(row.key, merged); // écriture locale chiffrée, sans re-push cloud
    });
  }catch(e){ console.error('cloud pull exception', e); }
}

// Anti-abus de stockage : une seule clé ne doit jamais dépasser 500 Ko. Une
// valeur au-delà de cette taille est un signe d'anomalie (bug ou tentative
// d'abus) plutôt qu'une vraie donnée d'usage normal de l'app ; on ne la
// synchronise pas dans le cloud (elle reste locale/chiffrée sur l'appareil).
const CLOUD_KEY_MAX_BYTES=500*1024;
async function cloudPush(key, value){
  if(VVV_LOCAL_ONLY_KEYS.includes(key)) return; // état de séance en cours : jamais envoyé au cloud
  if(!window.supabaseClient || !window.currentUserId) return;
  try{
    let size=0;
    try{ size=JSON.stringify(value).length; }catch(e){}
    if(size>CLOUD_KEY_MAX_BYTES){
      console.error('cloudPush: valeur trop volumineuse pour la clé "'+key+'" ('+size+' octets) — synchronisation annulée');
      if(typeof toast==='function') toast(t('guardStorageTooBig'));
      return;
    }
    if(value===null){
      await window.supabaseClient.from('user_data').delete().eq('user_id', window.currentUserId).eq('key', key);
      return;
    }
    await window.supabaseClient.from('user_data').upsert(
      { user_id: window.currentUserId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,key' }
    );
  }catch(e){ console.error('cloud push error', e); }
}

/* ---------- SESSION ----------
   La session (access + refresh token) est gérée nativement par supabase-js
   via localStorage (persistSession:true, autoRefreshToken:true — voir
   index.html). L'ancien système de cookie HttpOnly (Edge Function
   "auth-session") est abandonné : il écrasait le vrai refresh_token stocké
   par supabase-js avec un placeholder, ce qui cassait le renouvellement
   automatique et forçait une reconnexion à chaque expiration de l'access
   token (~1h). ikorunLogoutCookie() est conservée uniquement pour nettoyer
   l'ancien cookie chez les comptes pas encore migrés. */
const AUTH_FN_URL = 'https://bsrbzuhvqtjkkmpmxyzw.supabase.co/functions/v1/auth-session';
async function ikorunLogoutCookie(){
  try{ await fetch(AUTH_FN_URL+'?action=logout', { method:'POST', credentials:'include' }); }catch(e){}
}

/* iPhone + app ajoutée à l'écran d'accueil : la connexion Google ne peut pas
   aboutir. La redirection vers accounts.google.com sort de l'app installée, et
   Safari — qui a son propre stockage — reçoit le jeton au retour. Côté serveur
   la connexion réussit (les logs Supabase le montrent), mais l'app installée
   n'en voit jamais rien et réaffiche l'écran de connexion. On l'explique au lieu
   de laisser retenter en boucle. Le vrai correctif (connexion Google jouée dans
   la page, sans redirection) demande une configuration Google Cloud côté compte. */
function showGoogleStandaloneHelp(){
  const h='<div style="text-align:center;padding:4px 0 14px;color:var(--e)">'+ICN('warning',40,'currentColor')+'</div>'+
    '<div class="tip" style="margin-bottom:14px">'+t('googleStandaloneBody')+'</div>'+
    '<button class="btn" style="margin-bottom:10px" onclick="closeOv(\'ovProg\');switchLoginMode(\'login\')">'+t('googleUseEmailBtn')+'</button>'+
    '<button class="btn ghost" onclick="closeOv(\'ovProg\');window.open(location.href,\'_blank\')">'+t('googleOpenSafariBtn')+'</button>';
  $('#ovProgTitle').textContent=t('googleStandaloneTitle'); $('#progBody').innerHTML=h;
  $('#ovProg').style.zIndex=topZ(); openOv('ovProg');
}
let _googleAuthing=false;
async function signInWithGoogle(){
  if(!window.supabaseClient) return;
  if(isStandalone() && isIOSDevice()){ showGoogleStandaloneHelp(); return; }
  if(_googleAuthing) return; // évite les doubles-taps qui donnent l'impression que rien ne se passe
  _googleAuthing=true;
  toast(t('connectingGoogle'));
  // Trace l'aller-retour : si on revient sans session, startLogin() sait qu'il
  // faut expliquer l'échec au lieu de réafficher l'écran de connexion muet.
  try{ localStorage.setItem('ikorun_googleAttempt', String(Date.now())); }catch(e){}
  try{
    const { error } = await withAuthTimeout(window.supabaseClient.auth.signInWithOAuth({
      provider:'google',
      options:{
        // On reconstruit une URL propre (origine + chemin) au lieu de réutiliser
        // window.location.href tel quel : si l'URL courante contient déjà un "#"
        // résiduel (ex: ancien essai OAuth), Google/Supabase rajoutait son propre
        // "#access_token=..." par-dessus, ce qui donnait "##access_token=..." et
        // empêchait Supabase de lire le token au retour (boucle silencieuse).
        redirectTo: window.location.origin + window.location.pathname,
        // force Google à toujours proposer le choix du compte (ou "en créer un")
        // au lieu de se reconnecter automatiquement avec le dernier compte utilisé
        queryParams:{ prompt:'select_account' }
      }
    }));
    if(error){ toast(t('googleConnectFail')); console.error('signInWithGoogle error',error); _googleAuthing=false; }
    // si pas d'erreur, la page va rediriger vers Google : pas besoin de repasser _googleAuthing à false
  }catch(e){
    toast(e&&e.message==='auth_timeout'?t('authTimeoutToast'):t('googleConnectFail'));
    console.error('signInWithGoogle exception',e); _googleAuthing=false;
  }
}

let _guestAuthing=false;
// Un appel réseau qui ne se règle jamais (coupure, tunnel captif, jsdelivr/
// Supabase qui traîne) laissait le bouton bloqué pour toujours : le drapeau
// "_xAuthing" posé juste avant l'await ne repassait à false qu'APRÈS l'await,
// donc jamais si l'await ne se termine pas — et chaque appui suivant sur le
// bouton se contentait de "return" silencieusement (garde en tête de
// fonction), sans le moindre message. Une personne qui retape plusieurs fois
// sur "Continuer en tant qu'invité" en pensant que ça ne marche pas se
// heurtait exactement à ça. Ce timeout force l'abandon au bout de 15 s,
// relâche le bouton et affiche un message clair au lieu du silence.
function withAuthTimeout(promise, ms){
  return Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error('auth_timeout')),ms||15000))
  ]);
}
/* Les envois d'emails (inscription, mot de passe oublié) sont plafonnés côté
   serveur : quelques-uns par heure, plus un délai minimum entre deux demandes.
   Sans détection, ces refus tombaient dans le message d'erreur générique et
   la personne réessayait en boucle — ce qui ne faisait qu'aggraver le blocage. */
function isAuthRateLimit(err){
  if(!err) return false;
  if(err.status===429) return true;
  return /rate limit|only request this after|too many requests/i.test(err.message||'');
}
async function continueAsGuest(){
  if(!window.supabaseClient || _guestAuthing || _emailAuthing || _googleAuthing) return;
  _guestAuthing=true;
  setLoginStatus(t('guestConnectingToast'),'checking');
  try{
    // options.data sert de filet de secours pour identifier un compte invité
    // (session.user.is_anonymous est la source normale, cf finishLogin) au cas
    // où ce champ ne serait pas exposé sur une version antérieure du SDK.
    const { error } = await withAuthTimeout(window.supabaseClient.auth.signInAnonymously({ options:{ data:{ ikorun_guest:true } } }));
    if(error){
      console.error('signInAnonymously error',error);
      setLoginStatus(/anonymous|disabled/i.test(error.message||'')?t('guestDisabledToast'):t('authGenericErrorToast'),'bad');
    }
    // si pas d'erreur : onAuthStateChange (SIGNED_IN) prend le relais tout seul
  }catch(e){
    console.error('signInAnonymously exception',e);
    setLoginStatus(e&&e.message==='auth_timeout'?t('authTimeoutToast'):t('authGenericErrorToast'),'bad');
  }
  _guestAuthing=false;
}
/* Distingue une déconnexion VOULUE d'une session perdue toute seule (jeton de
   rafraîchissement expiré ou introuvable). supabase-js émet SIGNED_OUT dans les
   deux cas : sans ce drapeau, une simple coupure réseau effaçait toutes les
   données locales. Pour un compte invité c'était définitif — un compte anonyme
   ne peut jamais être reconnecté, donc la copie locale était la seule. */
let _intentionalSignOut=false;
function signOutUser(){
  customConfirm(t('confirmLogout'),async ()=>{
    _intentionalSignOut=true;
    await ikorunLogoutCookie();
    if(window.supabaseClient) window.supabaseClient.auth.signOut();
    else location.reload();
  });
}

/* ---------- CONNEXION / INSCRIPTION PAR EMAIL ----------
   Le google reste géré par signInWithGoogle() ci-dessus. Tout le contenu de
   #loginMain est généré ici (jamais du HTML statique) pour rester traduit
   dans les 3 langues de l'app — cf renderLoginMain() rappelée par setLang(). */
let loginMode='login'; // 'login' | 'signup' | 'forgot'
function switchLoginMode(m){
  loginMode=m; renderLoginMain();
  if(m==='signup'){
    let seen=false;
    try{ seen=localStorage.getItem('ikorun_signupGuideSeen')==='1'; }catch(e){}
    if(!seen) setTimeout(startSignupGuide,450);
  }
}
function isEmailValid(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v||'').trim()); }
const GOOGLE_ICON_SVG='<svg viewBox="0 0 48 48" width="20" height="20"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6C12.2 13.5 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.4z"/><path fill="#FBBC05" d="M10.3 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6C.9 16.9 0 20.3 0 24s.9 7.1 2.5 10.3l7.8-6z"/><path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.3-5.7c-2 1.4-4.7 2.3-8 2.3-6.4 0-11.8-4-13.7-9.8l-7.8 6C6.4 42.6 14.6 48 24 48z"/></svg>';
/* ---------- CONNEXION GOOGLE DANS L'APP INSTALLÉE (iOS) ----------
   La méthode par redirection (signInWithOAuth) quitte l'app installée : iOS
   ouvre Google dans Safari, la connexion y réussit… et le jeton reste dans
   Safari, jamais dans l'app. D'où le bouton grisé jusqu'ici.
   Google Identity Services règle ça autrement : la connexion se fait dans un
   cadre affiché PAR-DESSUS l'app, sans jamais la quitter, et renvoie un jeton
   d'identité directement en JS — qu'on échange ensuite contre une session
   Supabase (signInWithIdToken). L'identifiant client ci-dessous est public par
   nature (il apparaît déjà dans chaque URL d'autorisation Google). */
const GOOGLE_CLIENT_ID='485792164068-08fq3cig2tc89ntv1ode319jps5rn9lh.apps.googleusercontent.com';
let _gisLoading=null;
function loadGoogleIdentityScript(){
  if(window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve(true);
  if(_gisLoading) return _gisLoading;
  _gisLoading=new Promise(resolve=>{
    const s=document.createElement('script');
    s.src='https://accounts.google.com/gsi/client'; s.async=true; s.defer=true;
    s.onload=()=>resolve(!!(window.google&&window.google.accounts&&window.google.accounts.id));
    s.onerror=()=>resolve(false);
    document.head.appendChild(s);
    setTimeout(()=>resolve(!!(window.google&&window.google.accounts&&window.google.accounts.id)),8000);
  });
  return _gisLoading;
}
async function onGoogleIdToken(resp){
  if(!resp || !resp.credential){ toast(t('googleConnectFail')); return; }
  try{
    const { error } = await withAuthTimeout(window.supabaseClient.auth.signInWithIdToken({
      provider:'google', token:resp.credential
    }));
    if(error){ console.error('signInWithIdToken error',error); toast(t('googleConnectFail')); }
    // succès : onAuthStateChange (SIGNED_IN) prend le relais
  }catch(e){
    console.error('signInWithIdToken exception',e);
    toast(e&&e.message==='auth_timeout'?t('authTimeoutToast'):t('googleConnectFail'));
  }
}
async function mountGoogleNativeButton(){
  const host=document.getElementById('gsiBtnHost'); if(!host) return;
  const ok=await loadGoogleIdentityScript();
  if(!ok){ host.innerHTML='<div class="gbtn-hint">'+t('googleStandaloneHint')+'</div>'; return; }
  try{
    window.google.accounts.id.initialize({
      client_id:GOOGLE_CLIENT_ID,
      callback:onGoogleIdToken,
      ux_mode:'popup',
      auto_select:false,
      itp_support:true // indispensable sur Safari/iOS (protection anti-pistage)
    });
    host.innerHTML='';
    window.google.accounts.id.renderButton(host,{
      type:'standard', theme:'outline', size:'large', shape:'pill',
      text:'continue_with', logo_alignment:'center', width:280
    });
  }catch(e){
    console.error('GIS init error',e);
    host.innerHTML='<div class="gbtn-hint">'+t('googleStandaloneHint')+'</div>';
  }
}
function googleBtnHtml(){
  // Revenu en arrière : le bouton natif (Google Identity Services) exige que le
  // domaine soit déclaré comme "origine JavaScript autorisée" dans la console
  // Google Cloud du projet — une étape manuelle, pas encore faite. Sans elle,
  // Google refuse la connexion sans le dire clairement : le bouton semblait
  // fonctionner (il s'affichait) mais ne connectait jamais personne. Tant que
  // cette étape n'est pas confirmée faite, mieux vaut le message clair et
  // honnête d'avant (bouton grisé + explication) qu'un bouton qui a l'air bon
  // mais ne marche pas. mountGoogleNativeButton()/onGoogleIdToken() restent
  // définies, prêtes à réactiver dès que l'origine sera autorisée.
  const blocked=isStandalone()&&isIOSDevice();
  return '<button class="gbtn'+(blocked?' muted':'')+'" onclick="signInWithGoogle()"><span class="gicon">'+GOOGLE_ICON_SVG+'</span>'+t('continueWithGoogleBtn')+'</button>'+
    (blocked?'<div class="gbtn-hint">'+t('googleStandaloneHint')+'</div>':'');
}
function renderLoginMain(){
  const el=$('#loginMain'); if(!el) return;
  const legal=$('#loginLegal'); if(legal) legal.innerHTML=t('loginLegalText');
  const installRow=$('#loginInstallRow'); if(installRow) installRow.innerHTML=loginInstallButtonHTML();
  let h='';
  if(loginMode==='login'){
    // Connexion par email retirée pour l'instant : les emails de confirmation et
    // de réinitialisation partent par le service intégré de Supabase, plafonné à
    // quelques envois par heure. Une fois le quota atteint (ce qui arrive vite),
    // l'inscription échouait en 429 et personne ne pouvait plus confirmer son
    // compte — aucun des comptes email créés n'a jamais réussi à se connecter.
    // Le code (submitEmailLogin/Signup/ForgotPassword) reste en place : il suffira
    // de remettre ces champs le jour où un vrai SMTP sera branché.
    h+='<h1 class="login-h1">'+t('loginWelcomeTitle')+'</h1>';
    h+='<p class="login-sub">'+t('loginSubConnect')+'</p>';
    h+='<div class="uname-status" id="li_status"></div>';
    h+=googleBtnHtml();
    h+='<div class="login-guest subtle" onclick="continueAsGuest()">'+t('continueAsGuestLink')+'</div>';
  } else if(loginMode==='signup'){
    h+='<h1 class="login-h1">'+t('signupTitle')+'</h1>';
    h+='<p class="login-sub">'+t('signupSub')+'</p>';
    h+='<div class="field"><label>'+t('emailLabel')+'</label><input class="inp" id="li_email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="'+t('emailPlaceholder')+'"></div>';
    h+='<div class="field"><label>'+t('passwordLabel')+'</label><input class="inp" id="li_password" type="password" autocomplete="new-password" placeholder=""></div>';
    h+='<div class="field"><label>'+t('confirmPasswordLabel')+'</label><input class="inp" id="li_password2" type="password" autocomplete="new-password" placeholder=""></div>';
    h+='<div class="uname-status" id="li_status"></div>';
    h+='<button class="btn" style="margin-bottom:11px" onclick="submitEmailSignup()" id="li_submit">'+t('signupBtnLabel')+'</button>';
    h+='<div class="login-or">'+t('orDividerLabel')+'</div>';
    h+=googleBtnHtml();
    h+='<div class="login-guest" onclick="switchLoginMode(\'login\')">'+t('haveAccountLink')+'</div>';
    h+='<div class="login-guest subtle" onclick="startSignupGuide()">'+t('signupHelpLink')+'</div>';
  } else {
    h+='<h1 class="login-h1">'+t('forgotTitle')+'</h1>';
    h+='<p class="login-sub">'+t('forgotSub')+'</p>';
    h+='<div class="field"><label>'+t('emailLabel')+'</label><input class="inp" id="li_email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="'+t('emailPlaceholder')+'"></div>';
    h+='<div class="uname-status" id="li_status"></div>';
    h+='<button class="btn" style="margin-bottom:11px" onclick="submitForgotPassword()" id="li_submit">'+t('sendResetLinkBtn')+'</button>';
    h+='<div class="login-guest" onclick="switchLoginMode(\'login\')">'+t('backToLoginLink')+'</div>';
  }
  el.innerHTML=h;
}
function setLoginStatus(msg,kind){
  const s=$('#li_status'); if(!s) return;
  s.textContent=msg||''; s.className='uname-status'+(kind?(' '+kind):'');
}
let _emailAuthing=false;
async function submitEmailLogin(){
  if(!window.supabaseClient || _emailAuthing) return;
  const email=($('#li_email').value||'').trim(), pass=$('#li_password').value||'';
  if(!email||!pass) return setLoginStatus(t('fillEmailPasswordToast'),'bad');
  if(!isEmailValid(email)) return setLoginStatus(t('invalidEmailToast'),'bad');
  _emailAuthing=true; setLoginStatus(t('loggingInToast'),'checking');
  try{
    const { error } = await withAuthTimeout(window.supabaseClient.auth.signInWithPassword({ email, password:pass }));
    if(error){
      console.error('signInWithPassword error',error);
      // Supabase renvoie le MÊME "Invalid login credentials" pour un mot de passe
      // faux ET pour un compte dont l'email n'a jamais été confirmé (il ne dit pas
      // lequel, pour ne pas révéler quels emails existent). Dire seulement "mot de
      // passe incorrect" envoyait donc les gens réinitialiser un mot de passe qui
      // était bon : le message couvre maintenant les deux cas.
      setLoginStatus(isAuthRateLimit(error)?t('emailRateLimitToast')
        :/invalid/i.test(error.message||'')?t('wrongCredentialsToast')
        :t('authGenericErrorToast'),'bad');
    }
    // si pas d'erreur : onAuthStateChange (SIGNED_IN) prend le relais tout seul
  }catch(e){
    console.error('signInWithPassword exception',e);
    setLoginStatus(e&&e.message==='auth_timeout'?t('authTimeoutToast'):t('authGenericErrorToast'),'bad');
  }
  _emailAuthing=false;
}
async function submitEmailSignup(){
  if(!window.supabaseClient || _emailAuthing) return;
  const email=($('#li_email').value||'').trim(), pass=$('#li_password').value||'', pass2=$('#li_password2').value||'';
  if(!email||!pass) return setLoginStatus(t('fillEmailPasswordToast'),'bad');
  if(!isEmailValid(email)) return setLoginStatus(t('invalidEmailToast'),'bad');
  if(pass.length<8) return setLoginStatus(t('passwordTooShortToast'),'bad');
  if(pass!==pass2) return setLoginStatus(t('passwordsMismatchToast'),'bad');
  _emailAuthing=true; setLoginStatus(t('creatingAccountToast'),'checking');
  try{
    const { data, error } = await withAuthTimeout(window.supabaseClient.auth.signUp({
      email, password:pass,
      options:{ emailRedirectTo: window.location.origin + window.location.pathname }
    }));
    if(error){
      console.error('signUp error',error);
      setLoginStatus(isAuthRateLimit(error)?t('emailRateLimitToast')
        :/already|exists|registered/i.test(error.message||'')?t('emailAlreadyUsedToast')
        :t('authGenericErrorToast'),'bad');
    } else if(data && data.user && !data.session){
      // Confirmation email activée côté projet : pas de session immédiate.
      setLoginStatus(t('checkEmailConfirmToast'),'ok');
    }
    // si une session est déjà présente (confirmation email désactivée côté
    // projet), onAuthStateChange (SIGNED_IN) prend le relais tout seul.
  }catch(e){
    console.error('signUp exception',e);
    setLoginStatus(e&&e.message==='auth_timeout'?t('authTimeoutToast'):t('authGenericErrorToast'),'bad');
  }
  _emailAuthing=false;
}
async function submitForgotPassword(){
  if(!window.supabaseClient || _emailAuthing) return;
  const email=($('#li_email').value||'').trim();
  if(!email) return setLoginStatus(t('fillEmailPasswordToast'),'bad');
  if(!isEmailValid(email)) return setLoginStatus(t('invalidEmailToast'),'bad');
  _emailAuthing=true; setLoginStatus(t('sendingResetToast'),'checking');
  try{
    const { error } = await withAuthTimeout(window.supabaseClient.auth.resetPasswordForEmail(email,{
      redirectTo: window.location.origin + window.location.pathname
    }));
    if(error){ console.error('resetPasswordForEmail error',error); setLoginStatus(isAuthRateLimit(error)?t('emailRateLimitToast'):t('authGenericErrorToast'),'bad'); }
    else setLoginStatus(t('resetLinkSentToast'),'ok');
  }catch(e){
    console.error('resetPasswordForEmail exception',e);
    setLoginStatus(e&&e.message==='auth_timeout'?t('authTimeoutToast'):t('authGenericErrorToast'),'bad');
  }
  _emailAuthing=false;
}

function addAnotherAccount(){
  customConfirm(t('confirmSwitchGoogle'),async ()=>{
    _intentionalSignOut=true; // changement de compte volontaire : la purge locale est voulue
    await ikorunLogoutCookie();
    if(window.supabaseClient) window.supabaseClient.auth.signOut();
    else location.reload();
  });
}

function deleteAccountCompletely(){
  customConfirm(t('confirmDeleteAllData'),()=>{
    customConfirm(t('confirmFinalIrreversible'),async ()=>{
      try{
        if(window.supabaseClient && window.currentUserId){
          const { data:{ session } } = await window.supabaseClient.auth.getSession();
          if(session){
            // Suppression complète côté serveur : lignes user_data/public_profiles
            // ET le compte Supabase Auth lui-même (impossible à faire depuis le
            // client, nécessite la service_role key -> passe par une Edge Function).
            await fetch('https://bsrbzuhvqtjkkmpmxyzw.supabase.co/functions/v1/delete-account', {
              method:'POST',
              headers:{ 'Authorization':'Bearer '+session.access_token }
            }).catch(e=>console.error('delete-account fn error', e));
          }
        }
      }catch(e){ console.error('delete account data error', e); }
      _intentionalSignOut=true; // suppression de compte : l'effacement local est justement le but
      Object.keys(localStorage).filter(k=>k.startsWith('vvv_')).forEach(k=>localStorage.removeItem(k));
      await ikorunLogoutCookie();
      if(window.supabaseClient) await window.supabaseClient.auth.signOut();
      location.reload();
    },{danger:true});
  },{danger:true});
}

/* ---------- AMIS / CLASSEMENT / PARTAGE ---------- */
async function ensurePublicProfile(){
  if(!window.supabaseClient || !window.currentUserId) return;
  try{
    const { data } = await window.supabaseClient.from('public_profiles').select('user_id').eq('user_id',window.currentUserId).maybeSingle();
    if(!data){
      // pseudo technique unique par défaut (ex: athlete_1a2b3c4d) tant que l'utilisateur
      // n'a pas encore validé son vrai nom d'utilisateur unique.
      const placeholder='athlete_'+String(window.currentUserId).replace(/-/g,'').slice(0,10);
      await window.supabaseClient.from('public_profiles').insert({
        user_id:window.currentUserId, username:(P.username||placeholder), username_set:!!P.username
      });
    }
  }catch(e){ console.error('ensurePublicProfile error', e); }
}
async function syncPublicProfile(){
  if(!window.supabaseClient || !window.currentUserId) return;
  try{
    // Le pseudo n'est JAMAIS écrasé ici : il est géré uniquement via claimUsername()
    // pour garantir son unicité (onboarding + modification dans le profil).
    // xp / level / total_km / total_sessions / total_tonnage / streak_days /
    // km_week / sessions_week ne sont PLUS envoyés par le client : un trigger
    // serveur (ikorun_enforce_verified_public_profile) les recalcule à chaque
    // écriture depuis les vraies séances (user_data), quoi que ce PATCH envoie
    // pour ces colonnes. Avant ce trigger, xp/level étaient acceptés tels
    // quels — un simple appel REST direct suffisait à se mettre en tête du
    // classement des amis sans avoir couru un mètre.
    await window.supabaseClient.from('public_profiles').update({
      vdot: getUserVDOT()||null,
      photo_url: P.photo||null,
      updated_at: new Date().toISOString()
    }).eq('user_id', window.currentUserId);
    await window.supabaseClient.rpc('sync_verified_public_profile',{p_user_id:window.currentUserId});
  }catch(e){ /* silencieux : pas bloquant pour l'app */ }
}
/* ---------- Nom d'utilisateur unique (vérif en direct + réservation) ---------- */
function usernameFormatOk(v){ return /^[a-zA-Z0-9_]{3,20}$/.test(v||''); }
let _unameSeq=0;
async function checkUsernameLive(rawValue, statusEl, inputEl){
  const seq=++_unameSeq;
  const v=(rawValue||'').trim();
  inputEl && inputEl.classList.remove('uname-ok','uname-bad');
  if(!v){ if(statusEl){ statusEl.textContent=t('usernameFormatHint'); statusEl.className='uname-status'; } return false; }
  if(!usernameFormatOk(v)){
    if(statusEl){ statusEl.textContent=''+t('usernameFormatHint'); statusEl.className='uname-status bad'; }
    inputEl && inputEl.classList.add('uname-bad');
    return false;
  }
  if(statusEl){ statusEl.textContent=t('checkingEllipsis'); statusEl.className='uname-status checking'; }
  if(!window.supabaseClient){
    if(statusEl){ statusEl.textContent=''+t('available'); statusEl.className='uname-status ok'; }
    inputEl && inputEl.classList.add('uname-ok');
    return true;
  }
  try{
    const { data, error } = await window.supabaseClient.rpc('username_available',{
      p_username: v, p_uid: window.currentUserId||null
    });
    if(seq!==_unameSeq) return null; // réponse obsolète (retapé entretemps) : on l'ignore, on ne touche pas au résultat affiché
    if(error){ console.error('username_available error',error); if(statusEl){ statusEl.textContent=''; statusEl.className='uname-status'; } return null; }
    if(!data){
      if(statusEl){ statusEl.textContent=''+t('alreadyTaken'); statusEl.className='uname-status bad'; }
      inputEl && inputEl.classList.add('uname-bad');
      return false;
    }
    if(statusEl){ statusEl.textContent=''+t('available'); statusEl.className='uname-status ok'; }
    inputEl && inputEl.classList.add('uname-ok');
    return true;
  }catch(e){
    console.error('checkUsernameLive error',e);
    if(statusEl){ statusEl.textContent=''; statusEl.className='uname-status'; }
    return null;
  }
}
function wireUsernameField(inputId, statusId, onResult){
  const inp=$('#'+inputId), st=$('#'+statusId); if(!inp||!st) return;
  let deb=null;
  inp.addEventListener('input',()=>{
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const ok=await checkUsernameLive(inp.value, st, inp);
      if(ok!==null && onResult) onResult(ok);
    },400);
  });
}
// Réserve/renomme le pseudo côté serveur de façon atomique (source de vérité anti-doublon)
async function claimUsername(username){
  if(!window.supabaseClient || !window.currentUserId) { P.username=username; return true; }
  try{
    const { data, error } = await window.supabaseClient.rpc('claim_username',{ p_uid:window.currentUserId, p_username:username });
    if(error){ console.error('claim_username error',error); return false; }
    if(!data) return false;
    P.username=username; return true;
  }catch(e){ console.error('claim_username exception',e); return false; }
}

let friendsTab='list';
let friendsSelected=null;
let friendsCache={friends:[],pending:[],sent:[]};
let _friendsLoadSeq=0; // évite qu'une réponse réseau en retard (ouverture rapide/répétée) écrase un état plus récent
let _friendsLoading=false;
let clubCache={loaded:false,club:null,members:[]};
let _clubLoading=false;
let clubShowCreate=false;
let clubPlanEditing=false;
let clubPlanTmp=null;
function openClub(){
  friendsTab='club';
  friendsSelected=null;
  clubPlanEditing=false;
  $('#ovProgTitle').textContent=t('clubTitle');
  $('#progBody').innerHTML='<div id="friendsBody"><div class="card"><div class="empty"><div class="em-ic">'+ICN('stopwatch',36,'currentColor')+'</div><div style="font-size:13px">'+t('loadingLab')+'</div></div></div></div>';
  openOv('ovProg');
  loadClubData();
}
function openFriends(){
  friendsTab='list';
  friendsSelected=null;
  $('#ovProgTitle').textContent=t('friendsTitle');
  // Affiche tout de suite un état de chargement : sans ça, la fenêtre s'ouvrait
  // vide le temps de la requête réseau, ce qui donnait l'impression qu'elle
  // "s'ouvrait mal".
  $('#progBody').innerHTML='<div id="friendsBody"><div class="card"><div class="empty"><div class="em-ic">'+ICN('stopwatch',36,'currentColor')+'</div><div style="font-size:13px">'+t('loadingLab')+'</div></div></div></div>';
  openOv('ovProg');
  loadFriendsData();
}
async function loadFriendsData(){
  const seq=++_friendsLoadSeq;
  _friendsLoading=true;
  if(!window.supabaseClient || !window.currentUserId){ _friendsLoading=false; renderFriends(); return; }
  try{
    const uid=window.currentUserId;
    const { data:rows, error:e1 } = await window.supabaseClient.from('friendships').select('*').or('user_id.eq.'+uid+',friend_id.eq.'+uid);
    if(e1) throw e1;
    const ids=new Set(); (rows||[]).forEach(r=>{ ids.add(r.user_id); ids.add(r.friend_id); }); ids.delete(uid);
    let profiles={};
    if(ids.size){
      const { data:profs, error:e2 } = await window.supabaseClient.from('public_profiles').select('user_id,username,xp,level,km_week,sessions_week,vdot,total_sessions,streak_days,total_km,total_tonnage,photo_url').in('user_id',[...ids]);
      if(e2) throw e2;
      (profs||[]).forEach(p=>profiles[p.user_id]=p);
    }
    if(seq!==_friendsLoadSeq) return; // une ouverture plus récente a déjà pris le relais
    friendsCache={friends:[],pending:[],sent:[]};
    (rows||[]).forEach(r=>{
      const otherId = r.user_id===uid ? r.friend_id : r.user_id;
      const prof = profiles[otherId] || {username:'?',xp:0,level:1,km_week:0,sessions_week:0,total_tonnage:0};
      if(r.status==='accepted') friendsCache.friends.push({...prof,id:otherId});
      else if(r.status==='pending' && r.friend_id===uid) friendsCache.pending.push({...prof,id:otherId,reqId:r.id});
      else if(r.status==='pending' && r.user_id===uid) friendsCache.sent.push({...prof,id:otherId,reqId:r.id});
    });
    _friendsLoading=false;
    renderFriends();
  }catch(e){
    console.error('loadFriendsData error',e);
    if(seq!==_friendsLoadSeq) return;
    _friendsLoading=false;
    const box=$('#friendsBody');
    if(box) box.innerHTML='<div class="card"><div class="empty"><div class="em-ic">'+ICN('warning',36,'currentColor')+'</div><div style="font-size:13px">'+t('friendsLoadError')+'</div><button class="btn ghost sm" style="margin-top:10px;width:auto" onclick="loadFriendsData()">'+t('retryBtn')+'</button></div></div>';
  }
}
function switchSocialTab(tab){
  friendsTab=tab;
  $('#ovProgTitle').textContent=tab==='club'?t('clubTitle'):t('friendsTitle');
  if(tab==='club' && !clubCache.loaded){ renderFriends(); loadClubData(); return; }
  renderFriends();
}
function renderFriends(){
  if(friendsTab==='profile'){ $('#friendsBody').innerHTML=renderFriendProfileHTML(); return; }
  if(friendsTab==='club'){ renderClubTab(); return; }

  let h='<div class="fr-tabs">'+
    '<div class="fr-tab '+(friendsTab==='list'?'on':'')+'" onclick="switchSocialTab(\'list\')">'+t('tabFriendsList')+'</div>'+
    '<div class="fr-tab '+(friendsTab==='rank'?'on':'')+'" onclick="switchSocialTab(\'rank\')">'+t('tabRank')+'</div>'+
    '<div class="fr-tab '+(friendsTab==='club'?'on':'')+'" onclick="switchSocialTab(\'club\')">'+t('tabClub')+'</div>'+
  '</div>';

  if(!window.supabaseClient || !window.currentUserId){
    h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('lock',36,'currentColor')+'</div><div style="font-size:13px">'+t('loginToAddFriends')+'</div></div></div>';
    $('#friendsBody').innerHTML=h; return;
  }

  if(friendsTab==='list'){
    h+='<div class="fr-search">'+ICN('search',16)+'<input id="addFriendSearch" placeholder="'+t('searchFriendPlaceholder')+'" autocapitalize="off" autocorrect="off" spellcheck="false" oninput="onFriendSearchInput()"></div>';
    h+='<div id="friendSearchResults"></div>';
    if(friendsCache.pending.length){
      h+='<div class="sec-lab">'+t('receivedRequests')+'</div>';
      friendsCache.pending.forEach(p=>{
        h+='<div class="fr-req-card"><div class="row"><div style="font-weight:700">'+escHtml(p.username)+'</div><div class="row" style="gap:6px"><button class="btn sm" style="width:auto" onclick="respondFriend('+p.reqId+',true)">'+t('acceptBtn')+'</button><button class="btn ghost sm" style="width:auto" onclick="respondFriend('+p.reqId+',false)">'+t('declineBtn')+'</button></div></div></div>';
      });
    }
    h+='<div class="sec-lab">'+tp('yourFriendsCount',friendsCache.friends.length)+'</div>';
    if(!friendsCache.friends.length) h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('users',36,'currentColor')+'</div><div style="font-size:13px">'+t('noFriendsYet')+'</div></div></div>';
    else h+='<div class="card" style="padding:2px 6px">'+friendsCache.friends.map((f,i)=>{
      const av=f.photo_url?'<div class="fr-avatar" style="background-image:url(\''+safePhotoUrl(f.photo_url)+'\')"></div>':'<div class="fr-avatar">'+(f.username?escHtml(f.username[0].toUpperCase()):'?')+'</div>';
      return '<div class="fr-row" style="border-bottom:'+(i<friendsCache.friends.length-1?'1px solid var(--hair)':'none')+'" onclick="openFriendProfile(\''+f.id+'\')">'+av+
        '<div class="fr-info"><div class="fr-name">'+escHtml(f.username)+'</div><div class="fr-meta"><span class="fr-lvl-chip">'+t('lvlDot')+' '+f.level+'</span><span class="fr-km-txt">'+tp('kmThisWeekShort',f.km_week)+'</span></div></div>'+
        '<span class="fr-del" onclick="event.stopPropagation();removeFriend(\''+f.id+'\')" title="'+t('removeLab')+'">'+ICN('trash',16)+'</span>'+
        '<span class="lr-chev">'+ICN('chevronR',16)+'</span></div>';
    }).join('')+'</div>';
    if(friendsCache.sent.length){
      h+='<div class="sec-lab">'+t('sentRequests')+'</div>';
      h+='<div class="card" style="padding:2px 6px">'+friendsCache.sent.map((p,i)=>'<div class="fr-row" style="opacity:.65;cursor:default;border-bottom:'+(i<friendsCache.sent.length-1?'1px solid var(--hair)':'none')+'"><div class="fr-avatar">'+(p.username?escHtml(p.username[0].toUpperCase()):'?')+'</div><div class="fr-info"><div class="fr-name">'+escHtml(p.username)+'</div><div class="fr-km-txt" style="margin-top:3px">'+t('awaitingResponse')+'</div></div></div>').join('')+'</div>';
    }
  }

  if(friendsTab==='rank'){
    const me={username:(P.name||t('youDefaultName'))+t('youParen'),xp:(XP&&XP.total)||0,level:(XP&&XP.level)||1,photo_url:P.photo};
    const all=[...friendsCache.friends,me].sort((a,b)=>b.xp-a.xp);
    h+='<div class="sec-lab">'+t('xpRanking')+'</div>';
    if(all.length===1) h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('medal',36,'currentColor')+'</div><div style="font-size:13px">'+t('addFriendsUnlock')+'</div></div></div>';
    else {
      const top3=all.slice(0,3), rest=all.slice(3);
      const medalCols=['var(--or)','var(--platine)','var(--bronze)'];
      const medals=top3.map((_,i)=>ICN('medal',22,medalCols[i]));
      h+='<div class="fr-podium">'+top3.map((f,i)=>{
        const av=f.photo_url?'<div class="fr-pod-av" style="background-image:url(\''+safePhotoUrl(f.photo_url)+'\')"></div>':'<div class="fr-pod-av">'+(f.username?escHtml(f.username[0].toUpperCase()):'?')+'</div>';
        return '<div class="fr-pod-card p'+(i+1)+'"'+(f.id?' onclick="openFriendProfile(\''+f.id+'\')" style="cursor:pointer"':'')+'><div class="fr-pod-medal">'+medals[i]+'</div>'+av+'<div class="fr-pod-name">'+escHtml(f.username)+'</div><div class="fr-pod-xp">'+f.xp+' XP</div></div>';
      }).join('')+'</div>';
      if(rest.length) h+='<div class="card" style="padding:4px 14px">'+rest.map((f,i)=>
        '<div class="fr-rank-row'+(f.id?'':' me')+'" style="border-bottom:'+(i<rest.length-1?'1px solid var(--hair)':'none')+(f.id?';cursor:pointer':'')+'"'+(f.id?' onclick="openFriendProfile(\''+f.id+'\')"':'')+'><div class="fr-rank-num">#'+(i+4)+'</div><div style="flex:1;font-weight:700;font-size:13.5px">'+escHtml(f.username)+'</div><div style="font-size:12.5px;color:var(--muted);font-weight:600">'+f.xp+' XP · '+t('lvlDot')+f.level+'</div></div>'
      ).join('')+'</div>';
    }
  }

  $('#friendsBody').innerHTML=h;
}
let _friendSearchDeb=null;
function escLike(s){ return s.replace(/[\\%_]/g,'\\$&'); }
// Échappe tout texte injecté dans du innerHTML (pseudos, URLs de photo, etc.).
// Sécurité en profondeur : même si le serveur revalide déjà le format des pseudos,
// on n'affiche jamais de texte contrôlé par un tiers sans l'échapper ici.
function escHtml(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/* Une photo de profil est TOUJOURS produite ici par canvas.toDataURL() : c'est
   donc forcément une image en base64, jamais une URL libre. On le vérifie avant
   affichage plutôt que de se contenter d'échapper, car ces valeurs peuvent venir
   d'un autre utilisateur (public_profiles.photo_url d'un ami ou d'un membre de
   club) ou d'un fichier importé : échapper protégeait du HTML mais laissait
   passer une fermeture de url('…') suivie de déclarations CSS arbitraires
   (calque plein écran par-dessus l'app). Tout ce qui ne colle pas au format
   attendu est simplement ignoré → on retombe sur l'avatar avec l'initiale. */
function safePhotoUrl(u){
  return /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(String(u||'')) ? String(u) : '';
}
function onFriendSearchInput(){
  clearTimeout(_friendSearchDeb);
  const el=$('#addFriendSearch'); const v=el?el.value.trim():'';
  const box=$('#friendSearchResults'); if(!box) return;
  if(!v){ box.innerHTML=''; return; }
  box.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 2px">'+t('searchingLab')+'</div>';
  _friendSearchDeb=setTimeout(()=>searchFriendCandidates(v),350);
}
async function searchFriendCandidates(v){
  const box=$('#friendSearchResults'); if(!box) return;
  if(!window.supabaseClient || !window.currentUserId){ box.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 2px">'+t('loginToSearchFriends')+'</div>'; return; }
  try{
    const { data } = await window.supabaseClient.from('public_profiles')
      .select('user_id,username,level')
      .ilike('username_lower','%'+escLike(v.toLowerCase())+'%')
      .neq('user_id',window.currentUserId)
      .limit(8);
    const results=data||[];
    if(!results.length){ box.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 2px">'+t('noUsernameFound')+'</div>'; return; }
    const known=new Set([...friendsCache.friends,...friendsCache.pending,...friendsCache.sent].map(f=>f.id));
    box.innerHTML=results.map(r=>{
      const already=known.has(r.user_id);
      return '<div class="card" style="padding:10px 14px;margin-top:6px"><div class="row"><div style="font-weight:700">@'+escHtml(r.username)+'</div>'+
        (already?'<span style="font-size:11.5px;color:var(--muted)">'+t('alreadyLinked')+'</span>':'<button class="btn sm" style="width:auto" onclick="sendFriendRequest(\''+r.user_id+'\')">'+t('addBtn')+'</button>')+
        '</div></div>';
    }).join('');
  }catch(e){ box.innerHTML='<div style="font-size:12px;color:var(--bad);padding:6px 2px">'+t('searchError')+'</div>'; }
}
async function sendFriendRequest(targetId){
  const { error } = await window.supabaseClient.from('friendships').insert({user_id:window.currentUserId, friend_id:targetId, status:'pending'});
  if(error) toast(t('alreadySentOrFriend')); else { toast(t('requestSent')); $('#friendSearchResults').innerHTML=''; $('#addFriendSearch').value=''; loadFriendsData(); }
}
async function respondFriend(reqId,accept){
  if(accept) await window.supabaseClient.from('friendships').update({status:'accepted'}).eq('id',reqId);
  else await window.supabaseClient.from('friendships').delete().eq('id',reqId);
  loadFriendsData();
}
function openFriendProfile(id){
  friendsSelected=id; friendsTab='profile';
  $('#ovProgTitle').textContent=t('friendProfileTitle');
  renderFriends();
}
function backToFriendsList(){
  friendsTab='list'; friendsSelected=null;
  $('#ovProgTitle').textContent=t('friendsTitle');
  renderFriends();
}
function friendBadgesHTML(f){
  // Réutilise les mêmes paliers que MEDAL_CATS, mais calculés à partir des stats
  // synchronisées de l'ami (total_sessions / streak_days / total_km) plutôt que
  // des données locales (SESS/MSESS), qui n'existent que pour l'utilisateur courant.
  const icons={sessions:'medal',streak:'fire',distance:'chart'};
  const vals={sessions:f.total_sessions||0,streak:f.streak_days||0,distance:f.total_km||0};
  let cells='', anyUnlocked=false;
  MEDAL_CATS.forEach(c=>{
    const v=Math.floor(vals[c.key]||0);
    let tierIdx=-1; c.thr.forEach((th,i)=>{ if(v>=th)tierIdx=i; });
    const locked=tierIdx<0; if(!locked) anyUnlocked=true;
    const tierLab=locked?'':TIERS[tierIdx][0];
    cells+='<div class="badge-mini'+(locked?' locked':'')+'" title="'+c.name+(tierLab?' · '+tierLab:'')+'">'+ICN(icons[c.key]||'medal',18)+'</div>';
  });
  return '<div class="card" style="padding:16px"><div class="lab" style="margin-bottom:10px">'+t('badgesLabel')+'</div><div class="badge-mini-row">'+cells+'</div>'+
    (anyUnlocked?'':'<div style="font-size:11.5px;color:var(--dim);margin-top:8px">'+t('noBadgeUnlocked')+'</div>')+'</div>';
}
function renderFriendProfileHTML(){
  const f=[...friendsCache.friends,...friendsCache.pending,...friendsCache.sent].find(x=>x.id===friendsSelected);
  const back='<div class="row" style="margin-bottom:14px;cursor:pointer" onclick="backToFriendsList()">'+ICN('chevronR',16).replace('<path','<path transform="rotate(180 12 12)"')+' <span style="font-weight:700;margin-left:4px">'+t('backToFriends')+'</span></div>';
  if(!f) return back+'<div class="card"><div class="empty"><div class="em-ic">'+ICN('search',36,'currentColor')+'</div><div style="font-size:13px">'+t('profileNotFound')+'</div></div></div>';
  const av=f.photo_url?'<div class="fr-profile-av" style="background-image:url(\''+safePhotoUrl(f.photo_url)+'\')"></div>':'<div class="fr-profile-av">'+(f.username?escHtml(f.username[0].toUpperCase()):'?')+'</div>';
  let h=back;
  h+='<div class="fr-profile-hero">'+
    '<div style="position:relative;display:inline-block">'+av+'<span class="fr-profile-lvl">'+t('lvlDot')+' '+(f.level||1)+'</span></div>'+
    '<div style="font-weight:800;font-size:18px;margin-top:16px">'+escHtml(f.username)+'</div>'+
    '<div style="font-size:12.5px;color:var(--muted);margin-top:2px">'+(f.xp||0)+' XP</div>'+
  '</div>';
  h+='<div class="stat-quatro" style="margin-top:12px">'+
    '<div class="card stat-card"><div class="stat-ic">'+ICN('lung',14)+'</div><div class="stat-v">'+(f.vdot||'—')+'</div><div class="stat-l">VDOT</div></div>'+
    '<div class="card stat-card"><div class="stat-ic">'+ICN('run',14)+'</div><div class="stat-v">'+(f.km_week||0)+'</div><div class="stat-l">'+t('kmPerWeek')+'</div></div>'+
    '<div class="card stat-card"><div class="stat-ic">'+ICN('fire',14)+'</div><div class="stat-v">'+(f.streak_days||0)+'</div><div class="stat-l">'+t('daysStreak')+'</div></div>'+
  '</div>';
  h+='<div class="stat-quatro" style="margin-top:8px">'+
    '<div class="card stat-card"><div class="stat-ic">'+ICN('chart',14)+'</div><div class="stat-v">'+(f.total_km||0)+'</div><div class="stat-l">'+t('kmTotalLab')+'</div></div>'+
    '<div class="card stat-card"><div class="stat-ic">'+ICN('chart',14)+'</div><div class="stat-v">'+((f.total_tonnage||0).toLocaleString(localeCode()))+'</div><div class="stat-l">'+t('tonnageKgLab')+'</div></div>'+
  '</div>';
  h+='<div style="margin-top:12px">'+friendBadgesHTML(f)+'</div>';
  return h;
}
/* ---------- CLUBS ---------- */
async function loadClubData(){
  _clubLoading=true;
  if(!window.supabaseClient || !window.currentUserId){ _clubLoading=false; clubCache.loaded=true; renderClubTab(); return; }
  try{
    const uid=window.currentUserId;
    // On résout "mon club" par appartenance réelle (club_members), pas par propriété :
    // un utilisateur qui a recréé un club peut rester "owner" d'un ancien club orphelin
    // (0 membre) via la policy RLS owner_id=auth.uid(), ce qui rendrait un simple
    // "select * from clubs" ambigu (plusieurs lignes "à moi" pour un seul club actif).
    const { data:myId, error:e0 } = await window.supabaseClient.rpc('ikorun_my_club_id');
    if(e0) throw e0;
    let club=null;
    if(myId){
      const { data:clubRow, error:e1 } = await window.supabaseClient.from('clubs').select('*').eq('id',myId).maybeSingle();
      if(e1) throw e1;
      club=clubRow||null;
    }
    let members=[];
    if(club){
      const { data:mrows, error:e2 } = await window.supabaseClient.from('club_members').select('user_id').eq('club_id',club.id);
      if(e2) throw e2;
      const ids=(mrows||[]).map(r=>r.user_id);
      if(ids.length){
        const { data:profs, error:e3 } = await window.supabaseClient.from('public_profiles').select('user_id,username,xp,level,photo_url').in('user_id',ids);
        if(e3) throw e3;
        members=(profs||[]).map(p=>({...p,id:p.user_id,isOwner:p.user_id===club.owner_id,isMe:p.user_id===uid}));
      }
    }
    clubCache={loaded:true,club,members};
    _clubLoading=false;
    renderClubTab();
  }catch(e){
    console.error('loadClubData error',e);
    _clubLoading=false;
    const box=$('#friendsBody');
    if(box) box.innerHTML='<div class="card"><div class="empty"><div class="em-ic">'+ICN('warning',36,'currentColor')+'</div><div style="font-size:13px">'+t('friendsLoadError')+'</div><button class="btn ghost sm" style="margin-top:10px;width:auto" onclick="loadClubData()">'+t('retryBtn')+'</button></div></div>';
  }
}
function renderClubTab(){
  let h='<div class="fr-tabs">'+
    '<div class="fr-tab '+(friendsTab==='list'?'on':'')+'" onclick="switchSocialTab(\'list\')">'+t('tabFriendsList')+'</div>'+
    '<div class="fr-tab '+(friendsTab==='rank'?'on':'')+'" onclick="switchSocialTab(\'rank\')">'+t('tabRank')+'</div>'+
    '<div class="fr-tab on" onclick="switchSocialTab(\'club\')">'+t('tabClub')+'</div>'+
  '</div>';
  if(!window.supabaseClient || !window.currentUserId){
    h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('lock',36,'currentColor')+'</div><div style="font-size:13px">'+t('loginToAddFriends')+'</div></div></div>';
    $('#friendsBody').innerHTML=h; return;
  }
  if(_clubLoading){ $('#friendsBody').innerHTML=h+'<div class="card"><div class="empty"><div class="em-ic">'+ICN('stopwatch',36,'currentColor')+'</div><div style="font-size:13px">'+t('loadingLab')+'</div></div></div>'; return; }
  const c=clubCache.club;
  if(!c){
    h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('flag',36,'currentColor')+'</div><div style="font-weight:700;margin-bottom:4px;color:var(--snow)">'+t('noClubYet')+'</div><div style="font-size:13px">'+t('noClubYetDesc')+'</div></div></div>';
    h+='<div class="sec-lab">'+t('joinClubCta')+'</div>';
    h+='<div class="card" style="padding:14px"><div class="fr-search" style="margin-bottom:10px">'+ICN('flag',16)+'<input id="clubCodeInput" placeholder="'+t('clubCodePlaceholder')+'" maxlength="6" autocapitalize="characters" autocorrect="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:2px;font-weight:700"></div><button class="btn sm" style="width:auto" onclick="submitJoinClub()">'+t('joinBtn')+'</button></div>';
    h+='<div class="sec-lab">'+t('createClubCta')+'</div>';
    if(!clubShowCreate){
      h+='<div class="card" style="padding:14px"><button class="btn ghost sm" style="width:auto" onclick="clubShowCreate=true;renderClubTab()">'+t('createClubCta')+'</button></div>';
    } else {
      h+='<div class="card" style="padding:14px"><div class="fr-search" style="margin-bottom:10px">'+ICN('flag',16)+'<input id="clubNameInput" placeholder="'+t('clubNamePlaceholder')+'" maxlength="40"></div><button class="btn sm" style="width:auto" onclick="submitCreateClub()">'+t('createBtn')+'</button></div>';
    }
    $('#friendsBody').innerHTML=h;
    const cIn=$('#clubCodeInput'); if(cIn) cIn.focus();
    return;
  }
  if(clubPlanEditing){ h+=renderClubPlanSetupHTML(); $('#friendsBody').innerHTML=h; return; }
  const sorted=[...clubCache.members].sort((a,b)=>(b.xp||0)-(a.xp||0));
  h+='<div class="card" style="padding:16px;text-align:center"><div style="font-weight:800;font-size:18px;color:var(--snow)">'+escHtml(c.name)+'</div>'+
    '<div style="font-size:12.5px;color:var(--muted);margin-top:4px">'+tp('clubMembersCount',clubCache.members.length)+'</div>'+
    // Le code n'est JAMAIS interpolé dans un attribut onclick : l'échappement HTML
    // n'y protège pas (le parseur décode les entités avant que le JS soit analysé,
    // donc un &#39; redevient une apostrophe qui ferme la chaîne). copyClubCode()
    // relit la valeur dans l'état JS, il n'y a donc plus rien à échapper ici.
    '<div class="row" style="justify-content:center;gap:8px;margin-top:12px"><span style="font-family:monospace;font-weight:800;font-size:17px;letter-spacing:3px;background:var(--panel2);padding:6px 12px;border-radius:8px">'+escHtml(c.code)+'</span><span class="hv7-icon-btn" style="width:36px;height:36px" onclick="copyClubCode()" title="'+t('copyCodeBtn')+'">'+ICN('copy',16)+'</span></div>'+
    '<div style="font-size:11.5px;color:var(--dim);margin-top:6px">'+t('shareCodeHint')+'</div>'+
  '</div>';
  h+=clubPlanHTML(c);
  h+='<div class="sec-lab">'+t('clubXpRanking')+'</div>';
  h+='<div class="card" style="padding:2px 6px">'+sorted.map((m,i)=>{
    const av=m.photo_url?'<div class="fr-avatar" style="background-image:url(\''+safePhotoUrl(m.photo_url)+'\')"></div>':'<div class="fr-avatar">'+(m.username?escHtml(m.username[0].toUpperCase()):'?')+'</div>';
    return '<div class="fr-row'+(m.isMe?' me':'')+'" style="border-bottom:'+(i<sorted.length-1?'1px solid var(--hair)':'none')+(m.isMe?'':';cursor:pointer')+'"'+(m.isMe?'':' onclick="openFriendProfile(\''+m.id+'\')"')+'>'+
      '<div class="fr-rank-num" style="width:22px">#'+(i+1)+'</div>'+av+
      '<div class="fr-info"><div class="fr-name">'+escHtml(m.username||'?')+(m.isOwner?' '+ICN('flag',13,'var(--accent)'):'')+(m.isMe?t('youParen'):'')+'</div><div class="fr-meta"><span class="fr-lvl-chip">'+t('lvlDot')+' '+(m.level||1)+'</span><span class="fr-km-txt">'+(m.xp||0)+' XP</span></div></div>'+
    '</div>';
  }).join('')+'</div>';
  h+='<button class="btn ghost sm" style="width:auto;margin-top:16px" onclick="leaveClubConfirm()">'+t('leaveClubBtn')+'</button>';
  $('#friendsBody').innerHTML=h;
}
function copyClubCode(){
  const code=clubCache.club&&clubCache.club.code; if(!code) return;
  try{ navigator.clipboard.writeText(code); toast(t('codeCopiedToast')); }catch(e){ toast(code); }
}
/* ---------- PLAN PARTAGÉ DU CLUB ----------
   Le créateur du club choisit soit son plan IKORUN généré, soit l'un de ses
   plans persos, et l'envoie tel quel (séances déjà datées) : tout le club suit
   le même calendrier réel, pas un gabarit générique par jour de semaine. Il
   ajoute un horaire + lieu de regroupement, ou une description libre à la
   place. Snapshot, pas de lien live : si le créateur modifie son plan perso
   ensuite, il doit republier pour que le club voie la mise à jour — plus
   simple et plus prévisible qu'une synchronisation continue. */
function buildGeneratedSnapshot(){
  if(!PLAN) return null;
  return {type:'generated', sourceId:null, name:trRace(P.objRace)||t('planIkorunPill'),
    sessions:PLAN.sessions.filter(s=>s.km>0).map(s=>({date:s.date,title:s.title,type:s.type,km:s.km,pace:s.pace})).slice(0,200),
    weeks:PLAN.weeks};
}
function buildCustomSnapshot(id){
  const p=CUSTOM.find(x=>x.id===id); if(!p) return null;
  return {type:'custom', sourceId:p.id, name:p.name,
    sessions:(p.sessions||[]).map(s=>({date:s.date,title:s.title,type:s.type,km:s.km||null,pace:s.pace||null})).slice(0,200)};
}
function clubPlanHTML(c){
  const isOwnerClub=c.owner_id===window.currentUserId;
  let h='<div class="sec-lab">'+t('clubPlanTitle')+'</div>';
  const sp=c.shared_plan;
  if(!sp){
    h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('calendar',36,'currentColor')+'</div><div style="font-size:13px">'+(isOwnerClub?t('clubPlanNoneOwner'):t('clubPlanNoneMember'))+'</div>'+
      (isOwnerClub?'<button class="btn" style="margin-top:12px;width:auto" onclick="openClubPlanSetup()">'+t('clubPlanConfigureBtn')+'</button>':'')+
    '</div></div>';
  } else {
    const tk=todayKey();
    const upcoming=(sp.sessions||[]).filter(s=>s.date>=tk).slice(0,5);
    h+='<div class="card" style="padding:16px">'+
      '<div style="font-weight:800;font-size:15px;color:var(--snow)">'+escHtml(sp.name||'')+'</div>'+
      (upcoming.length?upcoming.map(s=>'<div class="row" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--hair)"><div style="flex:1"><div style="font-weight:700;font-size:13.5px">'+escHtml(s.title||'')+'</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+fmtDate(s.date)+(s.km?' · '+s.km+' km':'')+(s.pace?' · '+escHtml(s.pace)+'/km':'')+'</div></div></div>').join(''):'<div style="font-size:12.5px;color:var(--muted);margin-top:8px">'+t('clubPlanNoUpcoming')+'</div>')+
    '</div>';
    if(isOwnerClub) h+='<button class="btn ghost sm" style="width:auto;margin-top:8px" onclick="openClubPlanSetup()">'+t('clubPlanEditBtn')+'</button>';
  }
  const mu=c.meetup;
  if(mu && ((mu.mode==='text'&&mu.text) || (mu.mode==='slot'&&(mu.place||mu.time)))){
    const dn=[0,1,2,3,4,5,6].map(d=>new Date(2023,0,1+d).toLocaleDateString(localeCode(),{weekday:'long'}));
    const dayLab=mu.day!=null?(dn[mu.day][0].toUpperCase()+dn[mu.day].slice(1)):'';
    h+='<div class="card" style="padding:14px;margin-top:'+(sp&&isOwnerClub?'8px':'10px')+'"><div class="row" style="gap:10px;align-items:flex-start">'+
      '<div class="lr-icon">'+ICN('flag',18,'currentColor')+'</div><div style="flex:1">'+
      (mu.mode==='text'
        ? '<div style="font-size:13px;white-space:pre-wrap">'+escHtml(mu.text)+'</div>'
        : '<div style="font-weight:700;font-size:13.5px">'+escHtml(dayLab)+(mu.time?' · '+escHtml(mu.time):'')+'</div>'+(mu.place?'<div style="font-size:12px;color:var(--muted);margin-top:2px">'+escHtml(mu.place)+'</div>':''))
      +'</div></div></div>';
  }
  return h;
}
function openClubPlanSetup(){
  const c=clubCache.club; if(!c) return;
  const sp=c.shared_plan, mu=c.meetup;
  const runPlans=CUSTOM.filter(x=>x.kind==='run');
  clubPlanTmp={
    source: sp?sp.type:(PLAN?'generated':(runPlans.length?'custom':null)),
    customId: (sp&&sp.type==='custom'&&sp.sourceId)||(runPlans[0]&&runPlans[0].id)||null,
    meetupMode: mu?mu.mode:'slot',
    day: mu&&mu.day!=null?mu.day:1,
    time: mu&&mu.time?mu.time:'18:30',
    place: mu&&mu.place?mu.place:'',
    text: mu&&mu.text?mu.text:''
  };
  clubPlanEditing=true;
  renderClubTab();
}
function closeClubPlanSetup(){ clubPlanEditing=false; renderClubTab(); }
function renderClubPlanSetupHTML(){
  const tt=clubPlanTmp;
  const runPlans=CUSTOM.filter(x=>x.kind==='run');
  let h='<div class="row" style="margin-bottom:14px;cursor:pointer" onclick="closeClubPlanSetup()">'+ICN('chevronR',16).replace('<path','<path transform="rotate(180 12 12)"')+' <span style="font-weight:700;margin-left:4px">'+t('backLab')+'</span></div>';
  h+='<div class="sec-lab">'+t('clubPlanSourceLabel')+'</div>';
  h+='<div class="pills">'+
    '<div class="pill '+(tt.source==='generated'?'on':'')+'" onclick="clubPlanTmp.source=\'generated\';renderClubTab()">'+t('clubPlanSourceGenerated')+'</div>'+
    '<div class="pill '+(tt.source==='custom'?'on':'')+'" onclick="clubPlanTmp.source=\'custom\';renderClubTab()">'+t('clubPlanSourceCustom')+'</div>'+
  '</div>';
  if(tt.source==='generated'){
    if(!PLAN) h+='<div class="tip" style="margin-top:10px">'+t('clubPlanNoGeneratedYet')+'</div>';
    else h+='<div class="card" style="padding:12px;margin-top:8px"><div style="font-weight:700">'+escHtml(trRace(P.objRace)||'')+'</div><div style="font-size:12px;color:var(--muted);margin-top:2px">'+tp('clubPlanSessionsCount',PLAN.sessions.filter(s=>s.km>0).length)+'</div></div>';
  } else if(tt.source==='custom'){
    if(!runPlans.length) h+='<div class="tip" style="margin-top:10px">'+t('clubPlanNoCustomYet')+'</div>';
    else h+='<div class="pills" style="flex-wrap:wrap">'+runPlans.map(p=>'<div class="pill '+(tt.customId===p.id?'on':'')+'" onclick="clubPlanTmp.customId=\''+p.id+'\';renderClubTab()">'+escHtml(p.name)+'</div>').join('')+'</div>';
  } else {
    h+='<div class="tip" style="margin-top:10px">'+t('clubPlanNoGeneratedYet')+'</div>';
  }
  h+='<div class="sec-lab" style="margin-top:18px">'+t('clubMeetupLabel')+'</div>';
  h+='<div class="pills">'+
    '<div class="pill '+(tt.meetupMode==='slot'?'on':'')+'" onclick="clubPlanTmp.meetupMode=\'slot\';renderClubTab()">'+t('clubMeetupModeSlot')+'</div>'+
    '<div class="pill '+(tt.meetupMode==='text'?'on':'')+'" onclick="clubPlanTmp.meetupMode=\'text\';renderClubTab()">'+t('clubMeetupModeText')+'</div>'+
  '</div>';
  if(tt.meetupMode==='slot'){
    const dn=[0,1,2,3,4,5,6].map(d=>new Date(2023,0,1+d).toLocaleDateString(localeCode(),{weekday:'short'}));
    h+='<div class="field"><label>'+t('trainingDaysLabel')+'</label><div class="pills">'+[1,2,3,4,5,6,0].map(d=>'<div class="pill '+(tt.day===d?'on':'')+'" onclick="clubPlanTmp.day='+d+';renderClubTab()">'+dn[d]+'</div>').join('')+'</div></div>';
    h+='<div class="field"><label>'+t('clubMeetupTimeLabel')+'</label><input class="inp" type="time" value="'+escHtml(tt.time)+'" oninput="clubPlanTmp.time=this.value"></div>';
    h+='<div class="field"><label>'+t('clubMeetupPlaceLabel')+'</label><input class="inp" maxlength="120" value="'+escHtml(tt.place)+'" oninput="clubPlanTmp.place=this.value" placeholder="'+t('clubMeetupPlacePh')+'"></div>';
  } else {
    h+='<div class="field"><label>'+t('clubMeetupTextLabel')+'</label><textarea class="inp" maxlength="500" rows="4" oninput="clubPlanTmp.text=this.value" placeholder="'+t('clubMeetupTextPh')+'">'+escHtml(tt.text)+'</textarea></div>';
  }
  h+='<button class="btn" style="margin-top:14px" onclick="submitClubPlan()">'+t('clubPlanPublishBtn')+'</button>';
  if(clubCache.club && (clubCache.club.shared_plan||clubCache.club.meetup)) h+='<button class="btn ghost sm" style="margin-top:8px;width:auto;color:var(--bad)" onclick="clearClubPlan()">'+t('clubPlanRemoveBtn')+'</button>';
  return h;
}
async function submitClubPlan(){
  const tt=clubPlanTmp; if(!tt||!clubCache.club) return;
  let snap=null;
  if(tt.source==='generated'){
    snap=buildGeneratedSnapshot();
    if(!snap){ toast(t('clubPlanNoGeneratedYet')); return; }
  } else if(tt.source==='custom'){
    if(!tt.customId){ toast(t('clubPlanNoCustomYet')); return; }
    snap=buildCustomSnapshot(tt.customId);
    if(!snap){ toast(t('clubPlanNoCustomYet')); return; }
  } else { toast(t('clubPlanNoGeneratedYet')); return; }
  let meetup=null;
  if(tt.meetupMode==='slot'){
    const place=(tt.place||'').trim().slice(0,120);
    if(place||tt.time) meetup={mode:'slot',day:tt.day,time:tt.time||null,place};
  } else {
    const txt=(tt.text||'').trim().slice(0,500);
    if(txt) meetup={mode:'text',text:txt};
  }
  try{
    const { error } = await window.supabaseClient.rpc('ikorun_set_club_plan',{p_club_id:clubCache.club.id,p_shared_plan:snap,p_meetup:meetup});
    if(error){ toast(t('genericErrorRetry')); return; }
    toast(t('clubPlanPublishedToast'));
    clubPlanEditing=false;
    loadClubData();
  }catch(e){ toast(t('genericErrorRetry')); }
}
function clearClubPlan(){
  if(!clubCache.club) return;
  customConfirm(t('clubPlanRemoveConfirm'),async ()=>{
    try{
      const { error } = await window.supabaseClient.rpc('ikorun_set_club_plan',{p_club_id:clubCache.club.id,p_shared_plan:null,p_meetup:null});
      if(error){ toast(t('genericErrorRetry')); return; }
      clubPlanEditing=false; toast(t('clubPlanRemovedToast')); loadClubData();
    }catch(e){ toast(t('genericErrorRetry')); }
  },{danger:true});
}
async function submitJoinClub(){
  const el=$('#clubCodeInput'); const code=(el?el.value:'').trim();
  if(!code){ toast(t('clubCodePlaceholder')); return; }
  try{
    const { error } = await window.supabaseClient.rpc('ikorun_join_club',{p_code:code});
    if(error){
      if(String(error.message).includes('club_not_found')) toast(t('clubNotFoundToast'));
      else if(String(error.message).includes('rate_limited')) toast(t('tooManyAttemptsToast'));
      else toast(t('genericErrorRetry'));
      return;
    }
    toast(t('clubJoinedToast')); clubShowCreate=false; loadClubData();
  }catch(e){ toast(t('genericErrorRetry')); }
}
async function submitCreateClub(){
  const el=$('#clubNameInput'); const name=(el?el.value:'').trim();
  if(!name){ toast(t('clubNamePlaceholder')); return; }
  try{
    const { error } = await window.supabaseClient.rpc('ikorun_create_club',{p_name:name});
    if(error){
      if(String(error.message).includes('rate_limited')) toast(t('tooManyAttemptsToast'));
      else toast(t('genericErrorRetry'));
      return;
    }
    toast(t('clubCreatedToast')); clubShowCreate=false; loadClubData();
  }catch(e){ toast(t('genericErrorRetry')); }
}
function leaveClubConfirm(){
  customConfirm(t('confirmLeaveClub'),async ()=>{
    try{ await window.supabaseClient.rpc('ikorun_leave_club'); toast(t('clubLeftToast')); loadClubData(); }
    catch(e){ toast(t('genericErrorRetry')); }
  });
}
function removeFriend(otherId){
  customConfirm(t('confirmRemoveFriend'),async ()=>{
    const uid=window.currentUserId;
    await window.supabaseClient.from('friendships').delete().or('and(user_id.eq.'+uid+',friend_id.eq.'+otherId+'),and(user_id.eq.'+otherId+',friend_id.eq.'+uid+')');
    loadFriendsData();
  },{danger:true});
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
  // Médaille dessinée au canvas (remplace l'ancien emoji, non stylable) : cercle dégradé + étoile.
  ctx.save();
  const mg=ctx.createLinearGradient(540-70,350,540+70,490);
  mg.addColorStop(0,'#9FD8FF'); mg.addColorStop(1,'#3D7FFF');
  ctx.fillStyle=mg; ctx.beginPath(); ctx.arc(540,420,70,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#0B1220';
  ctx.beginPath();
  for(let i=0;i<5;i++){
    const a1=-Math.PI/2+i*(2*Math.PI/5), a2=a1+Math.PI/5;
    ctx.lineTo(540+Math.cos(a1)*30,420+Math.sin(a1)*30);
    ctx.lineTo(540+Math.cos(a2)*12,420+Math.sin(a2)*12);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
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
  shareCardImage(b.name,'Badge débloqué sur IKORUN');
}


/* ---------- CHIFFREMENT LOCAL DES DONNÉES DE SANTÉ ----------
   Les données de santé (poids, séances, records, IMC...) ne doivent jamais être
   lisibles en clair dans localStorage : un script tiers malveillant qui tournerait
   sur la page (lib publicitaire compromise, extension navigateur, XSS passif...)
   pourrait sinon les exfiltrer d'un simple coup d'œil dans le storage.
   On chiffre donc tout le contenu des clés "vvv_*" en AES-GCM 256 bits avec une clé
   générée sur l'appareil, marquée NON-EXTRACTIBLE (extractable:false) et gardée en
   IndexedDB — jamais sous forme de chaîne manipulable, jamais envoyée nulle part.
   Le cloud (Supabase, table user_data) continue de recevoir les valeurs en clair :
   il ne s'agit pas de la même surface de risque (canal HTTPS + accès restreint par
   RLS côté serveur), seule la copie assise dans le navigateur est concernée ici. */
const VVVCrypto = (function(){
  const DB_NAME='ikorun_keystore', STORE='keys', KEY_ID='vvv_master_key';
  function openIDB(){
    return new Promise((res,rej)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{ req.result.createObjectStore(STORE); };
      req.onsuccess=()=>res(req.result);
      req.onerror=()=>rej(req.error);
    });
  }
  async function getOrCreateKey(){
    const idb=await openIDB();
    const existing=await new Promise((res,rej)=>{
      const tx=idb.transaction(STORE,'readonly').objectStore(STORE).get(KEY_ID);
      tx.onsuccess=()=>res(tx.result); tx.onerror=()=>rej(tx.error);
    });
    if(existing) return existing;
    const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
    await new Promise((res,rej)=>{
      const tx=idb.transaction(STORE,'readwrite').objectStore(STORE).put(key,KEY_ID);
      tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error);
    });
    return key;
  }
  let _keyPromise=null;
  function ready(){ if(!_keyPromise) _keyPromise=getOrCreateKey(); return _keyPromise; }
  async function encrypt(obj){
    const key=await ready();
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const data=new TextEncoder().encode(JSON.stringify(obj));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,data);
    return 'v1:'+btoa(String.fromCharCode(...iv))+':'+btoa(String.fromCharCode(...new Uint8Array(ct)));
  }
  async function decrypt(str){
    if(!str || !str.startsWith('v1:')) return undefined; // pas notre format -> à migrer par l'appelant
    const [,ivB64,ctB64]=str.split(':');
    const key=await ready();
    const iv=Uint8Array.from(atob(ivB64),c=>c.charCodeAt(0));
    const ct=Uint8Array.from(atob(ctB64),c=>c.charCodeAt(0));
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,ct);
    return JSON.parse(new TextDecoder().decode(pt));
  }
  return { ready, encrypt, decrypt };
})();

/* DB reste une API SYNCHRONE pour ne pas casser les centaines d'appels existants
   (render*, saveAll, etc.) : les valeurs déchiffrées vivent en cache mémoire une
   fois DB.init() résolu (voir window.DB_READY plus bas), et l'écriture chiffrée
   sur disque se fait en tâche de fond sans bloquer l'app. */
const DB = {
  _cache:{},
  async init(){
    await VVVCrypto.ready();
    const keys=Object.keys(localStorage).filter(k=>k.startsWith('vvv_')&&k!=='vvv_owner_uid');
    await Promise.all(keys.map(async raw=>{
      const k=raw.slice(4);
      const stored=localStorage.getItem(raw);
      let val=null;
      try{
        if(stored && stored.startsWith('v1:')){
          val=await VVVCrypto.decrypt(stored);
        } else if(stored){
          // Migration : ancienne valeur JSON en clair -> on la relit une fois puis
          // on la réécrit aussitôt sous forme chiffrée.
          val=JSON.parse(stored);
          this._persist(k,val);
        }
      }catch(e){ console.error('DB.init: échec déchiffrement pour',k,e); }
      this._cache[k]=(val===undefined)?null:val;
    }));
  },
  _persist(k,v){
    VVVCrypto.encrypt(v).then(ct=>{ try{ localStorage.setItem('vvv_'+k, ct); }catch(e){} })
      .catch(e=>console.error('DB: échec chiffrement pour',k,e));
  },
  load(k){ return (k in this._cache) ? this._cache[k] : null; },
  save(k,v){ this._cache[k]=v; this._persist(k,v); cloudPush(k,v); },
  // IMPORTANT : toujours utiliser DB.remove() (et jamais localStorage.removeItem direct) pour les clés
  // synchronisées avec le cloud. Sinon la valeur locale est bien supprimée mais la copie cloud
  // reste présente en base → au prochain cloudPullAll() elle écrase le local et "ressuscite" la donnée
  // (c'était la cause du bug "Annuler la séance" qui ne l'annulait pas vraiment).
  remove(k){ delete this._cache[k]; localStorage.removeItem('vvv_'+k); cloudPush(k, null); }
};

/* ---------- ISOLATION DES DONNÉES LOCALES ENTRE COMPTES ----------
   Bug corrigé : le cache local (DB._cache / localStorage 'vvv_*') n'était
   jamais rattaché à un utilisateur précis. En se déconnectant d'un compte
   réel puis en se connectant en invité (ou avec un autre compte), l'app
   réutilisait telle quelle l'ancienne donnée locale — et DB.save() la
   repoussait même vers le cloud du NOUVEAU compte (fuite de données entre
   comptes sur un même appareil). 'vvv_owner_uid' (en clair, ne contient que
   l'identifiant, aucune donnée perso) mémorise à qui appartient le cache
   local actuel ; tout changement d'utilisateur déclenche un nettoyage complet
   avant la moindre lecture/écriture pour ce nouveau compte. */
function wipeLocalCache(){
  Object.keys(localStorage).filter(k=>k.startsWith('vvv_')).forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} });
  DB._cache={};
}
function ensureLocalCacheOwnership(uid){
  let owner=null;
  try{ owner=localStorage.getItem('vvv_owner_uid'); }catch(e){}
  if(owner && owner!==uid) wipeLocalCache();
  try{ localStorage.setItem('vvv_owner_uid', uid); }catch(e){}
}

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
  /* Migration : les comptes créés avant l'ajout du critère "ancienneté"
     n'ont pas de joinedAt. On le reconstitue à partir de leur toute
     première séance connue (run ou muscu) pour ne pas leur faire perdre
     l'ancienneté déjà acquise ; à défaut, on part d'aujourd'hui. */
  if(P.setupDone && !P.joinedAt){
    const dates=[...SESS,...MSESS].map(s=>s.date).filter(Boolean).sort();
    P.joinedAt = dates.length ? new Date(dates[0]+'T00:00:00').getTime() : Date.now();
    DB.save('profile',P);
  }
}
// Le déchiffrement (IndexedDB + WebCrypto) est asynchrone : tout le reste du
// bootstrap (startApp) attend explicitement ce signal avant de lire/afficher
// quoi que ce soit issu de DB.load().
window.DB_READY = DB.init().then(reloadState);

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
    todayGoals:'Objectifs du jour',weekLoad:'Charge de la semaine',sessions:'séances',form:'forme',
    quipTime:'On chasse le {0} ?',quipGoal:'On avance vers : {0} ?',quipDefault:'Prêt à dépasser tes limites aujourd\u2019hui ?',
    weekLoadTitle:'Charge hebdomadaire',levelXp:'Niveau {0} — {1} XP',xpBeforeLevel:'+{0} XP avant niveau {1}',
    sessionsCap:'Séances',tonnageKg:'Tonnage kg',formCap:'Forme',nextSession:'PROCHAINE SÉANCE',today:'Aujourd\u2019hui',
    restDay:'Jour de repos',noSessionToday:'Aucune séance planifiée aujourd\u2019hui',recordsPerso:'Records perso',
    iDidIt:'Je l\u2019ai faite',notDone:'Pas faite',nextLab:'Ensuite',dayPlusShort:'J+{0}',rpeShort:'RPE',kmWeekShort:'km sem.',sessionsLab:'séances',
    syncSlowToast:'Synchronisation lente — l\u2019app démarre, tes données arrivent',syncFailedLocalToast:'Synchronisation impossible — tu travailles sur tes données locales',syncCloudErrorToast:'Erreur de synchronisation avec le cloud',
    doneTag:'Faite',
    setsCount:'{0} séries',daysAgoShort:'il y a {0} j',neverDoneLab:'Jamais faite',
    pauseLab:'Mettre en pause',restTimerBtn:'Minuteur de repos',
    googleStandaloneTitle:'Google et l\u2019app install\u00e9e',googleUseEmailBtn:'Se connecter par email',googleOpenSafariBtn:'Ouvrir dans Safari',googleStandaloneHint:'Indisponible depuis l\u2019app install\u00e9e',
    declineBtn:'Refuser',saveLabel:'Enregistrer',renameLab:'Renommer',favoriteLab:'Favori',
    langLab:'Langue',obModeTitle:'Ton affichage',obModeIntro:'Deux façons de voir IKORUN — change d\u2019avis à tout moment dans Profil.',obModeFullT:'Complet',obModeFullD:'Toutes les stats, tous les détails de chaque séance, l\u2019anatomie musculaire, les graphiques. Pour creuser.',obModeSimpleT:'Simplifié',obModeSimpleD:'Une carte, l\u2019essentiel : la séance du jour et un bouton. Rien d\u2019autre à l\u2019écran. Pour aller droit au but.',obModeSuggestion:'Suggestion selon ton âge : {0}. Choisis librement.',chooseModeLab:'Choisis un affichage pour continuer',
    trackingLab:'Suivi',appearanceLab:'Apparence',
    sendFeedbackLab:'Envoyer un commentaire',feedbackNoAddressToast:'Adresse de contact pas encore configurée — réessaie après la prochaine mise à jour.',feedbackTitle:'Ton avis',feedbackIntro:'Une idée, un bug, un truc qui te gêne dans l\u2019app ? Écris-le ici, ça part directement dans ta boîte mail.',feedbackPh:'Écris ton commentaire...',feedbackEmptyToast:'Écris quelque chose avant d\u2019envoyer',feedbackSentToast:'Ton appli mail s\u2019est ouverte, il ne reste qu\u2019à envoyer',feedbackSignature:'Compte : {0} · Langue : {1}',
    sendBtn:'Envoyer',
    playLab:'Démarrer',
    cvCat_dist:'Distance',cvCat_pace:'Allure',cvCat_weight:'Poids',cvTapToEdit:'Touche pour modifier',
    googleStandaloneBody:'Sur iPhone, quand IKORUN est ouvert depuis l\u2019ic\u00f4ne de l\u2019\u00e9cran d\u2019accueil, la connexion Google part dans Safari et n\u2019en revient pas : elle r\u00e9ussit, mais dans Safari, pas ici. Connecte-toi par email dans l\u2019app, ou ouvre IKORUN dans Safari pour utiliser Google.',
    progression:'Progression',planOfDay:'PLAN DU JOUR',planIkorunDesc:'Plans d\u2019entraînement conçus par des coaches',
    myPlanDesc:'Crée ton propre plan sur mesure',todayCap:'AUJOURD\u2019HUI',tapToStart:'Voir le détail',
    goalCap:'OBJECTIF',courseDefault:'Course',goalTimeColon:'Objectif : {0} · ',raceOn:'Course le {0}',raceDay:'Jour de course',
    currentVdot:'VDOT actuel',currentPhase:'Phase actuelle',thisWeek:'Cette semaine',weekOf:'Semaine {0}/{1}',
    weeklyLoad:'Charge hebdo',regenConfirm:'Régénérer un nouveau plan ? Tes séances faites restent dans tes stats.',
    regenBtn:'Régénérer / reconfigurer',planIkorunPill:'Plan IKORUN',myPlanPill:'Plan personnel',
    planIkorunTitle:'Plan IKORUN — moteur scientifique',
    planIkorunDescLong:'Génère un plan périodisé sur-mesure (méthode norvégienne + VDOT/Daniels) basé sur ton VDOT ({0}), ton objectif, tes préférences et ta date de course. Le plan se réajuste automatiquement si tu rates une séance.',
    planIkorunDescSimple:'Crée ton plan d’entraînement, adapté à ton niveau et à ta course. Il s’ajuste tout seul si tu rates une séance.',
    configureGenerate:'Configurer & générer',weekN:'Semaine {0}',deloadTag:' · allégée',missedTag:'Manquée',restTag:'Repos',
    newPersoPlan:'Nouveau plan personnel',createCustomPlan:'Crée ton plan sur-mesure',
    createCustomPlanDesc:'Ajoute tes propres séances, choisis les dates, types et allures. Tout se synchronise avec ton accueil et tes stats.',
    sessionsCount:'{0} séances · {1} terminées',followedTag:'Suivi',duplicate:'Dupliquer',share:'Partager',
    planNamePrompt:'Nom du plan :',myPersoPlanDefault:'Mon plan perso',
    you:'toi',dowShort:'L,M,M,J,V,S,D',greet:'Salut',
    weekPhaseLabel:'Semaine {0} · {1}',thresholdPaceShort:'Allure seuil',vsLastWeekShort:'vs sem. dernière',
    nextSessionMeta:'Prochaine séance · {0}',newWeekTag:'Nouvelle semaine',thisWeekCap:'Cette semaine',
    totalTime:'Temps total',remainingCap:'Restant',sessionsRemainingVal:'{0} séances',objectiveReached:'Objectif atteint',
    untilEndWeek:'d\u2019ici dimanche',sessionsDoneShort:'{0} séances',planOfWeek:'Plan de la semaine',
    streakDaysShort:'{0} jours de série',seePlan:'Voir le plan',
    // --- Outils ---
    searchTool:'Rechercher un outil...',favorites:'Favoris',mainTools:'Outils principaux',otherTools:'Autres outils',
    resultsCount:'{0} résultat(s)',editFavsTitle:'Modifier les favoris',tapStarHint:'Touche une étoile pour ajouter/retirer un outil de tes favoris.',
    toolAioName:'Performance Lab',toolAioSub:'Distance · Temps · Allure · Vitesse',
    toolSanteName:'Tableau de bord Santé',toolSanteSub:'Poids, IMC, sommeil, nutrition...',
    toolChronoName:'Chronomètre',toolChronoSub:'Tours, splits & statistiques',
    toolConvertName:'Convertisseur',toolConvertSub:'Allure, distance, poids...',
    toolNotesName:'Notes',toolNotesSub:'Bloc-notes rapide',
    toolVdotName:'VDOT & VO₂max',toolVdotSub:'Estimer ta cylindrée',
    toolImcName:'IMC',toolImcSub:'Indice de masse corporelle',
    toolHydraName:'Hydratation',toolHydraSub:'Tes besoins en eau',
    toolBmrName:'Calories & Métabolisme',toolBmrSub:'Besoins quotidiens',
    toolAgendaName:'Agenda',toolAgendaSub:'Tous vos événements',
    toolPriereName:'Prières',toolPriereSub:'Tous les horaires',
    // --- Profil ---
    athleteDefault:'Athlète',addBioPrompt:'Ajoute une biographie',heightWeight:'Taille / poids',
    noObjective:'Aucun',noBadgeYet:'Aucun badge obtenu pour l\u2019instant — ta première séance te rapprochera du badge Initié.',
    seeAllProgress:'{0} / {1} · Voir tout',nextBadgeLab:'Prochain badge · {0}',
    account:'Compte',friendsRanking:'Amis & Classement',manageProfile:'Gérer le profil',passwordSecurity:'Mot de passe & sécurité',
    notConnected:'Non connecté',notifLabel:'Notifications',preferences:'Préférences',historyRecords:'Historique & records',
    statistics:'Statistiques',theme:'Thème',appColor:'Couleur de l\u2019app',simplifiedMode:'Mode simplifié',
    simplifiedModeDesc:'4 onglets, écrans allégés, textes plus grands — l\u2019essentiel seulement',
    support:'Support',helpCenter:'Centre d\u2019aide',footerTag:'IKORUN — Elite Athletic Intelligence · v2.0',
    yourSpace:'Ton espace',settings:'Réglages',badgesLabel:'Badges',toolsCalc:'Outils & calculateurs',editMyProfile:'Modifier mon profil',
    // --- Stats ---
    tabBilan:'Bilan',tabRun:'Course',tabMuscu:'Muscu',tabTrophies:'Trophées',
    perWeek:'Semaine',perMonth:'Mois',per3Month:'3 Mois',perYear:'Année',
    completeProfileTitle:'Complète ton profil',completeProfileDesc:'Ta taille et ton poids servent à calculer ton IMC, tes calories et tes besoins.',
    chooseHeight:'Choisir ta taille',chooseWeight:'Choisir ton poids',
    mileage:'Kilométrage',kmCumulated:'km cumulés',vsPrevPeriod:'vs période préc.',
    volumeTrend:'Tendance volume',kmThisWeek:'km cette sem.',eightWeeksLab:'8 sem.',weeksAgoLab:'Il y a 8 sem.',
    totalTime:'Temps total',overPeriod:'sur la période',goalReached:'Objectif atteint !',ofTarget:'{0}% de la cible',
    kmPerSession:'KM / SÉANCE',sessionTypesLabel:'TYPES DE SÉANCE',bestDayLab:'MEILLEUR JOUR',bestWeekLab:'MEILLEURE SEMAINE',bestMonthLab:'MEILLEUR MOIS',
    detailByType:'Détail par type',last13Weeks:'13 dernières semaines',lessLabel:'Moins',moreLabel:'Plus',vsPrevShort:'vs préc.',
    typeMuscu:'Muscu',typeAutre:'Autre',insightsTitle:'Insights',
    quickTimer:'Minuteur',lvlShort:'NIV.',
    vdotReal:'VDOT réel',sessionsRun:'Séances run',kmTotal:'km totaux',paceZones:'Zones d\u2019allure',
    predictions:'Prédictions',formFatigue:'Forme / Fatigue',personalRecords:'Records personnels',
    chronic:'Chronique',acute:'Aiguë',tonnageLab:'Tonnage',prPerSession:'PR (kg/séance)',totalSets:'Séries totales',
    startFirstMuscu:'Lance ta première séance de muscu !',lastSessions:'Dernières séances',
    tomorrow:'Demain',noUpcomingSession:'Aucune séance planifiée prochainement.',addSession:'Ajouter une séance',
    showRestPlan:'Afficher le reste du plan · {0} semaines',calendarTitle:'Calendrier',calendarSub:'Planifie ta progression',
    friendsTitle:'Amis & Classement',tabFriendsList:'Amis',tabRank:'Classement',
    clubTitle:'Mon club',tabClub:'Mon club',myClubLab:'Mon club',
    noClubYet:'Pas encore de club',noClubYetDesc:'Rejoins le club de ton équipe avec un code, ou crée le tien pour rassembler tes coéquipiers.',
    joinClubCta:'Rejoindre un club',createClubCta:'Créer un club',clubCodePlaceholder:'Code à 6 caractères',clubNamePlaceholder:'Nom du club',
    joinBtn:'Rejoindre',clubMembersCount:'{0} membre(s)',copyCodeBtn:'Copier le code',shareCodeHint:'Partage ce code à tes coéquipiers pour qu’ils te rejoignent.',
    clubXpRanking:'Classement du club (XP)',leaveClubBtn:'Quitter le club',confirmLeaveClub:'Quitter ce club ? Tu pourras en rejoindre un autre à tout moment.',
    clubCreatedToast:'Club créé !',clubJoinedToast:'Bienvenue dans le club !',clubLeftToast:'Tu as quitté le club',clubNotFoundToast:'Aucun club avec ce code',
    tooManyAttemptsToast:'Trop de tentatives, réessaie dans un instant',codeCopiedToast:'Code copié',
    clubPlanTitle:'Plan du club',clubPlanNoneOwner:'Pas encore de plan partagé. Choisis ton plan IKORUN ou l’un de tes plans persos pour que tout le club s’entraîne ensemble.',clubPlanNoneMember:'Le créateur du club n’a pas encore publié de plan partagé.',
    clubPlanConfigureBtn:'Configurer le plan du club',clubPlanEditBtn:'Modifier le plan du club',clubPlanNoUpcoming:'Aucune séance à venir dans ce plan.',
    clubPlanSourceLabel:'Quel plan partager ?',clubPlanSourceGenerated:'Mon plan IKORUN',clubPlanSourceCustom:'Un de mes plans persos',
    clubPlanNoGeneratedYet:'Tu n’as pas encore de plan IKORUN généré. Va dans Sport pour en créer un, puis reviens ici.',clubPlanNoCustomYet:'Tu n’as pas encore de plan perso. Crée-en un dans Sport > Plan personnel.',
    clubPlanSessionsCount:'{0} séances programmées',clubMeetupLabel:'Regroupement',clubMeetupModeSlot:'Heure & lieu',clubMeetupModeText:'Description libre',
    clubMeetupTimeLabel:'Heure',clubMeetupPlaceLabel:'Lieu',clubMeetupPlacePh:'ex : Parc de la Tête d’Or, entrée nord',
    clubMeetupTextLabel:'Description',clubMeetupTextPh:'ex : On se retrouve devant la mairie, chacun vient quand il peut...',
    clubPlanPublishBtn:'Publier',clubPlanRemoveBtn:'Retirer le plan du club',clubPlanPublishedToast:'Plan du club publié !',clubPlanRemovedToast:'Plan du club retiré',
    clubPlanRemoveConfirm:'Retirer le plan et le regroupement du club ? Les membres ne les verront plus.',
    loginToAddFriends:'Connecte-toi avec Google pour ajouter des amis et te comparer.',
    searchFriendPlaceholder:'Chercher un ami par pseudo',receivedRequests:'Demandes reçues',acceptBtn:'Accepter',
    yourFriendsCount:'Tes amis ({0})',noFriendsYet:'Pas encore d\u2019amis — cherche quelqu\u2019un par son pseudo !',
    sentRequests:'Demandes envoyées',awaitingResponse:'En attente de réponse…',xpRanking:'Classement XP entre amis',
    addFriendsUnlock:'Ajoute des amis pour débloquer le classement !',youParen:' (toi)',
    searchingLab:'Recherche…',loginToSearchFriends:'Connecte-toi pour chercher des amis',noUsernameFound:'Aucun pseudo trouvé',
    loadingLab:'Chargement…',friendsLoadError:'Impossible de charger tes amis. Vérifie ta connexion.',retryBtn:'Réessayer',
    resumeBtn:'Reprendre',discardBtn:'Abandonner',
    alreadyLinked:'déjà lié',addBtn:'Ajouter',searchError:'Erreur de recherche',alreadySentOrFriend:'Déjà envoyé ou déjà ami',
    requestSent:'Demande envoyée',friendProfileTitle:'Profil',removeLab:'Retirer',lvlDot:'Niv.',kmThisWeekShort:'{0} km cette semaine',youDefaultName:'Toi',backToFriends:'Retour aux amis',profileNotFound:'Profil introuvable.',noBadgeUnlocked:'Aucun badge débloqué pour l\u2019instant.',kmPerWeek:'km/sem.',daysStreak:'Jours de suite',kmTotalLab:'km au total',tonnageKgLab:'Tonnage kg',
    addPerf:'Ajouter une performance',addChronosHint:'Ajoute tes chronos : ils alimentent ton VDOT et ton plan.',
    bestPerf:'Meilleure perf',avgHR:'FC moy',maxHRshort:'max',perfHistoryTitle:'Historique des performances',
    chooseDistance:'Choisis la distance',otherDist:'Autre',customDistance:'Distance personnalisée',
    chronoLab:'Chrono *',chronoFor:'Chrono {0}',dateField:'Date',placeOptional:'Lieu (optionnel)',
    placeholderPlace:'Lieu de la course',feelOptional:'Sensation (optionnel)',feelPlaceholder:'Comment c\u2019était ?',
    officialComp:'Compétition officielle',saveThisPerf:'Enregistrer cette performance',backBtn:'Retour',
    perfAddedComp:'Performance ajoutée · +XP compétition',perfAdded:'Performance ajoutée',
    editProfileTitle:'Modifier le profil',usernameLab:'Nom d\u2019utilisateur',usernameHint:'Utilisé par tes amis pour te retrouver',
    firstNameLab:'Prénom',cityLab:'Ville',birthDateLab:'Date de naissance',heightCmLab:'Taille (cm)',weightKgLab:'Poids (kg)',
    kmWeekLab:'Km / semaine',compDateLab:'Date compétition',coachLab:'Coach',saveBtn:'Sauver',
    filterAll:'Tous',filterObtained:'Obtenus',filterLocked:'Verrouillés',badgesObtainedCount:'{0} / {1} badges obtenus',
    badgeDetailTitle:'Détails du badge',tierOf:'Palier {0} sur {1}',newBadgeUnlocked:'NOUVEAU BADGE DÉBLOQUÉ',
    tapToContinue:'Touche pour continuer',seeDetails:'Voir les détails',tapToClose:'Touche pour fermer',previewLocked:'APERÇU · VERROUILLÉ',
    obtainedOn:'Obtenu le {0}',lockedLab:'Verrouillé',replayAnim:'Revivre l\u2019animation',seePreview:'Voir un aperçu',
    obtainConditions:'Conditions d\u2019obtention',globalProgress:'Progression globale',shareBadgeBtn:'Partager ce badge',closeLab:'Fermer',
    weightLab:'Poids',imcLab:'IMC',imcUnderweight:'Maigreur',imcNormal:'Normal',imcOverweight:'Surpoids',imcObese:'Obésité',
    sessionsPerWeek:'Séances / sem',metabolismKcal:'Métabolisme kcal',burned7d:'Brûlées 7j (run)',waterPerDay:'Eau / jour',
    recentFormTitle:'Forme récente (7 dernières séances)',sleepLab:'Sommeil',energyFeelLab:'Énergie / sensations',fatigueLab:'Fatigue',
    tipBalanced:'Tout est équilibré, continue ainsi !',tipHighFatigue:'Fatigue élevée : privilégie le repos et le sommeil cette semaine.',
    tipLowSleep:'Ton sommeil est insuffisant : vise 8h pour mieux récupérer.',tipGreatFeel:'Excellentes sensations : tu peux pousser un peu plus !',
    noDebriefHint:'Termine des séances avec leur bilan pour suivre ton sommeil, ta fatigue et ta récupération ici.',
    nutritionTitle:'Repères nutrition (athlète)',proteinLab:'Protéines',carbsLab:'Glucides',fatLab:'Lipides',kcalTarget:'kcal cible',
    weightPickerTitle:'Ton poids (kg)',weightSaved:'Poids enregistré',
    labHint:'Saisis <b>2 valeurs</b> que tu connais. Les 2 autres se calculent automatiquement.',
    distField:'Distance',timeField:'Temps',paceField:'Allure',speedField:'Vitesse',calculatedLab:'calculé',toFillLab:'à saisir',
    resetBtn:'Réinitialiser',splitTimesTitle:'Temps de passage',
    vdotToolTitle:'VDOT (Jack Daniels)',physioEstimates:'Estimations physiologiques',vo2maxEst:'VO₂max estimé',
    thresholdPace:'Allure seuil lactique',marathonPace:'Allure marathon',halfPace:'Allure semi',efPace:'Allure EF',
    vdotAutoTip:'Ton VDOT se met à jour automatiquement depuis tes records. Ajoute tes chronos dans Profil → Records.',
    waterNeedsTitle:'Besoins en eau',dailyRest:'Quotidien (repos)',perRunHour:'Par heure de course',perHeatHour:'Par forte chaleur (+/h)',
    hydraTip:'Bois régulièrement par petites gorgées. Surveille la couleur de ton urine.',
    basalMetabolism:'Métabolisme basal (kcal/j)',needsByActivity:'Besoins selon activité',
    actSedentary:'Sédentaire',actLight:'Léger',actModerate:'Modéré',actIntense:'Intense',actAthlete:'Athlète',
    valueField:'Valeur',fromField:'De',toField:'Vers',
    quickNotesTitle:'Notes rapides',notesPlaceholder:'Écris ici... (sauvegarde automatique)',autoSaveLocal:'Sauvegarde automatique en local.',
    lapBtn:'Tour',stopBtn:'Stop',resetBtn2:'Reset',bestLap:'Meilleur tour',slowestLap:'Plus lent',avgLap:'Moyenne',lapsLab:'Tours',
    exportBtn:'Exporter',fastTag:'rapide',slowTag:'lent',lapsCopied:'Tours copiés',
    addEventBtn:'Ajouter un événement',competitionDefault:'Compétition',noEventLab:'Aucun événement',pastLab:'passé',
    eventTitlePrompt:'Titre de l\u2019événement :',eventDatePrompt:'Date (AAAA-MM-JJ) :',eventAdded:'Événement ajouté',
    prayerTitle:'Prières · Béjaïa',uoifMethod:'Méthode UOIF · {0}',
    obWelcomeTitle:'Bienvenue sur IKORUN',obWelcomeIntro:'Elite Athletic Intelligence.<br>Ton coaching personnel, calculé scientifiquement, 100% hors-ligne.',
    obWhoTitle:'Qui es-tu ?',obWhoIntro:'Tes informations de base.',firstNamePh:'Ton prénom',firstNameReq:'Prénom *',
    usernameReq:'Nom d\u2019utilisateur *',usernamePh:'pseudo_unique',
    birthDateReq:'Date de naissance *',sexReq:'Sexe *',selectLab:'Sélectionner',maleLab:'Homme',femaleLab:'Femme',
    obLevelTitle:'Ton niveau',obLevelIntro:'Sois honnête, le plan s\u2019adapte.',
    levelNote:'Le <b>niveau</b> ajuste l\u2019intensité de ton plan et ton volume d\u2019entraînement, calculés automatiquement. Pas sûr ? Touche <b>« Comment choisir ? »</b>.',
    levelReq:'Niveau *',howChooseLab:'Comment choisir ?',
    lvlBeginner:'Débutant',lvlIntermediate:'Intermédiaire',lvlAdvanced:'Confirmé',lvlVeryAdvanced:'Très avancé',lvlElite:'Élite',
    obGoalTitle:'Ton objectif',obGoalIntro:'Ce qui te fait courir.',goalReq:'Objectif *',goalPh:'Ex : passer sous 20:00 au 5 km',
    compDateReq:'Date de compétition *',coachOptional:'Coach — optionnel',coachPh:'Nom de ton coach',
    obPerfTitle:'Tes performances',obPerfIntro:'Ajoute tes meilleurs chronos. Au moins un est requis.',
    perfNote:'Tes chronos calculent ton <b>VDOT</b> (ta « cylindrée ») et toutes tes <b>allures d\u2019entraînement</b>. Donne au moins un chrono récent et fiable. Choisis la distance puis le temps avec les roues.',
    addAnotherPerf:'Ajouter une autre performance',backLab:'Retour',continueLab:'Continuer',
    paramsTitle:'Paramètres',libTitle:'Bibliothèque',configureTitle:'Configurer',programTitle:'Programme',sessionTitle:'Séance',
    newProgramTitle:'Nouveau programme',homeDefault:'Accueil',chooseLab:'Choisir',validateLab2:'Valider',
    understoodLab:'Compris',howChooseLevelTitle:'Comment choisir mon niveau ?',
    lvlBeginnerDesc:'Tu cours depuis moins d\u2019un an. Tu t\u2019entraînes occasionnellement et tu découvres encore les bases.',
    lvlIntermediateDesc:'Tu cours régulièrement, participes parfois à des compétitions et maîtrises les principaux types de séances.',
    lvlAdvancedDesc:'Plusieurs années d\u2019entraînement, une pratique structurée et des objectifs chronométriques précis.',
    lvlVeryAdvancedDesc:'Entraînement intensif, plusieurs compétitions par an, très bon niveau régional ou national.',
    lvlEliteDesc:'Athlète de haut niveau : performances nationales/internationales, entraînement quotidien à très gros volume.',
    checkingLab:'Vérification…',
    fillRequiredFields:'Remplis les champs requis',chooseUsernameLab:'Choisis un nom d\u2019utilisateur',usernameUnavailable:'Ce nom d\u2019utilisateur n\u2019est pas disponible',
    quickProfileEnabled:'Profil rapide activé — mode simplifié activé',chooseLevelLab:'Choisis un niveau',goalDateRequired:'Objectif et date requis',addAtLeastOnePerf:'Ajoute au moins une performance',
    finishLab:'Terminer',distanceLab2:'Distance',timeForLab:'Temps · {0}',chooseWord:'Choisir',
    usernameTakenMeanwhile:'Pseudo pris entre-temps, modifie-le dans Profil',
    liveFinishBtn:'Terminer',durationLab:'Durée',volumeLab:'Volume',setsLab:'Séries',deleteLab2:'Supprimer',
    exerciseDoneLab:'Terminé',setsDoneCount:'{0}/{1} séries faites',restTimerLab:'Minuteur de repos : {0}',disabledLab:'Désactivé',
    setCol:'Set',prevCol:'Précédent',kgCol:'Kg',repsCol:'Reps',addSetBtn:'Ajouter une série',
    addExerciseBtn:'Ajouter un exercice',cancelSessionBtn:'Annuler la séance',
    restSeconds:'Repos (secondes)',minOneSetRemain:'Il doit rester au moins une série',changeRestLab:'Modifier le repos',
    removeExLab:'Retirer cet exercice',cancelLab:'Annuler',minOneExRemain:'Il doit rester au moins un exercice',
    removeExConfirmTitle:'Retirer cet exercice ?',removeLab2:'Retirer',exerciseRemoved:'Exercice retiré',
    exercisesReordered:'Ordre des exercices mis à jour',
    exerciseAdded:'Exercice ajouté',sessionSaved:'Séance sauvegardée — reprends quand tu veux',xpGain:'+5 XP',
    restTitle:'Repos',secLab:'sec',add30sLab:'+30s',skipLab:'Passer',cancelSessionTitle:'Annuler la séance ?',
    progressLostText:'Ta progression sur cette séance sera perdue.',continueLab2:'Continuer',yesCancelLab:'Oui, annuler',sessionCancelled:'Séance annulée',
    sessionDoneTitle:'Séance terminée !',tonnageParenKg:'Tonnage (kg)',repsLab:'Répétitions',caloriesLab:'Calories',recordsBrokenLab:'Records battus',
    tonnageVsLastLab:'de tonnage vs ta dernière séance {0}.',newRecordsLab:'Nouveaux records',musclesWorkedLab:'Muscles travaillés',xpEarnedLab:'+50 XP gagnés !',
    programNameLab:'Nom du programme',programNamePh:'Mon programme',descriptionLab:'Description',descriptionPh:'Objectif, split, fréquence...',
    objectiveLab2:'Objectif',iconLab:'Icône',colorLab:'Couleur',exercisesCountLab:'Exercices ({0})',addExFromLib:'Ajoute des exercices depuis la bibliothèque.',
    addFromLibBtn:'Ajouter depuis la bibliothèque',saveProgramBtn:'Enregistrer le programme',giveNameLab:'Donne un nom',addExercisesLab:'Ajoute des exercices',programCreated:'Programme créé',
    sessTitle_EF:'Endurance Fondamentale',sessLabel_EF:'EF',
    sessTitle_RECUP:'Récupération active',sessLabel_RECUP:'Récup',
    sessTitle_LONG:'Sortie Longue',sessLabel_LONG:'Long',progressiveSuffix:' progressive',
    sessTitle_TEMPO:'Tempo Run',sessLabel_TEMPO:'Tempo',
    sessTitle_TEMPO_SPE:'Tempo allure spécifique',sessLabel_TEMPO_SPE:'Tempo spé',
    sessTitle_SEUIL:'Séance au Seuil',sessLabel_SEUIL:'Seuil',
    sessTitle_DBLSEUIL:'Double Seuil (méthode norvégienne)',sessLabel_DBLSEUIL:'Double seuil',
    sessTitle_VMAc:'VMA Courte',sessLabel_VMAc:'VMA courte',
    sessTitle_VMAl:'VMA Longue',sessLabel_VMAl:'VMA longue',
    sessTitle_VO2:'Séance VO₂max',sessLabel_VO2:'VO₂max',
    sessTitle_INTERVAL:'Intervalles mixtes',sessLabel_INTERVAL:'Intervalles',
    sessTitle_SPE:'Allure Spécifique',sessLabel_SPE:'Allure spé',
    sessTitle_PROGRESSIF:'Run Progressif',sessLabel_PROGRESSIF:'Progressif',
    sessTitle_FARTLEK:'Fartlek (jeu d\u2019allures)',sessLabel_FARTLEK:'Fartlek',
    sessTitle_COTES:'Séance de Côtes',sessLabel_COTES:'Côtes',
    sessTitle_LIGNES:'Footing + Lignes droites',sessLabel_LIGNES:'Lignes',
    sessTitle_COURSE:'Jour J',sessLabel_COURSE:'Course',
    sessTitle_default:'Endurance',sessLabel_default:'EF',
    phase_PG:'Préparation générale',phase_AERO:'Développement aérobie',phase_VO2:'Développement VO₂max',
    phase_SPE:'Développement spécifique',phase_PIC:'Pic de forme',phase_TAPER:'Affûtage',
    bdg_debutant_name:'Débutant',bdg_debutant_desc:'Le tout début de l\u2019aventure IKORUN.',
    bdg_amateur_name:'Amateur',bdg_amateur_desc:'Tu prends le rythme.',
    bdg_sportif_name:'Sportif',bdg_sportif_desc:'L\u2019entraînement devient une habitude.',
    bdg_athlete_name:'Athlète',bdg_athlete_desc:'Tu progresses avec sérieux.',
    bdg_expert_name:'Expert',bdg_expert_desc:'Une vraie maîtrise de ton entraînement.',
    bdg_elite_name:'Élite',bdg_elite_desc:'Constante amélioration.',
    bdg_maitre_name:'Maître',bdg_maitre_desc:'Maîtrise ton corps et ton mental.',
    bdg_legende_name:'Légende',bdg_legende_desc:'Devenu une référence.',
    tierBronze:'Bronze',tierArgent:'Argent',tierOr:'Or',tierPlatine:'Platine',tierDiamant:'Diamant',tierMaitre:'Maître',tierLegende:'Légende',
    medalCatSeances:'Séances',medalCatRegularite:'Régularité',medalCatDistance:'Distance',
    daysLab:'jours',continueUnlockBadges:'Continue pour débloquer tes badges',    ach_premiere_name:'Première course',ach_premiere_desc:'Termine la course que tu préparais.',
    ach_cinqk_name:'5K',ach_cinqk_desc:'Cours plus de 5 km d\u2019une traite.',
    ach_dixk_name:'10K',ach_dixk_desc:'Cours plus de 10 km d\u2019une traite.',
    ach_serie_name:'Série',ach_serie_desc:'Tiens un mois de régularité (30 jours d\u2019affilée).',
    ach_denivele_name:'Dénivelé',ach_denivele_desc:'Plus de 200 m de D+ sur une séance ou une course.',
    ach_podium_name:'Podium',ach_podium_desc:'Finis dans le top 3 d\u2019une course.',
    ach_objectif_name:'Objectif atteint',ach_objectif_desc:'Réalise ton chrono visé (ou plus vite) sur la course préparée.',
    ach_nouveaupb_name:'Nouveau PB',ach_nouveaupb_desc:'Bats un nouveau record avec un VDOT supérieur à ton précédent record.',
    ach_allure_name:'Allure',ach_allure_desc:'Cours au moins 3 km à une allure de 10:00/km ou plus rapide.',
    ach_endurance_name:'Endurance',ach_endurance_desc:'Termine une sortie d\u2019au moins 15 km.',
    ach_puissance_name:'Puissance',ach_puissance_desc:'Fais au moins 3 séances de musculation en une seule semaine.',
    ach_vo2max_name:'VO2 Max',ach_vo2max_desc:'Atteins un VO\u2082max estimé supérieur à 50.',
    ach_force_name:'Force',ach_force_desc:'Soulève plus de 20 000 kg cumulés en une seule semaine.',
    catAccomplissement:'Accomplissement',catPerformance:'Performance',allYearsLab:'Toutes',
    tapTrophyHint:'Touche un trophée pour voir l\u2019animation ou la condition à remplir pour l\u2019obtenir.',
    noTrophyInYear:'Aucun trophée obtenu en {0}.',badgeUnlockedToast:'{0} débloqué !',badgeRemovedToast:'Badge retiré',
    objForce:'Force',objMass:'Masse',objEndurance:'Endurance',objWeightLoss:'Perte poids',objMaintain:'Maintien',
    colBlue:'Bleu',colRed:'Rouge',colGreen:'Vert',colGold:'Or',colPurple:'Violet',colCyan:'Cyan',
    newTrophyUnlocked:'NOUVEAU TROPHÉE DÉBLOQUÉ',
    markAsObtained:'Marquer comme obtenu',
    connectingGoogle:'Connexion à Google…',googleConnectFail:'Connexion impossible, réessaie',googleNotWorkingLink:'Ça ne marche pas ?',googleReturnedNoSessionToast:'La connexion Google n’a pas abouti. Réessaie, ou utilise l’email / le mode invité.',
    confirmLogout:'Se déconnecter ? Tes données restent sauvegardées sur ton compte.',
    confirmSwitchGoogle:'Tu vas être déconnecté(e) pour te reconnecter avec un autre compte Google. Tes données actuelles restent sauvegardées.',
    confirmDeleteAllData:'Cette action va supprimer TOUTES tes données (séances, records, XP, profil...) de façon définitive, sur le cloud et sur cet appareil. Continuer ?',
    confirmFinalIrreversible:'Dernière confirmation : es-tu vraiment sûr(e) ? Cette action est irréversible.',
    genericErrorRetry:'Erreur, réessaie',
    confirmRemoveFriend:'Retirer cet ami ?',
    connectFirst:'Connecte-toi d\u2019abord',copiedClipboard:'Copié dans le presse-papier',
    usernameFormatHint:'3 à 20 caractères : lettres, chiffres, _',checkingEllipsis:'Vérification…',
    available:'Disponible',alreadyTaken:'Déjà pris',
    alarmDefaultTitle:'Alarme',timeUpMsg:'Le temps est écoulé !',timeUpTitle:'Temps écoulé !',
    stopAlarm:'Arrêter l\u2019alarme',remindIn5Min:'Rappel dans 5 min',reminderCap:'Rappel',fiveMinElapsed:'5 minutes écoulées',
    sessionInProgress:'Séance en cours',welcomeToast:'Bienvenue',
    resumeSessionConfirm:'Une séance « {0} » était en cours ({1} min). Reprendre ?',sessionColonName:'Séance : {0}',
    accentBlue:'Bleu',accentRed:'Rouge',accentGreen:'Vert militaire',accentBrown:'Marron boisé',accentYellow:'Jaune',accentCarbon:'Fibre de carbone',
    colorApplied:'Couleur appliquée',easyModeOn:'Mode simplifié activé',easyModeOff:'Mode simplifié désactivé',
    profileIncompleteAddTime:'Profil incomplet : ajoute un chrono dans tes records',chooseCompDate:'Choisis une date de compétition',
    planGenerated:'Plan « {0} » généré : {1} sem, {2} séances',raceGeneric:'course',
    followingPersoPlan:'Tu suis maintenant ce plan perso',backToIkorunPlan:'Retour au plan IKORUN',
    namePromptLabel:'Nom :',copySuffix:'(copie)',confirmDeletePlan:'Supprimer ce plan ?',
    addAtLeastOneRepTime:'Ajoute au moins un temps de répétition',sessionAdded:'Séance ajoutée',
    myPlanColon:'Mon plan : {0}',shareNotSupported:'Partage non supporté',confirmDeleteProgram:'Supprimer ce programme ?',
    routineTitle:'Routine',exercisesCount:'{0} exercices',exercisesCap:'Exercices',setsCap:'Séries',estDurationCap:'Durée est.',
    setsRepsLine:'{0} séries · {1} reps',addExercise:'Ajouter un exercice',startWorkout:'Commencer l\u2019entraînement',
    defaultProgramsNotEditable:'Les programmes par défaut ne sont pas modifiables',
    heightCmTitle:'Taille (cm)',weightKgTitle:'Poids (kg)',heightSaved:'Taille enregistrée',weightSaved:'Poids enregistré',
    deservedBreak:'Pause méritée !',backToWork:'Au travail !',setDuration:'Règle une durée',
    photoUpdated:'Photo mise à jour',photoRemoved:'Photo supprimée',bioPromptLabel:'Ta biographie :',
    usernameInvalid:'Pseudo invalide (3-20, lettres/chiffres/_)',usernameNotAvailable:'Ce pseudo n\u2019est pas disponible',
    usernameJustTaken:'Ce pseudo vient d\u2019être pris, choisis-en un autre',usernameUpdated:'Pseudo mis à jour',
    profileUpdated:'Profil mis à jour',localDataOnly:'Données locales uniquement',exportGenerated:'Export généré',
    confirmClearAll:'Tout effacer ? Cette action est irréversible.',confirmClearAllFinal:'Vraiment sûr ? Toutes tes données seront perdues.',
    offlineSinceDays:'Hors ligne depuis {0} j — pense à te reconnecter',dataSynced:'Données synchronisées',
    connectionRestored:'Connexion rétablie · synchronisation…',offlineModeAvailable:'Mode hors ligne — tout reste accessible',
    dataImported:'Données importées',invalidFile:'Fichier invalide',
    searchExercisePlaceholder:'Rechercher un exercice...',muscleLabel:'Muscle',equipmentLabel:'Matériel',levelLabel:'Niveau',
    exercisesWordPlural:'exercices',exerciseWordSingular:'exercice',
    movementDemoCap:'DÉMONSTRATION DU MOUVEMENT',movementDemo:'Démonstration du mouvement',
    musclesWorked:'Muscles sollicités',primaryLabel:'Principaux',secondaryLabel:'Secondaires',
    stepByStepExecution:'Exécution étape par étape',breathingLabel:'Respiration',commonMistakesLabel:'Erreurs fréquentes',
    coachTipsLabel:'Conseils du coach',safetyLabel:'Sécurité',variantsLabel:'Variantes',addToProgram:'Ajouter au programme',
    exTabExercise:'Exercice',exTabMuscles:'Muscles',exTabInstructions:'Instructions',aboutExerciseTitle:'À propos de l\u2019exercice',
    exWorksMainly:'Le <b style="color:var(--snow)">{0}</b> sollicite principalement {1}',
    exWorksAlsoSecondary:', ainsi que {0} en secondaire',severalMuscleGroups:'plusieurs groupes musculaires',
    restBetweenSetsLabel:'Repos entre les séries',volumeCap:'Volume',durationCap:'Durée',
    targetedMusclesTitle:'Muscles ciblés',primaryMusclesLabel:'Muscles primaires',secondaryMusclesLabel:'Muscles secondaires',
    frontViewLabel:'Face',backViewLabel:'Dos',
    muscleHeatmapTitle:'Muscles les plus sollicités',lessLab:'Moins',moreLab:'Plus',mostTrainedLab:'Le plus travaillé : {0}',noMuscleDataLab:'Termine une séance de muscu pour voir apparaître ta carte de charge musculaire.',
    executionLabel:'Exécution',defaultExecutionHint:'Réalise le mouvement de façon contrôlée, amplitude complète.',
    adviceLabel:'Conseils',startLabel:'Démarrer',
    exBreathGeneric:'Inspire pendant la phase négative (descente/étirement), expire pendant l\u2019effort (poussée/contraction).',
    exStep1:'Position de départ : installe-toi correctement, dos gainé, regard neutre.',
    exStep2:'Contracte les muscles cibles avant de débuter le mouvement.',
    exStep3:'Réalise la phase concentrique de façon contrôlée, sans à-coup.',
    exStep4:'Marque une courte pause en contraction maximale.',
    exStep5:'Reviens lentement en contrôlant la phase excentrique (2-3 s).',
    exMistakeGeneric1:'Utiliser une charge trop lourde au détriment de la technique.',
    exMistakeGeneric2:'Manquer d\u2019amplitude (mouvement trop court).',
    exMistakeGeneric3:'Prendre de l\u2019élan / tricher avec le dos.',
    exMistakeGeneric4:'Aller trop vite et négliger la phase excentrique.',
    exTipGeneric1:'Privilégie la connexion muscle-esprit : sens le muscle travailler.',
    exTipGeneric2:'Reste sur 2-3 RIR (répétitions en réserve) pour progresser sainement.',
    exTipGeneric3:'Garde une exécution propre sur toutes les répétitions.',
    exSafety1:'Échauffe-toi avec des séries légères avant les séries lourdes.',
    exSafety2:'Garde le dos neutre, ne bloque jamais complètement les articulations.',
    exSafety3:'Arrête immédiatement en cas de douleur articulaire vive.',
    wuTemplate:'15-20 min footing en {0}/km + 4-5 lignes droites progressives + gammes (montées de genoux, talons-fesses, foulées bondissantes).',
    cdTemplate:'10-15 min footing très lent en {0}/km + étirements doux.',
    recovLabel_2minTrot:'2 min trot',recovLabel_1minTrot:'1 min trot',recovLabel_30sTrot:'30 s trot',recovLabel_2to3minTrot:'2-3 min trot',recovLabel_90sTrot:'90 s trot',
    repsTextTemplate:'{0} × {1} m à {2} ({3}/km)',seriesPyramid:'Pyramide {0}→{1} m',seriesRepsDist:'{0} × {1} m à {2}',seriesRepsOnly:'{0} × efforts',
    deloadPrefixTemplate:'SEMAINE ALLÉGÉE — {0}',
    bs_ef_objectif:'Construire ta base aérobie — le socle de toute progression (80% du volume des élites).',
    bs_ef_warmup:'Mise en route progressive sur 10 min.',bs_ef_body:'{0} km à allure facile ({1}/km). Conversation possible en permanence.',
    bs_ef_paces:'Zone 2, ~70% FCmax — {0}/km.',bs_ef_recovery:'Effort continu.',bs_ef_cooldown:'Quelques étirements des mollets et ischios.',
    bs_ef_tip1:'Respire par le ventre.',bs_ef_tip2:'La lenteur est volontaire et productive.',bs_ef_mistake1:'Courir trop vite « par habitude ».',
    bs_ef_why:'Développe le cœur, les capillaires et les mitochondries sans fatigue ni risque.',
    bs_recup_objectif:'Accélérer la récupération entre deux séances dures.',bs_recup_warmup:'Aucun.',
    bs_recup_body:'{0} km très souple à {1}/km.',bs_recup_paces:'Zone 1 — très lent.',bs_recup_cooldown:'Automassage / mobilité.',
    bs_recup_tip1:'Si très fatigué, remplace par 25 min de marche.',bs_recup_mistake1:'Accélérer : tu sabotes la récup.',
    bs_recup_why:'La circulation sanguine évacue les déchets et relance l\u2019adaptation.',
    bs_long_objectif:'Développer l\u2019endurance, l\u2019économie de course et le mental.',bs_long_warmup:'Départ progressif 10 min.',
    bs_long_body_progressive:'{0} km progressifs : 1ère moitié en {1}/km, 2nde moitié en accélérant jusqu\u2019à {2}/km.',
    bs_long_body_steady:'{0} km à allure endurance stable ({1}/km).',bs_long_paces:'EF {0}/km → allure marathon {1}/km en fin.',
    bs_long_recovery:'Continu, ravitaille si > 1h15.',bs_long_tip1:'Mange bien la veille.',bs_long_tip2:'Emporte eau + gel si > 1h30.',
    bs_long_mistake1:'Partir trop vite et marcher à la fin.',bs_long_why:'Augmente les réserves de glycogène et la capacité à utiliser les graisses.',
    bs_tempo_objectif:'Améliorer l\u2019efficacité et l\u2019endurance à allure soutenue.',
    bs_tempo_body:'{0} min en continu à {1}/km (« confortablement difficile »), soit environ {2} km.',bs_tempo_paces:'~83% VMA — {0}/km.',
    bs_tempo_recovery:'Bloc continu.',bs_tempo_tip1:'Tu dois pouvoir dire 2-3 mots, pas une phrase.',bs_tempo_mistake1:'Partir trop vite et exploser.',
    bs_tempo_why:'Repousse le seuil d\u2019accumulation du lactate.',
    bs_temposp_objectif:'Te familiariser avec l\u2019allure de ta course objectif ({0}).',bs_temposp_body:'{0}, récup 2 min trot entre blocs.',
    bs_temposp_paces:'Allure course : {0}/km.',bs_temposp_tip1:'Mémorise les sensations de cette allure.',
    bs_temposp_mistake1:'Aller plus vite que l\u2019allure cible.',bs_temposp_why:'L\u2019allure spécifique doit devenir automatique le jour J.',
    bs_seuil_objectif:'Repousser le seuil lactique — facteur n°1 de performance.',bs_seuil_body:'{0}, récup 1 min trot.',
    bs_seuil_paces:'~88% VMA — {0}/km.',bs_seuil_recovery:'1 min trot entre chaque.',bs_seuil_tip1:'Toutes les reps à la même allure.',
    bs_seuil_mistake1:'Partir trop fort sur la 1ère.',bs_seuil_why:'Le seuil est l\u2019allure tenable ~1h ; l\u2019élever rend tout plus facile.',
    bs_dblseuil_objectif:'Maximiser le volume au seuil sans fatigue excessive (clé norvégienne).',
    bs_dblseuil_warmup:'{0} (×2 : une fois le matin, une fois le soir)',
    bs_dblseuil_body:'Matin : {0} × {1} min à {2}/km (récup 1 min). Soir : {3} (récup 30 s). Reste sous-maximal.',
    bs_dblseuil_paces:'Seuil contrôlé {0}/km — lactate ~2-4 mmol.',bs_dblseuil_recovery:'Récup courte, intensité maîtrisée.',
    bs_dblseuil_cooldown:'{0} (après chaque séance)',bs_dblseuil_tip1:'Ne jamais finir épuisé : tu dois pouvoir refaire la séance.',
    bs_dblseuil_mistake1:'Transformer le seuil en VMA.',
    bs_dblseuil_why:'Double dose de stimulus seuil pour une fatigue minimale — signature des Ingebrigtsen.',
    bs_dblseuil_note:'Séance du soir (matin = {0} × {1} min)',
    bs_vmac_objectif:'Développer la vVO2max et la vitesse de pointe.',bs_vmac_warmup:'{0} Échauffement OBLIGATOIRE.',
    bs_vmac_body:'{0}, récup 1 min trot. (ou variante courte : {1} × ~{2} m vif / {3} m trot, même intensité).',
    bs_vmac_paces:'~108-110% VMA — vise {0} sur chaque {1} m (et non {2}, qui est juste l\u2019allure ramenée au km).',
    bs_vmac_recovery:'1 min trot entre les {0} m.',bs_vmac_tip1:'Même temps de passage sur toutes les reps : {0} au {1} m.',
    bs_vmac_mistake1:'Négliger l\u2019échauffement → blessure.',
    bs_vmac_mistake2:'Confondre l\u2019allure /km affichée avec le temps réel à réaliser sur {0} m.',
    bs_vmac_why:'Stimule le VO₂max et l\u2019économie neuromusculaire.',
    bs_vmal_objectif:'Élever le VO₂max — ta cylindrée maximale.',bs_vmal_body:'{0}, récup 2-3 min trot. (ou {1} × 1200 m).',
    bs_vmal_paces:'~95-98% VMA — {0}/km.',bs_vmal_tip1:'Régularité avant tout.',bs_vmal_tip2:'Arrête si tu ne tiens plus l\u2019allure.',
    bs_vmal_mistake1:'Récup trop courte.',bs_vmal_why:'Le temps passé à ~90-100% VO₂max augmente ta puissance aérobie maximale.',
    bs_interval_objectif:'Travail mixte vitesse-endurance.',bs_interval_body:'Pyramide : {0}, récup jog = durée de l\u2019effort entre chaque segment.',
    bs_interval_paces:'De {0}/km (200 m) à {1}/km (800 m) — l\u2019allure ralentit progressivement avec la distance.',
    bs_interval_recovery:'Récup active égale à l\u2019effort.',
    bs_interval_tip1:'Gère l\u2019allure selon la distance : plus la rép est courte, plus tu vas vite en valeur absolue.',
    bs_interval_mistake1:'Tout faire à la même vitesse.',bs_interval_why:'Combine plusieurs filières énergétiques.',
    bs_interval_recoveryLabel:'jog = durée de l\u2019effort',
    bs_spe_objectif:'Ancrer l\u2019allure exacte de ta course ({0}).',bs_spe_body:'{0}, récup 90 s.',bs_spe_paces:'Allure objectif : {0}/km.',
    bs_spe_tip1:'Cette allure doit devenir un réflexe.',bs_spe_mistake1:'Aller plus vite par excès de confiance.',
    bs_spe_why:'La spécificité prime à l\u2019approche de la course.',
    bs_progressif_objectif:'Apprendre à accélérer sur la fatigue.',bs_10min_warmup:'10 min {0}/km.',
    bs_progressif_body:'{0} km en 3 paliers : {1} → {2} → {3}/km.',bs_progressif_paces:'EF → tempo.',bs_progressif_recovery:'Continu.',
    bs_progressif_tip1:'Chaque palier un peu plus vite.',bs_progressif_mistake1:'Partir trop vite.',
    bs_progressif_why:'Renforce le mental et le négatif split.',
    bs_fartlek_objectif:'Travail au ressenti, ludique et libre.',bs_fartlek_warmup:'15 min {0}/km.',
    bs_fartlek_body:'{0} × (1 min vite / 1 min lent) au ressenti, dans la nature.',bs_fartlek_paces:'Vite ≈ {0}/km, lent ≈ {1}/km.',
    bs_fartlek_recovery:'Récup active libre.',bs_fartlek_tip1:'Joue avec le terrain.',bs_fartlek_mistake1:'Trop structurer : laisse-toi aller.',
    bs_fartlek_why:'Développe le VO₂max en s\u2019amusant et casse la routine.',
    bs_cotes_objectif:'Développer puissance, force et économie de course.',
    bs_cotes_body:'{0} × 30-45 s en côte (4-6%) à effort soutenu, récup en descente trot.',bs_cotes_paces:'Effort à ~90%.',
    bs_cotes_recovery:'Descente en récup.',bs_cotes_tip1:'Foulée courte et dynamique, regarde devant.',
    bs_cotes_mistake1:'Descendre trop vite (impact).',bs_cotes_why:'La côte = musculation spécifique sans impact traumatisant.',
    bs_cotes_recoveryLabel:'descente trot',bs_cotes_note:'30-45 s d\u2019effort en côte par répétition',
    bs_lignes_objectif:'Entretenir la vitesse et la fraîcheur (idéal taper).',
    bs_lignes_body:'{0} km EF + {1} × 80-100 m en accélération progressive (sans forcer), récup marche.',
    bs_lignes_paces:'EF + accélérations relâchées.',bs_lignes_recovery:'Marche/trot entre lignes.',bs_lignes_cooldown:'Étirements.',
    bs_lignes_tip1:'Reste relâché, ne sprinte pas.',bs_lignes_mistake1:'Forcer sur les lignes en période d\u2019affûtage.',
    bs_lignes_why:'Garde le système nerveux affûté sans fatigue.',
    bs_course_objectif:'Réaliser ta meilleure performance — objectif : {0} !',
    bs_course_warmup:'25-30 min : footing progressif + lignes droites + 3 accélérations allure course.',
    bs_course_body:'{0} km à {1}/km. Départ contrôlé, milieu solide, final tout donné.',bs_course_paces:'Allure objectif : {0}/km.',
    bs_course_cooldown:'15 min footing dès l\u2019arrivée + étirements.',bs_course_tip1:'Ne pars pas trop vite.',
    bs_course_tip2:'Accroche un coureur de ton niveau.',bs_course_mistake1:'Mal dormir / mal manger la veille.',
    bs_course_why:'L\u2019aboutissement de toute ta préparation. Fais-toi confiance !',
    bs_default_objectif:'Endurance.',bs_default_body:'{0} km facile.',bs_default_why:'Base aérobie.',
    avgPerKmLabel:'/km moy.',cooldownLabel:'Retour au calme',detailedPacesLabel:'Allures détaillées',equivalentPaceLabel:'Allure équivalente',
    markCompleted:'Marquer terminée',mistakesToAvoidLabel:'Erreurs à éviter',objectiveCap:'OBJECTIF',objectiveWord:'Objectif',
    paceWarnMsg:'Ne dépasse pas l\u2019allure indiquée sur les premières répétitions — mieux vaut finir fort que partir trop vite.',
    pacesLabel:'Allures',recoveryColon:'Récup :',recoveryLabel:'Récupération',repetitionsWord:'répétitions',
    seriesPyramidTitle:'Séries — pyramide',sessionBodyLabel:'Corps de séance',sessionCompleted:'Séance terminée',
    targetPaceLabel:'Allure cible',targetSplitLabel:'Temps de passage cible',warmupLabel:'Échauffement',
    weekLabelWithNum:'Semaine',whySessionLabel:'Pourquoi cette séance ?',zone2FCmaxLine:'Zone 2 · 70% FCmax · {0}/km',
    analyzeSessionBtn:'Analyser ma séance',autoLightenedFlag:'Séance allégée automatiquement (raison : {0} le {1}).',
    avgPaceKmLabel:'Allure moyenne /km',coachAnalysisTitle:'Analyse du Coach',
    coach_adj_continue:'Continue comme prévu, ton plan est bien calibré.',
    coach_motiv1:'Une séance de plus dans les jambes — c’est la régularité qui construit la forme, pas les exploits isolés.',
    coach_motiv2:'Tu as fait le plus dur : y aller. Le reste, ton corps s’en charge pendant la récupération.',
    coach_motiv3:'Chaque sortie enregistrée rend le plan plus juste. Tu ne t’entraînes pas dans le vide.',
    coach_motiv4:'Personne ne progresse en ligne droite. Ce qui compte, c’est que la courbe monte sur le mois.',
    coach_adj_increaseVolume:'Tu es en forme : on pourra augmenter légèrement le volume la semaine prochaine.',
    coach_adj_lighten48h:'Allège la prochaine séance dure de 48h pour bien récupérer.',
    coach_adj_rest:'Prochaine séance : remplace-la par du repos ou un footing très léger.',
    coach_err_fatigue:'Niveau de fatigue élevé : attention au surentraînement.',
    coach_err_paceMuchSlower:'Allure bien plus lente que prévu — vérifie si c’est la fatigue, la chaleur, ou si l’allure cible était trop ambitieuse.',
    coach_tip_paceSlower:'Un peu plus lent que prévu avec un effort ressenti élevé : pense à repartir un cran plus doucement au prochain départ.',
    coach_pos_paceFaster:'Plus rapide que prévu sans forcer : bon signe de forme.',
    coach_err_paceFasterTooHard:'Plus rapide que prévu, mais au prix d’un effort très élevé — attention à ne pas cramer les prochaines séances.',
    coach_err_harderThanPlanned:'Ta séance a été bien plus dure que prévue (RPE {0} vs {1} attendu). Tu es peut-être parti trop vite ou tu es fatigué.',
    coach_err_pain:'Douleurs {0} : ne les ignore pas. Une douleur articulaire qui persiste = repos.',
    coach_err_sleep:'Sommeil insuffisant : tes performances et ta récup vont en souffrir.',
    coach_err_tooEasy:'Séance trop facile (RPE {0}) : tu peux probablement pousser un peu plus la prochaine fois.',
    coach_pos_completed:'Tu as terminé ta séance : la régularité est ta plus grande force.',
    coach_pos_feel:'Excellentes sensations — ton corps répond bien à l\u2019entraînement.',
    coach_pos_nopain:'Aucune douleur signalée : ta technique et ta charge sont bien gérées.',
    coach_pos_nutrition:'Alimentation au top, le carburant est là.',
    coach_pos_sleep:'Bon sommeil : c\u2019est 50% de ta récupération, continue.',
    coach_tip_heat:'Par forte chaleur, cours tôt le matin et hydrate-toi davantage.',
    coach_tip_hydrate:'Bois au moins 0,5 L d\u2019eau dans l\u2019heure qui suit.',
    coach_tip_nutrition:'Mange des glucides + protéines dans les 30 min après l\u2019effort.',
    coach_tip_sleep:'Vise 8h de sommeil cette nuit, écran coupé 1h avant.',
    constructiveCriticismTitle:'Critiques constructives',dayNutritionLabel:'Alimentation du jour',
    debriefIntro:'Réponds honnêtement : le moteur IKORUN va analyser ta séance.',
    distanceKmLabel:'Distance (km)',distanceKmOptionalLabel:'Distance (km, optionnel)',
    durationMinLabel:'Durée (min)',durationMinOptionalLabel:'Durée (min, optionnel)',
    elevationGainLabel:'Dénivelé D+ (m, optionnel)',fatigueLabel:'Fatigue',freeCommentLabel:'Commentaire libre',
    howDidYouFeelPlaceholder:'Comment t\u2019es-tu senti ?',ikorunAnalysisTitle:'Analyse IKORUN',
    legDayCarryoverFlag:'Ta séance jambes a déjà sollicité tes muscles — reste souple sur l\u2019explosivité aujourd\u2019hui.',
    load_goodAssimilation:'Bonne assimilation (répétitions respectées, RPE maîtrisé) → volume et intensité légèrement augmentés.',
    load_high:'Charge élevée détectée (séances ratées, RPE au-dessus du prévu ou fatigue) → volume réduit d\u2019environ 12% cette semaine.',
    load_stable:'Charge stable : nouvelles variantes de séances, volume inchangé.',
    missedReasonPrompt:'Pourquoi cette séance n\u2019a-t-elle pas été réalisée ?',missedReplacementPrompt:'As-tu finalement fait autre chose ?',
    missedSessionTitle:'Séance manquée',nightSleepLabel:'Sommeil de la nuit',
    note_cardioAlreadyCounted:'charge cardio déjà comptabilisée, plan inchangé',
    note_explosiveCaution:'vigilance sur ta prochaine séance explosive',note_nextHardLightened:'prochaine séance dure allégée',
    notedCoachBtn:'C\u2019est noté, Coach !',notesOptionalLabel:'Notes (optionnel)',paceKmLabel:'Allure /km',painLabel:'Douleurs',paceAdherenceLabel:'Allure respectée ?',paceFasterOpt:'Plus rapide',paceAsPlannedOpt:'Comme prévu',paceSlowerOpt:'Un peu plus lent',paceMuchSlowerOpt:'Beaucoup plus lent',moreDetailsBtn:'Plus de détails ↓',lessDetailsBtn:'Moins de détails ↑',
    planUpdatedWeekReason:'Plan mis à jour pour la semaine — {0}',positivePointsTitle:'Points positifs',
    recentMissesReducedMsg:'3 séances ratées récemment : volume des prochaines semaines réduit de 15%',
    repByRepSummary:'Bilan par répétition — {0} × {1} m',
    repLegendLine:'= saisir le temps réel · ✓ = "j\u2019ai respecté l\u2019allure" (remplit automatiquement avec le temps cible)',
    repNumDist:'Rép. {0} · {1} m',replacementMuscuTitle:'Remplacement — {0}',replacementRunTitle:'Course de remplacement',
    respectedCount:'{0}/{1} respectées',rpeFeltLabel:'RPE — difficulté ressentie :',sensationsLabel:'Sensations',
    sessionNotedToast:'Séance notée',sessionTypeLabel:'Type de séance',targetColon:'Cible {0}',
    upcomingAdjustmentsTitle:'Ajustements à venir',weatherLabel:'Météo',
    addAsGoalLabel:'Ajouter comme objectif',advancedLabel:'Avancé',calculateLabel:'Calculer',copiedShortToast:'Copié',
    copyLabel:'Copier',customDistanceKmLabel:'Distance custom (km)',distanceLabel:'Distance',
    goalAddedReason:'objectif ajouté',goalAddedToast:'Objectif ajouté',
    ikorunDistInTime:'IKORUN — {0}km en {1}',kmSplitsLabel:'Splits km',myIkorunPrediction:'Ma prédiction IKORUN : {0}km en {1}',
    negativeSplitLabel:'Negative split',paceCalculatorTitle:'Calculateur d\u2019allure',paceMinSecKmLabel:'Allure (min : sec /km)',
    penaltySecKmLabel:'Pénalité (sec/km)',predictedTimeLabel:'Temps prédit',resetShortLabel:'Réinit.',
    resultSavedToast:'Résultat enregistré',resultsLabel:'Résultats',runCalcFirstToast:'Lance un calcul d\u2019abord',
    sleepBorderline:'Limite — vise plus',sleepCyclesTip:'Un cycle dure ~90 min. Vise un réveil en fin de cycle : 6h, 7h30 ou 9h de sommeil. Couche-toi à heure régulière pour optimiser la récupération.',
    sleepCyclesTitle:'Cycles de sommeil',sleepHoursPerNightLabel:'Heures de sommeil / nuit',
    sleepInsufficient:'Insuffisant — récupération compromise',sleepOptimal:'Optimal pour un athlète',sleepPlenty:'Beaucoup — écoute ton corps',
    speedLabel:'Vitesse',timeHMSLabel:'Temps (h : mm : ss)',
    configurePlanTitle:'Configurer mon plan',courseProfileLabel:'Profil du parcours',generateMyPlanBtn:'Générer mon plan',
    planSetupSimpleHint:'On s’occupe du reste (rythme, distances, séances) et on ajuste tout au fil de tes séances.',
    maxKmWeekLabel:'Km/sem maxi (pic)',minKmWeekLabel:'Km/sem mini',preferredSessionsLabel:'Séances préférées (le coach les privilégiera)',
    preparedRaceLabel:'Course préparée',raceDateLabel:'Date de la course',targetTimeOptionalLabel:'Chrono visé (optionnel)',
    trainingDaysLabel:'Jours d\u2019entraînement',yourNextRaceDefault:'Ta prochaine course',
    guardFutureDate:'Impossible d\u2019enregistrer une séance à une date future.',
    sessionNotYetLabel:'Cette séance n\u2019a pas encore eu lieu',guardFutureSession:'Impossible de valider une séance qui n\u2019a pas encore eu lieu',
    guardDistanceTooHigh:'Distance irréaliste par rapport à ton historique ({0} km max pour l\u2019instant).',
    guardPaceTooFast:'Cette allure est incompatible avec ton VDOT actuel ({0}). Vérifie ta saisie.',
    guardRecordTooFast:'Cette performance impliquerait un VDOT de {0}, trop éloigné de ton niveau actuel. Vérifie ton temps.',
    guardStorageTooBig:'Cette donnée est trop volumineuse et n\u2019a pas été synchronisée dans le cloud.',
    loginWelcomeTitle:'Bienvenue',loginSubConnect:'Connecte-toi pour sauvegarder ta progression, tes séances et tes records — synchronisés sur tous tes appareils.',
    signupTitle:'Créer un compte',signupSub:'Rejoins IKORUN pour sauvegarder ta progression et la retrouver sur tous tes appareils.',
    forgotTitle:'Mot de passe oublié',forgotSub:'Indique ton email, on t\u2019envoie un lien pour le réinitialiser.',
    emailLabel:'Email',passwordLabel:'Mot de passe',confirmPasswordLabel:'Confirmer le mot de passe',
    emailPlaceholder:'ton@email.com',
    loginBtnLabel:'Se connecter',signupBtnLabel:'Créer mon compte',sendResetLinkBtn:'Envoyer le lien',
    forgotPasswordLink:'Mot de passe oublié ?',noAccountLink:'Pas de compte ? Créer un compte',
    haveAccountLink:'Déjà un compte ? Se connecter',backToLoginLink:'Retour à la connexion',
    orDividerLabel:'ou',continueWithGoogleBtn:'Continuer avec Google',
    loginLegalText:'En continuant, tu acceptes nos <span class="legal-link" onclick="openProfileSection(\'terms\')">conditions d’utilisation</span> et notre <span class="legal-link" onclick="openProfileSection(\'privacy\')">politique de confidentialité</span>.<br>Tes données sont synchronisées de façon sécurisée via ton compte.',
    installAppBtn:'Installer l’application',installAcceptedToast:'Application installée !',installFallbackToast:'Utilise le menu de ton navigateur (ou l’icône d’installation dans la barre d’adresse) pour installer l’app.',
    iosInstallStep1:'1. Appuie sur l’icône Partager '+'⬆️'+' en bas de Safari.',
    iosInstallStep2:'2. Fais défiler puis appuie sur « Sur l’écran d’accueil ».',
    androidInstallStep1:'1. Appuie sur les trois petits points en haut à droite de Chrome.',
    androidInstallStep2:'2. Choisis « Installer l’application » (ou « Ajouter à l’écran d’accueil »).',
    termsOfUseLab:'Conditions d’utilisation',privacyPolicyLab:'Politique de confidentialité',
    sessionPausedLab:'Séance en pause',createBtn:'Créer',libraryLab:'Bibliothèque',
    defaultProgramsLab:'Programmes par défaut',myCreationsLab:'Mes créations',
    exSetsSummary:'{0} exercices · {1} séries',exosShort:'{0} exos',
    loadKgLab:'Charge (kg)',restLab2:'Repos',personalNotesLab:'Notes personnelles (optionnel)',notesPh:'ex : bien serrer les omoplates',
    levelUpTitle:'NIVEAU SUPÉRIEUR',
    syncedCloudLab:'Synchronisé sur le cloud',addAccountBtn:'Ajouter un compte',dangerZoneLab:'Zone de danger',
    deleteAccountDesc:'Supprime définitivement ton compte et toutes tes données, sur le cloud et sur cet appareil.',
    deleteAccountBtn:'Supprimer mon compte et mes données',
    exportImportDesc:'Exporte une copie de tes données ou importe une sauvegarde existante.',
    resetDesc:'Efface toutes les données de l’application sur cet appareil.',
    profilePhotoTitle:'Photo de profil',choosePhotoLab:'Choisis ta photo de profil :',fromGalleryBtn:'Depuis la galerie',
    takePhotoBtn:'Prendre une photo',removePhotoBtn:'Supprimer la photo actuelle',cropTitle:'Recadrer',zoomLab:'Zoom',validatePhotoBtn:'Valider la photo',
    liftedLoadKgLab:'Charge soulevée (kg)',estimated1RMLab:'1RM estimé (Epley)',percentOf1RMLab:'% de ton 1RM',repsShort:'reps',
    totalTonnageLab:'Tonnage total ({0}×{1}×{2}kg)',noDataLab:'Pas de données',distanceKmLab:'Distance (km)',
    kcalBurnedLab:'kcal brûlées (~{0}kg)',currentLoadKgLab:'Charge actuelle (kg)',weeklyProgressKgLab:'Progression / semaine (kg)',
    weeksLab:'Semaines',projectionLab:'Projection',
    hrMaxLab:'FC max (bpm)',hrRestLab:'FC repos (bpm)',hrZonesLab:'Zones cardiaques (Karvonen)',
    hrZ1:'Z1 Récupération',hrZ2:'Z2 Endurance',hrZ3:'Z3 Tempo',hrZ4:'Z4 Seuil',hrZ5:'Z5 VO2max',
    restTimesLab:'Temps de repos recommandés',supersetLab:'Superset',pomoFocus:'Focus',pomoBreak:'Pause',pomodorosDoneLab:'Pomodoros complétés : {0}',
    fillEmailPasswordToast:'Remplis email et mot de passe.',invalidEmailToast:'Adresse email invalide.',
    passwordTooShortToast:'Mot de passe trop court (8 caractères min).',passwordsMismatchToast:'Les mots de passe ne correspondent pas.',
    wrongCredentialsToast:'Email ou mot de passe incorrect — et si tu viens de créer ton compte, valide d’abord l’email de confirmation.',emailRateLimitToast:'Trop de demandes d’email d’affilée. Attends quelques minutes avant de réessayer.',sessionExpiredToast:'Session expirée, reconnecte-toi. Tes données restent sur cet appareil.',emailAlreadyUsedToast:'Un compte existe déjà avec cet email.',
    authGenericErrorToast:'Une erreur est survenue. Réessaie.',checkEmailConfirmToast:'Compte créé ✓ Vérifie ta boîte mail pour confirmer ton adresse.',
    authTimeoutToast:'La connexion prend trop de temps. Vérifie ta connexion internet et réessaie.',
    resetLinkSentToast:'Lien envoyé ✓ Vérifie ta boîte mail.',loggingInToast:'Connexion…',creatingAccountToast:'Création du compte…',sendingResetToast:'Envoi du lien…',
    continueAsGuestLink:'Continuer en tant qu\'invité',guestConnectingToast:'Connexion en tant qu\'invité…',guestDisabledToast:'Le mode invité n\'est pas encore activé. Réessaie plus tard ou crée un compte.',
    guestModeTitle:'Mode invité',guestModeLabel:'Mode invité',guestModeDesc:'Tes données sont liées à cet appareil. Si tu te déconnectes ou changes de téléphone, tu risques de les perdre. Ajoute un email pour les protéger.',
    guestSaveAccountBtn:'Sauvegarder mon compte',guestUpgradeSentToast:'Vérifie ta boîte mail pour confirmer. Tu pourras ensuite te connecter avec cet email (utilise « mot de passe oublié » pour en choisir un).',guestUpgradeEmailUsedToast:'Cet email est déjà utilisé par un autre compte.',
    tourSkip:'Passer',tourStartBtn:'Commencer',tourNextBtn:'Suivant',tourFinalBtn:'Créer mon plan',replayTourBtn:'Revoir le tutoriel',
    tour_welcome_t:'Bienvenue {0} 👋',tour_welcome_d:'IKORUN n’est pas un GPS ni un podomètre : c’est un carnet d’entraînement intelligent qui génère ton plan et l’ajuste selon ce que tu lui dis. 8 étapes, une minute.',
    tour_home_t:'Ton accueil',tour_home_d:'La carte du jour montre la séance prévue, avec le pourquoi. Une fois faite, touche « Je l’ai faite » — ou « Pas faite » si ce n’est pas le cas, ce n’est jamais grave.',
    tour_loop_t:'Comment ça marche',tour_loop_d:'Le plan est généré à partir de ton niveau et de tes chronos. Après chaque séance, un bilan te demande ton ressenti (fatigue, douleur, allure) — c’est TOI qui dis si c’était dur, pas un capteur. IKORUN ne trace rien en arrière-plan.',
    tour_sport_t:'Course et musculation',tour_sport_d:'L’onglet Sport génère ton plan de course sur mesure (niveau, objectif, date de course) et propose aussi des programmes de musculation. Régénère le plan à tout moment si ta vie change.',
    tour_adapt_t:'Le plan s’ajuste tout seul',tour_adapt_d:'Séance ratée, fatigue élevée, douleur signalée : les séances à venir s’allègent automatiquement. Tout va bien : progression trop facile ? Elles montent en charge. Tu n’as jamais à recalculer quoi que ce soit.',
    tour_stats_t:'Tes statistiques',tour_stats_d:'Kilomètres, séances, VDOT, records personnels — et ta progression en XP, niveaux et badges, gagnée uniquement par de vraies séances (l’app vérifie).',
    tour_outils_t:'La boîte à outils',tour_outils_d:'Calculateur d’allure, VDOT, IMC, chrono, minuteur... Cherche l’outil qu’il te faut ou garde tes favoris à portée de main.',
    tour_profil_t:'Ton profil',tour_profil_d:'Niveau, XP, badges — et tous les réglages : langue, couleur, et le mode simplifié que tu as choisi (modifiable à tout moment ici). Une idée ou un bug ? « Envoyer un commentaire », tout en bas, part directement dans notre boîte mail.',
    tour_club_t:'Rejoins ton club',tour_club_d:'Rejoins le club de ton équipe avec un code, ou crée le tien : classement dédié, coéquipiers visibles d’un coup d’œil. Le créateur peut même publier un plan d’entraînement commun avec un lieu et une heure de regroupement, pour s’entraîner ensemble. Un vrai esprit d’équipe, pas juste des amis un par un.',
    tour_final_t:'Prêt à commencer ?',tour_final_d:'Configure ton objectif et génère ton plan personnalisé — c\'est le moment !',
    tourGotItBtn:'Compris',signupHelpLink:'Besoin d\'aide ?',
    tour_sg_welcome_t:'On crée ton compte ?',tour_sg_welcome_d:'Trois petites infos et c\'est parti — ça prend 30 secondes.',
    tour_sg_email_t:'Ton email',tour_sg_email_d:'Il te sert à te connecter et à recevoir le lien de confirmation. Pas de spam, promis.',
    tour_sg_password_t:'Choisis un mot de passe',tour_sg_password_d:'8 caractères minimum. Tu le retaperas juste en dessous pour confirmer.',
    tour_sg_submit_t:'C\'est prêt',tour_sg_submit_d:'Un email de confirmation t\'attend juste après — clique sur le lien, puis reviens créer ton profil.'
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
    todayGoals:'Today\u2019s goals',weekLoad:'Weekly load',sessions:'sessions',form:'form',
    quipTime:'Chasing that {0}?',quipGoal:'Working toward: {0}?',quipDefault:'Ready to push your limits today?',
    weekLoadTitle:'Weekly load',levelXp:'Level {0} — {1} XP',xpBeforeLevel:'+{0} XP before level {1}',
    sessionsCap:'Sessions',tonnageKg:'Volume kg',formCap:'Form',nextSession:'NEXT SESSION',today:'Today',
    restDay:'Rest day',noSessionToday:'No session planned today',recordsPerso:'Personal records',
    iDidIt:'I did it',notDone:'Not done',nextLab:'Next up',dayPlusShort:'D+{0}',rpeShort:'RPE',kmWeekShort:'km wk.',sessionsLab:'sessions',
    syncSlowToast:'Sync is slow — the app is starting, your data is on its way',syncFailedLocalToast:'Sync unavailable — working from your local data',syncCloudErrorToast:'Cloud sync error',
    doneTag:'Done',
    setsCount:'{0} sets',daysAgoShort:'{0}d ago',neverDoneLab:'Never done',
    pauseLab:'Pause',restTimerBtn:'Rest timer',
    googleStandaloneTitle:'Google and the installed app',googleUseEmailBtn:'Sign in with email',googleOpenSafariBtn:'Open in Safari',googleStandaloneHint:'Unavailable from the installed app',
    declineBtn:'Decline',saveLabel:'Save',renameLab:'Rename',favoriteLab:'Favourite',
    langLab:'Language',obModeTitle:'Your display',obModeIntro:'Two ways to see IKORUN \u2014 change your mind anytime in Profile.',obModeFullT:'Full',obModeFullD:'All the stats, every session detail, muscle anatomy, charts. For digging in.',obModeSimpleT:'Simplified',obModeSimpleD:'One card, the essentials: today\u2019s session and a button. Nothing else on screen. For going straight to it.',obModeSuggestion:'Suggestion based on your age: {0}. Choose freely.',chooseModeLab:'Choose a display to continue',
    trackingLab:'Tracking',appearanceLab:'Appearance',
    sendFeedbackLab:'Send feedback',feedbackNoAddressToast:'Contact address not set up yet — try again after the next update.',feedbackTitle:'Your feedback',feedbackIntro:'An idea, a bug, something bothering you in the app? Write it here, it goes straight to your mail app.',feedbackPh:'Write your feedback...',feedbackEmptyToast:'Write something before sending',feedbackSentToast:'Your mail app just opened, all that\u2019s left is to hit send',feedbackSignature:'Account: {0} · Language: {1}',
    sendBtn:'Send',
    playLab:'Start',
    cvCat_dist:'Distance',cvCat_pace:'Pace',cvCat_weight:'Weight',cvTapToEdit:'Tap to edit',
    googleStandaloneBody:'On iPhone, when IKORUN is opened from the home-screen icon, Google sign-in leaves for Safari and never comes back: it succeeds, but in Safari, not here. Sign in with email inside the app, or open IKORUN in Safari to use Google.',
    progression:'Progress',planOfDay:'PLAN OF THE DAY',planIkorunDesc:'Training plans designed by coaches',
    myPlanDesc:'Build your own custom plan',todayCap:'TODAY',tapToStart:'View details',
    goalCap:'GOAL',courseDefault:'Race',goalTimeColon:'Goal: {0} · ',raceOn:'Race on {0}',raceDay:'Race day',
    currentVdot:'Current VDOT',currentPhase:'Current phase',thisWeek:'This week',weekOf:'Week {0}/{1}',
    weeklyLoad:'Weekly load',regenConfirm:'Regenerate a new plan? Completed sessions stay in your stats.',
    regenBtn:'Regenerate / reconfigure',planIkorunPill:'IKORUN Plan',myPlanPill:'Custom plan',
    planIkorunTitle:'IKORUN Plan — scientific engine',
    planIkorunDescLong:'Generates a custom periodized plan (Norwegian method + VDOT/Daniels) based on your VDOT ({0}), goal, preferences and race date. The plan auto-adjusts if you miss a session.',
    planIkorunDescSimple:'Creates your training plan, matched to your level and your race. It adjusts itself if you miss a session.',
    configureGenerate:'Configure & generate',weekN:'Week {0}',deloadTag:' · deload',missedTag:'Missed',restTag:'Rest',
    newPersoPlan:'New custom plan',createCustomPlan:'Build your custom plan',
    createCustomPlanDesc:'Add your own sessions, pick dates, types and paces. Everything syncs with your home and stats.',
    sessionsCount:'{0} sessions · {1} done',followedTag:'Following',duplicate:'Duplicate',share:'Share',
    planNamePrompt:'Plan name:',myPersoPlanDefault:'My custom plan',
    you:'there',dowShort:'M,T,W,T,F,S,S',greet:'Hi',
    weekPhaseLabel:'Week {0} · {1}',thresholdPaceShort:'Threshold pace',vsLastWeekShort:'vs last week',
    nextSessionMeta:'Next session · {0}',newWeekTag:'New week',thisWeekCap:'This week',
    totalTime:'Total time',remainingCap:'Remaining',sessionsRemainingVal:'{0} sessions',objectiveReached:'Goal reached',
    untilEndWeek:'by Sunday',sessionsDoneShort:'{0} sessions',planOfWeek:'Week plan',
    streakDaysShort:'{0}-day streak',seePlan:'View plan',
    // --- Tools ---
    searchTool:'Search for a tool...',favorites:'Favorites',mainTools:'Main tools',otherTools:'Other tools',
    resultsCount:'{0} result(s)',editFavsTitle:'Edit favorites',tapStarHint:'Tap a star to add/remove a tool from your favorites.',
    toolAioName:'Performance Lab',toolAioSub:'Distance · Time · Pace · Speed',
    toolSanteName:'Health Dashboard',toolSanteSub:'Weight, BMI, sleep, nutrition...',
    toolChronoName:'Stopwatch',toolChronoSub:'Laps, splits & statistics',
    toolConvertName:'Converter',toolConvertSub:'Pace, distance, weight...',
    toolNotesName:'Notes',toolNotesSub:'Quick notepad',
    toolVdotName:'VDOT & VO₂max',toolVdotSub:'Estimate your engine',
    toolImcName:'BMI',toolImcSub:'Body mass index',
    toolHydraName:'Hydration',toolHydraSub:'Your water needs',
    toolBmrName:'Calories & Metabolism',toolBmrSub:'Daily needs',
    toolAgendaName:'Calendar',toolAgendaSub:'All your events',
    toolPriereName:'Prayers',toolPriereSub:'All the times',
    // --- Profile ---
    athleteDefault:'Athlete',addBioPrompt:'Add a bio',heightWeight:'Height / weight',
    noObjective:'None',noBadgeYet:'No badge earned yet — your first session will bring you closer to the Initiate badge.',
    seeAllProgress:'{0} / {1} · See all',nextBadgeLab:'Next badge · {0}',
    account:'Account',friendsRanking:'Friends & Leaderboard',manageProfile:'Manage profile',passwordSecurity:'Password & security',
    notConnected:'Not signed in',notifLabel:'Notifications',preferences:'Preferences',historyRecords:'History & records',
    statistics:'Statistics',theme:'Theme',appColor:'App color',simplifiedMode:'Simplified mode',
    simplifiedModeDesc:'4 tabs, lighter screens, bigger text — the essentials only',
    support:'Support',helpCenter:'Help center',footerTag:'IKORUN — Elite Athletic Intelligence · v2.0',
    yourSpace:'Your space',settings:'Settings',badgesLabel:'Badges',toolsCalc:'Tools & calculators',editMyProfile:'Edit my profile',
    // --- Stats ---
    tabBilan:'Overview',tabRun:'Running',tabMuscu:'Strength',tabTrophies:'Trophies',
    perWeek:'Week',perMonth:'Month',per3Month:'3 Months',perYear:'Year',
    completeProfileTitle:'Complete your profile',completeProfileDesc:'Your height and weight are used to calculate your BMI, calories and needs.',
    chooseHeight:'Choose your height',chooseWeight:'Choose your weight',
    mileage:'Mileage',kmCumulated:'km total',vsPrevPeriod:'vs previous period',
    volumeTrend:'Volume trend',kmThisWeek:'km this week',eightWeeksLab:'8 wks',weeksAgoLab:'8 weeks ago',
    totalTime:'Total time',overPeriod:'over the period',goalReached:'Goal reached!',ofTarget:'{0}% of target',
    kmPerSession:'KM / SESSION',sessionTypesLabel:'SESSION TYPES',bestDayLab:'BEST DAY',bestWeekLab:'BEST WEEK',bestMonthLab:'BEST MONTH',
    detailByType:'Breakdown by type',last13Weeks:'Last 13 weeks',lessLabel:'Less',moreLabel:'More',vsPrevShort:'vs prev.',
    typeMuscu:'Strength',typeAutre:'Other',insightsTitle:'Insights',
    quickTimer:'Timer',lvlShort:'LVL',
    vdotReal:'Actual VDOT',sessionsRun:'Run sessions',kmTotal:'Total km',paceZones:'Pace zones',
    predictions:'Predictions',formFatigue:'Form / Fatigue',personalRecords:'Personal records',
    chronic:'Chronic',acute:'Acute',tonnageLab:'Volume',prPerSession:'PR (kg/session)',totalSets:'Total sets',
    startFirstMuscu:'Start your first strength session!',lastSessions:'Recent sessions',
    tomorrow:'Tomorrow',noUpcomingSession:'No upcoming session planned.',addSession:'Add a session',
    showRestPlan:'Show the rest of the plan · {0} weeks',calendarTitle:'Calendar',calendarSub:'Plan your progress',
    friendsTitle:'Friends & Leaderboard',tabFriendsList:'Friends',tabRank:'Leaderboard',
    clubTitle:'My club',tabClub:'My club',myClubLab:'My club',
    noClubYet:'No club yet',noClubYetDesc:'Join your team’s club with a code, or create your own to bring your teammates together.',
    joinClubCta:'Join a club',createClubCta:'Create a club',clubCodePlaceholder:'6-character code',clubNamePlaceholder:'Club name',
    joinBtn:'Join',clubMembersCount:'{0} member(s)',copyCodeBtn:'Copy code',shareCodeHint:'Share this code with your teammates so they can join you.',
    clubXpRanking:'Club leaderboard (XP)',leaveClubBtn:'Leave club',confirmLeaveClub:'Leave this club? You can join another one anytime.',
    clubCreatedToast:'Club created!',clubJoinedToast:'Welcome to the club!',clubLeftToast:'You left the club',clubNotFoundToast:'No club found with this code',
    tooManyAttemptsToast:'Too many attempts, try again shortly',codeCopiedToast:'Code copied',
    clubPlanTitle:'Club plan',clubPlanNoneOwner:'No shared plan yet. Pick your IKORUN plan or one of your custom plans so the whole club trains together.',clubPlanNoneMember:'The club creator hasn’t published a shared plan yet.',
    clubPlanConfigureBtn:'Configure the club plan',clubPlanEditBtn:'Edit the club plan',clubPlanNoUpcoming:'No upcoming sessions in this plan.',
    clubPlanSourceLabel:'Which plan to share?',clubPlanSourceGenerated:'My IKORUN plan',clubPlanSourceCustom:'One of my custom plans',
    clubPlanNoGeneratedYet:'You don’t have a generated IKORUN plan yet. Go to Sport to create one, then come back here.',clubPlanNoCustomYet:'You don’t have a custom plan yet. Create one in Sport > Custom plan.',
    clubPlanSessionsCount:'{0} sessions scheduled',clubMeetupLabel:'Meetup',clubMeetupModeSlot:'Time & place',clubMeetupModeText:'Free description',
    clubMeetupTimeLabel:'Time',clubMeetupPlaceLabel:'Place',clubMeetupPlacePh:'e.g. Central Park, north entrance',
    clubMeetupTextLabel:'Description',clubMeetupTextPh:'e.g. We meet in front of the town hall, join whenever you can...',
    clubPlanPublishBtn:'Publish',clubPlanRemoveBtn:'Remove the club plan',clubPlanPublishedToast:'Club plan published!',clubPlanRemovedToast:'Club plan removed',
    clubPlanRemoveConfirm:'Remove the plan and meetup from the club? Members will no longer see them.',
    loginToAddFriends:'Sign in with Google to add friends and compare stats.',
    searchFriendPlaceholder:'Search a friend by username',receivedRequests:'Received requests',acceptBtn:'Accept',
    yourFriendsCount:'Your friends ({0})',noFriendsYet:'No friends yet — search for someone by their username!',
    sentRequests:'Sent requests',awaitingResponse:'Awaiting response…',xpRanking:'XP leaderboard among friends',
    addFriendsUnlock:'Add friends to unlock the leaderboard!',youParen:' (you)',
    searchingLab:'Searching…',loginToSearchFriends:'Sign in to search for friends',noUsernameFound:'No username found',
    loadingLab:'Loading…',friendsLoadError:'Couldn\'t load your friends. Check your connection.',retryBtn:'Retry',
    resumeBtn:'Resume',discardBtn:'Discard',
    alreadyLinked:'already linked',addBtn:'Add',searchError:'Search error',alreadySentOrFriend:'Already sent or already friends',
    requestSent:'Request sent',friendProfileTitle:'Profile',removeLab:'Remove',lvlDot:'Lvl.',kmThisWeekShort:'{0} km this week',youDefaultName:'You',backToFriends:'Back to friends',profileNotFound:'Profile not found.',noBadgeUnlocked:'No badge unlocked yet.',kmPerWeek:'km/wk',daysStreak:'Day streak',kmTotalLab:'total km',tonnageKgLab:'Volume kg',
    addPerf:'Add a performance',addChronosHint:'Add your times: they power your VDOT and your plan.',
    bestPerf:'Best performance',avgHR:'avg HR',maxHRshort:'max',perfHistoryTitle:'Performance history',
    chooseDistance:'Choose the distance',otherDist:'Other',customDistance:'Custom distance',
    chronoLab:'Time *',chronoFor:'Time {0}',dateField:'Date',placeOptional:'Place (optional)',
    placeholderPlace:'Race location',feelOptional:'How it felt (optional)',feelPlaceholder:'How did it go?',
    officialComp:'Official competition',saveThisPerf:'Save this performance',backBtn:'Back',
    perfAddedComp:'Performance added · +XP competition',perfAdded:'Performance added',
    editProfileTitle:'Edit profile',usernameLab:'Username',usernameHint:'Used by your friends to find you',
    firstNameLab:'First name',cityLab:'City',birthDateLab:'Date of birth',heightCmLab:'Height (cm)',weightKgLab:'Weight (kg)',
    kmWeekLab:'Km / week',compDateLab:'Race date',coachLab:'Coach',saveBtn:'Save',
    filterAll:'All',filterObtained:'Earned',filterLocked:'Locked',badgesObtainedCount:'{0} / {1} badges earned',
    badgeDetailTitle:'Badge details',tierOf:'Tier {0} of {1}',newBadgeUnlocked:'NEW BADGE UNLOCKED',
    tapToContinue:'Tap to continue',seeDetails:'See details',tapToClose:'Tap to close',previewLocked:'PREVIEW · LOCKED',
    obtainedOn:'Earned on {0}',lockedLab:'Locked',replayAnim:'Replay animation',seePreview:'See preview',
    obtainConditions:'Requirements',globalProgress:'Overall progress',shareBadgeBtn:'Share this badge',closeLab:'Close',
    weightLab:'Weight',imcLab:'BMI',imcUnderweight:'Underweight',imcNormal:'Normal',imcOverweight:'Overweight',imcObese:'Obese',
    sessionsPerWeek:'Sessions / wk',metabolismKcal:'Metabolism kcal',burned7d:'Burned 7d (run)',waterPerDay:'Water / day',
    recentFormTitle:'Recent form (last 7 sessions)',sleepLab:'Sleep',energyFeelLab:'Energy / feel',fatigueLab:'Fatigue',
    tipBalanced:'Everything is balanced, keep it up!',tipHighFatigue:'High fatigue: prioritize rest and sleep this week.',
    tipLowSleep:'Your sleep is insufficient: aim for 8h to recover better.',tipGreatFeel:'Great feelings: you can push a bit more!',
    noDebriefHint:'Complete sessions with their debrief to track your sleep, fatigue and recovery here.',
    nutritionTitle:'Nutrition benchmarks (athlete)',proteinLab:'Protein',carbsLab:'Carbs',fatLab:'Fat',kcalTarget:'target kcal',
    weightPickerTitle:'Your weight (kg)',weightSaved:'Weight saved',
    labHint:'Enter <b>2 values</b> you know. The other 2 are calculated automatically.',
    distField:'Distance',timeField:'Time',paceField:'Pace',speedField:'Speed',calculatedLab:'calculated',toFillLab:'to fill',
    resetBtn:'Reset',splitTimesTitle:'Split times',
    vdotToolTitle:'VDOT (Jack Daniels)',physioEstimates:'Physiological estimates',vo2maxEst:'Estimated VO₂max',
    thresholdPace:'Lactate threshold pace',marathonPace:'Marathon pace',halfPace:'Half marathon pace',efPace:'Easy pace',
    vdotAutoTip:'Your VDOT updates automatically from your records. Add your times in Profile → Records.',
    waterNeedsTitle:'Water needs',dailyRest:'Daily (rest)',perRunHour:'Per hour running',perHeatHour:'In hot weather (+/h)',
    hydraTip:'Drink regularly in small sips. Watch the color of your urine.',
    basalMetabolism:'Basal metabolism (kcal/day)',needsByActivity:'Needs by activity level',
    actSedentary:'Sedentary',actLight:'Light',actModerate:'Moderate',actIntense:'Intense',actAthlete:'Athlete',
    valueField:'Value',fromField:'From',toField:'To',
    quickNotesTitle:'Quick notes',notesPlaceholder:'Write here... (auto-saved)',autoSaveLocal:'Auto-saved locally.',
    lapBtn:'Lap',stopBtn:'Stop',resetBtn2:'Reset',bestLap:'Best lap',slowestLap:'Slowest',avgLap:'Average',lapsLab:'Laps',
    exportBtn:'Export',fastTag:'fast',slowTag:'slow',lapsCopied:'Laps copied',
    addEventBtn:'Add an event',competitionDefault:'Competition',noEventLab:'No event',pastLab:'past',
    eventTitlePrompt:'Event title:',eventDatePrompt:'Date (YYYY-MM-DD):',eventAdded:'Event added',
    prayerTitle:'Prayers · Béjaïa',uoifMethod:'UOIF method · {0}',
    obWelcomeTitle:'Welcome to IKORUN',obWelcomeIntro:'Elite Athletic Intelligence.<br>Your personal coaching, scientifically calculated, 100% offline.',
    obWhoTitle:'Who are you?',obWhoIntro:'Your basic info.',firstNamePh:'Your first name',firstNameReq:'First name *',
    usernameReq:'Username *',usernamePh:'unique_username',
    birthDateReq:'Date of birth *',sexReq:'Sex *',selectLab:'Select',maleLab:'Male',femaleLab:'Female',
    obLevelTitle:'Your level',obLevelIntro:'Be honest, the plan adapts.',
    levelNote:'Your <b>level</b> adjusts your plan\u2019s intensity and training volume, calculated automatically. Not sure? Tap <b>"How to choose?"</b>.',
    levelReq:'Level *',howChooseLab:'How to choose?',
    lvlBeginner:'Beginner',lvlIntermediate:'Intermediate',lvlAdvanced:'Advanced',lvlVeryAdvanced:'Very advanced',lvlElite:'Elite',
    obGoalTitle:'Your goal',obGoalIntro:'What keeps you running.',goalReq:'Goal *',goalPh:'E.g.: break 20:00 on the 5K',
    compDateReq:'Race date *',coachOptional:'Coach — optional',coachPh:'Your coach\u2019s name',
    obPerfTitle:'Your performances',obPerfIntro:'Add your best times. At least one is required.',
    perfNote:'Your times calculate your <b>VDOT</b> (your "engine size") and all your <b>training paces</b>. Give at least one recent, reliable time. Choose the distance then the time with the wheels.',
    addAnotherPerf:'Add another performance',backLab:'Back',continueLab:'Continue',
    paramsTitle:'Settings',libTitle:'Library',configureTitle:'Configure',programTitle:'Program',sessionTitle:'Session',
    newProgramTitle:'New program',homeDefault:'Home',chooseLab:'Choose',validateLab2:'Confirm',
    understoodLab:'Got it',howChooseLevelTitle:'How to choose my level?',
    lvlBeginnerDesc:'You\u2019ve been running for less than a year. You train occasionally and are still learning the basics.',
    lvlIntermediateDesc:'You run regularly, sometimes compete, and know the main session types.',
    lvlAdvancedDesc:'Several years of training, structured practice and precise time goals.',
    lvlVeryAdvancedDesc:'Intensive training, several races a year, very good regional or national level.',
    lvlEliteDesc:'High-level athlete: national/international performances, daily high-volume training.',
    checkingLab:'Checking…',
    fillRequiredFields:'Fill in the required fields',chooseUsernameLab:'Choose a username',usernameUnavailable:'This username is not available',
    quickProfileEnabled:'Quick profile enabled — simplified mode enabled',chooseLevelLab:'Choose a level',goalDateRequired:'Goal and date required',addAtLeastOnePerf:'Add at least one performance',
    finishLab:'Finish',distanceLab2:'Distance',timeForLab:'Time · {0}',chooseWord:'Choose',
    usernameTakenMeanwhile:'Username taken meanwhile, change it in Profile',
    liveFinishBtn:'Finish',durationLab:'Duration',volumeLab:'Volume',setsLab:'Sets',deleteLab2:'Delete',
    exerciseDoneLab:'Done',setsDoneCount:'{0}/{1} sets done',restTimerLab:'Rest timer: {0}',disabledLab:'Off',
    setCol:'Set',prevCol:'Previous',kgCol:'Kg',repsCol:'Reps',addSetBtn:'Add a set',
    addExerciseBtn:'Add an exercise',cancelSessionBtn:'Cancel session',
    restSeconds:'Rest (seconds)',minOneSetRemain:'At least one set must remain',changeRestLab:'Change rest time',
    removeExLab:'Remove this exercise',cancelLab:'Cancel',minOneExRemain:'At least one exercise must remain',
    removeExConfirmTitle:'Remove this exercise?',removeLab2:'Remove',exerciseRemoved:'Exercise removed',
    exercisesReordered:'Exercise order updated',
    exerciseAdded:'Exercise added',sessionSaved:'Session saved — resume anytime',xpGain:'+5 XP',
    restTitle:'Rest',secLab:'sec',add30sLab:'+30s',skipLab:'Skip',cancelSessionTitle:'Cancel this session?',
    progressLostText:'Your progress on this session will be lost.',continueLab2:'Continue',yesCancelLab:'Yes, cancel',sessionCancelled:'Session cancelled',
    sessionDoneTitle:'Session complete!',tonnageParenKg:'Volume (kg)',repsLab:'Reps',caloriesLab:'Calories',recordsBrokenLab:'Records broken',
    tonnageVsLastLab:'tonnage vs your last {0} session.',newRecordsLab:'New records',musclesWorkedLab:'Muscles worked',xpEarnedLab:'+50 XP earned!',
    programNameLab:'Program name',programNamePh:'My program',descriptionLab:'Description',descriptionPh:'Goal, split, frequency...',
    objectiveLab2:'Goal',iconLab:'Icon',colorLab:'Color',exercisesCountLab:'Exercises ({0})',addExFromLib:'Add exercises from the library.',
    addFromLibBtn:'Add from library',saveProgramBtn:'Save program',giveNameLab:'Give it a name',addExercisesLab:'Add exercises',programCreated:'Program created',
    sessTitle_EF:'Base Endurance',sessLabel_EF:'Easy',
    sessTitle_RECUP:'Active Recovery',sessLabel_RECUP:'Recovery',
    sessTitle_LONG:'Long Run',sessLabel_LONG:'Long run',progressiveSuffix:' (progressive)',
    sessTitle_TEMPO:'Tempo Run',sessLabel_TEMPO:'Tempo',
    sessTitle_TEMPO_SPE:'Race-Pace Tempo',sessLabel_TEMPO_SPE:'Pace tempo',
    sessTitle_SEUIL:'Threshold Session',sessLabel_SEUIL:'Threshold',
    sessTitle_DBLSEUIL:'Double Threshold (Norwegian method)',sessLabel_DBLSEUIL:'Double threshold',
    sessTitle_VMAc:'Short Speed Intervals',sessLabel_VMAc:'Short intervals',
    sessTitle_VMAl:'Long Speed Intervals',sessLabel_VMAl:'Long intervals',
    sessTitle_VO2:'VO₂max Session',sessLabel_VO2:'VO₂max',
    sessTitle_INTERVAL:'Mixed Intervals',sessLabel_INTERVAL:'Intervals',
    sessTitle_SPE:'Race Pace',sessLabel_SPE:'Race pace',
    sessTitle_PROGRESSIF:'Progressive Run',sessLabel_PROGRESSIF:'Progressive',
    sessTitle_FARTLEK:'Fartlek (pace play)',sessLabel_FARTLEK:'Fartlek',
    sessTitle_COTES:'Hill Session',sessLabel_COTES:'Hills',
    sessTitle_LIGNES:'Easy Run + Strides',sessLabel_LIGNES:'Strides',
    sessTitle_COURSE:'Race Day',sessLabel_COURSE:'Race',
    sessTitle_default:'Endurance',sessLabel_default:'Easy',
    phase_PG:'General Preparation',phase_AERO:'Aerobic Development',phase_VO2:'VO₂max Development',
    phase_SPE:'Specific Development',phase_PIC:'Peak Form',phase_TAPER:'Taper',
    bdg_debutant_name:'Beginner',bdg_debutant_desc:'The very start of the IKORUN journey.',
    bdg_amateur_name:'Amateur',bdg_amateur_desc:'You\u2019re finding your rhythm.',
    bdg_sportif_name:'Athletic',bdg_sportif_desc:'Training is becoming a habit.',
    bdg_athlete_name:'Athlete',bdg_athlete_desc:'You\u2019re progressing seriously.',
    bdg_expert_name:'Expert',bdg_expert_desc:'Real mastery of your training.',
    bdg_elite_name:'Elite',bdg_elite_desc:'Constant improvement.',
    bdg_maitre_name:'Master',bdg_maitre_desc:'Master of body and mind.',
    bdg_legende_name:'Legend',bdg_legende_desc:'A reference in your own right.',
    tierBronze:'Bronze',tierArgent:'Silver',tierOr:'Gold',tierPlatine:'Platinum',tierDiamant:'Diamond',tierMaitre:'Master',tierLegende:'Legend',
    medalCatSeances:'Sessions',medalCatRegularite:'Consistency',medalCatDistance:'Distance',
    daysLab:'days',continueUnlockBadges:'Keep going to unlock your badges',    ach_premiere_name:'First Race',ach_premiere_desc:'Finish the race you were preparing for.',
    ach_cinqk_name:'5K',ach_cinqk_desc:'Run more than 5 km in one go.',
    ach_dixk_name:'10K',ach_dixk_desc:'Run more than 10 km in one go.',
    ach_serie_name:'Streak',ach_serie_desc:'Keep a month of consistency (30 days in a row).',
    ach_denivele_name:'Elevation',ach_denivele_desc:'More than 200 m of elevation gain on a session or race.',
    ach_podium_name:'Podium',ach_podium_desc:'Finish in the top 3 of a race.',
    ach_objectif_name:'Goal Reached',ach_objectif_desc:'Hit your target time (or faster) on the race you prepared for.',
    ach_nouveaupb_name:'New PB',ach_nouveaupb_desc:'Beat a new record with a VDOT higher than your previous record.',
    ach_allure_name:'Pace',ach_allure_desc:'Run at least 3 km at a pace of 10:00/km or faster.',
    ach_endurance_name:'Endurance',ach_endurance_desc:'Finish a run of at least 15 km.',
    ach_puissance_name:'Power',ach_puissance_desc:'Do at least 3 strength sessions in a single week.',
    ach_vo2max_name:'VO2 Max',ach_vo2max_desc:'Reach an estimated VO\u2082max above 50.',
    ach_force_name:'Strength',ach_force_desc:'Lift more than 20,000 kg total in a single week.',
    catAccomplissement:'Achievement',catPerformance:'Performance',allYearsLab:'All',
    tapTrophyHint:'Tap a trophy to see the animation or the condition to earn it.',
    noTrophyInYear:'No trophy earned in {0}.',badgeUnlockedToast:'{0} unlocked!',badgeRemovedToast:'Badge removed',
    objForce:'Strength',objMass:'Mass',objEndurance:'Endurance',objWeightLoss:'Weight loss',objMaintain:'Maintenance',
    colBlue:'Blue',colRed:'Red',colGreen:'Green',colGold:'Gold',colPurple:'Purple',colCyan:'Cyan',
    newTrophyUnlocked:'NEW TROPHY UNLOCKED',
    markAsObtained:'Mark as earned',
    connectingGoogle:'Connecting to Google…',googleConnectFail:'Connection failed, try again',googleNotWorkingLink:'Not working?',googleReturnedNoSessionToast:'Google sign-in did not complete. Try again, or use email / guest mode.',
    confirmLogout:'Log out? Your data stays saved on your account.',
    confirmSwitchGoogle:'You\u2019ll be logged out so you can sign in with another Google account. Your current data stays saved.',
    confirmDeleteAllData:'This will permanently delete ALL your data (sessions, records, XP, profile...) from the cloud and this device. Continue?',
    confirmFinalIrreversible:'Final confirmation: are you really sure? This action is irreversible.',
    genericErrorRetry:'Error, try again',
    confirmRemoveFriend:'Remove this friend?',
    connectFirst:'Sign in first',copiedClipboard:'Copied to clipboard',
    usernameFormatHint:'3 to 20 characters: letters, numbers, _',checkingEllipsis:'Checking…',
    available:'Available',alreadyTaken:'Already taken',
    alarmDefaultTitle:'Alarm',timeUpMsg:'Time\u2019s up!',timeUpTitle:'Time\u2019s up!',
    stopAlarm:'Stop alarm',remindIn5Min:'Remind in 5 min',reminderCap:'Reminder',fiveMinElapsed:'5 minutes elapsed',
    sessionInProgress:'Session in progress',welcomeToast:'Welcome',
    resumeSessionConfirm:'A "{0}" session was in progress ({1} min). Resume?',sessionColonName:'Session: {0}',
    accentBlue:'Blue',accentRed:'Red',accentGreen:'Military green',accentBrown:'Woodland brown',accentYellow:'Yellow',accentCarbon:'Carbon fiber',
    colorApplied:'Color applied',easyModeOn:'Simplified mode enabled',easyModeOff:'Simplified mode disabled',
    profileIncompleteAddTime:'Incomplete profile: add a time in your records',chooseCompDate:'Choose a race date',
    planGenerated:'"{0}" plan generated: {1} wk, {2} sessions',raceGeneric:'race',
    followingPersoPlan:'You\u2019re now following this custom plan',backToIkorunPlan:'Back to IKORUN plan',
    namePromptLabel:'Name:',copySuffix:'(copy)',confirmDeletePlan:'Delete this plan?',
    addAtLeastOneRepTime:'Add at least one rep time',sessionAdded:'Session added',
    myPlanColon:'My plan: {0}',shareNotSupported:'Sharing not supported',confirmDeleteProgram:'Delete this program?',
    routineTitle:'Routine',exercisesCount:'{0} exercises',exercisesCap:'Exercises',setsCap:'Sets',estDurationCap:'Est. duration',
    setsRepsLine:'{0} sets · {1} reps',addExercise:'Add an exercise',startWorkout:'Start workout',
    defaultProgramsNotEditable:'Default programs can\u2019t be edited',
    heightCmTitle:'Height (cm)',weightKgTitle:'Weight (kg)',heightSaved:'Height saved',weightSaved:'Weight saved',
    deservedBreak:'Well-earned break!',backToWork:'Back to work!',setDuration:'Set a duration',
    photoUpdated:'Photo updated',photoRemoved:'Photo removed',bioPromptLabel:'Your bio:',
    usernameInvalid:'Invalid username (3-20, letters/numbers/_)',usernameNotAvailable:'This username isn\u2019t available',
    usernameJustTaken:'This username was just taken, pick another one',usernameUpdated:'Username updated',
    profileUpdated:'Profile updated',localDataOnly:'Local data only',exportGenerated:'Export generated',
    confirmClearAll:'Clear everything? This action is irreversible.',confirmClearAllFinal:'Really sure? All your data will be lost.',
    offlineSinceDays:'Offline for {0} days — remember to reconnect',dataSynced:'Data synced',
    connectionRestored:'Connection restored · syncing…',offlineModeAvailable:'Offline mode — everything stays accessible',
    dataImported:'Data imported',invalidFile:'Invalid file',
    searchExercisePlaceholder:'Search an exercise...',muscleLabel:'Muscle',equipmentLabel:'Equipment',levelLabel:'Level',
    exercisesWordPlural:'exercises',exerciseWordSingular:'exercise',
    movementDemoCap:'MOVEMENT DEMONSTRATION',movementDemo:'Movement demonstration',
    musclesWorked:'Muscles worked',primaryLabel:'Primary',secondaryLabel:'Secondary',
    stepByStepExecution:'Step-by-step execution',breathingLabel:'Breathing',commonMistakesLabel:'Common mistakes',
    coachTipsLabel:'Coach\u2019s tips',safetyLabel:'Safety',variantsLabel:'Variants',addToProgram:'Add to program',
    exTabExercise:'Exercise',exTabMuscles:'Muscles',exTabInstructions:'Instructions',aboutExerciseTitle:'About this exercise',
    exWorksMainly:'The <b style="color:var(--snow)">{0}</b> mainly works {1}',
    exWorksAlsoSecondary:', as well as {0} as secondary muscles',severalMuscleGroups:'several muscle groups',
    restBetweenSetsLabel:'Rest between sets',volumeCap:'Volume',durationCap:'Duration',
    targetedMusclesTitle:'Targeted muscles',primaryMusclesLabel:'Primary muscles',secondaryMusclesLabel:'Secondary muscles',
    frontViewLabel:'Front',backViewLabel:'Back',
    muscleHeatmapTitle:'Most trained muscles',lessLab:'Less',moreLab:'More',mostTrainedLab:'Most trained: {0}',noMuscleDataLab:'Finish a strength session to see your muscle load map appear.',
    executionLabel:'Execution',defaultExecutionHint:'Perform the movement in a controlled way, with a full range of motion.',
    adviceLabel:'Tips',startLabel:'Start',
    exBreathGeneric:'Inhale during the negative phase (lowering/stretch), exhale during the effort (push/contraction).',
    exStep1:'Starting position: set up correctly, brace your core, keep a neutral gaze.',
    exStep2:'Contract the target muscles before starting the movement.',
    exStep3:'Perform the concentric phase in a controlled way, without jerking.',
    exStep4:'Hold a brief pause at maximum contraction.',
    exStep5:'Return slowly, controlling the eccentric phase (2-3 s).',
    exMistakeGeneric1:'Using too much weight at the expense of technique.',
    exMistakeGeneric2:'Not using a full range of motion (movement too short).',
    exMistakeGeneric3:'Using momentum / cheating with your back.',
    exMistakeGeneric4:'Going too fast and neglecting the eccentric phase.',
    exTipGeneric1:'Prioritize the mind-muscle connection: feel the muscle working.',
    exTipGeneric2:'Stay at 2-3 RIR (reps in reserve) to progress safely.',
    exTipGeneric3:'Keep clean form on every rep.',
    exSafety1:'Warm up with light sets before your heavy sets.',
    exSafety2:'Keep your back neutral, never fully lock out your joints.',
    exSafety3:'Stop immediately if you feel sharp joint pain.',
    wuTemplate:'15-20 min easy jogging at {0}/km + 4-5 progressive strides + drills (high knees, heel flicks, bounding).',
    cdTemplate:'10-15 min very easy jogging at {0}/km + gentle stretching.',
    recovLabel_2minTrot:'2 min jog',recovLabel_1minTrot:'1 min jog',recovLabel_30sTrot:'30 s jog',recovLabel_2to3minTrot:'2-3 min jog',recovLabel_90sTrot:'90 s jog',
    repsTextTemplate:'{0} × {1} m at {2} ({3}/km)',seriesPyramid:'Pyramid {0}→{1} m',seriesRepsDist:'{0} × {1} m at {2}',seriesRepsOnly:'{0} × reps',
    deloadPrefixTemplate:'DELOAD WEEK — {0}',
    bs_ef_objectif:'Build your aerobic base — the foundation of all progress (80% of elite volume).',
    bs_ef_warmup:'Progressive warm-up over 10 min.',bs_ef_body:'{0} km at easy pace ({1}/km). You should be able to hold a conversation throughout.',
    bs_ef_paces:'Zone 2, ~70% max HR — {0}/km.',bs_ef_recovery:'Continuous effort.',bs_ef_cooldown:'A few calf and hamstring stretches.',
    bs_ef_tip1:'Breathe from your belly.',bs_ef_tip2:'The slow pace is intentional and productive.',bs_ef_mistake1:'Running too fast "out of habit".',
    bs_ef_why:'Develops the heart, capillaries and mitochondria without fatigue or risk.',
    bs_recup_objectif:'Speed up recovery between two hard sessions.',bs_recup_warmup:'None.',
    bs_recup_body:'{0} km very easy at {1}/km.',bs_recup_paces:'Zone 1 — very slow.',bs_recup_cooldown:'Self-massage / mobility work.',
    bs_recup_tip1:'If very tired, swap for a 25 min walk.',bs_recup_mistake1:'Speeding up: you sabotage the recovery.',
    bs_recup_why:'Blood flow clears waste products and kickstarts adaptation.',
    bs_long_objectif:'Build endurance, running economy and mental toughness.',bs_long_warmup:'Progressive start over 10 min.',
    bs_long_body_progressive:'{0} progressive km: 1st half at {1}/km, 2nd half accelerating up to {2}/km.',
    bs_long_body_steady:'{0} km at a steady endurance pace ({1}/km).',bs_long_paces:'Easy {0}/km → marathon pace {1}/km at the end.',
    bs_long_recovery:'Continuous, fuel up if over 1h15.',bs_long_tip1:'Eat well the night before.',bs_long_tip2:'Bring water + a gel if over 1h30.',
    bs_long_mistake1:'Starting too fast and walking at the end.',bs_long_why:'Increases glycogen stores and the ability to use fat as fuel.',
    bs_tempo_objectif:'Improve efficiency and endurance at a sustained pace.',
    bs_tempo_body:'{0} min continuous at {1}/km ("comfortably hard"), about {2} km.',bs_tempo_paces:'~83% of max aerobic speed — {0}/km.',
    bs_tempo_recovery:'Continuous block.',bs_tempo_tip1:'You should be able to say 2-3 words, not a full sentence.',bs_tempo_mistake1:'Starting too fast and blowing up.',
    bs_tempo_why:'Pushes back the lactate accumulation threshold.',
    bs_temposp_objectif:'Get familiar with your target race pace ({0}).',bs_temposp_body:'{0}, 2 min jog recovery between blocks.',
    bs_temposp_paces:'Race pace: {0}/km.',bs_temposp_tip1:'Memorize the feel of this pace.',
    bs_temposp_mistake1:'Going faster than the target pace.',bs_temposp_why:'The race pace must become automatic on race day.',
    bs_seuil_objectif:'Push back the lactate threshold — the #1 performance factor.',bs_seuil_body:'{0}, 1 min jog recovery.',
    bs_seuil_paces:'~88% of max aerobic speed — {0}/km.',bs_seuil_recovery:'1 min jog between each.',bs_seuil_tip1:'All reps at the same pace.',
    bs_seuil_mistake1:'Starting too hard on the 1st rep.',bs_seuil_why:'The threshold is the pace you can hold for ~1h; raising it makes everything else easier.',
    bs_dblseuil_objectif:'Maximize threshold volume without excessive fatigue (the Norwegian key).',
    bs_dblseuil_warmup:'{0} (×2: once in the morning, once in the evening)',
    bs_dblseuil_body:'Morning: {0} × {1} min at {2}/km (1 min recovery). Evening: {3} (30 s recovery). Stay sub-maximal.',
    bs_dblseuil_paces:'Controlled threshold {0}/km — lactate ~2-4 mmol.',bs_dblseuil_recovery:'Short recovery, controlled intensity.',
    bs_dblseuil_cooldown:'{0} (after each session)',bs_dblseuil_tip1:'Never finish exhausted: you should be able to repeat the session.',
    bs_dblseuil_mistake1:'Turning the threshold session into a VO2max session.',
    bs_dblseuil_why:'A double dose of threshold stimulus for minimal fatigue — the Ingebrigtsen signature.',
    bs_dblseuil_note:'Evening session (morning = {0} × {1} min)',
    bs_vmac_objectif:'Develop vVO2max and top-end speed.',bs_vmac_warmup:'{0} Warm-up is MANDATORY.',
    bs_vmac_body:'{0}, 1 min jog recovery. (or short variant: {1} × ~{2} m fast / {3} m jog, same intensity).',
    bs_vmac_paces:'~108-110% of max aerobic speed — aim for {0} on each {1} m (not {2}, which is just the pace converted to per-km).',
    bs_vmac_recovery:'1 min jog between the {0} m reps.',bs_vmac_tip1:'Same split time on every rep: {0} for {1} m.',
    bs_vmac_mistake1:'Skimping on the warm-up → injury.',
    bs_vmac_mistake2:'Confusing the displayed pace/km with the actual time to hit over {0} m.',
    bs_vmac_why:'Stimulates VO2max and neuromuscular economy.',
    bs_vmal_objectif:'Raise your VO2max — your maximum engine capacity.',bs_vmal_body:'{0}, 2-3 min jog recovery. (or {1} × 1200 m).',
    bs_vmal_paces:'~95-98% of max aerobic speed — {0}/km.',bs_vmal_tip1:'Consistency above all.',bs_vmal_tip2:'Stop if you can\u2019t hold the pace anymore.',
    bs_vmal_mistake1:'Recovery too short.',bs_vmal_why:'Time spent at ~90-100% VO2max increases your maximum aerobic power.',
    bs_interval_objectif:'Mixed speed-endurance work.',bs_interval_body:'Pyramid: {0}, jog recovery = effort duration between each segment.',
    bs_interval_paces:'From {0}/km (200 m) to {1}/km (800 m) — the pace gradually slows as distance increases.',
    bs_interval_recovery:'Active recovery equal to the effort duration.',
    bs_interval_tip1:'Adjust pace by distance: the shorter the rep, the faster your absolute speed.',
    bs_interval_mistake1:'Running everything at the same speed.',bs_interval_why:'Combines several energy systems.',
    bs_interval_recoveryLabel:'jog = effort duration',
    bs_spe_objectif:'Lock in your exact race pace ({0}).',bs_spe_body:'{0}, 90 s recovery.',bs_spe_paces:'Target pace: {0}/km.',
    bs_spe_tip1:'This pace should become second nature.',bs_spe_mistake1:'Going faster out of overconfidence.',
    bs_spe_why:'Specificity is what matters most as race day approaches.',
    bs_progressif_objectif:'Learn to accelerate while fatigued.',bs_10min_warmup:'10 min at {0}/km.',
    bs_progressif_body:'{0} km in 3 stages: {1} → {2} → {3}/km.',bs_progressif_paces:'Easy → tempo.',bs_progressif_recovery:'Continuous.',
    bs_progressif_tip1:'Each stage a bit faster than the last.',bs_progressif_mistake1:'Starting too fast.',
    bs_progressif_why:'Builds mental strength and negative-split ability.',
    bs_fartlek_objectif:'Feel-based, playful and free-form work.',bs_fartlek_warmup:'15 min at {0}/km.',
    bs_fartlek_body:'{0} × (1 min fast / 1 min slow) by feel, outdoors.',bs_fartlek_paces:'Fast ≈ {0}/km, slow ≈ {1}/km.',
    bs_fartlek_recovery:'Free active recovery.',bs_fartlek_tip1:'Play with the terrain.',bs_fartlek_mistake1:'Over-structuring it: let yourself go.',
    bs_fartlek_why:'Develops VO2max while having fun and breaking the routine.',
    bs_cotes_objectif:'Develop power, strength and running economy.',
    bs_cotes_body:'{0} × 30-45 s uphill (4-6% grade) at a strong effort, jog back down for recovery.',bs_cotes_paces:'Effort at ~90%.',
    bs_cotes_recovery:'Downhill jog for recovery.',bs_cotes_tip1:'Short, dynamic stride, look ahead.',
    bs_cotes_mistake1:'Running back down too fast (impact risk).',bs_cotes_why:'Hills are specific strength training without harsh impact.',
    bs_cotes_recoveryLabel:'downhill jog',bs_cotes_note:'30-45 s of uphill effort per rep',
    bs_lignes_objectif:'Maintain speed and freshness (ideal for tapering).',
    bs_lignes_body:'{0} km easy + {1} × 80-100 m progressive strides (no forcing it), walk recovery.',
    bs_lignes_paces:'Easy pace + relaxed strides.',bs_lignes_recovery:'Walk/jog between strides.',bs_lignes_cooldown:'Stretching.',
    bs_lignes_tip1:'Stay relaxed, don\u2019t sprint.',bs_lignes_mistake1:'Pushing too hard on strides during the taper period.',
    bs_lignes_why:'Keeps the nervous system sharp without adding fatigue.',
    bs_course_objectif:'Deliver your best performance — target: {0}!',
    bs_course_warmup:'25-30 min: progressive jog + strides + 3 race-pace accelerations.',
    bs_course_body:'{0} km at {1}/km. Controlled start, strong middle, all-out finish.',bs_course_paces:'Target pace: {0}/km.',
    bs_course_cooldown:'15 min easy jog right after finishing + stretching.',bs_course_tip1:'Don\u2019t start too fast.',
    bs_course_tip2:'Latch onto a runner at your level.',bs_course_mistake1:'Sleeping or eating poorly the night before.',
    bs_course_why:'The culmination of all your preparation. Trust yourself!',
    bs_default_objectif:'Endurance.',bs_default_body:'{0} km easy.',bs_default_why:'Aerobic base.',
    avgPerKmLabel:'/km avg',cooldownLabel:'Cooldown',detailedPacesLabel:'Detailed paces',equivalentPaceLabel:'Equivalent pace',
    markCompleted:'Mark completed',mistakesToAvoidLabel:'Mistakes to avoid',objectiveCap:'OBJECTIVE',objectiveWord:'Objective',
    paceWarnMsg:'Don\u2019t exceed the indicated pace on the first reps — better to finish strong than start too fast.',
    pacesLabel:'Paces',recoveryColon:'Recovery:',recoveryLabel:'Recovery',repetitionsWord:'reps',
    seriesPyramidTitle:'Series — pyramid',sessionBodyLabel:'Main set',sessionCompleted:'Session completed',
    targetPaceLabel:'Target pace',targetSplitLabel:'Target split time',warmupLabel:'Warm-up',
    weekLabelWithNum:'Week',whySessionLabel:'Why this session?',zone2FCmaxLine:'Zone 2 · 70% max HR · {0}/km',
    analyzeSessionBtn:'Analyze my session',autoLightenedFlag:'Session automatically lightened (reason: {0} on {1}).',
    avgPaceKmLabel:'Average pace /km',coachAnalysisTitle:'Coach Analysis',
    coach_adj_continue:'Keep going as planned, your plan is well calibrated.',
    coach_motiv1:'One more session in the legs — fitness is built by consistency, not by one-off heroics.',
    coach_motiv2:'You did the hard part: showing up. Your body handles the rest during recovery.',
    coach_motiv3:'Every logged run makes the plan more accurate. You are not training blind.',
    coach_motiv4:'Nobody improves in a straight line. What matters is that the curve rises over the month.',
    coach_adj_increaseVolume:'You\u2019re in good shape: we can slightly increase the volume next week.',
    coach_adj_lighten48h:'Lighten your next hard session by 48h to recover well.',
    coach_adj_rest:'Next session: replace it with rest or a very light jog.',
    coach_err_fatigue:'High fatigue level: watch out for overtraining.',
    coach_err_paceMuchSlower:'Much slower than planned — check whether it was fatigue, heat, or too ambitious a target pace.',
    coach_tip_paceSlower:'A bit slower than planned with a high perceived effort: consider starting easier next time.',
    coach_pos_paceFaster:'Faster than planned without forcing it: a good sign of fitness.',
    coach_err_paceFasterTooHard:'Faster than planned, but at a very high effort cost — watch out for burning out the next sessions.',
    coach_err_harderThanPlanned:'Your session was much harder than planned (RPE {0} vs {1} expected). You may have started too fast or you\u2019re fatigued.',
    coach_err_pain:'Pain level: {0}. Don\u2019t ignore it. Persistent joint pain means rest.',
    coach_err_sleep:'Insufficient sleep: your performance and recovery will suffer.',
    coach_err_tooEasy:'Session too easy (RPE {0}): you can probably push a bit harder next time.',
    coach_pos_completed:'You finished your session: consistency is your greatest strength.',
    coach_pos_feel:'Excellent feel — your body is responding well to training.',
    coach_pos_nopain:'No pain reported: your technique and training load are well managed.',
    coach_pos_nutrition:'Great nutrition, the fuel is there.',
    coach_pos_sleep:'Good sleep: that\u2019s 50% of your recovery, keep it up.',
    coach_tip_heat:'In hot weather, run early in the morning and hydrate more.',
    coach_tip_hydrate:'Drink at least 0.5 L of water in the hour after.',
    coach_tip_nutrition:'Eat carbs + protein within 30 min after the effort.',
    coach_tip_sleep:'Aim for 8h of sleep tonight, screens off 1h before.',
    constructiveCriticismTitle:'Constructive feedback',dayNutritionLabel:'Today\u2019s nutrition',
    debriefIntro:'Answer honestly: the IKORUN engine will analyze your session.',
    distanceKmLabel:'Distance (km)',distanceKmOptionalLabel:'Distance (km, optional)',
    durationMinLabel:'Duration (min)',durationMinOptionalLabel:'Duration (min, optional)',
    elevationGainLabel:'Elevation gain (m, optional)',fatigueLabel:'Fatigue',freeCommentLabel:'Free comment',
    howDidYouFeelPlaceholder:'How did you feel?',ikorunAnalysisTitle:'IKORUN Analysis',
    legDayCarryoverFlag:'Your leg session already worked these muscles — go easy on explosiveness today.',
    load_goodAssimilation:'Good assimilation (reps on target, RPE under control) → volume and intensity slightly increased.',
    load_high:'High load detected (missed sessions, RPE above plan, or fatigue) → volume reduced by about 12% this week.',
    load_stable:'Stable load: new session variants, volume unchanged.',
    missedReasonPrompt:'Why wasn\u2019t this session completed?',missedReplacementPrompt:'Did you end up doing something else?',
    missedSessionTitle:'Missed session',nightSleepLabel:'Night\u2019s sleep',
    note_cardioAlreadyCounted:'cardio load already accounted for, plan unchanged',
    note_explosiveCaution:'caution advised for your next explosive session',note_nextHardLightened:'next hard session lightened',
    notedCoachBtn:'Got it, Coach!',notesOptionalLabel:'Notes (optional)',paceKmLabel:'Pace /km',painLabel:'Pain',paceAdherenceLabel:'Did you hold the pace?',paceFasterOpt:'Faster',paceAsPlannedOpt:'As planned',paceSlowerOpt:'A bit slower',paceMuchSlowerOpt:'Much slower',moreDetailsBtn:'More details ↓',lessDetailsBtn:'Less details ↑',
    planUpdatedWeekReason:'Plan updated for the week — {0}',positivePointsTitle:'Positive points',
    recentMissesReducedMsg:'3 recent missed sessions: upcoming weeks\u2019 volume reduced by 15%',
    repByRepSummary:'Rep-by-rep summary — {0} × {1} m',
    repLegendLine:'= enter actual time · ✓ = "I held the pace" (auto-fills with the target time)',
    repNumDist:'Rep {0} · {1} m',replacementMuscuTitle:'Replacement — {0}',replacementRunTitle:'Replacement run',
    respectedCount:'{0}/{1} on target',rpeFeltLabel:'RPE — perceived difficulty:',sensationsLabel:'Feel',
    sessionNotedToast:'Session logged',sessionTypeLabel:'Session type',targetColon:'Target {0}',
    upcomingAdjustmentsTitle:'Upcoming adjustments',weatherLabel:'Weather',
    addAsGoalLabel:'Add as goal',advancedLabel:'Advanced',calculateLabel:'Calculate',copiedShortToast:'Copied',
    copyLabel:'Copy',customDistanceKmLabel:'Custom distance (km)',distanceLabel:'Distance',
    goalAddedReason:'goal added',goalAddedToast:'Goal added',
    ikorunDistInTime:'IKORUN — {0}km in {1}',kmSplitsLabel:'Km splits',myIkorunPrediction:'My IKORUN prediction: {0}km in {1}',
    negativeSplitLabel:'Negative split',paceCalculatorTitle:'Pace calculator',paceMinSecKmLabel:'Pace (min : sec /km)',
    penaltySecKmLabel:'Penalty (sec/km)',predictedTimeLabel:'Predicted time',resetShortLabel:'Reset',
    resultSavedToast:'Result saved',resultsLabel:'Results',runCalcFirstToast:'Run a calculation first',
    sleepBorderline:'Borderline — aim higher',sleepCyclesTip:'A cycle lasts ~90 min. Aim to wake up at the end of a cycle: 6h, 7h30 or 9h of sleep. Go to bed at a regular time to optimize recovery.',
    sleepCyclesTitle:'Sleep cycles',sleepHoursPerNightLabel:'Hours of sleep / night',
    sleepInsufficient:'Insufficient — recovery compromised',sleepOptimal:'Optimal for an athlete',sleepPlenty:'A lot — listen to your body',
    speedLabel:'Speed',timeHMSLabel:'Time (h : mm : ss)',
    configurePlanTitle:'Configure my plan',courseProfileLabel:'Course profile',generateMyPlanBtn:'Generate my plan',
    planSetupSimpleHint:'We handle the rest (pace, distances, sessions) and adjust everything as you go.',
    maxKmWeekLabel:'Max km/week (peak)',minKmWeekLabel:'Min km/week',preferredSessionsLabel:'Preferred sessions (the coach will favor these)',
    preparedRaceLabel:'Race you\u2019re preparing for',raceDateLabel:'Race date',targetTimeOptionalLabel:'Target time (optional)',
    trainingDaysLabel:'Training days',yourNextRaceDefault:'Your next race',
    guardFutureDate:'You can\u2019t log a session with a future date.',
    sessionNotYetLabel:'This session hasn\u2019t happened yet',guardFutureSession:'You can\u2019t complete a session that hasn\u2019t happened yet',
    guardDistanceTooHigh:'Unrealistic distance compared to your history ({0} km max for now).',
    guardPaceTooFast:'This pace isn\u2019t consistent with your current VDOT ({0}). Check what you entered.',
    guardRecordTooFast:'This performance would imply a VDOT of {0}, too far from your current level. Check your time.',
    guardStorageTooBig:'This data is too large and wasn\u2019t synced to the cloud.',
    loginWelcomeTitle:'Welcome',loginSubConnect:'Sign in to save your progress, sessions and records — synced across all your devices.',
    signupTitle:'Create an account',signupSub:'Join IKORUN to save your progress and find it on all your devices.',
    forgotTitle:'Forgot password',forgotSub:'Enter your email, we\u2019ll send you a reset link.',
    emailLabel:'Email',passwordLabel:'Password',confirmPasswordLabel:'Confirm password',
    emailPlaceholder:'your@email.com',
    loginBtnLabel:'Sign in',signupBtnLabel:'Create my account',sendResetLinkBtn:'Send link',
    forgotPasswordLink:'Forgot password?',noAccountLink:'No account? Create one',
    haveAccountLink:'Already have an account? Sign in',backToLoginLink:'Back to sign in',
    orDividerLabel:'or',continueWithGoogleBtn:'Continue with Google',
    loginLegalText:'By continuing, you accept our <span class="legal-link" onclick="openProfileSection(\'terms\')">terms of use</span> and our <span class="legal-link" onclick="openProfileSection(\'privacy\')">privacy policy</span>.<br>Your data is synced securely via your account.',
    installAppBtn:'Install the app',installAcceptedToast:'App installed!',installFallbackToast:'Use your browser menu (or the install icon in the address bar) to install the app.',
    iosInstallStep1:'1. Tap the Share icon '+'⬆️'+' at the bottom of Safari.',
    iosInstallStep2:'2. Scroll down and tap "Add to Home Screen".',
    androidInstallStep1:'1. Tap the three dots at the top right of Chrome.',
    androidInstallStep2:'2. Choose "Install app" (or "Add to Home screen").',
    termsOfUseLab:'Terms of use',privacyPolicyLab:'Privacy policy',
    sessionPausedLab:'Session paused',createBtn:'Create',libraryLab:'Library',
    defaultProgramsLab:'Default programs',myCreationsLab:'My creations',
    exSetsSummary:'{0} exercises · {1} sets',exosShort:'{0} exercises',
    loadKgLab:'Load (kg)',restLab2:'Rest',personalNotesLab:'Personal notes (optional)',notesPh:'e.g. squeeze the shoulder blades',
    levelUpTitle:'LEVEL UP',
    syncedCloudLab:'Synced to the cloud',addAccountBtn:'Add an account',dangerZoneLab:'Danger zone',
    deleteAccountDesc:'Permanently deletes your account and all your data, in the cloud and on this device.',
    deleteAccountBtn:'Delete my account and my data',
    exportImportDesc:'Export a copy of your data or import an existing backup.',
    resetDesc:'Erases all app data on this device.',
    profilePhotoTitle:'Profile photo',choosePhotoLab:'Choose your profile photo:',fromGalleryBtn:'From the gallery',
    takePhotoBtn:'Take a photo',removePhotoBtn:'Remove current photo',cropTitle:'Crop',zoomLab:'Zoom',validatePhotoBtn:'Confirm photo',
    liftedLoadKgLab:'Load lifted (kg)',estimated1RMLab:'Estimated 1RM (Epley)',percentOf1RMLab:'% of your 1RM',repsShort:'reps',
    totalTonnageLab:'Total tonnage ({0}×{1}×{2}kg)',noDataLab:'No data',distanceKmLab:'Distance (km)',
    kcalBurnedLab:'kcal burned (~{0}kg)',currentLoadKgLab:'Current load (kg)',weeklyProgressKgLab:'Progress / week (kg)',
    weeksLab:'Weeks',projectionLab:'Projection',
    hrMaxLab:'Max HR (bpm)',hrRestLab:'Resting HR (bpm)',hrZonesLab:'Heart rate zones (Karvonen)',
    hrZ1:'Z1 Recovery',hrZ2:'Z2 Endurance',hrZ3:'Z3 Tempo',hrZ4:'Z4 Threshold',hrZ5:'Z5 VO2max',
    restTimesLab:'Recommended rest times',supersetLab:'Superset',pomoFocus:'Focus',pomoBreak:'Break',pomodorosDoneLab:'Pomodoros completed: {0}',
    fillEmailPasswordToast:'Fill in email and password.',invalidEmailToast:'Invalid email address.',
    passwordTooShortToast:'Password too short (8 characters min).',passwordsMismatchToast:'Passwords don\u2019t match.',
    wrongCredentialsToast:'Wrong email or password — and if you just created your account, confirm your email first.',emailRateLimitToast:'Too many email requests in a row. Wait a few minutes before trying again.',sessionExpiredToast:'Session expired, please sign in again. Your data stays on this device.',emailAlreadyUsedToast:'An account already exists with this email.',
    authGenericErrorToast:'Something went wrong. Try again.',checkEmailConfirmToast:'Account created ✓ Check your inbox to confirm your email.',
    authTimeoutToast:'This is taking too long. Check your internet connection and try again.',
    resetLinkSentToast:'Link sent ✓ Check your inbox.',loggingInToast:'Signing in…',creatingAccountToast:'Creating account…',sendingResetToast:'Sending link…',
    continueAsGuestLink:'Continue as guest',guestConnectingToast:'Signing in as guest…',guestDisabledToast:'Guest mode isn\'t enabled yet. Try again later or create an account.',
    guestModeTitle:'Guest mode',guestModeLabel:'Guest mode',guestModeDesc:'Your data is tied to this device. If you sign out or switch phones, you could lose it. Add an email to protect it.',
    guestSaveAccountBtn:'Save my account',guestUpgradeSentToast:'Check your inbox to confirm. You can then sign in with this email anytime (use "forgot password" to set one).',guestUpgradeEmailUsedToast:'This email is already used by another account.',
    tourSkip:'Skip',tourStartBtn:'Let\'s go',tourNextBtn:'Next',tourFinalBtn:'Create my plan',replayTourBtn:'Replay the tutorial',
    tour_welcome_t:'Welcome {0} 👋',tour_welcome_d:'IKORUN isn’t a GPS or a pedometer: it’s a smart training log that generates your plan and adjusts it based on what you tell it. 8 steps, one minute.',
    tour_home_t:'Your home screen',tour_home_d:'The day card shows your planned session, with the why behind it. Once done, tap "I did it" — or "Not done" if you didn’t, that’s never a problem.',
    tour_loop_t:'How it works',tour_loop_d:'Your plan is generated from your level and your times. After each session, a debrief asks how it felt (fatigue, pain, pace) — YOU say how hard it was, not a sensor. IKORUN doesn’t track anything in the background.',
    tour_sport_t:'Running and strength',tour_sport_d:'The Sport tab generates your custom running plan (level, goal, race date) and also offers strength programmes. Regenerate the plan anytime your life changes.',
    tour_adapt_t:'The plan adjusts itself',tour_adapt_d:'Missed a session, high fatigue, reported pain: upcoming sessions get lighter automatically. Going too easy? They ramp up. You never have to recalculate anything yourself.',
    tour_stats_t:'Your stats',tour_stats_d:'Kilometres, sessions, VDOT, personal records — and your XP, levels and badges, earned only from real sessions (the app checks).',
    tour_outils_t:'The toolbox',tour_outils_d:'Pace calculator, VDOT, BMI, stopwatch, timer... Search for the tool you need or keep your favourites within reach.',
    tour_profil_t:'Your profile',tour_profil_d:'Level, XP, badges — and every setting: language, colour, and the simplified mode you chose (changeable here anytime). Got an idea or found a bug? "Send feedback", at the bottom, goes straight to our inbox.',
    tour_club_t:'Join your club',tour_club_d:'Join your team’s club with a code, or create your own: a dedicated leaderboard, teammates visible at a glance. The creator can even publish a shared training plan with a meeting time and place, so everyone trains together. Real team spirit, not just friends one by one.',
    tour_final_t:'Ready to start?',tour_final_d:'Set your goal and generate your personalized plan — now’s the time!',
    tourGotItBtn:'Got it',signupHelpLink:'Need help?',
    tour_sg_welcome_t:'Let\'s create your account',tour_sg_welcome_d:'Three quick things and you\'re set — takes 30 seconds.',
    tour_sg_email_t:'Your email',tour_sg_email_d:'Used to sign in and to receive your confirmation link. No spam, promise.',
    tour_sg_password_t:'Pick a password',tour_sg_password_d:'8 characters minimum. You\'ll retype it just below to confirm.',
    tour_sg_submit_t:'All set',tour_sg_submit_d:'A confirmation email is waiting for you next — click the link, then come back to set up your profile.'
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
    todayGoals:'أهداف اليوم',weekLoad:'حمل الأسبوع',sessions:'حصص',form:'اللياقة',
    quipTime:'نلاحق {0}؟',quipGoal:'نتقدم نحو: {0}؟',quipDefault:'مستعد لتجاوز حدودك اليوم؟',
    weekLoadTitle:'الحمل الأسبوعي',levelXp:'المستوى {0} — {1} نقطة خبرة',xpBeforeLevel:'+{0} نقطة قبل المستوى {1}',
    sessionsCap:'الحصص',tonnageKg:'الحمولة كغ',formCap:'اللياقة',nextSession:'الحصة القادمة',today:'اليوم',
    restDay:'يوم راحة',noSessionToday:'لا توجد حصة مخططة اليوم',recordsPerso:'الأرقام الشخصية',
    iDidIt:'أنجزتها',notDone:'لم أنجزها',nextLab:'التالي',dayPlusShort:'+{0} ي',rpeShort:'RPE',kmWeekShort:'كم/أسبوع',sessionsLab:'حصص',
    syncSlowToast:'المزامنة بطيئة — التطبيق يبدأ وبياناتك في الطريق',syncFailedLocalToast:'تعذّرت المزامنة — أنت تعمل على بياناتك المحلية',syncCloudErrorToast:'خطأ في المزامنة مع السحابة',
    doneTag:'تمّت',
    setsCount:'{0} مجموعات',daysAgoShort:'قبل {0} ي',neverDoneLab:'لم تُنجز بعد',
    pauseLab:'إيقاف مؤقت',restTimerBtn:'مؤقّت الراحة',
    googleStandaloneTitle:'Google والتطبيق المثبّت',googleUseEmailBtn:'تسجيل الدخول بالبريد',googleOpenSafariBtn:'الفتح في Safari',googleStandaloneHint:'غير متاح من التطبيق المثبّت',
    declineBtn:'رفض',saveLabel:'حفظ',renameLab:'إعادة تسمية',favoriteLab:'مفضّل',
    langLab:'اللغة',obModeTitle:'طريقة العرض',obModeIntro:'طريقتان لرؤية IKORUN — غيّر رأيك في أي وقت من الملف الشخصي.',obModeFullT:'كامل',obModeFullD:'كل الإحصائيات، تفاصيل كل حصة، تشريح العضلات، الرسوم البيانية. للتعمّق.',obModeSimpleT:'مبسّط',obModeSimpleD:'بطاقة واحدة، الأساسيات: حصة اليوم وزر واحد. لا شيء آخر على الشاشة. للذهاب مباشرة إلى الهدف.',obModeSuggestion:'اقتراح حسب عمرك: {0}. اختر بحرية.',chooseModeLab:'اختر طريقة عرض للمتابعة',
    trackingLab:'المتابعة',appearanceLab:'المظهر',
    sendFeedbackLab:'إرسال تعليق',feedbackNoAddressToast:'لم يتم إعداد عنوان التواصل بعد — أعد المحاولة بعد التحديث القادم.',feedbackTitle:'رأيك',feedbackIntro:'فكرة، خلل، أو شيء يزعجك في التطبيق؟ اكتبه هنا، سيُفتح مباشرة في تطبيق بريدك.',feedbackPh:'اكتب تعليقك...',feedbackEmptyToast:'اكتب شيئًا قبل الإرسال',feedbackSentToast:'فُتح تطبيق البريد لديك، لم يبقَ سوى الضغط على إرسال',feedbackSignature:'الحساب: {0} · اللغة: {1}',
    sendBtn:'إرسال',
    playLab:'ابدأ',
    cvCat_dist:'المسافة',cvCat_pace:'الوتيرة',cvCat_weight:'الوزن',cvTapToEdit:'اضغط للتعديل',
    googleStandaloneBody:'على iPhone، عند فتح IKORUN من أيقونة الشاشة الرئيسية، يغادر تسجيل الدخول عبر Google إلى Safari ولا يعود: ينجح، لكن داخل Safari وليس هنا. سجّل الدخول بالبريد داخل التطبيق، أو افتح IKORUN في Safari لاستخدام Google.',
    progression:'التقدم',planOfDay:'خطة اليوم',planIkorunDesc:'خطط تدريبية صممها مدربون',
    myPlanDesc:'أنشئ خطتك الخاصة',todayCap:'اليوم',tapToStart:'عرض التفاصيل',
    goalCap:'الهدف',courseDefault:'سباق',goalTimeColon:'الهدف: {0} · ',raceOn:'السباق يوم {0}',raceDay:'يوم السباق',
    currentVdot:'VDOT الحالي',currentPhase:'المرحلة الحالية',thisWeek:'هذا الأسبوع',weekOf:'الأسبوع {0}/{1}',
    weeklyLoad:'الحمل الأسبوعي',regenConfirm:'إعادة توليد خطة جديدة؟ الحصص المنجزة تبقى في إحصائياتك.',
    regenBtn:'إعادة التوليد / الإعداد',planIkorunPill:'خطة IKORUN',myPlanPill:'خطة شخصية',
    planIkorunTitle:'خطة IKORUN — محرك علمي',
    planIkorunDescLong:'يولّد خطة مرحلية مخصصة (الطريقة النرويجية + VDOT/Daniels) بناءً على VDOT الخاص بك ({0})، هدفك، تفضيلاتك وتاريخ سباقك. تتعدل الخطة تلقائيًا إذا فاتتك حصة.',
    planIkorunDescSimple:'\u064A\u0646\u0634\u0626 \u062E\u0637\u0629 \u062A\u062F\u0631\u064A\u0628\u0643 \u062D\u0633\u0628 \u0645\u0633\u062A\u0648\u0627\u0643 \u0648\u0633\u0628\u0627\u0642\u0643. \u062A\u062A\u0639\u062F\u0644 \u0627\u0644\u062E\u0637\u0629 \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627 \u0625\u0630\u0627 \u0641\u0627\u062A\u062A\u0643 \u062D\u0635\u0629.',
    configureGenerate:'إعداد وتوليد',weekN:'الأسبوع {0}',deloadTag:' · مخففة',missedTag:'فائتة',restTag:'راحة',
    newPersoPlan:'خطة شخصية جديدة',createCustomPlan:'أنشئ خطتك المخصصة',
    createCustomPlanDesc:'أضف حصصك الخاصة، اختر التواريخ والأنواع والوتيرة. كل شيء يتزامن مع صفحتك الرئيسية وإحصائياتك.',
    sessionsCount:'{0} حصص · {1} منجزة',followedTag:'متابَعة',duplicate:'نسخ',share:'مشاركة',
    planNamePrompt:'اسم الخطة:',myPersoPlanDefault:'خطتي الشخصية',
    you:'أنت',dowShort:'ن,ث,ر,خ,ج,س,ح',greet:'مرحبا',
    weekPhaseLabel:'الأسبوع {0} · {1}',thresholdPaceShort:'وتيرة العتبة',vsLastWeekShort:'مقابل الأسبوع الماضي',
    nextSessionMeta:'الحصة القادمة · {0}',newWeekTag:'أسبوع جديد',thisWeekCap:'هذا الأسبوع',
    totalTime:'الوقت الإجمالي',remainingCap:'المتبقي',sessionsRemainingVal:'{0} حصص',objectiveReached:'تم بلوغ الهدف',
    untilEndWeek:'حتى الأحد',sessionsDoneShort:'{0} حصص',planOfWeek:'خطة الأسبوع',
    streakDaysShort:'سلسلة {0} أيام',seePlan:'عرض الخطة',
    // --- الأدوات ---
    searchTool:'ابحث عن أداة...',favorites:'المفضلة',mainTools:'الأدوات الرئيسية',otherTools:'أدوات أخرى',
    resultsCount:'{0} نتيجة',editFavsTitle:'تعديل المفضلة',tapStarHint:'اضغط على النجمة لإضافة/إزالة أداة من مفضلتك.',
    toolAioName:'مختبر الأداء',toolAioSub:'المسافة · الوقت · الوتيرة · السرعة',
    toolSanteName:'لوحة الصحة',toolSanteSub:'الوزن، كتلة الجسم، النوم، التغذية...',
    toolChronoName:'ساعة توقيت',toolChronoSub:'الأشواط والإحصائيات',
    toolConvertName:'المحوّل',toolConvertSub:'الوتيرة، المسافة، الوزن...',
    toolNotesName:'ملاحظات',toolNotesSub:'مفكرة سريعة',
    toolVdotName:'VDOT وVO₂max',toolVdotSub:'قيّم قدرتك',
    toolImcName:'كتلة الجسم',toolImcSub:'مؤشر كتلة الجسم',
    toolHydraName:'الترطيب',toolHydraSub:'احتياجاتك من الماء',
    toolBmrName:'السعرات والأيض',toolBmrSub:'الاحتياجات اليومية',
    toolAgendaName:'الأجندة',toolAgendaSub:'كل أحداثك',
    toolPriereName:'الصلوات',toolPriereSub:'كل الأوقات',
    // --- الملف الشخصي ---
    athleteDefault:'رياضي',addBioPrompt:'أضف نبذة',heightWeight:'الطول / الوزن',
    noObjective:'لا يوجد',noBadgeYet:'لم تحصل على أي وسام بعد — حصتك الأولى ستقربك من وسام المبتدئ.',
    seeAllProgress:'{0} / {1} · عرض الكل',nextBadgeLab:'الوسام القادم · {0}',
    account:'الحساب',friendsRanking:'الأصدقاء والترتيب',manageProfile:'إدارة الملف الشخصي',passwordSecurity:'كلمة المرور والأمان',
    notConnected:'غير متصل',notifLabel:'الإشعارات',preferences:'التفضيلات',historyRecords:'السجل والأرقام',
    statistics:'الإحصائيات',theme:'المظهر',appColor:'لون التطبيق',simplifiedMode:'الوضع المبسّط',
    simplifiedModeDesc:'4 تبويبات، شاشات أخف، نص أكبر — الأساسيات فقط',
    support:'الدعم',helpCenter:'مركز المساعدة',footerTag:'IKORUN — Elite Athletic Intelligence · v2.0',
    yourSpace:'مساحتك',settings:'الإعدادات',badgesLabel:'الأوسمة',toolsCalc:'الأدوات والحاسبات',editMyProfile:'تعديل ملفي الشخصي',
    // --- الإحصائيات ---
    tabBilan:'الحصيلة',tabRun:'الجري',tabMuscu:'كمال الأجسام',tabTrophies:'الأوسمة',
    perWeek:'أسبوع',perMonth:'شهر',per3Month:'3 أشهر',perYear:'سنة',
    completeProfileTitle:'أكمل ملفك الشخصي',completeProfileDesc:'يُستخدم طولك ووزنك لحساب مؤشر كتلة جسمك وسعراتك واحتياجاتك.',
    chooseHeight:'اختر طولك',chooseWeight:'اختر وزنك',
    mileage:'المسافة المقطوعة',kmCumulated:'كم متراكمة',vsPrevPeriod:'مقارنة بالفترة السابقة',
    volumeTrend:'اتجاه الحجم',kmThisWeek:'كم هذا الأسبوع',eightWeeksLab:'8 أسابيع',weeksAgoLab:'قبل 8 أسابيع',
    totalTime:'الوقت الإجمالي',overPeriod:'خلال الفترة',goalReached:'تم بلوغ الهدف!',ofTarget:'{0}% من الهدف',
    kmPerSession:'كم / حصة',sessionTypesLabel:'أنواع الحصص',bestDayLab:'أفضل يوم',bestWeekLab:'أفضل أسبوع',bestMonthLab:'أفضل شهر',
    detailByType:'التفاصيل حسب النوع',last13Weeks:'آخر 13 أسبوعًا',lessLabel:'أقل',moreLabel:'أكثر',vsPrevShort:'مقارنة بالسابق',
    typeMuscu:'كمال أجسام',typeAutre:'آخر',insightsTitle:'إحصاءات',
    quickTimer:'المؤقت',lvlShort:'مستوى',
    vdotReal:'VDOT الحقيقي',sessionsRun:'حصص الجري',kmTotal:'كم إجمالية',paceZones:'مناطق الوتيرة',
    predictions:'توقعات',formFatigue:'اللياقة / التعب',personalRecords:'الأرقام الشخصية',
    chronic:'مزمن',acute:'حاد',tonnageLab:'الحمولة',prPerSession:'أفضل رقم (كغ/حصة)',totalSets:'إجمالي المجموعات',
    startFirstMuscu:'ابدأ أول حصة كمال أجسام لك!',lastSessions:'آخر الحصص',
    tomorrow:'غدًا',noUpcomingSession:'لا توجد حصة مخططة قريبًا.',addSession:'إضافة حصة',
    showRestPlan:'عرض بقية الخطة · {0} أسابيع',calendarTitle:'التقويم',calendarSub:'خطط لتقدمك',
    friendsTitle:'الأصدقاء والترتيب',tabFriendsList:'الأصدقاء',tabRank:'الترتيب',
    clubTitle:'ناديّ',tabClub:'ناديّ',myClubLab:'ناديّ',
    noClubYet:'لا نادي بعد',noClubYetDesc:'انضم إلى نادي فريقك باستخدام رمز، أو أنشئ ناديك الخاص لتجميع زملائك.',
    joinClubCta:'الانضمام إلى نادٍ',createClubCta:'إنشاء نادٍ',clubCodePlaceholder:'رمز من 6 أحرف',clubNamePlaceholder:'اسم النادي',
    joinBtn:'انضمام',clubMembersCount:'{0} عضو',copyCodeBtn:'نسخ الرمز',shareCodeHint:'شارك هذا الرمز مع زملائك لينضموا إليك.',
    clubXpRanking:'ترتيب النادي (نقاط الخبرة)',leaveClubBtn:'مغادرة النادي',confirmLeaveClub:'مغادرة هذا النادي؟ يمكنك الانضمام إلى نادٍ آخر في أي وقت.',
    clubCreatedToast:'تم إنشاء النادي!',clubJoinedToast:'مرحبًا بك في النادي!',clubLeftToast:'لقد غادرت النادي',clubNotFoundToast:'لا يوجد نادٍ بهذا الرمز',
    tooManyAttemptsToast:'محاولات كثيرة جدًا، أعد المحاولة بعد قليل',codeCopiedToast:'تم نسخ الرمز',
    clubPlanTitle:'خطة النادي',clubPlanNoneOwner:'لا توجد خطة مشتركة بعد. اختر خطتك في IKORUN أو إحدى خططك الشخصية ليتدرب النادي كله معًا.',clubPlanNoneMember:'لم ينشر منشئ النادي خطة مشتركة بعد.',
    clubPlanConfigureBtn:'إعداد خطة النادي',clubPlanEditBtn:'تعديل خطة النادي',clubPlanNoUpcoming:'لا توجد حصص قادمة في هذه الخطة.',
    clubPlanSourceLabel:'أي خطة تريد مشاركتها؟',clubPlanSourceGenerated:'خطتي في IKORUN',clubPlanSourceCustom:'إحدى خططي الشخصية',
    clubPlanNoGeneratedYet:'ليس لديك خطة IKORUN مُولَّدة بعد. اذهب إلى رياضة لإنشاء واحدة، ثم عد إلى هنا.',clubPlanNoCustomYet:'ليس لديك خطة شخصية بعد. أنشئ واحدة من رياضة > خطة شخصية.',
    clubPlanSessionsCount:'{0} حصة مبرمجة',clubMeetupLabel:'مكان التجمّع',clubMeetupModeSlot:'الوقت والمكان',clubMeetupModeText:'وصف حر',
    clubMeetupTimeLabel:'الوقت',clubMeetupPlaceLabel:'المكان',clubMeetupPlacePh:'مثال: الحديقة المركزية، المدخل الشمالي',
    clubMeetupTextLabel:'الوصف',clubMeetupTextPh:'مثال: نلتقي أمام البلدية، انضم عندما تستطيع...',
    clubPlanPublishBtn:'نشر',clubPlanRemoveBtn:'إزالة خطة النادي',clubPlanPublishedToast:'تم نشر خطة النادي!',clubPlanRemovedToast:'تمت إزالة خطة النادي',
    clubPlanRemoveConfirm:'إزالة الخطة ومكان التجمّع من النادي؟ لن يراهما الأعضاء بعد الآن.',
    loginToAddFriends:'سجّل الدخول عبر Google لإضافة أصدقاء ومقارنة نفسك.',
    searchFriendPlaceholder:'ابحث عن صديق بالاسم المستعار',receivedRequests:'الطلبات الواردة',acceptBtn:'قبول',
    yourFriendsCount:'أصدقاؤك ({0})',noFriendsYet:'لا يوجد أصدقاء بعد — ابحث عن أحدهم باسمه المستعار!',
    sentRequests:'الطلبات المرسلة',awaitingResponse:'بانتظار الرد…',xpRanking:'ترتيب نقاط الخبرة بين الأصدقاء',
    addFriendsUnlock:'أضف أصدقاء لفتح الترتيب!',youParen:' (أنت)',
    searchingLab:'جارٍ البحث…',loginToSearchFriends:'سجّل الدخول للبحث عن أصدقاء',noUsernameFound:'لم يتم العثور على اسم مستعار',
    loadingLab:'جارٍ التحميل…',friendsLoadError:'تعذّر تحميل أصدقائك. تحقّق من اتصالك.',retryBtn:'إعادة المحاولة',
    resumeBtn:'استئناف',discardBtn:'التخلي',
    alreadyLinked:'مرتبط بالفعل',addBtn:'إضافة',searchError:'خطأ في البحث',alreadySentOrFriend:'تم الإرسال بالفعل أو صديق بالفعل',
    requestSent:'تم إرسال الطلب',friendProfileTitle:'الملف الشخصي',removeLab:'إزالة',lvlDot:'مستوى',kmThisWeekShort:'{0} كم هذا الأسبوع',youDefaultName:'أنت',backToFriends:'العودة إلى الأصدقاء',profileNotFound:'الملف غير موجود.',noBadgeUnlocked:'لا يوجد وسام مفتوح بعد.',kmPerWeek:'كم/أسبوع',daysStreak:'أيام متتالية',kmTotalLab:'كم إجمالية',tonnageKgLab:'الحمولة كغ',
    addPerf:'إضافة أداء',addChronosHint:'أضف أوقاتك: تُستخدم لحساب VDOT وخطتك.',
    bestPerf:'أفضل أداء',avgHR:'متوسط النبض',maxHRshort:'الأقصى',perfHistoryTitle:'سجل الأداء',
    chooseDistance:'اختر المسافة',otherDist:'أخرى',customDistance:'مسافة مخصصة',
    chronoLab:'الوقت *',chronoFor:'وقت {0}',dateField:'التاريخ',placeOptional:'المكان (اختياري)',
    placeholderPlace:'مكان السباق',feelOptional:'الإحساس (اختياري)',feelPlaceholder:'كيف كان الأداء؟',
    officialComp:'مسابقة رسمية',saveThisPerf:'حفظ هذا الأداء',backBtn:'رجوع',
    perfAddedComp:'تمت إضافة الأداء · +XP مسابقة',perfAdded:'تمت إضافة الأداء',
    editProfileTitle:'تعديل الملف الشخصي',usernameLab:'اسم المستخدم',usernameHint:'يُستخدم من قبل أصدقائك للعثور عليك',
    firstNameLab:'الاسم الأول',cityLab:'المدينة',birthDateLab:'تاريخ الميلاد',heightCmLab:'الطول (سم)',weightKgLab:'الوزن (كغ)',
    kmWeekLab:'كم / أسبوع',compDateLab:'تاريخ السباق',coachLab:'المدرب',saveBtn:'حفظ',
    filterAll:'الكل',filterObtained:'مكتسبة',filterLocked:'مغلقة',badgesObtainedCount:'{0} / {1} وسام مكتسب',
    badgeDetailTitle:'تفاصيل الوسام',tierOf:'المستوى {0} من {1}',newBadgeUnlocked:'وسام جديد مفتوح',
    tapToContinue:'اضغط للمتابعة',seeDetails:'عرض التفاصيل',tapToClose:'اضغط للإغلاق',previewLocked:'معاينة · مغلق',
    obtainedOn:'تم الحصول عليه في {0}',lockedLab:'مغلق',replayAnim:'إعادة الرسوم المتحركة',seePreview:'عرض معاينة',
    obtainConditions:'شروط الحصول',globalProgress:'التقدم الإجمالي',shareBadgeBtn:'مشاركة هذا الوسام',closeLab:'إغلاق',
    weightLab:'الوزن',imcLab:'كتلة الجسم',imcUnderweight:'نحافة',imcNormal:'طبيعي',imcOverweight:'زيادة وزن',imcObese:'سمنة',
    sessionsPerWeek:'حصص/أسبوع',metabolismKcal:'الأيض كالوري',burned7d:'محروقة 7 أيام (جري)',waterPerDay:'الماء/يوم',
    recentFormTitle:'اللياقة الأخيرة (آخر 7 حصص)',sleepLab:'النوم',energyFeelLab:'الطاقة/الإحساس',fatigueLab:'التعب',
    tipBalanced:'كل شيء متوازن، واصل هكذا!',tipHighFatigue:'تعب مرتفع: امنح الأولوية للراحة والنوم هذا الأسبوع.',
    tipLowSleep:'نومك غير كافٍ: استهدف 8 ساعات لتتعافى بشكل أفضل.',tipGreatFeel:'إحساس رائع: يمكنك الدفع أكثر قليلاً!',
    noDebriefHint:'أنهِ حصصك مع تقييمها لمتابعة نومك وتعبك وتعافيك هنا.',
    nutritionTitle:'معايير التغذية (رياضي)',proteinLab:'بروتين',carbsLab:'كربوهيدرات',fatLab:'دهون',kcalTarget:'كالوري مستهدف',
    weightPickerTitle:'وزنك (كغ)',weightSaved:'تم حفظ الوزن',
    labHint:'أدخل <b>قيمتين</b> تعرفهما. القيمتان الأخريان تُحسبان تلقائيًا.',
    distField:'المسافة',timeField:'الوقت',paceField:'الوتيرة',speedField:'السرعة',calculatedLab:'محسوب',toFillLab:'يجب إدخاله',
    resetBtn:'إعادة تعيين',splitTimesTitle:'أوقات المرور',
    vdotToolTitle:'VDOT (جاك دانيلز)',physioEstimates:'تقديرات فسيولوجية',vo2maxEst:'VO₂max المقدر',
    thresholdPace:'وتيرة عتبة اللاكتات',marathonPace:'وتيرة الماراثون',halfPace:'وتيرة نصف الماراثون',efPace:'وتيرة سهلة',
    vdotAutoTip:'يتحدث VDOT الخاص بك تلقائيًا من أرقامك. أضف أوقاتك في الملف الشخصي ← الأرقام.',
    waterNeedsTitle:'احتياجات الماء',dailyRest:'يوميًا (راحة)',perRunHour:'لكل ساعة جري',perHeatHour:'في الحر الشديد (+/ساعة)',
    hydraTip:'اشرب بانتظام رشفات صغيرة. راقب لون بولك.',
    basalMetabolism:'الأيض الأساسي (كالوري/يوم)',needsByActivity:'الاحتياجات حسب النشاط',
    actSedentary:'خامل',actLight:'خفيف',actModerate:'معتدل',actIntense:'مكثف',actAthlete:'رياضي',
    valueField:'القيمة',fromField:'من',toField:'إلى',
    quickNotesTitle:'ملاحظات سريعة',notesPlaceholder:'اكتب هنا... (حفظ تلقائي)',autoSaveLocal:'حفظ تلقائي محلي.',
    lapBtn:'شوط',stopBtn:'إيقاف',resetBtn2:'إعادة تعيين',bestLap:'أفضل شوط',slowestLap:'الأبطأ',avgLap:'المتوسط',lapsLab:'الأشواط',
    exportBtn:'تصدير',fastTag:'سريع',slowTag:'بطيء',lapsCopied:'تم نسخ الأشواط',
    addEventBtn:'إضافة حدث',competitionDefault:'مسابقة',noEventLab:'لا يوجد حدث',pastLab:'مضى',
    eventTitlePrompt:'عنوان الحدث:',eventDatePrompt:'التاريخ (YYYY-MM-DD):',eventAdded:'تمت إضافة الحدث',
    prayerTitle:'الصلوات · بجاية',uoifMethod:'طريقة UOIF · {0}',
    obWelcomeTitle:'مرحبًا بك في IKORUN',obWelcomeIntro:'Elite Athletic Intelligence.<br>تدريبك الشخصي، محسوب علميًا، بدون اتصال 100%.',
    obWhoTitle:'من أنت؟',obWhoIntro:'معلوماتك الأساسية.',firstNamePh:'اسمك الأول',firstNameReq:'الاسم الأول *',
    usernameReq:'اسم المستخدم *',usernamePh:'اسم_مستخدم_فريد',
    birthDateReq:'تاريخ الميلاد *',sexReq:'الجنس *',selectLab:'اختر',maleLab:'ذكر',femaleLab:'أنثى',
    obLevelTitle:'مستواك',obLevelIntro:'كن صادقًا، الخطة تتكيف.',
    levelNote:'يعدّل <b>المستوى</b> شدة خطتك وحجم تدريبك، محسوبان تلقائيًا. غير متأكد؟ اضغط <b>«كيف أختار؟»</b>.',
    levelReq:'المستوى *',howChooseLab:'كيف أختار؟',
    lvlBeginner:'مبتدئ',lvlIntermediate:'متوسط',lvlAdvanced:'متقدم',lvlVeryAdvanced:'متقدم جدًا',lvlElite:'نخبة',
    obGoalTitle:'هدفك',obGoalIntro:'ما الذي يجعلك تجري.',goalReq:'الهدف *',goalPh:'مثال: أقل من 20:00 في 5 كم',
    compDateReq:'تاريخ السباق *',coachOptional:'المدرب — اختياري',coachPh:'اسم مدربك',
    obPerfTitle:'أداؤك',obPerfIntro:'أضف أفضل أوقاتك. مطلوب واحد على الأقل.',
    perfNote:'تحسب أوقاتك <b>VDOT</b> (قدرتك) وكل <b>وتيرات تدريبك</b>. أعط وقتًا واحدًا حديثًا وموثوقًا على الأقل. اختر المسافة ثم الوقت بالعجلات.',
    addAnotherPerf:'إضافة أداء آخر',backLab:'رجوع',continueLab:'متابعة',
    paramsTitle:'الإعدادات',libTitle:'المكتبة',configureTitle:'تهيئة',programTitle:'البرنامج',sessionTitle:'الحصة',
    newProgramTitle:'برنامج جديد',homeDefault:'الرئيسية',chooseLab:'اختر',validateLab2:'تأكيد',
    understoodLab:'فهمت',howChooseLevelTitle:'كيف أختار مستواي؟',
    lvlBeginnerDesc:'تجري منذ أقل من سنة. تتدرب أحيانًا وما زلت تتعلم الأساسيات.',
    lvlIntermediateDesc:'تجري بانتظام، تشارك أحيانًا في مسابقات وتتقن أنواع الحصص الرئيسية.',
    lvlAdvancedDesc:'عدة سنوات من التدريب، ممارسة منظمة وأهداف زمنية دقيقة.',
    lvlVeryAdvancedDesc:'تدريب مكثف، عدة مسابقات في السنة، مستوى إقليمي أو وطني جيد جدًا.',
    lvlEliteDesc:'رياضي محترف: أداء وطني/دولي، تدريب يومي بحجم كبير جدًا.',
    checkingLab:'جارٍ التحقق…',
    fillRequiredFields:'املأ الحقول المطلوبة',chooseUsernameLab:'اختر اسم مستخدم',usernameUnavailable:'اسم المستخدم هذا غير متاح',
    quickProfileEnabled:'تم تفعيل الملف السريع — تم تفعيل الوضع المبسّط',chooseLevelLab:'اختر مستوى',goalDateRequired:'الهدف والتاريخ مطلوبان',addAtLeastOnePerf:'أضف أداءً واحدًا على الأقل',
    finishLab:'إنهاء',distanceLab2:'المسافة',timeForLab:'الوقت · {0}',chooseWord:'اختر',
    usernameTakenMeanwhile:'تم أخذ الاسم المستعار في هذه الأثناء، غيّره من الملف الشخصي',
    liveFinishBtn:'إنهاء',durationLab:'المدة',volumeLab:'الحجم',setsLab:'المجموعات',deleteLab2:'حذف',
    exerciseDoneLab:'منتهٍ',setsDoneCount:'{0}/{1} مجموعة منجزة',restTimerLab:'مؤقت الراحة: {0}',disabledLab:'معطّل',
    setCol:'مجموعة',prevCol:'السابق',kgCol:'كغ',repsCol:'تكرار',addSetBtn:'إضافة مجموعة',
    addExerciseBtn:'إضافة تمرين',cancelSessionBtn:'إلغاء الحصة',
    restSeconds:'الراحة (ثوانٍ)',minOneSetRemain:'يجب أن تبقى مجموعة واحدة على الأقل',changeRestLab:'تعديل وقت الراحة',
    removeExLab:'إزالة هذا التمرين',cancelLab:'إلغاء',minOneExRemain:'يجب أن يبقى تمرين واحد على الأقل',
    removeExConfirmTitle:'إزالة هذا التمرين؟',removeLab2:'إزالة',exerciseRemoved:'تمت إزالة التمرين',
    exercisesReordered:'تم تحديث ترتيب التمارين',
    exerciseAdded:'تمت إضافة التمرين',sessionSaved:'تم حفظ الحصة — استأنفها متى شئت',xpGain:'+5 XP',
    restTitle:'راحة',secLab:'ثا',add30sLab:'+30 ثا',skipLab:'تخطي',cancelSessionTitle:'إلغاء الحصة؟',
    progressLostText:'سيُفقد تقدمك في هذه الحصة.',continueLab2:'متابعة',yesCancelLab:'نعم، إلغاء',sessionCancelled:'تم إلغاء الحصة',
    sessionDoneTitle:'انتهت الحصة!',tonnageParenKg:'الحمولة (كغ)',repsLab:'التكرارات',caloriesLab:'السعرات',recordsBrokenLab:'أرقام محطّمة',
    tonnageVsLastLab:'حمولة مقارنة بآخر حصة {0}.',newRecordsLab:'أرقام جديدة',musclesWorkedLab:'العضلات المستهدفة',xpEarnedLab:'+50 XP مكتسبة!',
    programNameLab:'اسم البرنامج',programNamePh:'برنامجي',descriptionLab:'الوصف',descriptionPh:'الهدف، التقسيم، التكرار...',
    objectiveLab2:'الهدف',iconLab:'الأيقونة',colorLab:'اللون',exercisesCountLab:'التمارين ({0})',addExFromLib:'أضف تمارين من المكتبة.',
    addFromLibBtn:'إضافة من المكتبة',saveProgramBtn:'حفظ البرنامج',giveNameLab:'أعطه اسمًا',addExercisesLab:'أضف تمارين',programCreated:'تم إنشاء البرنامج',
    sessTitle_EF:'التحمل الأساسي',sessLabel_EF:'سهل',
    sessTitle_RECUP:'استرجاع نشط',sessLabel_RECUP:'استرجاع',
    sessTitle_LONG:'الخرجة الطويلة',sessLabel_LONG:'طويل',progressiveSuffix:' تصاعدية',
    sessTitle_TEMPO:'تيمبو',sessLabel_TEMPO:'تيمبو',
    sessTitle_TEMPO_SPE:'تيمبو بوتيرة السباق',sessLabel_TEMPO_SPE:'تيمبو وتيرة',
    sessTitle_SEUIL:'حصة العتبة',sessLabel_SEUIL:'عتبة',
    sessTitle_DBLSEUIL:'العتبة المزدوجة (الطريقة النرويجية)',sessLabel_DBLSEUIL:'عتبة مزدوجة',
    sessTitle_VMAc:'سرعة قصوى قصيرة',sessLabel_VMAc:'سرعة قصيرة',
    sessTitle_VMAl:'سرعة قصوى طويلة',sessLabel_VMAl:'سرعة طويلة',
    sessTitle_VO2:'حصة VO₂max',sessLabel_VO2:'VO₂max',
    sessTitle_INTERVAL:'فترات مختلطة',sessLabel_INTERVAL:'فترات',
    sessTitle_SPE:'وتيرة السباق',sessLabel_SPE:'وتيرة السباق',
    sessTitle_PROGRESSIF:'جري تصاعدي',sessLabel_PROGRESSIF:'تصاعدي',
    sessTitle_FARTLEK:'فارتلك (لعب الوتيرة)',sessLabel_FARTLEK:'فارتلك',
    sessTitle_COTES:'حصة المرتفعات',sessLabel_COTES:'مرتفعات',
    sessTitle_LIGNES:'جري سهل + خطوط تسريع',sessLabel_LIGNES:'خطوط',
    sessTitle_COURSE:'يوم السباق',sessLabel_COURSE:'السباق',
    sessTitle_default:'تحمل',sessLabel_default:'سهل',
    phase_PG:'التحضير العام',phase_AERO:'تطوير التحمل الهوائي',phase_VO2:'تطوير VO₂max',
    phase_SPE:'التطوير النوعي',phase_PIC:'ذروة اللياقة',phase_TAPER:'تخفيف الحمل',
    bdg_debutant_name:'مبتدئ',bdg_debutant_desc:'بداية مغامرة IKORUN.',
    bdg_amateur_name:'هاوٍ',bdg_amateur_desc:'بدأت تأخذ الإيقاع.',
    bdg_sportif_name:'رياضي',bdg_sportif_desc:'أصبح التدريب عادة.',
    bdg_athlete_name:'رياضي محترف',bdg_athlete_desc:'تتقدم بجدية.',
    bdg_expert_name:'خبير',bdg_expert_desc:'إتقان حقيقي لتدريبك.',
    bdg_elite_name:'نخبة',bdg_elite_desc:'تحسن مستمر.',
    bdg_maitre_name:'أستاذ',bdg_maitre_desc:'تتقن جسدك وعقلك.',
    bdg_legende_name:'أسطورة',bdg_legende_desc:'أصبحت مرجعًا.',
    tierBronze:'برونزي',tierArgent:'فضي',tierOr:'ذهبي',tierPlatine:'بلاتيني',tierDiamant:'ماسي',tierMaitre:'أستاذ',tierLegende:'أسطورة',
    medalCatSeances:'الحصص',medalCatRegularite:'الانتظام',medalCatDistance:'المسافة',
    daysLab:'أيام',continueUnlockBadges:'واصل لفتح أوسمتك',    ach_premiere_name:'أول سباق',ach_premiere_desc:'أنهِ السباق الذي كنت تُحضّر له.',
    ach_cinqk_name:'5 كم',ach_cinqk_desc:'اجرِ أكثر من 5 كم دفعة واحدة.',
    ach_dixk_name:'10 كم',ach_dixk_desc:'اجرِ أكثر من 10 كم دفعة واحدة.',
    ach_serie_name:'سلسلة',ach_serie_desc:'حافظ على الانتظام لمدة شهر (30 يومًا متتاليًا).',
    ach_denivele_name:'ارتفاع',ach_denivele_desc:'أكثر من 200 م ارتفاعًا في حصة أو سباق.',
    ach_podium_name:'منصة التتويج',ach_podium_desc:'أنهِ ضمن أفضل 3 في سباق.',
    ach_objectif_name:'الهدف محقق',ach_objectif_desc:'حقق وقتك المستهدف (أو أسرع) في السباق الذي حضّرت له.',
    ach_nouveaupb_name:'رقم شخصي جديد',ach_nouveaupb_desc:'حطّم رقمًا جديدًا بـ VDOT أعلى من رقمك السابق.',
    ach_allure_name:'الوتيرة',ach_allure_desc:'اجرِ 3 كم على الأقل بوتيرة 10:00/كم أو أسرع.',
    ach_endurance_name:'التحمل',ach_endurance_desc:'أنهِ خرجة لا تقل عن 15 كم.',
    ach_puissance_name:'القوة',ach_puissance_desc:'قم بـ 3 حصص كمال أجسام على الأقل في أسبوع واحد.',
    ach_vo2max_name:'VO2 Max',ach_vo2max_desc:'حقق VO\u2082max مقدر أعلى من 50.',
    ach_force_name:'قوة',ach_force_desc:'ارفع أكثر من 20,000 كغ إجمالاً في أسبوع واحد.',
    catAccomplissement:'إنجاز',catPerformance:'أداء',allYearsLab:'الكل',
    tapTrophyHint:'اضغط على وسام لرؤية الرسوم المتحركة أو الشرط لتحقيقه.',
    noTrophyInYear:'لم يتم الحصول على وسام في {0}.',badgeUnlockedToast:'تم فتح {0}!',badgeRemovedToast:'تمت إزالة الوسام',
    objForce:'قوة',objMass:'كتلة',objEndurance:'تحمل',objWeightLoss:'فقدان وزن',objMaintain:'محافظة',
    colBlue:'أزرق',colRed:'أحمر',colGreen:'أخضر',colGold:'ذهبي',colPurple:'بنفسجي',colCyan:'سماوي',
    newTrophyUnlocked:'وسام جديد مفتوح',
    markAsObtained:'وضع علامة كمُحقق',
    connectingGoogle:'جارٍ الاتصال بـ Google…',googleConnectFail:'تعذر الاتصال، أعد المحاولة',googleNotWorkingLink:'لا يعمل؟',googleReturnedNoSessionToast:'لم تكتمل عملية الدخول عبر Google. أعد المحاولة، أو استخدم البريد الإلكتروني / وضع الضيف.',
    confirmLogout:'تسجيل الخروج؟ بياناتك تبقى محفوظة في حسابك.',
    confirmSwitchGoogle:'سيتم تسجيل خروجك لتسجيل الدخول بحساب Google آخر. بياناتك الحالية تبقى محفوظة.',
    confirmDeleteAllData:'سيؤدي هذا إلى حذف جميع بياناتك (الحصص، الأرقام القياسية، XP، الملف الشخصي...) نهائيًا من السحابة ومن هذا الجهاز. متابعة؟',
    confirmFinalIrreversible:'تأكيد أخير: هل أنت متأكد حقًا؟ هذا الإجراء لا رجعة فيه.',
    genericErrorRetry:'خطأ، أعد المحاولة',
    confirmRemoveFriend:'إزالة هذا الصديق؟',
    connectFirst:'سجّل الدخول أولاً',copiedClipboard:'تم النسخ',
    usernameFormatHint:'3 إلى 20 حرفًا: أحرف، أرقام، _',checkingEllipsis:'جارٍ التحقق…',
    available:'متاح',alreadyTaken:'مُستخدم بالفعل',
    alarmDefaultTitle:'منبّه',timeUpMsg:'انتهى الوقت!',timeUpTitle:'انتهى الوقت!',
    stopAlarm:'إيقاف المنبّه',remindIn5Min:'تذكير بعد 5 دقائق',reminderCap:'تذكير',fiveMinElapsed:'مرت 5 دقائق',
    sessionInProgress:'الحصة جارية',welcomeToast:'مرحبًا',
    resumeSessionConfirm:'كانت حصة « {0} » جارية ({1} د). المتابعة؟',sessionColonName:'حصة: {0}',
    accentBlue:'أزرق',accentRed:'أحمر',accentGreen:'أخضر عسكري',accentBrown:'بني خشبي',accentYellow:'أصفر',accentCarbon:'ألياف الكربون',
    colorApplied:'تم تطبيق اللون',easyModeOn:'تم تفعيل الوضع المبسّط',easyModeOff:'تم إلغاء الوضع المبسّط',
    profileIncompleteAddTime:'الملف غير مكتمل: أضف زمنًا في أرقامك القياسية',chooseCompDate:'اختر تاريخ المنافسة',
    planGenerated:'تم إنشاء خطة « {0} »: {1} أسبوع، {2} حصة',raceGeneric:'سباق',
    followingPersoPlan:'أنت الآن تتبع هذه الخطة الشخصية',backToIkorunPlan:'العودة إلى خطة IKORUN',
    namePromptLabel:'الاسم:',copySuffix:'(نسخة)',confirmDeletePlan:'حذف هذه الخطة؟',
    addAtLeastOneRepTime:'أضف زمنًا واحدًا على الأقل للتكرار',sessionAdded:'تمت إضافة الحصة',
    myPlanColon:'خطتي: {0}',shareNotSupported:'المشاركة غير مدعومة',confirmDeleteProgram:'حذف هذا البرنامج؟',
    routineTitle:'روتين',exercisesCount:'{0} تمارين',exercisesCap:'تمارين',setsCap:'مجموعات',estDurationCap:'المدة التقديرية',
    setsRepsLine:'{0} مجموعات · {1} تكرار',addExercise:'إضافة تمرين',startWorkout:'بدء التمرين',
    defaultProgramsNotEditable:'لا يمكن تعديل البرامج الافتراضية',
    heightCmTitle:'الطول (سم)',weightKgTitle:'الوزن (كغ)',heightSaved:'تم حفظ الطول',weightSaved:'تم حفظ الوزن',
    deservedBreak:'استراحة مستحقة!',backToWork:'عودة للعمل!',setDuration:'اضبط مدة',
    photoUpdated:'تم تحديث الصورة',photoRemoved:'تمت إزالة الصورة',bioPromptLabel:'نبذتك:',
    usernameInvalid:'اسم مستخدم غير صالح (3-20، أحرف/أرقام/_)',usernameNotAvailable:'هذا الاسم غير متاح',
    usernameJustTaken:'تم أخذ هذا الاسم للتو، اختر اسمًا آخر',usernameUpdated:'تم تحديث اسم المستخدم',
    profileUpdated:'تم تحديث الملف الشخصي',localDataOnly:'بيانات محلية فقط',exportGenerated:'تم إنشاء التصدير',
    confirmClearAll:'مسح كل شيء؟ هذا الإجراء لا رجعة فيه.',confirmClearAllFinal:'متأكد حقًا؟ ستفقد جميع بياناتك.',
    offlineSinceDays:'غير متصل منذ {0} يوم — تذكّر إعادة الاتصال',dataSynced:'تمت مزامنة البيانات',
    connectionRestored:'تمت استعادة الاتصال · مزامنة…',offlineModeAvailable:'وضع عدم الاتصال — كل شيء يبقى متاحًا',
    dataImported:'تم استيراد البيانات',invalidFile:'ملف غير صالح',
    searchExercisePlaceholder:'ابحث عن تمرين...',muscleLabel:'العضلة',equipmentLabel:'المعدات',levelLabel:'المستوى',
    exercisesWordPlural:'تمارين',exerciseWordSingular:'تمرين',
    movementDemoCap:'عرض توضيحي للحركة',movementDemo:'عرض توضيحي للحركة',
    musclesWorked:'العضلات المستهدفة',primaryLabel:'الأساسية',secondaryLabel:'الثانوية',
    stepByStepExecution:'التنفيذ خطوة بخطوة',breathingLabel:'التنفس',commonMistakesLabel:'أخطاء شائعة',
    coachTipsLabel:'نصائح المدرب',safetyLabel:'السلامة',variantsLabel:'بدائل',addToProgram:'إضافة إلى البرنامج',
    exTabExercise:'التمرين',exTabMuscles:'العضلات',exTabInstructions:'التعليمات',aboutExerciseTitle:'حول هذا التمرين',
    exWorksMainly:'يستهدف <b style="color:var(--snow)">{0}</b> بشكل رئيسي {1}',
    exWorksAlsoSecondary:'، بالإضافة إلى {0} كعضلات ثانوية',severalMuscleGroups:'عدة مجموعات عضلية',
    restBetweenSetsLabel:'الراحة بين المجموعات',volumeCap:'الحجم',durationCap:'المدة',
    targetedMusclesTitle:'العضلات المستهدفة',primaryMusclesLabel:'العضلات الأساسية',secondaryMusclesLabel:'العضلات الثانوية',
    frontViewLabel:'أمامي',backViewLabel:'خلفي',
    muscleHeatmapTitle:'العضلات الأكثر تدريبًا',lessLab:'أقل',moreLab:'أكثر',mostTrainedLab:'الأكثر تدريبًا: {0}',noMuscleDataLab:'أنهِ حصة تقوية لترى خريطة تحميل عضلاتك تظهر.',
    executionLabel:'التنفيذ',defaultExecutionHint:'نفّذ الحركة بشكل متحكم به، بمدى حركة كامل.',
    adviceLabel:'نصائح',startLabel:'بدء',
    exBreathGeneric:'استنشق أثناء المرحلة السلبية (النزول/التمدد)، وازفر أثناء المجهود (الدفع/الانقباض).',
    exStep1:'وضعية البداية: اتخذ وضعية صحيحة، شد عضلات الجذع، ونظرة محايدة.',
    exStep2:'اقبض العضلات المستهدفة قبل بدء الحركة.',
    exStep3:'نفّذ المرحلة الإيجابية بشكل متحكم به، دون حركات مفاجئة.',
    exStep4:'توقف لحظة قصيرة عند أقصى انقباض.',
    exStep5:'عد ببطء مع التحكم في المرحلة السلبية (2-3 ثوانٍ).',
    exMistakeGeneric1:'استخدام وزن ثقيل جدًا على حساب التقنية.',
    exMistakeGeneric2:'عدم استخدام مدى حركة كامل (حركة قصيرة جدًا).',
    exMistakeGeneric3:'استخدام الاندفاع / الغش بواسطة الظهر.',
    exMistakeGeneric4:'الذهاب بسرعة زائدة وإهمال المرحلة السلبية.',
    exTipGeneric1:'ركّز على الاتصال العقلي العضلي: اشعر بالعضلة وهي تعمل.',
    exTipGeneric2:'ابقَ عند 2-3 تكرارات احتياطية للتقدم بأمان.',
    exTipGeneric3:'حافظ على تنفيذ نظيف في كل تكرار.',
    exSafety1:'سخّن بمجموعات خفيفة قبل المجموعات الثقيلة.',
    exSafety2:'حافظ على استقامة الظهر، ولا تُقفل المفاصل بالكامل أبدًا.',
    exSafety3:'توقف فورًا في حال الشعور بألم مفصلي حاد.',
    wuTemplate:'15-20 دقيقة ركض هادئ بوتيرة {0}/كم + 4-5 انطلاقات تدريجية + تمارين تحضيرية (رفع الركبتين، لمس الكعبين للأرداف، قفزات اندفاعية).',
    cdTemplate:'10-15 دقيقة ركض بطيء جدًا بوتيرة {0}/كم + تمدّدات خفيفة.',
    recovLabel_2minTrot:'هرولة دقيقتين',recovLabel_1minTrot:'هرولة دقيقة',recovLabel_30sTrot:'هرولة 30 ثانية',recovLabel_2to3minTrot:'هرولة 2-3 دقائق',recovLabel_90sTrot:'هرولة 90 ثانية',
    repsTextTemplate:'{0} × {1} م بزمن {2} ({3}/كم)',seriesPyramid:'هرمي {0}←{1} م',seriesRepsDist:'{0} × {1} م بزمن {2}',seriesRepsOnly:'{0} × مجهودات',
    deloadPrefixTemplate:'أسبوع تخفيف — {0}',
    bs_ef_objectif:'بناء قاعدتك الهوائية — أساس كل تقدم (80% من حجم تدريب النخبة).',
    bs_ef_warmup:'إحماء تدريجي لمدة 10 دقائق.',bs_ef_body:'{0} كم بوتيرة سهلة ({1}/كم). يمكنك التحدث طوال الوقت.',
    bs_ef_paces:'المنطقة 2، ~70% من أقصى معدل ضربات القلب — {0}/كم.',bs_ef_recovery:'مجهود متواصل.',bs_ef_cooldown:'بعض تمارين تمدد لعضلات الساق الخلفية وأوتار الركبة.',
    bs_ef_tip1:'تنفّس من البطن.',bs_ef_tip2:'البطء هنا مقصود ومفيد.',bs_ef_mistake1:'الركض بسرعة زائدة «بدافع العادة».',
    bs_ef_why:'يطوّر القلب والشعيرات الدموية والميتوكوندريا دون إرهاق أو مخاطرة.',
    bs_recup_objectif:'تسريع التعافي بين حصتين شاقتين.',bs_recup_warmup:'لا يوجد.',
    bs_recup_body:'{0} كم بخطى هادئة جدًا بوتيرة {1}/كم.',bs_recup_paces:'المنطقة 1 — بطيء جدًا.',bs_recup_cooldown:'تدليك ذاتي / تمارين حركية.',
    bs_recup_tip1:'إذا كنت متعبًا جدًا، استبدلها بـ 25 دقيقة مشي.',bs_recup_mistake1:'التسريع: تخرّب عملية التعافي.',
    bs_recup_why:'الدورة الدموية تُخلّص الجسم من الفضلات وتُنشّط عملية التكيّف.',
    bs_long_objectif:'تطوير التحمل واقتصادية الجري والقوة الذهنية.',bs_long_warmup:'انطلاقة تدريجية لمدة 10 دقائق.',
    bs_long_body_progressive:'{0} كم تصاعدي: النصف الأول بوتيرة {1}/كم، والنصف الثاني بتسريع حتى {2}/كم.',
    bs_long_body_steady:'{0} كم بوتيرة تحمل ثابتة ({1}/كم).',bs_long_paces:'وتيرة سهلة {0}/كم ← وتيرة الماراثون {1}/كم في النهاية.',
    bs_long_recovery:'مجهود متواصل، تزوّد بالطاقة إذا تجاوزت الحصة ساعة و15 دقيقة.',bs_long_tip1:'تناول وجبة جيدة في الليلة السابقة.',
    bs_long_tip2:'احمل معك ماءً وجل طاقة إذا تجاوزت الحصة ساعة ونصف.',
    bs_long_mistake1:'الانطلاق بسرعة زائدة والمشي في النهاية.',bs_long_why:'يزيد مخزون الغليكوجين والقدرة على استخدام الدهون كوقود.',
    bs_tempo_objectif:'تحسين الكفاءة والتحمل بوتيرة مستدامة.',
    bs_tempo_body:'{0} دقيقة متواصلة بوتيرة {1}/كم («صعبة بشكل مريح»)، أي حوالي {2} كم.',bs_tempo_paces:'~83% من السرعة الهوائية القصوى — {0}/كم.',
    bs_tempo_recovery:'كتلة متواصلة.',bs_tempo_tip1:'يجب أن تكون قادرًا على قول كلمتين أو ثلاث، وليس جملة كاملة.',bs_tempo_mistake1:'الانطلاق بسرعة زائدة والانهيار لاحقًا.',
    bs_tempo_why:'يرفع عتبة تراكم حمض اللاكتيك.',
    bs_temposp_objectif:'التعرّف على وتيرة سباقك المستهدف ({0}).',bs_temposp_body:'{0}، راحة هرولة دقيقتين بين الكتل.',
    bs_temposp_paces:'وتيرة السباق: {0}/كم.',bs_temposp_tip1:'احفظ إحساس هذه الوتيرة.',
    bs_temposp_mistake1:'الذهاب أسرع من الوتيرة المستهدفة.',bs_temposp_why:'يجب أن تصبح الوتيرة المحددة تلقائية يوم السباق.',
    bs_seuil_objectif:'رفع عتبة حمض اللاكتيك — العامل الأول للأداء.',bs_seuil_body:'{0}، راحة هرولة دقيقة.',
    bs_seuil_paces:'~88% من السرعة الهوائية القصوى — {0}/كم.',bs_seuil_recovery:'هرولة دقيقة بين كل تكرار.',bs_seuil_tip1:'جميع التكرارات بنفس الوتيرة.',
    bs_seuil_mistake1:'الانطلاق بقوة زائدة في التكرار الأول.',bs_seuil_why:'العتبة هي الوتيرة التي يمكن الحفاظ عليها لساعة تقريبًا؛ رفعها يسهّل كل شيء آخر.',
    bs_dblseuil_objectif:'زيادة حجم التدريب عند العتبة دون إرهاق مفرط (المفتاح النرويجي).',
    bs_dblseuil_warmup:'{0} (×2: مرة صباحًا ومرة مساءً)',
    bs_dblseuil_body:'صباحًا: {0} × {1} دقيقة بوتيرة {2}/كم (راحة دقيقة). مساءً: {3} (راحة 30 ثانية). ابقَ دون الحد الأقصى.',
    bs_dblseuil_paces:'عتبة متحكم بها {0}/كم — حمض لاكتيك ~2-4 مليمول.',bs_dblseuil_recovery:'راحة قصيرة، شدة متحكم بها.',
    bs_dblseuil_cooldown:'{0} (بعد كل حصة)',bs_dblseuil_tip1:'لا تنهِ الحصة منهكًا أبدًا: يجب أن تكون قادرًا على إعادتها.',
    bs_dblseuil_mistake1:'تحويل حصة العتبة إلى حصة VMA.',
    bs_dblseuil_why:'جرعة مضاعفة من محفز العتبة بأقل إرهاق ممكن — أسلوب عائلة إنغبريغتسن.',
    bs_dblseuil_note:'حصة المساء (الصباح = {0} × {1} دقيقة)',
    bs_vmac_objectif:'تطوير سرعة VO2max القصوى وسرعة الذروة.',bs_vmac_warmup:'{0} الإحماء إلزامي.',
    bs_vmac_body:'{0}، راحة هرولة دقيقة. (أو بديل قصير: {1} × ~{2} م سريع / {3} م هرولة، بنفس الشدة).',
    bs_vmac_paces:'~108-110% من السرعة الهوائية القصوى — استهدف {0} في كل {1} م (وليس {2}، فهي مجرد الوتيرة محسوبة لكل كم).',
    bs_vmac_recovery:'راحة هرولة دقيقة بين كل {0} م.',bs_vmac_tip1:'نفس زمن القطع في كل التكرارات: {0} لكل {1} م.',
    bs_vmac_mistake1:'إهمال الإحماء ← إصابة.',
    bs_vmac_mistake2:'الخلط بين الوتيرة المعروضة لكل كم والزمن الفعلي المطلوب على {0} م.',
    bs_vmac_why:'ينشّط VO2max والاقتصاد العصبي العضلي.',
    bs_vmal_objectif:'رفع VO2max — سعتك القصوى.',bs_vmal_body:'{0}، راحة 2-3 دقائق هرولة. (أو {1} × 1200 م).',
    bs_vmal_paces:'~95-98% من السرعة الهوائية القصوى — {0}/كم.',bs_vmal_tip1:'الانتظام أولاً وقبل كل شيء.',bs_vmal_tip2:'توقف إذا لم تعد قادرًا على الحفاظ على الوتيرة.',
    bs_vmal_mistake1:'راحة قصيرة جدًا.',bs_vmal_why:'الوقت المُمضى عند ~90-100% من VO2max يزيد قوتك الهوائية القصوى.',
    bs_interval_objectif:'عمل مختلط بين السرعة والتحمل.',bs_interval_body:'هرمي: {0}، راحة هرولة = مدة المجهود بين كل جزء.',
    bs_interval_paces:'من {0}/كم (200 م) إلى {1}/كم (800 م) — تتباطأ الوتيرة تدريجيًا مع زيادة المسافة.',
    bs_interval_recovery:'راحة نشطة تعادل مدة المجهود.',
    bs_interval_tip1:'اضبط الوتيرة حسب المسافة: كلما قصر التكرار، كانت سرعتك المطلقة أعلى.',
    bs_interval_mistake1:'تنفيذ كل شيء بنفس السرعة.',bs_interval_why:'يجمع بين عدة أنظمة طاقة.',
    bs_interval_recoveryLabel:'هرولة = مدة المجهود',
    bs_spe_objectif:'ترسيخ وتيرة سباقك الدقيقة ({0}).',bs_spe_body:'{0}، راحة 90 ثانية.',bs_spe_paces:'الوتيرة المستهدفة: {0}/كم.',
    bs_spe_tip1:'يجب أن تصبح هذه الوتيرة انعكاسًا تلقائيًا.',bs_spe_mistake1:'الذهاب بسرعة أكبر بدافع الثقة الزائدة.',
    bs_spe_why:'التخصص هو الأهم مع اقتراب موعد السباق.',
    bs_progressif_objectif:'تعلّم التسريع رغم التعب.',bs_10min_warmup:'10 دقائق بوتيرة {0}/كم.',
    bs_progressif_body:'{0} كم على 3 مراحل: {1} ← {2} ← {3}/كم.',bs_progressif_paces:'سهل ← تمبو.',bs_progressif_recovery:'متواصل.',
    bs_progressif_tip1:'كل مرحلة أسرع قليلًا من سابقتها.',bs_progressif_mistake1:'الانطلاق بسرعة زائدة.',
    bs_progressif_why:'يعزز القوة الذهنية والقدرة على تقسيم السباق تنازليًا.',
    bs_fartlek_objectif:'عمل حر ومرن يعتمد على الإحساس.',bs_fartlek_warmup:'15 دقيقة بوتيرة {0}/كم.',
    bs_fartlek_body:'{0} × (دقيقة سريعة / دقيقة بطيئة) حسب الإحساس، في الطبيعة.',bs_fartlek_paces:'سريع ≈ {0}/كم، بطيء ≈ {1}/كم.',
    bs_fartlek_recovery:'راحة نشطة حرة.',bs_fartlek_tip1:'استغل التضاريس المحيطة.',bs_fartlek_mistake1:'الإفراط في التنظيم: دع نفسك تندمج بحرية.',
    bs_fartlek_why:'ينمّي VO2max مع المتعة وكسر الروتين.',
    bs_cotes_objectif:'تطوير القوة والقدرة واقتصادية الجري.',
    bs_cotes_body:'{0} × 30-45 ثانية صعودًا (بميل 4-6%) بمجهود قوي، والراحة أثناء الهرولة نزولًا.',bs_cotes_paces:'مجهود عند ~90%.',
    bs_cotes_recovery:'الهرولة نزولًا للراحة.',bs_cotes_tip1:'خطوة قصيرة وديناميكية، وانظر للأمام.',
    bs_cotes_mistake1:'النزول بسرعة زائدة (خطر الارتطام).',bs_cotes_why:'التلال = تقوية عضلية متخصصة دون ارتطام قاسٍ.',
    bs_cotes_recoveryLabel:'هرولة نزولًا',bs_cotes_note:'30-45 ثانية من المجهود الصاعد لكل تكرار',
    bs_lignes_objectif:'الحفاظ على السرعة والنشاط (مثالي لمرحلة التخفيف).',
    bs_lignes_body:'{0} كم سهل + {1} × 80-100 م تسارع تدريجي (دون إجهاد)، راحة مشي.',
    bs_lignes_paces:'وتيرة سهلة + تسارعات مسترخية.',bs_lignes_recovery:'مشي/هرولة بين الانطلاقات.',bs_lignes_cooldown:'تمدّدات.',
    bs_lignes_tip1:'ابقَ مسترخيًا، ولا تعدُ بأقصى سرعة.',bs_lignes_mistake1:'الإفراط في الجهد خلال الانطلاقات أثناء فترة التخفيف.',
    bs_lignes_why:'يبقي الجهاز العصبي في أوج نشاطه دون إرهاق.',
    bs_course_objectif:'حقق أفضل أداء لك — الهدف: {0}!',
    bs_course_warmup:'25-30 دقيقة: ركض تدريجي + انطلاقات + 3 تسارعات بوتيرة السباق.',
    bs_course_body:'{0} كم بوتيرة {1}/كم. انطلاقة متحكم بها، ومنتصف قوي، وانتهاء بأقصى ما لديك.',bs_course_paces:'الوتيرة المستهدفة: {0}/كم.',
    bs_course_cooldown:'15 دقيقة ركض هادئ مباشرة بعد الوصول + تمدّدات.',bs_course_tip1:'لا تنطلق بسرعة زائدة.',
    bs_course_tip2:'التصق بعدّاء في مستواك.',bs_course_mistake1:'النوم أو الأكل بشكل سيء في الليلة السابقة.',
    bs_course_why:'ثمرة كل تحضيراتك. ثق بنفسك!',
    bs_default_objectif:'تحمل.',bs_default_body:'{0} كم سهل.',bs_default_why:'قاعدة هوائية.',
    avgPerKmLabel:'/كم متوسط',cooldownLabel:'العودة للهدوء',detailedPacesLabel:'الوتيرات التفصيلية',equivalentPaceLabel:'الوتيرة المكافئة',
    markCompleted:'وضع علامة منجزة',mistakesToAvoidLabel:'أخطاء يجب تجنبها',objectiveCap:'الهدف',objectiveWord:'الهدف',
    paceWarnMsg:'لا تتجاوز الوتيرة المحددة في التكرارات الأولى — من الأفضل الانتهاء بقوة بدلًا من الانطلاق بسرعة زائدة.',
    pacesLabel:'الوتيرات',recoveryColon:'الراحة:',recoveryLabel:'الراحة',repetitionsWord:'تكرارات',
    seriesPyramidTitle:'السلاسل — هرمي',sessionBodyLabel:'جوهر الحصة',sessionCompleted:'الحصة منجزة',
    targetPaceLabel:'الوتيرة المستهدفة',targetSplitLabel:'زمن القطع المستهدف',warmupLabel:'الإحماء',
    weekLabelWithNum:'الأسبوع',whySessionLabel:'لماذا هذه الحصة؟',zone2FCmaxLine:'المنطقة 2 · 70% من أقصى معدل ضربات القلب · {0}/كم',
    analyzeSessionBtn:'حلّل حصتي',autoLightenedFlag:'تم تخفيف الحصة تلقائيًا (السبب: {0} بتاريخ {1}).',
    avgPaceKmLabel:'الوتيرة المتوسطة /كم',coachAnalysisTitle:'تحليل المدرب',
    coach_adj_continue:'واصل كما هو مخطط، خطتك معايرة جيدًا.',
    coach_motiv1:'حصة إضافية في رصيدك — اللياقة تُبنى بالانتظام، لا بالإنجازات المتفرقة.',
    coach_motiv2:'أنجزت الجزء الأصعب: أنك خرجت. الباقي يتكفّل به جسدك أثناء التعافي.',
    coach_motiv3:'كل حصة تسجّلها تجعل الخطة أدقّ. أنت لا تتدرّب في الفراغ.',
    coach_motiv4:'لا أحد يتقدّم في خط مستقيم. المهم أن يصعد المنحنى على مدى الشهر.',
    coach_adj_increaseVolume:'أنت في حالة جيدة: يمكننا زيادة الحجم قليلًا الأسبوع القادم.',
    coach_adj_lighten48h:'خفّف حصتك الشاقة القادمة لمدة 48 ساعة للتعافي جيدًا.',
    coach_adj_rest:'الحصة القادمة: استبدلها بالراحة أو بركض خفيف جدًا.',
    coach_err_fatigue:'مستوى تعب مرتفع: انتبه من الإفراط في التدريب.',
    coach_err_paceMuchSlower:'وتيرة أبطأ بكثير من المخطط — تحقق إن كان السبب التعب أو الحر أو أن الوتيرة المستهدفة كانت طموحة أكثر من اللازم.',
    coach_tip_paceSlower:'أبطأ قليلاً من المخطط مع مجهود مُحسّ مرتفع: فكّر في الانطلاق بوتيرة أهدأ في المرة القادمة.',
    coach_pos_paceFaster:'أسرع من المخطط دون إجهاد نفسك: علامة جيدة على لياقتك.',
    coach_err_paceFasterTooHard:'أسرع من المخطط، لكن بمجهود مرتفع جدًا — انتبه من إرهاق نفسك قبل الحصص القادمة.',
    coach_err_harderThanPlanned:'كانت حصتك أصعب بكثير من المتوقع (RPE {0} مقابل {1} المتوقع). ربما انطلقت بسرعة زائدة أو أنك متعب.',
    coach_err_pain:'ألم {0}: لا تتجاهله. الألم المفصلي المستمر يعني الراحة.',
    coach_err_sleep:'نوم غير كافٍ: سيتأثر أداؤك وتعافيك.',
    coach_err_tooEasy:'حصة سهلة جدًا (RPE {0}): يمكنك على الأرجح بذل مجهود أكبر في المرة القادمة.',
    coach_pos_completed:'أنهيت حصتك: الانتظام هو أقوى نقاط قوتك.',
    coach_pos_feel:'إحساس ممتاز — جسمك يستجيب جيدًا للتدريب.',
    coach_pos_nopain:'لا ألم مُبلَّغ عنه: تقنيتك وحمل تدريبك مُدارَان جيدًا.',
    coach_pos_nutrition:'تغذية ممتازة، الوقود متوفر.',
    coach_pos_sleep:'نوم جيد: يمثل 50% من تعافيك، واصل كذلك.',
    coach_tip_heat:'في الحرارة الشديدة، اركض في الصباح الباكر واشرب المزيد من الماء.',
    coach_tip_hydrate:'اشرب على الأقل 0.5 لتر من الماء خلال الساعة التالية.',
    coach_tip_nutrition:'تناول الكربوهيدرات والبروتين خلال 30 دقيقة بعد المجهود.',
    coach_tip_sleep:'استهدف 8 ساعات نوم الليلة، وأغلق الشاشات قبلها بساعة.',
    constructiveCriticismTitle:'ملاحظات بنّاءة',dayNutritionLabel:'تغذية اليوم',
    debriefIntro:'أجب بصدق: سيحلل محرك IKORUN حصتك.',
    distanceKmLabel:'المسافة (كم)',distanceKmOptionalLabel:'المسافة (كم، اختياري)',
    durationMinLabel:'المدة (دقيقة)',durationMinOptionalLabel:'المدة (دقيقة، اختياري)',
    elevationGainLabel:'فرق الارتفاع الصاعد (م، اختياري)',fatigueLabel:'التعب',freeCommentLabel:'تعليق حر',
    howDidYouFeelPlaceholder:'كيف شعرت؟',ikorunAnalysisTitle:'تحليل IKORUN',
    legDayCarryoverFlag:'حصة الأرجل استهلكت عضلاتك بالفعل — خفف من التمارين الانفجارية اليوم.',
    load_goodAssimilation:'استيعاب جيد (التكرارات محترمة، RPE متحكم به) ← زيادة طفيفة في الحجم والشدة.',
    load_high:'تم رصد حمل مرتفع (حصص فائتة، RPE أعلى من المتوقع، أو تعب) ← تقليل الحجم بنحو 12% هذا الأسبوع.',
    load_stable:'حمل مستقر: تنويعات جديدة للحصص، الحجم دون تغيير.',
    missedReasonPrompt:'لماذا لم تُنجَز هذه الحصة؟',missedReplacementPrompt:'هل قمت بشيء آخر في النهاية؟',
    missedSessionTitle:'حصة فائتة',nightSleepLabel:'نوم الليلة',
    note_cardioAlreadyCounted:'تم احتساب حمل الكارديو بالفعل، الخطة لم تتغير',
    note_explosiveCaution:'توخَّ الحذر في حصتك الانفجارية القادمة',note_nextHardLightened:'تم تخفيف الحصة الشاقة القادمة',
    notedCoachBtn:'تم الفهم، أيها المدرب!',notesOptionalLabel:'ملاحظات (اختياري)',paceKmLabel:'الوتيرة /كم',painLabel:'الألم',
    paceAdherenceLabel:'هل احترمت الوتيرة؟',paceFasterOpt:'أسرع',paceAsPlannedOpt:'كما هو مخطط',paceSlowerOpt:'أبطأ قليلاً',paceMuchSlowerOpt:'أبطأ بكثير',
    moreDetailsBtn:'المزيد من التفاصيل ↓',lessDetailsBtn:'تفاصيل أقل ↑',
    planUpdatedWeekReason:'تم تحديث الخطة لهذا الأسبوع — {0}',positivePointsTitle:'نقاط إيجابية',
    recentMissesReducedMsg:'3 حصص فائتة مؤخرًا: تم تقليل حجم الأسابيع القادمة بنسبة 15%',
    repByRepSummary:'ملخص لكل تكرار — {0} × {1} م',
    repLegendLine:'= أدخل الزمن الفعلي · ✓ = «حافظت على الوتيرة» (يملأ تلقائيًا بالزمن المستهدف)',
    repNumDist:'تكرار {0} · {1} م',replacementMuscuTitle:'بديل — {0}',replacementRunTitle:'ركض بديل',
    respectedCount:'{0}/{1} محترمة',rpeFeltLabel:'RPE — الصعوبة المُحسّة:',sensationsLabel:'الإحساس',
    sessionNotedToast:'تم تسجيل الحصة',sessionTypeLabel:'نوع الحصة',targetColon:'الهدف {0}',
    upcomingAdjustmentsTitle:'تعديلات قادمة',weatherLabel:'الطقس',
    addAsGoalLabel:'إضافة كهدف',advancedLabel:'متقدم',calculateLabel:'احسب',copiedShortToast:'تم النسخ',
    copyLabel:'نسخ',customDistanceKmLabel:'مسافة مخصصة (كم)',distanceLabel:'المسافة',
    goalAddedReason:'تمت إضافة هدف',goalAddedToast:'تمت إضافة الهدف',
    ikorunDistInTime:'IKORUN — {0} كم في {1}',kmSplitsLabel:'تقسيمات الكيلومترات',myIkorunPrediction:'توقعي في IKORUN: {0} كم في {1}',
    negativeSplitLabel:'تقسيم تنازلي',paceCalculatorTitle:'حاسبة الوتيرة',paceMinSecKmLabel:'الوتيرة (دقيقة : ثانية /كم)',
    penaltySecKmLabel:'عقوبة (ثانية/كم)',predictedTimeLabel:'الزمن المتوقع',resetShortLabel:'إعادة',
    resultSavedToast:'تم حفظ النتيجة',resultsLabel:'النتائج',runCalcFirstToast:'أجرِ حسابًا أولاً',
    sleepBorderline:'حدّي — استهدف أكثر',sleepCyclesTip:'تدوم الدورة ~90 دقيقة. استهدف الاستيقاظ في نهاية دورة: 6 أو 7.5 أو 9 ساعات نوم. اخلد للنوم في وقت منتظم لتحسين التعافي.',
    sleepCyclesTitle:'دورات النوم',sleepHoursPerNightLabel:'ساعات النوم / الليلة',
    sleepInsufficient:'غير كافٍ — التعافي مُعرَّض للخطر',sleepOptimal:'مثالي للرياضي',sleepPlenty:'كثير — استمع لجسدك',
    speedLabel:'السرعة',timeHMSLabel:'الزمن (س : د : ث)',
    configurePlanTitle:'إعداد خطتي',courseProfileLabel:'طبيعة المسار',generateMyPlanBtn:'أنشئ خطتي',
    planSetupSimpleHint:'نتكفّل بالباقي (الوتيرة، المسافات، الحصص) ونعدّل كل شيء تدريجيًا مع تقدّمك.',
    maxKmWeekLabel:'أقصى كم/أسبوع (الذروة)',minKmWeekLabel:'أدنى كم/أسبوع',preferredSessionsLabel:'الحصص المفضلة (سيفضلها المدرب)',
    preparedRaceLabel:'السباق الذي تستعد له',raceDateLabel:'تاريخ السباق',targetTimeOptionalLabel:'الزمن المستهدف (اختياري)',
    trainingDaysLabel:'أيام التدريب',yourNextRaceDefault:'سباقك القادم',
    guardFutureDate:'لا يمكن تسجيل حصة بتاريخ مستقبلي.',
    sessionNotYetLabel:'هذه الحصة لم تحن بعد',guardFutureSession:'لا يمكن تسجيل إنجاز حصة لم تحن بعد',
    guardDistanceTooHigh:'مسافة غير واقعية مقارنة بتاريخك ({0} كم كحد أقصى حاليًا).',
    guardPaceTooFast:'هذه الوتيرة لا تتوافق مع VDOT الحالي ({0}). تحقق مما أدخلته.',
    guardRecordTooFast:'هذا الأداء يعني VDOT قدره {0}، بعيد جدًا عن مستواك الحالي. تحقق من زمنك.',
    guardStorageTooBig:'هذه البيانات كبيرة جدًا ولم تتم مزامنتها مع السحابة.',
    loginWelcomeTitle:'مرحبًا',loginSubConnect:'سجّل الدخول لحفظ تقدمك وحصصك وأرقامك القياسية — مُزامَنة على كل أجهزتك.',
    signupTitle:'إنشاء حساب',signupSub:'انضم إلى IKORUN لحفظ تقدمك واسترجاعه على كل أجهزتك.',
    forgotTitle:'نسيت كلمة المرور',forgotSub:'أدخل بريدك الإلكتروني، سنرسل لك رابط إعادة التعيين.',
    emailLabel:'البريد الإلكتروني',passwordLabel:'كلمة المرور',confirmPasswordLabel:'تأكيد كلمة المرور',
    emailPlaceholder:'you@email.com',
    loginBtnLabel:'تسجيل الدخول',signupBtnLabel:'إنشاء حسابي',sendResetLinkBtn:'إرسال الرابط',
    forgotPasswordLink:'نسيت كلمة المرور؟',noAccountLink:'ليس لديك حساب؟ أنشئ واحدًا',
    haveAccountLink:'لديك حساب بالفعل؟ سجّل الدخول',backToLoginLink:'العودة لتسجيل الدخول',
    orDividerLabel:'أو',continueWithGoogleBtn:'المتابعة عبر Google',
    loginLegalText:'بالمتابعة، فإنك توافق على <span class="legal-link" onclick="openProfileSection(\'terms\')">شروط الاستخدام</span> و<span class="legal-link" onclick="openProfileSection(\'privacy\')">سياسة الخصوصية</span> الخاصة بنا.<br>بياناتك مُزامَنة بأمان عبر حسابك.',
    installAppBtn:'تثبيت التطبيق',installAcceptedToast:'تم تثبيت التطبيق!',installFallbackToast:'استخدم قائمة متصفحك (أو أيقونة التثبيت في شريط العنوان) لتثبيت التطبيق.',
    iosInstallStep1:'1. اضغط على أيقونة المشاركة '+'⬆️'+' أسفل Safari.',
    iosInstallStep2:'2. مرّر لأسفل ثم اضغط على «إضافة إلى الشاشة الرئيسية».',
    androidInstallStep1:'1. اضغط على النقاط الثلاث أعلى يمين Chrome.',
    androidInstallStep2:'2. اختر «تثبيت التطبيق» (أو «إضافة إلى الشاشة الرئيسية»).',
    termsOfUseLab:'شروط الاستخدام',privacyPolicyLab:'سياسة الخصوصية',
    sessionPausedLab:'الحصة موقوفة مؤقتًا',createBtn:'إنشاء',libraryLab:'المكتبة',
    defaultProgramsLab:'البرامج الافتراضية',myCreationsLab:'إبداعاتي',
    exSetsSummary:'{0} تمارين · {1} مجموعات',exosShort:'{0} تمارين',
    loadKgLab:'الحمل (كغ)',restLab2:'الراحة',personalNotesLab:'ملاحظات شخصية (اختياري)',notesPh:'مثال: اضغط لوحي الكتف جيدًا',
    levelUpTitle:'مستوى أعلى',
    syncedCloudLab:'متزامن مع السحابة',addAccountBtn:'إضافة حساب',dangerZoneLab:'منطقة الخطر',
    deleteAccountDesc:'يحذف نهائيًا حسابك وكل بياناتك، في السحابة وعلى هذا الجهاز.',
    deleteAccountBtn:'حذف حسابي وبياناتي',
    exportImportDesc:'صدّر نسخة من بياناتك أو استورد نسخة احتياطية موجودة.',
    resetDesc:'يمسح كل بيانات التطبيق على هذا الجهاز.',
    profilePhotoTitle:'صورة الملف الشخصي',choosePhotoLab:'اختر صورة ملفك الشخصي:',fromGalleryBtn:'من المعرض',
    takePhotoBtn:'التقاط صورة',removePhotoBtn:'حذف الصورة الحالية',cropTitle:'اقتصاص',zoomLab:'تكبير',validatePhotoBtn:'تأكيد الصورة',
    liftedLoadKgLab:'الحمل المرفوع (كغ)',estimated1RMLab:'أقصى تكرار مُقدَّر (Epley)',percentOf1RMLab:'٪ من أقصى تكرار',repsShort:'تكرار',
    totalTonnageLab:'الحمولة الإجمالية ({0}×{1}×{2}كغ)',noDataLab:'لا توجد بيانات',distanceKmLab:'المسافة (كم)',
    kcalBurnedLab:'سعرات محروقة (~{0}كغ)',currentLoadKgLab:'الحمل الحالي (كغ)',weeklyProgressKgLab:'التقدم / أسبوع (كغ)',
    weeksLab:'الأسابيع',projectionLab:'التوقع',
    hrMaxLab:'أقصى نبض (نبضة/د)',hrRestLab:'نبض الراحة (نبضة/د)',hrZonesLab:'مناطق النبض (Karvonen)',
    hrZ1:'Z1 استشفاء',hrZ2:'Z2 تحمّل',hrZ3:'Z3 تيمبو',hrZ4:'Z4 عتبة',hrZ5:'Z5 VO2max',
    restTimesLab:'أوقات الراحة الموصى بها',supersetLab:'سوبرسِت',pomoFocus:'تركيز',pomoBreak:'استراحة',pomodorosDoneLab:'بومودورو مكتملة: {0}',
    fillEmailPasswordToast:'أدخل البريد الإلكتروني وكلمة المرور.',invalidEmailToast:'عنوان بريد إلكتروني غير صالح.',
    passwordTooShortToast:'كلمة المرور قصيرة جدًا (8 أحرف كحد أدنى).',passwordsMismatchToast:'كلمتا المرور غير متطابقتين.',
    wrongCredentialsToast:'بريد إلكتروني أو كلمة مرور غير صحيحة — وإذا أنشأت حسابك للتو، فأكّد بريدك الإلكتروني أولًا.',emailRateLimitToast:'طلبات بريد كثيرة متتالية. انتظر بضع دقائق قبل إعادة المحاولة.',sessionExpiredToast:'انتهت الجلسة، سجّل الدخول من جديد. بياناتك تبقى على هذا الجهاز.',emailAlreadyUsedToast:'يوجد حساب بالفعل بهذا البريد الإلكتروني.',
    authGenericErrorToast:'حدث خطأ ما. حاول مرة أخرى.',checkEmailConfirmToast:'تم إنشاء الحساب ✓ تحقق من بريدك لتأكيد عنوانك.',
    authTimeoutToast:'\u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u064A\u0633\u062A\u063A\u0631\u0642 \u0648\u0642\u062A\u064B\u0627 \u0637\u0648\u064A\u0644\u0627\u064B. \u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u062A\u0635\u0627\u0644\u0643 \u0628\u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u0648\u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.',
    resetLinkSentToast:'تم إرسال الرابط ✓ تحقق من بريدك.',loggingInToast:'جارٍ تسجيل الدخول…',creatingAccountToast:'جارٍ إنشاء الحساب…',sendingResetToast:'جارٍ إرسال الرابط…',
    continueAsGuestLink:'المتابعة كضيف',guestConnectingToast:'جارٍ الدخول كضيف…',guestDisabledToast:'وضع الضيف غير مفعّل بعد. حاول لاحقًا أو أنشئ حسابًا.',
    guestModeTitle:'وضع الضيف',guestModeLabel:'وضع الضيف',guestModeDesc:'بياناتك مرتبطة بهذا الجهاز. إذا سجّلت الخروج أو غيّرت الهاتف، قد تفقدها. أضف بريدًا إلكترونيًا لحمايتها.',
    guestSaveAccountBtn:'حفظ حسابي',guestUpgradeSentToast:'تحقق من بريدك الإلكتروني للتأكيد. بعدها يمكنك تسجيل الدخول بهذا البريد في أي وقت (استخدم «نسيت كلمة المرور» لاختيار كلمة مرور).',guestUpgradeEmailUsedToast:'هذا البريد الإلكتروني مستخدم بالفعل من حساب آخر.',
    tourSkip:'تخطي',tourStartBtn:'لنبدأ',tourNextBtn:'التالي',tourFinalBtn:'أنشئ خطتي',replayTourBtn:'إعادة مشاهدة الجولة التعريفية',
    tour_welcome_t:'مرحبًا {0} 👋',tour_welcome_d:'IKORUN ليس جهاز GPS ولا عدّاد خطى: إنه سجل تدريب ذكي يُنشئ خطتك ويعدّلها حسب ما تخبره به. 8 خطوات، دقيقة واحدة.',
    tour_home_t:'شاشتك الرئيسية',tour_home_d:'تعرض بطاقة اليوم حصتك المخطط لها، مع سبب اختيارها. بعد إنجازها، اضغط «أنجزتها» — أو «لم أنجزها» إن لم تفعل، لا مشكلة أبدًا.',
    tour_loop_t:'كيف يعمل التطبيق',tour_loop_d:'تُنشأ خطتك من مستواك وأزمنتك. بعد كل حصة، يسألك تقييم عن شعورك (التعب، الألم، الوتيرة) — أنت من يقول كم كانت صعبة، وليس مستشعرًا. IKORUN لا يتتبّع أي شيء في الخلفية.',
    tour_sport_t:'الجري وتمارين القوة',tour_sport_d:'تبويب «رياضة» يُنشئ خطة جري مخصّصة (المستوى، الهدف، تاريخ السباق) ويقترح أيضًا برامج تمارين قوة. أعد توليد الخطة في أي وقت إذا تغيّرت ظروفك.',
    tour_adapt_t:'الخطة تتكيّف بنفسها',tour_adapt_d:'حصة فائتة، تعب مرتفع، ألم مُبلَّغ عنه: الحصص القادمة تخفّ تلقائيًا. والتقدّم سهل جدًا؟ فهي تزداد صعوبة. لا تحتاج أبدًا لإعادة الحساب بنفسك.',
    tour_stats_t:'إحصائياتك',tour_stats_d:'الكيلومترات، الحصص، VDOT، الأرقام الشخصية — وتقدّمك من نقاط خبرة ومستويات وأوسمة، مكتسبة فقط من حصص حقيقية (يتحقّق التطبيق من ذلك).',
    tour_outils_t:'صندوق الأدوات',tour_outils_d:'حاسبة الوتيرة، VDOT، مؤشر كتلة الجسم، ساعة إيقاف، مؤقّت... ابحث عن الأداة التي تحتاجها أو احتفظ بالمفضّلة في متناول يدك.',
    tour_profil_t:'ملفك الشخصي',tour_profil_d:'المستوى، نقاط الخبرة، الأوسمة — وكل الإعدادات: اللغة، اللون، والوضع المبسّط الذي اخترته (قابل للتغيير هنا في أي وقت). لديك فكرة أو وجدت خللًا؟ «إرسال تعليق» أسفل الصفحة يصل مباشرة إلى بريدنا.',
    tour_club_t:'انضم إلى ناديك',tour_club_d:'انضم إلى نادي فريقك برمز، أو أنشئ ناديك الخاص: ترتيب مخصص، وزملاؤك في متناول نظرة واحدة. يمكن لمنشئ النادي حتى نشر خطة تدريب مشتركة مع مكان ووقت للتجمّع، ليتدرب الجميع معًا. روح فريق حقيقية، وليس فقط أصدقاء واحدًا تلو الآخر.',
    tour_final_t:'مستعد للبدء؟',tour_final_d:'حدّد هدفك وأنشئ خطتك المخصصة — الوقت الآن!',
    tourGotItBtn:'فهمت',signupHelpLink:'تحتاج مساعدة؟',
    tour_sg_welcome_t:'لننشئ حسابك',tour_sg_welcome_d:'ثلاث معلومات صغيرة وننطلق — الأمر يستغرق 30 ثانية.',
    tour_sg_email_t:'بريدك الإلكتروني',tour_sg_email_d:'يُستخدم لتسجيل الدخول ولاستلام رابط التأكيد. بلا رسائل مزعجة، وعد.',
    tour_sg_password_t:'اختر كلمة مرور',tour_sg_password_d:'8 أحرف كحد أدنى. ستعيد كتابتها في الأسفل للتأكيد.',
    tour_sg_submit_t:'كل شيء جاهز',tour_sg_submit_d:'بريد تأكيد ينتظرك بعدها مباشرة — اضغط على الرابط، ثم عد لإنشاء ملفك الشخصي.'
  }
};
function curLang(){ return (P&&P.lang)||'fr'; }
function t(key){ const l=curLang(); return (I18N[l]&&I18N[l][key])||I18N.fr[key]||key; }
function tp(key,...args){ let s=t(key); args.forEach((a,i)=>{ s=s.split('{'+i+'}').join(a); }); return s; }
function localeCode(){ return curLang()==='en'?'en-US':(curLang()==='ar'?'ar-DZ':'fr-FR'); }
const LANGS=[['fr','FR','Français'],['en','EN','English'],['ar','AR','العربية']];
function setLang(l){
  P.lang=l; saveAll();
  document.documentElement.lang=l;
  document.documentElement.dir=(l==='ar')?'rtl':'ltr';
  TOOLS=TOOLS_DEF(); BADGE_TIERS=BADGE_TIERS_DEF(); TIERS=TIERS_DEF(); MEDAL_CATS=MEDAL_CATS_DEF(); ACHIEVEMENTS=ACHIEVEMENTS_DEF();
  applyNavLabels();
  applyStaticLabels();
  if($('#login') && $('#login').classList.contains('on')) renderLoginMain();
  // re-render la vue active
  const active=document.querySelector('.nb.on'); if(active) nav(active.dataset.s);
  refreshPfSheet();
  toast('');
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
  return tp('repsTextTemplate',n,meters,fmtSplit(splitSecFromPace(paceSecPerKm,meters)),spkToStr(paceSecPerKm));
}
// Résumé compact des séries d'une séance, pour affichage AVANT clic (carte de la liste)
function seriesSummary(s){
  const sr=s.series;
  if(!sr) return null;
  if(sr.segments) return tp('seriesPyramid',sr.segments[0].dist,Math.max(...sr.segments.map(x=>x.dist)));
  if(sr.reps && sr.dist) return tp('seriesRepsDist',sr.reps,sr.dist,fmtSplit(splitSecFromPace(sr.paceSecPerKm,sr.dist)));
  if(sr.reps) return tp('seriesRepsOnly',sr.reps)+(sr.note?' · '+sr.note:'');
  return null;
}
// Plage réaliste de VDOT humain (~20 = débutant très lent, ~90 = record du monde absolu).
// Toute valeur hors plage est un signe d'injection/erreur de saisie plutôt qu'une vraie
// perf : on la ramène dans la plage au lieu de l'afficher/l'utiliser telle quelle.
const VDOT_MIN=20, VDOT_MAX=90;
function clampVdot(v){ if(!v||isNaN(v)) return 0; return Math.min(VDOT_MAX,Math.max(VDOT_MIN,Math.round(v*10)/10)); }
function getUserVDOT(){
  const fromRec=(typeof RECORDS!=='undefined')?computeVDOTfromRecords():computeVDOT();
  if(fromRec) return fromRec;
  return clampVdot(P.vdot)||computeVDOT();
}
function computeVDOT(){
  if(!P) return 0;
  const races=[];
  if(P.t5k) races.push([5000,parseTime(P.t5k)]);
  if(P.t3k) races.push([3000,parseTime(P.t3k)]);
  if(P.t1500) races.push([1500,parseTime(P.t1500)]);
  if(P.t10k) races.push([10000,parseTime(P.t10k)]);
  let best=0;
  races.forEach(r=>{ if(r[1]>0){ const v=vdotFromRace(r[0],r[1]); if(v>best) best=v; }});
  return best>0?clampVdot(best):0;
}

/* ============ ANTI-TRICHE — PLAUSIBILITÉ DES SÉANCES ET PERFS ============
   Toute la mécanique d'XP/niveaux ne vaut que si les données sources (séances,
   records) sont crédibles. Ces gardes s'appliquent à CHAQUE point d'entrée où
   l'utilisateur peut taper une distance/durée/temps à la main, avant que la
   donnée n'entre dans SESS/MSESS/RECORDS. Rien n'est bloqué "après coup" côté
   calcul d'XP : on empêche la donnée invraisemblable d'être enregistrée. */

// Marge tolérée (en points de VDOT) entre le niveau actuel du coureur et une
// performance ponctuelle : autorise un vrai record/une bonne surprise sans
// autoriser un bond de niveau. Calibré pour qu'un VDOT 67 puisse valider un
// 3000 m jusqu'à ~8:30 (limite haute réaliste), mais pas un 9:00 avec VDOT 30.
const ANTICHEAT_VDOT_MARGIN=4;

// Allure la plus rapide plausible (sec/km) pour une distance totale donnée,
// compte tenu du VDOT (+marge). En dessous de 5 km on utilise la courbe de
// réserve de vitesse anaérobie (calibrée fractionné court), au-delà on
// bascule sur le modèle Daniels continu (predictTime), plus réaliste pour
// les longues distances (la courbe courte, elle, sous-estimerait l'effort
// nécessaire sur un 20-30 km si on l'extrapolait telle quelle).
function floorPaceSecPerKm(vdot,meters){
  if(meters<=0) return Infinity;
  const v=clampVdot((vdot||VDOT_MIN)+ANTICHEAT_VDOT_MARGIN)||VDOT_MAX;
  return meters<=5000 ? repPace(v,meters) : predictTime(v,meters)/(meters/1000);
}
// Distance max plausible pour une séance manuelle : jamais plus de 3x le plus
// long effort déjà loggé par l'utilisateur (plancher marathon pour ne pas
// bloquer un premier gros objectif), et jamais plus de 250 km dans l'absolu
// (limite ultra-trail la plus large qui reste réaliste pour une seule sortie).
const SESSION_KM_ABS_MAX=250;
function maxPlausibleKmForUser(){
  const hist=(typeof SESS!=='undefined'?SESS:[]).map(s=>+s.km||0);
  const maxHist=hist.length?Math.max(...hist):0;
  return Math.min(SESSION_KM_ABS_MAX,Math.max(42.2,maxHist*3));
}
// Vérifie qu'une allure moyenne (km sur durationMin minutes) est cohérente
// avec le VDOT du coureur. Si aucune des deux valeurs n'est exploitable, on
// laisse passer (on ne bloque jamais sur une donnée absente/incomplète).
function isPacePlausible(vdot,km,durationMin){
  if(!vdot||!(km>0)||!(durationMin>0)) return true;
  const floorSec=floorPaceSecPerKm(vdot,km*1000)*km;
  return durationMin*60 >= floorSec*0.98; // 2% de tolérance d'arrondi
}
// Garde générique appelée avant TOUT push d'une séance manuelle (course
// perso, séance de remplacement, bilan de séance...). Retourne {ok:true} ou
// {ok:false, msg} avec un message déjà traduit prêt pour un toast().
function sessionGuard(km,durationMin,dateStr){
  km=+km||0; durationMin=+durationMin||0;
  if(dateStr && dateStr>todayKey()) return {ok:false,msg:t('guardFutureDate')};
  if(km>0){
    const maxKm=maxPlausibleKmForUser();
    if(km>maxKm) return {ok:false,msg:tp('guardDistanceTooHigh',Math.round(maxKm))};
  }
  const vdot=getUserVDOT();
  if(vdot && km>0 && durationMin>0 && !isPacePlausible(vdot,km,durationMin)){
    return {ok:false,msg:tp('guardPaceTooFast',vdot)};
  }
  return {ok:true};
}
// Garde spécifique aux records/performances (Profil → Historique des
// performances) : ici la "séance" EST l'effort maximal, donc on compare le
// VDOT qu'impliquerait ce chrono au meilleur VDOT déjà connu (+ marge),
// plutôt qu'à une allure de séance d'entraînement.
function recordGuard(meters,timeS,dateStr){
  if(dateStr && dateStr>todayKey()) return {ok:false,msg:t('guardFutureDate')};
  if(!(meters>0)||!(timeS>0)) return {ok:true};
  const implied=vdotFromRace(meters,timeS);
  if(implied>VDOT_MAX+ANTICHEAT_VDOT_MARGIN) return {ok:false,msg:tp('guardRecordTooFast',Math.round(implied))};
  const currentBest=clampVdot(P.vdot)||(RECORDS&&RECORDS.length?computeVDOTfromRecords():0);
  if(currentBest && implied>currentBest+ANTICHEAT_VDOT_MARGIN){
    return {ok:false,msg:tp('guardRecordTooFast',Math.round(implied))};
  }
  return {ok:true};
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

// Plafond d'XP "séances" gagnable par jour calendaire (anti-triche). Un vrai
// gros jour d'entraînement (sortie longue + muscu) tient large dedans ; ça
// bloque en revanche quelqu'un qui logguerait 20 fausses séances le même
// jour pour sauter des niveaux. Recalculé à chaque fois depuis SESS/MSESS
// (jamais stocké), donc s'applique aussi rétroactivement si des séances
// invraisemblables avaient été loguées avant l'ajout de ce garde-fou.
const XP_DAILY_CAP=300;
function xpSessionsByDate(){
  const byDate={};
  SESS.forEach(s=>{
    if(!s.date) return;
    const raw=(+s.km||0)*XP_RULES.perKm + XP_RULES.perRunSession + (+s.duration||0)*XP_RULES.perMinTraining;
    byDate[s.date]=(byDate[s.date]||0)+raw;
  });
  MSESS.forEach(s=>{
    if(!s.date) return;
    const raw=XP_RULES.perMuscuSession + (+s.sets||0)*XP_RULES.perMuscuSet + (+s.duration||0)*XP_RULES.perMinTraining;
    byDate[s.date]=(byDate[s.date]||0)+raw;
  });
  return byDate;
}
function computeXPTotal(){
  let xp=0;
  // Séances réalisées (distance, nb séances, sets, minutes), plafonnées par
  // jour pour empêcher un abus par saisie massive de fausses séances.
  const byDate=xpSessionsByDate();
  let sessionXP=0;
  Object.values(byDate).forEach(raw=>{ sessionXP+=Math.min(raw,XP_DAILY_CAP); });
  xp += Math.round(sessionXP);
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
  checkNewAchievements(opts&&opts.animate);
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
/* Chaque palier exige désormais 3 conditions cumulatives, pas seulement
   de l'XP : un volume de kilomètres courus, ET une ancienneté minimale
   du compte (pour que rien ne se débloque "trop vite" en enchaînant les
   séances les tout premiers jours).

   Unité de référence : 1 "semaine bien remplie" = 30 km / 200 XP, cohérent
   avec le rythme réel de ~100-120 km/mois visé ailleurs dans le fichier.
   Le kmMin/xpMin de chaque palier est un multiple exact de cette semaine
   de référence (le temps qu'il faudrait pour l'atteindre en s'entraînant
   sérieusement) ; le daysMin (ancienneté minimale du compte) est lui
   toujours plus court que cet équivalent, pour qu'il soit impossible de
   débloquer un palier en se contentant d'attendre — il faut vraiment
   avoir rempli les séances :
     - Amateur  : ≥3 jours depuis le 1er run,  objectif = 1 semaine  (30 km / 200 XP)
     - Sportif  : ≥1 semaine et demie (11 j),  objectif = 2 semaines (60 km / 400 XP)
     - Athlète  : ≥2 semaines (14 j),          objectif = 2 mois     (240 km / 1600 XP)
     - Expert   : ≥1 mois (30 j),              objectif = 5 mois     (600 km / 4000 XP)
     - Élite    : ≥2 mois (60 j),              objectif = 12 mois    (1440 km / 9600 XP)
     - Maître   : ≥4 mois (120 j),             objectif = 18 mois    (2160 km / 14400 XP)
     - Légende  : ≥8 mois (240 j),             objectif = 2 ans      (2880 km / 19200 XP) */
function BADGE_TIERS_DEF(){ return [
  {key:'debutant', name:t('bdg_debutant_name'), cls:'bd-debutant', emoji:'seedling', xpMin:0,     kmMin:0,    daysMin:0,   desc:t('bdg_debutant_desc')},
  {key:'amateur',  name:t('bdg_amateur_name'),  cls:'bd-amateur',  emoji:'medal', xpMin:200,   kmMin:30,   daysMin:3,   desc:t('bdg_amateur_desc')},
  {key:'sportif',  name:t('bdg_sportif_name'),  cls:'bd-sportif',  emoji:'star', xpMin:400,   kmMin:60,   daysMin:11,  desc:t('bdg_sportif_desc')},
  {key:'athlete',  name:t('bdg_athlete_name'),  cls:'bd-athlete',  emoji:'medal', xpMin:1600,  kmMin:240,  daysMin:14,  desc:t('bdg_athlete_desc')},
  {key:'expert',   name:t('bdg_expert_name'),   cls:'bd-expert',   emoji:'heart', xpMin:4000,  kmMin:600,  daysMin:30,  desc:t('bdg_expert_desc')},
  {key:'elite',    name:t('bdg_elite_name'),    cls:'bd-elite',    emoji:'gem', xpMin:9600,  kmMin:1440, daysMin:60,  desc:t('bdg_elite_desc')},
  {key:'maitre',   name:t('bdg_maitre_name'),   cls:'bd-maitre',   emoji:'shield', xpMin:14400, kmMin:2160, daysMin:120, desc:t('bdg_maitre_desc')},
  {key:'legende',  name:t('bdg_legende_name'),  cls:'bd-legende',  emoji:'crown', xpMin:19200, kmMin:2880, daysMin:240, desc:t('bdg_legende_desc')}
]; }
// Recalculé à chaque changement de langue (setLang) pour suivre curLang() — voir TOOLS_DEF pour le même principe.
let BADGE_TIERS=BADGE_TIERS_DEF();
function badgeStats(){
  return { xp: XP.total||0, km: totalKm(), days: daysSinceJoin() };
}
/* Ancienneté du compte, en jours pleins depuis la fin de l'onboarding.
   P.joinedAt est posé une seule fois (finishOnboarding) ; pour les comptes
   déjà existants avant cet ajout, reloadState() le reconstitue à partir
   de la toute première séance connue (voir plus bas). */
function daysSinceJoin(){
  if(!P||!P.joinedAt) return 0;
  return Math.max(0, Math.floor((Date.now()-P.joinedAt)/86400000));
}
function badgeProgress(b){
  const parts=[
    {label:'XP total',             have:XP.total||0,                  need:b.xpMin,   unit:'XP'},
    {label:'Distance cumulée',     have:Math.round(totalKm()*10)/10,  need:b.kmMin,   unit:'km'},
    {label:'Ancienneté du compte', have:daysSinceJoin(),               need:b.daysMin, unit:'j'}
  ];
  const ratio=p=> p.need ? Math.min(100,(p.have/p.need)*100) : 100;
  const unlocked=parts.every(p=>p.have>=p.need);
  const pct=Math.round(Math.min.apply(null,parts.map(ratio)));
  return {parts,pct:Math.max(0,pct),unlocked};
}
/* Le critère le plus en retard (celui qui bloque réellement l'obtention),
   pour afficher un indice concret ("encore 12 jours") plutôt qu'un % sec. */
function badgeBottleneck(prog){
  return prog.parts.reduce((worst,p)=>{
    const r=p.need?p.have/p.need:1, rw=worst.need?worst.have/worst.need:1;
    return r<rw?p:worst;
  }, prog.parts[0]);
}
function badgeHintText(prog){
  if(prog.unlocked) return 'Palier atteint';
  const p=badgeBottleneck(prog);
  const remain=Math.ceil(p.need-p.have);
  if(remain<=0) return 'Continue, tu y es presque.';
  if(p.unit==='j') return 'Encore '+remain+' jour'+(remain>1?'s':'')+' avant de pouvoir débloquer ce badge.';
  return 'Encore '+remain+' '+p.unit+' avant de débloquer ce badge.';
}
/* Migration : les paliers ont été renommés (anciennes clés → nouvelles).
   On réécrit les enregistrements déjà obtenus pour éviter les doublons
   et les paliers fantômes qui n'existent plus. */
const BADGE_KEY_MIGRATION={
  pierre:'initie', bronze:'discipline', argent:'perseverant', or:'determine',
  emeraude:'avance', diamant:'elite', cristal:'exceptionnel', galaxie:'legendaire',
  divin:'ultime', vvvelite:'iconique'
};
/* Ouverture rapide au clic sur une icône badge (gallerie, bandeau profil/accueil) :
   va directement à l'écran lumineux (obtenu → replay, verrouillé → aperçu),
   sans passer par la fiche "Détails du badge". Cette dernière reste accessible
   via le lien "Voir les détails" affiché sur l'écran lumineux. */
function openBadgeQuick(key){
  const unlocked=unlockedBadges(); const rec=unlocked.find(u=>u.key===key);
  if(rec) replayBadgeAnim(key); else previewBadgeAnim(key);
}
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
    '<div style="font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:700;font-family:Unbounded;margin-bottom:6px">'+t('newBadgeUnlocked')+'</div>'+
    '<div class="bd-unlock-stage '+b.cls+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div><div class="bd-ring r4"></div>'+
    '<div class="bd-unlock-badge">'+bdGlyph(b.key)+sparks+'</div></div>'+
    '<div class="man" style="font-weight:800;font-size:30px;margin-top:18px;letter-spacing:.5px">'+b.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;max-width:280px">'+b.desc+'</div>'+
    '<div style="color:var(--dim);font-size:12px;margin-top:18px">'+t('tapToContinue')+'</div>';
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
    '<button type="button" class="btn sm" style="width:auto;margin-top:20px;padding:11px 26px" data-details>'+t('seeDetails')+'</button>'+
    '<div style="color:var(--dim);font-size:12px;margin-top:12px">'+t('tapToClose')+'</div>';
  ov.onclick=(e)=>{
    if(e.target.closest('[data-details]')){ ov.remove(); openBadgeDetail(key); return; }
    ov.remove();
  };
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
    '<div style="font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:700;font-family:Unbounded;margin-bottom:6px">'+t('previewLocked')+'</div>'+
    '<div class="bd-unlock-stage '+b.cls+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div>'+
    '<div class="bd-unlock-badge">'+bdGlyph(b.key)+sparks+'<div class="bd-lock-chip big">'+ICN('lock',16)+'</div></div></div>'+
    '<div class="man" style="font-weight:800;font-size:26px;margin-top:18px">'+b.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;max-width:280px">'+b.desc+'</div>'+
    condHtml+
    '<button type="button" class="btn sm" style="width:auto;margin-top:20px;padding:11px 26px" data-details>'+t('seeDetails')+'</button>'+
    '<div style="color:var(--dim);font-size:12px;margin-top:12px">'+t('tapToClose')+'</div>';
  ov.onclick=(e)=>{
    if(e.target.closest('[data-details]')){ ov.remove(); openBadgeDetail(key); return; }
    ov.remove();
  };
  document.body.appendChild(ov);
}
let badgeFilter='tous';
function openBadges(){
  $('#ovBadgesTitle').textContent=t('badgesLabel');
  renderBadgeGallery();
  openOv('ovBadges');
}
function renderBadgeGallery(){
  const unlocked=unlockedBadges(); const ukeys=new Set(unlocked.map(u=>u.key));
  const list=BADGE_TIERS.filter(b=> badgeFilter==='tous' ? true : (badgeFilter==='obtenus'? ukeys.has(b.key) : !ukeys.has(b.key)));
  let h='<div class="pills" style="margin-bottom:14px">'+
    [['tous',t('filterAll')],['obtenus',t('filterObtained')],['verrouilles',t('filterLocked')]].map(f=>'<div class="pill '+(badgeFilter===f[0]?'on':'')+'" onclick="badgeFilter=\''+f[0]+'\';renderBadgeGallery()">'+f[1]+'</div>').join('')+
    '</div>';
  h+='<div style="font-size:12px;color:var(--muted);margin-bottom:10px">'+tp('badgesObtainedCount',unlocked.length,BADGE_TIERS.length)+'</div>';
  h+='<div class="bd-grid">';
  list.forEach((b,i)=>{
    const on=ukeys.has(b.key);
    h+='<div class="bd-cell" onclick="openBadgeQuick(\''+b.key+'\')">'+
      '<div class="bd-icon '+b.cls+(on?'':' locked')+'" style="--sw:'+(i%5)+'">'+bdGlyph(b.key)+(on?'':'<div class="bd-lock-chip">'+ICN('lock',14)+'</div>')+'</div>'+
      '<div class="bd-name">'+b.name+'</div><div class="bd-lvl">'+(b.kmMin?b.kmMin+' km':'—')+'</div></div>';
  });
  h+='</div>';
  $('#badgesBody').innerHTML=h;
}
function openBadgeDetail(key){
  const b=BADGE_TIERS.find(x=>x.key===key); if(!b) return;
  const idx=BADGE_TIERS.findIndex(x=>x.key===key);
  const unlocked=unlockedBadges(); const ukeys=new Set(unlocked.map(u=>u.key));
  const rec=unlocked.find(u=>u.key===key);
  const prog=badgeProgress(b);
  $('#ovBadgesTitle').textContent=t('badgeDetailTitle');

  /* Rail des 8 paliers — la progression IKORUN est une vraie séquence,
     donc la montrer dans son ensemble (obtenus / palier actuel / à venir)
     a plus de sens qu'un simple prev/next textuel. */
  let h='<div class="bd-detail-rail">'+BADGE_TIERS.map(bt=>{
    const on=ukeys.has(bt.key), cur=bt.key===key;
    return '<div class="bd-icon xs '+bt.cls+(cur?' cur':'')+(on?'':' locked')+'" onclick="openBadgeDetail(\''+bt.key+'\')" title="'+bt.name+'">'+bdGlyph(bt.key)+'</div>';
  }).join('')+'</div>';
  h+='<div class="row" style="justify-content:center;margin:8px 0 16px"><span class="lab">'+tp('tierOf',idx+1,BADGE_TIERS.length)+'</span></div>';

  /* Hero : le halo reprend la couleur matière propre au badge (--glow),
     posé via la classe de palier (b.cls) qui définit --c1/--c2/--glow. */
  h+='<div class="bd-detail-hero '+b.cls+(rec?'':' locked')+'">'+
    '<div class="bd-icon big'+(rec?'':' locked')+'" style="margin:0 auto;cursor:pointer" onclick="'+(rec?'replayBadgeAnim':'previewBadgeAnim')+'(\''+b.key+'\')">'+bdGlyph(b.key)+(rec?'':'<div class="bd-lock-chip big">'+ICN('lock',16)+'</div>')+'</div>'+
    '<div class="man" style="font-weight:800;font-size:24px;margin-top:16px">'+b.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;padding:0 14px">'+b.desc+'</div>'+
    '<div class="row" style="justify-content:center;gap:8px;margin-top:14px;flex-wrap:wrap">'+
      '<div class="bd-status-chip'+(rec?' on':'')+'">'+(rec?tp('obtainedOn',fmtDate(rec.date)):t('lockedLab'))+'</div>'+
      '<div class="bd-status-chip ghost" onclick="'+(rec?'replayBadgeAnim':'previewBadgeAnim')+'(\''+b.key+'\')">'+(rec?t('replayAnim'):t('seePreview'))+'</div>'+
    '</div>'+
  '</div>';

  h+='<div class="card '+b.cls+'"><div class="lab" style="margin-bottom:12px">'+t('obtainConditions')+'</div>';
  prog.parts.forEach(p=>{
    const pc=Math.min(100,Math.round((p.need?p.have/p.need:1)*100));
    const done=p.have>=p.need;
    h+='<div style="margin-bottom:12px"><div class="row" style="margin-bottom:5px"><span style="font-size:13px">'+(done?'':'')+p.label+'</span><span class="mono" style="font-size:12px;color:var(--muted)">'+Math.min(p.have,p.need)+' / '+p.need+' '+p.unit+'</span></div><div class="pbar bd-pbar" style="height:7px"><div style="width:'+pc+'%"></div></div></div>';
  });
  const R=40,C=+(2*Math.PI*R).toFixed(1),OFF=+(C*(1-prog.pct/100)).toFixed(1);
  h+='<div class="card-divider"></div>'+
    '<div class="row" style="align-items:center;gap:14px">'+
      '<div class="ringwrap" style="width:82px;height:82px;flex-shrink:0">'+
        '<svg viewBox="0 0 96 96" width="82" height="82">'+
          '<circle cx="48" cy="48" r="'+R+'" fill="none" stroke="var(--s3)" stroke-width="8"/>'+
          '<circle cx="48" cy="48" r="'+R+'" fill="none" stroke="var(--glow)" stroke-width="8" stroke-linecap="round" stroke-dasharray="'+C+'" stroke-dashoffset="'+OFF+'" style="transition:stroke-dashoffset .7s var(--ease)"/>'+
        '</svg>'+
        '<div class="rc"><span class="mono" style="font-size:17px;font-weight:800">'+prog.pct+'%</span></div>'+
      '</div>'+
      '<div style="flex:1"><div class="lab">'+t('globalProgress')+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:4px">'+badgeHintText(prog)+'</div></div>'+
    '</div></div>';

  if(rec) h+='<button class="btn" style="margin-top:12px" onclick="shareBadge(\''+b.key+'\')">'+t('shareBadgeBtn')+'</button>';
  h+='<button class="btn ghost" style="margin-top:8px" onclick="closeOv(\'ovBadges\')">'+t('closeLab')+'</button>';
  $('#badgesBody').innerHTML=h;
  openOv('ovBadges');
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
    '<div style="font-size:14px;letter-spacing:3px;color:var(--e);font-weight:700;font-family:Unbounded">'+t('levelUpTitle')+'</div>'+
    '<div style="margin:6px 0;filter:drop-shadow(0 0 20px var(--e));display:flex;justify-content:center">'+ICN('star',80,'var(--e)')+'</div>'+
    '<div class="man" style="font-weight:800;font-size:54px;background:linear-gradient(135deg,var(--e),#9FD8FF);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent">Niv. '+level+'</div>'+
    '<div class="man" style="font-weight:700;font-size:22px;margin-top:4px">'+levelName(level)+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:14px">'+t('tapToContinue')+'</div></div>';
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
  notify(title||''+t('alarmDefaultTitle'),msg||t('timeUpMsg'));
  showAlarmScreen(title||''+t('timeUpTitle'),msg||'');
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
  ov.innerHTML='<div style="font-size:84px;animation:alarmShake .5s ease-in-out infinite"></div>'+
    '<div class="man" style="font-weight:800;font-size:28px;margin-top:14px">'+title+'</div>'+
    (msg?'<div style="color:var(--muted);font-size:15px;margin-top:8px">'+msg+'</div>':'')+
    '<button class="btn" style="margin-top:28px;max-width:240px;font-size:17px;padding:16px" onclick="stopAlarm()">'+t('stopAlarm')+'</button>'+
    '<button class="btn ghost" style="margin-top:10px;max-width:240px" onclick="snoozeAlarm()">'+t('remindIn5Min')+'</button>';
  ov.onclick=(e)=>{ if(e.target===ov) {} };
  document.body.appendChild(ov);
}
function snoozeAlarm(){
  stopAlarm();
  toast(''+t('remindIn5Min'));
  setTimeout(()=>startAlarm(''+t('reminderCap'),t('fiveMinElapsed')),5*60*1000);
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
    try{ _bgNotif=new Notification('IKORUN · '+type,{body:'▶ '+t('sessionInProgress'),icon:appIconDataURL(),tag:'ikorun-activity',renotify:false,silent:true}); }catch(e){}
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
function ripple(e,b){
  const r=document.createElement('span'); r.className='ripple';
  const z=uiZoomFactor(); // rect et clientX sont en px écran, les styles posés en px CSS
  const rect=b.getBoundingClientRect(), sz=Math.max(rect.width,rect.height)/z;
  r.style.width=r.style.height=sz+'px';
  r.style.left=((e.clientX-rect.left)/z-sz/2)+'px'; r.style.top=((e.clientY-rect.top)/z-sz/2)+'px';
  b.appendChild(r); setTimeout(()=>r.remove(),600);
}
document.addEventListener('click',e=>{ const b=e.target.closest('.btn'); if(b) ripple(e,b); });

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
let _ovZTop=12000;
// Renvoie toujours un z-index supérieur au plus haut déjà distribué, pour que
// les popups créées dynamiquement (confirmation, timer de repos, etc.) passent
// TOUJOURS au-dessus de l'overlay actif, même si celui-ci a été ouvert/réouvert
// plusieurs fois avant (sinon un z-index fixe trop bas se retrouve caché "derrière"
// la page et devient impossible à fermer/valider).
// Plafonné pour rester sous la bande réservée au toast (19000) et au skeleton de
// démarrage (20000) : sans borne, une session très longue finissait par distribuer
// des z-index qui recouvraient même les messages système.
function topZ(){ _ovZTop=Math.min(_ovZTop+1,18000); return _ovZTop; }
function openOv(id){ const el=$('#'+id); el.style.zIndex=topZ(); el.classList.add('on'); }
function closeOv(id){ const el=$('#'+id); el.classList.remove('on'); el.style.zIndex=''; if(id==='ovProg') _pfSheet=null; if(id==='ovLib'&&typeof _exDemoTimer!=='undefined'){ clearInterval(_exDemoTimer); } if((id==='ovProg'||id==='ovLive')&&typeof _exDemo2!=='undefined'&&_exDemo2){ clearInterval(_exDemo2); _exDemo2=null; }
  // Garde-fou : openLibFor() ferme ovCreate pour ouvrir la bibliothèque par-dessus (voir plus
  // bas). Sans ce bloc, annuler depuis la bibliothèque ou depuis "Configurer" (X, pas
  // "Ajouter") fermait tout et faisait perdre le programme en cours de création — bug
  // signalé par un utilisateur ("petit bug lors de la création d'un programme de muscu").
  if((id==='ovLib'||id==='ovCfg') && _libFromCreate && typeof newProg!=='undefined' && newProg){ _libFromCreate=false; renderCreate(); openOv('ovCreate'); }
  // Garde-fou : si ovLive se ferme par un chemin qui n'est pas pauseLive/doCancelLive/finishLive,
  // on ne laisse jamais liveTimer/restTimer tourner en fond perdu.
  if(id==='ovLive'){ if(typeof liveTimer!=='undefined'){ clearInterval(liveTimer); } if(typeof restTimer!=='undefined'){ clearInterval(restTimer); } }
}
// Popup de confirmation "maison" à la place de confirm() natif : ce dernier ne se
// déclenche pas de façon fiable dans une app ajoutée à l'écran d'accueil (iOS PWA
// en mode standalone), ce qui rendait certaines actions (déconnexion, suppression,
// reprise de séance...) silencieusement impossibles ou pire — exécutées/annulées
// sans que l'utilisateur ait pu répondre.
function customConfirm(msg,onYes,opts){
  opts=opts||{};
  const old=$('#genConfirmOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='genConfirmOv'; ov.style.zIndex=topZ();
  ov.innerHTML='<div class="ov-card" style="text-align:center">'+
    (opts.title?'<div class="card-t" style="justify-content:center;margin-bottom:10px">'+opts.title+'</div>':'')+
    '<div style="font-size:13px;color:var(--muted);margin-bottom:18px;white-space:pre-line">'+msg+'</div>'+
    '<div class="row" style="gap:10px">'+
      '<button class="btn ghost" style="flex:1" id="genConfirmNo">'+(opts.noLabel||t('cancel'))+'</button>'+
      '<button class="btn" style="flex:1'+(opts.danger?';background:var(--bad)':'')+'" id="genConfirmYes">'+(opts.yesLabel||t('validate'))+'</button>'+
    '</div></div>';
  document.body.appendChild(ov);
  $('#genConfirmNo').onclick=()=>{ ov.remove(); if(opts.onNo) opts.onNo(); };
  $('#genConfirmYes').onclick=()=>{ ov.remove(); onYes(); };
}

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
/* Le mode simplifié applique zoom:1.16 sur <html> (voir .easy-mode). Or
   getBoundingClientRect() renvoie des pixels écran DÉJÀ mis à l'échelle par ce
   zoom : reposer ces mêmes nombres en style brut (left/top/width...) sur un
   élément qui subit lui aussi le zoom les fait multiplier une seconde fois.
   Toute position calculée en JS à partir d'un rect doit donc être divisée par
   ce facteur avant d'être écrite en style. Vaut 1 hors mode simplifié. */
function uiZoomFactor(){
  const z=parseFloat(getComputedStyle(document.documentElement).zoom);
  return (z && isFinite(z) && z>0) ? z : 1;
}
function positionNavPill(btn){
  // Mesure réelle du bouton pour que la pastille soit toujours parfaitement
  // centrée sous l'onglet actif, quel que soit le nombre d'onglets ou le
  // padding du conteneur (évite le décalage causé par un calc() en %% fixe).
  if(!btn) return;
  const nav=document.getElementById('nav'), pill=document.getElementById('nav-pill');
  if(!nav||!pill) return;
  const z=uiZoomFactor();
  const navRect=nav.getBoundingClientRect(), btnRect=btn.getBoundingClientRect();
  const pad=3; // marge interne autour du bouton pour l'effet "capsule"
  pill.style.left=((btnRect.left-navRect.left)/z+pad)+'px';
  pill.style.width=(btnRect.width/z-pad*2)+'px';
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
  const av=$('#tbAvatar'); if(av){ const ph=safePhotoUrl(P.photo); if(ph){ av.style.background="url('"+ph+"') center/cover"; av.textContent=''; } else { av.style.background='var(--ed)'; av.style.color='var(--e)'; av.style.fontWeight='800'; av.textContent=P.name?P.name[0].toUpperCase():'?'; } }
  $('#scroll').scrollTop=0;
  const navElReset=document.getElementById('nav'); if(navElReset) navElReset.classList.remove('nav-hidden');
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

/* ---------- SWIPE-BACK sur les pages plein écran (.ov-push) ----------
   Glisser depuis le bord gauche (zone .ov-push-edge, ~22px) ferme la page
   en cours, comme le geste "retour" natif iOS. Reprend la logique du
   liveSwipe plus bas (transform direct pendant le drag, seuil au relâcher). */
(function(){
  let ovEl=null, ovId=null, startX=0, startY=0, dx=0, dragging=false;
  const THRESH=90;
  document.addEventListener('touchstart',e=>{
    const edge=e.target.closest('.ov-push-edge'); if(!edge) return;
    ovId=edge.dataset.ovid; ovEl=document.getElementById(ovId); if(!ovEl) return;
    startX=e.touches[0].clientX; startY=e.touches[0].clientY; dx=0; dragging=true;
    ovEl.classList.add('dragging');
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(!dragging||!ovEl) return;
    const tx=e.touches[0].clientX, ty=e.touches[0].clientY;
    const ddx=tx-startX, ddy=ty-startY;
    if(Math.abs(ddy)>Math.abs(ddx)&&Math.abs(ddy)>12){ dragging=false; ovEl.classList.remove('dragging'); return; }
    dx=Math.max(0,ddx);
    // dx vient de clientX (pixels écran) alors que le transform s'applique dans
    // le sous-arbre zoomé du mode simplifié : sans division la carte glissait
    // 16% plus vite que le doigt (voir uiZoomFactor).
    const card=ovEl.querySelector('.ov-card'); if(card) card.style.transform='translateX('+(dx/uiZoomFactor())+'px)';
  },{passive:true});
  document.addEventListener('touchend',()=>{
    if(!dragging||!ovEl){ dragging=false; return; }
    dragging=false; ovEl.classList.remove('dragging');
    const card=ovEl.querySelector('.ov-card'); if(card) card.style.transform='';
    if(dx>THRESH) closeOv(ovId);
    dx=0; ovEl=null; ovId=null;
  });
})();

/* ---------- PULL-TO-REFRESH sur #scroll ----------
   Tirer vers le bas depuis tout en haut relance une resynchro cloud
   (cloudPullAll) puis re-render l'écran courant. */
(function(){
  const sc=document.getElementById('scroll'); if(!sc) return;
  let startY=0, dy=0, pulling=false, busy=false;
  const TRIGGER=64, MAXPULL=100;
  const ind=document.createElement('div');
  ind.id='ptrIndicator';
  ind.style.cssText='position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));'
    +'transform:translate(-50%,-70px);z-index:9500;width:36px;height:36px;border-radius:50%;'
    +'background:var(--s1);border:1px solid var(--hair);display:flex;align-items:center;justify-content:center;'
    +'color:var(--e);font-size:16px;box-shadow:var(--sh-md);transition:transform .18s var(--ease-out),opacity .18s;opacity:0;';
  ind.textContent='';
  document.body.appendChild(ind);
  sc.addEventListener('touchstart',e=>{
    if(sc.scrollTop>2||busy) return;
    startY=e.touches[0].clientY; dy=0; pulling=true;
  },{passive:true});
  sc.addEventListener('touchmove',e=>{
    if(!pulling) return;
    const raw=e.touches[0].clientY-startY;
    if(raw<=0){ dy=0; ind.style.opacity='0'; return; }
    dy=Math.min(MAXPULL,raw);
    ind.style.opacity=Math.min(1,dy/TRIGGER);
    ind.style.transform='translate(-50%,'+(dy-70+70*Math.min(1,dy/TRIGGER))+'px) rotate('+(dy*2.4)+'deg)';
  },{passive:true});
  sc.addEventListener('touchend',async ()=>{
    if(!pulling) return;
    pulling=false;
    if(dy>=TRIGGER && !busy){
      busy=true;
      ind.style.transform='translate(-50%,50px) rotate(0deg)';
      ind.style.opacity='1';
      if(navigator.vibrate) navigator.vibrate(8);
      try{
        if(window.currentUserId) await cloudPullAll(window.currentUserId);
        nav(document.body.dataset.scr||'home');
        toast('Synchronisé');
      }catch(e){ /* pas de cloud dispo (hors-ligne) : on referme juste l'indicateur */ }
      busy=false;
    }
    ind.style.opacity='0'; ind.style.transform='translate(-50%,-70px)';
    dy=0;
  });
})();
function greet(){ const h=new Date().getHours(); const l=curLang();
  const G={fr:[h<12?'Bonjour':h<18?'Bon après-midi':'Bonsoir'],en:[h<12?'Good morning':h<18?'Good afternoon':'Good evening'],ar:['مرحباً']};
  return (G[l]||G.fr)[0]+', '+(P.name||t('profil'))+''; }

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
  // Pendant un scroll actif, on coupe les animations décoratives en boucle
  // (reflet des badges, etc.) qui saturent le compositeur et causent des
  // saccades / blocages sur iOS Safari quand la liste est longue.
  let _scrollEndT=null;
  sc.addEventListener('scroll',()=>{
    sc.classList.add('is-scrolling');
    clearTimeout(_scrollEndT);
    _scrollEndT=setTimeout(()=>{ sc.classList.remove('is-scrolling'); },200);
  },{passive:true});
})();
/* ---------- NAV : masquage auto au scroll ----------
   Descend (avec petite animation ressort) quand on scrolle vers le bas,
   revient dès qu'on remonte. Reste toujours visible tout en haut de page,
   et ne se cache jamais pendant l'appui long / glisser sur la nav elle-même. */
(function(){
  const sc=document.getElementById('scroll'), navEl=document.getElementById('nav');
  if(!sc||!navEl) return;
  let lastY=sc.scrollTop, ticking=false;
  const THRESH=6, TOP_LOCK=24;
  function onScroll(){
    const y=sc.scrollTop;
    if(navEl.classList.contains('nav-dragging')){ lastY=y; ticking=false; return; }
    const dy=y-lastY;
    if(y<=TOP_LOCK){ navEl.classList.remove('nav-hidden'); }
    else if(dy>THRESH){ navEl.classList.add('nav-hidden'); lastY=y; }
    else if(dy<-THRESH){ navEl.classList.remove('nav-hidden'); lastY=y; }
    ticking=false;
  }
  sc.addEventListener('scroll',()=>{
    if(!ticking){ requestAnimationFrame(onScroll); ticking=true; }
  },{passive:true});
})();
function nudgeScroll(){
  const sc=document.getElementById('scroll'); if(!sc) return;
  const y=sc.scrollTop;
  sc.style.overflowY='hidden';
  requestAnimationFrame(()=>{ sc.style.overflowY='auto'; sc.scrollTop=y; });
}
function boot(){
  hideAppSkeleton();
  detectLangIfUnset(); // 1re ouverture : pré-règle la langue depuis le téléphone (modifiable ensuite dans Profil)
  applyTheme(); // applique le mode (clair/sombre) dès le démarrage
  applyStaticLabels();
  checkConnectivity();
  if(P.notif!==false) ensureNotifPerm();
  positionNavPill(document.querySelector('.nb.on')||document.querySelector('.nb'));
  window.addEventListener('resize',()=>positionNavPill(document.querySelector('.nb.on')));
  if(!P.setupDone){ startOnboarding(); return; }  // création profil  // création profil
  initApp();                                      // app
}
/* Ne s'exécute qu'une fois, avant la création du profil : devine la langue
   depuis les réglages du téléphone (fr/en/ar supportés, sinon fr par défaut).
   Une fois choisie manuellement dans Profil → Langue, P.lang n'est plus jamais
   réécrit ici (setupDone devient true après l'onboarding). */
function detectLangIfUnset(){
  if(P.lang || P.setupDone) return;
  const nav=(navigator.language||navigator.userLanguage||'fr').toLowerCase();
  P.lang = nav.startsWith('ar') ? 'ar' : nav.startsWith('en') ? 'en' : 'fr';
  document.documentElement.lang=P.lang;
  document.documentElement.dir=(P.lang==='ar')?'rtl':'ltr';
}

/* ============ CONNEXION / COMPTE (Supabase) ============ */
function startLogin(){
  hideAppSkeleton(); loginMode='login'; renderLoginMain(); $('#login').classList.add('on'); scheduleMotionSettle(2200);
  // Retour d'un aller-retour Google qui n'a pas abouti : sans ce message, la
  // personne revient sur un écran de connexion identique à celui qu'elle vient
  // de quitter, sans la moindre explication — d'où l'impression que le bouton
  // Google "ne fait rien". Le drapeau est posé juste avant la redirection et
  // effacé dès qu'une session existe (cf. finishLogin).
  try{
    const ts=+(localStorage.getItem('ikorun_googleAttempt')||0);
    if(ts){
      localStorage.removeItem('ikorun_googleAttempt');
      if(Date.now()-ts < 10*60*1000) setTimeout(()=>setLoginStatus(t('googleReturnedNoSessionToast'),'bad'),300);
    }
  }catch(e){}
}
function endLogin(){ $('#login').classList.remove('on'); }

async function startApp(){
  if(!window.supabaseClient){ await window.DB_READY; boot(); return; }

  // Filet de sécurité : si l'init reste bloquée trop longtemps, on débloque le
  // skeleton. MAIS on ne renvoie vers le login QUE si aucune session n'existe :
  // renvoyer quelqu'un de connecté sur l'écran de connexion (ce qui arrivait au
  // retour de Google quand une étape d'après-connexion traînait ou plantait)
  // donne exactement l'impression que « la connexion Google ne marche plus »,
  // alors que le serveur a bien créé la session.
  let _startAppSettled=false;
  const _forceUnstick=setTimeout(async ()=>{
    if(_startAppSettled) return;
    console.warn('[IKORUN] startApp trop long — déblocage forcé du skeleton');
    let hasSession=false;
    try{ const { data:{ session } } = await window.supabaseClient.auth.getSession(); hasSession=!!session; }catch(e){}
    if(_startAppSettled) return;
    if(hasSession){ hideAppSkeleton(); toast(t('syncSlowToast')); }
    else startLogin();
  },10000);
  const _markSettled=()=>{ _startAppSettled=true; clearTimeout(_forceUnstick); };

  let _loggedInOnce=false;
  async function finishLogin(userId,email,isAnon){
    if(_loggedInOnce) return; _loggedInOnce=true;
    try{ localStorage.removeItem('ikorun_googleAttempt'); }catch(e){} // aller-retour Google réussi
    window.currentUserId = userId;
    window.currentUserEmail = email;
    window.isGuestUser = !!isAnon;
    try{
      await window.DB_READY; // déchiffrement local — lancé en parallèle au chargement du script
      ensureLocalCacheOwnership(userId); // purge le cache d'un éventuel compte précédent avant toute lecture/écriture
      await cloudPullAll(userId);
      reloadState();
      saveAll();
    }catch(e){
      // La synchro cloud ou le cache local a échoué : on continue quand même
      // avec ce qu'on a en local. Rester bloqué (ou repartir au login) alors
      // que la session est valide est bien pire qu'un démarrage hors-ligne.
      console.error('[IKORUN] finishLogin — synchro impossible, démarrage local', e);
      toast(t('syncFailedLocalToast'));
    }
    try{
      endLogin();
      boot();
    }catch(e){
      // Un plantage de rendu ne doit jamais laisser l'app sur l'écran de
      // connexion : la session est bien là, on montre l'app.
      console.error('[IKORUN] finishLogin — boot a échoué', e);
      hideAppSkeleton(); endLogin();
    }finally{
      _markSettled();
    }
    try{ ensurePublicProfile().then(syncPublicProfile); }catch(e){}
  }
  // is_anonymous est le champ officiel du SDK Supabase pour un compte invité ;
  // le fallback sur user_metadata.ikorun_guest couvre le cas où ce champ ne
  // serait pas exposé (cf continueAsGuest()).
  function isAnonSession(u){ return !!(u && (u.is_anonymous || (u.user_metadata && u.user_metadata.ikorun_guest))); }

  // IMPORTANT : on enregistre l'écouteur AVANT tout appel à getSession().
  // Sinon, si le retour de Google (avec le jeton dans l'URL) est traité très
  // vite par le SDK, l'évènement SIGNED_IN peut arriver avant que ce code
  // n'écoute encore — et on le rate silencieusement (l'app reste bloquée sur
  // l'onboarding malgré une connexion réussie côté serveur).
  window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session){
      const wasFirstLogin = !_loggedInOnce;
      await finishLogin(session.user.id, session.user.email, isAnonSession(session.user));
      if(wasFirstLogin){ toast(t('welcomeToast')); sfx&&sfx('goal'); }
    } else if(event === 'SIGNED_OUT'){
      if(_intentionalSignOut){
        wipeLocalCache(); // purge immédiate des données locales à la déconnexion (hygiène + sécurité sur appareil partagé)
        location.reload();
      } else {
        // Session perdue sans que l'utilisateur ait rien demandé (jeton expiré,
        // rafraîchissement refusé, réseau coupé au mauvais moment) : on ne touche
        // PAS aux données locales, on renvoie simplement vers l'écran de connexion.
        // Se reconnecter avec le même compte les retrouve intactes.
        console.warn('[IKORUN] session perdue sans déconnexion volontaire — cache local conservé');
        try{ toast(t('sessionExpiredToast')); }catch(e){}
        try{ startLogin(); }catch(e){ location.reload(); }
      }
    }
  });

  // getSession() ne dépend pas du cache local déchiffré : on le lance sans
  // attendre DB_READY, qui tourne déjà en tâche de fond depuis le chargement
  // du script (économise un aller-retour réseau + IndexedDB en série).
  try{
    const { data:{ session } } = await window.supabaseClient.auth.getSession();
    if(session && session.user){
      await finishLogin(session.user.id, session.user.email, isAnonSession(session.user));
    } else {
      // Avec persistSession:true + autoRefreshToken:true, getSession() a déjà
      // restauré/renouvelé la session depuis le localStorage si elle existait.
      // Rien d'autre à tenter : direct au login.
      await window.DB_READY;
      _markSettled();
      startLogin();
    }
  }catch(e){
    console.error('[IKORUN] startApp erreur — fallback login',e);
    _markSettled();
    startLogin();
  }
}

function logout(){ signOutUser(); }
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
  // Détection des séances passées non faites → marque s.missed=true et ouvre
  // le flow "pourquoi manquée ?" (s'enchaîne tout seul sur les suivantes via
  // finalizeMissedSession). AVANT weeklyAdaptiveRegen : sans ça, missedCount
  // reste toujours à 0 et le plan ne s'adapte jamais après des jours d'absence.
  setTimeout(checkMissedSessions,700);
  // Régénération hebdomadaire adaptative du plan (au moins 1x/semaine si nécessaire)
  setTimeout(weeklyAdaptiveRegen,1000);
  if(window._launchTourAfterInit){
    window._launchTourAfterInit=false;
    setTimeout(startAppTour,1200);
  }
}
function confirmRegenPlan(){
  customConfirm(t('regenConfirm'),()=>{ PLAN=null; openPlanSetup(); },{danger:true});
}

/* ============ TOUR GUIDÉ — visite de présentation après inscription ============
   100% généré en JS (comme customConfirm) : pas de markup statique ajouté
   dans index.html. Le voile flouté est composé de 4 bandes indépendantes
   autour d'une zone découpée plutôt qu'un masque CSS sur data-URI, pour ne
   dépendre d'aucune autorisation supplémentaire dans la Content-Security-
   Policy. Séquence : accueil -> sport (création du plan) -> stats -> outils
   -> profil -> retour sport (déclenche la création réelle du plan). Rejouable
   à tout moment depuis Profil > Réglages > "Revoir le tutoriel", donc le
   moteur ne suppose jamais qu'il s'agit d'un premier lancement — seul
   finishOnboarding() pose le drapeau de lancement automatique (cf initApp). */
/* Le tour d'origine se contentait de nommer chaque onglet ("Tes statistiques :
   kilomètres, séances, VDOT...") sans jamais expliquer le fonctionnement réel
   de l'app — ce qu'est un bilan, pourquoi le plan change tout seul, qu'il n'y
   a pas de GPS. Deux étapes sans cible d'écran (centrées, sel:null) couvrent
   maintenant ce terrain conceptuel ; les autres restent ancrées sur un
   élément réel mais avec un texte qui explique plutôt que nomme. */
/* `sel` accepte une liste de sélecteurs candidats : le premier présent gagne.
   Nécessaire parce que #tourPlanCta n'existe QUE tant qu'aucun plan n'a été
   généré — or c'est justement l'inverse quand on rejoue le tour depuis le
   Profil. Avant, ces deux étapes étaient purement sautées : l'utilisateur
   perdait l'explication de l'onglet Sport ET la carte de fin, le tour
   s'arrêtant sans conclusion. `skipIf` sert au cas inverse : une étape qui
   parle d'un écran réellement inaccessible dans ce mode. */
const TOUR_STEPS=[
  { key:'welcome' },
  { key:'home', page:'home', sel:()=>P.easyMode?'#s-home .ik-greet':'#s-home .hv7-greet' },
  { key:'loop', page:'home' },
  { key:'sport', page:'sport', sel:['#tourPlanCta','#s-sport .sp-plan','#s-sport .pills'] },
  { key:'adapt', page:'sport' },
  { key:'stats', page:'stats', sel:()=>P.easyMode?'#s-stats .stat-quatro':'#s-stats .seg-ctrl' },
  // L'onglet Outils est masqué en mode simplifié : on n'y emmène donc personne.
  { key:'outils', page:'outils', sel:'#s-outils .searchbox', skipIf:()=>!!P.easyMode },
  { key:'profil', page:'profil', sel:'#s-profil .pf-hero' },
  { key:'club', page:'profil', sel:'#s-profil .pf-club-row' },
  { key:'final', page:'sport', sel:['#tourPlanCta','#s-sport .sp-plan'], final:true }
];
let _tourOn=false, _tourIdx=0, _tourBusy=false;

function tourSleep(ms){ return new Promise(res=>setTimeout(res,ms)); }
async function waitForTourEl(sel,timeout){
  timeout=timeout||1600;
  const t0=Date.now();
  while(Date.now()-t0<timeout){
    const el=$(sel);
    if(el) return el;
    await tourSleep(60);
  }
  return $(sel)||null;
}
function startAppTour(){
  if(_tourOn) return;
  // Rejoué depuis Profil > Réglages : referme la feuille de réglages en
  // dessous pour ne pas la laisser béante (avec un contenu qui n'aura pas
  // suivi la navigation du tour) une fois le tour terminé.
  if($('#ovProg') && $('#ovProg').classList.contains('on')) closeOv('ovProg');
  _tourOn=true; _tourIdx=0;
  buildTourDom();
  // La nav du bas reste visible et cliquable au-dessus du voile flouté :
  // repère constant pour savoir sur quel onglet on se trouve pendant le tour.
  const navEl=$('#nav'); if(navEl) navEl.style.zIndex=(parseInt($('#tourOv').style.zIndex,10)+1);
  const sc=$('#scroll'); if(sc) sc.style.overflow='hidden';
  window.addEventListener('resize',tourReposition);
  showTourStep(0);
}
function buildTourDom(){
  if($('#tourOv')) return;
  const ov=document.createElement('div');
  ov.id='tourOv'; ov.className='tour-ov';
  ov.style.zIndex=topZ();
  ov.innerHTML=
    '<div class="tour-band" id="tbTop"></div>'+
    '<div class="tour-band" id="tbBottom"></div>'+
    '<div class="tour-band" id="tbLeft"></div>'+
    '<div class="tour-band" id="tbRight"></div>'+
    '<div class="tour-ring" id="tourRing"></div>'+
    '<div class="tour-card" id="tourCard">'+
      '<div class="tour-prog" id="tourDots"></div>'+
      '<div class="tour-tab" id="tourTab"></div>'+
      '<div class="tour-t" id="tourT"></div>'+
      '<div class="tour-d" id="tourD"></div>'+
      '<div class="tour-actions">'+
        '<span class="tour-skip" id="tourSkip">'+t('tourSkip')+'</span>'+
        '<button class="btn" id="tourNext"></button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(ov);
  $('#tourSkip').onclick=()=>endTour();
  $('#tourNext').onclick=()=>tourNext();
}
function renderTourDots(i){
  const el=$('#tourDots'); if(!el) return;
  el.innerHTML=TOUR_STEPS.map((s,idx)=>'<div class="'+(idx<=i?'on':'')+'"></div>').join('');
}
async function showTourStep(startI){
  _tourBusy=true;
  try{
    let i=startI;
    while(true){
      const step=TOUR_STEPS[i];
      if(!step){ endTour(); return; }
      if(step.skipIf && step.skipIf()){ i=i+1; continue; } // étape sans objet dans ce mode
      _tourIdx=i;
      const ov=$('#tourOv'); if(!ov) return;
      ov.classList.add('on');
      resetTourVeil();
      if(step.page) nav(step.page);
      let sel=typeof step.sel==='function'?step.sel():step.sel;
      if(Array.isArray(sel)) sel=sel.find(s=>$(s))||sel[sel.length-1];
      let el=null;
      if(sel){
        el=await waitForTourEl(sel);
        if(!_tourOn || _tourIdx!==i) return; // le tour a été fermé/a changé d'étape entretemps
        // Cible introuvable : on affiche quand même l'étape, carte centrée et sans
        // anneau. La sauter faisait disparaître du contenu (et la carte de fin) selon
        // l'état de l'app ; le contenu prime, l'ancrage visuel n'est qu'un bonus.
        if(el){
          // "smooth" pouvait encore être en cours d'animation après les 320ms d'attente sur une
          // longue distance de scroll (ex: une rangée bas de page Profil) : l'anneau se figeait
          // alors sur la position mesurée avant la fin réelle du défilement, décalé de l'élément
          // réellement visé. "auto" scrolle instantanément, donc la position est stable dès la mesure.
          try{ el.scrollIntoView({block:'center',behavior:'auto'}); }catch(e){}
          await tourSleep(320);
          if(!_tourOn || _tourIdx!==i) return;
        }
      }
      $('#tourT').textContent = step.key==='welcome' ? tp('tour_welcome_t',P.name?P.name.split(' ')[0]:t('you')) : t('tour_'+step.key+'_t');
      $('#tourD').textContent=t('tour_'+step.key+'_d');
      $('#tourTab').textContent = step.page?t('nav_'+step.page):'';
      $('#tourNext').textContent = step.final?t('tourFinalBtn'):(i===0?t('tourStartBtn'):t('tourNextBtn'));
      $('#tourSkip').style.visibility = step.final?'hidden':'visible';
      renderTourDots(i);
      positionTourOn(el);
      // Certains écrans se dessinent en deux temps (Stats affiche un squelette puis
      // remplace tout son contenu une fois les calculs finis) : l'élément mesuré ici
      // peut donc être détaché de la page juste après, laissant l'anneau sur une
      // position fantôme. On recale sur la cible fraîchement retrouvée, deux fois,
      // le temps que ces rendus différés se posent.
      [260,760].forEach(d=>setTimeout(()=>{ if(_tourOn && _tourIdx===i) tourReposition(); },d));
      return;
    }
  } finally { _tourBusy=false; }
}
function tourNext(){
  if(_tourBusy) return;
  const step=TOUR_STEPS[_tourIdx];
  if(step && step.final){ endTour(); openPlanSetup(); return; }
  showTourStep(_tourIdx+1);
}
function endTour(){
  _tourOn=false;
  window.removeEventListener('resize',tourReposition);
  const sc=$('#scroll'); if(sc) sc.style.overflow='';
  const navEl=$('#nav'); if(navEl) navEl.style.zIndex='';
  const ov=$('#tourOv'); if(ov) ov.remove();
}
function tourReposition(){
  if(!_tourOn) return;
  const step=TOUR_STEPS[_tourIdx]; if(!step) return;
  let sel=typeof step.sel==='function'?step.sel():step.sel;
  if(Array.isArray(sel)) sel=sel.find(s=>$(s))||null;
  positionTourOn(sel?$(sel):null);
}
// L'overlay du tour est attaché à document.body, donc dans le sous-arbre zoomé
// du mode simplifié : ses coordonnées doivent être compensées comme partout
// ailleurs (voir uiZoomFactor). Sans ça l'anneau dérivait d'autant plus qu'on
// descendait dans la page.
function setTourBand(el,x,y,w,h){
  if(!el) return;
  if(w<=0||h<=0){ el.style.display='none'; return; }
  el.style.display='block';
  el.style.left=x+'px'; el.style.top=y+'px'; el.style.width=w+'px'; el.style.height=h+'px';
}
function resetTourVeil(){
  const z=uiZoomFactor();
  const W=innerWidth/z,H=innerHeight/z;
  setTourBand($('#tbTop'),0,0,W,H);
  setTourBand($('#tbBottom'),0,0,0,0); setTourBand($('#tbLeft'),0,0,0,0); setTourBand($('#tbRight'),0,0,0,0);
  const ring=$('#tourRing'); if(ring) ring.style.display='none';
}
function positionTourOn(el){
  const card=$('#tourCard');
  const z=uiZoomFactor();
  const W=innerWidth/z, H=innerHeight/z;
  if(!el){
    resetTourVeil();
    if(card) card.classList.add('centered');
    return;
  }
  if(card) card.classList.remove('centered');
  const r0=el.getBoundingClientRect();
  const r={left:r0.left/z, top:r0.top/z, right:r0.right/z, bottom:r0.bottom/z, width:r0.width/z, height:r0.height/z};
  const pad=10, rx=16;
  const x=Math.max(0,r.left-pad), y=Math.max(0,r.top-pad);
  const w=Math.min(W-x,r.width+pad*2), h=Math.min(H-y,r.height+pad*2);
  setTourBand($('#tbTop'),0,0,W,y);
  setTourBand($('#tbBottom'),0,y+h,W,H-(y+h));
  setTourBand($('#tbLeft'),0,y,x,h);
  setTourBand($('#tbRight'),x+w,y,W-(x+w),h);
  const ring=$('#tourRing');
  if(ring){
    ring.style.display='block';
    ring.style.left=x+'px'; ring.style.top=y+'px'; ring.style.width=w+'px'; ring.style.height=h+'px'; ring.style.borderRadius=rx+'px';
  }
  if(card){
    const cardH=card.offsetHeight||190;
    const spaceBelow=H-r.bottom, spaceAbove=r.top;
    let top;
    if(spaceBelow>=cardH+34) top=r.bottom+pad+18;
    else if(spaceAbove>=cardH+34) top=r.top-pad-18-cardH;
    else top=Math.max(14,Math.min(H-cardH-14,(H-cardH)/2));
    card.style.top=top+'px';
  }
}

/* ============ GUIDE D'INSCRIPTION — aide dès l'écran email/mot de passe ============
   Réutilise le même moteur bas niveau que le tour applicatif (buildTourDom,
   positionTourOn, resetTourVeil, waitForTourEl...) puisque c'est exactement
   le même composant visuel (voile flouté + anneau + carte), mais avec sa
   propre séquence et sans navigation entre pages (un seul écran). Se lance
   automatiquement une fois par appareil à l'ouverture du formulaire
   d'inscription (switchLoginMode('signup')), et reste accessible ensuite via
   le lien "Besoin d'aide ?". Les deux guides ne tournent jamais en même
   temps (l'un est avant la création du compte, l'autre après l'onboarding),
   donc le partage du même DOM #tourOv est sans risque tant que chacun le
   nettoie correctement à la fin (ov.remove()). */
const SIGNUP_GUIDE_STEPS=[
  { key:'sg_welcome' },
  { key:'sg_email', sel:'#li_email' },
  { key:'sg_password', sel:'#li_password' },
  { key:'sg_submit', sel:'#li_submit' }
];
let _sgOn=false, _sgIdx=0, _sgBusy=false;
function startSignupGuide(){
  if(_sgOn || _tourOn) return;
  try{ localStorage.setItem('ikorun_signupGuideSeen','1'); }catch(e){}
  _sgOn=true; _sgIdx=0;
  buildTourDom();
  $('#tourSkip').onclick=()=>endSignupGuide();
  $('#tourNext').onclick=()=>signupGuideNext();
  showSignupGuideStep(0);
}
function renderSgDots(i){
  const el=$('#tourDots'); if(!el) return;
  el.innerHTML=SIGNUP_GUIDE_STEPS.map((s,idx)=>'<div class="'+(idx<=i?'on':'')+'"></div>').join('');
}
async function showSignupGuideStep(i){
  _sgBusy=true;
  try{
    const step=SIGNUP_GUIDE_STEPS[i];
    if(!step){ endSignupGuide(); return; }
    _sgIdx=i;
    const ov=$('#tourOv'); if(!ov) return;
    ov.classList.add('on');
    resetTourVeil();
    let el=null;
    if(step.sel){
      el=await waitForTourEl(step.sel,900);
      if(!_sgOn || _sgIdx!==i) return; // guide fermé/étape changée entretemps
      try{ el.scrollIntoView({block:'center',behavior:'smooth'}); }catch(e){}
      await tourSleep(280);
      if(!_sgOn || _sgIdx!==i) return;
    }
    $('#tourTab').textContent='';
    $('#tourT').textContent=t('tour_'+step.key+'_t');
    $('#tourD').textContent=t('tour_'+step.key+'_d');
    const isLast = i===SIGNUP_GUIDE_STEPS.length-1;
    $('#tourNext').textContent = isLast?t('tourGotItBtn'):(i===0?t('tourStartBtn'):t('tourNextBtn'));
    $('#tourSkip').style.visibility = isLast?'hidden':'visible';
    renderSgDots(i);
    positionTourOn(el);
  } finally { _sgBusy=false; }
}
function signupGuideNext(){
  if(_sgBusy) return;
  if(_sgIdx>=SIGNUP_GUIDE_STEPS.length-1){ endSignupGuide(); return; }
  showSignupGuideStep(_sgIdx+1);
}
function endSignupGuide(){
  _sgOn=false;
  const ov=$('#tourOv'); if(ov) ov.remove();
}
function maybeResumeLive(){
  const snap=DB.load('live_active'); if(!snap||LIVE) return;
  const base=allProgs().find(x=>x.id===snap.progId); if(!base){ DB.remove('live_active'); return; }
  // On repart de la liste d'exercices sauvegardée dans la séance (progEx) si elle existe,
  // pour ne pas perdre les ajouts/suppressions faits en pleine séance avant le rechargement.
  const prog={...base,ex:snap.progEx||base.ex};
  const mins=Math.round((Date.now()-snap.start)/60000);
  if(mins>180){ DB.remove('live_active'); return; } // trop vieux
  customConfirm(tp('resumeSessionConfirm',prog.name,mins),()=>{
    LIVE={prog,idx:snap.idx,start:snap.start,state:snap.state,tonnage:snap.tonnage,setsDone:snap.setsDone};
    liveOpenEx=snap.idx||0;
    renderLive(); openOv('ovLive'); liveTimer=setInterval(updateLiveTimer,500); startBgActivity(tp('sessionColonName',prog.name));
  },{yesLabel:t('resumeBtn'),noLabel:t('discardBtn'),onNo:()=>{ DB.remove('live_active'); }});
}

/* ---------- ONBOARDING ---------- */
let obStep=1; const OB_MAX=6;
let obMode=null; // 'simple' | 'complet' — choisi explicitement à l'étape 4, jamais imposé
function startOnboarding(){
  obMode=null;
  applyOnboardingLabels();
  $('#ob').classList.add('on');
  const prog=$('#obProg'); prog.innerHTML='';
  for(let i=1;i<=OB_MAX;i++){ const d=document.createElement('div'); if(i===1)d.classList.add('on'); prog.appendChild(d); }
  // pill selectors
  $('#ob_level').querySelectorAll('.pill').forEach(p=>p.onclick=()=>{ $('#ob_level').querySelectorAll('.pill').forEach(x=>x.classList.remove('on')); p.classList.add('on'); });
  // Langue et couleur : préférences appliquées EN DIRECT (applyTheme/setLang
  // s'exécutent immédiatement) pour que le reste de l'onboarding s'affiche
  // déjà dans la langue et la couleur choisies, au lieu de les découvrir
  // seulement après la création du compte.
  obRenderLangPicker();
  obRenderThemePicker();
  obRenderAccentPicker();
  $('#ob_mode').querySelectorAll('.ob-mode-card').forEach(c=>c.onclick=()=>obPickMode(c.dataset.v));
  OB_PERFS=[{dist:null,meters:null,timeS:null}];
  renderPerfRows();
  obUsernameOk=false;
  obUsernameAuto=true;
  wireUsernameField('ob_username','ob_username_status',ok=>{ obUsernameOk=ok; });
  wireAutoUsername();
  obShow(1);
}
/* Langue et couleur choisies dès l'écran de bienvenue plutôt que devinées
   (langue) ou laissées par défaut (couleur, toujours bleu jusqu'ici). setLang
   et setAccent existent déjà (utilisées dans Profil) : on les réutilise telles
   quelles, P étant déjà un objet valide (même sparse) avant la fin de
   l'onboarding — voir reloadState(). */
function obRenderLangPicker(){
  const box=$('#ob_lang'); if(!box) return;
  box.querySelectorAll('.pill').forEach(p=>{
    p.classList.toggle('on', p.dataset.l===curLang());
    p.onclick=()=>{ setLang(p.dataset.l); applyOnboardingLabels(); };
  });
}
function obRenderThemePicker(){
  const box=$('#ob_theme'); if(!box) return;
  box.innerHTML=pfThemeSwitchHTML();
}
function obRenderAccentPicker(){
  const box=$('#ob_accent'); if(!box) return;
  box.innerHTML=pfAccentPickerHTML();
  box.querySelectorAll('.accent-dot').forEach(d=>{
    // pfAccentPickerHTML() pose déjà onclick="setAccent(...)" ; on ajoute
    // juste le rafraîchissement visuel propre à l'onboarding par-dessus.
    d.addEventListener('click',()=>setTimeout(obRenderAccentPicker,0));
  });
}
// Mode d'affichage : deux cartes, aucune présélection imposée — seule une
// suggestion textuelle apparaît une fois la date de naissance connue (l'âge
// n'est qu'un indice, jamais une décision prise à la place de la personne).
function obPickMode(v){
  obMode=v;
  $('#ob_mode').querySelectorAll('.ob-mode-card').forEach(c=>c.classList.toggle('on',c.dataset.v===v));
  $('#ob_mode_hint').textContent='';
}
function obModeSuggestion(){
  const bday=$('#ob_bday')?.value; if(!bday) return null;
  const ageYears=Math.floor((Date.now()-new Date(bday))/31557600000);
  return ageYears>26?'simple':'complet';
}
/* Traduit le HTML statique de l'onboarding (index.html) selon curLang().
   Les data-v des pills de niveau restent en français en interne (utilisés
   comme clés par kmWeekFromLevel/finishOnboarding) — seul l'affichage change. */
function applyOnboardingLabels(){
  const step1=$('.ob-step[data-step="1"]');
  if(step1){
    const h1=step1.querySelector('h1'),p=step1.querySelector('.intro');
    if(h1)h1.textContent=t('obWelcomeTitle'); if(p)p.innerHTML=t('obWelcomeIntro');
    $('#obLangLab').textContent=t('langLab'); $('#obThemeLab').textContent=t('theme'); $('#obColorLab').textContent=t('colorLab');
    obRenderLangPicker();
  }
  const step2=$('.ob-step[data-step="2"]');
  if(step2){
    step2.querySelector('h1').textContent=t('obWhoTitle'); step2.querySelector('.intro').textContent=t('obWhoIntro');
    $('#ob_name').placeholder=t('firstNamePh'); $('#ob_name').closest('.field').querySelector('label').textContent=t('firstNameReq');
    $('#ob_username').placeholder=t('usernamePh'); $('#ob_username_status').textContent=t('usernameFormatHint');
    step2.querySelectorAll('.field label')[1].textContent=t('usernameReq');
    step2.querySelectorAll('.field label')[2].textContent=t('birthDateReq');
    step2.querySelectorAll('.field label')[3].textContent=t('sexReq');
    const sexSel=$('#ob_sex'); sexSel.options[0].textContent=t('selectLab'); sexSel.options[1].textContent=t('maleLab'); sexSel.options[2].textContent=t('femaleLab');
  }
  const step3=$('.ob-step[data-step="3"]');
  if(step3){
    step3.querySelector('h1').textContent=t('obLevelTitle'); step3.querySelector('.intro').textContent=t('obLevelIntro');
    step3.querySelector('.note span').innerHTML=t('levelNote');
    const lvLabel=step3.querySelector('.field > label'); lvLabel.childNodes[0].textContent=t('levelReq')+' '; lvLabel.querySelector('span').textContent=t('howChooseLab');
    const pills=$('#ob_level').querySelectorAll('.pill');
    const map={'Débutant':'lvlBeginner','Intermédiaire':'lvlIntermediate','Confirmé':'lvlAdvanced','Très avancé':'lvlVeryAdvanced','Élite':'lvlElite'};
    pills.forEach(p=>{ const k=map[p.dataset.v]; if(k) p.textContent=t(k); });
  }
  const step4=$('.ob-step[data-step="4"]');
  if(step4){
    step4.querySelector('h1').textContent=t('obModeTitle'); step4.querySelector('.intro').textContent=t('obModeIntro');
    const cards=$('#ob_mode').querySelectorAll('.ob-mode-card');
    cards[0].querySelector('.ob-mode-t').textContent=t('obModeFullT'); cards[0].querySelector('.ob-mode-d').textContent=t('obModeFullD');
    cards[1].querySelector('.ob-mode-t').textContent=t('obModeSimpleT'); cards[1].querySelector('.ob-mode-d').textContent=t('obModeSimpleD');
  }
  const step5=$('.ob-step[data-step="5"]');
  if(step5){
    step5.querySelector('h1').textContent=t('obGoalTitle'); step5.querySelector('.intro').textContent=t('obGoalIntro');
    const labels=step5.querySelectorAll('.field label');
    labels[0].textContent=t('goalReq'); $('#ob_goal').placeholder=t('goalPh');
    labels[1].textContent=t('compDateReq');
  }
  const step6=$('.ob-step[data-step="6"]');
  if(step6){
    step6.querySelector('h1').textContent=t('obPerfTitle'); step6.querySelector('.intro').textContent=t('obPerfIntro');
    step6.querySelector('.note span').innerHTML=t('perfNote');
    $('#ob_addperf').textContent=t('addAnotherPerf');
  }
  $('#obPrev').textContent=t('backLab');
  $('#obNext').textContent=obStep===OB_MAX?t('finishLab'):t('continueLab');
  renderPerfRows();
}
/* Traduit les titres statiques des overlays génériques + le picker à roues.
   Les titres dynamiques (Profil, Badges, Amis, Outils...) sont déjà gérés
   par leurs fonctions d'ouverture respectives (openXxx). */
function applyStaticLabels(){
  const map={ovSettings:'paramsTitle',ovLib:'libTitle',ovCfg:'configureTitle',ovCreate:'newProgramTitle'};
  Object.entries(map).forEach(([id,key])=>{ const el=$('#'+id); if(el){ const h2=el.querySelector('h2'); if(h2) h2.textContent=t(key); } });
  const pkOk=$('#pkOk'); if(pkOk) pkOk.textContent=t('validateLab2');
  if(document.body.dataset.scr==='home'){ const tbTitle=$('#tbTitle'); if(tbTitle) tbTitle.textContent=t('home'); }
}
let obUsernameOk=false;
let obUsernameAuto=true; // tant que vrai, le pseudo se génère automatiquement à partir du prénom
async function isUsernameAvailableRaw(v){
  if(!usernameFormatOk(v)) return false;
  if(!window.supabaseClient) return true;
  try{
    const { data, error } = await window.supabaseClient.rpc('username_available',{ p_username:v, p_uid:window.currentUserId||null });
    if(error){ console.error('username_available error',error); return false; }
    return !!data;
  }catch(e){ console.error('username_available exception',e); return false; }
}
// Propose d'abord le pseudo le plus simple et le plus proche du prénom donné
// (le prénom tel quel), et ne rajoute un suffixe que si c'est vraiment nécessaire.
async function suggestAvailableUsername(name){
  let base=slugifyUsername(name);
  if(base.length<3) base=(base||'runner').padEnd(3,'0');
  if(base.length>20) base=base.slice(0,20);
  if(await isUsernameAvailableRaw(base)) return base;
  for(let i=2;i<=99;i++){
    const c=(base+i).slice(0,20);
    if(await isUsernameAvailableRaw(c)) return c;
  }
  return (base+Math.floor(Math.random()*900+100)).slice(0,20);
}
let _autoUnameGen=0;
function wireAutoUsername(){
  const nameInp=$('#ob_name'); if(!nameInp) return;
  let deb=null;
  nameInp.oninput=()=>{
    if(!obUsernameAuto) return;
    clearTimeout(deb);
    deb=setTimeout(async ()=>{
      const name=nameInp.value.trim();
      if(!name) return;
      const mySeq=++_autoUnameGen;
      const uInp=$('#ob_username'); if(!uInp) return;
      const stEl=$('#ob_username_status');
      if(stEl){ stEl.textContent=t('checkingLab'); stEl.className='uname-status checking'; }
      const u=await suggestAvailableUsername(name);
      if(mySeq!==_autoUnameGen || !obUsernameAuto) return; // le prénom a changé ou l'utilisateur a repris la main entretemps
      uInp.value=u;
      checkUsernameLive(u,stEl,uInp).then(ok=>{ if(ok!==null) obUsernameOk=ok; });
    },350);
  };
  const uInp=$('#ob_username');
  if(uInp) uInp.addEventListener('input',()=>{ obUsernameAuto=false; },{once:true});
}
function slugifyUsername(name){
  let s=(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  s=s.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  if(s.length>14) s=s.slice(0,14);
  return s;
}
/* ===== Étape Performances : lignes Distance | Temps ===== */
let OB_PERFS=[{dist:null,meters:null,timeS:null}];
function renderPerfRows(){
  const box=$('#ob_perfs'); if(!box) return;
  let h='';
  OB_PERFS.forEach((p,i)=>{
    h+='<div class="perfrow">';
    h+='<div class="perfcard" onclick="pickPerfDist('+i+')"><div class="pcl">'+t('distanceLab2')+'</div><div class="pcv '+(p.dist?'':'empty')+'">'+(p.dist||t('chooseWord'))+'</div></div>';
    h+='<div class="perfcard" onclick="pickPerfTime('+i+')"><div class="pcl">'+t('timeField')+'</div><div class="pcv '+(p.timeS!=null?'':'empty')+'">'+(p.timeS!=null?fmtTime(p.timeS):t('chooseWord'))+'</div></div>';
    if(OB_PERFS.length>1) h+='<div class="perfdel" onclick="delPerfRow('+i+')">'+ICN('trash',16)+'</div>';
    h+='</div>';
  });
  box.innerHTML=h;
}
function addPerfRow(){ OB_PERFS.push({dist:null,meters:null,timeS:null}); renderPerfRows(); }
function openLevelGuide(){
  const lv=[
    ['seedling',t('lvlBeginner'),t('lvlBeginnerDesc')],
    ['run',t('lvlIntermediate'),t('lvlIntermediateDesc')],
    ['bolt',t('lvlAdvanced'),t('lvlAdvancedDesc')],
    ['fire',t('lvlVeryAdvanced'),t('lvlVeryAdvancedDesc')],
    ['medal',t('lvlElite'),t('lvlEliteDesc')]
  ];
  let h=lv.map(x=>'<div class="card" style="margin-bottom:10px;padding:14px"><div style="font-weight:700;font-size:15px;margin-bottom:5px;display:flex;align-items:center;gap:8px">'+ICN(x[0],18,'var(--e)')+x[1]+'</div><div style="font-size:13px;color:var(--muted);line-height:1.5">'+x[2]+'</div></div>').join('');
  h+='<button class="btn" onclick="closeOv(\'ovProg\')">'+t('understoodLab')+'</button>';
  $('#ovProgTitle').textContent=t('howChooseLevelTitle'); $('#progBody').innerHTML=h;
  // place l'overlay au-dessus de l'onboarding
  $('#ovProg').style.zIndex='13700'; openOv('ovProg');
}
function delPerfRow(i){ OB_PERFS.splice(i,1); renderPerfRows(); }
function pickPerfDist(i){
  const names=REC_DISTANCES.map(d=>d[0]).concat([t('otherDist')]);
  openPicker({title:t('distanceLab2'),cols:[{values:names,sel:Math.max(0,names.indexOf(OB_PERFS[i].dist)),wide:true}],onOk:idx=>{
    const name=names[idx[0]];
    if(name===t('otherDist')){ pickDistance(t('customDistance'),OB_PERFS[i].meters?OB_PERFS[i].meters/1000:5,km=>{ OB_PERFS[i].dist=(km>=1?km+' km':Math.round(km*1000)+' m'); OB_PERFS[i].meters=Math.round(km*1000); renderPerfRows(); }); }
    else { const d=REC_DISTANCES[idx[0]]; OB_PERFS[i].dist=d[0]; OB_PERFS[i].meters=d[1]; renderPerfRows(); }
  }});
}
function pickPerfTime(i){
  const m=OB_PERFS[i].meters||5000; const longRace=m>=15000;
  pickTime(tp('timeForLab',OB_PERFS[i].dist||''),OB_PERFS[i].timeS!=null?OB_PERFS[i].timeS:(m>=10000?2700:m>=5000?1200:300),v=>{ OB_PERFS[i].timeS=v; renderPerfRows(); },longRace);
}
function obShow(n){
  obStep=n;
  $$('.ob-step').forEach(s=>s.classList.toggle('on',+s.dataset.step===n));
  $('#obProg').querySelectorAll('div').forEach((d,i)=>d.classList.toggle('on',i<n));
  $('#obPrev').style.visibility=n===1?'hidden':'visible';
  $('#obNext').textContent=n===OB_MAX?t('finishLab'):t('continueLab');
  $('#ob').scrollTop=0;
  // Étape "Ton affichage" : un simple indice textuel basé sur l'âge déjà
  // saisi, jamais une présélection — la carte reste vide tant que personne
  // n'a tapé dessus.
  if(n===4 && !obMode){
    const sugg=obModeSuggestion();
    if(sugg) $('#ob_mode_hint').textContent=tp('obModeSuggestion',t(sugg==='simple'?'obModeSimpleT':'obModeFullT'));
  }
}
$('#obPrev').onclick=()=>{
  if(obStep<=1) return;
  obShow(obStep-1);
};
$('#obNext').onclick=()=>{
  if(!obValidate(obStep)) return;
  if(obStep===OB_MAX){ finishOnboarding(); return; }
  obShow(obStep+1);
};
function obValidate(n){
  if(n===2){
    if(!$('#ob_name').value.trim()||!$('#ob_bday').value||!$('#ob_sex').value){ toast(t('fillRequiredFields')); return false; }
    if(!$('#ob_username').value.trim()){ toast(t('chooseUsernameLab')); return false; }
    if(!obUsernameOk){ toast(t('usernameUnavailable')); return false; }
  }
  if(n===3){ if(!$('#ob_level').querySelector('.pill.on')){ toast(t('chooseLevelLab')); return false; } }
  if(n===4){ if(!obMode){ toast(t('chooseModeLab')); return false; } }
  if(n===5){ if(!$('#ob_goal').value.trim()||!$('#ob_compdate').value){ toast(t('goalDateRequired')); return false; } }
  if(n===6){ const valid=OB_PERFS.filter(p=>p.meters&&p.timeS); if(!valid.length){ toast(t('addAtLeastOnePerf')); return false; } }
  return true;
}
/* Volume hebdo initial déduit du niveau déclaré (l'utilisateur n'a plus à
   deviner un chiffre) : affiné ensuite automatiquement par le moteur au fil
   des séances réelles, et ajustable dans Profil / lors de la génération d'un plan. */
function kmWeekFromLevel(level){
  return ({'Débutant':20,'Intermédiaire':35,'Confirmé':50,'Très avancé':70,'Élite':90})[level]||35;
}
function finishOnboarding(){
  // Les jours d'entraînement ne sont plus demandés ici : ils sont choisis
  // au moment de la génération du plan (openPlanSetup), pour rester à jour.
  // Enregistre les performances saisies
  const valid=OB_PERFS.filter(p=>p.meters&&p.timeS!=null);
  RECORDS=valid.map(p=>({dist:p.dist,meters:p.meters,time:fmtTime(p.timeS),date:todayKey()}));
  const find=m=>{ const r=valid.find(x=>x.meters===m); return r?fmtTime(r.timeS):''; };
  const level=$('#ob_level').querySelector('.pill.on').dataset.v;
  // Langue, thème clair/sombre et couleur ont déjà été appliqués en direct
  // (obRenderLangPicker/toggleThemeSwitch/setAccent) : on préserve simplement
  // ce qui a été choisi avant l'écrasement de P ci-dessous, plutôt que de
  // revenir à une langue détectée ou des valeurs par défaut qui ignoreraient
  // le choix fait à l'étape 1.
  const chosenLang=P.lang, chosenMode=P.mode||'dark', chosenTheme=P.theme||'blue';
  P={
    setupDone:true, joinedAt:Date.now(), lang:chosenLang, mode:chosenMode,
    name:$('#ob_name').value.trim(), username:$('#ob_username').value.trim(), bday:$('#ob_bday').value, sex:$('#ob_sex').value,
    level, kmWeek:kmWeekFromLevel(level),
    goal:$('#ob_goal').value.trim(), compDate:$('#ob_compdate').value,
    t5k:find(5000), t3k:find(3000), t1500:find(1500), t10k:find(10000),
    theme:chosenTheme, pb5k:find(5000), pb1500:find(1500), pb10k:find(10000),
    easyMode:obMode==='simple' // choisi explicitement à l'étape 4 — jamais deviné (modifiable ensuite dans Profil > Mode simplifié)
  };
  P.vdot=computeVDOTfromRecords()||computeVDOT();
  DB.save('profile',P); DB.save('records',RECORDS); DB.save('xp',XP);
  burst();
  if(P.username){
    claimUsername(P.username).then(ok=>{
      if(!ok) toast(t('usernameTakenMeanwhile'));
    });
  }
  // Drapeau consommé une seule fois par initApp() juste après le premier
  // rendu de l'accueil : lance le tour guidé uniquement pour un compte qui
  // vient de terminer l'onboarding (inscription classique OU invité), jamais
  // pour un compte existant qui rouvre l'app normalement.
  window._launchTourAfterInit=true;
  setTimeout(initApp,400);
}

/* ---------- INSTALLATION (Ajouter à l'écran d'accueil) ----------
   Chrome/Edge/Android déclenchent beforeinstallprompt : on le capture pour
   pouvoir ouvrir la vraie invite d'installation au clic sur notre bouton.
   Trois replis quand cette invite n'est pas disponible :
     - iOS : Safari ne supporte pas du tout beforeinstallprompt (aucune API
       d'installation programmatique n'existe chez Apple) → guide en 2 étapes
       (Partager > Sur l'écran d'accueil) ;
     - Android sans invite (déjà refusée récemment, ou pas encore émise) →
       guide en 2 étapes (menu ⋮ > Installer l'application) ;
     - desktop → message renvoyant vers le menu du navigateur.
   Prérequis côté navigateur pour que l'invite existe : HTTPS, service worker
   avec handler fetch, et surtout un manifest VALIDE et accessible — voir
   setupPWA() plus bas, dont l'ancien manifest blob cassait justement ce
   critère. */
let _installPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); _installPrompt=e; refreshInstallUI(); });
window.addEventListener('appinstalled',()=>{ _installPrompt=null; refreshInstallUI(); });
function isStandalone(){ try{ return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true; }catch(e){ return false; } }
function isIOSDevice(){ return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1); }
function isAndroidDevice(){ return /android/i.test(navigator.userAgent); }
function canOfferInstall(){ return !isStandalone() && (!!_installPrompt || isIOSDevice() || isAndroidDevice()); }
async function installApp(){
  if(_installPrompt){
    _installPrompt.prompt();
    const choice=await _installPrompt.userChoice;
    _installPrompt=null; refreshInstallUI();
    if(choice && choice.outcome==='accepted') toast(t('installAcceptedToast'));
    return;
  }
  // Pas d'invite programmatique disponible : soit la plateforme ne la supporte pas
  // (iOS), soit le navigateur ne l'a pas (encore) déclenchée. On montre alors le
  // chemin manuel correspondant à l'appareil plutôt que de ne rien faire.
  if(isIOSDevice()){ showInstallGuide('ios'); return; }
  if(isAndroidDevice()){ showInstallGuide('android'); return; }
  toast(t('installFallbackToast'));
}
function showInstallGuide(platform){
  const ios=platform==='ios';
  const h='<div style="text-align:center;padding:4px 0 14px;color:var(--e)">'+ICN(ios?'share':'download',40,'currentColor')+'</div>'+
    '<div class="tip" style="margin-bottom:10px">'+t(ios?'iosInstallStep1':'androidInstallStep1')+'</div>'+
    '<div class="tip" style="margin-bottom:14px">'+t(ios?'iosInstallStep2':'androidInstallStep2')+'</div>'+
    '<button class="btn" onclick="closeOv(\'ovProg\')">'+t('understoodLab')+'</button>';
  $('#ovProgTitle').textContent=t('installAppBtn'); $('#progBody').innerHTML=h; $('#ovProg').style.zIndex=topZ(); openOv('ovProg');
}
// Conservé pour compatibilité avec d'éventuels appels existants.
function showIosInstallGuide(){ showInstallGuide('ios'); }
// Le login se peint avant que beforeinstallprompt n'ait pu se déclencher (async) :
// on réévalue le bouton une fois l'événement reçu, sans attendre une re-navigation.
function refreshInstallUI(){
  const el=$('#loginInstallRow'); if(el) el.innerHTML=loginInstallButtonHTML();
  if($('#s-profil') && $('#s-profil').classList.contains('on')) renderProfile();
}
function loginInstallButtonHTML(){
  if(!canOfferInstall()) return '';
  return '<button class="btn ghost sm" style="width:100%;margin-top:12px" onclick="installApp()">'+ICN('download',16)+' '+t('installAppBtn')+'</button>';
}

/* ---------- THEME ---------- */
function effectiveMode(){ return P.mode==='light' ? 'light' : 'dark'; }
function applyTheme(){
  const mode=effectiveMode();
  document.documentElement.setAttribute('data-mode',mode);
  document.documentElement.setAttribute('data-accent',P.theme||'blue');
  document.documentElement.classList.toggle('easy-mode',!!P.easyMode);
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=(P.easyMode?(mode==='light'?'#FFFFFF':'#000000'):(mode==='light'?'#F2F4F8':'#0A0D12'));
  // Miroir en clair (mode/accent/easyMode ne sont pas des données sensibles) pour que
  // le script tout en haut de <head> puisse réappliquer le thème avant le premier
  // paint au prochain chargement, sans attendre le déchiffrement async du profil.
  try{ localStorage.setItem('ik_theme_prefs', JSON.stringify({mode, accent:P.theme||'blue', easyMode:!!P.easyMode})); }catch(e){}
}
/* Couleur d'accent de l'app : bleu (défaut) / vert militaire chromé / marron boisé chromé */
const ACCENTS=[{key:'blue',name:'accentBlue'},{key:'red',name:'accentRed'},{key:'green',name:'accentGreen'},{key:'brown',name:'accentBrown'},{key:'yellow',name:'accentYellow'},{key:'carbon',name:'accentCarbon'}];
function setAccent(c){
  P.theme=c; saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  refreshPfSheet();
  sfx&&sfx('tap');
  toast(t('colorApplied'));
}
function pfAccentPickerHTML(){
  const cur=P.theme||'blue';
  return '<div class="accent-picker">'+ACCENTS.map(a=>
    '<div class="accent-dot'+(cur===a.key?' on':'')+'" data-a="'+a.key+'" title="'+t(a.name)+'" onclick="event.stopPropagation();setAccent(\''+a.key+'\')"></div>'
  ).join('')+'</div>';
}
function toggleEasyMode(){
  P.easyMode=!P.easyMode; saveAll(); applyTheme();
  if($('#s-profil')&&$('#s-profil').classList.contains('on')) renderProfile();
  if($('#s-home')&&$('#s-home').classList.contains('on')) renderHome();
  // Le mode simplifié masque l'onglet Outils et change le zoom : sans replacement
  // explicite, la pastille de la nav restait sur l'ancienne position/largeur
  // jusqu'au prochain changement d'onglet.
  setTimeout(()=>positionNavPill(document.querySelector('.nb.on')),60);
  toast(P.easyMode?t('easyModeOn'):t('easyModeOff'));
}
function setMode(m){ P.mode=(m==='light')?'light':'dark'; saveAll(); applyTheme(); if($('#s-profil')&&$('#s-profil').classList.contains('on'))renderProfile(); refreshPfSheet(); }
// suit le thème du téléphone en mode auto


/* ---------- EXERCISE LIBRARY (100+) ---------- */
const LIB=[
 // Pectoraux
 {name:'Bench Press',sets:4,reps:'12',muscles:['Pectoraux','Triceps'],anim:'',tip:'Garde les omoplates serrées et les pieds ancrés au sol.'},
 {name:'Decline Bench Press',sets:4,reps:'12',muscles:['Pectoraux bas'],anim:'',tip:'Cible le bas des pectoraux, descends contrôlé.'},
 {name:'Dumbbell Incline Bench Press',sets:4,reps:'12',muscles:['Pectoraux haut'],anim:'',tip:'Banc à 30°, amplitude complète.'},
 {name:'Lever Seated Fly',sets:3,reps:'8',muscles:['Pectoraux'],anim:'',tip:'Serre les pectoraux en fin de mouvement, 1s de pause.'},
 {name:'Cable Crossover',sets:3,reps:'12-15',muscles:['Pectoraux'],anim:'',tip:'Légère flexion du buste, contraction au centre.'},
 {name:'Push Up',sets:3,reps:'AMRAP',muscles:['Pectoraux','Triceps'],anim:'',tip:'Gainage parfait, ne creuse pas le dos.'},
 {name:'Dumbbell Pullover',sets:3,reps:'12',muscles:['Pectoraux','Dos'],anim:'',tip:'Étire la cage thoracique, coudes semi-fléchis.'},
 // Dos
 {name:'Lever Lying T-bar Row',sets:3,reps:'10-12',muscles:['Dos','Trapèzes'],anim:'',tip:'Tire avec les coudes, serre les omoplates.'},
 {name:'Straight Back Seated Row',sets:3,reps:'6-10',muscles:['Dos'],anim:'',tip:'Dos droit, ne te penche pas en arrière.'},
 {name:'Bar Lateral Pulldown',sets:3,reps:'8-10',muscles:['Grand dorsal'],anim:'',tip:'Tire la barre vers la poitrine, coudes vers le bas.'},
 {name:'Pull Up',sets:3,reps:'AMRAP',muscles:['Grand dorsal','Biceps'],anim:'',tip:'Amplitude complète, contrôle la descente.'},
 {name:'Deadlift',sets:4,reps:'5',muscles:['Dos','Fessiers','Ischios'],anim:'',tip:'Dos neutre, pousse avec les jambes.'},
 {name:'Bent Over Row',sets:4,reps:'8-10',muscles:['Dos'],anim:'',tip:'Buste à 45°, gainage permanent.'},
 {name:'Single Arm Dumbbell Row',sets:3,reps:'10-12',muscles:['Dos'],anim:'',tip:'Appui sur banc, tire le coude haut.'},
 {name:'Lever Reverse Fly',sets:3,reps:'12-15',muscles:['Arrière épaules','Dos'],anim:'',tip:'Cible les deltoïdes postérieurs.'},
 // Biceps
 {name:'EZ-bar 21s',sets:4,reps:'21',muscles:['Biceps'],anim:'',tip:'7 bas + 7 haut + 7 complets, sans tricher.'},
 {name:'Hammer Curl',sets:4,reps:'6-12',muscles:['Biceps','Avant-bras'],anim:'',tip:'Prise neutre, coudes fixes.'},
 {name:'Biceps Curl',sets:4,reps:'12',muscles:['Biceps'],anim:'',tip:'Pas de balancier, contraction complète.'},
 {name:'Lever Preacher Curl',sets:3,reps:'4-10',muscles:['Biceps'],anim:'',tip:'Bras calés, descente lente.'},
 {name:'Concentration Curl',sets:3,reps:'10-12',muscles:['Biceps'],anim:'',tip:'Isole le biceps, coude contre la cuisse.'},
 {name:'Cable Curl',sets:3,reps:'12-15',muscles:['Biceps'],anim:'',tip:'Tension continue tout le mouvement.'},
 // Triceps
 {name:'Skull Crusher',sets:4,reps:'12',muscles:['Triceps'],anim:'',tip:'Coudes fixes, descends vers le front.'},
 {name:'Elbow Dips',sets:3,reps:'6-8',muscles:['Triceps','Pectoraux'],anim:'',tip:'Buste droit pour cibler triceps.'},
 {name:'Triceps Pushdown',sets:4,reps:'12',muscles:['Triceps'],anim:'',tip:'Coudes collés au corps, extension complète.'},
 {name:'Overhead Triceps Extension',sets:3,reps:'12',muscles:['Triceps'],anim:'',tip:'Coudes vers le haut, étire bien.'},
 {name:'Close Grip Bench Press',sets:4,reps:'8-10',muscles:['Triceps','Pectoraux'],anim:'',tip:'Mains largeur épaules, coudes serrés.'},
 // Épaules
 {name:'Seated Shoulder Press',sets:4,reps:'8',muscles:['Épaules'],anim:'',tip:'Dos calé, pousse à la verticale.'},
 {name:'Lever Seated Shoulder Press',sets:3,reps:'10-12',muscles:['Épaules'],anim:'',tip:'Trajectoire guidée, contrôle.'},
 {name:'Lateral Raise',sets:4,reps:'12',muscles:['Deltoïde latéral'],anim:'',tip:'Monte aux épaules, pas plus haut.'},
 {name:'Front Raise',sets:4,reps:'12',muscles:['Deltoïde antérieur'],anim:'',tip:'Pas de balancier, contrôle la descente.'},
 {name:'Cable Face Pull',sets:4,reps:'12-15',muscles:['Arrière épaules','Trapèzes'],anim:'',tip:'Tire vers le visage, écarte les coudes.'},
 {name:'Arnold Press',sets:3,reps:'10',muscles:['Épaules'],anim:'',tip:'Rotation des poignets durant la montée.'},
 {name:'Upright Row',sets:3,reps:'12',muscles:['Épaules','Trapèzes'],anim:'',tip:'Tire la barre sous le menton, coudes hauts.'},
 {name:'Shrug',sets:4,reps:'15',muscles:['Trapèzes'],anim:'',tip:'Hausse les épaules, pause en haut.'},
 // Jambes
 {name:'Lever Leg Extension',sets:4,reps:'8-12',muscles:['Quadriceps'],anim:'',tip:'Extension complète, pause 1s en haut.'},
 {name:'Lever Seated Leg Extension',sets:3,reps:'12',muscles:['Quadriceps'],anim:'',tip:'Contrôle la descente.'},
 {name:'Lever Lying Leg Curl',sets:4,reps:'6-12',muscles:['Ischios'],anim:'',tip:'Bassin collé, ramène les talons aux fesses.'},
 {name:'Lever Kneeling Leg Curl',sets:3,reps:'10-12',muscles:['Ischios'],anim:'',tip:'Isole l\u2019ischio, sans à-coup.'},
 {name:'Sled 45° Leg Wide Press',sets:4,reps:'8-12',muscles:['Quadriceps','Fessiers'],anim:'',tip:'Pieds larges pour cibler l\u2019intérieur.'},
 {name:'Sled 45° Leg Press',sets:3,reps:'10-12',muscles:['Quadriceps','Fessiers'],anim:'',tip:'Genoux dans l\u2019axe des pieds.'},
 {name:'Smith Squat',sets:3,reps:'10-12',muscles:['Quadriceps','Fessiers'],anim:'',tip:'Descends sous parallèle, dos droit.'},
 {name:'Back Squat',sets:5,reps:'5',muscles:['Quadriceps','Fessiers'],anim:'',tip:'Pousse le sol, respiration bloquée.'},
 {name:'Front Squat',sets:4,reps:'6-8',muscles:['Quadriceps'],anim:'',tip:'Coudes hauts, buste vertical.'},
 {name:'Bulgarian Split Squat',sets:3,reps:'10',muscles:['Quadriceps','Fessiers'],anim:'',tip:'Pied arrière surélevé, genou avant stable.'},
 {name:'Dumbbell Split Squat',sets:3,reps:'10',muscles:['Quadriceps','Fessiers'],anim:'',tip:'Buste droit, descente contrôlée.'},
 {name:'Walking Lunge',sets:3,reps:'12',muscles:['Quadriceps','Fessiers'],anim:'',tip:'Grandes foulées, genou ne dépasse pas.'},
 {name:'Lever Seated Calf Raise',sets:4,reps:'12',muscles:['Mollets'],anim:'',tip:'Amplitude max, étire en bas.'},
 {name:'Lever Seated One Leg Calf Raise',sets:3,reps:'15',muscles:['Mollets'],anim:'',tip:'Une jambe à la fois, contraction max.'},
 {name:'Standing Calf Raise',sets:4,reps:'15',muscles:['Mollets'],anim:'',tip:'Pause en haut, descente lente.'},
 {name:'Nordic Hamstring Curl',sets:3,reps:'6-8',muscles:['Ischios'],anim:'',tip:'Excentrique lent, super protecteur pour le coureur.'},
 {name:'45° One Leg Hyperextension',sets:3,reps:'12',muscles:['Lombaires','Fessiers'],anim:'',tip:'Dos neutre, contracte les fessiers.'},
 // Fessiers / hanches
 {name:'Hip Thrust',sets:3,reps:'10-12',muscles:['Fessiers'],anim:'',tip:'Pause haute 1s, menton rentré.'},
 {name:'Lever Hip Thrust',sets:3,reps:'12',muscles:['Fessiers'],anim:'',tip:'Extension complète des hanches.'},
 {name:'Lever Seated Hip Abduction',sets:3,reps:'12-15',muscles:['Fessiers','Abducteurs'],anim:'',tip:'Écarte lentement, contrôle le retour.'},
 {name:'Lever Seated Hip Adduction',sets:3,reps:'12-15',muscles:['Adducteurs'],anim:'',tip:'Serre les cuisses, ne lâche pas le retour.'},
 {name:'Glute Bridge',sets:3,reps:'15',muscles:['Fessiers'],anim:'',tip:'Pousse avec les talons.'},
 {name:'Cable Kickback',sets:3,reps:'12-15',muscles:['Fessiers'],anim:'',tip:'Jambe tendue vers l\u2019arrière, sans cambrer.'},
 // Abdos / Core
 {name:'Plank',sets:3,reps:'45s',muscles:['Abdominaux','Core'],anim:'',tip:'Corps aligné, gainage constant.'},
 {name:'Hanging Leg Raise',sets:3,reps:'12',muscles:['Abdominaux'],anim:'',tip:'Monte les jambes sans balancier.'},
 {name:'Cable Crunch',sets:3,reps:'15',muscles:['Abdominaux'],anim:'',tip:'Enroule la colonne, pas les hanches.'},
 {name:'Russian Twist',sets:3,reps:'20',muscles:['Obliques'],anim:'',tip:'Rotation contrôlée, gainage actif.'},
 {name:'Ab Wheel Rollout',sets:3,reps:'10',muscles:['Abdominaux','Core'],anim:'',tip:'Ne creuse jamais le bas du dos.'},
 // Avant-bras
 {name:'Wrist Curl',sets:3,reps:'15',muscles:['Avant-bras'],anim:'',tip:'Amplitude complète des poignets.'},
 {name:'Farmer Walk',sets:3,reps:'30m',muscles:['Avant-bras','Trapèzes','Core'],anim:'',tip:'Posture droite, grip ferme.'}
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
 ['Développé couché barre','Pectoraux','Barre','Intermédiaire',['Pectoraux'],['Triceps','Épaules'],''],
 ['Développé incliné barre','Pectoraux','Barre','Intermédiaire',['Pectoraux haut'],['Épaules','Triceps'],''],
 ['Développé décliné barre','Pectoraux','Barre','Intermédiaire',['Pectoraux bas'],['Triceps'],''],
 ['Développé couché haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux'],['Triceps','Épaules'],''],
 ['Développé incliné haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux haut'],['Épaules'],''],
 ['Écarté couché haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux'],['Épaules'],''],
 ['Écarté incliné haltères','Pectoraux','Haltères','Intermédiaire',['Pectoraux haut'],[],''],
 ['Pec Deck (machine)','Pectoraux','Machine','Débutant',['Pectoraux'],[],''],
 ['Développé machine convergente','Pectoraux','Machine','Débutant',['Pectoraux'],['Triceps'],''],
 ['Écarté poulie haute','Pectoraux','Poulie','Intermédiaire',['Pectoraux bas'],[],''],
 ['Écarté poulie basse','Pectoraux','Poulie','Intermédiaire',['Pectoraux haut'],[],''],
 ['Crossover poulie','Pectoraux','Poulie','Intermédiaire',['Pectoraux'],['Épaules'],''],
 ['Pompes','Pectoraux','Poids du corps','Débutant',['Pectoraux'],['Triceps','Abdominaux'],''],
 ['Pompes déclinées','Pectoraux','Poids du corps','Intermédiaire',['Pectoraux haut'],['Épaules'],''],
 ['Pompes diamant','Pectoraux','Poids du corps','Intermédiaire',['Triceps'],['Pectoraux'],''],
 ['Dips pectoraux','Pectoraux','Poids du corps','Avancé',['Pectoraux bas'],['Triceps'],''],
 ['Pullover haltère','Pectoraux','Haltères','Intermédiaire',['Pectoraux'],['Dos'],''],
 ['Écarté élastique','Pectoraux','Élastique','Débutant',['Pectoraux'],[],''],
 // DOS
 ['Soulevé de terre','Dos','Barre','Avancé',['Dos','Lombaires'],['Fessiers','Ischios'],''],
 ['Soulevé de terre roumain','Ischios','Barre','Intermédiaire',['Ischios'],['Fessiers','Lombaires'],''],
 ['Rowing barre buste penché','Dos','Barre','Intermédiaire',['Dos'],['Biceps','Trapèzes'],''],
 ['Rowing T-bar','Dos','Machine','Intermédiaire',['Dos'],['Trapèzes','Biceps'],''],
 ['Rowing haltère unilatéral','Dos','Haltères','Débutant',['Dos'],['Biceps'],''],
 ['Rowing poulie basse','Dos','Poulie','Débutant',['Dos'],['Biceps'],''],
 ['Tirage vertical poulie','Dos','Poulie','Débutant',['Grand dorsal'],['Biceps'],''],
 ['Tirage nuque','Dos','Poulie','Avancé',['Grand dorsal'],['Trapèzes'],''],
 ['Tractions pronation','Dos','Poids du corps','Avancé',['Grand dorsal'],['Biceps'],''],
 ['Tractions supination','Dos','Poids du corps','Avancé',['Grand dorsal'],['Biceps'],''],
 ['Pull-over poulie','Dos','Poulie','Intermédiaire',['Grand dorsal'],['Pectoraux'],''],
 ['Rowing machine assise','Dos','Machine','Débutant',['Dos'],['Biceps'],''],
 ['Rowing élastique','Dos','Élastique','Débutant',['Dos'],['Biceps'],''],
 ['Good Morning','Lombaires','Barre','Avancé',['Lombaires'],['Ischios','Fessiers'],''],
 ['Hyperextension lombaire','Lombaires','Poids du corps','Débutant',['Lombaires'],['Fessiers'],''],
 ['Superman au sol','Lombaires','Poids du corps','Débutant',['Lombaires'],['Fessiers'],''],
 // ÉPAULES
 ['Développé militaire barre','Épaules','Barre','Avancé',['Épaules'],['Triceps','Trapèzes'],''],
 ['Développé haltères assis','Épaules','Haltères','Intermédiaire',['Épaules'],['Triceps'],''],
 ['Développé Arnold','Épaules','Haltères','Intermédiaire',['Épaules'],['Triceps'],''],
 ['Développé machine épaules','Épaules','Machine','Débutant',['Épaules'],['Triceps'],''],
 ['Élévations latérales','Épaules','Haltères','Débutant',['Deltoïde latéral'],[],''],
 ['Élévations latérales poulie','Épaules','Poulie','Intermédiaire',['Deltoïde latéral'],[],''],
 ['Élévations frontales','Épaules','Haltères','Débutant',['Deltoïde antérieur'],[],''],
 ['Oiseau (rear delt)','Épaules','Haltères','Débutant',['Arrière épaules'],['Trapèzes'],''],
 ['Face Pull poulie','Épaules','Poulie','Débutant',['Arrière épaules'],['Trapèzes'],''],
 ['Rowing menton','Épaules','Barre','Intermédiaire',['Épaules','Trapèzes'],[],''],
 ['Élévations latérales élastique','Épaules','Élastique','Débutant',['Deltoïde latéral'],[],''],
 // TRAPÈZES
 ['Shrug barre','Trapèzes','Barre','Débutant',['Trapèzes'],[],''],
 ['Shrug haltères','Trapèzes','Haltères','Débutant',['Trapèzes'],[],''],
 ['Shrug machine','Trapèzes','Machine','Débutant',['Trapèzes'],[],''],
 // BICEPS
 ['Curl barre EZ','Biceps','Barre','Débutant',['Biceps'],['Avant-bras'],''],
 ['Curl haltères','Biceps','Haltères','Débutant',['Biceps'],['Avant-bras'],''],
 ['Curl marteau','Biceps','Haltères','Débutant',['Biceps','Avant-bras'],[],''],
 ['Curl incliné','Biceps','Haltères','Intermédiaire',['Biceps'],[],''],
 ['Curl concentré','Biceps','Haltères','Débutant',['Biceps'],[],''],
 ['Curl pupitre (Preacher)','Biceps','Barre','Intermédiaire',['Biceps'],[],''],
 ['Curl poulie basse','Biceps','Poulie','Débutant',['Biceps'],[],''],
 ['Curl araignée','Biceps','Haltères','Intermédiaire',['Biceps'],[],''],
 ['21s biceps','Biceps','Barre','Intermédiaire',['Biceps'],[],''],
 ['Curl élastique','Biceps','Élastique','Débutant',['Biceps'],[],''],
 // TRICEPS
 ['Barre au front (Skull Crusher)','Triceps','Barre','Intermédiaire',['Triceps'],[],''],
 ['Extension poulie haute','Triceps','Poulie','Débutant',['Triceps'],[],''],
 ['Extension poulie corde','Triceps','Poulie','Débutant',['Triceps'],[],''],
 ['Extension nuque haltère','Triceps','Haltères','Intermédiaire',['Triceps'],[],''],
 ['Kickback haltère','Triceps','Haltères','Débutant',['Triceps'],[],''],
 ['Dips entre bancs','Triceps','Poids du corps','Débutant',['Triceps'],['Pectoraux'],''],
 ['Développé couché serré','Triceps','Barre','Intermédiaire',['Triceps'],['Pectoraux'],''],
 ['Extension élastique','Triceps','Élastique','Débutant',['Triceps'],[],''],
 // AVANT-BRAS
 ['Curl poignets','Avant-bras','Barre','Débutant',['Avant-bras'],[],''],
 ['Curl poignets inversé','Avant-bras','Barre','Débutant',['Avant-bras'],[],''],
 ['Marche du fermier','Avant-bras','Haltères','Débutant',['Avant-bras','Trapèzes'],['Abdominaux'],''],
 ['Wrist roller','Avant-bras','Poids du corps','Intermédiaire',['Avant-bras'],[],''],
 // ABDOMINAUX
 ['Crunch','Abdominaux','Poids du corps','Débutant',['Abdominaux'],[],''],
 ['Crunch poulie','Abdominaux','Poulie','Intermédiaire',['Abdominaux'],[],''],
 ['Relevé de jambes suspendu','Abdominaux','Poids du corps','Avancé',['Abdominaux'],[],''],
 ['Relevé de jambes au sol','Abdominaux','Poids du corps','Débutant',['Abdominaux'],[],''],
 ['Planche','Abdominaux','Poids du corps','Débutant',['Abdominaux','Lombaires'],[],''],
 ['Planche latérale','Abdominaux','Poids du corps','Débutant',['Obliques'],[],''],
 ['Russian Twist','Abdominaux','Poids du corps','Intermédiaire',['Obliques'],[],''],
 ['Roulette abdominale','Abdominaux','Poids du corps','Avancé',['Abdominaux'],['Lombaires'],''],
 ['Mountain Climbers','Abdominaux','Poids du corps','Débutant',['Abdominaux'],['Quadriceps'],''],
 ['Vacuum abdominal','Abdominaux','Poids du corps','Intermédiaire',['Transverse'],[],''],
 // FESSIERS
 ['Hip Thrust barre','Fessiers','Barre','Intermédiaire',['Fessiers'],['Ischios'],''],
 ['Hip Thrust machine','Fessiers','Machine','Débutant',['Fessiers'],[],''],
 ['Pont fessier','Fessiers','Poids du corps','Débutant',['Fessiers'],[],''],
 ['Kickback poulie','Fessiers','Poulie','Débutant',['Fessiers'],[],''],
 ['Abduction machine','Abducteurs','Machine','Débutant',['Abducteurs'],['Fessiers'],''],
 ['Adduction machine','Adducteurs','Machine','Débutant',['Adducteurs'],[],''],
 ['Fentes bulgares','Fessiers','Haltères','Intermédiaire',['Fessiers','Quadriceps'],[],''],
 ['Abduction élastique','Abducteurs','Élastique','Débutant',['Abducteurs'],[],''],
 // QUADRICEPS
 ['Squat barre','Quadriceps','Barre','Avancé',['Quadriceps','Fessiers'],['Lombaires'],''],
 ['Front Squat','Quadriceps','Barre','Avancé',['Quadriceps'],['Abdominaux'],''],
 ['Squat Smith','Quadriceps','Machine','Intermédiaire',['Quadriceps','Fessiers'],[],''],
 ['Presse à cuisses','Quadriceps','Machine','Débutant',['Quadriceps','Fessiers'],[],''],
 ['Hack Squat','Quadriceps','Machine','Intermédiaire',['Quadriceps'],['Fessiers'],''],
 ['Leg Extension','Quadriceps','Machine','Débutant',['Quadriceps'],[],''],
 ['Fentes avant','Quadriceps','Haltères','Débutant',['Quadriceps','Fessiers'],[],''],
 ['Fentes marchées','Quadriceps','Haltères','Intermédiaire',['Quadriceps','Fessiers'],[],''],
 ['Goblet Squat','Quadriceps','Kettlebell','Débutant',['Quadriceps'],['Fessiers'],''],
 ['Squat poids du corps','Quadriceps','Poids du corps','Débutant',['Quadriceps'],['Fessiers'],''],
 ['Wall Sit','Quadriceps','Poids du corps','Débutant',['Quadriceps'],[],''],
 // ISCHIOS
 ['Leg Curl allongé','Ischios','Machine','Débutant',['Ischios'],[],''],
 ['Leg Curl assis','Ischios','Machine','Débutant',['Ischios'],[],''],
 ['Nordic Curl','Ischios','Poids du corps','Avancé',['Ischios'],[],''],
 ['Soulevé jambes tendues haltères','Ischios','Haltères','Intermédiaire',['Ischios'],['Fessiers'],''],
 // MOLLETS
 ['Mollets debout','Mollets','Machine','Débutant',['Mollets'],[],''],
 ['Mollets assis','Mollets','Machine','Débutant',['Mollets'],[],''],
 ['Mollets à la presse','Mollets','Machine','Débutant',['Mollets'],[],''],
 ['Mollets unilatéral haltère','Mollets','Haltères','Débutant',['Mollets'],[],''],
 // COU
 ['Extension de cou','Cou','Poids du corps','Intermédiaire',['Cou'],[],''],
 ['Flexion de cou','Cou','Poids du corps','Intermédiaire',['Cou'],[],''],
 // CORPS ENTIER
 ['Burpees','Corps entier','Poids du corps','Intermédiaire',['Corps entier'],['Pectoraux','Quadriceps'],''],
 ['Thruster','Corps entier','Barre','Avancé',['Quadriceps','Épaules'],['Fessiers'],''],
 ['Clean & Press','Corps entier','Barre','Avancé',['Corps entier'],['Épaules','Dos'],''],
 ['Kettlebell Swing','Corps entier','Kettlebell','Intermédiaire',['Fessiers','Dos'],['Ischios'],''],
 ['Snatch kettlebell','Corps entier','Kettlebell','Avancé',['Corps entier'],['Épaules'],''],
 ['Turkish Get-up','Corps entier','Kettlebell','Avancé',['Corps entier'],['Abdominaux'],'']
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
 'Burpees':'Burpee','Thruster':'Thrusters','Clean & Press':'Clean_and_Press','Kettlebell Swing':'Kettlebell_One-Legged_Deadlift','EZ-bar 21s':'Barbell_Curl',
 // Alias ajoutés : ces noms (bibliothèque LIB) n'avaient pas de correspondance ci-dessus et retombaient
 // sur l'icône générique. On les relie à un id déjà utilisé et vérifié plus haut (même exercice ou variante proche).
 'Dumbbell Incline Bench Press':'Incline_Dumbbell_Press','Concentration Curl':'Concentration_Curls','Cable Curl':'Cable_Hammer_Curls_-_Rope_Attachment',
 'Overhead Triceps Extension':'Seated_Triceps_Press','Close Grip Bench Press':'Close-Grip_Barbell_Bench_Press','Arnold Press':'Arnold_Dumbbell_Press',
 'Shrug':'Barbell_Shrug','Wrist Curl':'Palms-Down_Wrist_Curl_Over_A_Bench'
};
function exGif(name){
  const id=EXDB_MAP[name]; if(!id) return null;
  return [EXDB_BASE+id+'/0.jpg', EXDB_BASE+id+'/1.jpg'];
}
/* ---------- Tuiles "Muscle" en photo (style navigateur d'exercices) ---------- */
const MUSCLE_ICONS={'Tous':'search','Pectoraux':'dumbbell','Dos':'back','Épaules':'shoulders','Trapèzes':'shoulders','Biceps':'arms','Triceps':'arms',
  'Avant-bras':'arms','Abdominaux':'abs','Lombaires':'back','Fessiers':'glutes','Quadriceps':'legs','Ischios':'legs','Adducteurs':'legs',
  'Abducteurs':'legs','Mollets':'legs','Cou':'shoulders','Corps entier':'run'};
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
/* ---------- Traduction affichage muscu (noms/muscles/matériel restent en français en interne comme clés) ---------- */
const MUSCLE_TR={
  en:{'Abdominaux':'Abs','Abducteurs':'Abductors','Adducteurs':'Adductors','Arrière épaules':'Rear delts','Avant-bras':'Forearms',
    'Biceps':'Biceps','Corps entier':'Full body','Cou':'Neck','Deltoïde antérieur':'Front delt','Deltoïde latéral':'Side delt',
    'Dos':'Back','Fessiers':'Glutes','Grand dorsal':'Lats','Ischios':'Hamstrings','Lombaires':'Lower back','Mollets':'Calves',
    'Obliques':'Obliques','Pectoraux':'Chest','Pectoraux bas':'Lower chest','Pectoraux haut':'Upper chest','Quadriceps':'Quads',
    'Transverse':'Transverse abs','Trapèzes':'Traps','Triceps':'Triceps','Épaules':'Shoulders'},
  ar:{'Abdominaux':'البطن','Abducteurs':'المُبعِدة','Adducteurs':'المُقرِّبة','Arrière épaules':'الكتف الخلفي','Avant-bras':'الساعد',
    'Biceps':'ذات الرأسين','Corps entier':'كامل الجسم','Cou':'الرقبة','Deltoïde antérieur':'الكتف الأمامي','Deltoïde latéral':'الكتف الجانبي',
    'Dos':'الظهر','Fessiers':'الأرداف','Grand dorsal':'الظهرية الكبرى','Ischios':'أوتار الركبة','Lombaires':'أسفل الظهر','Mollets':'السمانة',
    'Obliques':'المائلة','Pectoraux':'الصدر','Pectoraux bas':'أسفل الصدر','Pectoraux haut':'أعلى الصدر','Quadriceps':'الرباعية',
    'Transverse':'المستعرضة','Trapèzes':'شبه المنحرفة','Triceps':'ثلاثية الرؤوس','Épaules':'الكتفين'}
};
function trMuscle(m){ if(!m) return m; const l=curLang(); if(l==='fr'||!MUSCLE_TR[l]) return m; return MUSCLE_TR[l][m]||m; }
const EQUIP_TR={
  en:{'Barre':'Barbell','Haltères':'Dumbbells','Kettlebell':'Kettlebell','Machine':'Machine','Poids du corps':'Bodyweight','Poulie':'Cable','Élastique':'Resistance band'},
  ar:{'Barre':'بار','Haltères':'دمبل','Kettlebell':'كيتل بل','Machine':'آلة','Poids du corps':'وزن الجسم','Poulie':'بكرة','Élastique':'شريط مقاومة'}
};
function trEquip(e){ if(!e) return e; const l=curLang(); if(l==='fr'||!EQUIP_TR[l]) return e; return EQUIP_TR[l][e]||e; }
function trLevel(lv){ const map={'Débutant':'lvlBeginner','Intermédiaire':'lvlIntermediate','Avancé':'lvlAdvanced'}; return map[lv]?t(map[lv]):lv; }
const EX_NAME_TR={
  en:{'Développé couché barre':'Barbell Bench Press','Développé incliné barre':'Incline Barbell Bench Press','Développé décliné barre':'Decline Barbell Bench Press',
    'Développé couché haltères':'Dumbbell Bench Press','Développé incliné haltères':'Incline Dumbbell Press','Écarté couché haltères':'Flat Dumbbell Fly',
    'Écarté incliné haltères':'Incline Dumbbell Fly','Pec Deck (machine)':'Pec Deck (Machine)','Développé machine convergente':'Converging Chest Press Machine',
    'Écarté poulie haute':'High Cable Fly','Écarté poulie basse':'Low Cable Fly','Crossover poulie':'Cable Crossover','Pompes':'Push-ups',
    'Pompes déclinées':'Decline Push-ups','Pompes diamant':'Diamond Push-ups','Dips pectoraux':'Chest Dips','Pullover haltère':'Dumbbell Pullover',
    'Écarté élastique':'Band Chest Fly','Soulevé de terre':'Deadlift','Soulevé de terre roumain':'Romanian Deadlift','Rowing barre buste penché':'Bent-over Barbell Row',
    'Rowing T-bar':'T-Bar Row','Rowing haltère unilatéral':'Single-arm Dumbbell Row','Rowing poulie basse':'Seated Cable Row','Tirage vertical poulie':'Lat Pulldown',
    'Tirage nuque':'Behind-the-neck Pulldown','Tractions pronation':'Pull-ups (Pronated)','Tractions supination':'Chin-ups (Supinated)','Pull-over poulie':'Cable Pullover',
    'Rowing machine assise':'Seated Row Machine','Rowing élastique':'Band Row','Good Morning':'Good Morning','Hyperextension lombaire':'Back Hyperextension',
    'Superman au sol':'Floor Superman','Développé militaire barre':'Barbell Overhead Press','Développé haltères assis':'Seated Dumbbell Shoulder Press',
    'Développé Arnold':'Arnold Press','Développé machine épaules':'Shoulder Press Machine','Élévations latérales':'Lateral Raises',
    'Élévations latérales poulie':'Cable Lateral Raise','Élévations frontales':'Front Raises','Oiseau (rear delt)':'Rear Delt Fly','Face Pull poulie':'Cable Face Pull',
    'Rowing menton':'Upright Row','Élévations latérales élastique':'Band Lateral Raise','Shrug barre':'Barbell Shrug','Shrug haltères':'Dumbbell Shrug',
    'Shrug machine':'Shrug Machine','Curl barre EZ':'EZ-Bar Curl','Curl haltères':'Dumbbell Curl','Curl marteau':'Hammer Curl','Curl incliné':'Incline Dumbbell Curl',
    'Curl concentré':'Concentration Curl','Curl pupitre (Preacher)':'Preacher Curl','Curl poulie basse':'Low Cable Curl','Curl araignée':'Spider Curl',
    '21s biceps':'Biceps 21s','Curl élastique':'Band Curl','Barre au front (Skull Crusher)':'Skull Crusher','Extension poulie haute':'Cable Triceps Pushdown',
    'Extension poulie corde':'Rope Triceps Pushdown','Extension nuque haltère':'Overhead Dumbbell Extension','Kickback haltère':'Dumbbell Kickback',
    'Dips entre bancs':'Bench Dips','Développé couché serré':'Close-Grip Bench Press','Extension élastique':'Band Triceps Extension','Curl poignets':'Wrist Curl',
    'Curl poignets inversé':'Reverse Wrist Curl','Marche du fermier':'Farmer\u2019s Walk','Wrist roller':'Wrist Roller','Crunch':'Crunch','Crunch poulie':'Cable Crunch',
    'Relevé de jambes suspendu':'Hanging Leg Raise','Relevé de jambes au sol':'Lying Leg Raise','Planche':'Plank','Planche latérale':'Side Plank',
    'Russian Twist':'Russian Twist','Roulette abdominale':'Ab Wheel Rollout','Mountain Climbers':'Mountain Climbers','Vacuum abdominal':'Stomach Vacuum',
    'Hip Thrust barre':'Barbell Hip Thrust','Hip Thrust machine':'Hip Thrust Machine','Pont fessier':'Glute Bridge','Kickback poulie':'Cable Kickback',
    'Abduction machine':'Hip Abduction Machine','Adduction machine':'Hip Adduction Machine','Fentes bulgares':'Bulgarian Split Squat',
    'Abduction élastique':'Band Hip Abduction','Squat barre':'Barbell Squat','Front Squat':'Front Squat','Squat Smith':'Smith Machine Squat',
    'Presse à cuisses':'Leg Press','Hack Squat':'Hack Squat','Leg Extension':'Leg Extension','Fentes avant':'Forward Lunges','Fentes marchées':'Walking Lunges',
    'Goblet Squat':'Goblet Squat','Squat poids du corps':'Bodyweight Squat','Wall Sit':'Wall Sit','Leg Curl allongé':'Lying Leg Curl','Leg Curl assis':'Seated Leg Curl',
    'Nordic Curl':'Nordic Hamstring Curl','Soulevé jambes tendues haltères':'Stiff-leg Dumbbell Deadlift','Mollets debout':'Standing Calf Raise',
    'Mollets assis':'Seated Calf Raise','Mollets à la presse':'Leg Press Calf Raise','Mollets unilatéral haltère':'Single-leg Dumbbell Calf Raise',
    'Extension de cou':'Neck Extension','Flexion de cou':'Neck Flexion','Burpees':'Burpees','Thruster':'Thruster','Clean & Press':'Clean & Press',
    'Kettlebell Swing':'Kettlebell Swing','Snatch kettlebell':'Kettlebell Snatch','Turkish Get-up':'Turkish Get-up'},
  ar:{'Développé couché barre':'ضغط البنش بالبار','Développé incliné barre':'ضغط بنش مائل بالبار','Développé décliné barre':'ضغط بنش منحدر بالبار',
    'Développé couché haltères':'ضغط بنش بالدمبل','Développé incliné haltères':'ضغط بنش مائل بالدمبل','Écarté couché haltères':'فتح صدر بالدمبل مستلقيًا',
    'Écarté incliné haltères':'فتح صدر مائل بالدمبل','Pec Deck (machine)':'جهاز فتح الصدر (بيك ديك)','Développé machine convergente':'جهاز ضغط الصدر المتقارب',
    'Écarté poulie haute':'فتح صدر بالبكرة العالية','Écarté poulie basse':'فتح صدر بالبكرة المنخفضة','Crossover poulie':'كروس أوفر بالبكرة','Pompes':'ضغط (بوش أب)',
    'Pompes déclinées':'ضغط منحدر','Pompes diamant':'ضغط الماسة','Dips pectoraux':'متوازي للصدر','Pullover haltère':'بولأوفر بالدمبل',
    'Écarté élastique':'فتح صدر بالشريط المطاطي','Soulevé de terre':'الرفعة الميتة','Soulevé de terre roumain':'الرفعة الميتة الروماني','Rowing barre buste penché':'تجديف بالبار منحني الجذع',
    'Rowing T-bar':'تجديف تي بار','Rowing haltère unilatéral':'تجديف بالدمبل بيد واحدة','Rowing poulie basse':'تجديف بالبكرة الجالس','Tirage vertical poulie':'سحب علوي بالبكرة',
    'Tirage nuque':'سحب خلف الرقبة','Tractions pronation':'سحب عالٍ (قبضة علوية)','Tractions supination':'سحب عالٍ (قبضة سفلية)','Pull-over poulie':'بولأوفر بالبكرة',
    'Rowing machine assise':'تجديف بالآلة الجالس','Rowing élastique':'تجديف بالشريط المطاطي','Good Morning':'صباح الخير (تمرين الظهر)','Hyperextension lombaire':'تمديد أسفل الظهر',
    'Superman au sol':'تمرين سوبرمان الأرضي','Développé militaire barre':'ضغط عسكري بالبار','Développé haltères assis':'ضغط كتف بالدمبل جالسًا',
    'Développé Arnold':'ضغط أرنولد','Développé machine épaules':'جهاز ضغط الكتف','Élévations latérales':'رفرفة جانبية',
    'Élévations latérales poulie':'رفرفة جانبية بالبكرة','Élévations frontales':'رفرفة أمامية','Oiseau (rear delt)':'رفرفة الكتف الخلفي','Face Pull poulie':'سحب للوجه بالبكرة',
    'Rowing menton':'تجديف للذقن','Élévations latérales élastique':'رفرفة جانبية بالشريط','Shrug barre':'هز الكتفين بالبار','Shrug haltères':'هز الكتفين بالدمبل',
    'Shrug machine':'جهاز هز الكتفين','Curl barre EZ':'كيرل بار EZ','Curl haltères':'كيرل بالدمبل','Curl marteau':'كيرل المطرقة','Curl incliné':'كيرل مائل',
    'Curl concentré':'كيرل التركيز','Curl pupitre (Preacher)':'كيرل الواعظ','Curl poulie basse':'كيرل بالبكرة المنخفضة','Curl araignée':'كيرل العنكبوت',
    '21s biceps':'تمرين الـ21 للعضلة ذات الرأسين','Curl élastique':'كيرل بالشريط المطاطي','Barre au front (Skull Crusher)':'سكال كراشر','Extension poulie haute':'تمديد الترايسبس بالبكرة العلوية',
    'Extension poulie corde':'تمديد الترايسبس بالحبل','Extension nuque haltère':'تمديد خلف الرأس بالدمبل','Kickback haltère':'كيك باك بالدمبل',
    'Dips entre bancs':'متوازي بين مقعدين','Développé couché serré':'ضغط بنش بقبضة ضيقة','Extension élastique':'تمديد الترايسبس بالشريط','Curl poignets':'كيرل المعصم',
    'Curl poignets inversé':'كيرل المعصم العكسي','Marche du fermier':'مشية المزارع','Wrist roller':'لفافة المعصم','Crunch':'كرانش','Crunch poulie':'كرانش بالبكرة',
    'Relevé de jambes suspendu':'رفع الأرجل معلقًا','Relevé de jambes au sol':'رفع الأرجل من الأرض','Planche':'بلانك','Planche latérale':'بلانك جانبي',
    'Russian Twist':'لفة روسية','Roulette abdominale':'عجلة البطن','Mountain Climbers':'متسلق الجبل','Vacuum abdominal':'شفط البطن',
    'Hip Thrust barre':'هيب ثرست بالبار','Hip Thrust machine':'جهاز هيب ثرست','Pont fessier':'جسر الأرداف','Kickback poulie':'كيك باك بالبكرة',
    'Abduction machine':'جهاز تبعيد الفخذ','Adduction machine':'جهاز تقريب الفخذ','Fentes bulgares':'اندفاع بلغاري',
    'Abduction élastique':'تبعيد الفخذ بالشريط','Squat barre':'سكوات بالبار','Front Squat':'سكوات أمامي','Squat Smith':'سكوات بجهاز سميث',
    'Presse à cuisses':'ضغط الأرجل','Hack Squat':'هاك سكوات','Leg Extension':'تمديد الأرجل','Fentes avant':'اندفاع أمامي','Fentes marchées':'اندفاع أثناء المشي',
    'Goblet Squat':'سكوات الكأس','Squat poids du corps':'سكوات بوزن الجسم','Wall Sit':'جلسة الحائط','Leg Curl allongé':'كيرل الأرجل مستلقيًا','Leg Curl assis':'كيرل الأرجل جالسًا',
    'Nordic Curl':'كيرل نوردك','Soulevé jambes tendues haltères':'رفعة ميتة بالساق المستقيمة بالدمبل','Mollets debout':'رفع السمانة واقفًا',
    'Mollets assis':'رفع السمانة جالسًا','Mollets à la presse':'رفع السمانة بجهاز الضغط','Mollets unilatéral haltère':'رفع السمانة بيد واحدة بالدمبل',
    'Extension de cou':'تمديد الرقبة','Flexion de cou':'ثني الرقبة','Burpees':'بيربي','Thruster':'ثراستر','Clean & Press':'كلين آند بريس',
    'Kettlebell Swing':'أرجحة الكيتل بل','Snatch kettlebell':'سناتش الكيتل بل','Turkish Get-up':'النهوض التركي'}
};
function trExName(n){ if(!n) return n; const l=curLang(); if(l==='fr'||!EX_NAME_TR[l]) return n; return EX_NAME_TR[l][n]||n; }
const EX_TIP_TR={
  en:{'Bench Press':'Keep your shoulder blades pinched and your feet planted on the floor.','Decline Bench Press':'Targets the lower chest, lower the bar under control.',
    'Dumbbell Incline Bench Press':'Bench at 30°, use a full range of motion.','Lever Seated Fly':'Squeeze your chest at the end of the movement, hold for 1s.',
    'Cable Crossover':'Slight forward lean, squeeze at the center.','Push Up':'Keep your core tight, don\u2019t let your back sag.',
    'Dumbbell Pullover':'Stretch the rib cage, keep elbows slightly bent.','Lever Lying T-bar Row':'Pull with your elbows, squeeze your shoulder blades.',
    'Straight Back Seated Row':'Keep your back straight, don\u2019t lean backward.','Bar Lateral Pulldown':'Pull the bar to your chest, elbows pointing down.',
    'Pull Up':'Full range of motion, control the descent.','Deadlift':'Keep a neutral back, drive through your legs.',
    'Bent Over Row':'Torso at 45°, keep your core braced throughout.','Single Arm Dumbbell Row':'Brace on the bench, pull your elbow high.',
    'Lever Reverse Fly':'Targets the rear deltoids.','EZ-bar 21s':'7 bottom-half + 7 top-half + 7 full reps, no cheating.',
    'Hammer Curl':'Neutral grip, keep your elbows still.','Biceps Curl':'No swinging, full contraction.','Lever Preacher Curl':'Arms braced, lower slowly.',
    'Concentration Curl':'Isolates the biceps, elbow braced against your thigh.','Cable Curl':'Constant tension throughout the movement.',
    'Skull Crusher':'Keep elbows still, lower toward your forehead.','Elbow Dips':'Keep your torso upright to target the triceps.',
    'Triceps Pushdown':'Elbows tucked to your sides, full extension.','Overhead Triceps Extension':'Elbows pointing up, stretch fully.',
    'Close Grip Bench Press':'Hands shoulder-width apart, elbows tucked in.','Seated Shoulder Press':'Back braced, press straight up.',
    'Lever Seated Shoulder Press':'Guided path, stay in control.','Lateral Raise':'Raise to shoulder height, no higher.',
    'Front Raise':'No swinging, control the descent.','Cable Face Pull':'Pull toward your face, elbows out wide.',
    'Arnold Press':'Rotate your wrists as you press up.','Upright Row':'Pull the bar to chin height, elbows high.',
    'Shrug':'Shrug your shoulders up, pause at the top.','Lever Leg Extension':'Full extension, pause for 1s at the top.',
    'Lever Seated Leg Extension':'Control the descent.','Lever Lying Leg Curl':'Hips pressed down, bring your heels to your glutes.',
    'Lever Kneeling Leg Curl':'Isolates the hamstring, no jerking.','Sled 45° Leg Wide Press':'Wide foot stance to target the inner thigh.',
    'Sled 45° Leg Press':'Keep knees aligned with your feet.','Smith Squat':'Squat below parallel, back straight.',
    'Back Squat':'Drive through the floor, brace your breath.','Front Squat':'Elbows high, torso upright.',
    'Bulgarian Split Squat':'Rear foot elevated, front knee stable.','Dumbbell Split Squat':'Torso upright, controlled descent.',
    'Walking Lunge':'Take long strides, knee shouldn\u2019t pass your toes.','Lever Seated Calf Raise':'Maximum range, stretch at the bottom.',
    'Lever Seated One Leg Calf Raise':'One leg at a time, maximum contraction.','Standing Calf Raise':'Pause at the top, lower slowly.',
    'Nordic Hamstring Curl':'Slow eccentric, excellent injury protection for runners.','45° One Leg Hyperextension':'Neutral back, squeeze your glutes.',
    'Hip Thrust':'Pause 1s at the top, chin tucked.','Lever Hip Thrust':'Full hip extension.',
    'Lever Seated Hip Abduction':'Push out slowly, control the return.','Lever Seated Hip Adduction':'Squeeze your thighs together, control the return.',
    'Glute Bridge':'Push through your heels.','Cable Kickback':'Straight leg kicking back, don\u2019t arch your back.',
    'Plank':'Body aligned, constant core bracing.','Hanging Leg Raise':'Raise your legs without swinging.',
    'Cable Crunch':'Curl your spine, not your hips.','Russian Twist':'Controlled rotation, active core bracing.',
    'Ab Wheel Rollout':'Never let your lower back sag.','Wrist Curl':'Full range of motion at the wrists.',
    'Farmer Walk':'Upright posture, firm grip.'},
  ar:{'Bench Press':'حافظ على انضمام لوحي الكتف وثبّت قدميك على الأرض.','Decline Bench Press':'يستهدف أسفل الصدر، أنزل البار بشكل متحكم.',
    'Dumbbell Incline Bench Press':'المقعد بزاوية 30°، مدى حركة كامل.','Lever Seated Fly':'اضغط عضلات الصدر في نهاية الحركة، توقف لثانية واحدة.',
    'Cable Crossover':'انحناء خفيف للجذع، انقباض في المنتصف.','Push Up':'حافظ على شد عضلات الجذع، لا تدع ظهرك ينحني.',
    'Dumbbell Pullover':'مدّد القفص الصدري، حافظ على ثني خفيف بالمرفقين.','Lever Lying T-bar Row':'اسحب بواسطة المرفقين، وقرّب لوحي الكتف.',
    'Straight Back Seated Row':'حافظ على استقامة الظهر، لا تمِل للخلف.','Bar Lateral Pulldown':'اسحب البار نحو صدرك، والمرفقان لأسفل.',
    'Pull Up':'مدى حركة كامل، وتحكّم في النزول.','Deadlift':'حافظ على استقامة الظهر، وادفع بساقيك.',
    'Bent Over Row':'الجذع بزاوية 45°، وشد عضلات الجذع باستمرار.','Single Arm Dumbbell Row':'استند على المقعد، واسحب المرفق للأعلى.',
    'Lever Reverse Fly':'يستهدف الكتف الخلفي.','EZ-bar 21s':'7 تكرارات للنصف السفلي + 7 للنصف العلوي + 7 كاملة، دون غش.',
    'Hammer Curl':'قبضة محايدة، ثبّت المرفقين.','Biceps Curl':'دون تأرجح، انقباض كامل.','Lever Preacher Curl':'ثبّت الذراعين، وأنزل ببطء.',
    'Concentration Curl':'يعزل العضلة ذات الرأسين، والمرفق مستند على الفخذ.','Cable Curl':'شد مستمر طوال الحركة.',
    'Skull Crusher':'ثبّت المرفقين، وأنزل باتجاه الجبهة.','Elbow Dips':'حافظ على استقامة الجذع لاستهداف الترايسبس.',
    'Triceps Pushdown':'المرفقان ملاصقان للجسم، تمديد كامل.','Overhead Triceps Extension':'المرفقان للأعلى، مدّد جيدًا.',
    'Close Grip Bench Press':'اليدان بعرض الكتفين، والمرفقان قريبان من الجسم.','Seated Shoulder Press':'الظهر مستند، ادفع للأعلى بشكل مستقيم.',
    'Lever Seated Shoulder Press':'مسار موجّه، حافظ على التحكم.','Lateral Raise':'ارفع حتى مستوى الكتفين، لا أعلى من ذلك.',
    'Front Raise':'دون تأرجح، وتحكّم في النزول.','Cable Face Pull':'اسحب باتجاه الوجه، وباعد بين المرفقين.',
    'Arnold Press':'أدر معصميك أثناء الدفع للأعلى.','Upright Row':'اسحب البار حتى الذقن، والمرفقان مرتفعان.',
    'Shrug':'ارفع كتفيك للأعلى، وتوقف في القمة.','Lever Leg Extension':'تمديد كامل، توقف لثانية في الأعلى.',
    'Lever Seated Leg Extension':'تحكّم في النزول.','Lever Lying Leg Curl':'الحوض ملاصق، وقرّب الكعبين من الأرداف.',
    'Lever Kneeling Leg Curl':'يعزل أوتار الركبة، دون حركات مفاجئة.','Sled 45° Leg Wide Press':'وضعية قدمين واسعة لاستهداف الجزء الداخلي.',
    'Sled 45° Leg Press':'حافظ على محاذاة الركبتين مع القدمين.','Smith Squat':'انزل تحت المستوى الموازي، والظهر مستقيم.',
    'Back Squat':'ادفع الأرض، واحبس نفسك أثناء الدفع.','Front Squat':'المرفقان مرتفعان، والجذع مستقيم.',
    'Bulgarian Split Squat':'القدم الخلفية مرفوعة، والركبة الأمامية ثابتة.','Dumbbell Split Squat':'الجذع مستقيم، والنزول متحكم به.',
    'Walking Lunge':'خطوات واسعة، والركبة لا تتجاوز أصابع القدم.','Lever Seated Calf Raise':'مدى حركة أقصى، ومدّد في الأسفل.',
    'Lever Seated One Leg Calf Raise':'رجل واحدة في كل مرة، وانقباض أقصى.','Standing Calf Raise':'توقف في الأعلى، وانزل ببطء.',
    'Nordic Hamstring Curl':'حركة سلبية بطيئة، وقاية ممتازة للعدّائين.','45° One Leg Hyperextension':'الظهر مستقيم، وانقبض الأرداف.',
    'Hip Thrust':'توقف ثانية في الأعلى، والذقن للداخل.','Lever Hip Thrust':'تمديد كامل للورك.',
    'Lever Seated Hip Abduction':'افتح ببطء، وتحكّم في العودة.','Lever Seated Hip Adduction':'قرّب الفخذين، ولا تُفلت أثناء العودة.',
    'Glute Bridge':'ادفع بواسطة الكعبين.','Cable Kickback':'الساق ممدودة للخلف، دون تقويس الظهر.',
    'Plank':'الجسم في خط مستقيم، وشد مستمر للجذع.','Hanging Leg Raise':'ارفع الساقين دون تأرجح.',
    'Cable Crunch':'لفّ العمود الفقري، وليس الوركين.','Russian Twist':'دوران متحكم به، وشد فعّال للجذع.',
    'Ab Wheel Rollout':'لا تدع أسفل ظهرك ينحني أبدًا.','Wrist Curl':'مدى حركة كامل للمعصمين.',
    'Farmer Walk':'وضعية مستقيمة، وقبضة ثابتة.'}
};
function trExTip(name,fallback){ const l=curLang(); if(l==='fr'||!EX_TIP_TR[l]) return fallback; return EX_TIP_TR[l][name]||fallback; }
function exMeta(name){
  const d=XDATA.find(x=>x[0]===name);
  let base;
  if(d){ base={name:d[0],group:d[1],equip:d[2],level:d[3],primary:d[4],secondary:d[5],anim:d[6]}; }
  else { const o=LIB.find(e=>e.name===name); if(!o) return null;
    base={name:o.name,group:(o.muscles&&o.muscles[0])||'Corps entier',equip:'Machine',level:'Intermédiaire',primary:o.muscles||[],secondary:[],anim:o.anim||'',tip:o.tip}; }
  base.gif=exGif(name);
  return enrichFiche(base);
}
function enrichFiche(b){
  const g=b.group;
  const breathByGroup=t('exBreathGeneric');
  // Génère une fiche complète et cohérente
  b.steps=[t('exStep1'),t('exStep2'),t('exStep3'),t('exStep4'),t('exStep5')];
  b.breathing=breathByGroup;
  b.mistakes=[t('exMistakeGeneric1'),t('exMistakeGeneric2'),t('exMistakeGeneric3'),t('exMistakeGeneric4')];
  b.tips=[t('exTipGeneric1'),t('exTipGeneric2'),trExTip(b.name,b.tip)||t('exTipGeneric3')];
  b.safety=[t('exSafety1'),t('exSafety2'),t('exSafety3')];
  // variantes : autres exercices du même groupe
  b.variants=XDATA.filter(x=>x[1]===g && x[0]!==b.name).slice(0,4).map(x=>x[0]);
  return b;
}
// Liste unifiée (étendue + ancienne) sans doublons, pour le navigateur
function allExercises(){
  const names=new Set();
  const out=[];
  XDATA.forEach(x=>{ if(!names.has(x[0])){ names.add(x[0]); out.push({name:x[0],group:x[1],equip:x[2],level:x[3],primary:x[4],secondary:x[5],anim:x[6]}); } });
  LIB.forEach(o=>{ if(!names.has(o.name)){ names.add(o.name); out.push({name:o.name,group:(o.muscles&&o.muscles[0])||'Corps entier',equip:'Machine',level:'Intermédiaire',primary:o.muscles||[],secondary:[],anim:o.anim||'',tip:o.tip}); } });
  return out;
}
function findEx(name){ return LIB.find(e=>e.name===name) || (function(){ const d=XDATA.find(x=>x[0]===name); return d?{name:d[0],muscles:d[4],anim:d[6],tip:''}:null; })(); }
function ex(name,sets,reps){ const e=findEx(name)||{name,muscles:[],anim:'',tip:''}; return {name:e.name,sets,reps,muscles:e.muscles,anim:e.anim,tip:e.tip||''}; }

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
const BASETYPE_COLORS={EF:'--ok',RECUP:'--dim',LIGNES:'--ok',LONG:'--e',LONG_COURT:'--e',TEMPO:'--warn',TEMPO_SPE:'--warn',FARTLEK:'--warn',PROGRESSIF:'--warn',COTES:'--bad',SPE:'--e2',SPE_COURT:'--e2',
  SEUIL:'--or',DBLSEUIL:'--or',VMAc:'--bad',VMAl:'--bad',VO2:'--bad',INTERVAL:'--bad',COURSE:'--e',Repos:'--dim'};
function baseTypeColor(bt){ return 'var('+(BASETYPE_COLORS[bt]||'--e')+')'; }

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
/* Traduit le nom d'une phase à l'affichage à partir de sa clé stable (phaseKey),
   plutôt que d'utiliser le texte français figé dans PLAN.sessions[].phase au
   moment de la génération — ce qui permet au nom de suivre la langue active
   même sur un plan généré avant un changement de langue. */
function phaseName(key){ return key ? t('phase_'+key) : ''; }
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
const MISSED_REASON_ICONS={'Manque de temps':'timer','Fatigue':'moon','Douleur':'warning','Maladie':'health','Météo':'rain','Déplacement':'suitcase','Motivation':'close','Oubli':'clipboard','Autre':'edit'};
const REPLACEMENT_ICONS={'Aucune activité':'ban','Running':'run','Musculation':'dumbbell','Vélo':'bike','Natation':'swim','Mobilité':'heart','Marche':'run','Autre':'plus'};
const HARD_TYPES=['VMAc','VMAl','VO2','INTERVAL','DBLSEUIL','SEUIL','SPE','TEMPO_SPE','TEMPO','PROGRESSIF','FARTLEK','COTES'];
const REASON_TR={
  en:{'Manque de temps':'Lack of time','Fatigue':'Fatigue','Douleur':'Pain','Maladie':'Illness','Météo':'Weather','Déplacement':'Travel','Motivation':'Motivation','Oubli':'Forgot','Autre':'Other'},
  ar:{'Manque de temps':'ضيق الوقت','Fatigue':'تعب','Douleur':'ألم','Maladie':'مرض','Météo':'الطقس','Déplacement':'تنقّل','Motivation':'دافعية','Oubli':'نسيان','Autre':'آخر'}
};
function trReason(r){ if(!r) return r; const l=curLang(); if(l==='fr'||!REASON_TR[l]) return r; return REASON_TR[l][r]||r; }
const ACTIVITY_TR={
  en:{'Aucune activité':'No activity','Running':'Running','Musculation':'Strength training','Vélo':'Cycling','Natation':'Swimming','Mobilité':'Mobility','Marche':'Walking','Autre':'Other'},
  ar:{'Aucune activité':'لا نشاط','Running':'الجري','Musculation':'تدريب القوة','Vélo':'الدراجة','Natation':'السباحة','Mobilité':'الحركة','Marche':'المشي','Autre':'آخر'}
};
function trActivity(a){ if(!a) return a; const l=curLang(); if(l==='fr'||!ACTIVITY_TR[l]) return a; return ACTIVITY_TR[l][a]||a; }
const MUSCU_CAT_TR={
  en:{'Haut du corps':'Upper body','Bas du corps':'Lower body','Gainage':'Core','Explosivité':'Explosiveness','Force maximale':'Max strength','Force endurance':'Strength endurance','Puissance':'Power','Mobilité':'Mobility'},
  ar:{'Haut du corps':'الجزء العلوي','Bas du corps':'الجزء السفلي','Gainage':'تقوية الجذع','Explosivité':'الانفجارية','Force maximale':'القوة القصوى','Force endurance':'تحمل القوة','Puissance':'القدرة','Mobilité':'الحركة'}
};
function trMuscuCat(c){ if(!c) return c; const l=curLang(); if(l==='fr'||!MUSCU_CAT_TR[l]) return c; return MUSCU_CAT_TR[l][c]||c; }
const RACE_TR={
  en:{'5 km':'5K','10 km':'10K','Semi-marathon':'Half marathon','Marathon':'Marathon','Ultra':'Ultra','Trail':'Trail','Cross':'Cross country','Autre':'Other'},
  ar:{'5 km':'5 كم','10 km':'10 كم','Semi-marathon':'نصف ماراثون','Marathon':'ماراثون','Ultra':'ألترا','Trail':'تريل','Cross':'كروس كنتري','Autre':'آخر'}
};
function trRace(r){ if(!r) return r; const l=curLang(); if(l==='fr'||!RACE_TR[l]) return r; return RACE_TR[l][r]||r; }
// Les séances stockées gardent leur libellé au format du moment de leur création (souvent FR).
// On mappe ces libellés connus vers les clés sessLabel_XXX pour ré-afficher dans la langue active.
const SESS_TYPE_TO_KEY={'EF':'EF','Récup':'RECUP','Long':'LONG','Tempo':'TEMPO','Tempo spé':'TEMPO_SPE','Seuil':'SEUIL','Double seuil':'DBLSEUIL',
  'VMA courte':'VMAc','VMA longue':'VMAl','VO₂max':'VO2','Intervalles':'INTERVAL','Allure spé':'SPE','Progressif':'PROGRESSIF','Fartlek':'FARTLEK',
  'Côtes':'COTES','Lignes':'LIGNES','Course':'COURSE'};
function trSessType(ty){
  if(!ty||ty==='—') return ty;
  if(ty==='Muscu') return t('typeMuscu');
  if(ty==='Autre') return t('typeAutre');
  const key=SESS_TYPE_TO_KEY[ty];
  if(key) return t('sessLabel_'+key);
  return ty;
}
// Les séances du plan généré (PLAN.sessions) stockent titre/label/desc figés dans la langue
// active au moment de la génération. On les recalcule à l'affichage à partir de s.baseType
// (clé stable) pour qu'elles suivent la langue courante. s.title/s.type restent utilisés
// tels quels pour les séances perso (pas de baseType), qui contiennent du texte libre.
const PLAN_SESSTYPE_KEYS=['EF','RECUP','LONG','TEMPO','TEMPO_SPE','SEUIL','DBLSEUIL','VMAc','VMAl','VO2','INTERVAL','SPE','PROGRESSIF','FARTLEK','COTES','LIGNES','COURSE','default'];
function planSessTitle(s){
  const bt=s&&s.baseType; if(!bt) return s?s.title:'';
  if(bt==='LONG'||bt==='LONG_COURT') return t('sessTitle_LONG')+(s.phaseKey==='SPE'?t('progressiveSuffix'):'');
  if(bt==='COURSE') return t('sessTitle_COURSE')+' — '+(trRace(P.objRace)||t('competitionDefault'));
  if(bt==='SPE'||bt==='SPE_COURT') return t('sessTitle_SPE')+(P.objRace?' '+trRace(P.objRace):'');
  if(PLAN_SESSTYPE_KEYS.includes(bt)) return t('sessTitle_'+bt);
  return s.title;
}
function planSessLabel(s){
  const bt=s&&s.baseType; if(!bt) return s?s.type:'';
  if(bt==='LONG_COURT') return t('sessLabel_LONG');
  if(bt==='SPE_COURT') return t('sessLabel_SPE');
  if(PLAN_SESSTYPE_KEYS.includes(bt)) return t('sessLabel_'+bt);
  return s.type;
}
const SERIES_RECOVLABEL_KEY={TEMPO_SPE:'recovLabel_2minTrot',SEUIL:'recovLabel_1minTrot',VMAc:'recovLabel_1minTrot',
  VMAl:'recovLabel_2to3minTrot',VO2:'recovLabel_2to3minTrot',SPE:'recovLabel_90sTrot',SPE_COURT:'recovLabel_90sTrot',
  DBLSEUIL:'recovLabel_30sTrot',INTERVAL:'bs_interval_recoveryLabel',COTES:'bs_cotes_recoveryLabel'};
function liveSeries(s){
  if(!s||!s.series) return s?s.series:null;
  const bt=s.baseType; if(!bt) return s.series;
  const sr={...s.series};
  const key=SERIES_RECOVLABEL_KEY[bt];
  if(key) sr.recoveryLabel=t(key);
  if(bt==='COTES') sr.note=t('bs_cotes_note');
  if(bt==='DBLSEUIL') sr.note=tp('bs_dblseuil_note',5,6);
  return sr;
}
// Reconstruit le contenu détaillé (objectif/échauffement/corps/allures/conseils/erreurs/pourquoi)
// d'une séance du plan dans la langue active, à partir de s.baseType + valeurs déjà figées
// (km/pace/série/genParams) — sans re-randomiser, donc identique numériquement à la génération d'origine.
function liveDetail(s){
  if(!s||!s.baseType||!PLAN||!PLAN.vdot) return s?s.detail:null;
  const bt=s.baseType, vdot=PLAN.vdot, S=spkToStr, goal=PLAN.goal;
  const NEEDS_GENPARAMS={TEMPO:1,VMAc:1,VMAl:1,VO2:1,FARTLEK:1,LIGNES:1};
  if(NEEDS_GENPARAMS[bt] && !s.genParams) return s.detail;
  try{
    const pace={ EF:paceFromPct(vdot,.70), RC:paceFromPct(vdot,.66), MAR:paceFromPct(vdot,.80),
      TEMPO:paceFromPct(vdot,.83), SEUIL:paceFromPct(vdot,.88), SPE:predictTime(vdot, raceMeters())/(raceMeters()/1000),
      VMAl:repPace(vdot,1000), VMAc:repPace(vdot,300), SPRINT:paceFromPct(vdot,1.18) };
    const round1=x=>Math.round(x*10)/10;
    const WU_MIN=17.5, CD_MIN=12.5;
    const WU=tp('wuTemplate',S(pace.EF));
    const CD=tp('cdTemplate',S(pace.RC));
    const gp=s.genParams||{};
    let d;
    switch(bt){
      case 'EF':
        d={objectif:t('bs_ef_objectif'),warmup:t('bs_ef_warmup'),body:tp('bs_ef_body',s.km,S(pace.EF)),paces:tp('bs_ef_paces',S(pace.EF)),recovery:t('bs_ef_recovery'),cooldown:t('bs_ef_cooldown'),tips:[t('bs_ef_tip1'),t('bs_ef_tip2')],mistakes:[t('bs_ef_mistake1')],why:t('bs_ef_why')};
        break;
      case 'RECUP':
        d={objectif:t('bs_recup_objectif'),warmup:t('bs_recup_warmup'),body:tp('bs_recup_body',s.km,S(pace.RC)),paces:t('bs_recup_paces'),recovery:'—',cooldown:t('bs_recup_cooldown'),tips:[t('bs_recup_tip1')],mistakes:[t('bs_recup_mistake1')],why:t('bs_recup_why')};
        break;
      case 'LONG': case 'LONG_COURT':
        d={objectif:t('bs_long_objectif'),warmup:t('bs_long_warmup'),body:(s.phaseKey==='SPE'||s.phaseKey==='PIC')?tp('bs_long_body_progressive',s.km,S(pace.EF),S(pace.MAR)):tp('bs_long_body_steady',s.km,S(pace.EF*0.99)),paces:tp('bs_long_paces',S(pace.EF),S(pace.MAR)),recovery:t('bs_long_recovery'),cooldown:CD,tips:[t('bs_long_tip1'),t('bs_long_tip2')],mistakes:[t('bs_long_mistake1')],why:t('bs_long_why')};
        break;
      case 'TEMPO': {
        const tmin=gp.tmin, mainKm=distKmFromTime(tmin*60,pace.TEMPO);
        d={objectif:t('bs_tempo_objectif'),warmup:WU,body:tp('bs_tempo_body',tmin,S(pace.TEMPO),round1(mainKm)),paces:tp('bs_tempo_paces',S(pace.TEMPO)),recovery:t('bs_tempo_recovery'),cooldown:CD,tips:[t('bs_tempo_tip1')],mistakes:[t('bs_tempo_mistake1')],why:t('bs_tempo_why')};
        break; }
      case 'TEMPO_SPE': {
        const n=s.series?.reps, dist=s.series?.dist||2000; if(!n) return s.detail;
        d={objectif:tp('bs_temposp_objectif',goal),warmup:WU,body:tp('bs_temposp_body',repsText(n,dist,pace.SPE)),paces:tp('bs_temposp_paces',S(pace.SPE)),recovery:t('recovLabel_2minTrot'),cooldown:CD,tips:[t('bs_temposp_tip1')],mistakes:[t('bs_temposp_mistake1')],why:t('bs_temposp_why')};
        break; }
      case 'SEUIL': {
        const n=s.series?.reps, dist=s.series?.dist||1000; if(!n) return s.detail;
        d={objectif:t('bs_seuil_objectif'),warmup:WU,body:tp('bs_seuil_body',repsText(n,dist,pace.SEUIL)),paces:tp('bs_seuil_paces',S(pace.SEUIL)),recovery:t('bs_seuil_recovery'),cooldown:CD,tips:[t('bs_seuil_tip1')],mistakes:[t('bs_seuil_mistake1')],why:t('bs_seuil_why')};
        break; }
      case 'DBLSEUIL': {
        const nPM=s.series?.reps||10, distPM=s.series?.dist||400;
        d={objectif:t('bs_dblseuil_objectif'),warmup:tp('bs_dblseuil_warmup',WU),body:tp('bs_dblseuil_body',5,6,S(pace.SEUIL*1.01),repsText(nPM,distPM,pace.SEUIL)),paces:tp('bs_dblseuil_paces',S(pace.SEUIL)),recovery:t('bs_dblseuil_recovery'),cooldown:tp('bs_dblseuil_cooldown',CD),tips:[t('bs_dblseuil_tip1')],mistakes:[t('bs_dblseuil_mistake1')],why:t('bs_dblseuil_why')};
        break; }
      case 'VMAc': {
        const n=s.series?.reps, dist=s.series?.dist||300; if(!n) return s.detail;
        const vmac30m=Math.round(distKmFromTime(30,pace.VMAc)*1000);
        d={objectif:t('bs_vmac_objectif'),warmup:tp('bs_vmac_warmup',WU),body:tp('bs_vmac_body',repsText(n,dist,pace.VMAc),gp.vmacBodyN,vmac30m,vmac30m),paces:tp('bs_vmac_paces',fmtSplit(splitSecFromPace(pace.VMAc,dist)),dist,S(pace.VMAc)),recovery:tp('bs_vmac_recovery',dist),cooldown:CD,tips:[tp('bs_vmac_tip1',fmtSplit(splitSecFromPace(pace.VMAc,dist)),dist)],mistakes:[t('bs_vmac_mistake1'),tp('bs_vmac_mistake2',dist)],why:t('bs_vmac_why')};
        break; }
      case 'VMAl': case 'VO2': {
        const n=s.series?.reps, dist=s.series?.dist||1000; if(!n) return s.detail;
        d={objectif:t('bs_vmal_objectif'),warmup:WU,body:tp('bs_vmal_body',repsText(n,dist,pace.VMAl),gp.vmalBodyN),paces:tp('bs_vmal_paces',S(pace.VMAl)),recovery:t('recovLabel_2to3minTrot'),cooldown:CD,tips:[t('bs_vmal_tip1'),t('bs_vmal_tip2')],mistakes:[t('bs_vmal_mistake1')],why:t('bs_vmal_why')};
        break; }
      case 'INTERVAL': {
        const segs=[200,400,600,800,600,400,200];
        const paceFor=dist=>repPace(vdot,dist);
        const detailSegs=segs.map(dist=>dist+' m ('+fmtSplit(splitSecFromPace(paceFor(dist),dist))+')').join(' · ');
        d={objectif:t('bs_interval_objectif'),warmup:WU,body:tp('bs_interval_body',detailSegs),paces:tp('bs_interval_paces',S(paceFor(200)),S(paceFor(800))),recovery:t('bs_interval_recovery'),cooldown:CD,tips:[t('bs_interval_tip1')],mistakes:[t('bs_interval_mistake1')],why:t('bs_interval_why')};
        break; }
      case 'SPE': case 'SPE_COURT': {
        const n=s.series?.reps, dist=s.series?.dist||1000; if(!n) return s.detail;
        d={objectif:tp('bs_spe_objectif',goal),warmup:WU,body:tp('bs_spe_body',repsText(n,dist,pace.SPE)),paces:tp('bs_spe_paces',S(pace.SPE)),recovery:t('recovLabel_90sTrot'),cooldown:CD,tips:[t('bs_spe_tip1')],mistakes:[t('bs_spe_mistake1')],why:t('bs_spe_why')};
        break; }
      case 'PROGRESSIF':
        d={objectif:t('bs_progressif_objectif'),warmup:tp('bs_10min_warmup',S(pace.EF)),body:tp('bs_progressif_body',s.km,S(pace.EF),S(pace.MAR),S(pace.TEMPO)),paces:t('bs_progressif_paces'),recovery:t('bs_progressif_recovery'),cooldown:CD,tips:[t('bs_progressif_tip1')],mistakes:[t('bs_progressif_mistake1')],why:t('bs_progressif_why')};
        break;
      case 'FARTLEK':
        d={objectif:t('bs_fartlek_objectif'),warmup:tp('bs_fartlek_warmup',S(pace.EF)),body:tp('bs_fartlek_body',gp.n),paces:tp('bs_fartlek_paces',S(pace.VMAl),S(pace.EF)),recovery:t('bs_fartlek_recovery'),cooldown:CD,tips:[t('bs_fartlek_tip1')],mistakes:[t('bs_fartlek_mistake1')],why:t('bs_fartlek_why')};
        break;
      case 'COTES': {
        const n=s.series?.reps; if(!n) return s.detail;
        d={objectif:t('bs_cotes_objectif'),warmup:WU,body:tp('bs_cotes_body',n),paces:t('bs_cotes_paces'),recovery:t('bs_cotes_recovery'),cooldown:CD,tips:[t('bs_cotes_tip1')],mistakes:[t('bs_cotes_mistake1')],why:t('bs_cotes_why')};
        break; }
      case 'LIGNES':
        d={objectif:t('bs_lignes_objectif'),warmup:tp('bs_10min_warmup',S(pace.EF)),body:tp('bs_lignes_body',Math.round(s.km*0.7),gp.lignesN),paces:t('bs_lignes_paces'),recovery:t('bs_lignes_recovery'),cooldown:t('bs_lignes_cooldown'),tips:[t('bs_lignes_tip1')],mistakes:[t('bs_lignes_mistake1')],why:t('bs_lignes_why')};
        break;
      case 'COURSE':
        d={objectif:tp('bs_course_objectif',(P.objTime||goal)),warmup:t('bs_course_warmup'),body:tp('bs_course_body',s.km,s.pace),paces:tp('bs_course_paces',s.pace),recovery:'—',cooldown:t('bs_course_cooldown'),tips:[t('bs_course_tip1'),t('bs_course_tip2')],mistakes:[t('bs_course_mistake1')],why:t('bs_course_why')};
        break;
      default:
        d={objectif:t('bs_default_objectif'),warmup:'-',body:tp('bs_default_body',s.km),paces:S(pace.EF)+'/km',recovery:'-',cooldown:'-',tips:[],mistakes:[],why:t('bs_default_why')};
    }
    if(s.deload && s.km>0){ d.objectif=tp('deloadPrefixTemplate',d.objectif); }
    return d;
  }catch(e){ return s.detail; }
}
const PROFILE_TR={en:{'Plate':'Flat','Vallonnée':'Hilly','Montagne':'Mountain'},ar:{'Plate':'مستوٍ','Vallonnée':'متموّج','Montagne':'جبلي'}};
function trProfile(p){ if(!p) return p; const l=curLang(); if(l==='fr'||!PROFILE_TR[l]) return p; return PROFILE_TR[l][p]||p; }
const GOAL_TR={
  en:{'Finir':'Finish','Record personnel':'Personal best','Qualification':'Qualify','Podium':'Podium','Victoire':'Win'},
  ar:{'Finir':'الإنهاء','Record personnel':'رقم شخصي','Qualification':'التأهل','Podium':'منصة التتويج','Victoire':'الفوز'}
};
function trGoal(g){ if(!g) return g; const l=curLang(); if(l==='fr'||!GOAL_TR[l]) return g; return GOAL_TR[l][g]||g; }
const LIKED_TYPE_TR={
  en:{'VMA courte':'Short VO2max intervals','VMA longue':'Long VO2max intervals','Intervalles':'Intervals','Tempo':'Tempo','Seuil':'Threshold',
    'Endurance fondamentale':'Aerobic endurance','Sortie longue':'Long run','Double seuil':'Double threshold','Fartlek':'Fartlek','Côtes':'Hill repeats',
    'Travail VO₂max':'VO2max work','Travail à l\u2019allure spécifique':'Race-pace work','Récupération active':'Active recovery'},
  ar:{'VMA courte':'VMA قصيرة','VMA longue':'VMA طويلة','Intervalles':'فترات','Tempo':'تمبو','Seuil':'عتبة',
    'Endurance fondamentale':'تحمل هوائي أساسي','Sortie longue':'خرجة طويلة','Double seuil':'عتبة مضاعفة','Fartlek':'فارتلك','Côtes':'تلال',
    'Travail VO₂max':'عمل VO2max','Travail à l\u2019allure spécifique':'عمل بوتيرة السباق','Récupération active':'تعافٍ نشط'}
};
function trLikedType(l2){ if(!l2) return l2; const l=curLang(); if(l==='fr'||!LIKED_TYPE_TR[l]) return l2; return LIKED_TYPE_TR[l][l2]||l2; }
const PAIN_TR={
  en:{'Aucune':'None','Légères':'Mild','Gênantes':'Bothersome','Importantes':'Significant'},
  ar:{'Aucune':'لا شيء','Légères':'خفيفة','Gênantes':'مزعجة','Importantes':'كبيرة'}
};
function trPain(p){ if(!p) return p; const l=curLang(); if(l==='fr'||!PAIN_TR[l]) return p; return PAIN_TR[l][p]||p; }
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
  $('#ovProgTitle').textContent=t('missedSessionTitle');
  openOv('ovProg');
}
function renderMissedReason(){
  const s=PLAN.sessions.find(x=>x.id===missedCtx.sessionId); if(!s) return;
  let h='<div class="card" style="border-color:rgba(255,92,108,.35);background:rgba(255,92,108,.08);margin-bottom:18px"><div style="font-weight:700;color:var(--bad)">'+t('missedSessionTitle')+'</div><div style="font-size:13px;color:var(--muted);margin-top:4px">'+planSessTitle(s)+' · '+fmtDate(s.date)+'</div></div>';
  h+='<div class="lab" style="margin-bottom:10px">'+t('missedReasonPrompt')+'</div>';
  h+='<div class="reason-grid">'+MISSED_REASONS.map(r=>'<div class="reason-tile" onclick="selectMissedReason(\''+r+'\')">'+(MISSED_REASON_ICONS[r]?ICN(MISSED_REASON_ICONS[r],18):'')+' '+trReason(r)+'</div>').join('')+'</div>';
  $('#progBody').innerHTML=h;
}
function selectMissedReason(r){ missedCtx.reason=r; renderMissedReplacement(); }
function renderMissedReplacement(){
  let h='<div class="lab" style="margin-bottom:10px">'+t('missedReplacementPrompt')+'</div>';
  h+='<div class="act-grid">'+REPLACEMENT_ACTIVITIES.map(a=>'<div class="act-tile" onclick="selectReplacement(\''+a+'\')"><div class="ic">'+(REPLACEMENT_ICONS[a]?ICN(REPLACEMENT_ICONS[a],20):'')+'</div><div class="lb">'+trActivity(a)+'</div></div>').join('')+'</div>';
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
  let h='<div class="field"><label>'+t('distanceKmLabel')+'</label><input class="inp" id="mr_km" type="number" placeholder="8"></div>';
  h+='<div class="field"><label>'+t('paceKmLabel')+'</label><input class="inp" id="mr_pace" placeholder="4:30"></div>';
  h+='<div class="field"><label>'+t('rpeFeltLabel')+' <span id="mr_rpe_v">5</span>/10</label><input type="range" min="1" max="10" value="5" style="width:100%" id="mr_rpe" oninput="document.getElementById(\'mr_rpe_v\').textContent=this.value"></div>';
  h+='<div class="field"><label>'+t('notesOptionalLabel')+'</label><textarea class="inp" id="mr_notes" rows="2"></textarea></div>';
  h+='<button class="btn" onclick="saveMissedRunning()">'+t('validate')+'</button>';
  $('#progBody').innerHTML=h;
}
function saveMissedRunning(){
  const km=+$('#mr_km').value||0, pace=$('#mr_pace').value.trim()||'—', rpe=+$('#mr_rpe').value, notes=$('#mr_notes').value.trim();
  const dur=(pace!=='—')?Math.round(km*parseTime(pace)/60):0;
  const guard=sessionGuard(km,dur,todayKey());
  if(!guard.ok){ toast(guard.msg); return; }
  missedCtx.replData={km,pace,rpe,notes};
  if(km>0){ SESS.push({date:todayKey(),title:t('replacementRunTitle'),km,pace,type:'EF',duration:dur,rpe}); }
  finalizeMissedSession();
}
function renderMissedMuscuForm(){
  const cats=['Haut du corps','Bas du corps','Gainage','Explosivité','Force maximale','Force endurance','Puissance','Mobilité'];
  missedCtx.muscuCat=cats[0];
  let h='<div class="field"><label>'+t('sessionTypeLabel')+'</label><div class="pills" id="mm_cats">'+cats.map((c,i)=>'<div class="pill '+(i===0?'on':'')+'" onclick="selMuscuCat(\''+c+'\',this)">'+trMuscuCat(c)+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('durationMinLabel')+'</label><input class="inp" id="mm_dur" type="number" placeholder="45"></div>';
  h+='<div class="field"><label>'+t('rpeFeltLabel')+' <span id="mm_rpe_v">5</span>/10</label><input type="range" min="1" max="10" value="5" style="width:100%" id="mm_rpe" oninput="document.getElementById(\'mm_rpe_v\').textContent=this.value"></div>';
  h+='<button class="btn" onclick="saveMissedMuscu()">'+t('validate')+'</button>';
  $('#progBody').innerHTML=h;
}
function selMuscuCat(c,el){ missedCtx.muscuCat=c; document.querySelectorAll('#mm_cats .pill').forEach(x=>x.classList.remove('on')); el.classList.add('on'); }
function saveMissedMuscu(){
  const dur=Math.min(1440,+$('#mm_dur').value||0), rpe=+$('#mm_rpe').value;
  missedCtx.replData={cat:missedCtx.muscuCat,dur,rpe};
  MSESS.push({date:todayKey(),progName:tp('replacementMuscuTitle',trMuscuCat(missedCtx.muscuCat)),tonnage:0,sets:0,reps:0,duration:dur,calories:0,muscles:{}});
  finalizeMissedSession();
}
function renderMissedCardioForm(kind){
  let h='<div class="field"><label>'+t('durationMinLabel')+'</label><input class="inp" id="mc_dur" type="number" placeholder="45"></div>';
  h+='<div class="field"><label>'+t('distanceKmOptionalLabel')+'</label><input class="inp" id="mc_km" type="number" placeholder="15"></div>';
  h+='<div class="field"><label>'+t('rpeFeltLabel')+' <span id="mc_rpe_v">5</span>/10</label><input type="range" min="1" max="10" value="5" style="width:100%" id="mc_rpe" oninput="document.getElementById(\'mc_rpe_v\').textContent=this.value"></div>';
  h+='<button class="btn" onclick="saveMissedCardio(\''+kind+'\')">'+t('validate')+'</button>';
  $('#progBody').innerHTML=h;
}
function saveMissedCardio(kind){
  const dur=Math.min(1440,+$('#mc_dur').value||0), km=+$('#mc_km').value||0, rpe=+$('#mc_rpe').value;
  missedCtx.replData={kind,dur,km,rpe};
  finalizeMissedSession();
}
function renderMissedSimpleForm(kind){
  let h='<div class="field"><label>'+t('durationMinOptionalLabel')+'</label><input class="inp" id="ms_dur" type="number" placeholder="30"></div>';
  h+='<button class="btn" onclick="saveMissedSimple(\''+kind+'\')">'+t('validate')+'</button>';
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
  toast(''+t('sessionNotedToast')+(note?' — '+note:''));
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
      const flag=''+tp('autoLightenedFlag',trReason(reason).toLowerCase(),fmtDate(session.date))+' — ';
      if(nh.detail && nh.detail.objectif) nh.detail.objectif=flag+nh.detail.objectif;
      nh.desc=flag+(nh.desc||'');
      note=t('note_nextHardLightened');
    }
  } else if(replacement==='Musculation' && missedCtx && ['Bas du corps','Explosivité','Puissance'].includes(missedCtx.muscuCat)){
    const tomorrow=addDaysKey(session.date,1);
    const nextDay=PLAN.sessions.find(s=>s.date===tomorrow && !s.done && !s.missed);
    if(nextDay && ['VMAc','COTES'].includes(nextDay.baseType)){
      const flag=''+t('legDayCarryoverFlag')+' — ';
      if(nextDay.detail && nextDay.detail.objectif) nextDay.detail.objectif=flag+nextDay.detail.objectif;
      nextDay.desc=flag+(nextDay.desc||'');
      note=t('note_explosiveCaution');
    }
  } else if((replacement==='Vélo'||replacement==='Natation') && !heavyReasons.includes(reason)){
    note=t('note_cardioAlreadyCounted');
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
    toast(''+t('recentMissesReducedMsg'));
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
  let factor=1, reason=t('load_stable');
  if(missedCount>=2 || rpeDelta>=1.5 || avgFatigue>=4){
    factor=0.88; reason=t('load_high');
  } else if(repRatio!=null && repRatio>=0.85 && rpeDelta<=0 && avgFatigue<=3){
    factor=1.06; reason=t('load_goodAssimilation');
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
    s.rpe=built.rpe; s.series=built.series||null; s.desc=built.detail.objectif; s.detail=built.detail; s.genParams=built.genParams||null;
  });
  PLAN.lastAdapt=tk;
  DB.save('run_plan',PLAN);
  toast(''+tp('planUpdatedWeekReason',reason));
}

function generatePlan(){
  const vdot=getUserVDOT();
  if(!vdot){ toast(t('profileIncompleteAddTime')); return; }
  if(!P.compDate){ toast(t('chooseCompDate')); return; }
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
        desc:built.detail.objectif, detail:built.detail, genParams:built.genParams||null, deload:isDeload, done:false });
    });
  }
  // Les jours d'entraînement sont générés dans l'ordre de leur numéro de jour de semaine
  // (ex: lundi avant vendredi), pas dans l'ordre chronologique réel à partir d'aujourd'hui
  // — sans ce tri, la 1re semaine affichait ses séances dans le désordre (ex: lun. 7 sept.
  // avant ven. 4 sept.) dès que le plan était généré un autre jour que dimanche/lundi.
  sessions.sort((a,b)=> a.date<b.date?-1:a.date>b.date?1:0);
  PLAN={ created:todayKey(), vdot, weeks, seed, sessions, goal, race:P.objRace||'5 km' };
  DB.save('run_plan',PLAN);
  toast(''+tp('planGenerated',(trRace(P.objRace)||t('raceGeneric')),weeks,sessions.length));
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
  renderPlanSetup(); $('#ovProgTitle').textContent=t('configurePlanTitle'); openOv('ovProg');
}
function renderPlanSetup(){
  if(P.easyMode) return renderPlanSetupSimple();
  const s=setupTmp;
  const dn=[0,1,2,3,4,5,6].map(d=>new Date(2023,0,1+d).toLocaleDateString(localeCode(),{weekday:'short'}));
  let h='<div class="field"><label>'+t('preparedRaceLabel')+'</label><select class="inp" onchange="setupTmp.objRace=this.value">'+['5 km','10 km','Semi-marathon','Marathon','Ultra','Trail','Cross','Autre'].map(r=>'<option value="'+r+'" '+(s.objRace===r?'selected':'')+'>'+trRace(r)+'</option>').join('')+'</select></div>';
  h+='<div class="field"><label>'+t('raceDateLabel')+'</label><input class="inp" type="date" value="'+s.compDate+'" onchange="setupTmp.compDate=this.value"></div>';
  h+='<div class="field"><label>'+t('courseProfileLabel')+'</label><div class="pills">'+['Plate','Vallonnée','Montagne'].map(p=>'<div class="pill '+(s.objProfile===p?'on':'')+'" onclick="setupTmp.objProfile=\''+p+'\';renderPlanSetup()">'+trProfile(p)+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('objectiveCap')+'</label><div class="pills">'+['Finir','Record personnel','Qualification','Podium','Victoire'].map(o=>'<div class="pill '+(s.objGoal===o?'on':'')+'" onclick="setupTmp.objGoal=\''+o+'\';renderPlanSetup()">'+trGoal(o)+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('targetTimeOptionalLabel')+'</label><input class="inp" value="'+escHtml(s.objTime||'')+'" oninput="setupTmp.objTime=this.value" placeholder="ex: 18:30"></div>';
  h+='<div class="field"><label>'+t('trainingDaysLabel')+'</label><div class="pills">'+[1,2,3,4,5,6,0].map(d=>'<div class="pill '+(s.days.includes(d)?'on':'')+'" onclick="toggleSetupDay('+d+')">'+dn[d]+'</div>').join('')+'</div></div>';
  h+='<div class="row" style="gap:10px"><div class="field" style="flex:1"><label>'+t('minKmWeekLabel')+'</label><input class="inp" type="number" value="'+s.kmWeekMin+'" oninput="setupTmp.kmWeekMin=+this.value"></div><div class="field" style="flex:1"><label>'+t('maxKmWeekLabel')+'</label><input class="inp" type="number" value="'+s.kmWeekMax+'" oninput="setupTmp.kmWeekMax=+this.value"></div></div>';
  h+='<div class="field"><label>'+t('preferredSessionsLabel')+'</label><div class="pills">'+LIKED_TYPES.map(lt=>'<div class="pill '+(s.likedTypes.includes(lt)?'on':'')+'" onclick="toggleLiked(\''+lt.replace(/'/g,"\\'")+'\')">'+trLikedType(lt)+'</div>').join('')+'</div></div>';
  h+='<button class="btn" onclick="confirmPlanSetup()">'+t('generateMyPlanBtn')+'</button>';
  $('#progBody').innerHTML=h;
}
// Version allégée du formulaire de plan pour le mode simplifié : ne garde que les champs indispensables,
// le reste (profil du parcours, temps cible, km/semaine, types de séances préférés) est déduit automatiquement.
function renderPlanSetupSimple(){
  const s=setupTmp;
  const dn=[0,1,2,3,4,5,6].map(d=>new Date(2023,0,1+d).toLocaleDateString(localeCode(),{weekday:'short'}));
  let h='<div class="field"><label>'+t('preparedRaceLabel')+'</label><select class="inp" onchange="setupTmp.objRace=this.value">'+['5 km','10 km','Semi-marathon','Marathon','Ultra','Trail','Cross','Autre'].map(r=>'<option value="'+r+'" '+(s.objRace===r?'selected':'')+'>'+trRace(r)+'</option>').join('')+'</select></div>';
  h+='<div class="field"><label>'+t('raceDateLabel')+'</label><input class="inp" type="date" value="'+s.compDate+'" onchange="setupTmp.compDate=this.value"></div>';
  h+='<div class="field"><label>'+t('objectiveCap')+'</label><div class="pills">'+['Finir','Record personnel','Podium'].map(o=>'<div class="pill '+(s.objGoal===o?'on':'')+'" onclick="setupTmp.objGoal=\''+o+'\';renderPlanSetup()">'+trGoal(o)+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('trainingDaysLabel')+'</label><div class="pills">'+[1,2,3,4,5,6,0].map(d=>'<div class="pill '+(s.days.includes(d)?'on':'')+'" onclick="toggleSetupDay('+d+')">'+dn[d]+'</div>').join('')+'</div></div>';
  h+='<p class="ps-hint">'+t('planSetupSimpleHint')+'</p>';
  h+='<button class="btn" onclick="confirmPlanSetup()">'+t('generateMyPlanBtn')+'</button>';
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
  let km,p,rpe,title,label,d={},durMin=null,series=null,genParams=null;
  const WU_MIN=17.5, CD_MIN=12.5;
  const wuKm=distKmFromTime(WU_MIN*60,pace.EF), cdKm=distKmFromTime(CD_MIN*60,pace.RC);
  const round1=x=>Math.round(x*10)/10;
  const WU=tp('wuTemplate',S(pace.EF));
  const CD=tp('cdTemplate',S(pace.RC));
  switch(type){
    case 'EF':
      km=easyKm; p=S(pace.EF); rpe=3; label=t('sessLabel_EF'); title=t('sessTitle_EF');
      d={objectif:t('bs_ef_objectif'),warmup:t('bs_ef_warmup'),body:tp('bs_ef_body',km,S(pace.EF)),paces:tp('bs_ef_paces',S(pace.EF)),recovery:t('bs_ef_recovery'),cooldown:t('bs_ef_cooldown'),tips:[t('bs_ef_tip1'),t('bs_ef_tip2')],mistakes:[t('bs_ef_mistake1')],why:t('bs_ef_why')};
      break;
    case 'RECUP':
      km=Math.max(4,Math.round(easyKm*0.7)); p=S(pace.RC); rpe=2; label=t('sessLabel_RECUP'); title=t('sessTitle_RECUP');
      d={objectif:t('bs_recup_objectif'),warmup:t('bs_recup_warmup'),body:tp('bs_recup_body',km,S(pace.RC)),paces:t('bs_recup_paces'),recovery:'—',cooldown:t('bs_recup_cooldown'),tips:[t('bs_recup_tip1')],mistakes:[t('bs_recup_mistake1')],why:t('bs_recup_why')};
      break;
    case 'LONG': case 'LONG_COURT':
      km=type==='LONG_COURT'?Math.round(wkKm*0.22):Math.round(wkKm*(phase.key==='SPE'?0.34:0.30));
      km=Math.max(8,Math.min(longRunCapKm(),km)); p=S(pace.EF*0.99); rpe=4; label=t('sessLabel_LONG'); title=t('sessTitle_LONG')+(phase.key==='SPE'?t('progressiveSuffix'):'');
      d={objectif:t('bs_long_objectif'),warmup:t('bs_long_warmup'),body:phase.key==='SPE'||phase.key==='PIC'?tp('bs_long_body_progressive',km,S(pace.EF),S(pace.MAR)):tp('bs_long_body_steady',km,S(pace.EF*0.99)),paces:tp('bs_long_paces',S(pace.EF),S(pace.MAR)),recovery:t('bs_long_recovery'),cooldown:CD,tips:[t('bs_long_tip1'),t('bs_long_tip2')],mistakes:[t('bs_long_mistake1')],why:t('bs_long_why')};
      break;
    case 'TEMPO': {
      const tmin=vary(20,30);
      const mainKm=distKmFromTime(tmin*60,pace.TEMPO);
      km=round1(wuKm+mainKm+cdKm); durMin=Math.round(WU_MIN+tmin+CD_MIN); p=S(pace.TEMPO); rpe=6; label=t('sessLabel_TEMPO'); title=t('sessTitle_TEMPO');
      d={objectif:t('bs_tempo_objectif'),warmup:WU,body:tp('bs_tempo_body',tmin,S(pace.TEMPO),round1(mainKm)),paces:tp('bs_tempo_paces',S(pace.TEMPO)),recovery:t('bs_tempo_recovery'),cooldown:CD,tips:[t('bs_tempo_tip1')],mistakes:[t('bs_tempo_mistake1')],why:t('bs_tempo_why')};
      genParams={tmin};
      break; }
    case 'TEMPO_SPE': {
      const n=vary(2,3), dist=2000, recSecEach=120, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.SPE,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.SPE); rpe=6; label=t('sessLabel_TEMPO_SPE'); title=t('sessTitle_TEMPO_SPE');
      series={reps:n,dist,paceSecPerKm:pace.SPE,recoverySec:recSecEach,recoveryLabel:t('recovLabel_2minTrot')};
      d={objectif:tp('bs_temposp_objectif',goal),warmup:WU,body:tp('bs_temposp_body',repsText(n,dist,pace.SPE)),paces:tp('bs_temposp_paces',S(pace.SPE)),recovery:t('recovLabel_2minTrot'),cooldown:CD,tips:[t('bs_temposp_tip1')],mistakes:[t('bs_temposp_mistake1')],why:t('bs_temposp_why')};
      break; }
    case 'SEUIL': {
      const n=vary(4,6), dist=1000, recSecEach=60, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.SEUIL,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.SEUIL); rpe=7; label=t('sessLabel_SEUIL'); title=t('sessTitle_SEUIL');
      series={reps:n,dist,paceSecPerKm:pace.SEUIL,recoverySec:recSecEach,recoveryLabel:t('recovLabel_1minTrot')};
      d={objectif:t('bs_seuil_objectif'),warmup:WU,body:tp('bs_seuil_body',repsText(n,dist,pace.SEUIL)),paces:tp('bs_seuil_paces',S(pace.SEUIL)),recovery:t('bs_seuil_recovery'),cooldown:CD,tips:[t('bs_seuil_tip1')],mistakes:[t('bs_seuil_mistake1')],why:t('bs_seuil_why')};
      break; }
    case 'DBLSEUIL': {
      // 2 sorties dans la journée : le matin en blocs longs, le soir en 400 m courts.
      const nAM=5, minAM=6, recAM=60, recNam=4;
      const nPM=10, distPM=400, recPM=30, recNpm=9;
      const amMainKm=distKmFromTime(nAM*minAM*60,pace.SEUIL*1.01), amRecKm=distKmFromTime(recNam*recAM,pace.RC);
      const pmMainKm=nPM*distPM/1000, pmRecKm=distKmFromTime(recNpm*recPM,pace.RC);
      km=round1(wuKm+amMainKm+amRecKm+cdKm+wuKm+pmMainKm+pmRecKm+cdKm);
      durMin=Math.round(2*WU_MIN+nAM*minAM+recNam*recAM/60+2*CD_MIN+nPM*splitSecFromPace(pace.SEUIL,distPM)/60+recNpm*recPM/60);
      p=S(pace.SEUIL); rpe=7; label=t('sessLabel_DBLSEUIL'); title=t('sessTitle_DBLSEUIL');
      series={reps:nPM,dist:distPM,paceSecPerKm:pace.SEUIL,recoverySec:recPM,recoveryLabel:t('recovLabel_30sTrot'),note:tp('bs_dblseuil_note',nAM,minAM)};
      d={objectif:t('bs_dblseuil_objectif'),warmup:tp('bs_dblseuil_warmup',WU),body:tp('bs_dblseuil_body',nAM,minAM,S(pace.SEUIL*1.01),repsText(nPM,distPM,pace.SEUIL)),paces:tp('bs_dblseuil_paces',S(pace.SEUIL)),recovery:t('bs_dblseuil_recovery'),cooldown:tp('bs_dblseuil_cooldown',CD),tips:[t('bs_dblseuil_tip1')],mistakes:[t('bs_dblseuil_mistake1')],why:t('bs_dblseuil_why')};
      break; }
    case 'VMAc': {
      const n=vary(8,12), dist=300, recSecEach=60, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.VMAc,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.VMAc); rpe=9; label=t('sessLabel_VMAc'); title=t('sessTitle_VMAc');
      series={reps:n,dist,paceSecPerKm:pace.VMAc,recoverySec:recSecEach,recoveryLabel:t('recovLabel_1minTrot')};
      const vmac30m=Math.round(distKmFromTime(30,pace.VMAc)*1000);
      const vmacBodyN=vary(12,16);
      d={objectif:t('bs_vmac_objectif'),warmup:tp('bs_vmac_warmup',WU),body:tp('bs_vmac_body',repsText(n,dist,pace.VMAc),vmacBodyN,vmac30m,vmac30m),paces:tp('bs_vmac_paces',fmtSplit(splitSecFromPace(pace.VMAc,dist)),dist,S(pace.VMAc)),recovery:tp('bs_vmac_recovery',dist),cooldown:CD,tips:[tp('bs_vmac_tip1',fmtSplit(splitSecFromPace(pace.VMAc,dist)),dist)],mistakes:[t('bs_vmac_mistake1'),tp('bs_vmac_mistake2',dist)],why:t('bs_vmac_why')};
      genParams={vmacBodyN};
      break; }
    case 'VMAl': case 'VO2': {
      const n=vary(5,7), dist=1000, recSecEach=150, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.VMAl,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.VMAl); rpe=9; label=type==='VO2'?t('sessLabel_VO2'):t('sessLabel_VMAl'); title=type==='VO2'?t('sessTitle_VO2'):t('sessTitle_VMAl');
      series={reps:n,dist,paceSecPerKm:pace.VMAl,recoverySec:recSecEach,recoveryLabel:t('recovLabel_2to3minTrot')};
      const vmalBodyN=vary(4,5);
      d={objectif:t('bs_vmal_objectif'),warmup:WU,body:tp('bs_vmal_body',repsText(n,dist,pace.VMAl),vmalBodyN),paces:tp('bs_vmal_paces',S(pace.VMAl)),recovery:t('recovLabel_2to3minTrot'),cooldown:CD,tips:[t('bs_vmal_tip1'),t('bs_vmal_tip2')],mistakes:[t('bs_vmal_mistake1')],why:t('bs_vmal_why')};
      genParams={vmalBodyN};
      break; }
    case 'INTERVAL': {
      const segs=[200,400,600,800,600,400,200];
      const paceFor=dist=>repPace(vdot,dist);
      const mainSec=segs.reduce((a,dist)=>a+splitSecFromPace(paceFor(dist),dist),0);
      const mainKm=segs.reduce((a,dist)=>a+dist,0)/1000;
      const recSec=mainSec*6/7; // récup = durée de l'effort, entre chaque segment (pas après le dernier)
      const recKm=distKmFromTime(recSec,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+mainSec/60+recSec/60+CD_MIN);
      p=S(pace.VMAl); rpe=8; label=t('sessLabel_INTERVAL'); title=t('sessTitle_INTERVAL');
      series={segments:segs.map(dist=>({dist,paceSecPerKm:paceFor(dist),splitSec:splitSecFromPace(paceFor(dist),dist)})),recoveryLabel:t('bs_interval_recoveryLabel')};
      const detailSegs=segs.map(dist=>dist+' m ('+fmtSplit(splitSecFromPace(paceFor(dist),dist))+')').join(' · ');
      d={objectif:t('bs_interval_objectif'),warmup:WU,body:tp('bs_interval_body',detailSegs),paces:tp('bs_interval_paces',S(paceFor(200)),S(paceFor(800))),recovery:t('bs_interval_recovery'),cooldown:CD,tips:[t('bs_interval_tip1')],mistakes:[t('bs_interval_mistake1')],why:t('bs_interval_why')};
      break; }
    case 'SPE': case 'SPE_COURT': {
      const n=type==='SPE_COURT'?vary(3,4):vary(4,6), dist=1000, recSecEach=90, recN=Math.max(0,n-1);
      const mainKm=n*dist/1000, recKm=distKmFromTime(recN*recSecEach,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*splitSecFromPace(pace.SPE,dist)/60+recN*recSecEach/60+CD_MIN);
      p=S(pace.SPE); rpe=8; label=t('sessLabel_SPE'); title=t('sessTitle_SPE')+(P.objRace?' '+trRace(P.objRace):'');
      series={reps:n,dist,paceSecPerKm:pace.SPE,recoverySec:recSecEach,recoveryLabel:t('recovLabel_90sTrot')};
      d={objectif:tp('bs_spe_objectif',goal),warmup:WU,body:tp('bs_spe_body',repsText(n,dist,pace.SPE)),paces:tp('bs_spe_paces',S(pace.SPE)),recovery:t('recovLabel_90sTrot'),cooldown:CD,tips:[t('bs_spe_tip1')],mistakes:[t('bs_spe_mistake1')],why:t('bs_spe_why')};
      break; }
    case 'PROGRESSIF':
      km=Math.round(easyKm*1.2); p=S(pace.MAR); rpe=6; label=t('sessLabel_PROGRESSIF'); title=t('sessTitle_PROGRESSIF');
      d={objectif:t('bs_progressif_objectif'),warmup:tp('bs_10min_warmup',S(pace.EF)),body:tp('bs_progressif_body',km,S(pace.EF),S(pace.MAR),S(pace.TEMPO)),paces:t('bs_progressif_paces'),recovery:t('bs_progressif_recovery'),cooldown:CD,tips:[t('bs_progressif_tip1')],mistakes:[t('bs_progressif_mistake1')],why:t('bs_progressif_why')};
      break;
    case 'FARTLEK': {
      const n=vary(8,12);
      const mainKm=n*(distKmFromTime(60,pace.VMAl)+distKmFromTime(60,pace.EF));
      km=round1(distKmFromTime(15*60,pace.EF)+mainKm+cdKm); durMin=Math.round(15+n*2+CD_MIN);
      p=S(pace.TEMPO); rpe=6; label=t('sessLabel_FARTLEK'); title=t('sessTitle_FARTLEK');
      d={objectif:t('bs_fartlek_objectif'),warmup:tp('bs_fartlek_warmup',S(pace.EF)),body:tp('bs_fartlek_body',n),paces:tp('bs_fartlek_paces',S(pace.VMAl),S(pace.EF)),recovery:t('bs_fartlek_recovery'),cooldown:CD,tips:[t('bs_fartlek_tip1')],mistakes:[t('bs_fartlek_mistake1')],why:t('bs_fartlek_why')};
      genParams={n};
      break; }
    case 'COTES': {
      const n=vary(8,12), effortSec=37.5;
      const mainKm=distKmFromTime(n*effortSec,pace.SEUIL), recKm=distKmFromTime(n*effortSec,pace.RC);
      km=round1(wuKm+mainKm+recKm+cdKm); durMin=Math.round(WU_MIN+n*effortSec/60+n*effortSec/60+CD_MIN);
      p=S(pace.SEUIL); rpe=8; label=t('sessLabel_COTES'); title=t('sessTitle_COTES');
      series={reps:n,recoveryLabel:t('bs_cotes_recoveryLabel'),note:t('bs_cotes_note')};
      d={objectif:t('bs_cotes_objectif'),warmup:WU,body:tp('bs_cotes_body',n),paces:t('bs_cotes_paces'),recovery:t('bs_cotes_recovery'),cooldown:CD,tips:[t('bs_cotes_tip1')],mistakes:[t('bs_cotes_mistake1')],why:t('bs_cotes_why')};
      break; }
    case 'LIGNES':
      km=Math.round(easyKm*0.8); p=S(pace.EF); rpe=4; label=t('sessLabel_LIGNES'); title=t('sessTitle_LIGNES');
      { const lignesN=vary(6,8);
        d={objectif:t('bs_lignes_objectif'),warmup:tp('bs_10min_warmup',S(pace.EF)),body:tp('bs_lignes_body',Math.round(km*0.7),lignesN),paces:t('bs_lignes_paces'),recovery:t('bs_lignes_recovery'),cooldown:t('bs_lignes_cooldown'),tips:[t('bs_lignes_tip1')],mistakes:[t('bs_lignes_mistake1')],why:t('bs_lignes_why')};
        genParams={lignesN}; }
      break;
    case 'COURSE':
      const m=raceMeters(); km=Math.round(m/1000); p=S(predictTime(vdot,m)/(m/1000)); rpe=10; label=t('sessLabel_COURSE'); title=t('sessTitle_COURSE')+' — '+(trRace(P.objRace)||t('competitionDefault'));
      d={objectif:tp('bs_course_objectif',(P.objTime||goal)),warmup:t('bs_course_warmup'),body:tp('bs_course_body',km,S(predictTime(vdot,m)/(m/1000))),paces:tp('bs_course_paces',S(predictTime(vdot,m)/(m/1000))),recovery:'—',cooldown:t('bs_course_cooldown'),tips:[t('bs_course_tip1'),t('bs_course_tip2')],mistakes:[t('bs_course_mistake1')],why:t('bs_course_why')};
      break;
    default:
      km=easyKm; p=S(pace.EF); rpe=3; label=t('sessLabel_default'); title=t('sessTitle_default');
      d={objectif:t('bs_default_objectif'),warmup:'-',body:tp('bs_default_body',km),paces:S(pace.EF)+'/km',recovery:'-',cooldown:'-',tips:[],mistakes:[],why:t('bs_default_why')};
  }
  if(isDeload && km>0){ d.objectif=tp('deloadPrefixTemplate',d.objectif); }
  return {km,pace:p,rpe,title,label,detail:d,durMin,series,genParams};
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
function periodTabLabel(per){ return {week:t('perWeek'),month:t('perMonth'),['3m']:t('per3Month'),year:t('perYear')}[per]||t('perWeek'); }
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
function muscuCountWeek(){ const ws=weekStart(); return MSESS.filter(s=>new Date(s.date)>=ws).length; }
function totalSessions(){ return SESS.length+MSESS.length; }
function streakDays(){
  const set=new Set([...SESS,...MSESS].map(s=>s.date));
  let streak=0; let d=new Date(); d.setHours(0,0,0,0);
  if(!set.has(dateKey(d))){ d.setDate(d.getDate()-1); if(!set.has(dateKey(d))) return 0; }
  while(set.has(dateKey(d))){ streak++; d.setDate(d.getDate()-1); }
  return streak;
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
    if(ps && ps.type!=='Repos') list.unshift({id:'plan',txt:'Faire : '+planSessTitle(ps),done:false});
    else list.unshift({id:'mobility',txt:'10 min de mobilité',done:false});
    GOALS={date:tk,list};
    DB.save('daily_goals',GOALS);
  }
  return GOALS.list;
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
// Durée de repos lisible : 90 -> 1min 30s, 45 -> 45s.
function fmtRest(s){ s=Math.max(0,Math.round(s||0)); const m=Math.floor(s/60), r=s%60; return m?(m+"min"+(r?" "+r+"s":"")):(r+"s"); }
function fmtHM(mins){ mins=Math.round(mins||0); const h=Math.floor(mins/60), m=mins%60; return h>0?(h+'h '+String(m).padStart(2,'0')+'min'):(m+'min'); }

/* ---------- RENDER HOME HELPERS (Accueil A) ---------- */
// Variation de charge hebdo vs la semaine passée, pour le quip sous le gros chiffre
function homeLoadQuip(kmW){
  const prev=lastWeekKm();
  if(!prev) return 'Continue sur ta lancée.';
  const delta=Math.round((kmW-prev)/prev*100);
  if(delta>0) return ''+delta+'% vs semaine dernière. Rythme tenu.';
  if(delta<0) return ''+Math.abs(delta)+'% vs semaine dernière.';
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
      '<div><div class="goal-lab">'+t('objectiveCap')+'</div><div class="goal-race">'+escHtml(trRace(P.objRace)||P.goal||t('yourNextRaceDefault'))+(P.objTime?' — sub '+escHtml(P.objTime):'')+'</div>'+
      '<div class="goal-target">Course le '+fmtDate(P.compDate)+'</div></div>'+
      '<div class="goal-count"><div class="n">'+daysLeft+'</div><div class="u">'+t('daysLab')+'</div></div>'+
    '</div>'+
    '<div class="goal-bar"><div style="width:'+pct+'%"></div></div>'+
  '</div>';
}
// Ligne "Progression" — badges de médailles (séances / régularité / distance)
function homeBadgesRow(){
  const icons={sessions:'medal',streak:'fire',distance:'chart'};
  let bestCat=null, bestPct=-1, bestTier=-1;
  const cells=MEDAL_CATS.map(c=>{
    const v=Math.floor(c.val());
    let tierIdx=-1; c.thr.forEach((th,i)=>{ if(v>=th)tierIdx=i; });
    const next=tierIdx<c.thr.length-1?c.thr[tierIdx+1]:null;
    const prevT=tierIdx>=0?c.thr[tierIdx]:0;
    const pct=next?Math.min(100,Math.round(((v-prevT)/(next-prevT))*100)):100;
    if(next && pct>bestPct){ bestPct=pct; bestCat=c; bestTier=tierIdx; }
    const locked=tierIdx<0;
    return '<div class="badge-mini'+(locked?' locked':'')+'" onclick="nav(\'stats\')">'+ICN(icons[c.key]||'medal',18)+'</div>';
  });
  const label=bestCat?(TIERS[bestTier+1]?TIERS[bestTier+1][0]:bestCat.name)+' · '+bestPct+'%':t('continueUnlockBadges');
  return '<div class="card stag" style="padding:16px;animation-delay:.12s" onclick="nav(\'stats\')">'+
    '<div class="badge-mini-row">'+cells.join('')+
      '<div class="badge-progress-txt"><div class="t">'+label+'</div><div class="b"><div style="width:'+Math.max(0,bestPct)+'%"></div></div></div>'+
    '</div></div>';
}

/* ---------- RENDER HOME ---------- */
/* ---------- RENDER HOME (Accueil V7) ---------- */
// Trouve la prochaine vraie séance (non-repos) strictement après aujourd'hui dans le plan IA.
function homeNextUpcoming(){
  if(!PLAN||!PLAN.sessions) return null;
  const tk=todayKey();
  const nxt=PLAN.sessions.find(s=>s.date>tk && s.km>0 && s.type!=='Repos');
  if(!nxt) return null;
  const d=new Date(nxt.date+'T00:00:00'), today=new Date(); today.setHours(0,0,0,0);
  const days=Math.round((d-today)/86400000);
  const label=days===1?t('tomorrow'):fmtDate(nxt.date);
  return {session:nxt,label};
}
// Nombre de km à l'affichage — séparateur décimal de la langue active (20,7 en FR, 20.7 en EN).
function hKm(v){ const n=Number(v); return isFinite(n)?n.toLocaleString(localeCode(),{maximumFractionDigits:1}):String(v); }
// 7 barres de charge quotidienne de la semaine. Les jours déjà courus sont pleins ; les jours
// à venir affichent en creux la charge PRÉVUE par le plan, pour que la semaine se lise en
// entier et pas seulement dans sa partie écoulée. Le jour courant est mis en avant.
function homeWeekBarsHTML(){
  const ws=weekStart(), dowLabels=t('dowShort').split(','), tk=todayKey();
  const EFFORT_TYPES=['Tempo','Seuil','VMA','Intervalle'];
  const week=[];
  for(let i=0;i<7;i++){
    const d=new Date(ws); d.setDate(ws.getDate()+i); const k=dateKey(d);
    const daySess=[...SESS,...MSESS].filter(s=>s.date===k);
    let km=daySess.reduce((a,s)=>a+(s.km||0),0);
    let effort=daySess.some(s=>EFFORT_TYPES.includes(s.type)), planned=false;
    if(!km && PLAN && PLAN.sessions){
      const p=PLAN.sessions.find(s=>s.date===k && s.km>0 && s.type!=='Repos' && !s.missed);
      if(p){ km=p.km; effort=HARD_TYPES.includes(p.baseType); planned=true; }
    }
    week.push({k,km,effort,planned});
  }
  const maxDay=Math.max(1,...week.map(w=>w.km));
  let bars='';
  week.forEach((w,i)=>{
    const isToday=w.k===tk;
    const cls=isToday?'now':(w.planned?'plan':(w.effort?'effort':'done'));
    const inner=w.km>0?'<b class="'+cls+'" style="height:'+Math.max(12,Math.round(w.km/maxDay*100))+'%"></b>':'';
    bars+='<div class="hv7-hw-day'+(isToday?' today':'')+'"><div class="hv7-hw-bar">'+inner+'</div><span class="hv7-hw-lab">'+dowLabels[i]+'</span></div>';
  });
  return '<div class="hv7-hero-week">'+bars+'</div>';
}
// Les n prochaines vraies séances du plan (hors repos), strictement après aujourd'hui.
function homeNextRows(n){
  if(!PLAN||!PLAN.sessions) return null;
  const tk=todayKey(), today=new Date(tk+'T00:00:00');
  const list=PLAN.sessions.filter(s=>s.date>tk && s.km>0 && s.type!=='Repos').slice(0,n||3);
  if(!list.length) return null;
  let h='';
  list.forEach(s=>{
    const d=new Date(s.date+'T00:00:00');
    const days=Math.max(1,Math.round((d-today)/86400000));
    const dayRaw=d.toLocaleDateString(localeCode(),{weekday:'short'}).replace('.','');
    const dayCap=dayRaw.charAt(0).toUpperCase()+dayRaw.slice(1);
    const meta=dayCap+(s.km?' · '+hKm(s.km)+' km':'')+(s.pace?' · '+s.pace+'/km':'');
    h+='<div class="hv7-nx" onclick="openRunSheet('+s.id+')"><i style="background:'+baseTypeColor(s.baseType)+'"></i>'+
      '<div class="hv7-nx-b"><b>'+escHtml(planSessTitle(s))+'</b><span>'+escHtml(meta)+'</span></div>'+
      '<em>'+(days===1?t('tomorrow'):tp('dayPlusShort',days))+'</em></div>';
  });
  return h;
}
// Bilan en un geste depuis l'accueil : « Je l'ai faite » enchaîne sur le debrief habituel,
// « Pas faite » ouvre le flux séance manquée (raison → remplacement → ajustement du plan).
function homeSessDone(id){ curRunId=id; markRunDone(); renderHome(); }
function homeSessMissed(id){ openMissedFlow(id); }
function renderHome(){
  const kmW=kmThisWeek();
  const sessW=runCountWeek()+muscuCountWeek(), sessTarget=(P.days&&P.days.length)||4;
  const form=formScore();
  const vdot=getUserVDOT();
  const ps=planSessionToday();
  const first=(P.name||'').split(' ')[0]||'';

  if(P.easyMode){ $('#s-home').innerHTML=renderHomeSimple(ps,sessW,sessTarget,vdot,form,first); return; }

  let html='<div class="hv7-bg"><span class="hv7-lb1"></span><span class="hv7-lb2"></span><span class="hv7-lb3"></span></div>';
  html+='<div class="hv7-content">';

  // HEADER — logo IKORUN (gauche) + partage/notifs/amis (droite)
  {
    const hasReminderDot=(P.notif!==false)&&ps&&ps.type!=='Repos';
    html+='<div class="hv7-header"><div class="hv7-header-left"><div class="hv7-logo">'+
      '<div class="ik-logo-mark" style="-webkit-mask-image:url(\''+LOGO_MARK_URI+'\');mask-image:url(\''+LOGO_MARK_URI+'\')" role="img" aria-label="IKORUN"></div><span>IKORUN</span></div></div>'+
      '<div class="hv7-header-right">'+
        '<div class="hv7-icon-btn" onclick="shareApp()" title="'+t('share')+'">'+ICN('share',17)+'</div>'+
        '<div class="hv7-icon-btn" onclick="openProfileSection(\'notif\')" title="'+t('notifLabel')+'">'+ICN('bell',17)+(hasReminderDot?'<span class="dot"></span>':'')+'</div>'+
        '<div class="hv7-icon-btn" onclick="openClub()" title="'+t('myClubLab')+'">'+ICN('flag',17)+'</div>'+
        '<div class="hv7-people" onclick="openFriends()">'+ICN('users',18)+'</div>'+
      '</div></div>';
  }

  // SALUTATION — semaine/phase du plan si actif, sinon quip objectif. La série en cours,
  // quand il y en a une, est glissée en suffixe pour ne pas encombrer la carte du jour.
  const wdRaw=new Date().toLocaleDateString(localeCode(),{weekday:'long'});
  const wdCap=wdRaw.charAt(0).toUpperCase()+wdRaw.slice(1);
  const wdShortRaw=new Date().toLocaleDateString(localeCode(),{weekday:'short'}).replace('.','');
  const wdShort=wdShortRaw.charAt(0).toUpperCase()+wdShortRaw.slice(1);
  let sub;
  if(PLAN && PLAN.sessions && PLAN.sessions.length){
    const tk=todayKey();
    const todaySess=PLAN.sessions.find(s=>s.date===tk);
    const upcoming=PLAN.sessions.find(s=>s.date>=tk);
    const curSess=todaySess||upcoming||PLAN.sessions[PLAN.sessions.length-1];
    sub=tp('weekPhaseLabel',curSess.week,phaseName(curSess.phaseKey));
  } else {
    sub=P.objTime?tp('quipTime',escHtml(P.objTime)):(P.goal?tp('quipGoal',escHtml(P.goal)):t('quipDefault'));
  }
  {
    const streak=streakDays();
    if(streak>=2) sub+=' · '+tp('streakDaysShort',streak);
  }
  html+='<div class="hv7-greet"><h1>'+t('greet')+' '+escHtml(first||t('you'))+'</h1><p>'+sub+'</p></div>';

  // CARTE DU JOUR — pièce maîtresse : type, titre, pourquoi, cibles, et le bilan en un geste.
  {
    if(ps && ps.type!=='Repos'){
      const isPerso=ps._source==='perso';
      const col=isPerso?'var(--e2)':baseTypeColor(ps.baseType);
      const lab=((isPerso?(ps.type||''):planSessLabel(ps))||'').toUpperCase();
      const dt=isPerso?null:liveDetail(ps);
      const why=(dt&&dt.objectif)?dt.objectif:'';
      const open=isPerso?("curPerso='"+ps._personId+"';openPersoSheet('"+ps.id+"')"):('openRunSheet('+ps.id+')');
      html+='<div class="hv7-day" onclick="'+open+'">'+
        '<div class="hv7-day-top">'+(lab?'<span class="hv7-day-chip" style="color:'+col+'">'+escHtml(lab)+'</span>':'<span></span>')+
          '<span class="hv7-day-when">'+t('today')+' · '+escHtml(wdShort)+'</span></div>'+
        '<div class="hv7-day-title">'+escHtml(isPerso?(ps.title||''):planSessTitle(ps))+'</div>'+
        (why?'<div class="hv7-day-why">'+escHtml(why)+'</div>':'');
      const cells=[];
      if(ps.km) cells.push([hKm(ps.km),'km']);
      if(ps.pace) cells.push([ps.pace,'/km']);
      if(ps.rpe) cells.push([ps.rpe+'/10',t('rpeShort')]);
      else if(ps.duration) cells.push([ps.duration,'min']);
      if(cells.length) html+='<div class="hv7-day-targets">'+cells.map(c=>'<div><b>'+escHtml(String(c[0]))+'</b><span>'+escHtml(String(c[1]))+'</span></div>').join('')+'</div>';
      if(ps.done) html+='<div class="hv7-day-state ok">'+t('sessionCompleted')+'</div>';
      else if(ps.missed) html+='<div class="hv7-day-state ko">'+t('missedTag')+'</div>';
      else if(!isPerso) html+='<div class="hv7-day-acts" onclick="event.stopPropagation()">'+
          '<button class="hv7-act main" onclick="homeSessDone('+ps.id+')">'+t('iDidIt')+'</button>'+
          '<button class="hv7-act ghost" onclick="homeSessMissed('+ps.id+')">'+t('notDone')+'</button></div>';
      html+='</div>';
    } else if(ps || PLAN){
      const nxt=homeNextUpcoming();
      html+='<div class="hv7-day" onclick="nav(\'sport\')">'+
        '<div class="hv7-day-top"><span class="hv7-day-chip" style="color:var(--dim)">'+escHtml(t('restTag').toUpperCase())+'</span>'+
          '<span class="hv7-day-when">'+t('today')+' · '+escHtml(wdShort)+'</span></div>'+
        '<div class="hv7-day-title">'+t('restDay')+'</div>'+
        '<div class="hv7-day-why">'+(nxt?tp('nextSessionMeta',nxt.label):t('noSessionToday'))+'</div>'+
      '</div>';
    } else {
      html+='<div class="hv7-day" onclick="nav(\'sport\');openPlanSetup()">'+
        '<div class="hv7-day-top"><span class="hv7-day-chip" style="color:var(--e2)">IKORUN</span>'+
          '<span class="hv7-day-when">'+escHtml(wdCap)+'</span></div>'+
        '<div class="hv7-day-title">'+t('planIkorunTitle')+'</div>'+
        '<div class="hv7-day-why">'+tp('planIkorunDescLong',(vdot||'?'))+'</div>'+
        '<div class="hv7-day-acts"><button class="hv7-act main">'+t('configureGenerate')+'</button></div>'+
      '</div>';
    }
  }

  // SEMAINE COMPACTE — 7 barres de charge, jour courant repéré
  html+=homeWeekBarsHTML();

  // 3 TUILES — volume de la semaine, séances faites sur l'objectif, VDOT courant
  html+='<div class="hv7-krow3" onclick="nav(\'stats\')">'+
    '<div class="hv7-ktile"><div class="hv7-ktile-val">'+hKm(kmW)+'</div><div class="hv7-ktile-lab">'+t('kmWeekShort')+'</div></div>'+
    '<div class="hv7-ktile"><div class="hv7-ktile-val">'+sessW+'/'+sessTarget+'</div><div class="hv7-ktile-lab">'+t('sessionsLab')+'</div></div>'+
    '<div class="hv7-ktile"><div class="hv7-ktile-val">'+(vdot||'—')+'</div><div class="hv7-ktile-lab">VDOT</div></div>'+
  '</div>';

  // ENSUITE — les prochaines séances du plan
  {
    const nxRows=homeNextRows(3);
    if(nxRows){
      html+='<div class="hv7-sec-lab">'+t('nextLab')+' <span class="see" onclick="openFullPlan()">'+t('seePlan')+' ›</span></div>';
      html+='<div>'+nxRows+'</div>';
    } else if(PLAN){
      html+='<div class="hv7-sec-lab">'+t('nextLab')+'</div>';
      html+='<div class="hv7-nx"><div class="hv7-nx-b"><b>'+t('noUpcomingSession')+'</b></div></div>';
    }
  }

  html+='</div>';
  $('#s-home').innerHTML=html;
}
function renderHomeSimple(ps,sessW,sessTarget,vdot,form,first){
  let h='';
  h+='<div class="ik-header"><div class="ik-logo">'+
    '<div class="ik-logo-mark" style="-webkit-mask-image:url(\''+LOGO_MARK_URI+'\');mask-image:url(\''+LOGO_MARK_URI+'\')" role="img" aria-label="IKORUN"></div>'+
    '<span>IKORUN</span></div>'+
    '<div class="hv7-icon-btn" onclick="openClub()" title="'+t('myClubLab')+'">'+ICN('flag',17)+'</div>'+
  '</div>';
  h+=homeStreakBadge();
  h+='<div class="ik-greet"><h1>'+t('greet')+' '+escHtml(first||t('you'))+'</h1></div>';

  h+='<div class="next-lab">'+t('todayCap')+'</div>';
  if(ps && ps.type!=='Repos'){
    h+='<div class="card next-card stag" onclick="'+(ps._source==='perso'?"curPerso='"+ps._personId+"';openPersoSheet('"+ps.id+"')":'openRunSheet('+ps.id+')')+'">'+
      '<div class="next-body"><div class="next-title">'+planSessTitle(ps)+'</div>'+
      '<div class="next-meta">'+(ps.km?hKm(ps.km)+' km · '+ps.pace+'/km'+(ps.duration?' · '+ps.duration+' min':''):'')+'</div>'+
      '<div class="next-when">'+t('tapToStart')+'</div></div>'+
      '<div class="next-ic">'+ICN('run',20)+'</div></div>';
  } else {
    h+='<div class="card next-card stag" onclick="nav(\'sport\')">'+
      '<div class="next-body"><div class="next-title">'+t('restDay')+'</div>'+
      '<div class="next-meta">'+t('noSessionToday')+'</div></div>'+
      '<div class="next-ic">'+ICN('moon',20)+'</div></div>';
  }

  h+='<div class="stat-quatro" style="grid-template-columns:repeat(3,1fr);margin-top:14px">'+
    '<div class="card stat-card" onclick="nav(\'sport\')"><div class="stat-ic">'+ICN('run',14)+'</div><div class="stat-v">'+sessW+'/'+sessTarget+'</div><div class="stat-l">'+t('sessionsCap')+'</div></div>'+
    '<div class="card stat-card" onclick="nav(\'profil\')"><div class="stat-ic">'+ICN('lung',14)+'</div><div class="stat-v">'+(vdot||'—')+'</div><div class="stat-l">VDOT</div></div>'+
    '<div class="card stat-card" onclick="nav(\'profil\')"><div class="stat-ic">'+ICN('heart',14)+'</div><div class="stat-v">'+form+'%</div><div class="stat-l">'+t('formCap')+'</div></div>'+
  '</div>';

  if(P.objRace||P.goal||P.compDate){
    h+='<div class="sec-lab" style="margin-top:16px">'+t('objective')+'</div>'+homeGoalCard();
  }
  return h;
}
function fmtDate(s){ const d=new Date(s); return d.toLocaleDateString(localeCode(),{weekday:'short',day:'numeric',month:'short'}); }

/* ---------- SPORT ---------- */
let sportTab='run', runSub='ia';
// Couleur d'une phase d'entraînement — échelle sémantique fixe (six phases),
// volontairement indépendante de l'accent choisi : c'est une information, pas une déco.
function phaseColor(key){ return 'var(--ph-'+(key||'PG')+')'; }
/* Carte plan de l'onglet Sport : la course visée, le compte à rebours, le rail des
   six phases (chaque barre large comme sa durée réelle), et trois chiffres qui
   situent la semaine en cours. */
function planHeroHTML(){
  const tk=todayKey();
  const todaySess=PLAN.sessions.find(s=>s.date===tk);
  const upcoming=PLAN.sessions.find(s=>s.date>=tk);
  const curSess=todaySess||upcoming||PLAN.sessions[PLAN.sessions.length-1];
  const curWeekNum=curSess.week;
  const weekSessions=PLAN.sessions.filter(s=>s.week===curWeekNum);

  const byPhase=[];
  PLAN.sessions.forEach(s=>{
    const last=byPhase[byPhase.length-1];
    if(!last || last.key!==s.phaseKey) byPhase.push({key:s.phaseKey,weeks:new Set([s.week])});
    else last.weeks.add(s.week);
  });
  const curIdx=byPhase.findIndex(p=>p.weeks.has(curWeekNum));
  const rail=byPhase.map((p,i)=>'<i class="'+(i<curIdx?'past':(i===curIdx?'now':''))+'" style="flex:'+p.weeks.size+';color:'+phaseColor(p.key)+'"></i>').join('');

  const comp=new Date(P.compDate+'T00:00:00'), today=new Date(tk+'T00:00:00');
  const daysLeft=Math.max(0,Math.round((comp-today)/86400000));

  const curKm=Math.round(weekSessions.reduce((a,s)=>a+(s.km||0),0));
  const prevKm=Math.round(PLAN.sessions.filter(s=>s.week===curWeekNum-1).reduce((a,s)=>a+(s.km||0),0));
  const kmDelta=prevKm?Math.round((curKm-prevKm)/prevKm*100):null;
  const realW=weekSessions.filter(s=>s.km>0 && s.type!=='Repos');
  const doneW=realW.filter(s=>s.done).length;
  const curVdot=getUserVDOT()||PLAN.vdot;
  const vdotDelta=Math.round((curVdot-PLAN.vdot)*10)/10;

  let h='<div class="sp-plan">';
  h+='<div class="sp-plan-top"><div><div class="sp-race">'+escHtml(trRace(P.objRace)||t('courseDefault'))+'</div>'+
    '<div class="sp-race-sub">'+(P.objTime?escHtml(P.objTime)+' · ':'')+fmtDate(P.compDate)+'</div></div>'+
    '<div class="sp-days"><b>'+daysLeft+'</b><span>'+t('daysLab')+'</span></div></div>';
  h+='<div class="sp-rail">'+rail+'</div>';
  h+='<div class="sp-rail-lab"><b>'+phaseName(curSess.phaseKey)+'</b><span>'+tp('weekOf',curWeekNum,PLAN.weeks)+'</span></div>';
  h+='<div class="sp-metrics">'+
    '<div><b>'+curVdot+(vdotDelta?' <span class="sp-delta '+(vdotDelta>0?'up':'down')+'">'+(vdotDelta>0?'+':'')+vdotDelta+'</span>':'')+'</b><span>VDOT</span></div>'+
    '<div><b>'+curKm+' km'+(kmDelta!==null?' <span class="sp-delta '+(kmDelta>=0?'up':'down')+'">'+(kmDelta>=0?'+':'')+kmDelta+'%</span>':'')+'</b><span>'+t('weeklyLoad')+'</span></div>'+
    '<div><b>'+doneW+'/'+realW.length+'</b><span>'+t('sessionsCap')+'</span></div>'+
    '</div>';
  h+='<div class="sp-acts"><button onclick="openFullPlan()">'+t('seePlan')+'</button>'+
    '<button class="lnk" onclick="confirmRegenPlan()">'+t('regenBtn')+'</button></div>';
  h+='</div>';
  return h;
}
function renderRunning(){
  let h='<div class="pills sub" style="margin-bottom:14px"><div class="pill '+(runSub==='ia'?'on':'')+'" onclick="runSub=\'ia\';renderSport()">'+t('planIkorunPill')+'</div><div class="pill '+(runSub==='perso'?'on':'')+'" onclick="runSub=\'perso\';renderSport()">'+t('myPlanPill')+'</div></div>';
  if(runSub==='ia'){
    if(!PLAN){
      h+='<div class="card" id="tourPlanCta"><div class="empty"><div class="em-ic">'+ICN('bolt',36,'currentColor')+'</div><div style="font-weight:700;margin-bottom:6px;color:var(--snow)">'+t('planIkorunTitle')+'</div><div style="font-size:13px;margin-bottom:16px">'+tp('planIkorunDescLong',(getUserVDOT()||'?'))+'</div><button class="btn" onclick="openPlanSetup()">'+t('configureGenerate')+'</button></div></div>';
    } else {
      h+=planHeroHTML();
      // Seule la semaine en cours est listée ici ; le reste du plan s'ouvre en
      // plein écran depuis le bouton « Voir le plan » de la carte ci-dessus.
      const tk=todayKey();
      const todaySess=PLAN.sessions.find(s=>s.date===tk);
      const upcoming=PLAN.sessions.find(s=>s.date>=tk);
      const featuredWeek=(todaySess||upcoming||PLAN.sessions[PLAN.sessions.length-1]).week;
      h+='<div class="hv7-sec-lab" style="margin-bottom:10px">'+t('thisWeek')+'</div>';
      h+=renderPlanRows(PLAN.sessions.filter(s=>s.week===featuredWeek),tk,{flat:true});
    }
  } else {
    h+=renderPersoList();
  }
  return h;
}
/* Rendu des lignes de séances d'un plan, groupées par phase puis semaine.
   Réutilisé pour l'aperçu « cette semaine » (opts.flat : pas d'en-têtes, on est
   déjà dans un contexte d'une seule semaine) et pour la page plein écran. */
function renderPlanRows(sessions,tk,opts){
  tk=tk||todayKey(); opts=opts||{};
  let h='', curPhase=null, curWeek=null;
  sessions.forEach(s=>{
    if(!opts.flat){
      if(s.phaseKey!==curPhase){ curPhase=s.phaseKey; h+='<div class="phase-head" style="color:'+phaseColor(s.phaseKey)+'">'+phaseName(s.phaseKey)+'</div>'; }
      if(s.week!==curWeek){ curWeek=s.week; h+='<div class="lab" style="margin:8px 0 6px">'+tp('weekN',s.week)+(s.deload?t('deloadTag'):'')+'</div>'; }
    }
    const isToday=s.date===tk;
    const rest=(!s.km || s.type==='Repos');
    const qb = s.done   ? '<div class="qbadge done">'+t('doneTag')+'</div>'
             : s.missed ? '<div class="qbadge missed">'+t('missedTag')+'</div>'
             : rest     ? '<div class="qbadge rest">'+t('restTag')+'</div>'
             : '<div class="chrome-chip" style="color:'+baseTypeColor(s.baseType)+'">'+escHtml(planSessLabel(s))+'</div>';
    const ssum=seriesSummary({...s,series:liveSeries(s)});
    const line2=fmtDate(s.date)+(s.km?' · '+hKm(s.km)+' km':' · '+t('restTag'))+(s.km&&!ssum?' · '+s.pace+'/km':'');
    h+='<div class="sess'+(s.done?' done':'')+(s.missed?' missed':'')+(isToday?' today':'')+'"'+
      ' style="--sess-c:'+(rest?'var(--dim)':baseTypeColor(s.baseType))+'" onclick="openRunSheet('+s.id+')">'+
      '<div class="row"><div><div class="sess-t">'+escHtml(planSessTitle(s))+'</div>'+
      '<div class="sess-m">'+escHtml(line2)+'</div>'+
      (ssum?'<div class="sess-s">'+escHtml(ssum)+'</div>':'')+'</div>'+qb+'</div></div>';
  });
  return h;
}
/* Page plein écran affichant le programme complet (toutes les semaines) */
function openFullPlan(){
  if(!PLAN) return;
  $('#fullPlanBody').innerHTML=renderPlanRows(PLAN.sessions);
  openOv('ovFullPlan');
}
/* ---------- PLAN PERSONNEL (fonctionnel) ---------- */
let curPerso=null;
function renderPersoList(){
  const persoPlans=CUSTOM.filter(p=>p.kind==='run');
  let h='<button class="btn" style="margin-bottom:14px" onclick="addPersoPlan()">'+t('newPersoPlan')+'</button>';
  if(!persoPlans.length){ h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('clipboard',36,'currentColor')+'</div><div style="font-weight:700;color:var(--snow);margin-bottom:6px">'+t('createCustomPlan')+'</div><div style="font-size:13px">'+t('createCustomPlanDesc')+'</div></div></div>'; }
  else persoPlans.forEach((p)=>{
    const done=p.sessions.filter(s=>s.done).length;
    const followBadge=P.followPerso===p.id?'<span class="chrome-chip" style="color:var(--ok);margin-left:6px">'+t('followedTag')+'</span>':'';
    h+='<div class="card" style="padding:13px 14px"><div class="row" onclick="openPerso(\''+p.id+'\')" style="cursor:pointer"><div><div style="font-weight:700;font-size:14.5px">'+escHtml(p.name)+followBadge+'</div><div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+tp('sessionsCount',p.sessions.length,done)+'</div></div><span style="color:var(--e);font-size:18px">›</span></div>'+
      '<div class="row" style="margin-top:9px;gap:8px"><div class="pbar" style="flex:1;margin-top:0"><div style="width:'+(p.sessions.length?done/p.sessions.length*100:0)+'%"></div></div>'+
      '<span class="mini-ic" onclick="dupPerso(\''+p.id+'\')" title="'+t('duplicate')+'">⎘</span><span class="mini-ic" onclick="sharePlan(\''+p.id+'\')" title="'+t('share')+'">↗</span><span class="mini-ic" style="color:var(--bad)" onclick="delPerso(\''+p.id+'\')" title="'+t('delete')+'">'+ICN('trash',16)+'</span></div></div>';
  });
  return h;
}
function addPersoPlan(){
  const n=prompt(t('planNamePrompt'),t('myPersoPlanDefault')); if(!n) return;
  const id='P'+Date.now();
  CUSTOM.push({id,kind:'run',name:n,sessions:[]}); saveAll(); openPerso(id);
}
function openPerso(id){ curPerso=id; renderSport(); setTimeout(()=>renderPersoDetail(),0); }
let sportView='list';
let sportShowAllWeeks=false; // n'affiche que la semaine en cours par défaut, dans les deux modes
function renderSport(){
  document.body.dataset.scr = sportView==='calendar' ? 'calendrier' : 'sport';
  $('#tbTitle').textContent = sportView==='calendar' ? t('calendarTitle') : t('sport');
  $('#tbSub').textContent = sportView==='calendar' ? t('calendarSub') : t('sub_sport');
  if(sportView==='calendar'){ $('#s-sport').innerHTML=renderCalendarView(); return; }
  let h='<div class="row" style="gap:8px;margin:6px 0 16px">'+
    '<div class="pills" style="flex:1;margin:0"><div class="pill '+(sportTab==='run'?'on':'')+'" onclick="sportTab=\'run\';curPerso=null;renderSport()">Running</div><div class="pill '+(sportTab==='muscu'?'on':'')+'" onclick="sportTab=\'muscu\';renderSport()">Musculation</div></div>'+
    '<div class="tb-gear" style="flex-shrink:0" onclick="sportView=\'calendar\';renderSport()">'+ICN('calendar',17)+'</div></div>';
  if(P.easyMode){
    h += sportTab==='run' ? renderRunningSimple() : renderMuscu();
    $('#s-sport').innerHTML=h; return;
  }
  if(sportTab==='run' && runSub==='perso' && curPerso){ h+=persoDetailHTML(); }
  else h+= sportTab==='run'?renderRunning():renderMuscu();
  $('#s-sport').innerHTML=h;
}
/* ---------- SPORT — MODE SIMPLIFIÉ ----------
   Plan IKORUN uniquement (pas de sous-onglet "Plan personnel" à choisir en
   plus) : le rail des phases, le delta de VDOT et "régénérer" disparaissent —
   juste "Semaine X / Y" et la liste des séances de la semaine, déjà lisible
   sans jargon (renderPlanRows en mode flat). La musculation n'a pas besoin
   d'une version à part : c'est déjà une liste de programmes + une silhouette,
   rien à simplifier de plus. */
function renderRunningSimple(){
  if(!PLAN){
    return '<div class="card" id="tourPlanCta"><div class="empty"><div class="em-ic">'+ICN('bolt',36,'currentColor')+'</div><div style="font-weight:700;margin-bottom:6px;color:var(--snow)">'+t('planIkorunTitle')+'</div><div style="font-size:13px;margin-bottom:16px">'+t('planIkorunDescSimple')+'</div><button class="btn" onclick="openPlanSetup()">'+t('configureGenerate')+'</button></div></div>';
  }
  const tk=todayKey();
  const todaySess=PLAN.sessions.find(s=>s.date===tk);
  const upcoming=PLAN.sessions.find(s=>s.date>=tk);
  const curSess=todaySess||upcoming||PLAN.sessions[PLAN.sessions.length-1];
  const comp=new Date(P.compDate+'T00:00:00'), today=new Date(tk+'T00:00:00');
  const daysLeft=Math.max(0,Math.round((comp-today)/86400000));
  let h='<div class="card" style="text-align:center;padding:18px">'+
    '<div class="lab" style="margin-bottom:4px">'+tp('weekOf',curSess.week,PLAN.weeks)+'</div>'+
    '<div class="man" style="font-weight:800;font-size:20px">'+escHtml(trRace(P.objRace)||t('courseDefault'))+'</div>'+
    '<div style="font-size:13px;color:var(--muted);margin-top:4px">'+t('objectiveCap')+' · J-'+daysLeft+'</div>'+
  '</div>';
  h+='<div class="hv7-sec-lab" style="margin:16px 0 10px">'+t('thisWeek')+'</div>';
  h+=renderPlanRows(PLAN.sessions.filter(s=>s.week===curSess.week),tk,{flat:true});
  h+='<button class="btn ghost" style="margin-top:12px" onclick="openFullPlan()">'+t('seePlan')+'</button>';
  return h;
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
  const monthLab=view.toLocaleDateString(localeCode(),{month:'long',year:'numeric'});
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
  h+='<div class="cal-grid cal-head">'+t('dowShort').split(',').map(l=>'<span>'+l+'</span>').join('')+'</div>';
  h+='<div class="cal-grid">';
  cells.forEach(c=>{
    if(c.muted) h+='<div class="cal-cell muted">'+c.d+'</div>';
    else h+='<div class="cal-cell'+(c.today?' today':'')+'">'+c.d+(c.has&&!c.today?'<span class="cal-dot"></span>':'')+'</div>';
  });
  h+='</div></div>';

  // Liste des prochaines séances
  h+='<div class="card" style="padding:12px 14px">';
  const dayLabels=[t('today'),t('tomorrow')];
  let shown=0;
  for(let i=0;i<10 && shown<3;i++){
    const d=new Date(); d.setDate(d.getDate()+i); const k=dateKey(d);
    const sess=sessionsForDate(k);
    if(!sess.length) continue;
    const lab=i<2?dayLabels[i]:d.toLocaleDateString(localeCode(),{weekday:'long'});
    const dlab=lab.charAt(0).toUpperCase()+lab.slice(1)+' · '+d.getDate()+' '+d.toLocaleDateString(localeCode(),{month:'long'});
    if(shown>0) h+='<div style="height:1px;background:var(--hair);margin:12px 0"></div>';
    h+='<div style="font-size:11px;color:var(--muted);font-weight:600;margin-bottom:8px">'+dlab+'</div>';
    sess.forEach(s=>{
      h+='<div class="rs-row" style="padding:0 0 4px" onclick="openRunSheet('+s.id+')"><div class="rs-ic" style="background:rgba(51,211,153,.16);color:var(--ok)">'+ICN('run',16)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">'+planSessTitle(s)+'</div><div class="rs-row-m">'+s.km+' km · '+s.pace+'/km</div></div></div>';
    });
    shown++;
  }
  if(!shown) h+='<div style="font-size:13px;color:var(--dim)">'+t('noUpcomingSession')+'</div>';
  h+='<div class="rs-row" style="padding:10px 0 0;cursor:pointer;color:var(--e2)" onclick="calBack();sportTab=\'run\';runSub=\'perso\'">'+ICN('bolt',16,'var(--e2)')+'<span style="font-weight:700;font-size:13.5px">'+t('addSession')+'</span></div>';
  h+='</div>';
  return h;
}
function persoDetailHTML(){
  const p=CUSTOM.find(x=>x.id===curPerso); if(!p) return renderPersoList();
  const tk=todayKey();
  const following=P.followPerso===p.id;
  let h='<div class="row" style="margin-bottom:14px"><button class="x" onclick="curPerso=null;renderSport()">‹</button><div class="man" style="font-weight:800;font-size:18px">'+p.name+'</div><button class="x" onclick="renamePerso(\''+p.id+'\')" aria-label="'+t('renameLab')+'">'+ICN('edit',16)+'</button></div>';
  h+='<div class="chrome-box'+(following?' accent':'')+'" style="display:flex;align-items:center;gap:10px">'
    +'<div style="flex:1"><div class="cb-head" style="margin-bottom:2px">'+(following?'Plan suivi actuellement':'Suivre ce plan à la place du plan IKORUN')+'</div>'
    +'<div class="cb-body" style="font-size:12px;color:var(--muted)">'+(following?'Ton accueil et ton bilan utilisent ce plan. Le plan IKORUN continue de s\u2019ajuster en arrière-plan selon ce que tu fais ici.':'Ton accueil affichera les séances de ce plan au lieu du plan généré. Tu peux revenir au plan IKORUN quand tu veux.')+'</div></div>'
    +'<button class="btn ghost sm" style="width:auto;white-space:nowrap" onclick="toggleFollowPerso(\''+p.id+'\')">'+(following?'Arrêter':'Suivre')+'</button></div>';
  h+='<button class="btn" style="margin-bottom:14px" onclick="addPersoSession()">＋ Ajouter une séance</button>';
  if(!p.sessions.length) h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('run',36,'currentColor')+'</div><div style="font-size:13px">Aucune séance. Ajoute ta première !</div></div></div>';
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
  toast(P.followPerso?t('followingPersoPlan'):t('backToIkorunPlan'));
  renderSport();
}
function renamePerso(id){ const p=CUSTOM.find(x=>x.id===id); const n=prompt(t('namePromptLabel'),p.name); if(n){p.name=n;saveAll();renderSport();} }
function dupPerso(id){ const p=CUSTOM.find(x=>x.id===id); CUSTOM.push({...JSON.parse(JSON.stringify(p)),id:'P'+Date.now(),name:p.name+' '+t('copySuffix')}); saveAll(); renderSport(); }
function delPerso(id){ customConfirm(t('confirmDeletePlan'),()=>{ CUSTOM=CUSTOM.filter(x=>x.id!==id); if(P.followPerso===id) P.followPerso=null; curPerso=null; saveAll(); renderSport(); },{danger:true}); }
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
  h+='<div id="ps_simple" class="row" style="gap:10px"><div class="field" style="flex:1"><label>'+t('distanceKmLab')+'</label><input class="inp" id="ps_km" type="number" placeholder="8"></div><div class="field" style="flex:1"><label>Allure /km</label><input class="inp" id="ps_pace" placeholder="4:30"></div></div>';
  h+='<div id="ps_intervals" style="display:none">'+
       '<div class="field"><label>Distance par répétition</label><div class="inp pkfield set" id="ps_int_dist" onclick="pickPsIntervalDist()">400 m</div></div>'+
       '<div id="ps_int_rows"></div>'+
       '<button class="btn ghost sm" style="margin:2px 0 14px" onclick="addPsIntervalRow()">＋ Ajouter une répétition</button>'+
     '</div>';
  h+='<div class="field"><label>Description (optionnel)</label><textarea class="inp" id="ps_desc" rows="3" placeholder="Détails de la séance..."></textarea></div>';
  h+='<button class="btn" onclick="savePersoSession()">Ajouter la séance</button>';
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
      '<div class="perfcard" onclick="pickPsIntervalTime('+i+')"><div class="pcl">Temps</div><div class="pcv '+(r.timeS!=null?'':'empty')+'">'+(r.timeS!=null?fmtTime(r.timeS):'Choisir')+'</div></div>'+
      (psIntervals.length>1?'<div class="perfdel" onclick="delPsIntervalRow('+i+')">'+ICN('trash',16)+'</div>':'')+
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
    if(!valid.length){ toast(t('addAtLeastOneRepTime')); return; }
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
  const psDate=$('#ps_date').value;
  const guard=sessionGuard(km,durMin,psDate);
  if(!guard.ok){ toast(guard.msg); return; }
  p.sessions.push({id:Date.now(),title,type:psType,date:psDate,km,pace,duration:durMin,rpe:5,desc:$('#ps_desc').value.trim(),done:false,intervals});
  saveAll(); closeOv('ovProg'); renderSport(); toast(t('sessionAdded'));
}
let curPersoSess=null;
function openPersoSheet(sid){
  const p=CUSTOM.find(x=>x.id===curPerso); const s=p.sessions.find(x=>x.id===sid); if(!s)return;
  curPersoSess=sid;
  $('#sheetTitle').textContent=s.title;
  const col='var('+(TYPE_COLORS[s.type]||'--e')+')';
  let h='<div class="badge" style="background:rgba(var(--e-rgb),.15);color:'+col+';margin-bottom:14px">'+escHtml(s.type)+' · '+fmtDate(s.date)+'</div>';
  if(s.km) h+='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v">'+s.km+'</div><div class="l">km</div></div><div class="sbox"><div class="v" style="font-size:18px">'+s.pace+'</div><div class="l">'+t('avgPerKmLabel')+'</div></div><div class="sbox"><div class="v">'+s.duration+'</div><div class="l">min</div></div></div>';
  if(s.intervals && s.intervals.length){
    h+='<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:8px">'+s.intervals.length+' × '+s.intervals[0].dist+' m</div><div style="display:flex;flex-direction:column;gap:6px">';
    s.intervals.forEach((r,i)=>{ h+='<div class="row" style="font-size:13px"><span style="color:var(--muted)">'+t('lapBtn')+' '+(i+1)+' · '+r.dist+' m</span><span style="font-weight:700">'+fmtTime(r.timeS)+'</span></div>'; });
    h+='</div></div>';
  }
  if(s.desc) h+='<div class="tip" style="margin-bottom:14px">'+escHtml(s.desc)+'</div>';
  // Même garde-fou anti-triche que le plan IKORUN (voir markPersoDone/markRunDone) :
  // un plan perso peut tout autant contenir des séances datées dans le futur.
  if(s.done) h+='<div class="badge" style="background:rgba(51,211,153,.18);color:var(--ok);width:100%;justify-content:center;padding:14px;border-radius:14px;margin-bottom:10px">'+t('sessionCompleted')+'</div>';
  else if(s.date>todayKey()) h+='<div class="badge" style="background:var(--s2);color:var(--muted);width:100%;justify-content:center;padding:14px;border-radius:14px;margin-bottom:10px">'+t('sessionNotYetLabel')+'</div>';
  else h+='<button class="btn" style="margin-bottom:10px" onclick="markPersoDone()">'+t('markCompleted')+'</button>';
  h+='<button class="btn ghost sm" style="color:var(--bad)" onclick="delPersoSession()">'+t('delete')+'</button>';
  $('#sheetBody').innerHTML=h; openOv('ovSheet');
}
function markPersoDone(){
  const p=CUSTOM.find(x=>x.id===curPerso); const s=p.sessions.find(x=>x.id===curPersoSess); if(!s)return;
  if(s.date>todayKey()){ toast(t('guardFutureSession')); return; }
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
// Reçoit l'id du plan et non son nom : un nom saisi par l'utilisateur (« Plan d'été »)
// cassait l'attribut onclick où il était interpolé, rendant le bouton inopérant.
function sharePlan(id){
  const p=(CUSTOM||[]).find(x=>x.id===id); const n=p?p.name:'';
  if(navigator.share) navigator.share({title:'IKORUN Plan',text:tp('myPlanColon',n)}); else toast(t('shareNotSupported'));
}

/* ---------- QUESTIONNAIRE POST-SÉANCE + ANALYSE MOTEUR IKORUN ---------- */
let debriefData=null, debriefCtx=null, debriefReps=[], debriefExpanded=false;
function openSessionDebrief(ctx){
  debriefCtx=ctx;
  debriefExpanded=false;
  debriefData={ done:true, duration:ctx.duration||'', distance:ctx.km||'', pace:ctx.pace||'', deniv:ctx.deniv||'',
    rpe:5, pain:'Aucune', paceAdherence:null, fatigue:3, weather:'sunny', feel:3, sleep:3, nutrition:3, note:'' };
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
  let h='<div class="tip" style="margin-bottom:14px">&#128203; '+t('debriefIntro')+'</div>';
  if(debriefReps.length){
    const doneCount=debriefReps.filter(r=>r.respected===true).length;
    h+='<div class="chrome-box"><div class="cb-head">\U0001f3c3 '+tp('repByRepSummary',debriefReps.length,debriefReps[0].dist)+' <span style="margin-left:auto;font-weight:600;color:var(--e2)">'+tp('respectedCount',doneCount,debriefReps.length)+'</span></div>';
    debriefReps.forEach((r,i)=>{
      const st=r.respected===true?'border-color:rgba(51,211,153,.4);background:rgba(51,211,153,.08)':r.respected===false?'border-color:rgba(255,92,108,.35);background:rgba(255,92,108,.08)':'';
      h+='<div class="row" style="align-items:center;gap:8px;border:1px solid var(--hair);border-radius:12px;padding:8px 10px;margin-bottom:6px;'+st+'">'
        +'<div style="flex:1"><div style="font-weight:700;font-size:13px">'+tp('repNumDist',r.n,r.dist)+'</div><div style="font-size:11px;color:var(--muted)">'+tp('targetColon',fmtSplit(r.target))+'</div></div>'
        +'<div style="font-weight:700;font-family:\'JetBrains Mono\';font-size:14px;min-width:44px;text-align:right">'+(r.timeS!=null?fmtSplit(r.timeS):'—')+'</div>'
        +'<button class="btn ghost sm" style="width:auto;padding:6px 10px" onclick="pickDebriefRepTime('+i+')">\u23f1</button>'
        +'<button class="btn ghost sm" style="width:auto;padding:6px 10px;color:var(--ok)" onclick="quickRespectDebriefRep('+i+')">\u2713</button>'
        +'</div>';
    });
    h+='<div style="font-size:11px;color:var(--muted);margin-top:2px">'+t('repLegendLine')+'</div></div>';
  }
  h+='<div class="row" style="gap:10px"><div class="field" style="flex:1"><label>'+t('durationMinLabel')+'</label><input class="inp" type="number" max="1440" value="'+(d.duration||'')+'" oninput="debriefData.duration=Math.min(1440,+this.value||0)"></div><div class="field" style="flex:1"><label>'+t('distanceKmLabel')+'</label><input class="inp" type="number" value="'+(d.distance||'')+'" oninput="debriefData.distance=+this.value"></div></div>';
  h+='<div class="field"><label>'+t('avgPaceKmLabel')+'</label><input class="inp" value="'+escHtml(d.pace||'')+'" oninput="debriefData.pace=this.value" placeholder="4:30"></div>';
  h+='<div class="field"><label>'+t('rpeFeltLabel')+' '+d.rpe+'/10</label><input type="range" min="1" max="10" value="'+d.rpe+'" style="width:100%" oninput="debriefData.rpe=+this.value;renderDebrief()"></div>';
  h+='<div class="field"><label>'+t('painLabel')+'</label><div class="pills">'+['Aucune','Légères','Gênantes','Importantes'].map(p=>'<div class="pill '+(d.pain===p?'on':'')+'" onclick="debriefData.pain=\''+p+'\';renderDebrief()">'+trPain(p)+'</div>').join('')+'</div></div>';
  // Séance à répétitions : le respect de l'allure est déjà saisi ligne par ligne
  // plus haut (bouton temps réel / "respecté"), donc redemander une adhérence
  // globale ferait doublon.
  if(!debriefReps.length){
    h+='<div class="field"><label>'+t('paceAdherenceLabel')+'</label><div class="pills">'+
      [['faster','⚡',t('paceFasterOpt')],['asPlanned','✅',t('paceAsPlannedOpt')],['slower','🐢',t('paceSlowerOpt')],['muchSlower','🥵',t('paceMuchSlowerOpt')]]
      .map(o=>'<div class="pill '+(d.paceAdherence===o[0]?'on':'')+'" onclick="debriefData.paceAdherence=\''+o[0]+'\';renderDebrief()">'+o[1]+' '+o[2]+'</div>').join('')
    +'</div></div>';
  }
  // Le bilan avait 10 champs affichés d'un bloc — signalé comme trop chargé. Ce qui
  // sert le plus souvent (chiffres, effort, douleur, allure) reste immédiatement
  // visible ; le reste se replie ici, toujours prérempli avec des valeurs par
  // défaut sensées donc jamais bloquant si on ne l'ouvre pas.
  h+='<div style="text-align:center;color:var(--e2);font-weight:700;font-size:12.5px;cursor:pointer;margin:14px 0" onclick="debriefExpanded=!debriefExpanded;renderDebrief()">'+(debriefExpanded?t('lessDetailsBtn'):t('moreDetailsBtn'))+'</div>';
  if(debriefExpanded){
  h+='<div class="field"><label>'+t('elevationGainLabel')+'</label><input class="inp" type="number" value="'+(d.deniv||'')+'" oninput="debriefData.deniv=+this.value" placeholder="0"></div>';
  h+=scale('fatigue',t('fatigueLabel'),['\ud83d\ude00','\ud83d\ude42','\ud83d\ude10','\ud83d\ude13','\ud83d\ude35']);
  h+=scale('feel',t('sensationsLabel'),['\ud83d\ude23','\ud83d\ude15','\ud83d\ude10','\ud83d\ude0a','\ud83e\udd29']);
  h+=scale('sleep',t('nightSleepLabel'),['\ud83d\ude34','\ud83d\ude2a','\ud83d\ude10','\ud83d\ude42','\ud83d\udca4']);
  h+=scale('nutrition',t('dayNutritionLabel'),['\ud83c\udf54','\ud83d\ude10','\ud83d\ude42','\ud83e\udd57','\ud83d\udcaa']);
  h+='<div class="field"><label>'+t('weatherLabel')+'</label><div class="pills">'+['sunny','cloudy','rain','wind','hot','cold'].map(w=>'<div class="pill '+(d.weather===w?'on':'')+'" onclick="debriefData.weather=\''+w+'\';renderDebrief()">'+ICN(w==='sunny'?'sun':w==='cloudy'?'moon':w==='rain'?'rain':w==='wind'?'wind':w==='hot'?'fire':'snow',18)+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('freeCommentLabel')+'</label><textarea class="inp" rows="2" oninput="debriefData.note=this.value" placeholder="'+t('howDidYouFeelPlaceholder')+'">'+escHtml(d.note||'')+'</textarea></div>';
  }
  h+='<button class="btn" onclick="submitDebrief()">\ud83e\udde0 '+t('analyzeSessionBtn')+'</button>';
  $('#progBody').innerHTML=h;
}
function submitDebrief(){
  // Le bouton "Analyser ma séance" ne doit JAMAIS rester silencieux en cas
  // d'erreur : on entoure tout le traitement d'un try/catch. Si quoi que ce
  // soit plante, on log l'erreur en console (debug) et on prévient l'athlète
  // par un toast au lieu de le laisser taper dans le vide sans retour.
  try{
    if(!debriefCtx){ toast(t('genericErrorRetry')); return; }
    const guard=sessionGuard(+debriefData.distance||0,+debriefData.duration||0,debriefCtx.date);
    if(!guard.ok){ toast(guard.msg); return; }
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
      deniv:+debriefData.deniv||0,
      planSessionId:debriefCtx.planSessionId||null, repsLog
    };
    const idx=debriefCtx.sessRef?SESS.findIndex(s=>s.sessRef===debriefCtx.sessRef):-1;
    if(idx>=0) SESS[idx]=real; else SESS.push(real);
    DB.save('sessions',SESS);
    refreshXP({animate:true});
    const analysis=coachAnalyze(entry);
    applyProgressiveOverload(entry);
    weeklyAdaptiveRegen();
    renderCoachAnalysis(analysis);
  }catch(err){
    console.error('submitDebrief a échoué :',err);
    toast(t('genericErrorRetry'));
  }
}
function coachAnalyze(e){
  const pos=[],errs=[],tips=[],adjust=[];
  // Points positifs
  if(e.done) pos.push(t('coach_pos_completed'));
  if(e.feel>=4) pos.push(t('coach_pos_feel'));
  if(e.sleep>=4) pos.push(t('coach_pos_sleep'));
  if(e.pain==='Aucune') pos.push(t('coach_pos_nopain'));
  if(e.nutrition>=4) pos.push(t('coach_pos_nutrition'));
  // Critiques / erreurs
  if(e.plannedRpe && e.rpe>=e.plannedRpe+2) errs.push(tp('coach_err_harderThanPlanned',e.rpe,e.plannedRpe));
  if(e.plannedRpe && e.rpe<=e.plannedRpe-2 && e.type!=='EF' && e.type!=='Récup') errs.push(tp('coach_err_tooEasy',e.rpe));
  if(e.pain==='Gênantes'||e.pain==='Importantes') errs.push(''+tp('coach_err_pain',trPain(e.pain).toLowerCase()));
  if(e.sleep<=2) errs.push(t('coach_err_sleep'));
  if(e.fatigue>=4) errs.push(t('coach_err_fatigue'));
  // Allure respectée ou non (absent sur les séances à répétitions, déjà couvertes
  // ligne par ligne par repsLog) : ça nourrit directement les points forts/à
  // travailler plutôt que de rester une donnée saisie mais jamais réutilisée.
  if(e.paceAdherence==='muchSlower') errs.push(t('coach_err_paceMuchSlower'));
  else if(e.paceAdherence==='slower' && e.rpe>=7) tips.push(t('coach_tip_paceSlower'));
  else if(e.paceAdherence==='faster'){
    if(e.rpe<=6) pos.push(t('coach_pos_paceFaster'));
    else if(e.rpe>=8) errs.push(t('coach_err_paceFasterTooHard'));
  }
  // Conseils
  if(e.sleep<=2) tips.push(t('coach_tip_sleep'));
  if(e.nutrition<=2) tips.push(t('coach_tip_nutrition'));
  tips.push(t('coach_tip_hydrate'));
  if(e.weather==='hot') tips.push(t('coach_tip_heat'));
  // Ajustements prochaines séances
  if(e.pain==='Importantes'||e.fatigue>=5){ adjust.push(t('coach_adj_rest')); }
  else if(e.rpe>=9 && e.fatigue>=4){ adjust.push(t('coach_adj_lighten48h')); }
  else if(e.feel>=4 && e.rpe<=6){ adjust.push(t('coach_adj_increaseVolume')); }
  else adjust.push(t('coach_adj_continue'));
  // Motivation
  const motivKeys=['coach_motiv1','coach_motiv2','coach_motiv3','coach_motiv4'];
  const motiv=t(motivKeys[Math.floor(Math.random()*4)]);
  return {pos,errs,tips,adjust,motiv,e};
}
function renderCoachAnalysis(a){
  let h='<div style="text-align:center;margin-bottom:14px"><div style="display:flex;justify-content:center">'+ICN('brain',40,'var(--e)')+'</div><div class="man" style="font-weight:800;font-size:20px">'+t('coachAnalysisTitle')+'</div><div style="font-size:12px;color:var(--muted)">'+a.e.title+'</div></div>';
  const blk=(icon,title,items,color)=>items.length?'<div class="card-t" style="margin-top:14px;'+(color?'color:'+color:'')+'">'+icon+' '+title+'</div>'+items.map(x=>'<div class="tip" style="margin-bottom:6px;'+(color?'border-color:'+color+'33;background:'+color+'11':'')+'">'+x+'</div>').join(''):'';
  h+=blk(ICN('check',15,'var(--ok)'),t('positivePointsTitle'),a.pos,'var(--ok)');
  h+=blk(ICN('warning',15,'var(--warn)'),t('constructiveCriticismTitle'),a.errs,'var(--warn)');
  h+=blk(ICN('bulb',15,'var(--e)'),t('adviceLabel'),a.tips,'');
  h+=blk(ICN('gear',15,'var(--e)'),t('upcomingAdjustmentsTitle'),a.adjust,'var(--e)');
  h+='<div style="background:linear-gradient(135deg,var(--ed),rgba(31,47,80,.3));border:1px solid var(--e);border-radius:14px;padding:14px;margin-top:16px;text-align:center"><div style="font-style:italic;font-size:15px">"'+a.motiv+'"</div></div>';
  h+='<button class="btn" style="margin-top:16px" onclick="closeOv(\'ovProg\');renderSport();nav(\'home\')">'+t('notedCoachBtn')+'</button>';
  $('#progBody').innerHTML=h; $('#ovProgTitle').textContent=t('ikorunAnalysisTitle');
}

/* ---------- RUN SHEET ---------- */
let curRunId=null;
// Tableau structuré des séries (reps/distance/temps de passage/récup) pour la fiche séance détaillée
function seriesTableHTML(sr){
  if(!sr) return '';
  if(sr.segments){
    const rows=sr.segments.map(sg=>'<div class="row" style="font-size:13px;padding:4px 0"><span style="color:var(--muted)">'+sg.dist+' m</span><span style="font-weight:700;color:var(--e)">'+fmtSplit(sg.splitSec)+'</span></div>').join('');
    return '<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:6px">'+ICN('run',15,'var(--e)')+t('seriesPyramidTitle')+'</div>'+rows+'<div style="font-size:11.5px;color:var(--muted);margin-top:8px">'+t('recoveryColon')+' '+sr.recoveryLabel+'</div></div>';
  }
  if(sr.reps && sr.dist){
    return '<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:8px">'+ICN('run',15,'var(--e)')+sr.reps+' × '+sr.dist+' m</div>'
      +'<div class="row" style="font-size:13px;padding:3px 0"><span style="color:var(--muted)">'+t('targetSplitLabel')+'</span><span style="font-weight:700;color:var(--e)">'+fmtSplit(splitSecFromPace(sr.paceSecPerKm,sr.dist))+'</span></div>'
      +'<div class="row" style="font-size:13px;padding:3px 0"><span style="color:var(--muted)">'+t('equivalentPaceLabel')+'</span><span>'+spkToStr(sr.paceSecPerKm)+'/km</span></div>'
      +'<div class="row" style="font-size:13px;padding:3px 0"><span style="color:var(--muted)">'+t('recoveryLabel')+'</span><span>'+sr.recoveryLabel+'</span></div>'
      +(sr.note?'<div style="font-size:11.5px;color:var(--muted);margin-top:6px">'+sr.note+'</div>':'')
      +'</div>';
  }
  if(sr.reps){
    return '<div class="card" style="padding:14px;margin-bottom:14px"><div class="card-t" style="margin-bottom:6px">'+ICN('run',15,'var(--e)')+sr.reps+' '+t('repetitionsWord')+'</div>'
      +(sr.note?'<div style="font-size:13px;color:var(--muted)">'+sr.note+'</div>':'')
      +'<div class="row" style="font-size:13px;padding:3px 0;margin-top:4px"><span style="color:var(--muted)">'+t('recoveryLabel')+'</span><span>'+sr.recoveryLabel+'</span></div></div>';
  }
  return '';
}
function rsShort(str,len){ if(!str) return ''; str=String(str).replace(/<[^>]+>/g,''); return str.length>len?str.slice(0,len).trim()+'…':str; }
function openRunSheet(id){
  const s=PLAN?PLAN.sessions.find(x=>x.id===id):null; if(!s) return;
  curRunId=id;
  $('#sheetTitle').textContent='';
  const col=baseTypeColor(s.baseType);
  const dt=liveDetail(s);
  let h='';

  // EN-TÊTE — badge type, titre, sous-titre semaine/objectif
  h+='<div class="rs-badge" style="background:'+col+'22;color:'+col+'">'+(planSessLabel(s)||'').slice(0,2).toUpperCase()+'</div>';
  h+='<div class="rs-title">'+planSessTitle(s)+'</div>';
  h+='<span class="rs-sub">'+(PLAN.weekLabel?PLAN.weekLabel:t('weekLabelWithNum')+' '+s.week)+' · '+(trRace(P.objRace)||t('objectiveWord'))+'</span>';

  // 3 STATS
  if(s.km){
    h+='<div class="rs-stats"><div class="rs-stat"><div class="v">'+s.km+'</div><div class="l">km</div></div><div class="rs-div"></div>'
      +'<div class="rs-stat"><div class="v" style="font-size:17px">'+s.pace+'</div><div class="l">'+t('avgPerKmLabel')+'</div></div><div class="rs-div"></div>'
      +'<div class="rs-stat"><div class="v">'+s.duration+'</div><div class="l">min</div></div></div>';
  }

  // CTA — une séance dans le futur ne peut pas être "terminée" : depuis la
  // page plan complet, toutes les semaines à venir sont ouvertes au même
  // titre que celle du jour. Sans cette date de garde, valider en série
  // les 44 séances d'un plan complet crédite des mois de kilomètres et
  // d'XP jamais courus (voir markRunDone, qui applique le même garde-fou
  // en dur — celui-ci n'est que l'état visuel correspondant).
  if(s.done) h+='<div class="badge" style="background:rgba(51,211,153,.18);color:var(--ok);width:100%;justify-content:center;padding:14px;border-radius:18px;margin-bottom:18px">'+t('sessionCompleted')+'</div>';
  else if(s.date>todayKey()) h+='<div class="badge" style="background:var(--s2);color:var(--muted);width:100%;justify-content:center;padding:14px;border-radius:18px;margin-bottom:18px">'+t('sessionNotYetLabel')+'</div>';
  else if(s.type!=='Repos') h+='<button class="btn" style="margin-bottom:18px" onclick="markRunDone()">'+t('markCompleted')+'</button>';

  if(dt){
    h+='<div class="rs-obj-lab">'+t('objectiveCap')+'</div><div class="rs-obj-txt">'+dt.objectif+'</div>';
    h+='<div class="card rs-list">'
      +'<div class="rs-row" onclick="this.nextElementSibling?.classList.toggle(\'open\')"><div class="rs-ic" style="background:rgba(var(--e-rgb),.16);color:var(--e2)">'+ICN('run',17)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">'+t('warmupLabel')+'</div><div class="rs-row-m">'+rsShort(dt.warmup,54)+'</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
      +'<div class="rs-row"><div class="rs-ic" style="background:rgba(242,184,75,.18);color:var(--or)">'+ICN('run',17)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">'+t('sessionBodyLabel')+'</div><div class="rs-row-m">'+rsShort(dt.body,58)+'</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
      +'<div class="rs-row"><div class="rs-ic" style="background:rgba(255,92,108,.16);color:var(--bad)">'+ICN('pin',16)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">'+t('cooldownLabel')+'</div><div class="rs-row-m">'+rsShort(dt.cooldown,54)+'</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
      +'<div class="rs-row"><div class="rs-ic" style="background:rgba(51,211,153,.16);color:var(--ok)">'+ICN('run',17)+'</div>'
        +'<div class="rs-row-body"><div class="rs-row-t">'+t('pacesLabel')+'</div><div class="rs-row-m">'+tp('zone2FCmaxLine',s.pace)+'</div></div>'+ICN('chevronR',16,'var(--dim)')+'</div>'
    +'</div>';
  }

  // ALLURE CIBLE
  if(s.km){
    const base=parseTime(s.pace)||270; const spark=[0,4,-3,2,6,3,8,5,10].map(v=>base-v*2);
    const mn=Math.min(...spark), mx=Math.max(...spark);
    h+='<div class="card rs-target"><div class="rs-target-lab">'+t('targetPaceLabel')+'</div><div class="rs-target-v">'+fmtSplit(Math.min(...spark))+' - '+fmtSplit(Math.max(...spark))+' /km</div>'
      +'<div class="rs-target-spark">'+spark.map(v=>'<b style="height:'+(mx>mn?Math.round(10+((mx-v)/(mx-mn))*90):50)+'%"></b>').join('')+'</div></div>';
  }

  // DÉTAIL COMPLET (repliable, contenu déjà existant conservé)
  if(dt){
    h+=seriesTableHTML(liveSeries(s));
    if(s.series && s.series.length) h+='<div class="pace-warn">'+t('paceWarnMsg')+'</div>';
    h+='<div class="chrome-box"><div class="cb-head">'+t('detailedPacesLabel')+'</div><div class="cb-body">'+dt.paces+'</div></div>';
    h+='<div class="chrome-box"><div class="cb-head">'+t('recoveryLabel')+'</div><div class="cb-body">'+dt.recovery+'</div></div>';
    h+='<div class="chrome-box"><div class="cb-head">'+t('adviceLabel')+'</div>'+dt.tips.map(tt=>'<div class="cb-body" style="margin-bottom:5px">• '+tt+'</div>').join('')+'</div>';
    h+='<div class="chrome-box bad"><div class="cb-head" style="color:var(--bad)">'+t('mistakesToAvoidLabel')+'</div>'+dt.mistakes.map(tt=>'<div class="cb-body" style="margin-bottom:5px">'+tt+'</div>').join('')+'</div>';
    h+='<div class="chrome-box"><div class="cb-head">'+t('whySessionLabel')+'</div><div class="cb-body">'+dt.why+'</div></div>';
  } else {
    h+=seriesTableHTML(liveSeries(s));
    h+='<div class="chrome-box"><div class="cb-head">'+t('sessionBodyLabel')+'</div><div class="cb-body">'+s.desc+'</div></div>';
  }
  $('#sheetBody').innerHTML=h;
  openOv('ovSheet');
}
function markRunDone(){
  const s=PLAN.sessions.find(x=>x.id===curRunId); if(!s) return;
  // Garde-fou anti-triche : jamais de séance future validée, quel que soit le
  // chemin d'appel (bouton masqué côté UI, mais ce garde est celui qui compte
  // vraiment — voir openRunSheet pour l'équivalent visuel).
  if(s.date>todayKey()){ toast(t('guardFutureSession')); return; }
  s.done=true;
  // Entrée provisoire (valeurs du plan) au cas où le bilan ne serait jamais validé —
  // elle sera écrasée par les vraies valeurs si l'athlète remplit le bilan.
  const sessRef=Date.now()+Math.random();
  SESS.push({sessRef,provisional:true,date:s.date,title:s.title,km:s.km,pace:s.pace,type:s.type,duration:s.duration,rpe:s.rpe});
  saveAll(); refreshXP({animate:true}); closeOv('ovSheet'); renderSport();
  openSessionDebrief({date:s.date,title:s.title,km:s.km,pace:s.pace,type:s.type,duration:s.duration,plannedRpe:s.rpe,planSessionId:s.id,sessRef,series:s.series||null});
}

/* ---------- MUSCULATION ---------- */
/* ===== MUSCULATION — LECTURE ANATOMIQUE DES PROGRAMMES =====
   Une photo de salle ne dit pas ce qu'un programme travaille. La silhouette, si :
   chaque carte porte sa propre carte du corps, muscles principaux en plein,
   secondaires en retrait. C'est la même mécanique que la carte de chaleur des
   stats (bodyPartsSVGView), appliquée au contenu d'un programme. */
function progZones(p){
  const prim=new Set(), sec=new Set();
  (p.ex||[]).forEach(e=>{
    const ms=e.muscles||((findEx(e.name)||{}).muscles)||[];
    ms.forEach((m,i)=>{ const z=MUSCLE_TO_ZONE[m]; if(!z) return; (i===0?prim:sec).add(z); });
  });
  const zones=[];
  prim.forEach(z=>zones.push({key:z,strength:'primary'}));
  sec.forEach(z=>{ if(!prim.has(z)) zones.push({key:z,strength:'secondary'}); });
  return {zones};
}
/* Regroupement grossier des zones pour l'étiquetage : « Pectoraux haut » et
   « Pectoraux bas » sont deux zones distinctes sur la silhouette, mais une seule
   étiquette sur la carte — sinon les puces répètent trois fois le même muscle. */
const ZONE_GROUP={neck:'Cou',deltoids:'Épaules',frontDeltoid:'Épaules',
  chest:'Pectoraux',upperChest:'Pectoraux',lowerChest:'Pectoraux',
  abs:'Abdominaux',obliques:'Abdominaux',biceps:'Biceps',triceps:'Triceps',forearm:'Avant-bras',
  upperBack:'Dos',trapezius:'Trapèzes',lowerBack:'Lombaires',
  quadriceps:'Quadriceps',hamstring:'Ischios',adductors:'Adducteurs',gluteal:'Fessiers',calves:'Mollets'};
// Les groupes musculaires les plus représentés dans un programme, traduits.
function progTopMuscles(p,n){
  const c={};
  (p.ex||[]).forEach(e=>{
    const m=(e.muscles||[])[0]; if(!m) return;
    const g=ZONE_GROUP[MUSCLE_TO_ZONE[m]]||m;
    c[g]=(c[g]||0)+1;
  });
  return Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,n||3).map(m=>trMuscle(m));
}
// Dernière exécution du programme dans l'historique muscu, en libellé relatif.
function progLastDone(p){
  const rows=MSESS.filter(s=>s.progName===p.name).sort((a,b)=>a.date<b.date?1:-1);
  if(!rows.length) return null;
  const d=new Date(rows[0].date+'T00:00:00'), today=new Date(todayKey()+'T00:00:00');
  const n=Math.max(0,Math.round((today-d)/86400000));
  return n===0?t('today'):tp('daysAgoShort',n);
}
// Double silhouette compacte (face + dos) pour une carte de programme.
function progBodyMini(p){
  const zi=progZones(p);
  return '<div class="mus-body">'+
    bodyPartsSVGView(zi,BODY_PARTS_FRONT,ANATOMY_VB_FRONT)+
    bodyPartsSVGView(zi,BODY_PARTS_BACK,ANATOMY_VB_BACK)+
  '</div>';
}
function muscuCardHTML(p,opts){
  opts=opts||{};
  const sets=p.ex.reduce((a,e)=>a+(e.sets||0),0);
  const dur=Math.round(progDuration(p));
  const last=progLastDone(p);
  const tags=progTopMuscles(p,3);
  return '<div class="mus-card" onclick="openProg(\''+p.id+'\')">'+
    '<div class="mus-card-b">'+
      '<div class="mus-name">'+escHtml(p.name)+'</div>'+
      (tags.length?'<div class="mus-tags">'+tags.map(m=>'<span>'+escHtml(m)+'</span>').join('')+'</div>':'')+
      '<div class="mus-meta">'+tp('exercisesCount',p.ex.length)+' · '+tp('setsCount',sets)+' · ~'+dur+' min</div>'+
      '<div class="mus-last'+(last?'':' never')+'">'+(last||t('neverDoneLab'))+'</div>'+
    '</div>'+
    progBodyMini(p)+
    (opts.del?'<button class="x mus-del" onclick="event.stopPropagation();delProg(\''+p.id+'\')">'+ICN('trash',16)+'</button>':'')+
  '</div>';
}
function renderMuscu(){
  let h='';
  if(DB.load('live_paused')){ const sv=DB.load('live_paused'); h+='<div class="card" style="border-color:var(--warn);background:rgba(255,180,84,.08)"><div class="row"><div><div style="font-weight:700">'+t('sessionPausedLab')+'</div><div style="font-size:12px;color:var(--muted)">'+escHtml(sv.prog.name)+'</div></div><button class="btn sm" style="width:auto;padding:8px 14px" onclick="resumeLive()">'+t('resumeBtn')+'</button></div></div>'; }
  h+='<div class="row" style="gap:10px;margin-bottom:16px"><button class="btn" onclick="openCreate()">＋ '+t('createBtn')+'</button><button class="btn ghost" onclick="openLibBrowse()">'+t('libraryLab')+'</button></div>';
  const custs=CUSTOM.filter(p=>p.kind==='muscu');
  if(custs.length){
    h+='<div class="hv7-sec-lab" style="margin-bottom:10px">'+t('myCreationsLab')+'</div>';
    custs.forEach(p=>{ h+=muscuCardHTML(p,{del:true}); });
  }
  h+='<div class="hv7-sec-lab" style="margin-bottom:10px">'+t('defaultProgramsLab')+'</div>';
  PROGS.forEach(p=>{ h+=muscuCardHTML(p); });
  return h;
}
function delProg(id){ customConfirm(t('confirmDeleteProgram'),()=>{ CUSTOM=CUSTOM.filter(p=>p.id!==id); saveAll(); renderSport(); },{danger:true}); }
/* ===== VUE ROUTINE (style Hevy) ===== */
/* Vignette d'exercice. Le pictogramme du groupe musculaire est TOUJOURS dessiné
   dessous : la photo (dépôt free-exercise-db, donc réseau) vient le recouvrir
   quand elle arrive, et se retire d'elle-même si elle ne charge pas. Sans ça,
   une image lente ou absente laissait un carré vide dans la liste. */
function exThumb(name,size){
  size=size||64;
  const g=exGif(name), e=findEx(name);
  const box='width:'+size+'px;height:'+size+'px;';
  if(!g) return '<div class="ex-thumb" style="'+box+'">'+exGlyph(e,Math.round(size*0.55))+'</div>';
  return '<div class="ex-thumb" style="'+box+'">'+exGlyph(e,Math.round(size*0.55))+
    '<img src="'+g[0]+'" alt="" loading="lazy" onerror="this.remove()">'+
  '</div>';
}
function progDuration(p){ return p.ex.reduce((a,e)=>a+e.sets*1.8,0); } // estimation min
function openProg(id){
  const p=allProgs().find(x=>x.id===id); if(!p) return;
  $('#ovProgTitle').textContent=t('routineTitle');
  const totalSets=p.ex.reduce((a,e)=>a+(e.sets||0),0);
  const dur=Math.round(progDuration(p));
  const lvl=p.objective||t('lvlIntermediate');
  let h='<div class="row" style="margin-bottom:6px"><div class="man" style="font-weight:800;font-size:22px;display:flex;align-items:center;gap:8px">'+(p.icon&&ICONS[p.icon]?ICN(p.icon,20,'var(--e)'):'')+p.name+'</div></div>';
  h+='<div class="row" style="gap:8px;margin-bottom:14px"><span class="badge">'+lvl+'</span><span style="font-size:12px;color:var(--muted)">'+tp('exercisesCount',p.ex.length)+'</span></div>';
  // Carte stats
  // Carte d'en-tête : séries, durée, et les silhouettes des muscles travaillés
  // dans la même barre — on sait ce que vaut la séance sans dérouler la fiche.
  h+='<div class="card prog-stats">'+
    '<div class="prog-stats-c"><div class="lab">'+t('setsCap')+'</div><div class="v">'+totalSets+'</div></div>'+
    '<div class="prog-stats-c"><div class="lab">'+t('estDurationCap')+'</div><div class="v">~'+dur+' min</div></div>'+
    '<div class="prog-stats-c">'+progBodyMini(p)+'</div>'+
  '</div>';
  // Liste d'exercices avec vignette + numéro
  p.ex.forEach((e,i)=>{
    h+='<div class="card" style="padding:13px;margin-bottom:10px;cursor:pointer" onclick="openExDetail(\''+p.id+'\','+i+')"><div class="row" style="align-items:flex-start"><div style="position:relative;margin-right:12px">'+exThumb(e.name,64)+
      '<div style="position:absolute;top:-6px;left:-6px;width:22px;height:22px;border-radius:7px;background:var(--e);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">'+(i+1)+'</div></div>'+
      '<div style="flex:1;min-width:0"><div style="font-weight:700;font-size:15px;line-height:1.25">'+e.name+'</div>'+
      '<div class="muscle-tags" style="margin-top:5px">'+(e.muscles||[]).slice(0,2).map(m=>'<span class="mtag">'+m+'</span>').join('')+'</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:6px">'+tp('setsRepsLine',e.sets,e.reps)+'</div>'+
      '<div style="font-size:11px;color:var(--dim);margin-top:3px">~'+Math.round(e.sets*1.8)+' min</div></div>'+
      '<span style="color:var(--dim);font-size:18px;align-self:center">›</span></div></div>';
  });
  h+='<button class="btn ghost" style="margin:4px 0 12px" onclick="openLibFor(addExToProg.bind(null,\''+p.id+'\'))">＋ '+t('addExercise')+'</button>';
  // Bouton "contrasté inversé" : var(--snow)/var(--bg) s'inversent avec le thème
  // (clair sur fond sombre, sombre sur fond clair). En dur (#fff/#111) il devenait
  // un bouton blanc quasi invisible sur le fond clair du mode jour.
  h+='<button class="btn" style="position:sticky;bottom:8px;background:var(--snow);color:var(--bg);border-radius:26px" onclick="startLive(\''+p.id+'\')">'+t('startWorkout')+'</button>';
  $('#progBody').innerHTML=h;
  openOv('ovProg');
}
function addExToProg(progId,e){
  const p=allProgs().find(x=>x.id===progId); if(!p)return;
  if(!p.kind){ toast(t('defaultProgramsNotEditable')); return; }
  closeOv('ovLib'); openCfg(e,(cfg)=>{ p.ex.push(cfg); saveAll(); openProg(progId); });
}
/* ===== ANATOMIE — silhouette réaliste face/dos pour l'onglet "Muscles" =====
   Tracés vectoriels du corps + de chaque groupe musculaire (mains, pieds, visage
   inclus) repris du projet open-source MIT "MuscleMap" par Melih Colpan
   (https://github.com/melihcolpan/MuscleMap) — Copyright (c) 2026 Melih Colpan,
   utilisé sous licence MIT. Chaque partie du corps est un tracé individuel :
   en mode neutre on peint tout dans la couleur de peau pour former la silhouette
   complète, et on repeint juste les zones ciblées par l'exercice en rouge/bleu. */
const BODY_PARTS_FRONT={
  chest:["M272.91 422.84c-18.95-17.19-22-57-12.64-78.79 5.57-12.99 26.54-24.37 39.97-25.87q20.36-2.26 37.02.75c9.74 1.76 16.13 15.64 18.41 25.04 3.99 16.48 3.23 31.38 1.67 48.06q-1.35 14.35-2.05 16.89c-6.52 23.5-38.08 29.23-58.28 24.53-9.12-2.12-17.24-4.38-24.1-10.61z","M416.04 435c-15.12.11-34.46-6.78-41.37-21.48q-1.88-3.99-2.84-12.18c-2.89-24.41-5.9-53.65 8.44-74.79 4.26-6.26 10.49-7.93 18.36-8.56q11.66-.92 23.32-.35c10.58.53 18.02 2.74 26.62 7.87 12.81 7.65 19.73 14.52 22.67 29.75 4.94 25.57.24 64.14-28.21 74.97q-12.26 4.67-26.99 4.77z","M416.04 435c-15.12.11-34.46-6.78-41.37-21.48q-1.88-3.99-2.84-12.18c-2.89-24.41-5.9-53.65 8.44-74.79 4.26-6.26 10.49-7.93 18.36-8.56q11.66-.92 23.32-.35c10.58.53 18.02 2.74 26.62 7.87 12.81 7.65 19.73 14.52 22.67 29.75 4.94 25.57.24 64.14-28.21 74.97q-12.26 4.67-26.99 4.77z"],
  abs:["M311.02 531.71a.23.23 0 01-.19-.21q-.39-10.47 1.9-20.76c1.26-5.69 7.66-9.9 13.1-12.9 9.09-5.01 18.93-11.15 28.56-14.92a1.24 1.21-42.6 01.94.03c3.28 1.52 4.78 3.87 4.82 7.68q.13 13.16-.15 26.31c-.08 3.85.78 8.39-.87 13.1q-.17.46-.59.72-2.65 1.65-4.29 1.82-21.06 2.22-43.23-.87z","M321 577.76c-5.17-.33-8.71-.44-10-6.26q-3.2-14.44-.59-27.83.11-.53.64-.63c7.58-1.44 13.62-2.45 22.45-4.56q11.5-2.76 23.94-1.88c3.67.26 3.3 3.46 3.4 6.21q.46 12.55-.33 26.94-.25 4.41-1.81 8.08-.21.49-.73.6-1.39.28-3.22.29-16.89.14-33.75-.96z","M347.73 429.25c7.46-3.61 10.5 6.27 10.99 11.52.48 5.06 3.46 30.61-2.78 32.93q-4.17 1.55-6.89 3.33-17.56 11.54-35.88 21.46a1.6 1.59-21.9 01-2.3-.98c-2.87-10.41-10.59-43.96 1.66-50.95 11.3-6.45 23.96-11.86 35.2-17.31z","M350.35 712.81c-29.15-9.93-37.98-100.69-39.47-126.61a.99.99 0 01.33-.8c3.58-3.26 27.61-1.47 34.62-.93 4.41.34 15.27 1.31 15.26 7.53-.05 40.77.64 82.05-1.96 122.72a1.29 1.29 0 01-1.86 1.08c-2.3-1.14-4.12-2.04-6.92-2.99z","M371.94 473.31c-5.46-2.59-2.97-24.26-2.77-29.56.25-6.8 2.41-18.63 12.64-13.8q16.26 7.67 32.34 15.72 6.18 3.1 7.13 10.05c.58 4.26 1.35 8.49 1.07 12.72q-.84 12.55-4.33 26.56-.54 2.16-1.1 3.44-.25.58-.81.31c-15.78-7.29-30.79-19.08-44.17-25.44z","M382.57 533.27c-4.17-.18-9.56-.3-13.15-2.69q-.17-.11-.24-.31c-1.82-5.55-.86-11.17-.96-15.66-.18-8.4-.78-17.36.06-25.71.29-2.85 1.88-4.42 4.15-5.79q.42-.26.91-.19 1.71.25 3.21 1.03 12.48 6.44 24.75 13.26c4.96 2.75 12.21 7.02 13.72 12.41q2.93 10.56 2.39 21.49a.77.76-1.8 01-.67.71q-16.89 2.18-34.17 1.45z","M373.75 578.69c-2.47 0-4.31.22-5-2.7-1.8-7.7-3.05-34.29-.19-38.81q.27-.43.77-.47 13.14-1.24 25.77 1.83c8.41 2.04 14.51 3.01 21.85 4.36a1.29 1.28.6 011.05 1.07q2.16 14.12-.73 28.07c-1.08 5.24-5.22 5.26-10.36 5.63q-14.26 1.04-33.16 1.02z","M416.32 584.73q1.14.41 1.07 1.62c-1.62 26.44-9.96 116.68-40.43 126.74-2.27.75-4.15 2.12-6.35 2.73q-1.18.33-1.3-.89-.86-9.2-1.06-17.75c-.83-35.67-.91-71.2-1.01-106.88q0-.5.31-.89c4.95-6.46 41.69-7.25 48.77-4.68z","M371.94 473.31c-5.46-2.59-2.97-24.26-2.77-29.56.25-6.8 2.41-18.63 12.64-13.8q16.26 7.67 32.34 15.72 6.18 3.1 7.13 10.05c.58 4.26 1.35 8.49 1.07 12.72q-.84 12.55-4.33 26.56-.54 2.16-1.1 3.44-.25.58-.81.31c-15.78-7.29-30.79-19.08-44.17-25.44z","M382.57 533.27c-4.17-.18-9.56-.3-13.15-2.69q-.17-.11-.24-.31c-1.82-5.55-.86-11.17-.96-15.66-.18-8.4-.78-17.36.06-25.71.29-2.85 1.88-4.42 4.15-5.79q.42-.26.91-.19 1.71.25 3.21 1.03 12.48 6.44 24.75 13.26c4.96 2.75 12.21 7.02 13.72 12.41q2.93 10.56 2.39 21.49a.77.76-1.8 01-.67.71q-16.89 2.18-34.17 1.45z","M373.75 578.69c-2.47 0-4.31.22-5-2.7-1.8-7.7-3.05-34.29-.19-38.81q.27-.43.77-.47 13.14-1.24 25.77 1.83c8.41 2.04 14.51 3.01 21.85 4.36a1.29 1.28.6 011.05 1.07q2.16 14.12-.73 28.07c-1.08 5.24-5.22 5.26-10.36 5.63q-14.26 1.04-33.16 1.02z","M416.32 584.73q1.14.41 1.07 1.62c-1.62 26.44-9.96 116.68-40.43 126.74-2.27.75-4.15 2.12-6.35 2.73q-1.18.33-1.3-.89-.86-9.2-1.06-17.75c-.83-35.67-.91-71.2-1.01-106.88q0-.5.31-.89c4.95-6.46 41.69-7.25 48.77-4.68z"],
  biceps:["M189.52 492.51c-2.43.62-7.38.57-7.51-3.08-.56-16.01-.42-35.49 5.11-50.26 3.19-8.54 13.89-30.22 23.27-32.72 10.08-2.68 12.68 16.59 12.6 22.8-.22 15.98-7.51 34.79-15.05 48.71-4.29 7.94-9.95 12.38-18.42 14.55z","M526.69 486.31c-9.9-8.61-17.75-33.21-20.65-47.73-1.41-7.06-1.34-29.61 8.58-32.16 10.33-2.66 23.81 25.34 26.6 32.91q2.6 7.04 3.6 16.13 1.62 14.66 1.66 32.28c.03 11.04-16.45 1.48-19.79-1.43z","M526.69 486.31c-9.9-8.61-17.75-33.21-20.65-47.73-1.41-7.06-1.34-29.61 8.58-32.16 10.33-2.66 23.81 25.34 26.6 32.91q2.6 7.04 3.6 16.13 1.62 14.66 1.66 32.28c.03 11.04-16.45 1.48-19.79-1.43z"],
  triceps:["M206.2 514.2c-5.41-.67-6.55-7.29-4.69-11.42 11.08-24.55 22.84-50.62 30.54-75.51 1.37-4.41 3.08-8.59 3.95-12.45q2.94-13.12 5.79-26.26.42-1.98 1.82-3.39a.52.52 0 01.81.1q1.04 1.69 1.94 4.56 4.63 14.65 5.15 24.92c.57 11.36-5.11 24.55-8.65 35.5q-7.69 23.78-20.25 45.39c-2.45 4.23-11.51 19.18-16.41 18.56z","M517.69 512.06c-20.07-22.12-28.95-51.73-38.01-79.03-3.27-9.87-3.58-19.18-1.34-29.38 1.29-5.88 2.49-13.03 5.61-18.52q.32-.57.72-.06 1.35 1.67 1.79 3.69c2.67 12.33 5.14 24.49 9.07 36.52 8.25 25.28 18.58 49.8 31.1 77.2q1.42 3.1 1.05 5.33c-.81 4.89-5.46 9.25-9.99 4.25z","M517.69 512.06c-20.07-22.12-28.95-51.73-38.01-79.03-3.27-9.87-3.58-19.18-1.34-29.38 1.29-5.88 2.49-13.03 5.61-18.52q.32-.57.72-.06 1.35 1.67 1.79 3.69c2.67 12.33 5.14 24.49 9.07 36.52 8.25 25.28 18.58 49.8 31.1 77.2q1.42 3.1 1.05 5.33c-.81 4.89-5.46 9.25-9.99 4.25z"],
  deltoids:["M274.06 311.69q3.94 2.77 4.33 8.14.04.48-.38.73c-9.98 5.88-24.35 7.45-28.82 19.75-2.31 6.36-.97 17.35-1.43 23.68q-.55 7.51-5.73 14.07-10.37 13.11-13.81 16.67c-3.41 3.53-6.81 1.76-10.69-.47-15.42-8.87-24.95-25.45-22.52-43.22 2.05-14.92 12.71-25.79 24.06-35.02 16.99-13.82 35.58-17.99 54.99-4.33z","M450.39 320.75q-.95-.52-.7-1.58c1.57-6.61 5.8-9.1 12.14-11.9 24.99-11.03 43.76 3.33 60.17 20.74 20.73 21.99 11.81 56.44-14.82 68.19-4.41 1.94-6.79-1.03-9.81-4.51-5.81-6.7-13.46-14.12-15.99-22.8-3.93-13.43 4.32-27.54-9.64-37.62q-8.22-5.93-17.99-9.08-1.84-.59-3.36-1.44z","M450.39 320.75q-.95-.52-.7-1.58c1.57-6.61 5.8-9.1 12.14-11.9 24.99-11.03 43.76 3.33 60.17 20.74 20.73 21.99 11.81 56.44-14.82 68.19-4.41 1.94-6.79-1.03-9.81-4.51-5.81-6.7-13.46-14.12-15.99-22.8-3.93-13.43 4.32-27.54-9.64-37.62q-8.22-5.93-17.99-9.08-1.84-.59-3.36-1.44z"],
  obliques:["M264.21 435.53c-4.88-3.13-5.75-12.11-5.39-17.36q.03-.53.51-.75 1.8-.84 3.43.85 10.05 10.45 22.57 16.9c3.64 1.89 5.54 3.62 4.79 7.8q-.42 2.35-2.82 1.87-12.45-2.49-23.09-9.31z","M287.33 452.44c-4.05 4.46-10.38 11.38-16.28 14.3a.84.83 51.1 01-.9-.1c-6.29-5.17-12.54-18.97-14.21-25.09q-.91-3.34.85-8.81.12-.39.35-.05c2.41 3.65 4.59 7.74 8.67 9.76q10.18 5.05 21.27 9.01a.61.61 0 01.25.98z","M297.3 487.82c-7.36-4.23-16.68-11.37-20.55-17.57q-.32-.5.09-.92 8.72-9.04 19.84-17.87 1.46-1.17 2.81-1.67a.44.44 0 01.59.43c-.28 10.08-.4 20.42.65 30.43q.34 3.26-.68 6.15a1.9 1.9 0 01-2.75 1.02z","M257.35 456.18l13.68 16.63a1.86 1.82 22.9 01.4.95c.59 5.4-2.02 12.71-3.8 17.56q-.3.84-.84.13-11.85-15.55-9.77-35.17.04-.45.33-.1z","M271.69 494.07a1.53 1.52-61.8 01-.49-1.64l4.2-13.58a.98.98 0 011.51-.5c3.2 2.32 21.89 14.05 22.26 16.7q1.15 8.32.66 16.79a.9.9 0 01-1.34.73q-14.24-8.05-26.8-18.5z","M299.35 544.62c-7.52-6.03-16.15-13.43-24.23-21.24-6.93-6.7-6-17.19-4.88-26.06a.44.44 0 01.72-.28q13.31 11.88 28.41 21.38.43.27.6.75c2.33 6.49.95 18.37-.07 25.23q-.09.59-.55.22z","M299.09 575.53c-7.98-3.65-27.57-15.86-28.06-26.2q-.57-11.91.46-24.3a.36.36 0 01.67-.15q.84 1.36 2.17 2.54 10.59 9.45 21.68 18.31c4.37 3.49 4.34 6.46 4.16 11.74q-.3 8.82-.42 17.64-.01.72-.66.42z","M308.17 657.58c-7.39-.13-12.41-4.13-17.14-9.39q-11.86-13.22-23.92-26.37-.33-.36-.33-.85.09-23.18 1.81-46.22.53-7.13 2.49-14.41a.71.71 0 011.2-.3q11.54 12.06 25.82 21.1 3.36 2.12 3.62 5.17 2.06 23.67 3.86 47.36c.58 7.62 2.31 13.36 4.43 20.82q.47 1.66-.96 2.79-.39.31-.88.3z","M438.7 444.36c-2.09-4.03-.13-6.83 3.63-8.81 10.22-5.36 16.79-11 24.23-18.07a1.71 1.71 0 012.89 1.12c.33 4.74-.81 14.39-5.53 17.22-4.68 2.82-18.74 10.02-24.39 9.14q-.57-.09-.83-.6z","M457.39 466.73c-3.72-1.02-13.2-10.29-16.5-14.49a.52.52 0 01.24-.81q10.94-3.75 21.31-9c3.96-2.01 6.3-5.98 8.57-9.58q.38-.59.55.09c.82 3.33 1.54 6.17.38 9.58-2.55 7.44-7.62 18.79-13.66 24.01a.96.96 0 01-.89.2z","M428.43 487.22c-1.01-1.79-.82-4.55-.71-6.72q.78-15.08.48-30.27-.01-.59.55-.4 1.72.59 3.02 1.64 11.58 9.37 18.82 16.95c3.86 4.05-16.2 17.42-19.56 19.48a1.87 1.86 59.6 01-2.6-.68z","M470.76 456.28a.25.25 0 01.44.13q2.03 19.67-9.8 35.22-.37.48-.6-.08c-1.37-3.29-5.86-16.13-3.51-18.91q6.3-7.47 13.47-16.36z","M452.27 478.5c1.13.49 4.28 12.47 4.78 14.38q.14.5-.23.88-1.29 1.35-2.65 2.41-10.44 8.12-21.76 14.97-1.49.9-2.91 1.33a.81.81 0 01-1.05-.71q-.73-8.62.67-17.15.08-.47.44-.8c1.74-1.6 21.96-15.73 22.34-15.51a.58.03 31 00.37.2z","M428.22 519.14q.11-.36.43-.56 15.3-9.66 28.83-21.69a.43.42-22.6 01.71.29c.51 8.26 2.25 18.67-4.46 25.4q-11.8 11.84-25.03 22.09-.43.34-.49-.2c-.75-6.82-1.97-18.92.01-25.33z","M456.54 524.55a.04.04 0 01.07.02q1.52 13.67.41 27.4-.04.47-.28.88c-4.97 8.3-18.23 19.62-27.88 22.63q-.57.17-.58-.43-.05-10.31-.27-20.53-.1-4.8 2.63-7.09c8.54-7.13 18.56-14.62 25.9-22.88z","M418.89 657.11q-1.12-1.67-.43-3.63 3.27-9.38 4.04-18.23 1.97-22.81 3.58-45.65c.16-2.32.72-6.41 2.84-7.71q14.97-9.23 27.16-21.93.41-.42.71.08 1.29 2.15 1.53 4.2 3.23 27.74 3.13 56.8a1.3 1.28-24.5 01-.33.86q-12.74 13.93-25.55 27.75c-4.8 5.17-9.09 7.87-15.73 7.96q-.61.01-.95-.5z","M438.7 444.36c-2.09-4.03-.13-6.83 3.63-8.81 10.22-5.36 16.79-11 24.23-18.07a1.71 1.71 0 012.89 1.12c.33 4.74-.81 14.39-5.53 17.22-4.68 2.82-18.74 10.02-24.39 9.14q-.57-.09-.83-.6z","M457.39 466.73c-3.72-1.02-13.2-10.29-16.5-14.49a.52.52 0 01.24-.81q10.94-3.75 21.31-9c3.96-2.01 6.3-5.98 8.57-9.58q.38-.59.55.09c.82 3.33 1.54 6.17.38 9.58-2.55 7.44-7.62 18.79-13.66 24.01a.96.96 0 01-.89.2z","M428.43 487.22c-1.01-1.79-.82-4.55-.71-6.72q.78-15.08.48-30.27-.01-.59.55-.4 1.72.59 3.02 1.64 11.58 9.37 18.82 16.95c3.86 4.05-16.2 17.42-19.56 19.48a1.87 1.86 59.6 01-2.6-.68z","M470.76 456.28a.25.25 0 01.44.13q2.03 19.67-9.8 35.22-.37.48-.6-.08c-1.37-3.29-5.86-16.13-3.51-18.91q6.3-7.47 13.47-16.36z","M452.27 478.5c1.13.49 4.28 12.47 4.78 14.38q.14.5-.23.88-1.29 1.35-2.65 2.41-10.44 8.12-21.76 14.97-1.49.9-2.91 1.33a.81.81 0 01-1.05-.71q-.73-8.62.67-17.15.08-.47.44-.8c1.74-1.6 21.96-15.73 22.34-15.51a.58.03 31 00.37.2z","M428.22 519.14q.11-.36.43-.56 15.3-9.66 28.83-21.69a.43.42-22.6 01.71.29c.51 8.26 2.25 18.67-4.46 25.4q-11.8 11.84-25.03 22.09-.43.34-.49-.2c-.75-6.82-1.97-18.92.01-25.33z","M456.54 524.55a.04.04 0 01.07.02q1.52 13.67.41 27.4-.04.47-.28.88c-4.97 8.3-18.23 19.62-27.88 22.63q-.57.17-.58-.43-.05-10.31-.27-20.53-.1-4.8 2.63-7.09c8.54-7.13 18.56-14.62 25.9-22.88z","M418.89 657.11q-1.12-1.67-.43-3.63 3.27-9.38 4.04-18.23 1.97-22.81 3.58-45.65c.16-2.32.72-6.41 2.84-7.71q14.97-9.23 27.16-21.93.41-.42.71.08 1.29 2.15 1.53 4.2 3.23 27.74 3.13 56.8a1.3 1.28-24.5 01-.33.86q-12.74 13.93-25.55 27.75c-4.8 5.17-9.09 7.87-15.73 7.96q-.61.01-.95-.5z"],
  quadriceps:["M292.42 935.6q-.95-.52-1.57-1.4-4.1-5.79-7-13.53-7.8-20.79-13.3-42.33c-9.06-35.53-19.33-71.36-25.03-107.59-5.33-33.86 4-74.19 20.7-103.37q.35-.62.53.07c14.44 55.57 39.03 107.94 41.45 165.34 1.11 26.34.66 52.96-3.6 79.03-.63 3.83-4.73 27.81-12.18 23.78z","M275.11 942.93q-2.42-2.18-3.57-5.24c-3.98-10.61-7.68-21.02-12.81-31.32-7.85-15.76-10.77-34.56-13.2-51.46-2.11-14.63-2.31-31.47-3.93-47.18-.22-2.16-1.04-12.78.46-13.79q1.36-.92 2.08.55c1.5 3.08 3.12 6.12 3.66 9.58q8.21 52.38 26.36 102.15c2.87 7.87 9.98 30.5 1.85 36.74a.71.7-42.5 01-.9-.03z","M322.69 945.72c-3.73 6.14-10.77-2.43-12.6-5.6-3.16-5.47-2.62-14.93-1.78-20.81 4.03-28.09 5.6-52.81 3.48-80.78q-.06-.79.28-.08 15.77 32.83 14.26 68.9c-.4 9.54-2.94 22.48-2.91 34.13q.01 3.02-.73 4.24z","M437.82 933.52c-8.9 14.18-15.15-26.74-15.46-29.25q-5.26-43.04-1.19-86.08c4.9-51.8 26.91-99.32 40.38-150.92q.18-.66.5-.06c17.25 31.67 25.39 68.28 20.54 104.36q-2.29 17.02-8.71 42.76-7.56 30.25-15.2 60.47-6.13 24.25-15.06 47.61-1.83 4.79-5.8 11.11z","M451.79 942.6c-9.95-10.01 4.97-42.91 8.94-55.41q12.55-39.53 19.27-80.47c.49-2.97 2.64-12.34 5.41-13.28a.83.83 0 011.09.64q.74 4 .45 7.92c-1.99 26.52-3.37 58.99-11.01 87.73q-2.53 9.5-7.46 18.8c-4.38 8.24-6.97 16.72-10.08 25.27q-1.66 4.54-4.55 8.63a1.35 1.35 0 01-2.06.17z","M406.69 946.81c-3.24-2.77-1.48-10.64-2.01-14.71q-2.23-17.18-2.57-22.16c-1.75-25.07 3.61-49.11 13.98-71.92q.23-.51.2.05c-1.2 19.15-1.28 38.18.83 57.38q1.68 15.4 3.39 30.8c.43 3.92-.31 9.71-2.09 13.33-1.62 3.28-7.58 10.77-11.73 7.23z","M437.82 933.52c-8.9 14.18-15.15-26.74-15.46-29.25q-5.26-43.04-1.19-86.08c4.9-51.8 26.91-99.32 40.38-150.92q.18-.66.5-.06c17.25 31.67 25.39 68.28 20.54 104.36q-2.29 17.02-8.71 42.76-7.56 30.25-15.2 60.47-6.13 24.25-15.06 47.61-1.83 4.79-5.8 11.11z","M451.79 942.6c-9.95-10.01 4.97-42.91 8.94-55.41q12.55-39.53 19.27-80.47c.49-2.97 2.64-12.34 5.41-13.28a.83.83 0 011.09.64q.74 4 .45 7.92c-1.99 26.52-3.37 58.99-11.01 87.73q-2.53 9.5-7.46 18.8c-4.38 8.24-6.97 16.72-10.08 25.27q-1.66 4.54-4.55 8.63a1.35 1.35 0 01-2.06.17z","M406.69 946.81c-3.24-2.77-1.48-10.64-2.01-14.71q-2.23-17.18-2.57-22.16c-1.75-25.07 3.61-49.11 13.98-71.92q.23-.51.2.05c-1.2 19.15-1.28 38.18.83 57.38q1.68 15.4 3.39 30.8c.43 3.92-.31 9.71-2.09 13.33-1.62 3.28-7.58 10.77-11.73 7.23z"],
  calves:["M252.09 1032.57c.24-3.71 2.14-22.17 4.63-24.18a1.03 1.02-17.9 011.67.85c-.45 7.89-1.27 16-1.49 23.45q-.57 18.93-.66 37.88-.02 3.63.34 6.85c2.08 18.76 5.56 37.32 9.3 55.8 3.82 18.84 9.13 37.64 13.11 56.63q2.44 11.68 2.08 17.95c-.32 5.7-3.08 20.49-8.51 23.92a.62.62 0 01-.84-.16q-1.2-1.65-.95-3.55c.92-7.26 1.45-14.15-.3-21.52q-8.25-34.74-13.62-59.06c-1.86-8.44-3.17-17.18-3.93-26.3q-3.69-44.24-.83-88.56z","M315.01 1025.17a.16.16 0 01.32.02c4.06 25.75 8.98 52.72 8.71 77.81q-.13 12.06-5.74 26.31c-7.2 18.3-8.93 38.57-15.95 56.93q-.18.48-.21-.03c-1.87-34.47-5.67-65.91-8.56-103.28q-.97-12.49 4.44-23.14 7.47-14.69 15.14-29.29c.81-1.55 1.35-3.62 1.85-5.33z","M455.5 1231.67c-7.13-5.81-9.23-24.34-8.2-31.86 1.41-10.32 4.63-23.14 7.98-36.33q9.54-37.46 15.15-75.74c2.86-19.5 1.53-40.15.75-59.8-.22-5.67-.98-12.51-1.23-18.75a.97.97 0 011.87-.4c.35.86.92 1.76 1.12 2.68q2.96 14.31 3.31 20.53 2.37 43.28-.49 84.75-1.21 17.42-5.43 35.77-6.33 27.51-12.84 54.98-2.01 8.49-.11 18.36c.36 1.9.11 3.95-.68 5.55a.79.79 0 01-1.2.26z","M412.77 1025.44a.14.14 0 01.27-.04c4.88 11.62 10.93 22.01 17.28 34.78 4.07 8.19 4.71 14.41 4.1 24.25-2.13 34.3-6.27 68.85-8.45 101.59q-.05.69-.31.05-1.48-3.67-2.28-6.75c-4.34-16.75-8.78-38.38-16.39-57.57q-1.4-3.55-2.2-10.11c-1.78-14.73-.2-31.24 2.04-45.88q3.06-20.02 5.94-40.32z","M455.5 1231.67c-7.13-5.81-9.23-24.34-8.2-31.86 1.41-10.32 4.63-23.14 7.98-36.33q9.54-37.46 15.15-75.74c2.86-19.5 1.53-40.15.75-59.8-.22-5.67-.98-12.51-1.23-18.75a.97.97 0 011.87-.4c.35.86.92 1.76 1.12 2.68q2.96 14.31 3.31 20.53 2.37 43.28-.49 84.75-1.21 17.42-5.43 35.77-6.33 27.51-12.84 54.98-2.01 8.49-.11 18.36c.36 1.9.11 3.95-.68 5.55a.79.79 0 01-1.2.26z","M412.77 1025.44a.14.14 0 01.27-.04c4.88 11.62 10.93 22.01 17.28 34.78 4.07 8.19 4.71 14.41 4.1 24.25-2.13 34.3-6.27 68.85-8.45 101.59q-.05.69-.31.05-1.48-3.67-2.28-6.75c-4.34-16.75-8.78-38.38-16.39-57.57q-1.4-3.55-2.2-10.11c-1.78-14.73-.2-31.24 2.04-45.88q3.06-20.02 5.94-40.32z"],
  adductors:["M280.26 647.4c11.65 10.74 22.18 21.04 31.02 34.3 15.82 23.72 27.55 49.72 34.01 77.58 1.34 5.79-6.14 20.34-12.62 20.22q-.52-.01-.72-.49-.67-1.59-1.21-3.13c-14.68-41.71-27.96-79.71-46.87-117.01-1.9-3.74-3.05-7.33-4.06-11.2a.27.27 0 01.45-.27z","M331.64 898.32q-.17.57-.23-.02c-2.23-25.01-8.47-50.09-14.25-74.53q-19.4-82.1-42.46-163.69-.58-2.08.33-.13c19.88 42.53 38.94 86.51 51.64 132.07 9.49 34.06 15.59 71.67 4.97 106.3z","M334.46 789.17c1.56-2.63 14.39-20.38 16.2-20.37a1.71 1.7-89.2 011.7 1.76q-1.12 34.88-7.4 68.95c-.38 2.06-1.41 4.27-2.16 6.23q-.24.62-.34-.04-3.68-25.45-8.44-50.7c-.34-1.79-.63-4 .44-5.83z","M395.47 779.4c-5.7 1.33-11.34-11.87-12.46-15.86q-.61-2.18-.02-4.65 10.17-42.64 35.06-78.81c9.47-13.77 18.83-22.36 29.85-32.56q.55-.5.4.22-1.12 5.7-3.73 10.83c-19.44 38.38-33.3 79.2-47.77 119.65a1.84 1.83-86.4 01-1.33 1.18z","M453.65 658.99q.67-1.43.23.09-26.73 93.75-48.63 189.74c-1.98 8.7-3.66 17.9-5.44 26.84q-2.19 11.05-2.78 22.43a.15.15 0 01-.3.04c-8.18-24.48-6.74-51.98-1.87-76.86 11.07-56.49 34.44-110.42 58.79-162.28z","M377.91 768.67c1.49.84 1.76 1.49 2.66 2.66q6.16 8.04 12.23 16.13c1.88 2.52 1.97 4.18 1.38 7.45q-4.57 25.23-8.43 50.57-.11.71-.4.05-1.89-4.29-2.54-8.09-5.57-32.28-6.98-65.01-.09-2 .81-3.44a.95.94 30.8 011.27-.32z","M395.47 779.4c-5.7 1.33-11.34-11.87-12.46-15.86q-.61-2.18-.02-4.65 10.17-42.64 35.06-78.81c9.47-13.77 18.83-22.36 29.85-32.56q.55-.5.4.22-1.12 5.7-3.73 10.83c-19.44 38.38-33.3 79.2-47.77 119.65a1.84 1.83-86.4 01-1.33 1.18z","M453.65 658.99q.67-1.43.23.09-26.73 93.75-48.63 189.74c-1.98 8.7-3.66 17.9-5.44 26.84q-2.19 11.05-2.78 22.43a.15.15 0 01-.3.04c-8.18-24.48-6.74-51.98-1.87-76.86 11.07-56.49 34.44-110.42 58.79-162.28z","M377.91 768.67c1.49.84 1.76 1.49 2.66 2.66q6.16 8.04 12.23 16.13c1.88 2.52 1.97 4.18 1.38 7.45q-4.57 25.23-8.43 50.57-.11.71-.4.05-1.89-4.29-2.54-8.09-5.57-32.28-6.98-65.01-.09-2 .81-3.44a.95.94 30.8 011.27-.32z"],
  trapezius:["M285.01 307.01a.89.89 0 01-.11-1.64q19.44-9.61 35.65-24.8 1.68-1.57 3.31-.31.4.32.45.82 1.25 12.61-1.57 25.41c-.74 3.32-2.55 4.23-5.9 4.48q-16.02 1.24-31.83-3.96z","M414 311.19c-5.24-.12-7.81-.64-8.9-6.27q-2.33-12.09-1.17-23.94.06-.61.61-.89 1.66-.85 3.65.99 16.12 14.87 33.97 23.63 3.65 1.79-.27 2.89-13.88 3.91-27.89 3.59z","M414 311.19c-5.24-.12-7.81-.64-8.9-6.27q-2.33-12.09-1.17-23.94.06-.61.61-.89 1.66-.85 3.65.99 16.12 14.87 33.97 23.63 3.65 1.79-.27 2.89-13.88 3.91-27.89 3.59z"],
  neck:["M362.65 290.52q-1.14-1.37-1.86-3.41-5.33-15.15-12.14-29.75c-2.37-5.06-1.07-9.07-7.92-10.99q-1.01-.28.02-.47c5.98-1.08 15.25.91 21.33 2q2.37.42 4.81-.09 10.09-2.13 20.45-2.12a.37.37 0 01.08.73c-6.34 1.46-5.45 5.64-7.57 10.21q-6.1 13.1-11 26.69-1.3 3.62-2.9 6.81a1.99 1.99 0 01-3.3.39z","M354.01 315.07q-3.49-3.65-5.9-8.23c-6.46-12.3-11.03-25.42-16.12-38.77-2.92-7.66-1.98-19.44-1.61-27.6q.03-.58.47-.21c9.06 7.39 11.33 17.46 15.67 27.62 5.4 12.61 15.4 33.31 9.11 46.92a1 .99 35.5 01-1.62.27z","M345.77 316c-4.12-1.96-12.78-6.76-15.07-11.38-4.29-8.65-2.69-16.02-2.28-25.25a1 1 0 011.95-.28c4.29 12.42 10.5 24.4 15.71 36.61q.23.55-.31.3z","M372.75 314.71c-5.78-9.67 1.71-31.17 6.17-40.68 5.95-12.68 8.21-24.68 18.35-33.9a.49.49 0 01.82.35c.28 8.68.84 19.39-1.97 27.72-5.26 15.58-11.39 33.46-21.42 46.62a1.18 1.18 0 01-1.95-.11z","M398.01 278.49a.5.49 35.5 01.87-.14c2.01 2.7 1.62 11.6 1.61 15.13-.04 12.42-8.2 17.45-17.9 22.58a.35.35 0 01-.48-.46c5.51-12.02 11.85-24.46 15.9-37.11z","M354.01 315.07q-3.49-3.65-5.9-8.23c-6.46-12.3-11.03-25.42-16.12-38.77-2.92-7.66-1.98-19.44-1.61-27.6q.03-.58.47-.21c9.06 7.39 11.33 17.46 15.67 27.62 5.4 12.61 15.4 33.31 9.11 46.92a1 .99 35.5 01-1.62.27z","M345.77 316c-4.12-1.96-12.78-6.76-15.07-11.38-4.29-8.65-2.69-16.02-2.28-25.25a1 1 0 011.95-.28c4.29 12.42 10.5 24.4 15.71 36.61q.23.55-.31.3z","M372.75 314.71c-5.78-9.67 1.71-31.17 6.17-40.68 5.95-12.68 8.21-24.68 18.35-33.9a.49.49 0 01.82.35c.28 8.68.84 19.39-1.97 27.72-5.26 15.58-11.39 33.46-21.42 46.62a1.18 1.18 0 01-1.95-.11z","M398.01 278.49a.5.49 35.5 01.87-.14c2.01 2.7 1.62 11.6 1.61 15.13-.04 12.42-8.2 17.45-17.9 22.58a.35.35 0 01-.48-.46c5.51-12.02 11.85-24.46 15.9-37.11z","M372.75 314.71c-5.78-9.67 1.71-31.17 6.17-40.68 5.95-12.68 8.21-24.68 18.35-33.9a.49.49 0 01.82.35c.28 8.68.84 19.39-1.97 27.72-5.26 15.58-11.39 33.46-21.42 46.62a1.18 1.18 0 01-1.95-.11z","M398.01 278.49a.5.49 35.5 01.87-.14c2.01 2.7 1.62 11.6 1.61 15.13-.04 12.42-8.2 17.45-17.9 22.58a.35.35 0 01-.48-.46c5.51-12.02 11.85-24.46 15.9-37.11z"],
  forearm:["M127.23 683.05c-4.07-2.12 1.27-27.07 2.25-31.57 4.98-23.03 9.17-46.17 13.91-69.25q1.53-7.47 2.13-15.13c.93-12.09.81-22.15 6.23-31.59 7.1-12.33 13.54-29.16 26.1-36.73a1.98 1.97 62.7 012.84.91c1.92 4.48 1.93 8.28 2.06 14.15.44 19.77-1.3 41.04-8.72 59.67-11 27.62-22.22 55.21-32.62 82.91-4.04 10.76-7.56 20.66-12.82 26.39q-.59.65-1.36.24z","M201.5 527.4a.84.84 0 01.67.65c3.98 17.15-2.93 39.36-10.95 54.41-4.6 8.63-13.06 20.43-18.21 31.33q-13.21 27.92-24.58 56.64-2.51 6.35-6.61 11.02a1.43 1.43 0 01-2.5-.81q-.36-3.78.84-7.17 10.31-29.18 21.57-57.99c6.32-16.18 14.55-31.65 20.66-47.87 3.69-9.82 5.36-22.36 7.32-30.62 1.49-6.27 4.19-11.06 11.79-9.59z","M207.33 540.4a.6.59-63.1 011.03-.34l5.38 6.02q.4.45.33 1.06-.52 4.1-1.29 5.84-6.91 15.65-13.69 31.35c-5.41 12.53-16.33 28.4-23.51 44.89-8.3 19.08-16.03 39.32-26.75 57.16a.36.36 0 01-.62 0l-.19-.32q-.17-.28-.06-.59 10.08-29.91 23.05-58.65 2.9-6.42 5.47-11.21c4.62-8.59 10.86-16.17 14.62-23.02q13.23-24.13 16.23-52.19z","M600.08 683.04c-5-4.14-8.97-15.46-11.29-21.56-5.82-15.25-11.38-30.55-17.58-45.7q-9.15-22.39-18.02-44.89c-5.58-14.19-7.32-31.42-7.99-46.57-.29-6.44-.68-19.43 2.67-25.02a1.71 1.71 0 012.25-.63c6.72 3.52 11.29 9.96 14.87 16.5q6.25 11.38 12.68 22.66c1.97 3.45 2.93 7.66 3.41 12.06 1.16 10.6 1.55 21.29 3.66 31.65 3.93 19.29 7.38 38.63 11.47 57.92 1.5 7.07 9.3 39.08 5.12 43.5a.91.91 0 01-1.25.08z","M586.58 681.46q-4.35-4.47-6.75-10.61-11.35-28.91-24.59-57.01c-5.72-12.13-14.32-22.86-19.97-35.1-7.1-15.36-12.9-33.32-9.27-50.31a1.44 1.43-87.1 011.23-1.12c7.47-.88 9.29 2.88 11.02 9.2 3.39 12.42 4.76 25.91 9.75 36.7 15.55 33.65 27.61 64.94 39.31 98.42 1.13 3.24 2.05 5.47 1.62 9.04a1.38 1.37 26.3 01-2.35.79z","M579.58 686.43q-3.92-5.77-6.87-12.13-8.05-17.34-19.75-44.5-2.68-6.24-6.46-13.62c-5.14-10.05-13.15-22.36-17.34-31.85q-9.55-21.68-13.66-31.36-1.09-2.58-1.33-5.87-.04-.61.37-1.07l5.24-5.85a.69.69 0 011.2.4q2.74 27.05 15.49 50.75 1.7 3.17 8.26 12.86 7.02 10.39 12.18 21.88 8.71 19.41 20.19 50.1 2.22 5.92 3.13 9.98a.36.36 0 01-.65.28z","M600.08 683.04c-5-4.14-8.97-15.46-11.29-21.56-5.82-15.25-11.38-30.55-17.58-45.7q-9.15-22.39-18.02-44.89c-5.58-14.19-7.32-31.42-7.99-46.57-.29-6.44-.68-19.43 2.67-25.02a1.71 1.71 0 012.25-.63c6.72 3.52 11.29 9.96 14.87 16.5q6.25 11.38 12.68 22.66c1.97 3.45 2.93 7.66 3.41 12.06 1.16 10.6 1.55 21.29 3.66 31.65 3.93 19.29 7.38 38.63 11.47 57.92 1.5 7.07 9.3 39.08 5.12 43.5a.91.91 0 01-1.25.08z","M586.58 681.46q-4.35-4.47-6.75-10.61-11.35-28.91-24.59-57.01c-5.72-12.13-14.32-22.86-19.97-35.1-7.1-15.36-12.9-33.32-9.27-50.31a1.44 1.43-87.1 011.23-1.12c7.47-.88 9.29 2.88 11.02 9.2 3.39 12.42 4.76 25.91 9.75 36.7 15.55 33.65 27.61 64.94 39.31 98.42 1.13 3.24 2.05 5.47 1.62 9.04a1.38 1.37 26.3 01-2.35.79z","M579.58 686.43q-3.92-5.77-6.87-12.13-8.05-17.34-19.75-44.5-2.68-6.24-6.46-13.62c-5.14-10.05-13.15-22.36-17.34-31.85q-9.55-21.68-13.66-31.36-1.09-2.58-1.33-5.87-.04-.61.37-1.07l5.24-5.85a.69.69 0 011.2.4q2.74 27.05 15.49 50.75 1.7 3.17 8.26 12.86 7.02 10.39 12.18 21.88 8.71 19.41 20.19 50.1 2.22 5.92 3.13 9.98a.36.36 0 01-.65.28z"],
  hands:["M100.98 745.85c-9.03-6.62-15.78-13.18-13.3-24.59 2.67-12.29 15.01-20.6 25.37-26.21 7.76-4.21 18.22-1.68 26.15.97 7.14 2.39 11.11 6.16 11.1 13.86q-.04 18.51-4.75 36.37c-5.47 20.76-34.48 6.99-44.57-.4z","M53.81 746.32a.91.91 0 01-.74-.95c.14-2.49-.23-6.34 2.25-7.8 4.66-2.71 11.37-5.53 14.15-10.3q6.32-10.86 16.56-20.3 1.27-1.17.64.44c-1.45 3.73-2.86 7.21-3.87 11.59-2.76 11.9-14.62 30-28.99 27.32z","M87.21 745.05c1.44.46 8.14 2.66 8.61 4.55 1.26 5.12-4.42 8.54-7 12.25-7.73 11.1-15.12 23.38-24.25 33.28a1.22 1.22 0 01-2.11-.86c.11-3.93.38-7.1 2.43-10.65q10.27-17.71 19.31-36.11.32-.65 2.13-2.27.38-.35.88-.19z","M108.11 758.12a2.16 2.16 0 011.07 2.87q-10.49 22.55-19.92 45.81c-1.45 3.56-4.37 5.15-7.82 6.04a1.35 1.34-8.1 01-1.69-1.26c-.11-3.05.37-5.87 1.58-8.9q8.1-20.28 15.15-40.96c.41-1.2.62-3.33 1.69-4.85a1.21 1.21 0 01.91-.49q4.72-.21 9.03 1.74z","M134.09 799.9q-1.16-1.7-1.41-3.73-2.1-17.07-1.18-34.29.03-.6.61-.75l6.93-1.85q.68-.19.65.52-.51 10.9-.85 21.71c-.28 8.58.1 12.65-4.17 18.4a.36.36 0 01-.58-.01z","M108.13 814.65a1.48 1.48 0 01-1.62-1.47c-.02-2.83-.14-5.66.32-8.53q2.9-17.79 5.4-35.65.53-3.84 1.58-7.56a.66.66 0 01.76-.48l7.26 1.24a.97.97 0 01.78 1.14q-4.76 23.96-9.1 46.26-.9 4.64-5.38 5.05z","M591.31 755.99c-8.06-2.93-8.66-9.76-10.28-17.06q-3.22-14.42-3.1-29.3.04-4.06 1.46-6.55c4.34-7.57 18.16-9.91 25.63-10.35 8.75-.51 18.37 6.96 24.99 12.27q8.92 7.17 10.74 17.52c2.45 13.89-12.11 23.41-22.7 29.04-6.95 3.69-18.63 7.39-26.74 4.43z","M641.97 706.78q10.85 9.65 17.61 21.91c1.63 2.97 9.74 6.76 12.87 8.59 2.9 1.7 3.03 4.81 2.55 8.5q-.06.42-.48.49c-8.16 1.32-11.99-1.93-17.72-7.23-10.35-9.58-10.5-20.33-15.33-31.9q-.54-1.29.5-.36z","M638 760.07c-2.54-3.42-7.52-6.03-5.44-11.11q.18-.44.61-.63l7.41-3.3q1.29-.58 2.05.62 3.33 5.23 5.69 10.04 6.84 13.94 14.71 27.33c1.35 2.29 4.28 10.16 2.25 12.11a1.22 1.22 0 01-1.77-.08c-9.43-10.98-16.85-23.36-25.51-34.98z","M647.83 812.68c-4 .24-7.71-2.87-9.11-6.38q-9.28-23.27-19.74-45.33a2.05 2.05 0 01.92-2.71q4.5-2.28 9.62-1.7a1.09 1.07 83.8 01.89.73q7.5 23.06 16.57 45.5 1.8 4.46 1.5 9.24a.7.7 0 01-.65.65z","M596.17 761.18a.84.84 0 01.62.81c-.01 4.86.95 35.3-2.71 37.67q-.49.32-.82-.17-3.41-5.21-3.51-8.49-.45-15.62-1.16-31.23-.03-.72.66-.52l6.92 1.93z","M621.09 814.28c-4.35 1.91-5.92-3.77-6.5-6.56q-4.52-21.91-8.88-43.95a1.41 1.41 0 011.14-1.66l6.8-1.18a.92.92 0 011.06.76q2.79 16.32 5.09 32.91c.85 6.17 2.2 12.25 1.8 18.95q-.03.52-.51.73z","M591.31 755.99c-8.06-2.93-8.66-9.76-10.28-17.06q-3.22-14.42-3.1-29.3.04-4.06 1.46-6.55c4.34-7.57 18.16-9.91 25.63-10.35 8.75-.51 18.37 6.96 24.99 12.27q8.92 7.17 10.74 17.52c2.45 13.89-12.11 23.41-22.7 29.04-6.95 3.69-18.63 7.39-26.74 4.43z","M641.97 706.78q10.85 9.65 17.61 21.91c1.63 2.97 9.74 6.76 12.87 8.59 2.9 1.7 3.03 4.81 2.55 8.5q-.06.42-.48.49c-8.16 1.32-11.99-1.93-17.72-7.23-10.35-9.58-10.5-20.33-15.33-31.9q-.54-1.29.5-.36z","M638 760.07c-2.54-3.42-7.52-6.03-5.44-11.11q.18-.44.61-.63l7.41-3.3q1.29-.58 2.05.62 3.33 5.23 5.69 10.04 6.84 13.94 14.71 27.33c1.35 2.29 4.28 10.16 2.25 12.11a1.22 1.22 0 01-1.77-.08c-9.43-10.98-16.85-23.36-25.51-34.98z","M647.83 812.68c-4 .24-7.71-2.87-9.11-6.38q-9.28-23.27-19.74-45.33a2.05 2.05 0 01.92-2.71q4.5-2.28 9.62-1.7a1.09 1.07 83.8 01.89.73q7.5 23.06 16.57 45.5 1.8 4.46 1.5 9.24a.7.7 0 01-.65.65z","M596.17 761.18a.84.84 0 01.62.81c-.01 4.86.95 35.3-2.71 37.67q-.49.32-.82-.17-3.41-5.21-3.51-8.49-.45-15.62-1.16-31.23-.03-.72.66-.52l6.92 1.93z","M621.09 814.28c-4.35 1.91-5.92-3.77-6.5-6.56q-4.52-21.91-8.88-43.95a1.41 1.41 0 011.14-1.66l6.8-1.18a.92.92 0 011.06.76q2.79 16.32 5.09 32.91c.85 6.17 2.2 12.25 1.8 18.95q-.03.52-.51.73z"],
  knees:["M297.69 1008.37c-7.27 7.29-16.34 3.42-19.64-5.18q-6.18-16.11-9.57-30.68c-1.99-8.6-2.24-19.68 9.72-19.91q13.12-.24 26.05 2.15 1.71.32 3.29 1.02a1.17 1.15 4.2 01.63.72c3.17 10.27 2.5 23.36.05 33.69q-2.37 10.01-10.53 18.19z","M288.03 1059.54c-6.99-5.81 13.75-46.43 17.3-53.91q7.3-15.38 10.9-32.01c.74-3.42 2-6.31 4.18-8.64a1.36 1.35 54.7 012.23.39c3.97 9.09 1.66 13.86-1.67 24.65q-10.23 33.19-27.2 63.57-1.8 3.23-4.2 5.84a1.13 1.12-49 01-1.54.11z","M430.44 1008.31c-12.92-12.62-14.34-33.49-10.92-50.31.31-1.53 1.09-2.53 2.73-2.86q11.44-2.25 23.08-2.59c14.13-.42 17.31 5.67 14.54 18.63q-3.13 14.69-9.12 30.37c-3.45 9.03-11.63 15.25-20.31 6.76z","M438.96 1059.52q-2.25-1.89-3.8-4.64-20.15-35.92-31.06-75.66-2.11-7.68 1.95-14.16a1.16 1.16 0 011.91-.08c2.26 3.06 3.4 5.4 4.26 9.37 3.98 18.54 10.94 32.53 20.07 51.09 3.51 7.14 11.38 26.16 8.5 33.61a1.16 1.16 0 01-1.83.47z","M430.44 1008.31c-12.92-12.62-14.34-33.49-10.92-50.31.31-1.53 1.09-2.53 2.73-2.86q11.44-2.25 23.08-2.59c14.13-.42 17.31 5.67 14.54 18.63q-3.13 14.69-9.12 30.37c-3.45 9.03-11.63 15.25-20.31 6.76z","M438.96 1059.52q-2.25-1.89-3.8-4.64-20.15-35.92-31.06-75.66-2.11-7.68 1.95-14.16a1.16 1.16 0 011.91-.08c2.26 3.06 3.4 5.4 4.26 9.37 3.98 18.54 10.94 32.53 20.07 51.09 3.51 7.14 11.38 26.16 8.5 33.61a1.16 1.16 0 01-1.83.47z"],
  tibialis:["M263.52 973.59a.6.6 0 011.09-.14q1.38 2.22 1.83 5.06c7.87 49.97 18.01 99.59 25 149.68q4.63 33.19 4.31 67.55-.04 3.45-2.15 5.76-.4.44-.75-.03-1.89-2.58-3.08-5.51c-11.63-28.6-20.46-58.12-24.26-88.68q-4.96-39.97-5.72-69.53c-.13-5.27-.17-12.59.35-18.98q1.7-20.77 2.52-41.6c.04-1.16.52-2.43.86-3.58z","M463.39 973.68a.7.7 0 011.25-.1c.27.46.64 1.34.68 1.93q1.26 20.88 2.53 41.76.66 10.82.39 19.98-1.23 40.77-7.51 82.25c-3.91 25.87-12.19 51.55-21.96 75.76q-1.13 2.79-3.27 6.13-.29.44-.71.12c-2.68-2.06-2.32-6.7-2.29-10.32.26-31.03 2.71-55.52 8.76-91.4q9.27-55.06 18.94-110.05c.8-4.5.99-10.52 3.19-16.06z","M463.39 973.68a.7.7 0 011.25-.1c.27.46.64 1.34.68 1.93q1.26 20.88 2.53 41.76.66 10.82.39 19.98-1.23 40.77-7.51 82.25c-3.91 25.87-12.19 51.55-21.96 75.76q-1.13 2.79-3.27 6.13-.29.44-.71.12c-2.68-2.06-2.32-6.7-2.29-10.32.26-31.03 2.71-55.52 8.76-91.4q9.27-55.06 18.94-110.05c.8-4.5.99-10.52 3.19-16.06z"],
  ankles:["M291.88 1208.11c5.48-1.03 11.85 5.55 13.38 10.37q2.45 7.74 1.47 16.83-.09.83-.45.08c-4.31-9.05-8-16.99-15.39-23.88a1.98 1.98 0 01.99-3.4z","M275.88 1270.94c-4.41-3.87-7.4-7.17-4.91-13.37q4.78-11.92 5.49-21.32.62-8.27 6.22-12.84c9-7.33 20.8 15 23.1 22.1 2.55 7.91 4.83 16.36 4.49 24.5-.31 7.14-2.02 17.4-6.49 23.1q-.3.38-.53-.05c-5.67-10.74-18.6-14.41-27.37-22.12z","M430.92 1209.12c2.24-1.35 10.54-2.02 6.02 2.65q-9.99 10.32-14.82 23.8a.28.28 0 01-.55-.08c-.52-10.27-.48-20.45 9.35-26.37z","M445.01 1223.26c8.45 6.56 6.46 16.66 9.35 25.59q1.76 5.43 3.47 10.88c3.84 12.26-27.75 21.49-32.21 32.42q-1.02 2.51-2.17.05c-6.91-14.82-6.79-29.36-1.78-44.58q2.82-8.57 8.02-16.04c3.02-4.35 9.61-12.76 15.32-8.32z","M430.92 1209.12c2.24-1.35 10.54-2.02 6.02 2.65q-9.99 10.32-14.82 23.8a.28.28 0 01-.55-.08c-.52-10.27-.48-20.45 9.35-26.37z","M445.01 1223.26c8.45 6.56 6.46 16.66 9.35 25.59q1.76 5.43 3.47 10.88c3.84 12.26-27.75 21.49-32.21 32.42q-1.02 2.51-2.17.05c-6.91-14.82-6.79-29.36-1.78-44.58q2.82-8.57 8.02-16.04c3.02-4.35 9.61-12.76 15.32-8.32z"],
  feet:["M264.5 1334.5c-3.98-.34-18.59-4.25-19.04-9.44a1.4 1.4 0 01.27-.94c9.66-13.03 20.9-25.49 28.65-39.78q.25-.47.78-.37 9.76 1.78 17.73 7.65a1.19 1.18 43 01.07 1.86c-1.32 1.11-1.65 2.62-1.06 4.35 2.96 8.57-.92 16.55-4.81 25.34-1.79 4.06-1.76 8.99-2.81 13.62a1.56 1.56 0 01-1.99 1.14q-8.36-2.64-17.79-3.43z","M291.87 1340.12c-2.25-2.64-2.07-5.93-.78-9.35q3.34-8.88 4.02-18.35.43-6.02 1.25-8.74 1.32-4.37 3.45-8.22a.66.65 53.7 011.21.19q1.97 9.26 6.28 17.3c2.59 4.85-.82 11.49-2.92 16.14a1.81 1.78-35.8 00-.16.94q.42 4.3-1.9 7.94-.22.33-.61.43l-8.79 2.06a1.06 1.06 0 01-1.05-.34z","M444.66 1337.65q-1.08-1.3-1.28-3.09c-.52-4.48-.73-8.39-2.77-12.64-3.51-7.31-7.06-16.37-4.43-23.19.77-1.99.92-3.79-.76-5.13a1.29 1.28 46.4 01.04-2.04q7.96-5.76 17.59-7.64.46-.1.69.32c7.25 13.1 17.21 24.83 26.45 36.56q1.11 1.41 2.51 3.8a1.17 1.14-51 01.09.95c-1.75 5.01-12.93 7.89-17.77 8.55q-9.87 1.36-19.54 3.82a.82.8-26.2 01-.82-.27z","M426.94 1338.55c-2.01-.34-2.96-5.48-3-7.12-.15-6.02-6.29-11.65-3.12-17.89q4.35-8.53 6.34-17.75a.78.78 0 011.47-.17c2.12 4.52 4.18 9.08 4.35 14.33q.35 10.43 3.97 20.24c1.19 3.22 1.52 5.83.39 8.78a2.32 2.31 19.3 01-2.87 1.38q-3.44-1.09-7.53-1.8z","M444.66 1337.65q-1.08-1.3-1.28-3.09c-.52-4.48-.73-8.39-2.77-12.64-3.51-7.31-7.06-16.37-4.43-23.19.77-1.99.92-3.79-.76-5.13a1.29 1.28 46.4 01.04-2.04q7.96-5.76 17.59-7.64.46-.1.69.32c7.25 13.1 17.21 24.83 26.45 36.56q1.11 1.41 2.51 3.8a1.17 1.14-51 01.09.95c-1.75 5.01-12.93 7.89-17.77 8.55q-9.87 1.36-19.54 3.82a.82.8-26.2 01-.82-.27z","M426.94 1338.55c-2.01-.34-2.96-5.48-3-7.12-.15-6.02-6.29-11.65-3.12-17.89q4.35-8.53 6.34-17.75a.78.78 0 011.47-.17c2.12 4.52 4.18 9.08 4.35 14.33q.35 10.43 3.97 20.24c1.19 3.22 1.52 5.83.39 8.78a2.32 2.31 19.3 01-2.87 1.38q-3.44-1.09-7.53-1.8z"],
  serratus:["M268.5 460.2c-2.1-1.3-3.8-3.9-3.2-6.4q1.2-5.1 4.8-8.3c2.4-2.1 5.6-1.8 8.2-.4q4.3 2.3 6.1 7.1c1.2 3.2-.3 6.8-3.1 8.4q-5.8 3.3-12.8-.4z","M262.3 478.5c-1.8-1.6-2.9-4.2-2.1-6.7q1.5-4.8 5.4-7.2c2.6-1.6 5.8-.8 8.1 1.1q3.7 3.1 4.2 8.2c.3 3.4-1.5 6.3-4.6 7.4q-5.6 2-11-.8z","M258.1 498.3c-1.5-1.9-2.2-4.6-1.1-7q2-4.3 6.1-6.1c2.8-1.2 5.9.1 7.8 2.4q3.1 3.7 2.8 8.9c-.2 3.5-2.3 5.9-5.6 6.5q-5.3 1.2-10-4.7z","M456.8 460.2c2.1-1.3 3.8-3.9 3.2-6.4q-1.2-5.1-4.8-8.3c-2.4-2.1-5.6-1.8-8.2-.4q-4.3 2.3-6.1 7.1c-1.2 3.2.3 6.8 3.1 8.4q5.8 3.3 12.8-.4z","M462.9 478.5c1.8-1.6 2.9-4.2 2.1-6.7q-1.5-4.8-5.4-7.2c-2.6-1.6-5.8-.8-8.1 1.1q-3.7 3.1-4.2 8.2c-.3 3.4 1.5 6.3 4.6 7.4q5.6 2 11-.8z","M467.1 498.3c1.5-1.9 2.2-4.6 1.1-7q-2-4.3-6.1-6.1c-2.8-1.2-5.9.1-7.8 2.4q-3.1 3.7-2.8 8.9c.2 3.5 2.3 5.9 5.6 6.5q5.3 1.2 10-4.7z","M456.8 460.2c2.1-1.3 3.8-3.9 3.2-6.4q-1.2-5.1-4.8-8.3c-2.4-2.1-5.6-1.8-8.2-.4q-4.3 2.3-6.1 7.1c-1.2 3.2.3 6.8 3.1 8.4q5.8 3.3 12.8-.4z","M462.9 478.5c1.8-1.6 2.9-4.2 2.1-6.7q-1.5-4.8-5.4-7.2c-2.6-1.6-5.8-.8-8.1 1.1q-3.7 3.1-4.2 8.2c-.3 3.4 1.5 6.3 4.6 7.4q5.6 2 11-.8z","M467.1 498.3c1.5-1.9 2.2-4.6 1.1-7q-2-4.3-6.1-6.1c-2.8-1.2-5.9.1-7.8 2.4q-3.1 3.7-2.8 8.9c.2 3.5 2.3 5.9 5.6 6.5q5.3 1.2 10-4.7z"],
  hipFlexors:["M305.2 700.5c-3.8-2.1-7.2-6.3-8.1-10.7q-1.4-6.8 1.2-13.1c1.8-4.3 5.9-7.1 10.3-7.8q6.2-.9 11.4 2.8c3.5 2.5 5.2 6.9 4.8 11.2q-.6 6.7-5.3 11.9c-3.1 3.4-8.1 8.8-14.3 5.7z","M421.5 700.5c3.8-2.1 7.2-6.3 8.1-10.7q1.4-6.8-1.2-13.1c-1.8-4.3-5.9-7.1-10.3-7.8q-6.2-.9-11.4 2.8c-3.5 2.5-5.2 6.9-4.8 11.2q.6 6.7 5.3 11.9c3.1 3.4 8.1 8.8 14.3 5.7z","M421.5 700.5c3.8-2.1 7.2-6.3 8.1-10.7q1.4-6.8-1.2-13.1c-1.8-4.3-5.9-7.1-10.3-7.8q-6.2-.9-11.4 2.8c-3.5 2.5-5.2 6.9-4.8 11.2q.6 6.7 5.3 11.9c3.1 3.4 8.1 8.8 14.3 5.7z"],
  upperChest:["M275.8 345.1c5.2-4.8 14.3-8.2 21.6-9.4q12.8-1.8 24.5.5c6.4 1.2 11.2 6.3 13.4 12.5q3.2 9.1 1.8 18.8c-.9 6.2-5.1 10.4-10.8 12.9q-8.5 3.7-18.6 2.4c-6.8-.9-13.2-3.1-18.4-7.8q-7.7-6.9-13.5-29.9z","M449.5 345.1c-5.2-4.8-14.3-8.2-21.6-9.4q-12.8-1.8-24.5.5c-6.4 1.2-11.2 6.3-13.4 12.5q-3.2 9.1-1.8 18.8c.9 6.2 5.1 10.4 10.8 12.9q8.5 3.7 18.6 2.4c6.8-.9 13.2-3.1 18.4-7.8q7.7-6.9 13.5-29.9z","M449.5 345.1c-5.2-4.8-14.3-8.2-21.6-9.4q-12.8-1.8-24.5.5c-6.4 1.2-11.2 6.3-13.4 12.5q-3.2 9.1-1.8 18.8c.9 6.2 5.1 10.4 10.8 12.9q8.5 3.7 18.6 2.4c6.8-.9 13.2-3.1 18.4-7.8q7.7-6.9 13.5-29.9z"],
  lowerChest:["M279.3 394.2c3.1-2.8 8.9-5.1 13.2-5.9q9.8-1.8 19.8.3c5.6 1.2 10.1 4.8 12.8 10.1q3.8 7.5 2.4 15.9c-1.1 6.1-5.8 9.8-11.2 11.8q-7.6 2.8-16.1 1.1c-5.7-1.1-10.8-3.8-14.5-8.5q-5.5-7-6.4-24.8z","M446.2 394.2c-3.1-2.8-8.9-5.1-13.2-5.9q-9.8-1.8-19.8.3c-5.6 1.2-10.1 4.8-12.8 10.1q-3.8 7.5-2.4 15.9c1.1 6.1 5.8 9.8 11.2 11.8q7.6 2.8 16.1 1.1c5.7-1.1 10.8-3.8 14.5-8.5q5.5-7 6.4-24.8z","M446.2 394.2c-3.1-2.8-8.9-5.1-13.2-5.9q-9.8-1.8-19.8.3c-5.6 1.2-10.1 4.8-12.8 10.1q-3.8 7.5-2.4 15.9c1.1 6.1 5.8 9.8 11.2 11.8q7.6 2.8 16.1 1.1c5.7-1.1 10.8-3.8 14.5-8.5q5.5-7 6.4-24.8z"],
  innerQuad:["M316.5 780.2c-2.8-1.4-4.1-4.8-4.2-8.1q-.3-12.8 2.1-25.3c1.6-8.2 4.8-15.8 9.2-22.6q5.7-8.8 13.1-15.9c2.4-2.3 5.8-1.2 7.1 1.8q3.2 7.4 3.8 15.6c.8 11.2-.4 22.5-3.2 33.4q-2.8 10.8-8.1 18.4c-3.4 4.8-12.8 6.2-17.8 2.7z","M410.2 780.2c2.8-1.4 4.1-4.8 4.2-8.1q.3-12.8-2.1-25.3c-1.6-8.2-4.8-15.8-9.2-22.6q-5.7-8.8-13.1-15.9c-2.4-2.3-5.8-1.2-7.1 1.8q-3.2 7.4-3.8 15.6c-.8 11.2.4 22.5 3.2 33.4q2.8 10.8 8.1 18.4c3.4 4.8 12.8 6.2 17.8 2.7z","M410.2 780.2c2.8-1.4 4.1-4.8 4.2-8.1q.3-12.8-2.1-25.3c-1.6-8.2-4.8-15.8-9.2-22.6q-5.7-8.8-13.1-15.9c-2.4-2.3-5.8-1.2-7.1 1.8q-3.2 7.4-3.8 15.6c-.8 11.2.4 22.5 3.2 33.4q2.8 10.8 8.1 18.4c3.4 4.8 12.8 6.2 17.8 2.7z"],
  outerQuad:["M258.4 810.5c-3.2-5.8-4.8-13.2-4.1-19.8q1.2-11.8 5.8-22.8c3.1-7.4 7.8-14.1 13.5-19.8q7.2-7.2 16.1-12.4c2.8-1.6 6.1.2 6.8 3.5q1.8 8.4 1.2 17.2c-.8 12.1-3.8 24.1-8.4 35.2q-4.6 11.1-11.8 19.8c-4.6 5.5-14.5 7.1-19.1-0.9z","M468.3 810.5c3.2-5.8 4.8-13.2 4.1-19.8q-1.2-11.8-5.8-22.8c-3.1-7.4-7.8-14.1-13.5-19.8q-7.2-7.2-16.1-12.4c-2.8-1.6-6.1.2-6.8 3.5q-1.8 8.4-1.2 17.2c.8 12.1 3.8 24.1 8.4 35.2q4.6 11.1 11.8 19.8c4.6 5.5 14.5 7.1 19.1-0.9z","M468.3 810.5c3.2-5.8 4.8-13.2 4.1-19.8q-1.2-11.8-5.8-22.8c-3.1-7.4-7.8-14.1-13.5-19.8q-7.2-7.2-16.1-12.4c-2.8-1.6-6.1.2-6.8 3.5q-1.8 8.4-1.2 17.2c.8 12.1 3.8 24.1 8.4 35.2q4.6 11.1 11.8 19.8c4.6 5.5 14.5 7.1 19.1-0.9z"],
  upperAbs:["M315.8 448.2c-2.1-1.8-3.2-5.1-2.8-8.1q.8-6.2 4.1-11.4c2.2-3.4 5.8-5.1 9.6-5.3q6.2-.3 11.8 2.1c3.8 1.6 5.8 5.4 5.4 9.6q-.6 6.8-4.8 12.1c-2.8 3.5-6.8 4.8-11.1 4.2q-7.1-1-12.2-3.2z","M411.5 448.2c2.1-1.8 3.2-5.1 2.8-8.1q-.8-6.2-4.1-11.4c-2.2-3.4-5.8-5.1-9.6-5.3q-6.2-.3-11.8 2.1c-3.8 1.6-5.8 5.4-5.4 9.6q.6 6.8 4.8 12.1c2.8 3.5 6.8 4.8 11.1 4.2q7.1-1 12.2-3.2z","M411.5 448.2c2.1-1.8 3.2-5.1 2.8-8.1q-.8-6.2-4.1-11.4c-2.2-3.4-5.8-5.1-9.6-5.3q-6.2-.3-11.8 2.1c-3.8 1.6-5.8 5.4-5.4 9.6q.6 6.8 4.8 12.1c2.8 3.5 6.8 4.8 11.1 4.2q7.1-1 12.2-3.2z"],
  lowerAbs:["M320.1 620.5c-3.1-2.4-4.8-6.8-4.2-10.8q1.1-7.2 5.1-13.2c2.6-3.8 6.4-5.8 10.8-5.4q6.8.6 12.1 4.8c3.4 2.7 4.8 7.1 3.8 11.4q-1.6 6.8-6.8 11.1c-3.4 2.8-7.8 3.8-12.1 3.1q-5.1-.8-8.7-1z","M407.2 620.5c3.1-2.4 4.8-6.8 4.2-10.8q-1.1-7.2-5.1-13.2c-2.6-3.8-6.4-5.8-10.8-5.4q-6.8.6-12.1 4.8c-3.4 2.7-4.8 7.1-3.8 11.4q1.6 6.8 6.8 11.1c3.4 2.8 7.8 3.8 12.1 3.1q5.1-.8 8.7-1z","M407.2 620.5c3.1-2.4 4.8-6.8 4.2-10.8q-1.1-7.2-5.1-13.2c-2.6-3.8-6.4-5.8-10.8-5.4q-6.8.6-12.1 4.8c-3.4 2.7-4.8 7.1-3.8 11.4q1.6 6.8 6.8 11.1c3.4 2.8 7.8 3.8 12.1 3.1q5.1-.8 8.7-1z"],
  frontDeltoid:["M261.2 338.5c-3.2-1.8-5.1-5.4-4.8-9.1q.5-6.2 4.2-11.1c2.5-3.3 6.2-4.8 10.1-4.1q5.8 1.1 9.8 5.4c2.7 2.9 3.4 7.1 2.1 10.8q-2.1 5.8-7.4 8.8c-3.5 2-9.2 2.1-14-.7z","M464.1 338.5c3.2-1.8 5.1-5.4 4.8-9.1q-.5-6.2-4.2-11.1c-2.5-3.3-6.2-4.8-10.1-4.1q-5.8 1.1-9.8 5.4c-2.7 2.9-3.4 7.1-2.1 10.8q2.1 5.8 7.4 8.8c3.5 2 9.2 2.1 14-.7z","M464.1 338.5c3.2-1.8 5.1-5.4 4.8-9.1q-.5-6.2-4.2-11.1c-2.5-3.3-6.2-4.8-10.1-4.1q-5.8 1.1-9.8 5.4c-2.7 2.9-3.4 7.1-2.1 10.8q2.1 5.8 7.4 8.8c3.5 2 9.2 2.1 14-.7z"],
  head:["M 418.91 167.68 c 3.92 -1.77 6.58 0.47 7.06 4.32 c 1.48 11.93 -4.92 26.67 -11.75 36.45 c -2.21 3.17 -3.86 0.17 -4.74 -1.76 a 0.38 0.38 0 0 0 -0.73 0.16 c 0.02 8.31 1.01 17.01 -3.36 24.53 c -0.167 0.293 -4.39 4.62 -10.799 9.508 c -23.591 18.112 -41.591 16.112 -61.446 -0.797 c -4.736 -3.649 -5.925 -5.041 -8.805 -7.621 c -5.66 -5.07 -5.28 -17.38 -4.47 -24.92 c 0.05 -0.51 -0.468 -0.892 -0.933 -0.687 a 0.653 0.653 0 0 0 -0.357 0.397 c -0.57 1.69 -2.24 4.05 -4.07 1.48 c -6.2 -8.71 -16.02 -28.53 -11.19 -38.98 c 1.68 -3.627 3.733 -3.91 6.16 -0.85 a 182.853 182.853 0 0 1 3.78 23.29 a 1.02 1.02 0 0 0 1.56 0.77 c 2.79 -1.75 2.61 -18.93 2.63 -24.22 c 0.02 -4.53 1.12 -8.94 3.8 -13.1 c 4.36 -6.76 4.86 -11.51 5.57 -19.82 c 0.47 -5.53 4.34 -8.12 9.77 -8.21 c 6.39 -0.12 12.69 -0.07 19 -0.93 c 4.02 -0.55 7.4 -1.43 11.53 -0.75 c 6.7 1.1 13.44 1.64 20.22 1.62 c 4.607 -0.013 7.523 0.227 8.75 0.72 c 5.96 2.37 5.56 9.73 6.11 15.22 c 0.44 4.34 2.097 8.447 4.97 12.32 c 6.57 8.88 2.19 25.6 5.64 36.36 a 1.14 1.14 0 0 0 2.22 -0.23 c 0.887 -8.36 2.18 -16.45 3.88 -24.27 z z z z"],
  hair:["M418.91 167.68q-2.55 11.73-3.88 24.27a1.14 1.14 0 01-2.22.23c-3.45-10.76.93-27.48-5.64-36.36q-4.31-5.81-4.97-12.32c-.55-5.49-.15-12.85-6.11-15.22q-1.84-.74-8.75-.72-10.17.03-20.22-1.62c-4.13-.68-7.51.2-11.53.75-6.31.86-12.61.81-19 .93-5.43.09-9.3 2.68-9.77 8.21-.71 8.31-1.21 13.06-5.57 19.82-2.68 4.16-3.78 8.57-3.8 13.1-.02 5.29.16 22.47-2.63 24.22a1.02 1.02 0 01-1.56-.77q-1.14-11.78-3.78-23.29-1.48-6.99-1.9-9.7c-2.49-15.94.13-40.13 13.53-51.15 9.39-7.72 28.53-11.63 40.37-11.51 4.2.05 8.74-.3 12.68.22 13.82 1.82 31.67 5.83 39.42 18.92 9.01 15.21 9.88 35.14 5.33 51.99z"],
};
const BODY_PARTS_BACK={
  neck:["M1022.74 290.63a.62.61 25.9 01-.36-1.03q1.71-1.83 4.11-3.11c8.19-4.35 19.4-8.3 23.38-17.48q8.48-19.57 8.22-40.85-.05-4.38.57-5.76c1.98-4.38 9.65-3.66 13.85-2.91 4.3.76 4.71 3.25 4.68 7.3q-.2 24.11-.88 48.2c-.12 4.25 1.6 15.84-4.88 16.32-14.57 1.08-32.6 1.81-48.69-.68z","M1095.75 291.46c-4.3-.25-4.9-3.99-4.95-7.71q-.46-29.47-1-58.94c-.13-7.39 11.74-6.23 15.99-4.85 4.2 1.36 3.01 6.89 2.88 10.79-.28 8.88 5.15 41.1 15.32 46.78q8.6 4.81 17.27 9.51 1.97 1.07 3.26 2.36a.8.79 63.6 01-.45 1.35c-16.12 2.17-33.78 1.56-48.32.71z","M1095.75 291.46c-4.3-.25-4.9-3.99-4.95-7.71q-.46-29.47-1-58.94c-.13-7.39 11.74-6.23 15.99-4.85 4.2 1.36 3.01 6.89 2.88 10.79-.28 8.88 5.15 41.1 15.32 46.78q8.6 4.81 17.27 9.51 1.97 1.07 3.26 2.36a.8.79 63.6 01-.45 1.35c-16.12 2.17-33.78 1.56-48.32.71z"],
  trapezius:["M1071.06 308.94c5.6 4.92 6.96 17.83 7.43 24.88q1.5 22.3.93 44.68-1.2 46.76-5.66 94a.57.56 3.7 01-.59.51q-.68-.03-.94-1.01-4.29-15.9-9.79-25.19c-10.24-17.31-18.8-31.84-25.59-49.4-10.19-26.38-15.6-54.28-26.46-80.58q-3.07-7.43-7.61-14.07-.3-.43.2-.6 12.47-4.28 25.48-4.85c5.54-.25 12.15.86 18.32 1.41 9.7.87 16.77 3.6 24.28 10.22z","M1163.98 302.12a.43.43 0 01.22.65q-7.08 10.77-11.41 23.37c-10.53 30.61-17.8 62.94-31.3 91.07-5.11 10.64-15.17 25.22-20.12 36.26q-4.08 9.08-6.59 18.83a.77.77 0 01-1.51-.12q-4.27-45.15-5.52-90.99c-.56-20.28-.74-39.92 2.75-60.43 1.04-6.13 2.77-9.98 7.85-13.85 9.8-7.48 18.02-7.73 30.1-9.11 12.02-1.39 23.92.4 35.53 4.32z","M1163.98 302.12a.43.43 0 01.22.65q-7.08 10.77-11.41 23.37c-10.53 30.61-17.8 62.94-31.3 91.07-5.11 10.64-15.17 25.22-20.12 36.26q-4.08 9.08-6.59 18.83a.77.77 0 01-1.51-.12q-4.27-45.15-5.52-90.99c-.56-20.28-.74-39.92 2.75-60.43 1.04-6.13 2.77-9.98 7.85-13.85 9.8-7.48 18.02-7.73 30.1-9.11 12.02-1.39 23.92.4 35.53 4.32z"],
  deltoids:["M980.66 319.58c.19.14.55.19.65.32a.8.8 0 01-.16 1.15c-6.78 4.75-15.26 9.77-20.03 15.58-6.41 7.78-8.76 16.96-9.44 27.04-.39 5.92-1.68 9.5-5.59 13.43-10.02 10.08-19.04 16.47-31.14 20.41q-.75.25-.75-.55.19-18.4-.09-36.3-.14-9.4 1.07-14.22c4.04-16.07 22.8-33.85 39.68-35.64 9.99-1.06 17.34 2.46 25.8 8.78z","M1227.3 316.44c14.62 9.44 25.48 21.03 25.46 39.51q-.02 20.56-.01 41.37a.37.37 0 01-.51.35c-5.08-2.06-10.41-3.98-14.9-6.97-7.84-5.24-21.14-14.95-21.77-24.95-.69-10.75-2.81-20.85-9.76-29.25-4.68-5.65-12.96-10.58-19.6-15.26q-1.23-.87.01-1.71c4.6-3.13 9.91-6.78 15.25-7.98q13.58-3.03 25.83 4.89z","M1227.3 316.44c14.62 9.44 25.48 21.03 25.46 39.51q-.02 20.56-.01 41.37a.37.37 0 01-.51.35c-5.08-2.06-10.41-3.98-14.9-6.97-7.84-5.24-21.14-14.95-21.77-24.95-.69-10.75-2.81-20.85-9.76-29.25-4.68-5.65-12.96-10.58-19.6-15.26q-1.23-.87.01-1.71c4.6-3.13 9.91-6.78 15.25-7.98q13.58-3.03 25.83 4.89z"],
  upperBack:["M987.06 381.44c-8.48-5.06-14.14-13.28-18.82-22.92q-5.3-10.92-6.46-14.04c-1.49-4.01 35.14-19.22 39.61-20.97q2.75-1.08 4.33-.72c4.33.96 6.61 9.96 7.46 13.7q5.43 23.89 14.65 55.74.78 2.7-.88 4.39c-5.37 5.5-34.69-12.08-39.89-15.18z","M1017.44 583.31q-9.11-9.57-16.97-22.03-2.28-3.62-2.91-7.25c-3.28-18.82-5.77-38.04-10.52-56.55-3.53-13.73-4.74-25.19-6.61-41.43-.85-7.35-5.67-13.34-8.22-18.75q-4.93-10.47-6.44-22.88-.33-2.72 1.89-1.11c7.25 5.27 16.36 6.16 26.91 7.56 8.86 1.19 23.41-3.18 28.94-10.76 3.34-4.58 4.7-6.5 8.86-8.77a.67.66-26.4 01.92.3q10.02 21.8 19.93 43.78c2.56 5.69 12.11 15.88 10.77 21.83-3.65 16.09-9.88 31.96-16.24 47.13-9.72 23.21-18.61 46.72-27.2 70.36q-.24.67-.88.35-1.03-.52-2.23-1.78z","M1017.71 404.73c-23.86 13.25-54.31 7.11-60.45-22.75-1.2-5.81-2.5-15.84.64-20.55 3.63-5.44 7.17 4.18 8.17 6.14 7.71 15.14 31.62 29.16 48.2 31.13q1.84.21 5.26 2.06.4.21.26.64-.86 2.65-2.08 3.33z","M1141.45 397.63a2.17 2.14-3.6 01-1.88-1.64q-.71-2.97.18-5.95 8.74-29.19 11.75-43.29c1.73-8.11 3.07-16.77 6.94-22.08 1.92-2.62 4.28-2.27 7.19-1.15q20.52 7.9 39.09 18.77a1.37 1.36 25.9 01.58 1.67c-6.05 15.46-12.98 30.84-28.43 39.45-9.45 5.26-25.83 15.17-35.42 14.22z","M1149.69 404.8q-2.04-1.15-2.45-3.5-.09-.53.41-.75c4.64-2.04 9.78-2.51 14.63-3.87 11.01-3.1 22.03-10.83 30.34-18.57q6.33-5.89 7.58-8.93c1.02-2.49 3.79-9.5 7-9.46q.52.01.87.39 2.71 3.01 2.81 7.2c.33 13.77-2.24 26.93-13.26 35.95-13.88 11.36-33.12 9.94-47.93 1.54z","M1161.19 419.98c6.1 1.57 11.6.99 17.75.06 8.36-1.27 14.83-2.76 21.34-7.27a.54.53 74.1 01.84.47q-.64 11.88-5.76 22.85c-2.42 5.2-6.64 10.84-8.04 16.67q-1.02 4.24-1.43 8.92-1.64 18.72-6.34 37.47c-4.73 18.91-7.13 38.67-10.8 57.85q-.24 1.24-2.2 4.3c-4.57 7.14-12.22 19.43-19.34 23.88a.44.43-25.6 01-.64-.22c-8.26-22.57-16.6-45.11-25.91-67.23-6.67-15.85-13.27-32.14-17.27-48.42q-1.58-6.41 2.91-12.01 5.21-6.51 8.57-14.14 9.25-21 19.01-41.64a.47.47 0 01.65-.21q6.17 3.37 9.51 9.64c2.45 4.6 12.22 7.75 17.15 9.03z","M1141.45 397.63a2.17 2.14-3.6 01-1.88-1.64q-.71-2.97.18-5.95 8.74-29.19 11.75-43.29c1.73-8.11 3.07-16.77 6.94-22.08 1.92-2.62 4.28-2.27 7.19-1.15q20.52 7.9 39.09 18.77a1.37 1.36 25.9 01.58 1.67c-6.05 15.46-12.98 30.84-28.43 39.45-9.45 5.26-25.83 15.17-35.42 14.22z","M1149.69 404.8q-2.04-1.15-2.45-3.5-.09-.53.41-.75c4.64-2.04 9.78-2.51 14.63-3.87 11.01-3.1 22.03-10.83 30.34-18.57q6.33-5.89 7.58-8.93c1.02-2.49 3.79-9.5 7-9.46q.52.01.87.39 2.71 3.01 2.81 7.2c.33 13.77-2.24 26.93-13.26 35.95-13.88 11.36-33.12 9.94-47.93 1.54z","M1161.19 419.98c6.1 1.57 11.6.99 17.75.06 8.36-1.27 14.83-2.76 21.34-7.27a.54.53 74.1 01.84.47q-.64 11.88-5.76 22.85c-2.42 5.2-6.64 10.84-8.04 16.67q-1.02 4.24-1.43 8.92-1.64 18.72-6.34 37.47c-4.73 18.91-7.13 38.67-10.8 57.85q-.24 1.24-2.2 4.3c-4.57 7.14-12.22 19.43-19.34 23.88a.44.43-25.6 01-.64-.22c-8.26-22.57-16.6-45.11-25.91-67.23-6.67-15.85-13.27-32.14-17.27-48.42q-1.58-6.41 2.91-12.01 5.21-6.51 8.57-14.14 9.25-21 19.01-41.64a.47.47 0 01.65-.21q6.17 3.37 9.51 9.64c2.45 4.6 12.22 7.75 17.15 9.03z"],
  triceps:["M931.03 442.29c-2.01 2.57-6.52 9.71-10.12 9.17q-.52-.08-.8-.52-1.35-2.09-1.84-4.44c-2.25-10.87-3.28-22.88 1.35-33.38 5.45-12.33 18.27-23.68 29.61-31.2a.47.46 68.7 01.71.32l6.42 38.52q.09.54-.26.97c-.47.58-1.12 1.52-1.71 1.94q-9.11 6.58-18.08 13.36-2.9 2.2-5.28 5.26z","M958.15 427.11a.41.41 0 01.55.27q4.44 16.16-2.23 31.41-3.37 7.73-5.91 19.98c-1.51 7.28-8.93 12.21-11.81 18.82-2.42 5.56-2.41 12.5-3.51 16.66-2.14 8.06-8.51 14.15-13.91 20.13a.93.93 0 01-1.54-.25q-.57-1.3-.75-2.89c-1.93-16.91 2.52-33.52 5.71-49.99 2.16-11.21-1.54-24.15 9.68-34.59q9.54-8.86 19.55-17.23c1.3-1.08 2.7-1.72 4.17-2.32z","M903.57 519.67a1.84 1.82-5.4 01-1.12-.92q-3.54-6.97-3.68-15.19c-.37-21.2 3.8-42.53 9.5-63.44q.33-1.23.92-.1 4.64 8.78 8.6 18.67c2.88 7.21 4.19 12.98 1.88 20.57q-6.07 19.96-14.02 39.23-.65 1.58-2.08 1.18z","M1213.94 424.56q-2.02-1.5-3.08-3.02-.31-.46-.22-1 3.32-19.22 6.42-38.46.09-.56.56-.25 14.9 9.82 24.8 22.71c9.8 12.75 9.72 30.37 5.41 45.13a2.62 2.62 0 01-3.76 1.57c-3.26-1.77-6.22-6.71-8.62-9.67-5.24-6.46-14.75-12-21.51-17.01z","M1246.2 534.5q-.95-.3-1.75-1.22c-4.65-5.4-9.13-9.88-11.46-15.51-2.96-7.13-1.37-15.5-5.64-22.09-4.06-6.26-8.72-9.91-10.89-17.58-1.62-5.68-2.81-11.46-4.97-17.02-4.56-11.69-6.45-20.86-3.33-33.56a.59.58-74 01.75-.42q1.69.56 3.22 1.79 11.23 9.08 21.54 19.18c5.39 5.28 6.92 10.13 7.24 18.16.9 22.52 10.62 44.97 6.59 67.49a1.01 1 13.9 01-1.3.78z","M1258.43 439.96q2.01 5.38 3.1 10.68c3.58 17.36 7.13 34.77 6.89 52.61q-.11 8.3-3.94 15.61a1.61 1.6 33.4 01-2.44.5c-1.45-1.19-1.9-3.58-2.43-4.94q-9.23-23.41-13.19-38.15c-2.63-9.81 6.82-27.63 11.53-36.35q.28-.5.48.04z","M1213.94 424.56q-2.02-1.5-3.08-3.02-.31-.46-.22-1 3.32-19.22 6.42-38.46.09-.56.56-.25 14.9 9.82 24.8 22.71c9.8 12.75 9.72 30.37 5.41 45.13a2.62 2.62 0 01-3.76 1.57c-3.26-1.77-6.22-6.71-8.62-9.67-5.24-6.46-14.75-12-21.51-17.01z","M1246.2 534.5q-.95-.3-1.75-1.22c-4.65-5.4-9.13-9.88-11.46-15.51-2.96-7.13-1.37-15.5-5.64-22.09-4.06-6.26-8.72-9.91-10.89-17.58-1.62-5.68-2.81-11.46-4.97-17.02-4.56-11.69-6.45-20.86-3.33-33.56a.59.58-74 01.75-.42q1.69.56 3.22 1.79 11.23 9.08 21.54 19.18c5.39 5.28 6.92 10.13 7.24 18.16.9 22.52 10.62 44.97 6.59 67.49a1.01 1 13.9 01-1.3.78z","M1258.43 439.96q2.01 5.38 3.1 10.68c3.58 17.36 7.13 34.77 6.89 52.61q-.11 8.3-3.94 15.61a1.61 1.6 33.4 01-2.44.5c-1.45-1.19-1.9-3.58-2.43-4.94q-9.23-23.41-13.19-38.15c-2.63-9.81 6.82-27.63 11.53-36.35q.28-.5.48.04z"],
  lowerBack:["M986.76 627.1c-3.13-13.13-7.31-49.77 7.27-58.07 2.4-1.37 4.8-.82 6.7 1.29 6.15 6.8 16.22 18.56 18.77 28.15a1.35 1.3 52.6 01-.11.98c-2.51 4.53-9.96 8.09-15.83 11.36q-5.47 3.06-11.33 10.52c-1.23 1.56-2.6 4.3-4.5 6.06a.59.58-28.2 01-.97-.29z","M1023.15 607.96a2.06 2.04-74.3 01-.94-1.69c-.17-10.98 5.04-24.58 8.79-34.9q15.61-42.83 36-83.59a1.11 1.1-62.5 011.51-.48c1.25.66 3.21 12.98 3.46 15.08q6.94 59.25 2.82 116.88-.62 8.66-3.1 19.37-.13.53-.59.24l-47.95-30.91z","M1090.76 581.75q.62-5.16 0-10.27.22-29.79 3.05-59.5 1.1-11.58 3.91-22.88.31-1.27.44-1.43 1.08-1.43 1.88.17 23.38 46.97 40.14 96.18c1.8 5.28 5.84 16.69 4.38 22.96a1.64 1.64 0 01-.71 1.01l-47.63 30.72q-1.12.72-1.34-.6-4.54-28-4.12-56.36z","M1151.19 603.31q-5.39-3.38-2.19-9.05 8.03-14.22 17.88-24.62c3.49-3.69 9.04.89 10.97 3.99q2.92 4.66 3.8 10.14 3.5 21.77-1.21 43.02a.96.96 0 01-1.77.28c-6.92-11.85-16.03-16.56-27.48-23.76z","M1090.76 581.75q.62-5.16 0-10.27.22-29.79 3.05-59.5 1.1-11.58 3.91-22.88.31-1.27.44-1.43 1.08-1.43 1.88.17 23.38 46.97 40.14 96.18c1.8 5.28 5.84 16.69 4.38 22.96a1.64 1.64 0 01-.71 1.01l-47.63 30.72q-1.12.72-1.34-.6-4.54-28-4.12-56.36z","M1151.19 603.31q-5.39-3.38-2.19-9.05 8.03-14.22 17.88-24.62c3.49-3.69 9.04.89 10.97 3.99q2.92 4.66 3.8 10.14 3.5 21.77-1.21 43.02a.96.96 0 01-1.77.28c-6.92-11.85-16.03-16.56-27.48-23.76z"],
  forearm:["M878.44 534.38a.15.15 0 01.18-.13c.47.12 6.68 15.77 7.07 17.22q6.66 24.73 5.52 50.29c-.4 8.9-3.45 17.35-6.64 25.55-7.94 20.38-17.41 41.88-29.59 60.09a1.04 1.02-54.2 01-1.49.25c-.34-.26.37-1.45.47-1.83q5.58-20.8 8.97-42.08 8.65-54.15 15.51-109.36z","M893 518.93a.39.38 24.6 01.69-.25q5.97 7.83 13.11 15.27c8.08 8.4 1.41 28.73-5.88 37.12a1.05 1.05 0 01-1.63-.05c-6.09-7.93-5.41-18.74-4.97-28.44.36-8.12-.76-15.7-1.32-23.65z","M869.06 547.19c2.16.36 1.67 6.21 1.57 7.8q-2.54 38.84-9.11 77.16c-3.04 17.71-8.47 41.3-22.09 54.09a.38.38 0 01-.62-.41c14.51-40.44 19-84.26 26.8-126.31q.9-4.88 1.48-10.82.18-1.81 1.97-1.51z","M864.24 682.58q15.09-28.18 25.12-58.55c8.14-24.63 13.67-42.4 20.79-60.35q3.31-8.37 12.08-9.63c1.35-.2 3.68-.75 4.86.21q1.13.93.61 2.3-5.8 15.45-12.04 29.88c-5.79 13.39-14.92 28.68-20.32 40.14-6.12 13-28.07 59.18-31.64 56.64a.21.21 0 01.03-.36q.15-.07.34-.13.12-.04.17-.15z","M1272.99 519.43c.27-.33.33-.75.75-1.05a.32.32 0 01.5.29c-.7 7.22-1.77 14.33-1.66 21.54.13 8.94 2.13 24-5.35 31.17q-.37.35-.73 0c-7.63-7.55-14.2-28.29-6.52-36.92q6.6-7.41 13.01-15.03z","M1312.82 688.04c-4.78-6.01-7.2-10.8-11.76-19.56q-12.39-23.79-21.03-47.53c-4.86-13.36-5.22-26.17-3.83-40.19q1.13-11.5 2.69-19.53 2.72-13.98 9.59-26.79a.17.17 0 01.32.06q7.26 63.12 17.22 120.49 2.43 14.04 7.03 30.55c.22.79.74 1.33.36 2.4a.34.34 0 01-.59.1z","M1296.52 558.51c-.22-2.94-1.44-10.25 2-12.04a.62.61-18.4 01.89.44q6.25 35.69 12.21 71.07c3.88 23 8.77 46.2 16.73 68.19a.29.29 0 01-.47.31c-11.67-10.67-18.09-31.15-20.89-45.98q-7.27-38.55-10.47-81.99z","M1303.5 683.6c-2.89-.66-10.16-13.21-12.11-17.02-8.8-17.21-16.92-34.81-25.84-51.89-5.36-10.27-10.98-20.49-15.39-30.95q-5.86-13.86-11.07-27.8a1.63 1.62 79.5 011.5-2.2c13.02-.16 15.5 7.18 19.65 18.81q9.04 25.33 17.43 50.89 9.65 29.37 23.82 56.84.87 1.69 2.13 3.12.24.28-.12.2z","M1272.99 519.43c.27-.33.33-.75.75-1.05a.32.32 0 01.5.29c-.7 7.22-1.77 14.33-1.66 21.54.13 8.94 2.13 24-5.35 31.17q-.37.35-.73 0c-7.63-7.55-14.2-28.29-6.52-36.92q6.6-7.41 13.01-15.03z","M1312.82 688.04c-4.78-6.01-7.2-10.8-11.76-19.56q-12.39-23.79-21.03-47.53c-4.86-13.36-5.22-26.17-3.83-40.19q1.13-11.5 2.69-19.53 2.72-13.98 9.59-26.79a.17.17 0 01.32.06q7.26 63.12 17.22 120.49 2.43 14.04 7.03 30.55c.22.79.74 1.33.36 2.4a.34.34 0 01-.59.1z","M1296.52 558.51c-.22-2.94-1.44-10.25 2-12.04a.62.61-18.4 01.89.44q6.25 35.69 12.21 71.07c3.88 23 8.77 46.2 16.73 68.19a.29.29 0 01-.47.31c-11.67-10.67-18.09-31.15-20.89-45.98q-7.27-38.55-10.47-81.99z","M1303.5 683.6c-2.89-.66-10.16-13.21-12.11-17.02-8.8-17.21-16.92-34.81-25.84-51.89-5.36-10.27-10.98-20.49-15.39-30.95q-5.86-13.86-11.07-27.8a1.63 1.62 79.5 011.5-2.2c13.02-.16 15.5 7.18 19.65 18.81q9.04 25.33 17.43 50.89 9.65 29.37 23.82 56.84.87 1.69 2.13 3.12.24.28-.12.2z"],
  gluteal:["M1045.06 626.19q1.42.61 4.11 4.4.27.39-.19.52c-14.47 4.12-26.13 7.4-38.13 15.77q-15.37 10.71-30.53 21.6a.55.54 74.9 01-.86-.5c1.19-13.13 10.35-35.23 20.46-45.06 9.14-8.88 34.99-1.11 45.14 3.27z","M1007.94 762.81c-16.94-16.64-29.37-37.66-31.47-61-2.06-22.84 15.63-34.95 32.18-45.71 8.2-5.33 46.51-27.32 54.37-17.65 5.92 7.29 13.38 15.84 15.44 25.21q3.01 13.63 2.44 27.6-.94 22.59-6.27 44.49c-2.43 9.96-2.9 17.16-2.59 26.75.47 14.83-18.52 17.18-29.12 14.07-6.38-1.87-13.79-4.83-21.35-6.25q-7.39-1.38-13.63-7.51z","M1117.94 631.04q-.13-.03-.27-.06-.12-.02-.06-.13 2.58-4.2 7.05-5.92 12.71-4.87 26.13-5.81c12.93-.91 17.1 3.08 23.28 13.06 5.71 9.22 13.32 24.7 13.44 36.06q.01.76-.61.32-16.65-11.74-33.2-23.51c-10.03-7.14-23.72-10.58-35.76-14.01z","M1124.12 776.61c-9.28 2.74-26.75 1.29-28.86-10.88-1.05-6.03.27-14.88-1.3-23.27q-.54-2.94-2.15-9.35c-3.2-12.81-4.02-23.33-5.08-35.27-1.07-12.03-.57-22 1.64-33.17q1.1-5.6 4.19-10.41 8.74-13.58 11.87-16.59c4.96-4.77 15.84.18 21.19 2.11q19.7 7.12 40.17 21.43c9.59 6.7 19.29 14.31 22.93 25.17 4.81 14.37-.65 33.88-7.42 46.87q-7.79 14.97-21.39 28.9-6.74 6.9-15.26 8.36c-7.07 1.21-13.68 4.08-20.53 6.1z","M1117.94 631.04q-.13-.03-.27-.06-.12-.02-.06-.13 2.58-4.2 7.05-5.92 12.71-4.87 26.13-5.81c12.93-.91 17.1 3.08 23.28 13.06 5.71 9.22 13.32 24.7 13.44 36.06q.01.76-.61.32-16.65-11.74-33.2-23.51c-10.03-7.14-23.72-10.58-35.76-14.01z","M1124.12 776.61c-9.28 2.74-26.75 1.29-28.86-10.88-1.05-6.03.27-14.88-1.3-23.27q-.54-2.94-2.15-9.35c-3.2-12.81-4.02-23.33-5.08-35.27-1.07-12.03-.57-22 1.64-33.17q1.1-5.6 4.19-10.41 8.74-13.58 11.87-16.59c4.96-4.77 15.84.18 21.19 2.11q19.7 7.12 40.17 21.43c9.59 6.7 19.29 14.31 22.93 25.17 4.81 14.37-.65 33.88-7.42 46.87q-7.79 14.97-21.39 28.9-6.74 6.9-15.26 8.36c-7.07 1.21-13.68 4.08-20.53 6.1z"],
  adductors:["M1070.06 785.19c2.95 1.36 1.8 10.43 1.49 13.04q-3.98 33.27-14.66 64.61a.39.39 0 01-.76-.17c.9-7.05 2.31-14.29 2.16-20.92q-.68-30.14-18.71-54.52-.29-.39.18-.49c7.42-1.52 23.53-4.69 30.3-1.55z","M1127.24 787.66c-15.99 21.49-22.3 48.51-16.08 74.83a.47.46-63.2 01-.88.29q-1.99-4.69-3.65-10.24-8.29-27.75-11.6-56.54c-.65-5.71-1.1-11.77 6.87-11.9q13-.19 25.68 2.83a.31.24 41.2 01.1.53q-.12.01-.27.07-.1.04-.17.13z","M1127.24 787.66c-15.99 21.49-22.3 48.51-16.08 74.83a.47.46-63.2 01-.88.29q-1.99-4.69-3.65-10.24-8.29-27.75-11.6-56.54c-.65-5.71-1.1-11.77 6.87-11.9q13-.19 25.68 2.83a.31.24 41.2 01.1.53q-.12.01-.27.07-.1.04-.17.13z"],
  hamstring:["M963.27 741.53a.71.7 31.7 011.19-.28q1.51 1.62 2.47 3.99c4.6 11.41 8.93 22.66 11.07 34.72 3.38 19.14 4.84 38.23 3.12 57.74q-1.68 19.06-2.99 38.15c-.51 7.55-.88 15.71.07 23.18q1.08 8.54 1.39 17.57a.52.52 0 01-.98.25q-1.03-2.07-1.8-4.62-5.13-16.92-7.25-34.49-5.01-41.45-6.86-83.17-1.09-24.75-.07-49.51.06-1.59.64-3.53z","M1030.2 791.53q.17-.36.38-.03c5.26 8.11 9.94 16.15 12.47 25.64 3.12 11.72 5.87 24.36 4.31 36.24q-.5 3.8-3.57 14.02c-10.75 35.81-12.83 74.2-18.5 111.1q-.82 5.4-2.55 10.55-.23.68-.59.07c-4.72-8.07-5.18-25.09-5.34-34.81-.7-43.69 1.92-87.82 6.38-131.28 1.41-13.74 1.99-21.15 7.01-31.5z","M998.81 761.94q14.07 14.17 20.1 33.62c.98 3.15-.78 9.61-.93 12.91q-1.3 27.63-2.3 55.27c-.55 15.31-1.54 30.27-5.12 45.26q-8.62 36.18-22.76 68.73-3.65 8.41-10.15 17.19-.45.61-.41-.14c.11-1.93.82-4.15.99-5.71q2.45-22.72 6.08-45.26c2.83-17.66 4.18-35.95 4.33-52.37.33-36.43-.75-73.34 1.47-109.68.33-5.32 1.07-16.16 4.7-20.25q.33-.36.81-.45 1.95-.37 3.19.88z","M1052.52 855.62a.04.04 0 01.08.01q1.07 9.9 2.17 19.87.33 3.04-2.37 14.18c-3.83 15.8-8.15 31.11-8.9 47.47-.99 21.61-3.11 45.66-9.92 66.3q-1.49 4.52-.87-.2 3.38-25.36 3.7-51.99c.05-3.74-.4-10.32.2-15.58 2.19-19.2 7.39-38.25 11.75-57.05 1.78-7.64 2.93-15.21 4.16-23.01z","M1183.25 947.53c2.57 14.85 4.32 31.11 6.22 46.14q.35 2.74-1.11.39c-14.67-23.67-23.34-52.15-30.55-79.32q-5.08-19.14-5.97-39.05-1.36-30.37-2.44-60.74c-.22-6.09-2.56-15.63-.55-21.57q5.87-17.35 18.96-31.07c10.77-11.28 10.17 46.55 10.16 48.97-.13 41.09-.45 74.18 1.91 110.07.57 8.75 1.88 17.53 3.37 26.18z","M1136.43 791.52q.27-.42.49.03c3.12 6.46 4.84 12.26 5.68 19.83 5.07 45.8 8.05 94.61 7.56 140.76-.13 11.8-.46 26.22-5.13 37.08a.44.44 0 01-.83-.06q-2.51-9.14-3.69-18.41-3.54-27.64-7.36-55.24c-2.49-18-5.47-35.67-11.09-52.26q-4.35-12.82-2.08-26.75c1.76-10.77 3.58-21.61 8.46-31.16q3.58-6.99 7.99-13.82z","M1115.03 856.73c2.03 18.72 7.11 37.44 11.47 55.77 2.25 9.46 3.94 19.51 3.95 30.11q.02 31.7 4.08 63.16.16 1.26-.29.07-2.7-7.15-4.19-14.6c-4.44-22.21-5.71-40.52-6.87-61.23-.24-4.24-1.19-9.64-2.23-13.92q-3.94-16.25-7.7-32.55c-2.09-9.04.08-18.69 1.6-27.66q.07-.38.32-.09.16.19.01.4-.19.24-.15.54z","M1202.61 741.08a.44.44 0 01.72.03c.52.82.9 1.86.95 2.91q.73 15.98.37 31.97-1.16 52.95-7.85 105.49-1.88 14.74-5.97 29.04-1 3.52-1.92 4.95-1.57 2.47-1.39-.37c.58-9.44 1.83-19.17 1.71-28.16-.32-24.52-4.94-49.11-3.95-72.75.69-16.54 2.5-33.51 7.54-49.38q2.99-9.4 6.61-18.6.74-1.88 3.18-5.13z","M1183.25 947.53c2.57 14.85 4.32 31.11 6.22 46.14q.35 2.74-1.11.39c-14.67-23.67-23.34-52.15-30.55-79.32q-5.08-19.14-5.97-39.05-1.36-30.37-2.44-60.74c-.22-6.09-2.56-15.63-.55-21.57q5.87-17.35 18.96-31.07c10.77-11.28 10.17 46.55 10.16 48.97-.13 41.09-.45 74.18 1.91 110.07.57 8.75 1.88 17.53 3.37 26.18z","M1136.43 791.52q.27-.42.49.03c3.12 6.46 4.84 12.26 5.68 19.83 5.07 45.8 8.05 94.61 7.56 140.76-.13 11.8-.46 26.22-5.13 37.08a.44.44 0 01-.83-.06q-2.51-9.14-3.69-18.41-3.54-27.64-7.36-55.24c-2.49-18-5.47-35.67-11.09-52.26q-4.35-12.82-2.08-26.75c1.76-10.77 3.58-21.61 8.46-31.16q3.58-6.99 7.99-13.82z","M1115.03 856.73c2.03 18.72 7.11 37.44 11.47 55.77 2.25 9.46 3.94 19.51 3.95 30.11q.02 31.7 4.08 63.16.16 1.26-.29.07-2.7-7.15-4.19-14.6c-4.44-22.21-5.71-40.52-6.87-61.23-.24-4.24-1.19-9.64-2.23-13.92q-3.94-16.25-7.7-32.55c-2.09-9.04.08-18.69 1.6-27.66q.07-.38.32-.09.16.19.01.4-.19.24-.15.54z","M1202.61 741.08a.44.44 0 01.72.03c.52.82.9 1.86.95 2.91q.73 15.98.37 31.97-1.16 52.95-7.85 105.49-1.88 14.74-5.97 29.04-1 3.52-1.92 4.95-1.57 2.47-1.39-.37c.58-9.44 1.83-19.17 1.71-28.16-.32-24.52-4.94-49.11-3.95-72.75.69-16.54 2.5-33.51 7.54-49.38q2.99-9.4 6.61-18.6.74-1.88 3.18-5.13z"],
  calves:["M982.69 1149.31c-3.07-2.23-3.98-6.24-5.24-11.03-7.19-27.14-7.88-53.18-6.67-82.78q1.03-25.29 9.23-47.45c4.77-12.89 15.33-24.77 23.79-36q.82-1.09.74.27c-1.37 22.86-2.72 45.67-3.11 68.49-.52 30.56-1.51 61.11-.42 91.68.24 6.83-2.77 16.29-10.08 18.37q-4.39 1.25-8.24-1.55z","M983.99 1163.56c7.15-5.59 16.16-.63 17 8.23q4.31 45.02 5.22 90.26c.16 8.25-.8 15.79-2.19 23.65q-.45 2.52-1.43 3.66-.95 1.11-1.22-.33c-5.03-26.7-8.28-53.49-11.87-80.36q-1.68-12.52-3.24-18.71-2.04-8.12-5.53-18.24c-1.03-3 .8-6.25 3.26-8.16z","M1013.69 1150.31c-4.8-2.61-4.66-16.17-4.36-20.75 2.34-36.49 3.44-73.94 1.04-110.45-1.03-15.55.02-31.49.62-47.06q.03-.66.25-.03c2.28 6.45 4.52 12.88 7.39 19.11 5.12 11.14 11.5 22.91 14.83 33.92q2.34 7.74 3.97 16.46 5.3 28.43 5.62 56.09c.2 18.32-7.9 40-22.63 51.79q-3.42 2.73-6.73.92z","M1014.14 1164.37c7-1.83 14.1 2.2 14.11 9.95q.06 29.04-5.62 57.41c-3.87 19.28-6.24 38.23-8.43 57.48a.37.37 0 01-.74-.01q-3.12-43.48-3.58-86.64-.15-14.16.76-28.3c.18-2.83.02-8.98 3.5-9.89z","M1172.94 1149.31c-6.06-4.56-6.94-11.4-6.8-19.4.96-52.67-.49-105.31-3.54-157.9q-.04-.72.41-.16 7.96 10.07 15.43 20.44c9.11 12.64 13.61 28.98 15.78 44.21 4.96 34.71 3.75 72.94-5.97 106.5-1.97 6.82-9.18 10.93-15.31 6.31z","M1144.41 1147.33q-17.19-17.37-20.08-40.86-.89-7.22-.13-19.97 1.18-20.06 4.69-41.33c2.33-14.1 5.8-25.22 12.41-38.61q8.19-16.59 14.35-34.15a.14.13-37.7 01.26.03q1.01 15.71 1.26 31.44c.18 11.61-1.34 24.91-1.58 36.43-.72 34.7 1.22 62.05 2.06 93.19.17 6.32-1.1 26.1-13.24 13.83z","M1173.74 1161.73c6.88-2 14.34 3.23 11.98 10.91-2.24 7.3-4.78 14.44-5.99 21.96-5.07 31.52-8.04 63.18-14.13 94.6a.72.71-61.9 01-1.21.37c-.14-.14-.35-.39-.4-.59q-3.53-13.58-3.19-28.23 1.04-44.67 5.06-87.04c.58-6.1 1.93-10.25 7.88-11.98z","M1154.32 1165a1.58 1.57-84.6 01.97 1.18c.79 4.42 1.42 8.78 1.57 13.4.96 29.17-.47 62.66-2.04 90.23q-.78 13.79-1.39 19.52a.23.23 0 01-.45 0c-2.79-21.25-5.41-41.99-9.64-63.03-3.44-17.08-4.29-34.91-4.68-52.3-.19-8.37 8.99-11.61 15.66-9z","M1172.94 1149.31c-6.06-4.56-6.94-11.4-6.8-19.4.96-52.67-.49-105.31-3.54-157.9q-.04-.72.41-.16 7.96 10.07 15.43 20.44c9.11 12.64 13.61 28.98 15.78 44.21 4.96 34.71 3.75 72.94-5.97 106.5-1.97 6.82-9.18 10.93-15.31 6.31z","M1144.41 1147.33q-17.19-17.37-20.08-40.86-.89-7.22-.13-19.97 1.18-20.06 4.69-41.33c2.33-14.1 5.8-25.22 12.41-38.61q8.19-16.59 14.35-34.15a.14.13-37.7 01.26.03q1.01 15.71 1.26 31.44c.18 11.61-1.34 24.91-1.58 36.43-.72 34.7 1.22 62.05 2.06 93.19.17 6.32-1.1 26.1-13.24 13.83z","M1173.74 1161.73c6.88-2 14.34 3.23 11.98 10.91-2.24 7.3-4.78 14.44-5.99 21.96-5.07 31.52-8.04 63.18-14.13 94.6a.72.71-61.9 01-1.21.37c-.14-.14-.35-.39-.4-.59q-3.53-13.58-3.19-28.23 1.04-44.67 5.06-87.04c.58-6.1 1.93-10.25 7.88-11.98z","M1154.32 1165a1.58 1.57-84.6 01.97 1.18c.79 4.42 1.42 8.78 1.57 13.4.96 29.17-.47 62.66-2.04 90.23q-.78 13.79-1.39 19.52a.23.23 0 01-.45 0c-2.79-21.25-5.41-41.99-9.64-63.03-3.44-17.08-4.29-34.91-4.68-52.3-.19-8.37 8.99-11.61 15.66-9z"],
  ankles:["M998.25 1320.52c-4.62.24-8.17-1.08-8.78-6.28-1.6-13.81-.75-28.85-2.16-42.41q-.39-3.74.24-7.03a.69.69 0 011.23-.28c2.35 3.15 4.22 5.75 5.14 9.66 1.54 6.57 1.91 22.57 9.97 24.09q13.33 2.5 15.93-10.47c.92-4.57 1-12.33 5.05-17.25q.42-.51.42.15c.11 14.39.4 30.86-3.08 44.54-.79 3.13-3.31 4.23-6.51 4.4q-8.73.45-17.45.88z","M1149.5 1319.51c-6.93-.63-6.82-18.08-7.14-23.7q-.73-12.53-.59-25.09.01-.71.45-.15 2.74 3.49 3.29 7.17c1.67 11.25 3.21 25.34 19.7 19.99 4.87-1.58 7.03-18.57 7.89-23.21.79-4.2 2.74-7 5.28-10.13a.56.56 0 01.98.22c1.12 4.6.04 12.39-.37 17.26-.92 10.77-.32 21.48-1.52 32.37q-.7 6.23-7.01 6.18-12.13-.11-20.96-.91z","M1149.5 1319.51c-6.93-.63-6.82-18.08-7.14-23.7q-.73-12.53-.59-25.09.01-.71.45-.15 2.74 3.49 3.29 7.17c1.67 11.25 3.21 25.34 19.7 19.99 4.87-1.58 7.03-18.57 7.89-23.21.79-4.2 2.74-7 5.28-10.13a.56.56 0 01.98.22c1.12 4.6.04 12.39-.37 17.26-.92 10.77-.32 21.48-1.52 32.37q-.7 6.23-7.01 6.18-12.13-.11-20.96-.91z"],
  feet:["M962.87 1327.38q-.62-.51-.05-1.07l1.99-1.99q.39-.39.93-.41 25.66-.82 51.26 1 1.34.1 4.43 1.47.46.2.69.64 1.84 3.5 2.87 7.23c2.32 8.38-6.63 7.24-12.23 6.68q-15.37-1.53-30.5-4.56c-8.21-1.65-13.33-3.95-19.39-8.99z","M1154.35 1341.35c-12.48 1.36-13.27-3.88-8.67-13.37 1.82-3.76 12.72-3.65 16.39-3.77q19.44-.63 38.9-.44c2.41.02 3.31 1 4.61 2.76q.32.44-.09.79c-5.43 4.67-10.52 7.17-17.95 8.74q-16.46 3.47-33.19 5.29z","M1154.35 1341.35c-12.48 1.36-13.27-3.88-8.67-13.37 1.82-3.76 12.72-3.65 16.39-3.77q19.44-.63 38.9-.44c2.41.02 3.31 1 4.61 2.76q.32.44-.09.79c-5.43 4.67-10.52 7.17-17.95 8.74q-16.46 3.47-33.19 5.29z"],
  hands:["M789.41 726.84c3.98-6.79 9.89-14.6 16.56-20.14a.31.31 0 01.48.35c-4.39 11.06-5.38 21.94-14.02 30.72-5.82 5.93-10.7 9.81-19.04 8.57q-.55-.08-.59-.63c-.24-3.07-.26-7.29 3.1-8.85 4.82-2.26 10.72-5.28 13.51-10.02z","M807.27 745.31c17.61 3.49 2.75 13.52-.73 18.99q-10.05 15.82-21.86 30.37-1.56 1.92-2.52-.58a2.41 2.33-55.4 01-.16-.96q.2-5.26 2.75-9.71c6.94-12.09 13.12-24.52 19.72-36.79q.91-1.7 2.8-1.32z","M819.3 744.82c-7.79-6.06-14.51-12.4-11.88-23.38 3.07-12.83 14.66-20.7 25.14-26.38 9.57-5.18 37.61-.75 37.6 13.68q-.01 16.24-3.67 31.99c-2.38 10.26-4.49 16.44-16.87 16.3-10.71-.13-21.93-5.7-30.32-12.21z","M827.99 758.27a2.08 2.07 26.6 01.91 2.73q-10.47 22.03-19.66 45.04-2.25 5.63-8.23 6.74a1.45 1.44 84.3 01-1.7-1.4q-.1-4.29 1.51-8.31 7.3-18.34 13.86-36.96c.74-2.1 1.53-6.08 2.97-8.96q.26-.5.82-.57 5.05-.64 9.52 1.69z","M841.68 762.32a.76.75-79.1 01.6.89q-4.51 23.14-9.28 45.87c-.73 3.49-2.09 5.73-5.85 5.43q-.52-.04-.61-.56-.74-4.54-.32-7.21 2.89-18.57 5.59-37.18.38-2.65 1.67-8.22.13-.54.68-.44l7.52 1.42z","M854.75 799.53a.78.78 0 01-1.37-.02q-.91-1.75-1.15-4.29-1.62-16.58-1.2-33.25a.84.84 0 01.61-.78l7.09-1.93q.59-.16.56.45-.58 14.77-1.12 29.56c-.14 4.06-1.54 6.86-3.42 10.26z","M1336.39 751.96c-8.72 4.49-29.38 10.28-33.61-3.6q-5.68-18.65-5.83-38.24c-.06-7.59 4.01-11.75 11.09-14.08 8.85-2.92 19.02-5.3 27.54-.35 8.74 5.09 18.39 11.28 22.45 21.01 3.05 7.3 3.34 13.66-1.78 20.01-5.21 6.47-12.49 11.45-19.86 15.25z","M1374.32 737.5c-8.05-8.14-9.61-19.67-13.85-30.75a.22.22 0 01.35-.24q10.3 8.96 17.1 20.77c2.57 4.47 9.08 7.59 13.57 9.79 3.11 1.52 2.96 5.9 2.71 8.73q-.05.52-.57.59c-8.87 1.17-13.48-2.98-19.31-8.89z","M1383.76 795.45c-.59-.21-.96-.17-1.39-.68-8.84-10.3-15.85-21.5-23.44-32.41-2.81-4.02-8.81-7.64-7.45-13.14q.15-.6.7-.84l7.85-3.44q.66-.29 1.13.25 2.36 2.73 4.17 6.49 7.36 15.23 16.89 31.47c2.33 3.96 3.04 7.59 2.32 11.85a.58.58 0 01-.78.45z","M1365.79 812.62c-2.7-.28-6.42-2.66-7.49-5.33q-8.74-21.76-19.85-45.74c-2.12-4.58 6.55-5.17 9.12-5.21 1.8-.03 1.93.71 2.38 2.18q5.72 18.34 15.35 42.12c.74 1.84 4.81 12.43.49 11.98z","M1308.16 759.17l7.44 2.1q.23.07.24.31.75 16.26-.86 32.41-.3 3-1.25 5.48a.79.79 0 01-1.42.12q-3.9-6.58-3.82-13.9.16-13.07-.83-26.11-.05-.57.5-.41z","M1340.07 814.35c-2.7.82-4.99-1.16-5.54-3.71q-5.06-23.49-9.82-47.47a.77.76-10.7 01.62-.9l7.52-1.38q.59-.11.73.47c2.08 8.53 3.26 19.85 4.22 25.75q2.09 12.92 3.19 21.14.34 2.54-.33 5.46a.86.84 88.4 01-.59.64z","M1336.39 751.96c-8.72 4.49-29.38 10.28-33.61-3.6q-5.68-18.65-5.83-38.24c-.06-7.59 4.01-11.75 11.09-14.08 8.85-2.92 19.02-5.3 27.54-.35 8.74 5.09 18.39 11.28 22.45 21.01 3.05 7.3 3.34 13.66-1.78 20.01-5.21 6.47-12.49 11.45-19.86 15.25z","M1374.32 737.5c-8.05-8.14-9.61-19.67-13.85-30.75a.22.22 0 01.35-.24q10.3 8.96 17.1 20.77c2.57 4.47 9.08 7.59 13.57 9.79 3.11 1.52 2.96 5.9 2.71 8.73q-.05.52-.57.59c-8.87 1.17-13.48-2.98-19.31-8.89z","M1383.76 795.45c-.59-.21-.96-.17-1.39-.68-8.84-10.3-15.85-21.5-23.44-32.41-2.81-4.02-8.81-7.64-7.45-13.14q.15-.6.7-.84l7.85-3.44q.66-.29 1.13.25 2.36 2.73 4.17 6.49 7.36 15.23 16.89 31.47c2.33 3.96 3.04 7.59 2.32 11.85a.58.58 0 01-.78.45z","M1365.79 812.62c-2.7-.28-6.42-2.66-7.49-5.33q-8.74-21.76-19.85-45.74c-2.12-4.58 6.55-5.17 9.12-5.21 1.8-.03 1.93.71 2.38 2.18q5.72 18.34 15.35 42.12c.74 1.84 4.81 12.43.49 11.98z","M1308.16 759.17l7.44 2.1q.23.07.24.31.75 16.26-.86 32.41-.3 3-1.25 5.48a.79.79 0 01-1.42.12q-3.9-6.58-3.82-13.9.16-13.07-.83-26.11-.05-.57.5-.41z","M1340.07 814.35c-2.7.82-4.99-1.16-5.54-3.71q-5.06-23.49-9.82-47.47a.77.76-10.7 01.62-.9l7.52-1.38q.59-.11.73.47c2.08 8.53 3.26 19.85 4.22 25.75q2.09 12.92 3.19 21.14.34 2.54-.33 5.46a.86.84 88.4 01-.59.64z"],
  head:["M1028.14 166.45c1.03 5.06 1.36 9.61 6.41 11.53 13.06 4.95 16.74 15.51 23.52 27.48 1.387 2.447 3.863 3.623 7.43 3.53a910.025 910.025 0 0136.94-.25c6.23.09 9.27-7.55 11.48-12.3 4.31-9.27 10.37-15.83 20.28-18.94.333-.1.603-.287.81-.56 1.92-2.58 3.043-5.43 3.37-8.55l2.31-1.51a.977.977 0 01.99-.08c11.92 5.42-3.35 35.31-8.21 42.45-.761 1.11-2.423 1.028-3.06-.15l-1.26-2.32c-.133-.253-.32-.297-.56-.13-.34.24-.48.61-.42 1.11.86 7.64.75 16.87-2.96 23.31-.173.3.839.041-3.7 4.71-3.34 3.436-74.18 3.78-75.48-1.38a1.465 1.465 0 00-.55-.82c-4.15-2.97-6.07-7.95-6.16-12.39-.03-1.68.18-14.28-.53-14.63-.207-.1-.33-.037-.37.19-.3 1.553-1.183 2.597-2.65 3.13a.951.951 0 01-1.07-.32c-7.29-9.56-12.32-22.18-12.97-33.54-.34-6.04 1.797-9.23 6.41-9.57zm29.95 61.71c.173 14.187 18.967 14.703 19.1-1.37.03-4.05-.38-6.54-4.68-7.3-4.2-.75-11.87-1.47-13.85 2.91-.413.92-.603 2.84-.57 5.76zm31.71-3.35c.36 19.647 18.59 14.82 18.87 5.94.13-3.9 1.32-9.43-2.88-10.79-4.25-1.38-16.12-2.54-15.99 4.85z"],
  hair:["M1138.38 168.39q-.49 4.68-3.37 8.55-.31.41-.81.56c-9.91 3.11-15.97 9.67-20.28 18.94-2.21 4.75-5.25 12.39-11.48 12.3q-18.46-.25-36.94.25-5.35.14-7.43-3.53c-6.78-11.97-10.46-22.53-23.52-27.48-5.05-1.92-5.38-6.47-6.41-11.53q-6.64-26.16 4.43-48.88c8.13-16.7 34.61-21.41 51.58-21.04 4.89.11 9.69-.11 14.42.85 18.79 3.8 33.17 8.5 39.34 28.66q6.38 20.88.47 42.35z"],
};

const ANATOMY_VB_FRONT='0 95 727 1280';
const ANATOMY_VB_BACK='718 95 727 1280';

// Nom de muscle (tel qu'utilisé dans les données d'exercices) -> slug de la silhouette.
const MUSCLE_TO_ZONE={
  'Cou':'neck',
  'Épaules':'deltoids','Deltoïde antérieur':'frontDeltoid','Deltoïde latéral':'deltoids','Arrière épaules':'deltoids',
  'Pectoraux':'chest','Pectoraux haut':'upperChest','Pectoraux bas':'lowerChest',
  'Abdominaux':'abs','Transverse':'abs','Core':'abs','Obliques':'obliques',
  'Biceps':'biceps','Triceps':'triceps','Avant-bras':'forearm',
  'Dos':'upperBack','Grand dorsal':'upperBack','Trapèzes':'trapezius','Lombaires':'lowerBack',
  'Quadriceps':'quadriceps','Ischios':'hamstring','Adducteurs':'adductors',
  'Fessiers':'gluteal','Mollets':'calves'
};

const ANATOMY_STRENGTH_COLOR={primary:'var(--bad)',secondary:'var(--e)'};
function anatomyZonesFor(f){
  const zones=[];
  (f.primary||[]).forEach(m=>{ const k=MUSCLE_TO_ZONE[m]; if(k && !zones.find(z=>z.key===k)) zones.push({key:k,strength:'primary'}); });
  (f.secondary||[]).forEach(m=>{ const k=MUSCLE_TO_ZONE[m]; if(k && !zones.find(z=>z.key===k)) zones.push({key:k,strength:'secondary'}); });
  return {zones};
}
function bodyPartsSVGView(zoneInfo,PARTS,viewBox){
  const zoneMap={};
  zoneInfo.zones.forEach(z=>{ zoneMap[z.key]=z.strength; });
  let out='';
  Object.keys(PARTS).forEach(slug=>{
    let fill='var(--s3)';
    if(slug==='hair') fill='var(--card2)';
    else if(zoneMap[slug]) fill=ANATOMY_STRENGTH_COLOR[zoneMap[slug]];
    const opacity=zoneMap[slug]==='primary'?0.95:(zoneMap[slug]==='secondary'?0.8:1);
    PARTS[slug].forEach(d=>{ out+='<path d="'+d+'" fill="'+fill+'" opacity="'+opacity+'"/>'; });
  });
  return '<svg viewBox="'+viewBox+'" style="width:100%;display:block">'+out+'</svg>';
}
// Double silhouette face+dos côte à côte — toujours les deux vues, comme dans les apps premium.
function bodyAnatomyDualSVG(zoneInfo){
  const frontSVG=bodyPartsSVGView(zoneInfo,BODY_PARTS_FRONT,ANATOMY_VB_FRONT);
  const backSVG=bodyPartsSVGView(zoneInfo,BODY_PARTS_BACK,ANATOMY_VB_BACK);
  return '<div style="display:flex;gap:10px;align-items:flex-start">'+
    '<div style="flex:1;min-width:0;text-align:center"><div class="lab" style="margin-bottom:2px">'+t('frontViewLabel')+'</div>'+frontSVG+'</div>'+
    '<div style="flex:1;min-width:0;text-align:center"><div class="lab" style="margin-bottom:2px">'+t('backViewLabel')+'</div>'+backSVG+'</div>'+
    '</div>';
}

/* ===== CARTE DE CHALEUR MUSCULAIRE (stats muscu) =====
   Agrège l'historique réel des séances (MSESS[].muscles, posé par finishLive()) pour
   colorer la silhouette selon ce qui a été le plus sollicité, plutôt que primaire/
   secondaire d'un seul exercice (bodyAnatomyDualSVG ci-dessus, réutilisé tel quel). */
const ZONE_LABEL={neck:'Cou',deltoids:'Épaules',frontDeltoid:'Deltoïde antérieur',chest:'Pectoraux',upperChest:'Pectoraux haut',lowerChest:'Pectoraux bas',
  abs:'Abdominaux',obliques:'Obliques',biceps:'Biceps',triceps:'Triceps',forearm:'Avant-bras',
  upperBack:'Dos',trapezius:'Trapèzes',lowerBack:'Lombaires',
  quadriceps:'Quadriceps',hamstring:'Ischios',adductors:'Adducteurs',gluteal:'Fessiers',calves:'Mollets'};
function zoneLabel(slug){ return trMuscle(ZONE_LABEL[slug]||slug); }
function computeMuscleLoad(){
  const counts={};
  MSESS.forEach(s=>{
    const ms=s.muscles||[]; if(!ms.length) return;
    const per=(s.sets||ms.length)/ms.length;
    ms.forEach(m=>{ const z=MUSCLE_TO_ZONE[m]; if(z) counts[z]=(counts[z]||0)+per; });
  });
  return counts;
}
const HEAT_TIERS=['var(--e2)','var(--e)','var(--warn)','var(--bad)'];
function heatColorFor(v,max){
  if(!v||max<=0) return null;
  const r=v/max;
  const idx=Math.min(HEAT_TIERS.length-1,Math.floor(r*HEAT_TIERS.length));
  return {fill:HEAT_TIERS[idx],opacity:0.55+r*0.45};
}
function bodyHeatmapSVGView(counts,max,PARTS,viewBox){
  let out='';
  Object.keys(PARTS).forEach(slug=>{
    let fill='var(--s3)',opacity=1;
    if(slug==='hair') fill='var(--card2)';
    else { const c=heatColorFor(counts[slug],max); if(c){ fill=c.fill; opacity=c.opacity; } }
    PARTS[slug].forEach(d=>{ out+='<path d="'+d+'" fill="'+fill+'" opacity="'+opacity+'"/>'; });
  });
  return '<svg viewBox="'+viewBox+'" style="width:100%;display:block">'+out+'</svg>';
}
function bodyHeatmapCard(){
  const counts=computeMuscleLoad();
  const entries=Object.entries(counts);
  if(!entries.length) return '<div class="card"><div class="empty"><div class="em-ic">'+ICN('run',36,'currentColor')+'</div><div style="font-size:13px">'+t('noMuscleDataLab')+'</div></div></div>';
  const max=Math.max(...entries.map(e=>e[1]));
  const front=bodyHeatmapSVGView(counts,max,BODY_PARTS_FRONT,ANATOMY_VB_FRONT);
  const back=bodyHeatmapSVGView(counts,max,BODY_PARTS_BACK,ANATOMY_VB_BACK);
  const top=entries.sort((a,b)=>b[1]-a[1]).slice(0,3).map(e=>zoneLabel(e[0]));
  let h='<div class="card"><div class="card-t">'+t('muscleHeatmapTitle')+'</div>';
  h+='<div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:12px">'+
     '<div style="flex:1;min-width:0;text-align:center"><div class="lab" style="margin-bottom:2px">'+t('frontViewLabel')+'</div>'+front+'</div>'+
     '<div style="flex:1;min-width:0;text-align:center"><div class="lab" style="margin-bottom:2px">'+t('backViewLabel')+'</div>'+back+'</div>'+
     '</div>';
  h+='<div style="display:flex;align-items:center;gap:5px;justify-content:center;margin-bottom:10px">'+
     '<span style="font-size:10px;color:var(--muted)">'+t('lessLab')+'</span>'+
     ['var(--s3)'].concat(HEAT_TIERS).map(c=>'<span style="width:15px;height:8px;border-radius:3px;background:'+c+';display:inline-block"></span>').join('')+
     '<span style="font-size:10px;color:var(--muted)">'+t('moreLab')+'</span>'+
     '</div>';
  if(top.length) h+='<div style="font-size:12.5px;color:var(--muted);text-align:center">'+tp('mostTrainedLab',top.join(', '))+'</div>';
  h+='</div>';
  return h;
}

/* ===== VUE EXERCICE DÉTAILLÉE (onglets) ===== */
let exDetailTab='exo', exDetailCtx=null, exAnatomyView=null;
function openExDetail(progId,idx){
  exDetailCtx={progId,idx}; exDetailTab='exo'; exAnatomyView=null;
  renderExDetail();
}
function renderExDetail(){
  const p=allProgs().find(x=>x.id===exDetailCtx.progId); const e=p.ex[exDetailCtx.idx];
  const f=exMeta(e.name)||{primary:e.muscles||[],secondary:[],steps:[],tips:[],mistakes:[],safety:[],equip:'',level:''};
  $('#ovProgTitle').textContent=trExName(e.name);
  const g=exGif(e.name);
  let h='<div class="pills" style="margin-bottom:14px;overflow-x:auto;flex-wrap:nowrap;-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)">'+
    [['exo',t('exTabExercise')],['muscles',t('exTabMuscles')],['instr',t('exTabInstructions')]].map(tb=>'<div class="pill '+(exDetailTab===tb[0]?'on':'')+'" onclick="exDetailTab=\''+tb[0]+'\';renderExDetail()">'+tb[1]+'</div>').join('')+'</div>';
  if(exDetailTab==='exo'){
    // Média animé — démarre directement le tuto, sans bouton lecture/pause
    if(g){
      h+=exDemoMediaHTML(g,'16/11');
    } else {
      h+='<div style="background:linear-gradient(135deg,var(--s2),var(--s1));border:1px solid var(--hair);border-radius:16px;padding:36px;text-align:center;margin-bottom:14px"><div style="animation:demoFloat 1.5s infinite">'+exGlyph(e,64)+'</div></div>';
    }
    h+='<div class="card"><div class="card-t">'+t('aboutExerciseTitle')+'</div><div style="font-size:13px;color:var(--muted);line-height:1.55">'+tp('exWorksMainly',trExName(e.name),((f.primary||[]).map(trMuscle).join(', ')||t('severalMuscleGroups')))+(f.secondary&&f.secondary.length?tp('exWorksAlsoSecondary',f.secondary.map(trMuscle).join(', ')):'')+'.</div></div>';
    // Repos
    h+='<div class="card"><div class="row"><div class="row" style="gap:10px"><span style="color:var(--e2);display:flex">'+ICN('stopwatch',18)+'</span><div><div style="font-size:11px;color:var(--muted)">'+t('restBetweenSetsLabel')+'</div><div style="font-weight:700">'+(e.rest||90)+'s</div></div></div></div></div>';
    // mini stats
    const vol=(e.sets||3)*(parseInt(e.reps)||10)*(e.weight||0);
    h+='<div class="card" style="padding:0;overflow:hidden"><div style="display:flex;text-align:center"><div style="flex:1;padding:13px 4px;border-right:1px solid var(--hair)"><div class="lab" style="margin:0">'+t('setsCap')+'</div><div class="man" style="font-weight:800;font-size:18px">'+e.sets+'</div></div><div style="flex:1;padding:13px 4px;border-right:1px solid var(--hair)"><div class="lab" style="margin:0">'+t('volumeCap')+'</div><div class="man" style="font-weight:800;font-size:18px">'+vol+' kg</div></div><div style="flex:1;padding:13px 4px"><div class="lab" style="margin:0">'+t('durationCap')+'</div><div class="man" style="font-weight:800;font-size:18px">~'+Math.round(e.sets*1.8)+'min</div></div></div></div>';
  } else if(exDetailTab==='muscles'){
    const zoneInfo=anatomyZonesFor(f);
    h+='<div class="card"><div class="card-t">'+t('targetedMusclesTitle')+'</div>'+
       bodyAnatomyDualSVG(zoneInfo)+
       '</div>';
    h+='<div class="card">'+
       '<div class="row" style="gap:8px;margin-bottom:6px"><span style="width:9px;height:9px;border-radius:50%;background:var(--bad);flex:0 0 9px"></span><span style="font-weight:800;font-size:14px">'+t('primaryMusclesLabel')+'</span></div>'+
       '<div style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:'+(f.secondary&&f.secondary.length?'14px':'0')+'">'+((f.primary||[]).map(trMuscle).join(', ')||'—')+'</div>'+
       (f.secondary&&f.secondary.length?('<div class="row" style="gap:8px;margin-bottom:6px"><span style="width:9px;height:9px;border-radius:50%;background:var(--e);flex:0 0 9px"></span><span style="font-weight:800;font-size:14px">'+t('secondaryMusclesLabel')+'</span></div>'+
       '<div style="font-size:13px;color:var(--muted);line-height:1.6">'+f.secondary.map(trMuscle).join(', ')+'</div>'):'')+
       '</div>';
    if(f.equip) h+='<div class="card"><div class="row"><span class="lab">'+t('equipmentLabel')+'</span><span style="font-weight:600">'+trEquip(f.equip)+'</span></div></div>';
  } else {
    // Instructions + Conseils réunis dans le même onglet
    h+='<div class="card"><div class="card-t">'+ICN('clipboard',15,'var(--e)')+t('executionLabel')+'</div>'+((f.steps&&f.steps.length)?f.steps.map((s,i)=>'<div class="tip" style="margin-bottom:6px"><b style="color:var(--e)">'+(i+1)+'.</b> '+s+'</div>').join(''):'<div style="font-size:13px;color:var(--muted)">'+t('defaultExecutionHint')+'</div>')+'</div>';
    if(f.breathing) h+='<div class="card"><div class="card-t">'+ICN('lung',15,'var(--e)')+t('breathingLabel')+'</div><div class="tip">'+f.breathing+'</div></div>';
    if(f.tips&&f.tips.length) h+='<div class="card"><div class="card-t">'+ICN('check',15,'var(--e)')+t('adviceLabel')+'</div>'+f.tips.map(x=>'<div class="tip" style="margin-bottom:6px">'+x+'</div>').join('')+'</div>';
    if(f.mistakes&&f.mistakes.length) h+='<div class="card"><div class="card-t" style="color:var(--bad)">'+ICN('warning',15,'var(--e)')+t('commonMistakesLabel')+'</div>'+f.mistakes.map(x=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(255,92,108,.3);background:rgba(255,92,108,.08)">'+x+'</div>').join('')+'</div>';
    if(f.safety&&f.safety.length) h+='<div class="card"><div class="card-t">'+ICN('shield',15,'var(--e)')+t('safetyLabel')+'</div>'+f.safety.map(x=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(51,211,153,.3);background:rgba(51,211,153,.08)">'+x+'</div>').join('')+'</div>';
  }
  h+='<div class="row" style="gap:10px;margin-top:8px"><button class="btn ghost" onclick="openProg(\''+exDetailCtx.progId+'\')">‹ '+t('back')+'</button><button class="btn" onclick="startLive(\''+exDetailCtx.progId+'\','+exDetailCtx.idx+')">▶ '+t('startLabel')+'</button></div>';
  $('#progBody').innerHTML=h;
  openOv('ovProg');
  if(exDetailTab==='exo' && g){ startExDemoAuto(g); } else if(_exDemo2){ clearInterval(_exDemo2); _exDemo2=null; }
}
// Paire d'images superposées + fondu enchaîné (crossfade) entre les 2 frames de free-exercise-db,
// pour simuler le mouvement bien plus proprement qu'un remplacement brut de src (qui saccadait).
function exDemoImgPair(g){
  const onerr='onerror="this.closest(\'[data-exdemo]\').style.display=\'none\';var fb=document.getElementById(\'exDemoFallback\');if(fb)fb.style.display=\'block\'"';
  return '<img id="exDemoA" src="'+g[0]+'" '+onerr+' style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:1;transition:opacity .6s ease">'+
    '<img id="exDemoB" src="'+g[1]+'" '+onerr+' style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s ease">';
}
function exDemoMediaHTML(g,aspect){
  return '<div data-exdemo style="position:relative;background:var(--s2);border:1px solid var(--hair);border-radius:16px;overflow:hidden;margin-bottom:14px;aspect-ratio:'+aspect+'">'+exDemoImgPair(g)+'</div>';
}
let _exDemo2=null;
function startExDemoAuto(g){
  if(_exDemo2){ clearInterval(_exDemo2); _exDemo2=null; }
  g.forEach(s=>{const im=new Image();im.src=s;}); let showA=true;
  _exDemo2=setInterval(()=>{
    const a=$('#exDemoA'),b=$('#exDemoB'); if(!a||!b){clearInterval(_exDemo2);_exDemo2=null;return;}
    showA=!showA; a.style.opacity=showA?'1':'0'; b.style.opacity=showA?'0':'1';
  },900);
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
  clearInterval(liveTimer);
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
  // Le bouton minuteur était rendu vide (aucun contenu dans le span) : il occupait
  // sa place sans rien afficher, donc invisible et introuvable. Les deux actions
  // secondaires ont maintenant leur pictogramme et leur libellé accessible.
  let h='<div class="live-top">'+
    '<button class="live-ic" onclick="pauseLive()" aria-label="'+t('pauseLab')+'" title="'+t('pauseLab')+'">'+ICN('pause',17)+'</button>'+
    '<div style="flex:1"></div>'+
    '<button class="live-ic" onclick="openRest(90)" aria-label="'+t('restTimerBtn')+'" title="'+t('restTimerBtn')+'">'+ICN('stopwatch',17)+'</button>'+
    '<button class="btn sm" style="width:auto;padding:8px 18px;background:linear-gradient(135deg,var(--e),var(--e2))" onclick="finishLive()">'+t('liveFinishBtn')+'</button>'+
    '</div>';
  // Stats : Durée / Volume / Séries
  h+='<div class="card" style="padding:14px 6px;margin-bottom:16px"><div style="display:flex;text-align:center">'+
    '<div style="flex:1;border-right:1px solid var(--hair)"><div class="lab" style="margin:0 0 4px">'+t('durationLab')+'</div><div class="mono" id="liveTime" style="font-weight:800;font-size:16px;color:var(--e)">'+dur+'</div></div>'+
    '<div style="flex:1;border-right:1px solid var(--hair)"><div class="lab" style="margin:0 0 4px">'+t('volumeLab')+'</div><div style="font-weight:800;font-size:16px">'+Math.round(LIVE.tonnage)+' kg</div></div>'+
    '<div style="flex:1"><div class="lab" style="margin:0 0 4px">'+t('setsLab')+'</div><div style="font-weight:800;font-size:16px">'+LIVE.setsDone+'/'+totalSets+'</div></div>'+
    '</div></div>';
  // Une carte par exercice, repliée sur le nom par défaut — on tape dessus pour dérouler les séries.
  // Un seul exercice ouvert à la fois (accordéon), et tout est animé en douceur (transition CSS).
  p.ex.forEach((e,i)=>{
    const st=LIVE.state[i];
    const allDone=st.sets.length&&st.sets.every(x=>x);
    const open=liveOpenEx===i;
    // Swipe à gauche OU à droite pour révéler "Supprimer" — wrap + 2 actions rouges dessous, carte au-dessus qui glisse.
    h+='<div class="ex-swipe-wrap" data-i="'+i+'">'+
      '<div class="ex-swipe-action left" onclick="confirmDeleteLiveEx('+i+')"><span>'+ICN('trash',16)+'</span>'+t('deleteLab2')+'</div>'+
      '<div class="ex-swipe-action right" onclick="confirmDeleteLiveEx('+i+')"><span>'+ICN('trash',16)+'</span>'+t('deleteLab2')+'</div>';
    h+='<div class="card ex-swipe-card" data-i="'+i+'" style="padding:14px'+(allDone?';border-color:rgba(51,211,153,.35)':'')+'">';
    // Entête exercice (tapable) : vignette, nom, chevron, "..." (options)
    h+='<div class="row" style="align-items:flex-start;cursor:pointer" onclick="toggleLiveEx('+i+')">'+exThumb(e.name,48)+
      '<div style="flex:1;min-width:0;margin-left:10px"><div style="font-weight:700;font-size:15.5px;line-height:1.25">'+e.name+'</div>'+
      '<div style="font-size:11.5px;color:var(--muted);margin-top:2px">'+(allDone?t('exerciseDoneLab'):tp('setsDoneCount',st.sets.filter(Boolean).length,st.sets.length))+'</div></div>'+
      '<span id="exChev'+i+'" style="color:var(--muted);font-size:14px;padding:6px 4px;transition:transform .25s ease;transform:rotate('+(open?'180':'0')+'deg)">⌄</span>'+
      '<span onclick="event.stopPropagation();openLiveExOptions('+i+')" style="color:var(--muted);font-size:20px;padding:4px 4px 4px 8px;cursor:pointer;letter-spacing:1px">⋯</span></div>';
    // Contenu repliable : notes, repos, tableau des séries
    h+='<div id="exBody'+i+'" style="max-height:'+(open?'1400px':'0')+'px;opacity:'+(open?'1':'0')+';overflow:hidden;transition:max-height .32s ease,opacity .22s ease,margin-top .32s ease;margin-top:'+(open?'12':'0')+'px">';
    h+='<div class="live-rest" onclick="changeRest('+i+')">'+ICN('stopwatch',15)+'<span>'+tp('restTimerLab',e.rest?fmtRest(e.rest):t('disabledLab'))+'</span></div>';
    h+='<div style="display:grid;grid-template-columns:30px 64px 1fr 1fr 38px;gap:6px;font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;margin-bottom:8px;text-align:center">'+
      '<div>'+t('setCol')+'</div><div>'+t('prevCol')+'</div><div>'+t('kgCol')+'</div><div>'+t('repsCol')+'</div><div></div></div>';
    st.log.forEach((s,j)=>{
      h+='<div class="set-swipe-wrap" data-i="'+i+'" data-j="'+j+'">'+
        '<div class="set-swipe-action left" onclick="deleteLiveSet('+i+','+j+')"><span>'+ICN('trash',16)+'</span></div>'+
        '<div class="set-swipe-action right" onclick="deleteLiveSet('+i+','+j+')"><span>'+ICN('trash',16)+'</span></div>'+
        '<div class="set-swipe-row" data-i="'+i+'" data-j="'+j+'" style="display:grid;grid-template-columns:30px 64px 1fr 1fr 38px;gap:6px;align-items:center">'+
        '<div style="text-align:center;font-weight:700;color:var(--muted)">'+(j+1)+'</div>'+
        '<div style="text-align:center;font-size:11px;color:var(--dim)">'+(e.weight||20)+'kg×'+(parseInt(e.reps)||10)+'</div>'+
        '<input class="setcell" type="number" inputmode="decimal" value="'+s.kg+'" onchange="setLog('+i+','+j+',\'kg\',this.value)">'+
        '<input class="setcell" type="number" inputmode="numeric" value="'+s.reps+'" onchange="setLog('+i+','+j+',\'reps\',this.value)">'+
        '<div class="setcheck'+(s.done?' on':'')+'" onclick="toggleSet('+i+','+j+')">'+ICN('check',16)+'</div></div>'+
        '</div>'; // fin .set-swipe-wrap
    });
    h+='<button class="btn ghost sm" style="margin-top:4px" onclick="addLiveSet('+i+')">'+t('addSetBtn')+'</button>';
    h+='</div>'; // fin exBody
    h+='</div>'; // fin .ex-swipe-card
    h+='</div>'; // fin .ex-swipe-wrap
  });
  h+='<button class="btn ghost" style="margin:6px 0 10px" onclick="liveAddExercise()">'+t('addExerciseBtn')+'</button>';
  h+='<button class="btn ghost sm" style="margin-bottom:8px;color:var(--bad)" onclick="confirmCloseLive()">'+t('cancelSessionBtn')+'</button>';
  $('#liveBody').innerHTML=h;
  initLiveSwipe();
}
/* ---------- LIVE : swipe gauche/droite sur une carte exercice pour révéler "Supprimer" ---------- */
const SWIPE_W_EX=88, SWIPE_W_SET=64; // largeurs de la zone rouge révélée (carte exercice / ligne série)
const SWIPE_SEL='.ex-swipe-card, .set-swipe-row';
let liveSwipe={el:null,w:0,startX:0,startY:0,baseX:0,curX:0,dragging:false,scrollMode:false,scrollEl:null,lastY:0};
function initLiveSwipe(){
  const box=$('#liveBody'); if(!box||box._swipeBound) return;
  box._swipeBound=true;
  box.addEventListener('pointerdown',liveSwipeDown);
  box.addEventListener('pointermove',liveSwipeMove);
  box.addEventListener('pointerup',liveSwipeUp);
  box.addEventListener('pointercancel',liveSwipeUp);
}
function swipeWidthFor(el){ return el.classList.contains('ex-swipe-card')?SWIPE_W_EX:SWIPE_W_SET; }
// Appui long sur une carte exercice (pas une ligne de série) → la carte se
// "soulève" directement dans la liste (comme sur iOS) pour être glissée à
// la nouvelle place, sans quitter l'écran. Le minuteur est annulé dès qu'un
// swipe démarre (liveSwipeMove) ou dès que le doigt/souris se relève avant
// l'échéance.
const LONG_PRESS_MS=420;
let longPressTimer=null, liveSuppressClick=false;
function liveSwipeDown(e){
  const el=e.target.closest(SWIPE_SEL); if(!el) return;
  if(exDrag) return; // un glisser-déposer de réorganisation est déjà en cours
  // un swipe déjà ouvert ailleurs (carte OU ligne série) se referme dès qu'on touche un autre élément
  document.querySelectorAll(SWIPE_SEL+'.open').forEach(c=>{ if(c!==el) closeSwipeCard(c); });
  const w=swipeWidthFor(el);
  liveSwipe={el,w,startX:e.clientX,startY:e.clientY,
    baseX:el.classList.contains('open')?(el._openDir==='right'?w:-w):0,
    curX:0,dragging:false,scrollMode:false,scrollEl:null,lastY:e.clientY};
  clearTimeout(longPressTimer); longPressTimer=null; liveSuppressClick=false;
  if(el.classList.contains('ex-swipe-card') && !el.classList.contains('open')){
    const idx=+el.dataset.i, pointerId=e.pointerId, startY=e.clientY;
    longPressTimer=setTimeout(()=>{
      longPressTimer=null;
      if(liveSwipe.dragging||liveSwipe.scrollMode) return; // un swipe/scroll a démarré entre-temps : on annule
      liveSuppressClick=true;
      if(navigator.vibrate) try{ navigator.vibrate(12); }catch(_e){}
      startExDrag(idx,startY,pointerId);
    },LONG_PRESS_MS);
  }
}
function liveSwipeMove(e){
  if(exDrag) return; // la réorganisation directe gère elle-même ses propres pointermove
  const s=liveSwipe; if(!s.el) return;
  // Défilement manuel déjà engagé (la carte a touch-action:none, donc iOS ne fait plus
  // défiler tout seul) : on répercute nous-mêmes le déplacement du doigt sur la feuille.
  if(s.scrollMode){
    const dy=e.clientY-s.lastY; s.lastY=e.clientY;
    if(s.scrollEl) s.scrollEl.scrollTop-=dy;
    return;
  }
  const dx=e.clientX-s.startX, dy=e.clientY-s.startY;
  if(!s.dragging){
    if(Math.abs(dx)<6 && Math.abs(dy)<6) return;
    clearTimeout(longPressTimer); longPressTimer=null; // mouvement net → ce n'est plus un appui long
    if(Math.abs(dy)>Math.abs(dx)){
      // Mouvement vertical net avant la fin de l'appui long → l'utilisateur voulait
      // juste faire défiler la liste, pas réordonner. On prend nous-mêmes le relais du scroll.
      s.scrollMode=true; s.scrollEl=s.el.closest('.ov-card'); s.lastY=e.clientY;
      if(s.scrollEl) s.scrollEl.scrollTop-=dy;
      return;
    }
    s.dragging=true; s.el.classList.add('dragging'); s.el.setPointerCapture&&s.el.setPointerCapture(e.pointerId);
  }
  // dx est en pixels écran, s.w/baseX en pixels CSS : en mode simplifié (zoom)
  // les mélanger faisait filer la carte 16% plus vite que le doigt et faussait
  // le clamp sur la largeur de la zone révélée.
  let x=s.baseX+dx/uiZoomFactor();
  x=Math.max(-s.w,Math.min(s.w,x));
  s.curX=x;
  s.el.style.transform='translateX('+x+'px)';
}
function liveSwipeUp(e){
  if(exDrag) return;
  clearTimeout(longPressTimer); longPressTimer=null;
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
/* ---------- LIVE : réorganiser en glissant la carte directement (appui long) ----------
   Contrairement à un écran dédié, la carte se soulève et se déplace là où elle
   est affichée, exactement comme un reorder natif iOS/Android. Les autres
   cartes se poussent en douceur pour lui laisser la place, et tout redevient
   normal (renderLive) une fois le doigt relâché. */
let exDrag=null;
function startExDrag(idx,startY,pointerId){
  const box=$('#liveBody'); if(!box) return;
  // Une carte dépliée (accordéon ouvert) n'a pas la même hauteur que les autres :
  // on la replie d'abord pour que le calcul du glisser-déposer reste simple et fiable.
  if(liveOpenEx>=0){ liveOpenEx=-1; renderLive(); }
  const wraps=Array.from(box.querySelectorAll('.ex-swipe-wrap'));
  if(wraps.length<2 || idx<0 || idx>=wraps.length){ liveSuppressClick=false; return; }
  const rects=wraps.map(w=>w.getBoundingClientRect());
  const step=rects.length>1?(rects[1].top-rects[0].top):(rects[0].height+12);
  exDrag={idx,target:idx,wraps,step,startY};
  const w=wraps[idx];
  w.style.transition='none'; w.style.zIndex='30'; w.style.position='relative';
  w.style.boxShadow='0 16px 32px rgba(0,0,0,.5)'; w.style.opacity='.97';
  wraps.forEach((ww,k)=>{ if(k!==idx) ww.style.transition='transform .18s ease'; });
  window.addEventListener('pointermove',onExDragMove);
  window.addEventListener('pointerup',endExDrag);
  window.addEventListener('pointercancel',endExDrag);
}
function onExDragMove(e){
  const d=exDrag; if(!d) return;
  e.preventDefault&&e.preventDefault();
  const dy=e.clientY-d.startY;
  // dy et d.step viennent de coordonnées écran ; réappliqués en transform ils
  // repassent par le zoom du mode simplifié, d'où la division (voir uiZoomFactor).
  // Le calcul de l'index cible, lui, compare deux grandeurs écran : il reste juste.
  const z=uiZoomFactor();
  d.wraps[d.idx].style.transform='translateY('+(dy/z)+'px) scale(1.015)';
  let target=d.idx+Math.round(dy/d.step);
  target=Math.max(0,Math.min(d.wraps.length-1,target));
  if(target!==d.target){
    d.target=target;
    // Ordre visuel logique : la carte glissée occupe la position "target",
    // les autres gardent leur ordre relatif d'origine tout autour d'elle.
    const order=[]; for(let k=0;k<d.wraps.length;k++) if(k!==d.idx) order.push(k);
    order.splice(target,0,d.idx);
    order.forEach((origK,pos)=>{
      if(origK===d.idx) return;
      d.wraps[origK].style.transform='translateY('+((pos-origK)*d.step/z)+'px)';
    });
  }
}
function endExDrag(){
  const d=exDrag; if(!d) return;
  window.removeEventListener('pointermove',onExDragMove);
  window.removeEventListener('pointerup',endExDrag);
  window.removeEventListener('pointercancel',endExDrag);
  exDrag=null;
  const changed=d.target!==d.idx;
  if(changed){
    const ex=LIVE.prog.ex.splice(d.idx,1)[0]; LIVE.prog.ex.splice(d.target,0,ex);
    const st=LIVE.state.splice(d.idx,1)[0]; LIVE.state.splice(d.target,0,st);
    persistLive();
  }
  renderLive(); // repart d'un DOM propre (styles inline de drag effacés d'office)
  if(changed) toast(t('exercisesReordered'));
}
function toggleLiveEx(i){
  // Un appui long vient de lancer un glisser-déposer : le "click" qui suit le relâchement
  // du doigt ne doit pas en plus déplier/replier la carte.
  if(liveSuppressClick){ liveSuppressClick=false; return; }
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
// Plafonds larges mais réels (record du monde en deadlift ~500 kg, personne
// ne fait 100 répétitions d'une série de musculation) : sans ça, une valeur
// tapée par erreur ou en test (99999) gonflait le tonnage sans limite et
// débloquait instantanément le trophée "Force" (20 000 kg cumulés / semaine).
function setLog(i,j,k,v){
  const st=LIVE.state[i]; let n=+v||0;
  if(k==='kg') n=Math.min(500,Math.max(0,n));
  else if(k==='reps') n=Math.min(100,Math.max(0,Math.round(n)));
  st.log[j][k]=n; if(k==='kg')st.weight=n||st.weight; persistLive();
}
function changeRest(i){ const e=LIVE.prog.ex[i]; pickInt(t('restSeconds'),15,300,e.rest||90,'s',v=>{ e.rest=v; renderLive(); },15); }
function addLiveSet(i){ const st=LIVE.state[i]; const last=st.log[st.log.length-1]||{kg:20,reps:10,rpe:8}; st.sets.push(false); st.log.push({kg:last.kg,reps:last.reps,rpe:last.rpe,done:false}); persistLive(); renderLive(); }
function deleteLiveSet(i,j){
  const st=LIVE.state[i];
  if(st.log.length<=1){ toast(t('minOneSetRemain')); return; }
  st.sets.splice(j,1); st.log.splice(j,1);
  persistLive(); renderLive();
}

/* ---------- LIVE : options par exercice ("⋯") — voir la démo, modifier le repos, retirer ---------- */
function openLiveExOptions(i){
  const e=LIVE.prog.ex[i];
  const old=$('#liveExOptOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='liveExOptOv'; ov.style.zIndex=topZ();
  const g=exGif(e.name);
  let h='<div class="ov-card" style="text-align:center">';
  h+='<div class="card-t" style="justify-content:center;margin-bottom:14px">'+e.name+'</div>';
  if(g) h+='<img src="'+g[0]+'" style="width:100%;border-radius:14px;margin-bottom:14px;aspect-ratio:16/10;object-fit:cover">';
  h+='<button class="btn ghost" style="margin-bottom:8px" onclick="document.getElementById(\'liveExOptOv\').remove();changeRest('+i+')">'+t('changeRestLab')+'</button>';
  h+='<button class="btn ghost" style="margin-bottom:8px;color:var(--bad)" onclick="document.getElementById(\'liveExOptOv\').remove();confirmDeleteLiveEx('+i+')">'+t('removeExLab')+'</button>';
  h+='<button class="btn ghost" onclick="document.getElementById(\'liveExOptOv\').remove()">'+t('cancelLab')+'</button>';
  h+='</div>';
  ov.innerHTML=h;
  document.body.appendChild(ov);
}
function confirmDeleteLiveEx(i){
  if(LIVE.prog.ex.length<=1){ toast(t('minOneExRemain')); return; }
  const name=LIVE.prog.ex[i].name;
  const old=$('#delExOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='delExOv'; ov.style.zIndex=topZ();
  ov.innerHTML='<div class="ov-card" style="text-align:center">'+
    '<div class="card-t" style="justify-content:center;margin-bottom:10px">'+t('removeExConfirmTitle')+'</div>'+
    '<div style="font-size:13px;color:var(--muted);margin-bottom:18px">'+name+'</div>'+
    '<div class="row" style="gap:10px">'+
      '<button class="btn ghost" style="flex:1" onclick="document.getElementById(\'delExOv\').remove()">'+t('cancelLab')+'</button>'+
      '<button class="btn" style="flex:1;background:var(--bad)" onclick="doDeleteLiveEx('+i+')">'+t('removeLab2')+'</button>'+
    '</div></div>';
  document.body.appendChild(ov);
}
function doDeleteLiveEx(i){
  const o=$('#delExOv'); if(o) o.remove();
  LIVE.prog.ex.splice(i,1); LIVE.state.splice(i,1);
  if(LIVE.idx>=LIVE.prog.ex.length) LIVE.idx=Math.max(0,LIVE.prog.ex.length-1);
  if(liveOpenEx===i) liveOpenEx=-1; else if(liveOpenEx>i) liveOpenEx--;
  persistLive(); renderLive();
  toast(t('exerciseRemoved'));
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
    persistLive(); toast(t('exerciseAdded')); renderLive();
  });
}

function pauseLive(){
  clearInterval(liveTimer);
  LIVE.savedElapsed=Date.now()-LIVE.start;
  DB.save('live_paused',LIVE); DB.remove('live_active');
  closeOv('ovLive'); LIVE=null; toast(t('sessionSaved'));
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
  if(st.sets[setIdx]){ LIVE.setsDone++; LIVE.tonnage+=vol; openRest(st.log[setIdx].rest||LIVE.prog.ex[exIdx].rest||90); sfx('tick'); toast(t('xpGain')); }
  else { LIVE.setsDone--; LIVE.tonnage-=vol; }
  persistLive(); renderLive();
}
function openRest(secs){
  let sec=secs||90; const total=sec; const endAt=Date.now()+sec*1000;
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='restOv'; ov.style.zIndex=topZ();
  ov.innerHTML='<div class="ov-card" style="text-align:center"><div class="card-t" style="justify-content:center">'+t('restTitle')+'</div><div class="ring-wrap" style="width:170px;height:170px;margin:10px auto"><span id="restRing"></span><div class="ring-c"><div class="big mono" id="restNum" style="font-size:38px">'+sec+'</div><div class="sm">'+t('secLab')+'</div></div></div><div class="row" style="gap:10px"><button class="btn ghost" onclick="addRest(30)">'+t('add30sLab')+'</button><button class="btn" onclick="skipRest()">'+t('skipLab')+'</button></div></div>';
  document.body.appendChild(ov);
  let extra=0;
  function tick(){
    sec=Math.max(0,Math.round((endAt+extra*1000-Date.now())/1000));
    const rr=$('#restRing'); if(rr)rr.innerHTML=ringSVG(170,sec/(total+extra)*100,12,'var(--e)');
    const rn=$('#restNum'); if(rn)rn.textContent=sec;
    if(sec<=0){ sfx('tick'); skipRest(); return; }
  }
  tick();
  restTimer=setInterval(tick,250);
  window._restAdd=(s)=>{ extra+=s; };
}
function addRest(s){ if(window._restAdd)window._restAdd(s); }
function skipRest(){ clearInterval(restTimer); const o=$('#restOv'); if(o)o.remove(); }
function confirmCloseLive(){
  // Popup "maison" à la place de confirm() natif, qui ne fonctionne pas dans une app ajoutée à l'écran d'accueil (iOS)
  const old=$('#cancelLiveOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.className='ov on'; ov.id='cancelLiveOv'; ov.style.zIndex=topZ();
  ov.innerHTML='<div class="ov-card" style="text-align:center">'+
    '<div class="card-t" style="justify-content:center;margin-bottom:10px">'+t('cancelSessionTitle')+'</div>'+
    '<div style="font-size:13px;color:var(--muted);margin-bottom:18px">'+t('progressLostText')+'</div>'+
    '<div class="row" style="gap:10px">'+
      '<button class="btn ghost" style="flex:1" onclick="document.getElementById(\'cancelLiveOv\').remove()">'+t('continueLab2')+'</button>'+
      '<button class="btn" style="flex:1;background:var(--bad)" onclick="doCancelLive()">'+t('yesCancelLab')+'</button>'+
    '</div></div>';
  document.body.appendChild(ov);
}
function doCancelLive(){
  const ov=$('#cancelLiveOv'); if(ov) ov.remove();
  const eo=$('#liveExOptOv'); if(eo) eo.remove();
  const de=$('#delExOv'); if(de) de.remove();
  clearInterval(liveTimer); clearInterval(restTimer); skipRest();
  LIVE=null; DB.remove('live_active'); DB.remove('live_paused');
  closeOv('ovLive'); stopBgActivity(); toast(t('sessionCancelled')); renderSport();
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
  MSESS.push({date:todayKey(),progName:LIVE.prog.name,tonnage:LIVE.tonnage,sets:LIVE.setsDone,reps:totalReps,duration:Math.round(dur/60),calories:cal,muscles:Object.keys(muscles)});
  // Historique par exercice (pour les graphiques de progression)
  if(!PREFS.exHist) PREFS.exHist={};
  LIVE.prog.ex.forEach((e,i)=>{ const st=LIVE.state[i]; if(st.sets.some(Boolean)){
    const vol=(st.log||[]).reduce((a,s)=>a+(s.done?(s.kg||0)*(s.reps||0):0),0);
    if(vol>0){ if(!PREFS.exHist[e.name])PREFS.exHist[e.name]=[]; PREFS.exHist[e.name].push({date:todayKey(),vol}); PREFS.exHist[e.name]=PREFS.exHist[e.name].slice(-30); }
  }});
  DB.remove('live_active');
  saveAll(); refreshXP({animate:true}); burst(); sfx('finish'); stopBgActivity();
  let h='<div class="popin" style="text-align:center;padding:6px 0"><div style="display:flex;justify-content:center">'+ICN('medal',50,'var(--or)')+'</div><div class="man" style="font-weight:800;font-size:22px;margin:8px 0">'+t('sessionDoneTitle')+'</div></div>';
  h+='<div class="sgrid" style="margin-bottom:12px"><div class="sbox"><div class="v">'+Math.round(LIVE.tonnage)+'</div><div class="l">'+t('tonnageParenKg')+'</div></div><div class="sbox"><div class="v">'+fmtTime(dur)+'</div><div class="l">'+t('durationLab')+'</div></div><div class="sbox"><div class="v">'+LIVE.setsDone+'</div><div class="l">'+t('setsLab')+'</div></div><div class="sbox"><div class="v">'+totalReps+'</div><div class="l">'+t('repsLab')+'</div></div><div class="sbox"><div class="v">'+cal+'</div><div class="l">'+t('caloriesLab')+'</div></div><div class="sbox"><div class="v" style="color:var(--or)">'+prs.length+'</div><div class="l">'+t('recordsBrokenLab')+'</div></div></div>';
  // progression
  if(prevTon){ const diff=Math.round(LIVE.tonnage-prevTon); const up=diff>=0;
    h+='<div class="tip" style="margin-bottom:12px;'+(up?'border-color:rgba(51,211,153,.3);background:rgba(51,211,153,.08)':'')+'">'+(up?'+':'')+diff+' kg '+tp('tonnageVsLastLab',LIVE.prog.name)+'</div>'; }
  // PR
  if(prs.length) h+='<div class="card-t">'+t('newRecordsLab')+'</div>'+prs.map(p=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(242,184,75,.4);background:rgba(242,184,75,.1)">'+p+'</div>').join('');
  // muscles schema
  if(Object.keys(muscles).length){ h+='<div class="card-t" style="margin-top:12px">'+t('musclesWorkedLab')+'</div><div class="muscle-tags" style="margin-bottom:12px">'+Object.keys(muscles).map(m=>'<span class="mtag" style="background:var(--ed);color:var(--e);border-color:var(--e)">'+m+'</span>').join('')+'</div>'; }
  h+='<div class="badge" style="width:100%;justify-content:center;padding:14px;margin:6px 0 14px">'+t('xpEarnedLab')+'</div>';
  h+='<button class="btn" onclick="closeOv(\'ovLive\');LIVE=null;renderSport()">'+t('closeLab')+'</button>';
  $('#liveBody').innerHTML=h;
}

/* ---------- CREATE PROGRAM ---------- */
let newProg=null,libFilter='Tous',libCallback=null;
const PROG_ICONS=['arms','dumbbell','fire','bolt','back','target','medal','legs','abs','run'];
const PROG_COLORS=[['--e','colBlue'],['--bad','colRed'],['--ok','colGreen'],['--or','colGold'],['--maitre','colPurple'],['--diamant','colCyan']];
function openCreate(){
  newProg={name:'',description:'',objective:'Masse',color:'--e',icon:'arms',ex:[]};
  renderCreate(); openOv('ovCreate');
}
function renderCreate(){
  let h='<div class="field"><label>'+t('programNameLab')+'</label><input class="inp" id="npName" value="'+escHtml(newProg.name||'')+'" oninput="newProg.name=this.value" placeholder="'+t('programNamePh')+'"></div>';
  h+='<div class="field"><label>'+t('descriptionLab')+'</label><textarea class="inp" rows="2" oninput="newProg.description=this.value" placeholder="'+t('descriptionPh')+'">'+escHtml(newProg.description||'')+'</textarea></div>';
  h+='<div class="field"><label>'+t('objectiveLab2')+'</label><div class="pills">'+[['Force','objForce'],['Masse','objMass'],['Endurance','objEndurance'],['Perte poids','objWeightLoss'],['Maintien','objMaintain']].map(o=>'<div class="pill '+(newProg.objective===o[0]?'on':'')+'" onclick="newProg.objective=\''+o[0]+'\';renderCreate()">'+t(o[1])+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('iconLab')+'</label><div class="pills">'+PROG_ICONS.map(ic=>'<div class="pill '+(newProg.icon===ic?'on':'')+'" onclick="newProg.icon=\''+ic+'\';renderCreate()">'+ICN(ic,18)+'</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('colorLab')+'</label><div class="pills">'+PROG_COLORS.map(c=>'<div class="pill '+(newProg.color===c[0]?'on':'')+'" onclick="newProg.color=\''+c[0]+'\';renderCreate()"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var('+c[0]+');margin-right:6px"></span>'+t(c[1])+'</div>').join('')+'</div></div>';
  h+='<div class="lab" style="margin:10px 0 8px">'+tp('exercisesCountLab',newProg.ex.length)+'</div>';
  if(!newProg.ex.length) h+='<div class="tip" style="margin-bottom:12px">'+t('addExFromLib')+'</div>';
  newProg.ex.forEach((e,i)=>{
    h+='<div class="card" style="margin-bottom:8px;padding:12px"><div class="row"><div class="row" style="gap:8px"><span style="font-size:22px">'+e.anim+'</span><div><div style="font-weight:700;font-size:14px">'+e.name+'</div><div class="mono" style="font-size:12px;color:var(--e)">'+e.sets+'×'+e.reps+(e.rest?' · '+e.rest+'s':'')+'</div></div></div><button class="x" onclick="newProg.ex.splice('+i+',1);renderCreate()">'+ICN('trash',16)+'</button></div></div>';
  });
  h+='<button class="btn ghost" style="margin-bottom:12px" onclick="openLibFor(addToNewProg)">'+t('addFromLibBtn')+'</button>';
  h+='<button class="btn" onclick="saveNewProg()">'+t('saveProgramBtn')+'</button>';
  $('#createBody').innerHTML=h;
}
function addToNewProg(e){ closeOv('ovLib'); openCfg(e,(cfg)=>{ newProg.ex.push(cfg); renderCreate(); openOv('ovCreate'); }); }
function saveNewProg(){
  if(!newProg.name.trim()){ toast(t('giveNameLab')); return; }
  if(!newProg.ex.length){ toast(t('addExercisesLab')); return; }
  CUSTOM.push({id:'C'+Date.now(),kind:'muscu',name:newProg.name,description:newProg.description,objective:newProg.objective,color:newProg.color,icon:newProg.icon,ex:newProg.ex});
  saveAll(); closeOv('ovCreate'); renderSport(); toast(t('programCreated'));
}

/* ---------- BIBLIOTHÈQUE PREMIUM ---------- */
let libFilterEquip='Tous', libFilterLevel='Tous', libSearch='', libBrowseMode=false;
let _libFromCreate=false;
function openLibFor(cb){ libCallback=cb; libBrowseMode=false; _libFromCreate=(cb===addToNewProg); closeOv('ovCreate'); renderLib(); openOv('ovLib'); }
function openLibBrowse(){ libCallback=null; libBrowseMode=true; renderLib(); openOv('ovLib'); }
let libView='grid';
function renderLib(){
  let h='<input class="inp" style="margin-bottom:14px" placeholder="'+t('searchExercisePlaceholder')+'" value="'+escHtml(libSearch||'')+'" oninput="libSearch=this.value;renderLib();this.focus()">';
  // Tuiles muscle en photo — navigation visuelle rapide, comme une planche anatomique
  h+='<div class="lab" style="margin-bottom:8px">'+t('muscleLabel')+'</div><div class="mtile-row">'+MUSCLE_GROUPS.map(m=>{
    const img=muscleRepImg(m); const on=libFilter===m;
    return '<div class="mtile '+(on?'on':'')+'" onclick="libFilter=\''+m+'\';renderLib()"><div class="mtile-img" '+(img?'style="background-image:url(\''+img+'\')"':'')+'>'+(img?'':ICN(MUSCLE_ICONS[m]||'dumbbell',24,'var(--e)'))+'</div><div class="mtile-lab">'+(m==='Tous'?t('filterAll'):trMuscle(m))+'</div></div>';
  }).join('')+'</div>';
  h+='<div class="lab" style="margin-bottom:6px">'+t('equipmentLabel')+'</div><div class="pills" style="margin-bottom:10px;overflow-x:auto;flex-wrap:nowrap;padding-bottom:4px;-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)">'+EQUIPMENT.map(m=>'<div class="pill '+(libFilterEquip===m?'on':'')+'" onclick="libFilterEquip=\''+m+'\';renderLib()">'+(m==='Tous'?t('filterAll'):trEquip(m))+'</div>').join('')+'</div>';
  h+='<div class="lab" style="margin-bottom:6px">'+t('levelLabel')+'</div><div class="pills" style="margin-bottom:14px">'+['Tous',...LEVELS].map(m=>'<div class="pill '+(libFilterLevel===m?'on':'')+'" onclick="libFilterLevel=\''+m+'\';renderLib()">'+(m==='Tous'?t('filterAll'):trLevel(m))+'</div>').join('')+'</div>';
  const q=libSearch.toLowerCase().trim();
  const list=allExercises().filter(e=>{
    if(libFilter!=='Tous' && e.group!==libFilter && !(e.primary||[]).some(m=>m.includes(libFilter)||libFilter.includes(m))) return false;
    if(libFilterEquip!=='Tous' && e.equip!==libFilterEquip) return false;
    if(libFilterLevel!=='Tous' && e.level!==libFilterLevel) return false;
    if(q && !e.name.toLowerCase().includes(q) && !trExName(e.name).toLowerCase().includes(q)) return false;
    return true;
  });
  h+='<div class="row" style="margin-bottom:8px"><div class="lab" style="flex:1">'+list.length+' '+(list.length>1?t('exercisesWordPlural'):t('exerciseWordSingular'))+'</div><div style="display:flex;gap:6px"><span class="mini-ic" style="'+(libView==='grid'?'color:var(--e);border-color:var(--e)':'')+'" onclick="libView=\'grid\';renderLib()">▦</span><span class="mini-ic" style="'+(libView==='list'?'color:var(--e);border-color:var(--e)':'')+'" onclick="libView=\'list\';renderLib()"></span></div></div>';
  if(libView==='grid'){
    h+='<div class="exg-grid">';
    list.forEach(e=>{
      const nm=e.name.replace(/"/g,'&quot;'); const g=exGif(e.name); const lvCol=e.level==='Débutant'?'--ok':e.level==='Avancé'?'--bad':'--warn';
      h+='<div class="exg-card" onclick=\'openFiche("'+nm+'")\'>'+
        '<div class="exg-img" '+(g?'style="background-image:url(\''+g[0]+'\')"':'')+'>'+(g?'':'<span style="display:inline-flex">'+exGlyph(e,22)+'</span>')+
        (libBrowseMode?'':'<span class="exg-add" onclick=\'event.stopPropagation();pickEx("'+nm+'")\'>＋</span>')+
        '</div><div class="exg-body"><div class="exg-name">'+trExName(e.name)+'</div><div class="exg-sub">'+trEquip(e.equip)+' · <span style="color:var('+lvCol+')">'+trLevel(e.level)+'</span></div></div></div>';
    });
    h+='</div>';
  } else {
  list.forEach(e=>{
    const lvCol=e.level==='Débutant'?'--ok':e.level==='Avancé'?'--bad':'--warn';
    h+='<div class="card" style="margin-bottom:8px;padding:12px"><div class="row"><div class="row" style="gap:10px;flex:1;cursor:pointer" onclick=\'openFiche("'+e.name.replace(/"/g,'&quot;')+'")\'>'+exThumb(e.name,48)+'<div><div style="font-weight:700;font-size:14px">'+trExName(e.name)+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px">'+trEquip(e.equip)+' · <span style="color:var('+lvCol+')">'+trLevel(e.level)+'</span></div><div class="muscle-tags">'+(e.primary||[]).map(m=>'<span class="mtag">'+trMuscle(m)+'</span>').join('')+'</div></div></div>'+(libBrowseMode?'<button class="x" onclick=\'openFiche("'+e.name.replace(/"/g,'&quot;')+'")\'>›</button>':'<button class="x" style="color:var(--e)" onclick=\'pickEx("'+e.name.replace(/"/g,'&quot;')+'")\'>＋</button>')+'</div></div>';
  });
  }
  $('#libBody').innerHTML=h;
}
function pickEx(name){ const e=findEx(name); if(libCallback) libCallback(e); else openFiche(name); }
/* Fiche tutoriel complète */
function openFiche(name){
  const f=exMeta(name); if(!f) return;
  const lvCol=f.level==='Débutant'?'--ok':f.level==='Avancé'?'--bad':'--warn';
  let h='<div style="text-align:center;margin-bottom:14px"><div style="animation:popIn .5s">'+exGlyph(f,64)+'</div><div class="man" style="font-weight:800;font-size:20px;margin-top:4px">'+trExName(f.name)+'</div><div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap"><span class="badge">'+trEquip(f.equip)+'</span><span class="badge" style="background:var(--ed);color:var('+lvCol+')">'+trLevel(f.level)+'</span></div></div>';
  // visuel animé (placeholder élégant simulant un GIF/avatar)
  if(f.gif){
    // Démonstration animée réelle (2 frames alternées = mouvement)
    h+='<div data-exdemo style="position:relative;background:var(--s2);border:1px solid var(--hair);border-radius:18px;overflow:hidden;margin-bottom:14px;aspect-ratio:5/4">'+
      exDemoImgPair(f.gif)+
      '<div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.7));padding:10px 12px 8px;display:flex;align-items:center;gap:6px;font-size:11px;color:#fff;font-weight:700;z-index:1"><span style="width:7px;height:7px;border-radius:50%;background:var(--e);animation:demoPulse 1s infinite"></span>'+t('movementDemoCap')+'</div></div>';
    h+='<div id="exDemoFallback" style="display:none;position:relative;background:linear-gradient(135deg,var(--s2),var(--s1));border:1px solid var(--hair);border-radius:18px;padding:34px 16px;text-align:center;margin-bottom:14px"><div style="animation:demoFloat 1.5s ease-in-out infinite">'+exGlyph(f,68)+'</div><div style="font-size:11px;color:var(--dim);margin-top:8px">'+t('movementDemo')+'</div></div>';
    startExDemo(f.gif);
  } else {
    h+='<div style="position:relative;background:linear-gradient(135deg,var(--s2),var(--s1));border:1px solid var(--hair);border-radius:18px;padding:34px 16px;text-align:center;margin-bottom:14px;overflow:hidden">'+
      '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,var(--ed),transparent 70%)"></div>'+
      '<div style="position:relative;animation:demoFloat 1.5s ease-in-out infinite;filter:drop-shadow(0 6px 14px rgba(0,0,0,.4))">'+exGlyph(f,68)+'</div>'+
      '<div style="position:relative;display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--e);font-weight:700"><span style="width:7px;height:7px;border-radius:50%;background:var(--e);animation:demoPulse 1s infinite"></span>'+t('movementDemoCap')+'</div></div>';
  }
  h+='<div class="card-t">'+ICN('target',15,'var(--e)')+t('musclesWorked')+'</div><div style="margin-bottom:12px"><div style="font-size:12px;color:var(--muted);margin-bottom:4px">'+t('primaryLabel')+'</div><div class="muscle-tags">'+(f.primary||[]).map(m=>'<span class="mtag" style="background:var(--ed);color:var(--e);border-color:var(--e)">'+trMuscle(m)+'</span>').join('')+'</div>'+((f.secondary&&f.secondary.length)?'<div style="font-size:12px;color:var(--muted);margin:8px 0 4px">'+t('secondaryLabel')+'</div><div class="muscle-tags">'+f.secondary.map(m=>'<span class="mtag">'+trMuscle(m)+'</span>').join('')+'</div>':'')+'</div>';
  h+='<div class="card-t">'+ICN('clipboard',15,'var(--e)')+t('stepByStepExecution')+'</div>'+f.steps.map((s,i)=>'<div class="tip" style="margin-bottom:6px"><b style="color:var(--e)">'+(i+1)+'.</b> '+s+'</div>').join('');
  h+='<div class="card-t" style="margin-top:14px">'+ICN('lung',15,'var(--e)')+t('breathingLabel')+'</div><div class="tip">'+f.breathing+'</div>';
  h+='<div class="card-t" style="margin-top:14px;color:var(--bad)">'+ICN('warning',15,'var(--e)')+t('commonMistakesLabel')+'</div>'+f.mistakes.map(m=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(255,92,108,.3);background:rgba(255,92,108,.08)">'+m+'</div>').join('');
  h+='<div class="card-t" style="margin-top:14px">'+ICN('check',15,'var(--e)')+t('coachTipsLabel')+'</div>'+f.tips.map(tt=>'<div class="tip" style="margin-bottom:6px">'+tt+'</div>').join('');
  h+='<div class="card-t" style="margin-top:14px">'+ICN('shield',15,'var(--e)')+t('safetyLabel')+'</div>'+f.safety.map(s=>'<div class="tip" style="margin-bottom:6px;border-color:rgba(51,211,153,.3);background:rgba(51,211,153,.08)">'+s+'</div>').join('');
  if(f.variants&&f.variants.length){ h+='<div class="card-t" style="margin-top:14px">'+ICN('refresh',15,'var(--e)')+t('variantsLabel')+'</div><div class="pills">'+f.variants.map(v=>'<div class="pill" onclick=\'openFiche("'+v.replace(/"/g,'&quot;')+'")\'>'+trExName(v)+'</div>').join('')+'</div>'; }
  if(libCallback) h+='<button class="btn" style="margin-top:18px" onclick=\'pickEx("'+f.name.replace(/"/g,'&quot;')+'")\'>＋ '+t('addToProgram')+'</button>';
  $('#libBody').innerHTML=h;
}
let _exDemoTimer=null;
function startExDemo(frames){
  clearInterval(_exDemoTimer);
  // précharge les 2 images
  frames.forEach(src=>{ const im=new Image(); im.src=src; });
  let showA=true;
  _exDemoTimer=setInterval(()=>{
    const a=document.getElementById('exDemoA'),b=document.getElementById('exDemoB');
    if(!a||!b){ clearInterval(_exDemoTimer); return; }
    showA=!showA; a.style.opacity=showA?'1':'0'; b.style.opacity=showA?'0':'1';
  },900);
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
  let h='<div style="text-align:center;margin-bottom:14px"><span style="display:inline-flex">'+exGlyph(s,40)+'</span><div class="man" style="font-weight:800;font-size:18px;margin-top:4px">'+escHtml(trExName(s.name))+'</div></div>';
  h+='<div class="field"><label>'+t('setsLab')+'</label><div class="stepper"><button onclick="cfgAdj(\'sets\',-1)">−</button><span class="val" id="cfSets">'+s.sets+'</span><button onclick="cfgAdj(\'sets\',1)">+</button></div></div>';
  h+='<div class="field"><label>'+t('repsLab')+'</label><div class="pills" style="margin-bottom:8px">'+['6','8','10','12','15'].map(r=>'<div class="pill '+(s.reps===r&&!s.amrap?'on':'')+'" onclick="cfgState.reps=\''+r+'\';cfgState.amrap=false;renderCfg()">'+r+'</div>').join('')+'<div class="pill '+(s.amrap?'on':'')+'" onclick="cfgState.amrap=true;cfgState.reps=\'AMRAP\';renderCfg()">AMRAP</div></div></div>';
  h+='<div class="field"><label>'+t('loadKgLab')+'</label><div class="stepper"><button onclick="cfgAdj(\'weight\',-2.5)">−</button><button onclick="cfgAdj(\'weight\',-5)" style="font-size:12px">−5</button><span class="val" id="cfW">'+s.weight+'</span><button onclick="cfgAdj(\'weight\',5)" style="font-size:12px">+5</button><button onclick="cfgAdj(\'weight\',2.5)">+</button></div><div class="pills" style="margin-top:8px">'+[20,40,60,80,100].map(w=>'<div class="pill" onclick="cfgState.weight='+w+';renderCfg()">'+w+'kg</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('restLab2')+'</label><div class="pills">'+[60,90,120,180].map(r=>'<div class="pill '+(s.rest===r?'on':'')+'" onclick="cfgState.rest='+r+';renderCfg()">'+r+'s</div>').join('')+'</div></div>';
  h+='<div class="field"><label>'+t('personalNotesLab')+'</label><textarea class="inp" rows="2" oninput="cfgState.note=this.value" placeholder="'+t('notesPh')+'">'+escHtml(s.note||'')+'</textarea></div>';
  h+='<button class="btn" onclick="saveCfg()">'+t('add')+'</button>';
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
function statsSegHTML(){
  return '<div class="seg-ctrl">'+
    [['bilan',t('tabBilan')],['run',t('tabRun')],['muscu',t('tabMuscu')],['medals',t('tabTrophies')]].map(tt=>'<div class="seg-btn'+(statsTab===tt[0]?' on':'')+'" onclick="statsTab=\''+tt[0]+'\';renderStats()">'+tt[1]+'</div>').join('')+
  '</div>';
}
/* ---------- SKELETON SCREENS — Statistiques ----------
   L'onglet Stats est celui qui recalcule le plus de données (kilométrage,
   tendances, heatmap 13 semaines, prédictions...) à partir de TOUT l'historique
   (SESS/MSESS), ce qui peut prendre un temps perceptible dès que l'historique
   grossit. Plutôt qu'un simple fondu ou un écran figé le temps du calcul, on
   affiche immédiatement un gabarit grisé qui préfigure la mise en page réelle
   de l'onglet visé, puis on échange avec le vrai contenu dès qu'il est prêt. */
function sklBilan(){
  return '<div class="skl skl-seg"></div>'+
    '<div class="skl skl-seg" style="height:34px;margin-bottom:14px"></div>'+
    '<div class="skl skl-kchart"></div>'+
    '<div class="skl skl-kchart tall"></div>'+
    '<div class="skl-duo"><div class="skl"></div><div class="skl"></div></div>'+
    '<div class="skl-row3"><div class="skl"></div><div class="skl"></div><div class="skl"></div></div>'+
    '<div class="skl skl-heat"></div>';
}
function sklRun(){
  return '<div class="skl skl-seg"></div>'+
    '<div class="skl-row4"><div class="skl"></div><div class="skl"></div><div class="skl"></div><div class="skl"></div></div>'+
    '<div class="skl-card"><div class="skl skl-line w70"></div><div class="skl skl-line"></div><div class="skl skl-line"></div><div class="skl skl-line w50"></div></div>'+
    '<div class="skl-card"><div class="skl skl-line w70"></div><div class="skl skl-line"></div><div class="skl skl-line"></div></div>';
}
function sklMuscu(){
  return '<div class="skl skl-seg"></div>'+
    '<div class="skl-row3"><div class="skl"></div><div class="skl"></div><div class="skl"></div></div>'+
    '<div class="skl-card"><div class="skl skl-line w70"></div><div class="skl skl-line"></div><div class="skl skl-line"></div><div class="skl skl-line w50"></div></div>';
}
function sklMedals(){
  return '<div class="skl skl-seg"></div>'+
    '<div class="skl-row3"><div class="skl"></div><div class="skl"></div><div class="skl"></div></div>'+
    '<div class="skl-row3"><div class="skl"></div><div class="skl"></div><div class="skl"></div></div>';
}
const STATS_SKELETONS={bilan:sklBilan,run:sklRun,muscu:sklMuscu,medals:sklMedals};
/* ---------- STATS — version Mode simplifié ----------
   Contrairement à l'onglet Stats complet (4 sous-onglets, graphiques,
   heatmap 13 semaines...), cette version reprend l'esprit "essentiel
   seulement" déjà utilisé par renderHomeSimple/renderProfileSimple :
   4 gros chiffres, un point rapide sur la semaine en cours, et un aperçu
   des badges avec un lien vers la galerie complète. */
function renderStatsSimple(){
  let h='';
  const km=totalKm(), sess=totalSessions(), vdot=getUserVDOT(), streak=streakDays();
  h+='<div class="stat-quatro" style="margin-top:2px;flex-wrap:wrap">'+
    '<div class="card stat-card" style="flex:1 1 40%"><div class="stat-ic">'+ICN('road',16)+'</div><div class="stat-v">'+Math.round(km)+'</div><div class="stat-l">'+t('kmTotalLab')+'</div></div>'+
    '<div class="card stat-card" style="flex:1 1 40%"><div class="stat-ic">'+ICN('medal',16)+'</div><div class="stat-v">'+sess+'</div><div class="stat-l">'+t('sessionsCap')+'</div></div>'+
    '<div class="card stat-card" style="flex:1 1 40%"><div class="stat-ic">'+ICN('lung',16)+'</div><div class="stat-v">'+(vdot||'—')+'</div><div class="stat-l">VDOT</div></div>'+
    '<div class="card stat-card" style="flex:1 1 40%"><div class="stat-ic">'+ICN('fire',16)+'</div><div class="stat-v">'+streak+'</div><div class="stat-l">'+t('daysStreak')+'</div></div>'+
  '</div>';

  const {cur,prev}=periodRanges('week');
  const kmW=sumKmBetween(cur[0],cur[1]), kmPrev=sumKmBetween(prev[0],prev[1]);
  const sessW=countBetween(cur[0],cur[1]), sessTarget=(P.days&&P.days.length)||4;
  const pct=sessTarget?Math.min(100,Math.round(sessW/sessTarget*100)):0;
  const deltaPct=kmPrev>0?Math.round((kmW-kmPrev)/kmPrev*100):(kmW>0?100:null);
  h+='<div class="sec-lab" style="margin-top:18px">'+t('thisWeek')+'</div>';
  h+='<div class="card">'+
    '<div class="row" style="justify-content:space-between;align-items:baseline;margin-bottom:10px">'+
      '<span class="man" style="font-weight:800;font-size:17px">'+tp('kmThisWeekShort',kmW.toFixed(1))+'</span>'+
      (deltaPct!==null?'<span style="font-size:12px;color:'+(deltaPct<0?'var(--bad)':'var(--ok)')+';font-weight:700">'+(deltaPct>0?'+':'')+deltaPct+'%</span>':'')+
    '</div>'+
    '<div class="kgoal-bar"><div style="width:'+pct+'%"></div></div>'+
    '<div style="font-size:11.5px;color:var(--dim);margin-top:8px">'+sessW+' / '+sessTarget+' '+t('sessionsCap').toLowerCase()+' · '+t('vsPrevPeriod')+'</div>'+
  '</div>';

  const unlocked=unlockedBadges(); const ukeys=new Set(unlocked.map(u=>u.key));
  h+='<div class="sec-head" style="margin-top:18px"><h3 class="grp-lab" style="margin:0">'+t('badgesLabel')+'</h3><span class="see" onclick="openBadges()">'+tp('badgesObtainedCount',unlocked.length,BADGE_TIERS.length)+'</span></div>';
  h+='<div class="card"><div class="bd-grid">'+
    BADGE_TIERS.slice(0,6).map(b=>{
      const on=ukeys.has(b.key);
      return '<div class="bd-cell" onclick="openBadgeQuick(\''+b.key+'\')">'+
        '<div class="bd-icon '+b.cls+(on?'':' locked')+'" style="width:52px;height:52px">'+bdGlyph(b.key)+(on?'':'<div class="bd-lock-chip">'+ICN('lock',14)+'</div>')+'</div>'+
        '<div class="bd-name">'+b.name+'</div></div>';
    }).join('')+
  '</div></div>';

  return h;
}
function renderStats(){
  if(P.easyMode){ $('#s-stats').innerHTML=renderStatsSimple(); return; }
  const seg=statsSegHTML();
  // 1) Squelette affiché tout de suite, adapté à l'onglet demandé.
  $('#s-stats').innerHTML='<div class="skl-screen">'+seg+(STATS_SKELETONS[statsTab]?STATS_SKELETONS[statsTab]():'')+'</div>';
  const startT=performance.now();
  const tabAtRequest=statsTab; // au cas où l'utilisateur change d'onglet pendant le calcul
  // 2) Double rAF : garantit que le squelette a bien été peint à l'écran avant
  //    de lancer le calcul potentiellement coûteux (sinon le navigateur peut
  //    fusionner les deux et l'utilisateur ne voit jamais le squelette).
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    let h=seg;
    if(tabAtRequest==='bilan') h+=statsBilan();
    if(tabAtRequest==='run') h+=statsRun();
    if(tabAtRequest==='muscu') h+=statsMuscu();
    if(tabAtRequest==='medals') h+=statsMedals();
    const swap=()=>{
      if(statsTab!==tabAtRequest) return; // l'utilisateur a changé d'onglet entre-temps, un renderStats() plus récent a déjà pris le relais
      const el=$('#s-stats'); el.innerHTML=h; el.classList.add('skl-content-in');
    };
    // 3) Délai minimum anti-flash : si le calcul a été quasi instantané (peu
    //    d'historique), on évite un aller-retour squelette→contenu trop bref
    //    qui donnerait un effet de clignotement plutôt qu'un vrai chargement.
    const elapsed=performance.now()-startT, minMs=220;
    elapsed<minMs?setTimeout(swap,minMs-elapsed):swap();
  }));
}
let bilanPeriod='week';
function bodyInfoCard(){
  if(P.height&&P.weight) return '';
  return '<div class="card" style="margin-bottom:14px">'+
    '<div class="card-t">'+t('completeProfileTitle')+'</div>'+
    '<div style="font-size:13px;color:var(--muted);margin-bottom:12px">'+t('completeProfileDesc')+'</div>'+
    '<div class="field" style="margin-bottom:10px"><label>'+t('height')+'</label><div class="inp pkfield" onclick="pickBodyHeight()">'+(P.height?P.height+' cm':t('chooseHeight'))+'</div></div>'+
    '<div class="field" style="margin-bottom:0"><label>'+t('weight')+'</label><div class="inp pkfield" onclick="pickBodyWeight()">'+(P.weight?P.weight+' kg':t('chooseWeight'))+'</div></div>'+
  '</div>';
}
function pickBodyHeight(){ pickInt(t('heightCmTitle'),120,220,P.height||170,'cm',v=>{ P.height=v; saveAll(); renderStats(); toast(t('heightSaved')); }); }
function pickBodyWeight(){ openPicker({title:t('weightKgTitle'),cols:[{values:range(30,200),sel:Math.max(0,(P.weight||65)-30)},{values:range(0,9),sel:0,unit:'kg'}],seps:['.'],onOk:idx=>{ const w=(idx[0]+30)+idx[1]/10; P.weight=w; saveAll(); renderStats(); toast(t('weightSaved')); }}); }
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

  // TAILLE / POIDS — demandés ici plutôt qu'à l'inscription
  let h=bodyInfoCard();

  // ONGLETS PÉRIODE — segmented control façon Kalo
  h+='<div class="seg-ctrl">'+
    ['week','month','3m','year'].map(p=>'<div class="seg-btn'+(per===p?' on':'')+'" onclick="bilanPeriod=\''+p+'\';renderStats()">'+periodTabLabel(p)+'</div>').join('')+
  '</div>';

  // CARTE KILOMÉTRAGE — gros chiffre + delta + barres avec ligne de moyenne
  h+='<div class="kchart-card">'+
    '<div class="kchart-top"><div><div class="kchart-lab">'+t('mileage')+'</div><div class="kchart-val">'+km.toFixed(1)+'<span>'+t('kmCumulated')+'</span></div></div>'+
    (deltaPct!==null?'<div><div class="kchart-delta'+(deltaPct<0?' bad':'')+'">'+(deltaPct>0?'+':deltaPct<0?'&#8722;':'')+Math.abs(deltaPct)+'%</div><div class="kchart-delta-sub">'+t('vsPrevPeriod')+'</div></div>':'')+
    '</div>'+
    kBarsHTML(bars.labels,bars.values,per==='week'?((new Date().getDay()+6)%7):null)+
  '</div>';

  // CARTE TENDANCE — ligne sur les 8 dernières semaines, peu importe l'onglet actif
  h+='<div class="kchart-card">'+
    '<div class="kchart-top"><div><div class="kchart-lab">'+t('volumeTrend')+'</div><div class="kchart-val">'+trend[trend.length-1].toFixed(1)+'<span>'+t('kmThisWeek')+'</span></div></div>'+
    '<div><div class="kchart-delta">'+t('eightWeeksLab')+'</div></div></div>'+
    '<div style="margin-top:14px">'+lineChartSVG(trend,300,60,'var(--e2)')+'</div>'+
    '<div class="kline-labs"><span>'+t('weeksAgoLab')+'</span><span>'+t('thisWeek')+'</span></div>'+
  '</div>';

  // DUO TEMPS / SÉANCES
  const sessTarget=Math.round(((P.days&&P.days.length)||4)*weeksInPeriod(per));
  const sessPct=sessTarget?Math.min(100,Math.round(cnt/sessTarget*100)):0;
  h+='<div class="kduo">'+
    '<div class="kduo-card"><div class="kduo-lab">'+t('totalTime')+'</div><div class="kduo-val">'+fmtHM(mins)+'</div>'+
      '<div class="kduo-sub" style="color:var(--muted)">'+t('overPeriod')+'</div></div>'+
    '<div class="kduo-card"><div class="kduo-lab">'+t('sessionsCap')+'</div><div class="kduo-val">'+cnt+' <span style="font-size:12px;color:var(--muted);font-weight:600">/ '+sessTarget+'</span></div>'+
      '<div class="kgoal-bar"><div style="width:'+sessPct+'%"></div></div>'+
      '<div class="kduo-sub">'+(sessPct>=100?t('goalReached'):tp('ofTarget',sessPct))+'</div></div>'+
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
  const bestLab={week:t('bestDayLab'),month:t('bestWeekLab'),['3m']:t('bestMonthLab'),year:t('bestMonthLab')}[per];

  h+='<div class="kinsights-head">'+t('insightsTitle')+'</div>';
  h+='<div class="krow3">'+
    '<div class="ktile"><div class="ktile-lab">'+t('kmPerSession')+'</div><div class="ktile-val">'+avgKmSess.toFixed(1)+' km</div>'+
      (avgDelta!==null?'<div class="ktile-sub'+(avgDelta<0?' bad':'')+'">'+(avgDelta>0?'+':avgDelta<0?'&#8722;':'')+Math.abs(avgDelta)+'% '+t('vsPrevShort')+'</div>':'<div class="ktile-sub" style="color:var(--muted)">—</div>')+
    '</div>'+
    '<div class="ktile" style="text-align:center"><div class="ktile-lab">'+t('sessionTypesLabel')+'</div>'+
      '<div class="ktile-donut">'+donutSVG(typeSegs,50,9,'')+'</div>'+
    '</div>'+
    '<div class="ktile"><span class="ktile-star">'+ICN('star',16,'var(--or)')+'</span><div class="ktile-lab">'+bestLab+'</div>'+
      '<div class="ktile-val">'+bars.labels[bestI]+'</div>'+
      '<div class="ktile-sub">'+bars.values[bestI].toFixed(1)+' km</div>'+
    '</div>'+
  '</div>';
  if(typeSegs[0].ty!=='—'){
    h+='<div class="card"><div class="card-t">'+cardIcon('chart','var(--e)')+t('detailByType')+'</div>'+
      typeSegs.sort((a,b)=>b.ct-a.ct).map(s=>'<div class="row" style="gap:8px;margin-bottom:6px"><span class="zdot" style="background:'+s.color+'"></span><span style="flex:1;font-size:12.5px;font-weight:600">'+trSessType(s.ty)+'</span><span class="mono" style="font-size:12px;color:var(--muted)">'+s.ct+' · '+Math.round(s.ct/periodSess.length*100)+'%</span></div>').join('')+
    '</div>';
  }

  // 13 DERNIÈRES SEMAINES — heatmap, complément utile non présent chez Kalo
  h+='<div class="card"><div class="card-t">'+cardIcon('fire','var(--or)')+t('last13Weeks')+'</div><div class="heat">'+heatmap13()+'</div><div class="row" style="margin-top:10px;font-size:11px;color:var(--dim)"><span>'+t('lessLabel')+'</span><span>'+t('moreLabel')+'</span></div></div>';

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
  let h='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v">'+(vdot||'—')+'</div><div class="l">'+t('vdotReal')+'</div></div><div class="sbox"><div class="v">'+SESS.length+'</div><div class="l">'+t('sessionsRun')+'</div></div><div class="sbox"><div class="v">'+totalKm().toFixed(0)+'</div><div class="l">'+t('kmTotal')+'</div></div><div class="sbox"><div class="v">'+(SESS.reduce((a,s)=>a+(s.duration||0),0)/60).toFixed(1)+'h</div><div class="l">'+t('totalTime')+'</div></div></div>';
  // zones
  if(vdot){
    const zones=[['EF',.70,'--ok'],['Tempo',.83,'--warn'],['Seuil',.88,'--or'],['VMA',.97,'--bad'],['Sprint',1.05,'--maitre']];
    h+='<div class="card"><div class="card-t">'+t('paceZones')+'</div>';
    zones.forEach(z=>{ h+='<div class="zrow"><span class="zdot" style="background:var('+z[2]+')"></span><span class="zname">'+z[0]+'</span><span class="zval">'+spkToStr(paceFromPct(vdot,z[1]))+' /km</span></div>'; });
    h+='</div>';
    // predictions
    const dists=[['1500m',1500],['3000m',3000],['5000m',5000],['10km',10000],['Semi',21097],['Marathon',42195]];
    h+='<div class="card"><div class="card-t">'+t('predictions')+'</div>';
    dists.forEach(d=>{ h+='<div class="zrow"><span class="zname">'+d[0]+'</span><span class="zval mono" style="color:var(--snow)">'+fmtTime(predictTime(vdot,d[1]))+'</span></div>'; });
    h+='</div>';
    // form/fatigue SVG
    h+='<div class="card"><div class="card-t">'+t('formFatigue')+'</div>'+formChart()+'</div>';
  }
  // records
  h+='<div class="card"><div class="card-t">'+t('personalRecords')+'</div>'+
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
    '<span style="display:flex;align-items:center;gap:5px"><span class="zdot" style="background:var(--e)"></span>'+t('chronic')+'</span>'+
    '<span style="display:flex;align-items:center;gap:5px"><span class="zdot" style="background:var(--maitre)"></span>'+t('acute')+'</span></div>';
}
function statsMuscu(){
  const pr=MSESS.reduce((a,s)=>Math.max(a,s.tonnage||0),0);
  let h='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v">'+MSESS.length+'</div><div class="l">'+t('sessionsCap')+'</div></div><div class="sbox"><div class="v">'+(totalTonnage()/1000).toFixed(1)+'t</div><div class="l">'+t('tonnageLab')+'</div></div><div class="sbox"><div class="v">'+Math.round(pr)+'</div><div class="l">'+t('prPerSession')+'</div></div><div class="sbox"><div class="v">'+MSESS.reduce((a,s)=>a+(s.sets||0),0)+'</div><div class="l">'+t('totalSets')+'</div></div></div>';
  if(!MSESS.length) h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('dumbbell',36,'currentColor')+'</div><div style="font-size:13px">'+t('startFirstMuscu')+'</div></div></div>';
  else {
    h+=bodyHeatmapCard();
    h+='<div class="card"><div class="card-t">'+t('lastSessions')+'</div>'+MSESS.slice(-6).reverse().map(s=>'<div class="zrow"><div><div class="zname">'+s.progName+'</div><div style="font-size:11px;color:var(--dim)">'+fmtDate(s.date)+'</div></div><span class="zval mono">'+Math.round(s.tonnage)+' kg</span></div>').join('')+'</div>';
  }
  return h;
}
/* ============ BADGES TROPHÉES (Accomplissement / Performance) ============
   16 badges nommés, distincts des paliers de niveau ci-dessus. Débloqués
   automatiquement quand c'est mesurable dans les données réelles ; sinon
   à cocher soi-même (dénivelé, VO2max amélioré...). */
/* ---- Helpers de détection pour les trophées (conditions réelles, mesurables) ---- */
function weekKeyOf(dateStr){
  if(!dateStr) return '';
  const d=new Date(dateStr+'T00:00:00'); if(isNaN(d)) return '';
  const day=(d.getDay()+6)%7; // lundi=0
  const monday=new Date(d); monday.setDate(d.getDate()-day);
  return monday.toISOString().slice(0,10);
}
function achWeeklyCount(list,n){
  const byWeek={};
  list.forEach(s=>{ if(!s.date) return; const wk=weekKeyOf(s.date); byWeek[wk]=(byWeek[wk]||0)+1; });
  return Object.values(byWeek).some(c=>c>=n);
}
function achWeeklySum(list,field,min){
  const byWeek={};
  list.forEach(s=>{ if(!s.date) return; const wk=weekKeyOf(s.date); byWeek[wk]=(byWeek[wk]||0)+(s[field]||0); });
  return Object.values(byWeek).some(v=>v>=min);
}
function achObjectifReached(){
  if(!P.objTime) return false;
  const race=SESS.find(s=>s.type==='Course' && s.duration);
  if(!race) return false;
  return (race.duration*60)<=parseTime(P.objTime);
}
function pbTrack(){ return DB.load('pb_track')||{best:0,unlocked:false}; }
function achNouveauPB(){
  const v=(typeof computeVDOTfromRecords==='function')?(computeVDOTfromRecords()||0):0;
  const store=pbTrack();
  if(v>store.best){ if(store.best>0) store.unlocked=true; store.best=v; DB.save('pb_track',store); }
  return store.unlocked;
}
function ACHIEVEMENTS_DEF(){ return [
  {key:'premiere',    name:t('ach_premiere_name'),  img:'premiere.png',    cat:'Accomplissement', cls:'bd-debutant', desc:t('ach_premiere_desc'),            auto:()=>SESS.some(s=>s.type==='Course')},
  {key:'cinqk',       name:t('ach_cinqk_name'),      img:'cinqk.png',       emoji:'run',            cat:'Accomplissement', cls:'bd-amateur',  desc:t('ach_cinqk_desc'),   auto:()=>SESS.some(s=>s.km>5)},
  {key:'dixk',        name:t('ach_dixk_name'),       img:'dixk.png',        emoji:'flag',            cat:'Accomplissement', cls:'bd-sportif',  desc:t('ach_dixk_desc'),  auto:()=>SESS.some(s=>s.km>10)},
  {key:'serie',       name:t('ach_serie_name'),      img:'serie.png',       cat:'Accomplissement', cls:'bd-athlete',  desc:t('ach_serie_desc'), auto:()=>bestStreak()>=30},
  {key:'denivele',    name:t('ach_denivele_name'),   img:'denivele.png',    cat:'Accomplissement', cls:'bd-expert',   desc:t('ach_denivele_desc'),      auto:()=>SESS.some(s=>(s.deniv||0)>200)},
  {key:'podium',      name:t('ach_podium_name'),     img:'podium.png',      cat:'Accomplissement', cls:'bd-elite',    desc:t('ach_podium_desc'), manual:true},
  {key:'objectif',    name:t('ach_objectif_name'),   img:'objectif.png',    cat:'Accomplissement', cls:'bd-maitre',   desc:t('ach_objectif_desc'), auto:achObjectifReached},
  {key:'nouveaupb',   name:t('ach_nouveaupb_name'),  img:'nouveaupb.png',   emoji:'medal',            cat:'Performance',      cls:'bd-legende', desc:t('ach_nouveaupb_desc'), auto:achNouveauPB},
  {key:'allure',      name:t('ach_allure_name'),     img:'allure.png',      cat:'Performance',      cls:'bd-sportif',  desc:t('ach_allure_desc'), auto:()=>SESS.some(s=>s.km>=3 && s.pace && s.pace!=='—' && parseTime(s.pace)>0 && parseTime(s.pace)<=600)},
  {key:'endurance',   name:t('ach_endurance_name'),  img:'endurance.png',   cat:'Performance',      cls:'bd-athlete',  desc:t('ach_endurance_desc'),  auto:()=>SESS.some(s=>s.km>=15)},
  {key:'puissance',   name:t('ach_puissance_name'),  img:'puissance.png',   cat:'Performance',      cls:'bd-expert',   desc:t('ach_puissance_desc'), auto:()=>achWeeklyCount(MSESS,3)},
  {key:'vo2max',      name:t('ach_vo2max_name'),     img:'vo2max.png',      emoji:'health',            cat:'Performance',      cls:'bd-elite',    desc:t('ach_vo2max_desc'), auto:()=>(getUserVDOT()||0)>50},
  {key:'force',       name:t('ach_force_name'),      img:'force.png',       cat:'Performance',      cls:'bd-maitre',   desc:t('ach_force_desc'), auto:()=>achWeeklySum(MSESS,'tonnage',20000)}
]; }
let ACHIEVEMENTS=ACHIEVEMENTS_DEF();
function catLabel(cat){ return cat==='Performance'?t('catPerformance'):t('catAccomplissement'); }
function manualBadges(){ return DB.load('manual_badges')||{}; }
function achievementUnlocked(a){ const on = a.auto ? !!a.auto() : !!manualBadges()[a.key]; if(on) recordAchDate(a.key); return on; }
/* Date d'obtention de chaque badge d'accomplissement (inconnue avant cette
   version : on l'enregistre au moment où on détecte le badge débloqué pour
   la première fois — pour le rétroactif exact, l'utilisateur peut la
   corriger à la main via editAchDate). */
function achDates(){ return DB.load('ach_dates')||{}; }
function recordAchDate(key){
  const d=achDates(); if(d[key]) return d[key];
  d[key]=todayKey(); DB.save('ach_dates',d); return d[key];
}
function achYears(){
  const d=achDates(); const ys=new Set(Object.values(d).map(v=>+String(v).slice(0,4)));
  return [...ys].sort((a,b)=>b-a);
}
let achYearFilter='toutes';
function toggleManualBadge(key){
  const a=ACHIEVEMENTS.find(x=>x.key===key); if(!a||!a.manual) return;
  const m=manualBadges(); m[key]=!m[key]; DB.save('manual_badges',m);
  if(m[key]) recordAchDate(key); else { const d=achDates(); delete d[key]; DB.save('ach_dates',d); }
  toast(m[key]?tp('badgeUnlockedToast',a.name):t('badgeRemovedToast'));
  renderStats();
}
/* ---- Clic sur un trophée : même effet visuel que les badges de progression ----
   Obtenu → on rejoue l'animation. Verrouillé → aperçu lumineux qui rappelle
   directement la condition à remplir (a.desc). Un simple tap n'a plus jamais
   pour effet de débloquer/reverrouiller le trophée : ce n'est plus qu'une
   consultation. Seul le bouton dédié à l'intérieur de l'aperçu (pour les
   trophées encore manuels comme Podium) permet de le cocher. */
function openAchQuick(key){
  const a=ACHIEVEMENTS.find(x=>x.key===key); if(!a) return;
  if(achievementUnlocked(a)) replayAchAnim(key); else previewAchAnim(key);
}
let _achUnlockQueue=[];
function checkNewAchievements(animate){
  const hadKeys=new Set(Object.keys(achDates()));
  const newKeys=[];
  ACHIEVEMENTS.forEach(a=>{
    if(hadKeys.has(a.key)) return;
    const on=a.auto ? !!a.auto() : !!manualBadges()[a.key];
    if(on){ recordAchDate(a.key); newKeys.push(a.key); }
  });
  if(newKeys.length){
    if(animate){ _achUnlockQueue.push(...newKeys); playAchUnlockQueue(); }
  }
}
function playAchUnlockQueue(){
  if(document.querySelector('.bd-unlock-ov')) return; // une animation à la fois
  const key=_achUnlockQueue.shift();
  if(!key) return;
  const a=ACHIEVEMENTS.find(x=>x.key===key);
  if(a) showAchUnlockAnim(a);
}
function showAchUnlockAnim(a){
  burst(); sfx('medal'); if(navigator.vibrate) navigator.vibrate([120,60,120,60,260]);
  const ov=document.createElement('div');
  ov.className='bd-unlock-ov';
  let sparks=''; for(let i=0;i<26;i++){ const ang=Math.random()*Math.PI*2, d=90+Math.random()*110;
    sparks+='<span class="bd-spark" style="--tx:'+(Math.cos(ang)*d)+'px;--ty:'+(Math.sin(ang)*d)+'px;animation-delay:'+(Math.random()*1.2)+'s"></span>'; }
  ov.innerHTML='<div class="bd-flash"></div>'+
    '<div style="font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:700;font-family:Unbounded;margin-bottom:6px">'+t('newTrophyUnlocked')+'</div>'+
    '<div class="bd-unlock-stage '+(a.cls||'bd-athlete')+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div><div class="bd-ring r4"></div>'+
    '<div class="bd-unlock-badge">'+achImg(a)+sparks+'</div></div>'+
    '<div class="man" style="font-weight:800;font-size:30px;margin-top:18px;letter-spacing:.5px">'+a.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;max-width:280px">'+a.desc+'</div>'+
    '<div style="color:var(--dim);font-size:12px;margin-top:18px">'+t('tapToContinue')+'</div>';
  ov.onclick=()=>{ ov.remove(); playAchUnlockQueue(); };
  document.body.appendChild(ov);
  setTimeout(()=>{ if(ov.parentNode){ ov.remove(); playAchUnlockQueue(); } },4200);
}
/* Consultation d'un trophée déjà obtenu (rejoue une version sans confettis) */
function replayAchAnim(key){
  const a=ACHIEVEMENTS.find(x=>x.key===key); if(!a) return;
  sfx('goal'); if(navigator.vibrate) navigator.vibrate(60);
  const ov=document.createElement('div');
  ov.className='bd-unlock-ov';
  let sparks=''; for(let i=0;i<20;i++){ const ang=Math.random()*Math.PI*2, d=80+Math.random()*90;
    sparks+='<span class="bd-spark" style="--tx:'+(Math.cos(ang)*d)+'px;--ty:'+(Math.sin(ang)*d)+'px;animation-delay:'+(Math.random()*1.4)+'s"></span>'; }
  const dt=achDates()[key];
  ov.innerHTML='<div class="bd-flash"></div>'+
    '<div class="bd-unlock-stage '+(a.cls||'bd-athlete')+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div>'+
    '<div class="bd-unlock-badge">'+achImg(a)+sparks+'</div></div>'+
    '<div class="man" style="font-weight:800;font-size:26px;margin-top:18px">'+a.name+'</div>'+
    '<div style="color:var(--muted);font-size:13px;margin-top:6px;max-width:280px">'+a.desc+'</div>'+
    (dt?'<div style="color:var(--dim);font-size:11.5px;margin-top:8px">'+tp('obtainedOn',fmtDate(dt))+'</div>':'')+
    '<div style="color:var(--dim);font-size:12px;margin-top:16px">'+t('tapToClose')+'</div>';
  ov.onclick=()=>{ ov.remove(); };
  document.body.appendChild(ov);
}
/* Aperçu d'un trophée encore verrouillé : même show lumineux, avec la
   condition à remplir affichée directement (pas de mystère). Pour les
   trophées encore manuels (Podium), un bouton permet de le cocher soi-même. */
function previewAchAnim(key){
  const a=ACHIEVEMENTS.find(x=>x.key===key); if(!a) return;
  sfx('tap'); if(navigator.vibrate) navigator.vibrate(35);
  const ov=document.createElement('div');
  ov.className='bd-unlock-ov preview';
  let sparks=''; for(let i=0;i<16;i++){ const ang=Math.random()*Math.PI*2, d=80+Math.random()*90;
    sparks+='<span class="bd-spark" style="--tx:'+(Math.cos(ang)*d)+'px;--ty:'+(Math.sin(ang)*d)+'px;animation-delay:'+(Math.random()*1.4)+'s"></span>'; }
  ov.innerHTML='<div class="bd-flash"></div>'+
    '<div style="font-size:12px;letter-spacing:3px;color:var(--muted);font-weight:700;font-family:Unbounded;margin-bottom:6px">'+t('previewLocked')+'</div>'+
    '<div class="bd-unlock-stage '+(a.cls||'bd-athlete')+'"><div class="bd-rays"></div><div class="bd-ring"></div><div class="bd-ring r2"></div><div class="bd-ring r3"></div>'+
    '<div class="bd-unlock-badge">'+achImg(a)+sparks+'<div class="bd-lock-chip big">'+ICN('lock',16)+'</div></div></div>'+
    '<div class="man" style="font-weight:800;font-size:26px;margin-top:18px">'+a.name+'</div>'+
    '<div class="bd-preview-cond" style="text-align:center;color:var(--muted);font-size:13px;margin-top:8px;max-width:280px">'+a.desc+'</div>'+
    (a.manual?'<button type="button" class="btn sm" style="width:auto;margin-top:20px;padding:11px 26px" data-mark>'+t('markAsObtained')+'</button>':'')+
    '<div style="color:var(--dim);font-size:12px;margin-top:12px">'+t('tapToClose')+'</div>';
  ov.onclick=(e)=>{
    if(e.target.closest('[data-mark]')){ ov.remove(); toggleManualBadge(key); return; }
    ov.remove();
  };
  document.body.appendChild(ov);
}
function achImgErr(img){
  if(img.dataset.stage!=='1'){ img.dataset.stage='1'; img.src='badges/'+img.dataset.file; return; }
  const span=document.createElement('span'); span.className='bd-glyph bd-emoji'; span.innerHTML=ICN('medal',28,'var(--e)'); img.replaceWith(span);
}
function achImg(a){
  if(!a.img) return '<span class="bd-emoji">'+ICN((a.emoji&&ICONS[a.emoji])?a.emoji:'medal',28,'var(--e)')+'</span>';
  return '<img class="bd-glyph" src="'+a.img+'" data-file="'+a.img+'" data-stage="0" alt="" draggable="false" loading="lazy" onerror="achImgErr(this)">';
}
function achievementsGridHTML(){
  const cats=['Accomplissement','Performance'];
  const unlockedCount=ACHIEVEMENTS.filter(achievementUnlocked).length;
  const years=achYears();
  let h='<div class="card"><div class="row" style="margin-bottom:6px"><span class="card-t" style="margin:0">'+ICN('medal',15,'var(--e)')+t('tabTrophies')+'</span><span style="font-size:12px;color:var(--muted)">'+unlockedCount+' / '+ACHIEVEMENTS.length+'</span></div>'
    +'<div style="font-size:11px;color:var(--dim);margin-bottom:8px">'+t('tapTrophyHint')+'</div>';
  if(years.length){
    h+='<div class="pills" style="margin-bottom:10px">'
      +'<div class="pill '+(achYearFilter==='toutes'?'on':'')+'" onclick="achYearFilter=\'toutes\';renderStats()">'+t('allYearsLab')+'</div>'
      +years.map(y=>'<div class="pill '+(achYearFilter===y?'on':'')+'" onclick="achYearFilter='+y+';renderStats()">'+y+'</div>').join('')
      +'</div>';
  }
  const dates=achDates();
  cats.forEach(cat=>{
    let items=ACHIEVEMENTS.filter(a=>a.cat===cat);
    if(achYearFilter!=='toutes') items=items.filter(a=>achievementUnlocked(a) && +String(dates[a.key]||'').slice(0,4)===achYearFilter);
    if(!items.length) return;
    h+='<div style="font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.5px;margin:14px 0 8px">'+catLabel(cat).toUpperCase()+'</div><div class="bd-grid">';
    items.forEach(a=>{
      const on=achievementUnlocked(a);
      h+='<div class="bd-cell" onclick="openAchQuick(\''+a.key+'\')">'
        +'<div class="bd-icon'+(on?'':' locked')+'" style="background:rgba(255,255,255,.04)">'+achImg(a)+(on?'':'<div class="bd-lock-chip">'+ICN('lock',14)+'</div>')+'</div>'
        +'<div class="bd-name">'+a.name+'</div>'+(on&&dates[a.key]?'<div style="font-size:9.5px;color:var(--dim);margin-top:2px">'+dates[a.key].slice(0,4)+'</div>':'')+'</div>';
    });
    h+='</div>';
  });
  if(achYearFilter!=='toutes' && !ACHIEVEMENTS.some(a=>cats.includes(a.cat)&&achievementUnlocked(a)&&+String(dates[a.key]||'').slice(0,4)===achYearFilter)){
    h+='<div style="font-size:12px;color:var(--muted);margin-top:8px">'+tp('noTrophyInYear',achYearFilter)+'</div>';
  }
  h+='</div>';
  return h;
}
/* ---------- MEDALS ---------- */
function TIERS_DEF(){ return [[t('tierBronze'),'--bronze'],[t('tierArgent'),'--argent'],[t('tierOr'),'--or'],[t('tierPlatine'),'--platine'],[t('tierDiamant'),'--diamant'],[t('tierMaitre'),'--maitre'],[t('tierLegende'),'--legende']]; }
let TIERS=TIERS_DEF();
function MEDAL_CATS_DEF(){ return [
  {key:'sessions',name:t('medalCatSeances'),icon:'medal',val:()=>totalSessions(),thr:[10,25,50,100,200,350,500]},
  {key:'streak',name:t('medalCatRegularite'),icon:'fire',val:()=>streakDays(),thr:[3,7,14,30,60,100,180],unit:'j'},
  {key:'distance',name:t('medalCatDistance'),icon:'chart',val:()=>totalKm(),thr:[25,50,100,250,500,1000,2000],unit:'km'}
]; }
let MEDAL_CATS=MEDAL_CATS_DEF();
function statsMedals(){
  let h='';
  h+=achievementsGridHTML();
  return h;
}

/* ---------- ICÔNES PREMIUM (SVG line, mode sombre) ---------- */
const ICONS={
  comment:'<path d="M4 4h16v12H8l-4 4V4z"/><path d="M8 9h8M8 12h5"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
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
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
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
  stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
  share:'<path d="M12 3v12M8 7l4-4 4 4"/><path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/>',
  road:'<path d="M8 3 4 21M16 3l4 18"/><path d="M11 9h2M10.3 14h3.4M9.6 19h4.8"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/>',
  warning:'<path d="M12 3 2 20h20L12 3z"/><path d="M12 9v5M12 17h.01"/>',
  close:'<path d="M5 5l14 14M19 5 5 19"/>',
  clipboard:'<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V2h6v2"/><path d="M9 10h6M9 14h6"/>',
  bulb:'<path d="M9 18h6M10 22h4M12 2a6 6 0 0 0-3 11c1 .8 1 2 1 3h4c0-1 0-2.2 1-3a6 6 0 0 0-3-11z"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  flag:'<path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="14" r="4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  palette:'<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5A2.5 2.5 0 0 1 15.5 14H17a4 4 0 0 0 4-4c0-3.9-4-7-9-7z"/><circle cx="7.5" cy="11.5" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="15" cy="8.5" r="1"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  upload:'<path d="M12 3v12M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  download:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  coffee:'<path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9z"/><path d="M17 10h1a3 3 0 0 1 0 6h-1"/><path d="M8 3v2M11 3v2M14 3v2"/>',
  brain:'<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5h.5A2.5 2.5 0 0 0 9 18.5V6a3 3 0 0 0 0-3z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5h-.5A2.5 2.5 0 0 1 15 18.5V6a3 3 0 0 1 0-3z"/>',
  dumbbell:'<path d="M4 9v6M2 10v4M20 9v6M22 10v4M7 12h10"/><rect x="5" y="8" width="3" height="8" rx="1"/><rect x="16" y="8" width="3" height="8" rx="1"/>',
  back:'<path d="M6 3v18M18 3v18M6 8h12M6 16h12"/>',
  shoulders:'<path d="M4 8a4 4 0 0 1 8 0M12 8a4 4 0 0 1 8 0M4 8v4M20 8v4"/>',
  legs:'<path d="M8 3h8v6l-2 12h-2l-1-9-1 9H8L6 9V3z"/>',
  glutes:'<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>',
  abs:'<rect x="7" y="4" width="10" height="16" rx="3"/><path d="M7 9h10M7 14h10M12 4v16"/>',
  arms:'<path d="M5 16c0-3 2-5 3-7M5 16H3M19 16c0-3-2-5-3-7M19 16h2"/><circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/>',
  gem:'<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M8 3l4 6 4-6M6 9l6 12 6-12"/>',
  crown:'<path d="M3 19h18l-1-9-4 4-4-7-4 7-4-4z"/>',
  seedling:'<path d="M12 21V9"/><path d="M12 9C7 9 4 6 4 3c5 0 8 3 8 6zM12 9c0-3 3-6 8-6 0 3-3 6-8 6z"/>',
  shield:'<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.7 1.2c0 1.6-2.2 1.8-2.2 3.3"/><path d="M12 17h.01"/>',
  calculator:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  rain:'<path d="M6 16a5 5 0 0 1 .5-9.9A6 6 0 0 1 18 8a4 4 0 0 1-1 7.9"/><path d="M8 19v2M12 19v2M16 19v2"/>',
  suitcase:'<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3M3 13h18"/>',
  bike:'<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17l4-9h4l3 5M10 8H8M13 13l3 4"/>',
  swim:'<path d="M3 17c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0"/><circle cx="17" cy="6" r="2"/><path d="M6 13l7-6 3 3-2 2"/>',
  ban:'<circle cx="12" cy="12" r="9"/><path d="M5.5 5.5l13 13"/>',
  wind:'<path d="M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h9"/>',
  snow:'<path d="M12 2v20M4 7l16 10M20 7 4 17"/>'
};
function ICN(name,size,color){ const s=size||22; return '<svg viewBox="0 0 24 24" width="'+s+'" height="'+s+'" fill="none" stroke="'+(color||'currentColor')+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||'')+'</svg>'; }
/* Icône par groupe musculaire — remplace les anciens emojis décoratifs des exercices par les
   icônes SVG du même style que le reste de l'app (voir ICONS ci-dessus). */
const MUSCLE_ICON_MAP={'Pectoraux':'dumbbell','Pectoraux bas':'dumbbell','Pectoraux haut':'dumbbell','Dos':'back','Grand dorsal':'back','Lombaires':'back',
  'Épaules':'shoulders','Trapèzes':'shoulders','Deltoïde latéral':'shoulders','Deltoïde antérieur':'shoulders','Arrière épaules':'shoulders','Cou':'shoulders',
  'Biceps':'arms','Triceps':'arms','Avant-bras':'arms',
  'Quadriceps':'legs','Ischios':'legs','Adducteurs':'legs','Abducteurs':'legs','Mollets':'legs',
  'Fessiers':'glutes','Abdominaux':'abs','Obliques':'abs','Transverse':'abs','Core':'abs',
  'Corps entier':'run'};
function muscleIconName(group){ return MUSCLE_ICON_MAP[group]||'dumbbell'; }
function exGlyph(e,size){ const g=(e&&((e.muscles&&e.muscles[0])||(e.primary&&e.primary[0])||e.group))||'Corps entier'; return ICN(muscleIconName(g),size||28,'var(--e)'); }
/* colored rounded-square icon badge used in card headers, replaces flat emoji */
function cardIcon(name,color){ color=color||'var(--e)'; return '<span class="icb" style="background:linear-gradient(145deg,'+color+'22,'+color+'0d);box-shadow:0 0 0 1px '+color+'33 inset,0 4px 10px -4px '+color+'55;color:'+color+'">'+ICN(name,15,color)+'</span>'; }

/* ---------- BADGE CRESTS (SVG sur-mesure, remplace les emojis) ----------
   Inspiré des rangs Rocket League : un écusson qui gagne des ailes et des
   ornements (étoile, laurier, gemme, couronne) au fil des paliers. */
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
  if(!src) return '<span class="bd-emoji">'+ICN(badgeEmoji(key),28,'var(--e)')+'</span>';
  return '<img class="bd-glyph" src="'+src+'" alt="" draggable="false" loading="lazy" data-key="'+key+'" data-stage="0" onerror="bdImgErr(this)">';
}
function badgeEmoji(key){ const b=BADGE_TIERS.find(x=>x.key===key); return (b&&ICONS[b.emoji])?b.emoji:'medal'; }
function bdImgErr(img){
  const key=img.dataset.key; const stage=+img.dataset.stage;
  // Étape 0 → on retente dans un sous-dossier badges/, au cas où les PNG
  // seraient rangés là plutôt qu'à la racine du site.
  if(stage===0){ img.dataset.stage='1'; img.src='badges/'+BADGE_IMG_FILES[key]; return; }
  // Étape 1 échouée aussi → on bascule sur l'icône, plus aucune requête réseau.
  const span=document.createElement('span'); span.className='bd-glyph bd-emoji'; span.innerHTML=ICN(badgeEmoji(key),28,'var(--e)');
  img.replaceWith(span);
}

/* ---------- OUTILS — HUB ÉPURÉ ---------- */
let outilsTab='home';
function TOOLS_DEF(){ return {
  aio:{name:t('toolAioName'),sub:t('toolAioSub'),icon:ICN('lab'),fn:'renderAIO'},
  sante:{name:t('toolSanteName'),sub:t('toolSanteSub'),icon:ICN('health'),fn:'renderSanteTool'},
  chrono:{name:t('toolChronoName'),sub:t('toolChronoSub'),icon:ICN('stopwatch'),fn:'renderChrono'},
  convert:{name:t('toolConvertName'),sub:t('toolConvertSub'),icon:ICN('convert'),fn:'renderConvertTool'},
  notes:{name:t('toolNotesName'),sub:t('toolNotesSub'),icon:ICN('note'),fn:'renderNotesTool'},
  // accessibles via recherche
  vdot:{name:t('toolVdotName'),sub:t('toolVdotSub'),icon:ICN('lung'),fn:'renderVDOTtool'},
  imc:{name:t('toolImcName'),sub:t('toolImcSub'),icon:ICN('scale'),fn:'renderIMC'},
  hydra:{name:t('toolHydraName'),sub:t('toolHydraSub'),icon:ICN('water'),fn:'renderHydraTool'},
  bmr:{name:t('toolBmrName'),sub:t('toolBmrSub'),icon:ICN('fire'),fn:'renderBMRtool'},
  agenda:{name:t('toolAgendaName'),sub:t('toolAgendaSub'),icon:ICN('calendar'),fn:'renderAgenda',hidden:true},
  priere:{name:t('toolPriereName'),sub:t('toolPriereSub'),icon:ICN('mosque'),fn:'renderPriere',hidden:true}
}; }
// TOOLS est recalculé à chaque affichage pour suivre la langue active (voir renderOutils/outilsHome)
let TOOLS=TOOLS_DEF();
const MAIN_TOOLS=['aio','sante','chrono'];
const OTHER_TOOLS=['convert','notes'];
function toolFav(){ return PREFS.favTools||['aio','sante','chrono','convert']; }
function toggleFav(k){ let f=toolFav(); f=f.includes(k)?f.filter(x=>x!==k):[...f,k]; PREFS.favTools=f; saveAll(); renderOutils(); }
let toolSearch='';
function recentTools(){ return PREFS.recentTools||[]; }
function pushRecent(k){ let r=recentTools().filter(x=>x!==k); r.unshift(k); PREFS.recentTools=r.slice(0,4); saveAll(); }
function renderOutils(){
  TOOLS=TOOLS_DEF();
  let h='';
  if(outilsTab==='home'){ h=outilsHome(); $('#s-outils').innerHTML=h; bindToolSearch(); return; }
  if(outilsTab==='_timer'){ renderOutilsTimer(); return; }
  const tl=TOOLS[outilsTab]; if(!tl){ outilsTab='home'; return renderOutils(); }
  h='<div class="row" style="margin-bottom:14px"><button class="x" onclick="outilsBack()">‹</button><div class="man" style="font-weight:800;font-size:'+(tl.name.length>18?'15px':'17px')+';flex:1;text-align:center;margin:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+tl.name+'</div><button class="x" onclick="toggleFav(\''+outilsTab+'\')" aria-label="'+t('favoriteLab')+'" style="color:'+(toolFav().includes(outilsTab)?'var(--or)':'var(--dim)')+'">'+ICN('star',17)+'</button></div><div id="outBody"></div>';
  $('#s-outils').innerHTML=h;
  window[tl.fn] && window[tl.fn]();
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
  h+='<div style="display:flex;gap:10px;margin-bottom:16px"><div class="card" style="flex:1;padding:14px;margin:0;cursor:pointer;text-align:center" onclick="openTool(\'chrono\')"><div style="color:var(--e);display:flex;justify-content:center">'+ICN('stopwatch',26)+'</div><div style="font-weight:700;font-size:13px;margin-top:6px">'+t('toolChronoName')+'</div></div><div class="card" style="flex:1;padding:14px;margin:0;cursor:pointer;text-align:center" onclick="openQuickTimer()"><div style="color:var(--warn);display:flex;justify-content:center">'+ICN('timer',26)+'</div><div style="font-weight:700;font-size:13px;margin-top:6px">'+t('quickTimer')+'</div></div></div>';
  h+='<div class="searchbox"><span class="searchic">'+ICN('search',18,'var(--muted)')+'</span><input class="inp" id="toolSearchInp" style="padding-left:42px" placeholder="'+t('searchTool')+'" value="'+escHtml(toolSearch||'')+'"></div>';
  const q=toolSearch.toLowerCase().trim();
  if(q){
    const res=Object.entries(TOOLS).filter(([k,tl])=>tl.name.toLowerCase().includes(q));
    h+='<div class="lab" style="margin:14px 0 10px">'+tp('resultsCount',res.length)+'</div>';
    res.forEach(([k,tl])=>{ h+=toolRow(k,tl); });
    return h;
  }
  // FAVORIS
  const favs=toolFav().filter(k=>TOOLS[k]);
  h+='<div class="row" style="margin:18px 0 10px"><span class="lab">'+t('favorites')+'</span><span style="font-size:12px;color:var(--e);cursor:pointer" onclick="editFavs()">'+t('edit')+'</span></div>';
  h+='<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-bottom:22px">';
  favs.slice(0,8).forEach(k=>{ const tl=TOOLS[k]; h+='<div class="favtile" onclick="openTool(\''+k+'\')"><div style="color:var(--e);display:flex;justify-content:center">'+tl.icon+'</div><div class="favlab">'+favShort(k)+'</div></div>'; });
  h+='</div>';
  // OUTILS PRINCIPAUX
  h+='<div class="lab" style="margin:0 0 12px">'+t('mainTools')+'</div>';
  MAIN_TOOLS.forEach(k=>{ const tl=TOOLS[k];
    h+='<div class="list-row" onclick="openTool(\''+k+'\')"><div class="lr-icon">'+tl.icon+'</div><div class="lr-txt"><div class="lr-title">'+tl.name+'</div><div class="lr-sub">'+tl.sub+'</div></div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>';
  });
  // AUTRES OUTILS
  h+='<div class="lab" style="margin:18px 0 12px">'+t('otherTools')+'</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px">';
  OTHER_TOOLS.forEach(k=>{ const tl=TOOLS[k]; h+='<div class="favtile" style="padding:12px 4px" onclick="openTool(\''+k+'\')"><div style="color:var(--e);display:flex;justify-content:center">'+tl.icon+'</div><div class="favlab">'+favShort(k)+'</div></div>'; });
  h+='</div>';
  return h;
}
// Labels courts pour les tuiles, par clé d'outil (indépendant de la langue affichée dans le nom complet)
function favShort(k){ const m={aio:{fr:'Perf. Lab',en:'Perf. Lab',ar:'مختبر'},sante:{fr:'Santé',en:'Health',ar:'الصحة'},chrono:{fr:'Chrono',en:'Timer',ar:'ساعة'},convert:{fr:'Convert.',en:'Convert.',ar:'تحويل'},vdot:{fr:'VDOT',en:'VDOT',ar:'VDOT'},bmr:{fr:'Calories',en:'Calories',ar:'سعرات'},hydra:{fr:'Eau',en:'Water',ar:'ماء'}};
  return (m[k]&&m[k][curLang()])||(TOOLS[k]?TOOLS[k].name:k); }
function editFavs(){
  let h='<div class="tip" style="margin-bottom:14px">'+t('tapStarHint')+'</div>';
  Object.entries(TOOLS).forEach(([k,tl])=>{ h+=toolRow(k,tl); });
  $('#settingsBody').innerHTML=h; $('#ovSettings').querySelector('h2').textContent=t('editFavsTitle'); openOv('ovSettings');
}
function toolRow(k,tl){ const fav=toolFav().includes(k);
  return '<div class="list-row"><div class="lr-icon" style="cursor:pointer" onclick="openTool(\''+k+'\')">'+tl.icon+'</div><div class="lr-txt" style="cursor:pointer" onclick="openTool(\''+k+'\')"><div class="lr-title">'+tl.name+'</div>'+(tl.sub?'<div class="lr-sub">'+tl.sub+'</div>':'')+'</div><span onclick="event.stopPropagation();toggleFav(\''+k+'\')" title="'+t('favoriteLab')+'" style="color:'+(fav?'var(--or)':'var(--dim)')+';cursor:pointer;padding:4px;display:flex">'+ICN('star',17)+'</span></div>'; }
function openQuickTimer(){ outilsFrom='home'; outilsTab='_timer'; renderOutilsTimer(); }
function renderOutilsTimer(){ $('#s-outils').innerHTML='<div class="row" style="margin-bottom:14px"><button class="x" onclick="outilsTab=\'home\';renderOutils()">‹</button><div class="man" style="font-weight:800;font-size:17px;flex:1;text-align:center">'+t('quickTimer')+'</div><div style="width:34px"></div></div><div id="outBody"></div>'; renderTimer(); }

/* ============ TABLEAU DE BORD SANTÉ ============ */
function renderSanteTool(){
  const w=P.weight||62, ht=P.height||175;
  const imc=w/Math.pow(ht/100,2);
  let imcCat,imcCol; if(imc<18.5){imcCat=t('imcUnderweight');imcCol='--warn';}else if(imc<25){imcCat=t('imcNormal');imcCol='--ok';}else if(imc<30){imcCat=t('imcOverweight');imcCol='--warn';}else{imcCat=t('imcObese');imcCol='--bad';}
  // dernier log santé / sommeil depuis SESSLOG (debriefs)
  const lastLog=SESSLOG[SESSLOG.length-1]||{};
  const bmr=Math.round((P.sex==='Femme')?(10*w+6.25*ht-5*(age()||25)-161):(10*w+6.25*ht-5*(age()||25)+5));
  const burned=SESS.slice(-7).reduce((a,s)=>a+(s.km||0)*0.9*w/1000*1000,0); // approx kcal 7j run
  const freq=runCountWeek()+muscuCountWeek();
  let h='';
  // POIDS
  const last=WEIGHTLOG[WEIGHTLOG.length-1], prev=WEIGHTLOG[WEIGHTLOG.length-2];
  const trend=last&&prev?(last.w-prev.w):0;
  h+='<div class="card"><div class="row"><div class="card-t" style="margin:0">'+t('weightLab')+'</div><span style="font-size:12px;color:var(--e);cursor:pointer" onclick="addWeight()">'+t('addBtn')+'</span></div>';
  h+='<div class="row" style="align-items:flex-end;margin-top:8px"><div class="man" style="font-size:36px;font-weight:800">'+(last?last.w:w)+'<span style="font-size:16px;color:var(--muted)"> kg</span></div>'+(trend?'<span class="mono" style="margin-left:10px;color:'+(trend<0?'var(--ok)':'var(--warn)')+'">'+(trend>0?'▲ +':'▼ ')+trend.toFixed(1)+' kg</span>':'')+'</div>';
  if(WEIGHTLOG.length>=2) h+='<div style="margin-top:12px">'+weightSparkline()+'</div>';
  h+='</div>';
  // IMC
  h+='<div class="card"><div class="row"><div><div class="card-t" style="margin:0">'+t('imcLab')+'</div><div class="man" style="font-size:28px;font-weight:800;margin-top:6px;color:var('+imcCol+')">'+imc.toFixed(1)+'</div></div><div class="badge" style="background:var(--ed);color:var('+imcCol+')">'+imcCat+'</div></div>'+
    '<div class="pbar" style="margin-top:12px"><div style="width:'+Math.min(100,(imc/40)*100)+'%;background:var('+imcCol+')"></div></div></div>';
  // INDICATEURS — grille
  h+='<div class="sgrid" style="margin-bottom:14px">';
  h+='<div class="sbox"><div class="v" style="color:var(--e)">'+freq+'</div><div class="l">'+t('sessionsPerWeek')+'</div></div>';
  h+='<div class="sbox"><div class="v" style="color:var(--or)">'+bmr+'</div><div class="l">'+t('metabolismKcal')+'</div></div>';
  h+='<div class="sbox"><div class="v" style="color:var(--bad)">'+Math.round(burned)+'</div><div class="l">'+t('burned7d')+'</div></div>';
  h+='<div class="sbox"><div class="v" style="color:var(--platine)">'+Math.round(w*35/100)/10+'L</div><div class="l">'+t('waterPerDay')+'</div></div>';
  h+='</div>';
  // SOMMEIL / FATIGUE / RÉCUP (depuis derniers debriefs)
  const recent=SESSLOG.slice(-7);
  if(recent.length){
    const avg=(f)=>recent.reduce((a,x)=>a+(x[f]||0),0)/recent.length;
    const sleep=avg('sleep'),fatigue=avg('fatigue'),feel=avg('feel');
    h+='<div class="card"><div class="card-t">'+t('recentFormTitle')+'</div>';
    h+=santeBar(t('sleepLab'),sleep,5,'--platine');
    h+=santeBar(t('energyFeelLab'),feel,5,'--ok');
    h+=santeBar(t('fatigueLab'),fatigue,5,'--warn');
    // conseil intelligent
    let tip=t('tipBalanced');
    if(fatigue>=4) tip=t('tipHighFatigue');
    else if(sleep<=2.5) tip=t('tipLowSleep');
    else if(feel>=4) tip=t('tipGreatFeel');
    h+='<div class="tip" style="margin-top:12px">'+tip+'</div></div>';
  } else {
    h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('clipboard',36,'currentColor')+'</div><div style="font-size:13px">'+t('noDebriefHint')+'</div></div></div>';
  }
  // NUTRITION (rappel macros indicatifs)
  const prot=Math.round(w*1.8), carbs=Math.round(w*5), lip=Math.round(w*1);
  h+='<div class="card"><div class="card-t">'+t('nutritionTitle')+'</div>';
  h+='<div class="sgrid"><div class="sbox"><div class="v" style="font-size:18px;color:var(--ok)">'+prot+'g</div><div class="l">'+t('proteinLab')+'</div></div><div class="sbox"><div class="v" style="font-size:18px;color:var(--or)">'+carbs+'g</div><div class="l">'+t('carbsLab')+'</div></div><div class="sbox"><div class="v" style="font-size:18px;color:var(--warn)">'+lip+'g</div><div class="l">'+t('fatLab')+'</div></div><div class="sbox"><div class="v" style="font-size:18px">'+Math.round(prot*4+carbs*4+lip*9)+'</div><div class="l">'+t('kcalTarget')+'</div></div></div></div>';
  $('#outBody').innerHTML=h;
}
function santeBar(label,val,max,col){ const pct=Math.min(100,val/max*100); const icN=['warning','close','target','check','star'][Math.max(0,Math.min(4,Math.round(val)-1))];
  const ic=val?ICN(icN,14):'';
  return '<div style="margin-bottom:10px"><div class="row" style="margin-bottom:4px"><span style="font-size:13px">'+label+'</span><span style="font-size:13px;display:inline-flex;align-items:center;gap:4px">'+(val?ic+' '+val.toFixed(1)+'/'+max:'—')+'</span></div><div class="pbar"><div style="width:'+pct+'%;background:var('+col+')"></div></div></div>'; }
function weightSparkline(){
  const data=WEIGHTLOG.slice(-14).map(x=>x.w); if(data.length<2)return'';
  const min=Math.min(...data),max=Math.max(...data),rng=(max-min)||1; const W=300,H=60;
  const pts=data.map((v,i)=>(i/(data.length-1)*W).toFixed(1)+','+(H-(v-min)/rng*H).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:60px"><polyline points="'+pts+'" fill="none" stroke="var(--e)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function addWeight(){ const cur=P.weight||62; const whole=Math.floor(cur),dec=Math.round((cur-whole)*10);
  openPicker({title:t('weightPickerTitle'),cols:[{values:range(30,200),sel:Math.max(0,whole-30)},{values:range(0,9),sel:dec,unit:'kg'}],seps:['.'],onOk:idx=>{ const w=(idx[0]+30)+idx[1]/10; WEIGHTLOG.push({date:todayKey(),w}); P.weight=w; saveAll(); renderSanteTool(); toast(t('weightSaved')); }}); }

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
  let h='<div class="tip" style="margin-bottom:16px">'+t('labHint')+'</div>';
  h+=labField(t('distField'),'','dist',LAB.dist!=null?LAB.dist.toFixed(2)+' km':'—',computed('dist'));
  h+=labField(t('timeField'),'','time',LAB.time!=null?fmtTime(LAB.time):'—',computed('time'));
  h+=labField(t('paceField'),'','pace',LAB.pace!=null?spkToStr(LAB.pace)+' /km':'—',computed('pace'));
  h+=labField(t('speedField'),'','speed',LAB.speed!=null?LAB.speed.toFixed(2)+' km/h':'—',computed('speed'));
  h+='<button class="btn ghost" style="margin-top:10px" onclick="resetLab()">'+t('resetBtn')+'</button>';
  // Bonus : splits + prédictions si distance & pace connus
  if(LAB.dist&&LAB.pace&&LAB.dist>=1){
    h+='<div class="card-t" style="margin-top:20px">'+t('splitTimesTitle')+'</div>';
    const n=Math.min(Math.floor(LAB.dist),42);
    for(let k=1;k<=n;k++){ const hi=[5,10,21,42].includes(k); h+='<div class="zrow" style="padding:9px 0"><span class="zname" style="'+(hi?'color:var(--e)':'')+'">km '+k+(hi?'':'')+'</span><span class="zval mono">'+fmtTime(LAB.pace*k)+'</span></div>'; }
    if(LAB.dist%1>0.01) h+='<div class="zrow" style="padding:9px 0"><span class="zname">'+LAB.dist.toFixed(2)+' km</span><span class="zval mono">'+fmtTime(LAB.time)+'</span></div>';
  }
  $('#outBody').innerHTML=h;
}
function labField(label,icon,field,val,isComputed){
  const filled=LAB[field]!=null;
  return '<div class="card" style="padding:14px;margin-bottom:9px;cursor:pointer;'+(isComputed?'border-color:var(--e);background:var(--ed)':'')+'" onclick="editLab(\''+field+'\')"><div class="row"><div class="row" style="gap:11px"><span style="font-size:19px">'+icon+'</span><div><div style="font-size:11px;color:var(--muted)">'+label+(isComputed?' · '+t('calculatedLab'):filled?'':' · '+t('toFillLab'))+'</div><div class="mono" style="font-weight:700;font-size:19px;margin-top:2px;color:'+(isComputed?'var(--e)':'var(--snow)')+'">'+val+'</div></div></div><span style="color:var(--dim);font-size:15px">'+(isComputed?'':'')+'</span></div></div>';
}
function editLab(field){
  if(field==='dist') pickDistance(t('distField'),LAB.dist||10,v=>labSet('dist',v));
  else if(field==='time') pickTime(t('timeField'),LAB.time||1800,v=>labSet('time',v));
  else if(field==='pace') pickPace(t('paceField'),LAB.pace||270,v=>labSet('pace',v));
  else if(field==='speed') pickSpeed(t('speedField'),LAB.speed||12,v=>labSet('speed',v));
}
function resetLab(){ LAB={dist:null,time:null,pace:null,speed:null,recent:[]}; renderAIO(); }

/* ----- Nouveaux outils ----- */
function renderVDOTtool(){
  const vdot=getUserVDOT();
  let h='<div class="card" style="text-align:center"><div class="man" style="font-size:48px;font-weight:800;color:var(--e)">'+(vdot||'—')+'</div><div class="lab">'+t('vdotToolTitle')+'</div></div>';
  if(vdot){ const vo2=(vdot).toFixed(1);
    h+='<div class="card"><div class="card-t">'+t('physioEstimates')+'</div>'+
      '<div class="zrow"><span class="zname">'+t('vo2maxEst')+'</span><span class="zval mono">'+vo2+' ml/kg/min</span></div>'+
      '<div class="zrow"><span class="zname">'+t('thresholdPace')+'</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.88))+'/km</span></div>'+
      '<div class="zrow"><span class="zname">'+t('marathonPace')+'</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.80))+'/km</span></div>'+
      '<div class="zrow"><span class="zname">'+t('halfPace')+'</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.835))+'/km</span></div>'+
      '<div class="zrow"><span class="zname">'+t('efPace')+'</span><span class="zval mono">'+spkToStr(paceFromPct(vdot,.70))+'/km</span></div></div>';
  }
  h+='<div class="tip">'+t('vdotAutoTip')+'</div>';
  $('#outBody').innerHTML=h;
}
let rmW=80,rmR=5;
function renderRMtool(){
  const rm=Math.round(rmW*(1+rmR/30)); // Epley
  let h='<div class="card"><div class="field"><label>'+t('liftedLoadKgLab')+'</label><div class="stepper"><button onclick="rmW=Math.max(0,rmW-2.5);renderRMtool()">−</button><span class="val">'+rmW+'</span><button onclick="rmW+=2.5;renderRMtool()">+</button></div></div>';
  h+='<div class="field"><label>'+t('repsLab')+'</label><div class="stepper"><button onclick="rmR=Math.max(1,rmR-1);renderRMtool()">−</button><span class="val">'+rmR+'</span><button onclick="rmR++;renderRMtool()">+</button></div></div></div>';
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var(--e)">'+rm+' kg</div><div class="lab">'+t('estimated1RMLab')+'</div></div>';
  h+='<div class="card"><div class="card-t">'+t('percentOf1RMLab')+'</div>'+[[95,2],[90,4],[85,6],[80,8],[75,10],[70,12],[60,15]].map(x=>'<div class="zrow"><span class="zname">'+x[0]+'% · ~'+x[1]+' '+t('repsShort')+'</span><span class="zval mono">'+Math.round(rm*x[0]/100)+' kg</span></div>').join('')+'</div>';
  $('#outBody').innerHTML=h;
}
let tonW=60,tonS=4,tonR=10;
function renderTonnageTool(){
  const ton=tonW*tonS*tonR;
  let h='<div class="card"><div class="field"><label>'+t('loadKgLab')+'</label><div class="stepper"><button onclick="tonW=Math.max(0,tonW-2.5);renderTonnageTool()">−</button><span class="val">'+tonW+'</span><button onclick="tonW+=2.5;renderTonnageTool()">+</button></div></div><div class="field"><label>'+t('setsLab')+'</label><div class="stepper"><button onclick="tonS=Math.max(1,tonS-1);renderTonnageTool()">−</button><span class="val">'+tonS+'</span><button onclick="tonS++;renderTonnageTool()">+</button></div></div><div class="field"><label>'+t('repsShort')+'</label><div class="stepper"><button onclick="tonR=Math.max(1,tonR-1);renderTonnageTool()">−</button><span class="val">'+tonR+'</span><button onclick="tonR++;renderTonnageTool()">+</button></div></div></div>';
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var(--e)">'+ton+' kg</div><div class="lab">'+tp('totalTonnageLab',tonS,tonR,tonW)+'</div></div>';
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
  let status,col; if(ratio===0){status=t('noDataLab');col='--dim';} else if(ratio<0.8){status='Sous-charge';col='--platine';} else if(ratio<=1.3){status='Optimal';col='--ok';} else if(ratio<=1.5){status='Élevé';col='--warn';} else {status='Risque blessure';col='--bad';}
  let h='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var('+col+')">'+ratio.toFixed(2)+'</div><div class="lab">Ratio Aigu/Chronique (ACWR)</div><div class="badge" style="margin-top:10px;background:var(--ed);color:var('+col+')">'+status+'</div></div>';
  h+='<div class="sgrid"><div class="sbox"><div class="v">'+Math.round(acute)+'</div><div class="l">Charge aiguë (7j)</div></div><div class="sbox"><div class="v">'+Math.round(chronic)+'</div><div class="l">Charge chronique (28j)</div></div></div>';
  h+='<div class="tip" style="margin-top:12px">Zone optimale : 0,8–1,3. Au-dessus de 1,5, le risque de blessure augmente fortement.</div>';
  $('#outBody').innerHTML=h;
}
let calKm=10,calMin=50;
function renderCaloriesTool(){
  const w=P.weight||62; const cal=Math.round(0.9*w*calKm);
  let h='<div class="card"><div class="field"><label>'+t('distanceKmLab')+'</label><div class="stepper"><button onclick="calKm=Math.max(1,calKm-1);renderCaloriesTool()">−</button><span class="val">'+calKm+'</span><button onclick="calKm++;renderCaloriesTool()">+</button></div></div></div>';
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:42px;font-weight:800;color:var(--e)">'+cal+'</div><div class="lab">'+tp('kcalBurnedLab',w)+'</div></div>';
  $('#outBody').innerHTML=h;
}
function renderHydraTool(){
  const w=P.weight||62; const daily=Math.round(w*35); const perH=Math.round(0.5*1000);
  let h='<div class="card"><div class="card-t">'+t('waterNeedsTitle')+'</div><div class="zrow"><span class="zname">'+t('dailyRest')+'</span><span class="zval mono">'+(daily/1000).toFixed(1)+' L</span></div><div class="zrow"><span class="zname">'+t('perRunHour')+'</span><span class="zval mono">0,4–0,8 L</span></div><div class="zrow"><span class="zname">'+t('perHeatHour')+'</span><span class="zval mono">+0,3 L</span></div></div><div class="tip">'+t('hydraTip')+'</div>';
  $('#outBody').innerHTML=h;
}
let bmrSex=(P&&P.sex)||'Homme';
function renderBMRtool(){
  const w=P.weight||62,ht=P.height||175,a=age()||25;
  const bmr=Math.round(bmrSex==='Femme'?(10*w+6.25*ht-5*a-161):(10*w+6.25*ht-5*a+5));
  let h='<div class="card" style="text-align:center"><div class="man" style="font-size:40px;font-weight:800;color:var(--e)">'+bmr+'</div><div class="lab">'+t('basalMetabolism')+'</div></div>';
  h+='<div class="card"><div class="card-t">'+t('needsByActivity')+'</div>'+[[t('actSedentary'),1.2],[t('actLight'),1.375],[t('actModerate'),1.55],[t('actIntense'),1.725],[t('actAthlete'),1.9]].map(x=>'<div class="zrow"><span class="zname">'+x[0]+'</span><span class="zval mono">'+Math.round(bmr*x[1])+' kcal</span></div>').join('')+'</div>';
  $('#outBody').innerHTML=h;
}
/* ---------- CONVERTISSEUR — distance / allure / poids ----------
   L'ancienne version ne faisait que km<->miles alors que son propre sous-titre
   promettait "Allure, distance, poids" : trois catégories, chacune avec ses
   propres unités (l'allure n'est pas un simple facteur — km/h et min/km ne se
   convertissent pas par multiplication). Les unités sont des puces tapables
   plutôt que des <select>, pour rester dans le langage visuel de l'app. */
let cvCat='dist';
let cvDistVal=10, cvDistFrom='km', cvDistTo='mi';
let cvWeightVal=70, cvWeightFrom='kg', cvWeightTo='lb';
let cvPaceSpk=300; // secondes par km, unité canonique de l'allure

const CV_DIST_UNITS={km:1000, mi:1609.344, m:1, yd:0.9144};
const CV_DIST_LABEL={km:'km', mi:'mi', m:'m', yd:'yd'};
const CV_WEIGHT_UNITS={kg:1, lb:0.453592};
const CV_WEIGHT_LABEL={kg:'kg', lb:'lb'};

function cvSetCat(c){ cvCat=c; renderConvertTool(); }
function cvSwapDist(){ const t=cvDistFrom; cvDistFrom=cvDistTo; cvDistTo=t; renderConvertTool(); }
function cvSwapWeight(){ const t=cvWeightFrom; cvWeightFrom=cvWeightTo; cvWeightTo=t; renderConvertTool(); }
function cvSetDistUnit(which,u){ if(which==='from')cvDistFrom=u; else cvDistTo=u; renderConvertTool(); }
function cvSetWeightUnit(which,u){ if(which==='from')cvWeightFrom=u; else cvWeightTo=u; renderConvertTool(); }
function cvPickDist(){ pickDistance(t('toolConvertName'),cvDistVal,v=>{ cvDistVal=v; renderConvertTool(); }); }
function cvPickWeight(){ pickInt(t('weightLab'),30,180,Math.round(cvWeightVal),'kg',v=>{ cvWeightVal=v; renderConvertTool(); }); }
function cvPickPace(){ pickPace(t('toolConvertName'),cvPaceSpk,v=>{ cvPaceSpk=v; renderConvertTool(); }); }

// Rangée de puces d'unité — remplace les <select> nus, cohérent avec .pill ailleurs dans l'app.
function cvUnitPills(labels,cur,onPick){
  return '<div class="cv-units">'+Object.keys(labels).map(u=>
    '<div class="cv-unit'+(u===cur?' on':'')+'" onclick="'+onPick(u)+'">'+labels[u]+'</div>'
  ).join('')+'</div>';
}

// Une conversion m -> yd peut donner un nombre à 5 chiffres : réduit la taille
// de police du résultat plutôt que de le laisser déborder sur la puce d'unités.
function cvValSize(str){ return str.length>7?'18px':(str.length>5?'22px':'26px'); }
function renderConvertTool(){
  let h='<div class="pills sub cv-cats">'+
    ['dist','pace','weight'].map(c=>'<div class="pill '+(cvCat===c?'on':'')+'" onclick="cvSetCat(\''+c+'\')">'+t('cvCat_'+c)+'</div>').join('')+
  '</div>';

  if(cvCat==='dist'){
    const meters=cvDistVal*CV_DIST_UNITS[cvDistFrom];
    const fromStr=cvDistVal.toLocaleString(localeCode(),{maximumFractionDigits:2});
    const resStr=(meters/CV_DIST_UNITS[cvDistTo]).toLocaleString(localeCode(),{maximumFractionDigits:2});
    h+='<div class="cv-card">'+
      '<div class="cv-side" onclick="cvPickDist()"><div class="cv-lab">'+t('fromField')+'</div><div class="cv-val" style="font-size:'+cvValSize(fromStr)+'">'+fromStr+'</div>'+
      cvUnitPills(CV_DIST_LABEL,cvDistFrom,u=>"event.stopPropagation();cvSetDistUnit('from','"+u+"')")+'</div>'+
      '<div class="cv-swap" onclick="cvSwapDist()">'+ICN('convert',18)+'</div>'+
      '<div class="cv-side"><div class="cv-lab">'+t('toField')+'</div><div class="cv-val res" style="font-size:'+cvValSize(resStr)+'">'+resStr+'</div>'+
      cvUnitPills(CV_DIST_LABEL,cvDistTo,u=>"cvSetDistUnit('to','"+u+"')")+'</div>'+
    '</div>';
  } else if(cvCat==='weight'){
    const kg=cvWeightVal*CV_WEIGHT_UNITS[cvWeightFrom];
    const fromStr=cvWeightVal.toLocaleString(localeCode(),{maximumFractionDigits:1});
    const resStr=(kg/CV_WEIGHT_UNITS[cvWeightTo]).toLocaleString(localeCode(),{maximumFractionDigits:1});
    h+='<div class="cv-card">'+
      '<div class="cv-side" onclick="cvPickWeight()"><div class="cv-lab">'+t('fromField')+'</div><div class="cv-val" style="font-size:'+cvValSize(fromStr)+'">'+fromStr+'</div>'+
      cvUnitPills(CV_WEIGHT_LABEL,cvWeightFrom,u=>"event.stopPropagation();cvSetWeightUnit('from','"+u+"')")+'</div>'+
      '<div class="cv-swap" onclick="cvSwapWeight()">'+ICN('convert',18)+'</div>'+
      '<div class="cv-side"><div class="cv-lab">'+t('toField')+'</div><div class="cv-val res" style="font-size:'+cvValSize(resStr)+'">'+resStr+'</div>'+
      cvUnitPills(CV_WEIGHT_LABEL,cvWeightTo,u=>"cvSetWeightUnit('to','"+u+"')")+'</div>'+
    '</div>';
  } else {
    // Allure : une seule valeur canonique (sec/km), déclinée dans les quatre
    // unités à la fois — plus utile qu'un simple from/to pour une app de course.
    const spk=cvPaceSpk;
    const rows=[
      ['min/km', spkToStr(spk)+' /km'],
      ['min/mi', spkToStr(spk*1.609344)+' /mi'],
      ['km/h', (3600/spk).toFixed(2)],
      ['mph', (3600/(spk*1.609344)).toFixed(2)]
    ];
    h+='<div class="cv-pace-hero" onclick="cvPickPace()"><div class="cv-lab">'+t('cvTapToEdit')+'</div><div class="cv-val" style="font-size:40px">'+spkToStr(spk)+'<span style="font-size:16px;color:var(--muted)"> /km</span></div></div>';
    h+='<div class="card cv-pace-table">'+rows.map(r=>'<div class="zrow"><span class="zname">'+r[0]+'</span><span class="zval mono">'+r[1]+'</span></div>').join('')+'</div>';
  }
  $('#outBody').innerHTML=h;
}
let pgW=60,pgInc=2.5,pgWk=8;
function renderProgTool(){
  let h='<div class="card"><div class="field"><label>'+t('currentLoadKgLab')+'</label><div class="stepper"><button onclick="pgW=Math.max(0,pgW-2.5);renderProgTool()">−</button><span class="val">'+pgW+'</span><button onclick="pgW+=2.5;renderProgTool()">+</button></div></div><div class="field"><label>'+t('weeklyProgressKgLab')+'</label><div class="pills">'+[1.25,2.5,5].map(x=>'<div class="pill '+(pgInc===x?'on':'')+'" onclick="pgInc='+x+';renderProgTool()">+'+x+'</div>').join('')+'</div></div><div class="field"><label>'+t('weeksLab')+'</label><div class="stepper"><button onclick="pgWk=Math.max(1,pgWk-1);renderProgTool()">−</button><span class="val">'+pgWk+'</span><button onclick="pgWk++;renderProgTool()">+</button></div></div></div>';
  h+='<div class="card"><div class="card-t">'+t('projectionLab')+'</div>';
  for(let i=1;i<=pgWk;i++){ h+='<div class="zrow"><span class="zname">Semaine '+i+'</span><span class="zval mono">'+(pgW+pgInc*i)+' kg</span></div>'; }
  h+='</div>';
  $('#outBody').innerHTML=h;
}
function renderReposTool(){
  const data=[['Force max (1-5 reps)','3-5 min'],['Hypertrophie (6-12)','60-90 s'],['Endurance (15+)','30-45 s'],['Puissance / explosif','2-3 min'],['Superset','0 s entre, 90 s après']];
  let h='<div class="card"><div class="card-t">'+ICN('timer',15,'var(--e)')+t('restTimesLab')+'</div>'+data.map(d=>'<div class="zrow"><span class="zname">'+d[0]+'</span><span class="zval mono">'+d[1]+'</span></div>').join('')+'</div><div class="tip">Plus la charge est lourde, plus le repos doit être long pour récupérer le système nerveux.</div>';
  $('#outBody').innerHTML=h;
}
let pomoState={phase:'work',left:25*60,running:false,iv:null,count:0};
function renderPomodoro(){
  const total=pomoState.phase==='work'?25*60:(pomoState.phase==='long'?15*60:5*60);
  const pct=pomoState.left/total*100;
  const col=pomoState.phase==='work'?'var(--bad)':'var(--ok)';
  const lab=pomoState.phase==='work'?t('pomoFocus'):t('pomoBreak');
  let h='<div class="card" style="text-align:center"><div class="badge" style="background:var(--ed);color:'+col+'">'+lab+'</div><div class="ring-wrap" style="width:180px;height:180px;margin:14px auto"><span id="pmRing">'+ringSVG(180,pct,12,col)+'</span><div class="ring-c"><div class="big mono" id="pmNum" style="font-size:36px">'+fmtMS(pomoState.left)+'</div></div></div>';
  h+='<div class="row" style="gap:10px"><button class="btn" onclick="pomoToggle()">'+(pomoState.running?'Pause':'▶ Start')+'</button><button class="btn ghost" onclick="pomoReset()">↺</button></div>';
  h+='<div style="margin-top:12px;font-size:12px;color:var(--muted)">'+tp('pomodorosDoneLab',pomoState.count)+'</div></div>';
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
      if(pomoState.phase==='work'){ pomoState.count++; pomoState.phase=(pomoState.count%4===0)?'long':'short'; toast(t('deservedBreak')); }
      else { pomoState.phase='work'; toast(t('backToWork')); }
      pomoState.left=pomoState.phase==='work'?25*60:(pomoState.phase==='long'?15*60:5*60); renderPomodoro(); }
  },1000);
}
function pomoReset(){ clearInterval(pomoState.iv); pomoState={phase:'work',left:25*60,running:false,iv:null,count:pomoState.count}; renderPomodoro(); }
function renderNotesTool(){
  const notes=PREFS.quickNotes||'';
  let h='<div class="card"><div class="card-t">'+t('quickNotesTitle')+'</div><textarea class="inp" rows="12" id="qnotes" placeholder="'+t('notesPlaceholder')+'" oninput="PREFS.quickNotes=this.value;saveAll()">'+escHtml(notes)+'</textarea><div style="font-size:11px;color:var(--dim);margin-top:8px">'+t('autoSaveLocal')+'</div></div>';
  $('#outBody').innerHTML=h;
}
let sleepH=8;
function renderSleepTool(){
  let h='<div class="card"><div class="field"><label>'+t('sleepHoursPerNightLabel')+'</label><div class="stepper"><button onclick="sleepH=Math.max(3,sleepH-.5);renderSleepTool()">−</button><span class="val">'+sleepH+'</span><button onclick="sleepH=Math.min(12,sleepH+.5);renderSleepTool()">+</button></div></div></div>';
  let status,col; if(sleepH<6){status=t('sleepInsufficient');col='--bad';} else if(sleepH<7){status=t('sleepBorderline');col='--warn';} else if(sleepH<=9){status=t('sleepOptimal');col='--ok';} else {status=t('sleepPlenty');col='--platine';}
  h+='<div class="card" style="text-align:center"><div class="man" style="font-size:40px;font-weight:800;color:var('+col+')">'+sleepH+'h</div><div class="badge" style="background:var(--ed);color:var('+col+');margin-top:8px">'+status+'</div></div>';
  h+='<div class="card"><div class="card-t">'+ICN('moon',15,'var(--e)')+t('sleepCyclesTitle')+'</div><div class="tip">'+t('sleepCyclesTip')+'</div></div>';
  $('#outBody').innerHTML=h;
}


/* ---------- CALCULATEUR ALLURE ---------- */
const DISTANCES={'800m':800,'1km':1000,'1500m':1500,'Mile':1609,'3km':3000,'5km':5000,'10km':10000,'15km':15000,'Semi':21097,'Marathon':42195};
let calc={dist:'5km',customKm:5,TH:{h:0,m:18,s:0},TP:{m:3,s:36},lastResult:null,penalty:0,negSplit:false};
function renderCalc(){
  const vdot=getUserVDOT();
  let h='<div class="row" style="margin-bottom:14px"><span class="lab">'+t('paceCalculatorTitle')+'</span><span class="badge" onclick="nav(\'profil\')">VDOT '+(vdot||'?')+'</span></div>';
  h+='<div class="card"><div class="field"><label>'+t('distanceLabel')+'</label><select class="inp" id="calcDist" onchange="calc.dist=this.value;syncFromTime();renderCalc()">'+Object.keys(DISTANCES).concat(['Autre']).map(d=>'<option '+(calc.dist===d?'selected':'')+'>'+d+'</option>').join('')+'</select></div>';
  if(calc.dist==='Autre') h+='<div class="field"><label>'+t('customDistanceKmLabel')+'</label><div class="stepper"><button onclick="calc.customKm=Math.max(.1,calc.customKm-.5);renderCalc()">−</button><span class="val">'+calc.customKm+'</span><button onclick="calc.customKm+=.5;renderCalc()">+</button></div></div>';
  // time wheels
  h+='<div class="field"><label>'+t('timeHMSLabel')+'</label><div class="wheels">'+wheel('TH.h',0,9,calc.TH.h)+'<span class="wheel-sep">:</span>'+wheel('TH.m',0,59,calc.TH.m)+'<span class="wheel-sep">:</span>'+wheel('TH.s',0,59,calc.TH.s)+'</div></div>';
  h+='<div class="field"><label>'+t('paceMinSecKmLabel')+'</label><div class="wheels">'+wheel('TP.m',2,12,calc.TP.m)+'<span class="wheel-sep">:</span>'+wheel('TP.s',0,59,calc.TP.s)+'</div></div>';
  // speed
  const spk=calc.TP.m*60+calc.TP.s; const kmh=spk>0?(3600/spk).toFixed(1):'0';
  h+='<div class="sbox" style="text-align:center;margin-bottom:12px"><div class="v" style="color:var(--e)">'+kmh+' km/h</div><div class="l">'+t('speedLabel')+'</div></div>';
  h+='<div class="row" style="gap:8px"><button class="btn ghost sm" onclick="resetCalc()">'+t('resetShortLabel')+'</button><button class="btn ghost sm" onclick="calc._adv=!calc._adv;renderCalc()">'+t('advancedLabel')+'</button><button class="btn sm" onclick="doCalc()">'+t('calculateLabel')+'</button></div>';
  if(calc._adv){
    h+='<hr class="hl"><div class="field"><label>'+t('penaltySecKmLabel')+'</label><div class="stepper"><button onclick="calc.penalty-=1;renderCalc()">−</button><span class="val">'+calc.penalty+'</span><button onclick="calc.penalty+=1;renderCalc()">+</button></div></div><div class="chk '+(calc.negSplit?'done':'')+'" onclick="calc.negSplit=!calc.negSplit;renderCalc()"><div class="box"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg></div><div class="txt">'+t('negativeSplitLabel')+'</div></div>';
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
  let h='<div class="card popin"><div class="card-t">'+t('resultsLabel')+'</div>';
  h+='<div class="pills" style="margin-bottom:14px;overflow-x:auto;flex-wrap:nowrap;-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent);mask-image:linear-gradient(to right,#000 calc(100% - 28px),transparent)">'+Object.entries(DISTANCES).map(([k,v])=>'<div class="pill '+(resultDist===v?'on':'')+'" onclick="resultDist='+v+';renderCalc()">'+k+'</div>').join('')+'</div>';
  const predT=vdot?predictTime(vdot,resultDist):calc.lastResult.spk*resultDist/1000;
  const spk=predT/(resultDist/1000); const kmh=(3600/spk).toFixed(1);
  h+='<div class="sgrid" style="margin-bottom:14px"><div class="sbox"><div class="v" style="font-size:18px">'+fmtTime(predT)+'</div><div class="l">'+t('predictedTimeLabel')+'</div></div><div class="sbox"><div class="v" style="font-size:18px">'+spkToStr(spk)+'</div><div class="l">'+t('paceKmLabel')+'</div></div><div class="sbox"><div class="v">'+kmh+'</div><div class="l">km/h</div></div><div class="sbox"><div class="v">'+(resultDist/1000)+'</div><div class="l">km</div></div></div>';
  // splits
  h+='<div class="lab" style="margin-bottom:8px">'+t('kmSplitsLabel')+'</div><div style="max-height:180px;overflow-y:auto">';
  const nk=Math.floor(resultDist/1000);
  for(let k=1;k<=nk;k++){ const hi=[5,10,21,42].includes(k); h+='<div class="zrow" style="padding:8px 0"><span class="zname" style="'+(hi?'color:var(--e)':'')+'">km '+k+(hi?'':'')+'</span><span class="zval mono">'+fmtTime(spk*k)+'</span></div>'; }
  h+='</div>';
  // actions
  h+='<div class="row" style="gap:8px;margin-top:14px"><button class="btn ghost sm" onclick="saveCalcResult()">'+t('saveLabel')+'</button><button class="btn ghost sm" onclick="copyCalc()">'+t('copyLabel')+'</button><button class="btn ghost sm" onclick="shareCalc()">'+t('share')+'</button></div>';
  h+='<button class="btn sm" style="margin-top:8px" onclick="calcAsGoal()">'+t('addAsGoalLabel')+'</button></div>';
  $('#calcResult').innerHTML=h;
}
function saveCalcResult(){
  if(!calc.lastResult){ toast(t('runCalcFirstToast')); return; }
  toast(t('resultSavedToast'));
}
function copyCalc(){
  if(!calc.lastResult){ toast(t('runCalcFirstToast')); return; }
  const predT=predictTime(getUserVDOT(),resultDist);
  navigator.clipboard&&navigator.clipboard.writeText(tp('ikorunDistInTime',(resultDist/1000),fmtTime(predT)));
  toast(t('copiedShortToast'));
}
function shareApp(){
  const txt='IKORUN — mon app de course à pied';
  if(navigator.share) navigator.share({title:'IKORUN',text:txt,url:location.href}).catch(()=>{});
  else { navigator.clipboard&&navigator.clipboard.writeText(txt+' '+location.href); toast(t('copiedShortToast')); }
}
function shareCalc(){
  const predT=predictTime(getUserVDOT(),resultDist);
  const txt=tp('myIkorunPrediction',(resultDist/1000),fmtTime(predT));
  if(navigator.share) navigator.share({title:'IKORUN',text:txt}); else toast(t('shareNotSupported'));
}
function calcAsGoal(){ addXP(10,t('goalAddedReason')); toast(t('goalAddedToast')); }

/* ---------- FC KARVONEN ---------- */
let fc={max:(P&&P.hrMax)||190,rest:(P&&P.hrRest)||60};
function renderFC(){
  let h='<div class="card"><div class="field"><label>'+t('hrMaxLab')+'</label><div class="stepper"><button onclick="fc.max--;renderFC()">−</button><span class="val">'+fc.max+'</span><button onclick="fc.max++;renderFC()">+</button></div></div>';
  h+='<div class="field"><label>'+t('hrRestLab')+'</label><div class="stepper"><button onclick="fc.rest--;renderFC()">−</button><span class="val">'+fc.rest+'</span><button onclick="fc.rest++;renderFC()">+</button></div></div></div>';
  const zones=[[t('hrZ1'),.5,.6,'--dim'],[t('hrZ2'),.6,.7,'--e'],[t('hrZ3'),.7,.8,'--diamant'],[t('hrZ4'),.8,.9,'--or'],[t('hrZ5'),.9,1,'--bad']];
  h+='<div class="card"><div class="card-t">'+t('hrZonesLab')+'</div>';
  zones.forEach(z=>{ const lo=Math.round(fc.rest+(fc.max-fc.rest)*z[1]); const hi=Math.round(fc.rest+(fc.max-fc.rest)*z[2]);
    h+='<div class="zrow"><span class="zdot" style="background:var('+z[3]+')"></span><span class="zname">'+z[0]+'</span><span class="zval mono">'+lo+'–'+hi+'</span></div>'; });
  h+='</div>';
  $('#outBody').innerHTML=h;
}
/* ---------- IMC ---------- */
let imc={h:(P&&P.height)||175,w:(P&&P.weight)||62};
function renderIMC(){
  let h='<div class="card"><div class="field"><label>'+t('heightCmLab')+'</label><div class="stepper"><button onclick="imc.h--;renderIMC()">−</button><span class="val">'+imc.h+'</span><button onclick="imc.h++;renderIMC()">+</button></div></div>';
  h+='<div class="field"><label>'+t('weightKgLab')+'</label><div class="stepper"><button onclick="imc.w--;renderIMC()">−</button><span class="val">'+imc.w+'</span><button onclick="imc.w++;renderIMC()">+</button></div></div></div>';
  const v=imc.w/Math.pow(imc.h/100,2);
  let cat,col; if(v<18.5){cat=t('imcUnderweight');col='--warn';} else if(v<25){cat=t('imcNormal');col='--ok';} else if(v<30){cat=t('imcOverweight');col='--warn';} else {cat=t('imcObese');col='--bad';}
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
    h+='<div style="width:62px"></div><button class="btn" style="width:84px;height:84px;border-radius:50%;font-size:30px;flex:none;background:var(--ok)" onclick="chronoToggle()" aria-label="'+t('playLab')+'">'+ICN('play',28,'#fff')+'</button><div style="width:62px"></div>';
  } else if(chrono.running){
    h+='<button class="chbtn" onclick="chronoLap()">'+t('lapBtn')+'</button>';
    h+='<button class="btn" style="width:84px;height:84px;border-radius:50%;flex:none;background:var(--warn)" onclick="chronoToggle()" aria-label="'+t('pauseLab')+'">'+ICN('pause',30,'#fff')+'</button>';
    h+='<button class="chbtn" style="border-color:var(--bad);color:var(--bad)" onclick="chronoStop()">'+t('stopBtn')+'</button>';
  } else {
    h+='<button class="chbtn" style="border-color:var(--bad);color:var(--bad)" onclick="chronoReset()">'+t('resetBtn2')+'</button>';
    h+='<button class="btn" style="width:84px;height:84px;border-radius:50%;font-size:30px;flex:none;background:var(--ok)" onclick="chronoToggle()" aria-label="'+t('playLab')+'">'+ICN('play',28,'#fff')+'</button>';
    h+='<button class="chbtn" onclick="chronoLap()">'+t('lapBtn')+'</button>';
  }
  h+='</div></div>';
  // Statistiques des tours
  if(chrono.laps.length){
    const best=Math.min(...chrono.laps), worst=Math.max(...chrono.laps), avg=chrono.laps.reduce((a,b)=>a+b,0)/chrono.laps.length;
    h+='<div class="sgrid" style="margin-bottom:12px"><div class="sbox"><div class="v" style="font-size:15px;color:var(--ok)">'+fmtChrono(best)+'</div><div class="l">'+t('bestLap')+'</div></div><div class="sbox"><div class="v" style="font-size:15px;color:var(--bad)">'+fmtChrono(worst)+'</div><div class="l">'+t('slowestLap')+'</div></div><div class="sbox"><div class="v" style="font-size:15px">'+fmtChrono(avg)+'</div><div class="l">'+t('avgLap')+'</div></div><div class="sbox"><div class="v">'+chrono.laps.length+'</div><div class="l">'+t('lapsLab')+'</div></div></div>';
    h+='<div class="card"><div class="row" style="margin-bottom:8px"><div class="card-t" style="margin:0">'+t('lapsLab')+'</div><span style="font-size:12px;color:var(--e);cursor:pointer" onclick="exportLaps()">'+t('exportBtn')+'</span></div>';
    [...chrono.laps].reverse().forEach((l,ri)=>{ const i=chrono.laps.length-1-ri; const isBest=l===best&&chrono.laps.length>1, isWorst=l===worst&&chrono.laps.length>1;
      h+='<div class="zrow"><span class="zname">'+t('lapBtn')+' '+(i+1)+(isBest?' <span style="color:var(--ok);font-size:11px">'+t('fastTag')+'</span>':isWorst?' <span style="color:var(--bad);font-size:11px">'+t('slowTag')+'</span>':'')+'</span><span class="zval mono" style="'+(isBest?'color:var(--ok)':isWorst?'color:var(--bad)':'')+'">'+fmtChrono(l)+'</span></div>'; });
    h+='</div>';
  }
  $('#outBody').innerHTML=h;
}
function chronoStop(){ chrono.running=false; chrono.elapsed+=Date.now()-chrono.start; cancelAnimationFrame(chrono.raf); sfx('stop'); stopBgActivity(); renderChrono(); }
function chronoReset(){ chrono={running:false,start:0,elapsed:0,laps:[],raf:null}; renderChrono(); }
function exportLaps(){
  let txt='IKORUN Chronomètre\n'; chrono.laps.forEach((l,i)=>txt+=t('lapBtn')+' '+(i+1)+' : '+fmtChrono(l)+'\n');
  if(navigator.share) navigator.share({title:'Chrono IKORUN',text:txt}); else { navigator.clipboard&&navigator.clipboard.writeText(txt); toast(t('lapsCopied')); }
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
  h+='<div class="row" style="gap:10px"><button class="btn ghost" onclick="addTimer(60)">+1min</button><button class="btn" onclick="timerToggle()">'+(timer.running?'Pause':'▶ Start')+'</button><button class="btn ghost" onclick="resetTimer()">↺</button></div></div>';
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
  if(timer.left<=0){ toast(t('setDuration')); return; }
  timer.running=true; timer.endAt=Date.now()+timer.left*1000; sfx('start'); startBgActivity(t('quickTimer')); renderTimer();
  timer.iv=setInterval(()=>{
    // basé sur l'horloge → reste exact même en arrière-plan
    timer.left=Math.max(0,Math.round((timer.endAt-Date.now())/1000));
    const pct=timer.left/timer.total*100;
    const col=pct>50?'var(--e)':pct>20?'var(--warn)':'var(--bad)';
    const r=$('#tmRing'),n=$('#tmNum');
    if(r)r.innerHTML=ringSVG(180,pct,12,col); if(n)n.textContent=fmtMS(timer.left);
    if(timer.left<=0){ clearInterval(timer.iv); timer.running=false; timer.endAt=null; burst(); stopBgActivity(); startAlarm('Minuteur terminé','Le temps est écoulé !'); renderTimer(); }
  },250);
}
function resetTimer(){ clearInterval(timer.iv); timer.running=false; timer.endAt=null; stopAlarm(); stopBgActivity(); timer.left=timer.total=timer.m*60+timer.s||300; renderTimer(); }

/* ---------- AGENDA ---------- */
function renderAgenda(){
  let h='<button class="btn" style="margin-bottom:14px" onclick="addEvent()">'+t('addEventBtn')+'</button>';
  const evts=[...AGENDA].sort((a,b)=>new Date(a.date)-new Date(b.date));
  if(P.compDate) evts.unshift({date:P.compDate,title:''+(P.goal||t('competitionDefault')),fixed:true});
  if(!evts.length) h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('calendar',36,'currentColor')+'</div><div style="font-size:13px">'+t('noEventLab')+'</div></div></div>';
  else evts.forEach((e,i)=>{
    const dd=daysBetween(new Date(),new Date(e.date));
    h+='<div class="card"><div class="row"><div><div style="font-weight:700">'+escHtml(e.title)+'</div><div style="font-size:12px;color:var(--muted);margin-top:2px">'+fmtDate(e.date)+' · '+(dd>=0?'J-'+dd:t('pastLab'))+'</div></div>'+(e.fixed?'':'<button class="x" onclick="delEvent('+(i-(P.compDate?1:0))+')">'+ICN('trash',16)+'</button>')+'</div></div>';
  });
  $('#outBody').innerHTML=h;
}
function addEvent(){
  const ti=prompt(t('eventTitlePrompt')); if(!ti)return;
  const d=prompt(t('eventDatePrompt'),todayKey()); if(!d)return;
  AGENDA.push({title:ti,date:d}); saveAll(); renderAgenda(); toast(t('eventAdded'));
}
function delEvent(i){ AGENDA.splice(i,1); saveAll(); renderAgenda(); }

/* ---------- PRIÈRES (Béjaïa, UOIF) ---------- */
function renderPriere(){
  const times=prayerTimes();
  const now=new Date(); const nowMin=now.getHours()*60+now.getMinutes();
  const order=['Fajr','Dhuhr','Asr','Maghrib','Isha'];
  let activeIdx=-1;
  order.forEach((p,i)=>{ const[hh,mm]=times[p].split(':').map(Number); if(hh*60+mm<=nowMin) activeIdx=i; });
  let h='<div class="card"><div class="card-t">'+t('prayerTitle')+'</div><div style="font-size:12px;color:var(--muted);margin-bottom:14px">'+tp('uoifMethod',now.toLocaleDateString(localeCode(),{weekday:'long',day:'numeric',month:'long'}))+'</div>';
  const icons={Fajr:'sun',Dhuhr:'sun',Asr:'sun',Maghrib:'moon',Isha:'moon'};
  order.forEach((p,i)=>{
    const act=i===activeIdx;
    h+='<div class="zrow" style="'+(act?'background:var(--ed);border-radius:12px;padding:11px 12px;margin:0 -4px':'')+'"><span style="display:inline-flex">'+ICN(icons[p],18)+'</span><span class="zname" style="margin-left:8px;'+(act?'color:var(--e)':'')+'">'+p+'</span><span class="zval mono" style="'+(act?'color:var(--e);font-weight:700':'')+'">'+times[p]+'</span></div>';
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
  // Photo validée (et non simplement échappée) : une valeur restaurée depuis un
  // fichier importé ou une synchro pourrait sinon fermer l'attribut style et
  // injecter du HTML ici, ce sink n'ayant historiquement aucun échappement.
  const ph=safePhotoUrl(P.photo);
  if(ph) return '<div style="width:'+size+'px;height:'+size+'px;border-radius:50%;background-image:url(\''+ph+'\');background-size:cover;background-position:center;margin:0 auto;border:2.5px solid rgba(var(--e-rgb),.35);box-shadow:0 6px 18px -6px rgba(var(--e-rgb),.4)"></div>';
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
    '<div class="pf-cam" onclick="changePhoto()">'+ICN('camera',16)+'</div></div>';
  h+='<div class="pf-name-row"><div class="man" style="font-weight:800;font-size:20px">'+escHtml(P.name||t('athleteDefault'))+'</div>'+
    '<div class="pf-edit" onclick="openProfileEdit()" title="'+t('editInfos')+'">'+ICN('edit',16)+'</div></div>';
  h+='<div style="font-size:12.5px;color:var(--muted);margin-top:3px" onclick="editBio()">'+escHtml(window.currentUserEmail||P.bio||t('addBioPrompt'))+'</div>';
  h+='<div class="rankchip" style="margin-top:11px;background:'+rk.bg+';color:#fff">'+t('level')+' '+XP.level+' · '+rk.name+' · '+XP.total+' XP</div>';
  h+='</div>';
  // ===== APERÇU RAPIDE — carte unique, une ligne par info (au lieu d'une grille + bannière séparées) =====
  h+='<div class="grp-card stag" style="animation-delay:.04s">'+
    '<div class="grp-row no-chev"><div class="lr-icon">'+ICN('scale',20,'currentColor')+'</div><div class="lr-title">'+t('heightWeight')+'</div><div class="lr-val">'+(P.height||'—')+' cm · '+(P.weight||'—')+' kg</div></div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">'+ICN('calendar',20,'currentColor')+'</div><div class="lr-title">'+t('age')+'</div><div class="lr-val">'+age()+' '+(curLang()==='en'?'yo':curLang()==='ar'?'سنة':'ans')+'</div></div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">'+ICN('chart',20,'currentColor')+'</div><div class="lr-title">VDOT</div><div class="lr-val">'+(getUserVDOT()||'—')+'</div></div>'+
    '<div class="grp-row" onclick="nav(\'sport\');sportTab=\'run\';runSub=\'ia\';renderSport()"><div class="lr-icon">'+ICN('target',20,'currentColor')+'</div><div class="lr-title">'+t('objective')+'</div><div class="lr-val">'+escHtml(trRace(P.objRace)||P.goal||t('noObjective'))+(compDays!==null&&compDays>=0?' · J-'+compDays:'')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  // ===== PROGRESSION — badges intégrés directement au profil =====
  { const unlocked=unlockedBadges(); const recent=[...unlocked].sort((a,b)=>b.date<a.date?-1:1).slice(0,5).map(u=>BADGE_TIERS.find(b=>b.key===u.key)).filter(Boolean);
    h+='<div class="sec-head stag" style="animation-delay:.06s"><h3 class="grp-lab" style="margin:0">'+t('progression')+'</h3><span class="see" onclick="openBadges()">'+tp('seeAllProgress',unlocked.length,BADGE_TIERS.length)+'</span></div>';
    h+='<div class="card stag" style="animation-delay:.07s">';
    if(recent.length){
      h+='<div class="row" style="gap:10px;flex-wrap:wrap">'+recent.map(b=>'<div class="bd-icon '+b.cls+'" style="width:52px;height:52px;cursor:pointer" onclick="openBadgeQuick(\''+b.key+'\')">'+bdGlyph(b.key)+'</div>').join('')+'</div>';
    } else {
      h+='<div style="font-size:12px;color:var(--muted)">'+t('noBadgeYet')+'</div>';
    }
    const nb=nextBadge();
    if(nb){
      const prog=badgeProgress(nb);
      h+='<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--hair)"><div class="row" style="margin-bottom:6px"><span style="font-size:12px;color:var(--muted)">'+tp('nextBadgeLab',nb.name)+'</span><span class="mono" style="font-size:12px;color:var(--e)">'+prog.pct+'%</span></div><div class="pbar" style="height:6px"><div style="width:'+prog.pct+'%"></div></div></div>';
    }
    h+='</div>';
  }
  // ===== SECTIONS GROUPÉES — 4 groupes à vocation unique (avant : 3 groupes qui
  // mélangeaient données/apparence/compte, plus deux liens différents ("Données
  // & confidentialité" et "Centre d'aide") qui ouvraient le MÊME écran — d'où
  // la confusion. Suivi = regarder son historique ; Compte = son identité ;
  // Apparence = ce que l'app montre ; Assistance = tout le reste, une fois. =====
  h+='<div class="grp-lab stag" style="animation-delay:.09s">'+t('trackingLab')+'</div>';
  h+='<div class="grp-card stag" style="animation-delay:.10s">'+
    '<div class="grp-row pf-club-row" onclick="openClub()"><div class="lr-icon">'+ICN('flag',20,'currentColor')+'</div><div class="lr-title">'+t('myClubLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openFriends()"><div class="lr-icon">'+ICN('users',20,'currentColor')+'</div><div class="lr-title">'+t('friendsRanking')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openRecords()"><div class="lr-icon">'+ICN('medal',20,'currentColor')+'</div><div class="lr-title">'+t('historyRecords')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="nav(\'stats\')"><div class="lr-icon">'+ICN('chart',20,'currentColor')+'</div><div class="lr-title">'+t('statistics')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  h+='<div class="grp-lab stag" style="animation-delay:.12s">'+t('account')+'</div>';
  h+='<div class="grp-card stag" style="animation-delay:.13s">'+
    '<div class="grp-row" onclick="openProfileEdit()"><div class="lr-icon">'+ICN('users',20,'currentColor')+'</div><div class="lr-title">'+t('manageProfile')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'account\')"><div class="lr-icon">'+ICN('lock',20,'currentColor')+'</div><div class="lr-title">'+t('passwordSecurity')+'</div><div class="lr-val">'+(window.currentUserEmail||(window.isGuestUser?t('guestModeLabel'):t('notConnected')))+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'notif\')"><div class="lr-icon">'+ICN('bell',20,'currentColor')+'</div><div class="lr-title">'+t('notifLabel')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  h+='<div class="grp-lab stag" style="animation-delay:.15s">'+t('appearanceLab')+'</div>';
  h+='<div class="grp-card stag" style="animation-delay:.16s">'+
    '<div class="grp-row" onclick="openProfileSection(\'lang\')"><div class="lr-icon">'+ICN('globe',20,'currentColor')+'</div><div class="lr-title">'+t('language')+'</div><div class="lr-val">'+langInfo[1]+' '+langInfo[2]+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">'+ICN('palette',20,'currentColor')+'</div><div class="lr-title">'+t('theme')+'</div>'+pfThemeSwitchHTML()+'</div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">'+ICN('palette',20,'currentColor')+'</div><div class="lr-title">'+t('appColor')+'</div>'+pfAccentPickerHTML()+'</div>'+
    '<div class="grp-row no-chev"><div class="lr-icon">'+ICN('heart',20,'currentColor')+'</div><div><div class="lr-title">'+t('simplifiedMode')+'</div><div style="font-size:11px;color:var(--muted);margin-top:2px;max-width:200px">'+t('simplifiedModeDesc')+'</div></div><div class="toggle'+(P.easyMode?' on':'')+'" onclick="event.stopPropagation();toggleEasyMode()"></div></div>'+
  '</div>';
  h+='<div class="grp-lab stag" style="animation-delay:.18s">'+t('support')+'</div>';
  h+='<div class="grp-card stag" style="animation-delay:.19s">'+
    '<div class="grp-row" onclick="openFeedback()"><div class="lr-icon">'+ICN('comment',20,'currentColor')+'</div><div class="lr-title">'+t('sendFeedbackLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    (isStandalone()?'':'<div class="grp-row" onclick="installApp()"><div class="lr-icon">'+ICN('download',20,'currentColor')+'</div><div class="lr-title">'+t('installAppBtn')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>')+
    '<div class="grp-row" onclick="startAppTour()"><div class="lr-icon">'+ICN('flag',20,'currentColor')+'</div><div class="lr-title">'+t('replayTourBtn')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'terms\')"><div class="lr-icon">'+ICN('clipboard',20,'currentColor')+'</div><div class="lr-title">'+t('termsOfUseLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'privacy\')"><div class="lr-icon">'+ICN('shield',20,'currentColor')+'</div><div class="lr-title">'+t('privacyPolicyLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'data\')"><div class="lr-icon">'+ICN('lock',20,'currentColor')+'</div><div class="lr-title">'+t('dataPrivacy')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  h+='<div style="text-align:center;color:var(--dim);font-size:12px;margin:20px 0">'+t('footerTag')+'</div>';
  $('#s-profil').innerHTML=h;
}
function renderProfileSimple(){
  const rk=rankFor(XP.level||1);
  const compDays=P.compDate?daysBetween(new Date(),new Date(P.compDate)):null;
  let h='';
  h+='<div class="card stag pf-hero" style="animation-delay:0s;text-align:center"><div class="pf-avwrap">'+avatarHTML(72,28)+'</div>'+
    '<div class="man" style="font-weight:800;font-size:18px;margin-top:8px">'+escHtml(P.name||t('athleteDefault'))+'</div>'+
    '<div style="font-size:12px;color:var(--muted);margin-top:2px">'+age()+' '+(curLang()==='en'?'yo':curLang()==='ar'?'سنة':'ans')+' · VDOT '+(getUserVDOT()||'—')+(compDays!==null&&compDays>=0?' · J-'+compDays:'')+'</div>'+
    '<div class="rankchip" style="margin-top:10px;background:'+rk.bg+';color:#fff;display:inline-block">'+t('level')+' '+XP.level+' · '+rk.name+'</div></div>';

  h+='<div class="grp-lab stag" style="animation-delay:.05s">'+t('yourSpace')+'</div>';
  h+='<div class="grp-card stag" style="animation-delay:.06s">'+
    '<div class="grp-row pf-club-row" onclick="openClub()"><div class="lr-icon">'+ICN('flag',20,'currentColor')+'</div><div class="lr-title">'+t('myClubLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openFriends()"><div class="lr-icon">'+ICN('users',20,'currentColor')+'</div><div class="lr-title">'+t('friendsRanking')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="nav(\'stats\')"><div class="lr-icon">'+ICN('chart',20,'currentColor')+'</div><div class="lr-title">'+t('statistics')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openBadges()"><div class="lr-icon">'+ICN('medal',20,'currentColor')+'</div><div class="lr-title">'+t('badgesLabel')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="nav(\'outils\')"><div class="lr-icon">'+ICN('calculator',20,'currentColor')+'</div><div class="lr-title">'+t('toolsCalc')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileEdit()"><div class="lr-icon">'+ICN('edit',20,'currentColor')+'</div><div class="lr-title">'+t('editMyProfile')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';

  h+='<div class="grp-lab stag" style="animation-delay:.08s">'+t('settings')+'</div>';
  h+='<div class="grp-card stag" style="animation-delay:.09s">'+
    '<div class="grp-row no-chev"><div class="lr-icon">'+ICN('heart',20,'currentColor')+'</div><div class="lr-title">'+t('simplifiedMode')+'</div><div class="toggle on" onclick="event.stopPropagation();toggleEasyMode()"></div></div>'+
    '<div class="grp-row" onclick="startAppTour()"><div class="lr-icon">'+ICN('flag',20,'currentColor')+'</div><div class="lr-title">'+t('replayTourBtn')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'account\')"><div class="lr-icon">'+ICN('lock',20,'currentColor')+'</div><div class="lr-title">'+t('account')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openFeedback()"><div class="lr-icon">'+ICN('comment',20,'currentColor')+'</div><div class="lr-title">'+t('sendFeedbackLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    (isStandalone()?'':'<div class="grp-row" onclick="installApp()"><div class="lr-icon">'+ICN('download',20,'currentColor')+'</div><div class="lr-title">'+t('installAppBtn')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>')+
    '<div class="grp-row" onclick="openProfileSection(\'terms\')"><div class="lr-icon">'+ICN('clipboard',20,'currentColor')+'</div><div class="lr-title">'+t('termsOfUseLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
    '<div class="grp-row" onclick="openProfileSection(\'privacy\')"><div class="lr-icon">'+ICN('shield',20,'currentColor')+'</div><div class="lr-title">'+t('privacyPolicyLab')+'</div><span class="lr-chev">'+ICN('chevronR',16)+'</span></div>'+
  '</div>';
  return h;
}
/* ---- Fiches de réglages du profil, ouvertes dans l'overlay générique ---- */
let _pfSheet=null;
function openProfileSection(key){
  _pfSheet=key;
  const titles={account:t('account'),lang:''+t('language'),appearance:''+t('appearance'),notif:''+t('notifsApp'),data:''+t('dataPrivacy'),terms:t('termsOfUseLab'),privacy:t('privacyPolicyLab')};
  $('#ovProgTitle').textContent=titles[key]||t('settings');
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
  if(key==='terms') return legalTermsHTML();
  if(key==='privacy') return legalPrivacyHTML();
  return '';
}
/* ---------- CGU & CONFIDENTIALITÉ ----------
   Contenu juridique volontairement gardé en français uniquement (langue de
   référence), quelle que soit la langue de l'app : un texte légal traduit
   à la volée risquerait de perdre en précision. À adapter/faire relire par
   un professionnel avant publication — remplace les [crochets] par tes
   vraies coordonnées (nom/société, email de contact). */
const LEGAL_LAST_UPDATE='6 septembre 2026';
function legalP(title,body){ return '<div style="font-weight:800;font-size:13.5px;margin:16px 0 6px;color:var(--snow)">'+title+'</div><div style="font-size:12.5px;color:var(--muted);line-height:1.65">'+body+'</div>'; }
function legalWrapHTML(bodyHtml){
  return '<div class="card" style="padding:16px">'+
    '<div style="font-size:11px;color:var(--dim);margin-bottom:2px">Dernière mise à jour : '+LEGAL_LAST_UPDATE+'</div>'+
    '<div style="font-size:11px;color:var(--dim);margin-bottom:4px">Document de référence rédigé en français.</div>'+
    bodyHtml+
    '</div>';
}
function legalTermsHTML(){
  const b=legalP('1. Objet',
    'Les présentes Conditions Générales d’Utilisation (« CGU ») régissent l’accès et l’utilisation de l’application IKORUN (« l’Application »), une application de coaching sportif (course à pied et musculation) éditée par IKORUN, ci-après « l’Éditeur ». En créant un compte ou en utilisant l’Application, tu acceptes sans réserve les présentes CGU.')
  +legalP('2. Description du service',
    'IKORUN propose : la génération de plans d’entraînement personnalisés (course à pied et musculation) à partir des informations que tu renseignes (niveau, objectif, performances passées…) ; le suivi de tes séances, statistiques et progrès ; des fonctionnalités sociales optionnelles (ajout d’amis et classement entre amis, création ou adhésion à un club via un code à 6 caractères avec classement entre membres du club) ; des outils de calcul (allures, VDOT, etc.) ; un formulaire d’avis qui ouvre ton application mail avec un message pré-rempli, rien n’étant envoyé sans que tu appuies toi-même sur « Envoyer ». L’Application fonctionne en mode « invité » (sans compte permanent) ou avec un compte (email/mot de passe ou connexion Google). IKORUN est distribuée uniquement comme application web installable depuis ton navigateur : elle n’est présente ni sur l’App Store ni sur le Play Store.')
  +legalP('3. Avertissement santé et sport — à lire attentivement',
    'IKORUN n’est pas un dispositif médical et ne fournit aucun avis médical. Les plans d’entraînement générés le sont par des algorithmes génériques et ne remplacent pas l’avis d’un professionnel de santé. Avant de commencer tout programme, en particulier en cas d’antécédents médicaux, de condition de santé particulière, ou de reprise d’activité après une longue interruption, consulte un médecin. Tu es seul(e) responsable de l’évaluation de ta condition physique et des risques liés à la pratique sportive. L’Éditeur ne pourra être tenu responsable de blessures, malaises ou dommages résultant de l’utilisation des plans ou conseils fournis par l’Application.')
  +legalP('4. Compte utilisateur',
    'Tu es responsable de la confidentialité de tes identifiants et de toute activité effectuée depuis ton compte. Les informations fournies doivent être exactes. Tu peux à tout moment exporter tes données depuis Profil > Données & confidentialité, et supprimer définitivement ton compte depuis Profil > Compte > Zone de danger.')
  +legalP('5. Contenu et comportement',
    'Ton nom d’utilisateur, ta photo de profil et les contenus que tu partages via les fonctionnalités sociales doivent rester respectueux, ne pas usurper l’identité d’un tiers, et respecter la loi. L’Éditeur se réserve le droit de suspendre ou supprimer tout compte enfreignant ces règles.')
  +legalP('6. Propriété intellectuelle',
    'L’Application, son design, sa marque et son contenu (hors contenu fourni par les utilisateurs) sont la propriété de l’Éditeur ou de ses partenaires et protégés par le droit de la propriété intellectuelle. Certaines images d’exercices proviennent de la base de données publique « free-exercise-db » (domaine public).')
  +legalP('7. Disponibilité du service',
    'L’Éditeur s’efforce d’assurer un accès continu à l’Application, sans garantir une disponibilité ininterrompue (maintenance, mise à jour, cas de force majeure). L’Application fonctionne partiellement hors-ligne mais nécessite une connexion pour la synchronisation cloud, la connexion et les fonctionnalités sociales.')
  +legalP('8. Limitation de responsabilité',
    'Dans les limites permises par la loi, l’Éditeur ne pourra être tenu responsable des dommages indirects résultant de l’utilisation ou de l’impossibilité d’utiliser l’Application, ni de l’exactitude parfaite des calculs, statistiques ou plans générés, fournis « en l’état ».')
  +legalP('9. Résiliation',
    'Tu peux cesser d’utiliser l’Application et supprimer ton compte à tout moment. L’Éditeur peut suspendre ou résilier l’accès d’un utilisateur en cas de violation des présentes CGU.')
  +legalP('10. Modification des CGU',
    'L’Éditeur peut modifier les présentes CGU à tout moment, notamment pour refléter une évolution de l’Application ou de la réglementation. La date de dernière mise à jour figure en haut de ce document ; toute modification substantielle te sera signalée dans l’Application.')
  +legalP('11. Droit applicable et litiges',
    'Les présentes CGU sont soumises au droit français. En cas de difficulté, commence par contacter l’Éditeur à l’adresse indiquée ci-dessous : la plupart des situations se règlent ainsi. À défaut d’accord, tu peux recourir gratuitement à un médiateur de la consommation, ou utiliser la plateforme européenne de règlement en ligne des litiges (ec.europa.eu/consumers/odr). Si aucune solution amiable n’aboutit, le litige relève des tribunaux français compétents ; en qualité de consommateur, tu peux saisir la juridiction de ton lieu de résidence.')
  +legalP('12. Contact',
    'Pour toute question relative aux présentes CGU : ikorunn@gmail.com.');
  return legalWrapHTML(b);
}
function legalPrivacyHTML(){
  const b=legalP('1. Responsable du traitement',
    'Le responsable du traitement des données à caractère personnel collectées via IKORUN est l’éditeur de l’application, joignable à ikorunn@gmail.com.')
  +legalP('2. Données collectées',
    'Selon ton mode de connexion et ton usage de l’Application, nous traitons : les données de compte (email, mot de passe chiffré ou identifiant Google) ; les données de profil (prénom, date de naissance, sexe, taille, poids, niveau, objectifs, photo si tu en ajoutes une) ; les données d’entraînement et de ressenti que tu saisis (séances, performances, records, historique, mais aussi difficulté ressentie, fatigue, sommeil, douleurs éventuelles) ; les indicateurs calculés à partir de celles-ci (XP, niveau, VDOT, kilomètres et séances cumulés, série de jours consécutifs) ; les données sociales optionnelles (pseudo, liste d’amis, appartenance à un club) si tu utilises ces fonctionnalités ; enfin les données techniques inhérentes à tout service en ligne, conservées par notre hébergeur (adresse IP, journaux de connexion) ainsi qu’un compteur anti-abus limitant le nombre d’actions sensibles par heure. Certaines de ces informations touchent à ta santé (poids, douleurs, fatigue) : tu les saisis librement et rien ne t’oblige à les renseigner. IKORUN ne collecte pas ta localisation GPS et n’accède à aucun capteur de ton appareil. Le mode « invité » crée lui aussi un compte technique sur nos serveurs, avec un pseudo attribué automatiquement.')
  +legalP('3. Finalités',
    'Ces données sont utilisées pour fournir le service (génération de plans, suivi, statistiques), synchroniser tes données entre tes appareils, permettre les fonctionnalités sociales optionnelles que tu actives, et protéger le service contre les abus. Elles ne sont ni vendues ni louées, et ne servent à aucune publicité.')
  +legalP('4. Base légale',
    'Le traitement repose sur l’exécution du contrat qui te lie à l’Éditeur (fourniture du service demandé) et, pour les fonctionnalités optionnelles (photo, réseau social), sur ton consentement.')
  +legalP('5. Données visibles par d’autres utilisateurs',
    'Certaines fonctionnalités font volontairement sortir des données de ton espace privé — c’est leur raison d’être, et elles restent facultatives. Ton profil public (pseudo, photo, niveau, XP, VDOT, kilomètres et séances cumulés, série de jours) est visible par les autres utilisateurs connectés qui te recherchent par ton pseudo ou t’ajoutent en ami. Si tu crées ou rejoins un club, ton pseudo, ta photo, ton niveau et ton XP apparaissent dans le classement de ce club : toute personne détenant le code à 6 caractères du club peut le rejoindre et voir ces informations. En revanche, le détail de tes séances, tes ressentis, tes douleurs et tes mesures corporelles ne sont JAMAIS partagés, ni avec tes amis, ni avec les membres de ton club. Tu peux quitter un club ou retirer un ami à tout moment, ce qui te retire aussitôt du classement correspondant.')
  +legalP('6. Hébergement et destinataires',
    'Tes données sont hébergées chez Supabase, sur des serveurs situés dans l’Union européenne (Irlande). Y ont accès : l’Éditeur ; Supabase en tant qu’hébergeur ; les autres utilisateurs, uniquement dans les limites décrites à l’article précédent. Si tu choisis la connexion Google, celle-ci est gérée par Google LLC selon sa propre politique de confidentialité, ce qui implique un transfert vers les États-Unis encadré par le cadre de protection des données UE–États-Unis. Par ailleurs, pour afficher les polices de caractères, charger une bibliothèque technique et afficher les images d’exercices, ton navigateur contacte trois services externes : Google Fonts, jsDelivr et GitHub. Ces services reçoivent de ce fait ton adresse IP, sans qu’aucune donnée d’entraînement ne leur soit transmise. Tu peux les bloquer avec une extension de navigateur : l’Application reste utilisable, avec un affichage dégradé.')
  +legalP('7. Durée de conservation et suppression',
    'Tes données sont conservées tant que ton compte est actif. Tu peux exporter une copie complète au format JSON depuis Profil > Données & confidentialité, et supprimer définitivement ton compte depuis Profil > Compte > Zone de danger. La suppression efface ton compte, ton profil public, tes données d’entraînement, tes liens d’amitié, ton appartenance à un club et les clubs dont tu es propriétaire ; elle est immédiate et irréversible. Attention à ne pas confondre avec « Réinitialiser », dans Données & confidentialité, qui n’efface que cet appareil et laisse ton compte intact. Les sauvegardes techniques de l’hébergeur peuvent conserver une copie résiduelle quelques jours avant d’être écrasées.')
  +legalP('8. Tes droits',
    'Conformément au RGPD, tu disposes d’un droit d’accès, de rectification, d’effacement, de portabilité (export JSON disponible dans l’Application), de limitation du traitement et d’opposition sur tes données. Tu peux également retirer à tout moment ton consentement aux fonctionnalités optionnelles (photo de profil, amis, club) — le retrait ne remet pas en cause ce qui a été fait avant. Tu peux enfin définir des directives sur le sort de tes données après ton décès. Pour exercer ces droits, utilise les outils intégrés à l’Application ou contacte ikorunn@gmail.com. Tu peux aussi introduire une réclamation auprès de la CNIL (www.cnil.fr).')
  +legalP('9. Décisions automatisées',
    'Tes plans d’entraînement sont générés et ajustés automatiquement par un moteur de règles qui fonctionne intégralement sur ton appareil, à partir des informations que tu renseignes. Aucune intelligence artificielle ni service tiers n’intervient dans ce calcul. Ces plans sont des suggestions sportives : ils ne produisent aucun effet juridique, et tu peux les modifier ou les ignorer à tout moment.')
  +legalP('10. Stockage local et cookies',
    'L’Application utilise le stockage local de ton navigateur (localStorage) pour fonctionner hors-ligne et mémoriser tes préférences, IndexedDB pour conserver la clé de chiffrement propre à ton appareil, et le cache d’un service worker pour l’affichage hors-ligne. Ces éléments restent sur ton appareil. Aucun cookie publicitaire, aucun traceur d’audience et aucun outil de mesure tiers ne sont utilisés.')
  +legalP('11. Sécurité',
    'Sur ton appareil, tes données d’entraînement sont chiffrées (AES-GCM 256 bits) avant d’être stockées dans le navigateur ; la clé est générée localement, non exportable, et n’est envoyée nulle part. Les échanges avec le serveur passent par HTTPS. En revanche, sois conscient(e) que la copie sauvegardée sur nos serveurs n’est pas chiffrée de bout en bout : elle est techniquement lisible par l’hébergeur et par l’Éditeur, et protégée par les contrôles d’accès de la base de données ainsi que par le chiffrement disque de l’hébergeur. Aucun système n’est infaillible ; en cas de faille de sécurité avérée, tu en serais informé(e) conformément à la réglementation.')
  +legalP('12. Mineurs',
    'L’Application s’adresse aux personnes de 15 ans et plus. En dessous de cet âge, l’accord d’un parent ou tuteur légal est requis pour créer un compte, conformément à la réglementation française sur le consentement numérique. Cette règle n’est pas vérifiée automatiquement à l’inscription : elle relève de ta responsabilité, et celle du représentant légal pour un mineur.')
  +legalP('13. Modifications',
    'Cette politique peut évoluer ; la date de mise à jour est indiquée en haut de ce document.')
  +legalP('14. Contact',
    'Pour toute question relative à tes données : ikorunn@gmail.com.');
  return legalWrapHTML(b);
}
function pfAccountHTML(){
  if(window.currentUserEmail){
    return '<div class="card" style="padding:16px">'+
      '<div class="row" style="justify-content:space-between;align-items:center">'+
        '<div class="row" style="gap:12px">'+
          '<div style="width:44px;height:44px;border-radius:50%;background:var(--ed);color:var(--e);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0">'+(P.name?P.name[0].toUpperCase():'?')+'</div>'+
          '<div><div style="font-weight:700">'+escHtml(P.name||'Athlète')+'</div><div style="font-size:12px;color:var(--muted)">'+escHtml(window.currentUserEmail)+'</div></div>'+
        '</div>'+
        '<span class="badge" style="font-size:10px;flex-shrink:0">Google</span>'+
      '</div>'+
      '<div style="font-size:11px;color:var(--dim);margin-top:12px">'+t('syncedCloudLab')+'</div>'+
      '<div class="row" style="gap:8px;margin-top:14px"><button class="btn ghost sm" style="flex:1" onclick="addAnotherAccount()">'+t('addAccountBtn')+'</button>'+
      '<button class="btn ghost sm" style="flex:1;color:var(--bad)" onclick="logout()">'+t('logout')+'</button></div>'+
    '</div>'+
    '<div class="card" style="padding:16px;margin-top:12px;border-color:rgba(255,92,108,.35);background:rgba(255,92,108,.05)">'+
      '<div class="card-t" style="color:var(--bad)">'+ICN('warning',15,'var(--bad)')+t('dangerZoneLab')+'</div>'+
      '<div style="font-size:11.5px;color:var(--muted);margin-bottom:12px;line-height:1.5">'+t('deleteAccountDesc')+'</div>'+
      '<button class="btn ghost sm" style="color:var(--bad);width:100%" onclick="deleteAccountCompletely()">'+t('deleteAccountBtn')+'</button>'+
    '</div>';
  }
  if(window.isGuestUser){
    if(_guestUpgradeSent){
      return '<div class="card" style="padding:16px">'+
        '<div class="card-t">'+ICN('check',15,'var(--ok)')+t('guestModeTitle')+'</div>'+
        '<div style="font-size:12.5px;color:var(--muted);line-height:1.5">'+t('guestUpgradeSentToast')+'</div>'+
      '</div>';
    }
    return '<div class="card" style="padding:16px">'+
      '<div class="row" style="gap:12px;align-items:center">'+
        '<div style="width:44px;height:44px;border-radius:50%;background:var(--ed);color:var(--e);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;flex-shrink:0">'+(P.name?P.name[0].toUpperCase():'?')+'</div>'+
        '<div><div style="font-weight:700">'+escHtml(P.name||'Athlète')+'</div><div style="font-size:12px;color:var(--muted)">'+t('guestModeTitle')+'</div></div>'+
      '</div>'+
      '<div style="font-size:12px;color:var(--muted);margin-top:12px;line-height:1.5">'+t('guestModeDesc')+'</div>'+
      // Le passage invité -> compte durable passait par un email de confirmation,
      // soumis au même quota d'envoi que l'inscription : il échouait donc sans
      // rien dire. On propose Google à la place tant qu'aucun SMTP n'est branché.
      '<div class="uname-status" id="guestStatus"></div>'+
      googleBtnHtml()+
    '</div>';
  }
  return '<button class="btn" onclick="signInWithGoogle()">Se connecter</button>';
}
let _guestUpgradeSent=false;
async function convertGuestAccount(){
  if(!window.supabaseClient || _guestAuthing) return;
  const emailEl=$('#guestEmail'), email=(emailEl&&emailEl.value||'').trim();
  const st=$('#guestStatus');
  const setSt=(msg,kind)=>{ if(st){ st.textContent=msg||''; st.className='uname-status'+(kind?(' '+kind):''); } };
  if(!email || !isEmailValid(email)) return setSt(t('invalidEmailToast'),'bad');
  _guestAuthing=true; setSt(t('sendingResetToast'),'checking');
  try{
    // Associe un email à la session invité en cours (même uid conservé) : le
    // reste (choix du mot de passe) se fait via "mot de passe oublié" une fois
    // l'email confirmé — cf convertGuestAccount() dans le message de livraison.
    const { error } = await window.supabaseClient.auth.updateUser({ email });
    if(error){
      console.error('updateUser(email) error',error);
      setSt(/already|exists|registered/i.test(error.message||'')?t('guestUpgradeEmailUsedToast'):t('authGenericErrorToast'),'bad');
    } else {
      _guestUpgradeSent=true;
      refreshPfSheet();
    }
  }catch(e){ console.error('updateUser(email) exception',e); setSt(t('authGenericErrorToast'),'bad'); }
  _guestAuthing=false;
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
     '<span style="font-size:14px;color:var(--muted);display:inline-flex;align-items:center;gap:5px">'+(isLight?ICN('sun',15)+'Clair':ICN('moon',15)+'Sombre')+'</span>'+
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
    const lab=el.previousElementSibling; if(lab) lab.innerHTML=(next==='light'?ICN('sun',15)+'Clair':ICN('moon',15)+'Sombre');
    setTimeout(()=>el.classList.remove('pulse','burst'),600);
  }
  sfx&&sfx('tap');
}
// Bascule le rappel d'entraînement (référencé par pfNotifHTML, existait pas -> toggle mort)
function toggleNotif(el){
  P.notif=(P.notif===false)?true:false;
  if(el) el.classList.toggle('on',P.notif!==false);
  if(P.notif!==false) ensureNotifPerm();
  saveAll(); sfx('tap');
}
// Bascule les sons (référencé par pfNotifHTML, existait pas -> toggle mort)
function toggleSounds(el){
  P.sounds=(P.sounds===false)?true:false;
  if(el) el.classList.toggle('on',P.sounds!==false);
  saveAll(); sfx('tap');
}
function pfNotifHTML(){
  return '<div class="row" style="margin-bottom:14px"><span style="font-size:14px">'+t('trainReminders')+'</span><div class="toggle'+(P.notif!==false?' on':'')+'" onclick="toggleNotif(this)"></div></div>'+
    '<div class="row" style="margin-bottom:14px"><span style="font-size:14px">'+t('sounds')+'</span><div class="toggle'+(P.sounds!==false?' on':'')+'" onclick="toggleSounds(this)"></div></div>'+
    '<div class="row"><span style="font-size:14px">'+t('units')+'</span><div class="toggle on"></div></div>';
}
/* ---------- COMMENTAIRE / AVIS ----------
   Volontairement le plus simple possible : une zone de texte, un bouton.
   Envoi par mailto: (aucun service d'email tiers à configurer, aucune clé
   API à sécuriser côté serveur) — ouvre l'appli mail déjà installée sur le
   téléphone avec le message pré-rempli ; il ne reste qu'à taper "Envoyer"
   dans cette appli. FEEDBACK_EMAIL est un espace réservé, comme les crochets
   des CGU/politique de confidentialité : à remplacer par l'adresse réelle. */
const FEEDBACK_EMAIL='ikorunn@gmail.com';
function openFeedback(){
  let h='<div style="text-align:center;padding:4px 0 14px;color:var(--e)">'+ICN('comment',40,'currentColor')+'</div>';
  h+='<div class="tip" style="margin-bottom:14px">'+t('feedbackIntro')+'</div>';
  h+='<textarea class="inp" id="fb_text" rows="6" placeholder="'+t('feedbackPh')+'"></textarea>';
  h+='<button class="btn" style="margin-top:14px" onclick="sendFeedback()">'+t('sendBtn')+'</button>';
  $('#ovProgTitle').textContent=t('feedbackTitle'); $('#progBody').innerHTML=h; $('#ovProg').style.zIndex=topZ(); openOv('ovProg');
}
function sendFeedback(){
  const txt=($('#fb_text').value||'').trim();
  if(!txt){ toast(t('feedbackEmptyToast')); return; }
  // Tant que l'adresse réelle n'a pas remplacé l'espace réservé, ouvrir le client
  // mail produirait un brouillon adressé à « [ton email...] » — et annoncer
  // « message envoyé » serait faux. On le dit franchement plutôt que de faire
  // croire à un envoi.
  if(/^\[|à compléter/.test(FEEDBACK_EMAIL)){ toast(t('feedbackNoAddressToast')); return; }
  const subject=encodeURIComponent('IKORUN — '+t('feedbackTitle'));
  const body=encodeURIComponent(txt+'\n\n—\n'+tp('feedbackSignature',P.username||P.name||'—',curLang().toUpperCase()));
  window.location.href='mailto:'+FEEDBACK_EMAIL+'?subject='+subject+'&body='+body;
  closeOv('ovProg');
  toast(t('feedbackSentToast'));
}
function pfDataHTML(){
  return '<div class="card" style="padding:16px">'+
      '<div style="font-size:11.5px;color:var(--muted);margin-bottom:14px;line-height:1.5">'+t('exportImportDesc')+'</div>'+
      '<button class="btn ghost sm" style="width:100%;margin-bottom:8px" onclick="exportData()">'+t('exportData')+'</button>'+
      '<button class="btn ghost sm" style="width:100%" onclick="importData()">'+t('importData')+'</button>'+
    '</div>'+
    '<div class="card" style="padding:16px;margin-top:12px;border-color:rgba(255,92,108,.35);background:rgba(255,92,108,.05)">'+
      '<div class="card-t" style="color:var(--bad)">'+ICN('warning',15,'var(--bad)')+t('dangerZoneLab')+'</div>'+
      '<div style="font-size:11.5px;color:var(--muted);margin-bottom:12px;line-height:1.5">'+t('resetDesc')+'</div>'+
      '<button class="btn ghost sm" style="width:100%;color:var(--bad)" onclick="resetAll()">'+t('resetApp')+'</button>'+
    '</div>';
}
/* ---- Photo & Bio ---- */
function changePhoto(){
  // Propose galerie OU appareil photo
  let h='<div class="tip" style="margin-bottom:14px">'+t('choosePhotoLab')+'</div>';
  h+='<button class="btn" style="margin-bottom:10px" onclick="pickPhotoSource(false)">'+t('fromGalleryBtn')+'</button>';
  h+='<button class="btn ghost" style="margin-bottom:10px" onclick="pickPhotoSource(true)">'+t('takePhotoBtn')+'</button>';
  if(P.photo) h+='<button class="btn ghost" style="color:var(--bad)" onclick="removePhoto();closeOv(\'ovProg\')">'+t('removePhotoBtn')+'</button>';
  $('#ovProgTitle').textContent=t('profilePhotoTitle'); $('#progBody').innerHTML=h; $('#ovProg').style.zIndex='13700'; openOv('ovProg');
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
  h+='<div class="field"><label>'+t('zoomLab')+'</label><input id="cropZoom" type="range" min="1" max="4" step="0.01" value="1" style="width:100%"></div>';
  h+='<button class="btn" onclick="applyCrop()">'+t('validatePhotoBtn')+'</button>';
  $('#ovProgTitle').textContent=t('cropTitle'); $('#progBody').innerHTML=h; $('#ovProg').style.zIndex='13700'; openOv('ovProg');
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
  stage.addEventListener('pointerup',()=>drag=false);
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
  P.photo=out.toDataURL('image/jpeg',0.9); saveAll(); closeOv('ovProg'); renderProfile(); toast(t('photoUpdated')); sfx&&sfx('goal');
}
function removePhoto(){ delete P.photo; saveAll(); renderProfile(); toast(t('photoRemoved')); }
function editBio(){ const v=prompt(t('bioPromptLabel'),P.bio||''); if(v!==null){ P.bio=v.trim().slice(0,160); saveAll(); renderProfile(); } }
function importData(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json';
  inp.onchange=e=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ const d=JSON.parse(r.result);
      // Un fichier importé est une source non fiable (il peut avoir été fabriqué
      // puis envoyé à l'utilisateur) : on ne recopie jamais tel quel un champ qui
      // finira dans du HTML. La photo est revalidée, le reste doit être du bon type.
      if(d.profile && typeof d.profile==='object' && !Array.isArray(d.profile)){
        P=d.profile;
        if(P.photo && !safePhotoUrl(P.photo)) delete P.photo;
        if(typeof P.name!=='string') delete P.name;
        if(typeof P.bio!=='string') delete P.bio; else P.bio=P.bio.slice(0,160);
        DB.save('profile',P);
      }
      if(Array.isArray(d.sessions)){SESS=d.sessions;DB.save('sessions',SESS);}
      if(Array.isArray(d.muscu)){MSESS=d.muscu;DB.save('muscu_sessions',MSESS);}
      if(d.xp && typeof d.xp==='object'){XP=d.xp;DB.save('xp',XP);}
      toast(t('dataImported')); applyTheme(); renderProfile(); }catch(err){ toast(t('invalidFile')); } };
    r.readAsText(f); };
  inp.click();
}
/* ---------- HISTORIQUE DES PERFORMANCES (records illimités) ---------- */
const REC_DISTANCES=[['100 m',100],['200 m',200],['300 m',300],['400 m',400],['600 m',600],['800 m',800],['1000 m',1000],['1500 m',1500],['3000 m',3000],['5000 m',5000],['10 km',10000],['15 km',15000],['Semi-marathon',21097],['Marathon',42195],['Trail',0],['Cross',0]];
function openRecords(){
  let h='<button class="btn" style="margin-bottom:14px" onclick="addRecord()">'+t('addPerf')+'</button>';
  const recs=personalRecords();
  if(!recs.length) h+='<div class="card"><div class="empty"><div class="em-ic">'+ICN('medal',36,'currentColor')+'</div><div style="font-size:13px">'+t('addChronosHint')+'</div></div></div>';
  else {
    const sorted=[...RECORDS].sort((a,b)=>(a.meters||0)-(b.meters||0));
    sorted.forEach((r,i)=>{
      const v=r.meters?vdotFromRace(r.meters,parseTime(r.time)).toFixed(1):'—';
      h+='<div class="card" style="padding:13px"><div class="row"><div><div style="font-weight:700">'+r.dist+' · <span class="mono" style="color:var(--e)">'+r.time+'</span></div><div style="font-size:11px;color:var(--muted);margin-top:3px">'+(r.date?fmtDate(r.date):'')+(r.place?' · '+r.place:'')+(r.meters?' · VDOT '+v:'')+'</div></div><button class="x" onclick="delRecord('+i+')">'+ICN('trash',16)+'</button></div>'+(r.feel||r.hrAvg?'<div style="font-size:11px;color:var(--dim);margin-top:6px">'+(r.feel?r.feel:'')+(r.hrAvg?' · '+t('avgHR')+' '+r.hrAvg:'')+(r.hrMax?' / '+t('maxHRshort')+' '+r.hrMax:'')+'</div>':'')+'</div>';
    });
    const best=bestRecord();
    if(best) h+='<div class="card" style="border-color:var(--or);text-align:center"><div class="lab" style="color:var(--or)">'+t('bestPerf')+'</div><div class="man" style="font-weight:800;font-size:18px;margin-top:4px">'+best.dist+' — '+best.time+'</div><div style="font-size:12px;color:var(--muted)">VDOT '+vdotFromRace(best.meters,parseTime(best.time)).toFixed(1)+'</div></div>';
  }
  $('#profileEditBody').innerHTML=h; $('#profileEditFoot').innerHTML=''; $('#ovProfile').querySelector('h2').textContent=t('perfHistoryTitle'); openOv('ovProfile');
}
let recTmp={};
function addRecord(){
  // Étape 1 : choisir la distance via Wheel Picker
  const names=REC_DISTANCES.map(d=>d[0]).concat([t('otherDist')]);
  openPicker({title:t('chooseDistance'),cols:[{values:names,sel:9,wide:true}],onOk:idx=>{
    if(names[idx[0]]===t('otherDist')){ pickDistance(t('customDistance'),5,km=>recordForm([(km>=1?km+' km':Math.round(km*1000)+' m'),Math.round(km*1000)])); }
    else recordForm(REC_DISTANCES[idx[0]]);
  }});
}
function recordForm(d){
  recTmp={dist:d[0],meters:d[1],timeS:d[1]>=21000?5400:(d[1]>=5000?1200:300),date:todayKey(),place:'',feel:'',competition:false};
  let h='<div style="text-align:center;margin-bottom:16px"><div class="badge" style="font-size:14px;padding:8px 16px">'+d[0]+'</div></div>';
  h+='<div class="field"><label>'+t('chronoLab')+'</label><div class="inp pkfield set" id="rc_time" onclick="pickTime(\''+tp('chronoFor',d[0])+'\',recTmp.timeS,v=>{recTmp.timeS=v;document.getElementById(\'rc_time\').textContent=fmtTime(v)},'+(d[1]>=15000?'true':'false')+')">'+fmtTime(recTmp.timeS)+'</div></div>';
  h+='<div class="field"><label>'+t('dateField')+'</label><input class="inp" id="rc_date" type="date" value="'+todayKey()+'"></div>';
  h+='<div class="field"><label>'+t('placeOptional')+'</label><input class="inp" id="rc_place" placeholder="'+t('placeholderPlace')+'"></div>';
  h+='<div class="field"><label>'+t('feelOptional')+'</label><input class="inp" id="rc_feel" placeholder="'+t('feelPlaceholder')+'"></div>';
  h+='<div class="row" style="margin:14px 0"><span>'+t('officialComp')+'</span><div class="toggle" id="rc_comp" onclick="recTmp.competition=!recTmp.competition;this.classList.toggle(\'on\')"></div></div>';
  h+='<button class="btn" onclick="saveRecord()">'+t('saveThisPerf')+'</button>';
  h+='<button class="btn ghost" style="margin-top:10px" onclick="openRecords()">'+t('backBtn')+'</button>';
  $('#profileEditBody').innerHTML=h; $('#profileEditFoot').innerHTML='';
}
function saveRecord(){
  const rcDate=$('#rc_date').value;
  const guard=recordGuard(recTmp.meters,recTmp.timeS,rcDate);
  if(!guard.ok){ toast(guard.msg); return; }
  const time=fmtTime(recTmp.timeS);
  RECORDS.push({dist:recTmp.dist,meters:recTmp.meters,time,date:rcDate,place:$('#rc_place').value.trim(),feel:$('#rc_feel').value.trim(),competition:!!recTmp.competition});
  if(recTmp.dist==='5000 m')P.pb5k=time; if(recTmp.dist==='3000 m')P.pb3k=time; if(recTmp.dist==='1500 m')P.pb1500=time; if(recTmp.dist==='10 km')P.pb10k=time;
  P.vdot=computeVDOTfromRecords();
  saveAll(); refreshXP({animate:true}); openRecords(); toast(recTmp.competition?t('perfAddedComp'):t('perfAdded')); burst();
}
function delRecord(i){ const sorted=[...RECORDS].sort((a,b)=>(a.meters||0)-(b.meters||0)); const r=sorted[i]; RECORDS=RECORDS.filter(x=>x!==r); P.vdot=computeVDOTfromRecords(); saveAll(); openRecords(); }
function computeVDOTfromRecords(){
  let best=computeVDOT();
  RECORDS.forEach(r=>{ if(r.meters&&r.time){ const v=vdotFromRace(r.meters,parseTime(r.time)); if(v>best)best=v; }});
  return best>0?clampVdot(best):0;
}
function openProfileEdit(){
  $('#ovProfile').querySelector('h2').textContent=t('editProfileTitle');
  const f=(l,id,v,ty)=>'<div class="field"><label>'+l+'</label><input class="inp" id="'+id+'" value="'+escHtml(v||'')+'" '+(ty?'type="'+ty+'"':'')+'></div>';
  let h='<div class="field"><label>'+t('usernameLab')+'</label><div class="uname-wrap"><span class="uname-at">@</span><input class="inp" id="pe_username" value="'+escHtml(P.username||'')+'" autocapitalize="off" autocorrect="off" spellcheck="false"></div><div class="uname-status" id="pe_username_status">'+t('usernameHint')+'</div></div>';
  h+=f(t('firstNameLab'),'pe_name',P.name)+f(t('cityLab'),'pe_city',P.city)+f(t('birthDateLab'),'pe_bday',P.bday,'date')+
    f(t('heightCmLab'),'pe_h',P.height,'number')+f(t('weightKgLab'),'pe_w',P.weight,'number')+
    f(t('hrMaxLab'),'pe_hrmax',P.hrMax,'number')+f(t('hrRestLab'),'pe_hrrest',P.hrRest,'number')+
    f(t('kmWeekLab'),'pe_km',P.kmWeek,'number')+f(t('objective'),'pe_goal',P.goal)+f(t('compDateLab'),'pe_comp',P.compDate,'date')+
    f('5000m','pe_5k',P.t5k)+f('3000m','pe_3k',P.t3k)+f('1500m','pe_1500',P.t1500)+f('10km','pe_10k',P.t10k);
  $('#profileEditBody').innerHTML=h;
  $('#profileEditFoot').innerHTML='<button class="btn" onclick="saveProfileEdit()">'+t('saveBtn')+'</button>';
  openOv('ovProfile');
  peUsernameOk=true; // on ne bloque pas si le champ n'a pas changé
  wireUsernameField('pe_username','pe_username_status',ok=>{ peUsernameOk=ok; });
}
let peUsernameOk=true;
async function saveProfileEdit(){
  const newUsername=$('#pe_username').value.trim();
  if(newUsername && newUsername!==P.username){
    if(!usernameFormatOk(newUsername)){ toast(t('usernameInvalid')); return; }
    if(!peUsernameOk){ toast(t('usernameNotAvailable')); return; }
    const ok=await claimUsername(newUsername);
    if(!ok){ toast(t('usernameJustTaken')); return; }
    toast(t('usernameUpdated'));
  }
  P.name=$('#pe_name').value.trim()||P.name; P.city=$('#pe_city').value.trim(); P.bday=$('#pe_bday').value;
  P.height=+$('#pe_h').value||P.height; P.weight=+$('#pe_w').value||P.weight;
  P.hrMax=+$('#pe_hrmax').value||P.hrMax; P.hrRest=+$('#pe_hrrest').value||P.hrRest;
  P.kmWeek=+$('#pe_km').value||P.kmWeek; P.goal=$('#pe_goal').value.trim(); P.compDate=$('#pe_comp').value;
  P.t5k=$('#pe_5k').value.trim(); P.t3k=$('#pe_3k').value.trim(); P.t1500=$('#pe_1500').value.trim(); P.t10k=$('#pe_10k').value.trim();
  P.pb5k=P.t5k; P.pb3k=P.t3k; P.pb1500=P.t1500; P.pb10k=P.t10k;
  P.vdot=computeVDOT();
  saveAll(); closeOv('ovProfile'); renderProfile(); toast(t('profileUpdated'));
}

/* ---------- SETTINGS ---------- */
function exportData(){
  const data={profile:P,sessions:SESS,muscu:MSESS,custom:CUSTOM,plan:PLAN,goals:GOALS,agenda:AGENDA,xp:XP};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='ikorun-export.json'; a.click();
  toast(t('exportGenerated'));
}
function resetAll(){
  customConfirm(t('confirmClearAll'),()=>{
    customConfirm(t('confirmClearAllFinal'),()=>{
      localStorage.clear();
      location.reload();
    },{danger:true});
  },{danger:true});
}

/* ============ PWA : manifest + service worker (offline-first) ============ */
function setupPWA(){
  // NE PLUS générer de manifest dynamique ici.
  //
  // Historiquement, cette fonction fabriquait un manifest en JS, l'emballait
  // dans un Blob et remplaçait le href du <link rel="manifest"> par une URL
  // blob: — contournement de l'époque où aucun manifest.json n'était déployé.
  // Depuis qu'un vrai /manifest.json existe, ce contournement était devenu la
  // CAUSE du problème : il rendait l'application non installable.
  //   - start_url:'.' / scope:'.' se résolvaient relativement à l'URL blob,
  //     donc hors de l'origine du site → critère d'installabilité en échec ;
  //   - les icônes étaient déclarées type:'image/svg+xml' alors que
  //     icon-192.png / icon-512.png sont des PNG → icônes rejetées, donc plus
  //     aucune icône valide 192/512 ;
  //   - l'URL blob finissait révoquée ("Failed to fetch" au rechargement du
  //     manifest par le navigateur).
  // Résultat : Chrome ne déclenchait jamais beforeinstallprompt, et le bouton
  // « Installer l'application » n'avait donc rien à proposer.
  //
  // Le <link rel="manifest" href="manifest.json"> statique d'index.html suffit
  // et est valide (nom, icônes PNG 192+512, start_url '/', display standalone).
  //
  // Le service worker, lui, est enregistré depuis index.html (sw.js statique).
}

/* ============ ÉTAT EN LIGNE / HORS LIGNE + SYNC ============ */
function checkConnectivity(){
  const online=navigator.onLine;
  if(online){ syncOnline(true); }
  else {
    const last=PREFS.lastOnline||Date.now();
    const days=Math.floor((Date.now()-last)/86400000);
    if(days>=3) setTimeout(()=>toast(''+tp('offlineSinceDays',days)),1500);
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
  if(!silent) toast(''+t('dataSynced'));
  nudgeScroll();
}
window.addEventListener('online',()=>{ toast(''+t('connectionRestored')); syncOnline(false); });
window.addEventListener('offline',()=>{ toast(''+t('offlineModeAvailable')); });
// Sync silencieuse périodique tant que l'app est ouverte
setInterval(()=>{ if(navigator.onLine) syncOnline(true); },5*60*1000);

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',startApp); else startApp();
setTimeout(hideAppSkeleton,7000); // filet de sécurité si le réseau/l'auth traîne
setupPWA();
const V6_MOCKUP_B64="PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImZyIj4KPGhlYWQ+CjxtZXRhIGNoYXJzZXQ9IlVURi04Ij4KPG1ldGEgbmFtZT0idmlld3BvcnQiIGNvbnRlbnQ9IndpZHRoPWRldmljZS13aWR0aCwgaW5pdGlhbC1zY2FsZT0xLjAiPgo8dGl0bGU+SUtPUlVOIOKAlCBNYXF1ZXR0ZSBWNjwvdGl0bGU+CjxsaW5rIHJlbD0icHJlY29ubmVjdCIgaHJlZj0iaHR0cHM6Ly9mb250cy5nb29nbGVhcGlzLmNvbSI+CjxsaW5rIHJlbD0icHJlY29ubmVjdCIgaHJlZj0iaHR0cHM6Ly9mb250cy5nc3RhdGljLmNvbSIgY3Jvc3NvcmlnaW4+CjxsaW5rIGhyZWY9Imh0dHBzOi8vZm9udHMuZ29vZ2xlYXBpcy5jb20vY3NzMj9mYW1pbHk9VW5ib3VuZGVkOndnaHRANjAwOzcwMDs4MDA7OTAwJmZhbWlseT1JbnRlcjp3Z2h0QDQwMDs1MDA7NjAwOzcwMDs4MDAmZmFtaWx5PUpldEJyYWlucytNb25vOndnaHRANTAwOzYwMDs3MDAmZGlzcGxheT1zd2FwIiByZWw9InN0eWxlc2hlZXQiPgo8c3R5bGU+CiAgOnJvb3R7CiAgICAtLUwwOiMwODA5MEI7IC0tTDE6IzEyMTQxNzsgLS1MMjojMUIxRTIyOyAtLUwzOiMyNTI5MkU7IC0tTDQ6IzJGMzQzQTsKICAgIC0taGFpcjogcmdiYSgyNTUsMjU1LDI1NSwuMDYpOwogICAgLS1oYWlyLXN0cm9uZzogcmdiYSgyNTUsMjU1LDI1NSwuMTEpOwoKICAgIC0tc25vdzojRjVGNkY3OwogICAgLS1tdXRlZDojOEE4Rjk0OwogICAgLS1kaW06IzU2NUI2MDsKCiAgICAtLWU6IzNEN0ZGRjsgLS1lMjojNkZBMEZGOyAtLWUtcmdiOjYxLDEyNywyNTU7CiAgICAtLWVmZm9ydDojRkY1QTJFOyAtLWVmZm9ydC1kZWVwOiNEODQzMUM7IC0tZWZmb3J0MjojRkY4NjU3OyAtLWVmZm9ydC1yZ2I6MjU1LDkwLDQ2OwogICAgLS1vazojMzNEMzk5OyAtLW9rLXJnYjo1MSwyMTEsMTUzOwogICAgLS1nb2xkOiNGNUI5NDI7IC0tZ29sZC1yZ2I6MjQ1LDE4NSw2NjsKICB9CgogICp7Ym94LXNpemluZzpib3JkZXItYm94O30KICBodG1sLGJvZHl7bWFyZ2luOjA7YmFja2dyb3VuZDojMDAwO2NvbG9yOnZhcigtLXNub3cpO2ZvbnQtZmFtaWx5OidJbnRlcicsc2Fucy1zZXJpZjtmb250LXZhcmlhbnQtbnVtZXJpYzp0YWJ1bGFyLW51bXM7fQoKICAuZGVtby1mcmFtZXttaW4taGVpZ2h0OjEwMHZoO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxNnB4O3BhZGRpbmc6MzJweCAxMnB4OwogICAgYmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoZWxsaXBzZSBhdCA1MCUgLTEwJSwgIzE2MTYxNiwgIzAwMCA2MCUpO30KICAuZGVtby1sYWJlbHtjb2xvcjojNTU1O2ZvbnQtc2l6ZToxMXB4O2xldHRlci1zcGFjaW5nOjEuNXB4O3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtmb250LWZhbWlseTonSmV0QnJhaW5zIE1vbm8nO30KICAucmFpbHtkaXNwbGF5OmZsZXg7Z2FwOjI2cHg7b3ZlcmZsb3cteDphdXRvO21heC13aWR0aDoxMDB2dztwYWRkaW5nOjZweCA2dncgNDBweDtzY3JvbGwtc25hcC10eXBlOnggcHJveGltaXR5O30KICAucmFpbD4ucGhvbmUtY29se3Njcm9sbC1zbmFwLWFsaWduOmNlbnRlcjt9CiAgLnBob25lLWNvbHtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTRweDtmbGV4LXNocmluazowO30KICAucGhvbmUtdGFne2ZvbnQtZmFtaWx5OidKZXRCcmFpbnMgTW9ubyc7Zm9udC1zaXplOjEwLjVweDtsZXR0ZXItc3BhY2luZzoxLjJweDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Y29sb3I6dmFyKC0tbXV0ZWQpO30KICAucGhvbmV7d2lkdGg6MzkwcHg7bWF4LXdpZHRoOjg4dnc7YmFja2dyb3VuZDp2YXIoLS1MMCk7Ym9yZGVyLXJhZGl1czo0NnB4O2JvcmRlcjoxcHggc29saWQgIzE2MTYxNjsKICAgIGJveC1zaGFkb3c6MCA0MHB4IDkwcHggLTMwcHggcmdiYSgwLDAsMCwuOSk7b3ZlcmZsb3c6aGlkZGVuO3Bvc2l0aW9uOnJlbGF0aXZlO30KCiAgLmxpdmluZy1iZ3twb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO3otaW5kZXg6MDtvdmVyZmxvdzpoaWRkZW47cG9pbnRlci1ldmVudHM6bm9uZTt9CiAgLmxpdmluZy1iZyBzcGFue3Bvc2l0aW9uOmFic29sdXRlO2JvcmRlci1yYWRpdXM6NTAlO2ZpbHRlcjpibHVyKDYwcHgpO29wYWNpdHk6LjU7fQogIC5sYjF7d2lkdGg6MzQwcHg7aGVpZ2h0OjM0MHB4O3RvcDotMTQwcHg7bGVmdDotOTBweDtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChjaXJjbGUsIHJnYmEodmFyKC0tZS1yZ2IpLC41KSwgdHJhbnNwYXJlbnQgNzAlKTthbmltYXRpb246ZHJpZnQxIDIycyBlYXNlLWluLW91dCBpbmZpbml0ZTt9CiAgLmxiMnt3aWR0aDoyODBweDtoZWlnaHQ6MjgwcHg7dG9wOjEwMHB4O3JpZ2h0Oi0xMzBweDtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChjaXJjbGUsIHJnYmEodmFyKC0tZWZmb3J0LXJnYiksLjQpLCB0cmFuc3BhcmVudCA3MCUpO2FuaW1hdGlvbjpkcmlmdDIgMjZzIGVhc2UtaW4tb3V0IGluZmluaXRlO30KICAubGIze3dpZHRoOjI2MHB4O2hlaWdodDoyNjBweDt0b3A6NTIwcHg7bGVmdDotMTEwcHg7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlLCByZ2JhKHZhcigtLWVmZm9ydC1yZ2IpLC4xOCksIHRyYW5zcGFyZW50IDcwJSk7YW5pbWF0aW9uOmRyaWZ0MyAzMHMgZWFzZS1pbi1vdXQgaW5maW5pdGU7fQogIEBrZXlmcmFtZXMgZHJpZnQxezAlLDEwMCV7dHJhbnNmb3JtOnRyYW5zbGF0ZSgwLDApIHNjYWxlKDEpO301MCV7dHJhbnNmb3JtOnRyYW5zbGF0ZSg0MHB4LDUwcHgpIHNjYWxlKDEuMTUpO319CiAgQGtleWZyYW1lcyBkcmlmdDJ7MCUsMTAwJXt0cmFuc2Zvcm06dHJhbnNsYXRlKDAsMCkgc2NhbGUoMSk7fTUwJXt0cmFuc2Zvcm06dHJhbnNsYXRlKC0zMHB4LDQwcHgpIHNjYWxlKDEuMSk7fX0KICBAa2V5ZnJhbWVzIGRyaWZ0M3swJSwxMDAle3RyYW5zZm9ybTp0cmFuc2xhdGUoMCwwKSBzY2FsZSgxKTt9NTAle3RyYW5zZm9ybTp0cmFuc2xhdGUoMzBweCwtMzBweCkgc2NhbGUoMS4yKTt9fQogIEBtZWRpYSAocHJlZmVycy1yZWR1Y2VkLW1vdGlvbjogcmVkdWNlKXsubGIxLC5sYjIsLmxiM3thbmltYXRpb246bm9uZTt9fQoKICAucGhvbmU6OmFmdGVye2NvbnRlbnQ6Jyc7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtwb2ludGVyLWV2ZW50czpub25lO29wYWNpdHk6LjA1O21peC1ibGVuZC1tb2RlOm92ZXJsYXk7ei1pbmRleDo0OwogICAgYmFja2dyb3VuZC1pbWFnZTp1cmwoImRhdGE6aW1hZ2Uvc3ZnK3htbCwlM0NzdmcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJyB3aWR0aD0nMTIwJyBoZWlnaHQ9JzEyMCclM0UlM0NmaWx0ZXIgaWQ9J24nJTNFJTNDZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC45JyBudW1PY3RhdmVzPScyJyBzdGl0Y2hUaWxlcz0nc3RpdGNoJy8lM0UlM0MvZmlsdGVyJTNFJTNDcmVjdCB3aWR0aD0nMTAwJTI1JyBoZWlnaHQ9JzEwMCUyNScgZmlsdGVyPSd1cmwoJTIzbiknLyUzRSUzQy9zdmclM0UiKTsKICAgIGJhY2tncm91bmQtc2l6ZToxMTBweCAxMTBweDt9CgogIC5waG9uZS1pbm5lcntwb3NpdGlvbjpyZWxhdGl2ZTt6LWluZGV4OjE7cGFkZGluZzoyMHB4IDE4cHggMTA0cHg7bWluLWhlaWdodDo5MDBweDt9CgogIC5oZHJ7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtwYWRkaW5nOjZweCAycHggNHB4O30KICAuaGRyLWxvZ297ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6OHB4O2ZvbnQtZmFtaWx5OidVbmJvdW5kZWQnO2ZvbnQtd2VpZ2h0OjgwMDtmb250LXNpemU6MTQuNXB4O2xldHRlci1zcGFjaW5nOjFweDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7fQogIC5oZHItbG9nbyAuZG90e3dpZHRoOjZweDtoZWlnaHQ6NnB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6dmFyKC0tZWZmb3J0KTtib3gtc2hhZG93OjAgMCA4cHggcmdiYSh2YXIoLS1lZmZvcnQtcmdiKSwuNik7fQogIC5oZHItaWNvbnt3aWR0aDozN3B4O2hlaWdodDozN3B4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDYpO2JvcmRlcjoxcHggc29saWQgdmFyKC0taGFpcik7CiAgICAtd2Via2l0LWJhY2tkcm9wLWZpbHRlcjpibHVyKDEycHgpO2JhY2tkcm9wLWZpbHRlcjpibHVyKDEycHgpOwogICAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2NvbG9yOnZhcigtLW11dGVkKTt9CiAgLmhkci1pY29uc3tkaXNwbGF5OmZsZXg7Z2FwOjhweDt9CgogIC5ncmVldHttYXJnaW46MThweCAwIDJweDt9CiAgLmdyZWV0IGgxe2ZvbnQtZmFtaWx5OidVbmJvdW5kZWQnO2ZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTlweDttYXJnaW46MDtsZXR0ZXItc3BhY2luZzotLjNweDt9CiAgLmdyZWV0IHB7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4O21hcmdpbjo1cHggMCAwO2ZvbnQtd2VpZ2h0OjUwMDtsZXR0ZXItc3BhY2luZzouMnB4O3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTt9CiAgLmdyZWV0LmNlbnRlcnt0ZXh0LWFsaWduOmNlbnRlcjt9CiAgLmJhY2t7d2lkdGg6MzRweDtoZWlnaHQ6MzRweDtib3JkZXItcmFkaXVzOjEycHg7YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wNik7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1oYWlyKTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Y29sb3I6dmFyKC0tc25vdyk7ZmxleC1zaHJpbms6MDt9CgogIC5waWxsc3tkaXNwbGF5OmZsZXg7Z2FwOjZweDtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA0NSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1oYWlyKTtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzo0cHg7fQogIC5waWxse2ZsZXg6MTt0ZXh0LWFsaWduOmNlbnRlcjtwYWRkaW5nOjhweCA2cHg7Ym9yZGVyLXJhZGl1czoxMXB4O2ZvbnQtc2l6ZToxMi41cHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLW11dGVkKTtjdXJzb3I6cG9pbnRlcjt9CiAgLnBpbGwub257YmFja2dyb3VuZDp2YXIoLS1MMyk7Y29sb3I6dmFyKC0tc25vdyk7Ym94LXNoYWRvdzowIDRweCAxNHB4IC00cHggcmdiYSgwLDAsMCwuNSk7fQogIC5zZWd7ZGlzcGxheTpmbGV4O2dhcDo2cHg7bWFyZ2luOjE0cHggMCAxNnB4O30KICAuc2VnLWJ0bntmbGV4OjE7dGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzo5cHggNHB4O2JvcmRlci1yYWRpdXM6MTJweDtmb250LXNpemU6MTEuNXB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjp2YXIoLS1tdXRlZCk7CiAgICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA0KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWhhaXIpO2N1cnNvcjpwb2ludGVyO30KICAuc2VnLWJ0bi5vbntjb2xvcjojMTUwOTAwO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDEzNWRlZyx2YXIoLS1lZmZvcnQyKSx2YXIoLS1lZmZvcnQpKTtib3JkZXItY29sb3I6dHJhbnNwYXJlbnQ7fQoKICAuZ3Jhdml0eXtwb3NpdGlvbjpyZWxhdGl2ZTtoZWlnaHQ6Mjc4cHg7bWFyZ2luLXRvcDoxMHB4O30KICAucmluZy13cmFwe3Bvc2l0aW9uOmFic29sdXRlO2xlZnQ6NnB4O3RvcDo0cHg7d2lkdGg6MTg0cHg7aGVpZ2h0OjE4NHB4O30KICAucmluZy13cmFwIHN2Z3t3aWR0aDoxMDAlO2hlaWdodDoxMDAlO3RyYW5zZm9ybTpyb3RhdGUoLTkwZGVnKTt9CiAgLnJpbmctdHJhY2t7c3Ryb2tlOnJnYmEoMjU1LDI1NSwyNTUsLjA2KTt9CiAgLnJpbmctdmFse3N0cm9rZTp1cmwoI3JpbmdHcmFkKTtzdHJva2UtbGluZWNhcDpyb3VuZDtmaWx0ZXI6ZHJvcC1zaGFkb3coMCAwIDEycHggcmdiYSh2YXIoLS1lZmZvcnQtcmdiKSwuNCkpO30KICAucmluZy1jZW50ZXJ7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO30KICAucmluZy1jZW50ZXIgLmxhYntmb250LWZhbWlseTonSmV0QnJhaW5zIE1vbm8nO2ZvbnQtc2l6ZTo5cHg7bGV0dGVyLXNwYWNpbmc6MS44cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtd2VpZ2h0OjYwMDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7fQogIC5yaW5nLWNlbnRlciAubntmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjMzcHg7bGV0dGVyLXNwYWNpbmc6LTEuMnB4O21hcmdpbi10b3A6NnB4O30KICAucmluZy1jZW50ZXIgLnV7Zm9udC1mYW1pbHk6J0pldEJyYWlucyBNb25vJztmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi10b3A6MXB4O30KICAucmluZy1iYWRnZXtwb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjUwJTtib3R0b206LTRweDt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtNTAlKTtiYWNrZ3JvdW5kOnZhcigtLUwxKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWhhaXItc3Ryb25nKTsKICAgIGJvcmRlci1yYWRpdXM6MjBweDtwYWRkaW5nOjRweCAxMXB4O2ZvbnQtZmFtaWx5OidKZXRCcmFpbnMgTW9ubyc7Zm9udC1zaXplOjEwcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLWVmZm9ydDIpOwogICAgZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NHB4O3doaXRlLXNwYWNlOm5vd3JhcDt9CgogIC5kcm9we3Bvc2l0aW9uOmFic29sdXRlO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7dGV4dC1hbGlnbjpjZW50ZXI7CiAgICBiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA1NSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1oYWlyLXN0cm9uZyk7LXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6Ymx1cigxNnB4KTtiYWNrZHJvcC1maWx0ZXI6Ymx1cigxNnB4KTt9CiAgLmRyb3AtdmRvdHt3aWR0aDoxMDBweDtoZWlnaHQ6MTAwcHg7cmlnaHQ6NnB4O3RvcDoycHg7Ym9yZGVyLXJhZGl1czo0NCUgNTYlIDYwJSA0MCUgLyA1NCUgNDYlIDU0JSA0NiU7fQogIC5kcm9wLXZkb3QgLmxhYntmb250LXNpemU6OHB4O2xldHRlci1zcGFjaW5nOi43cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtd2VpZ2h0OjcwMDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7fQogIC5kcm9wLXZkb3QgLnZhbHtmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjIzcHg7bWFyZ2luLXRvcDo0cHg7fQogIC5kcm9wLXZkb3QgLnN1Yntmb250LXNpemU6OC41cHg7Y29sb3I6dmFyKC0tb2spO2ZvbnQtd2VpZ2h0OjcwMDttYXJnaW4tdG9wOjJweDt9CgogIC5kcm9wLXRyZW5ke3dpZHRoOjExMnB4O2hlaWdodDo1MnB4O3JpZ2h0OjA7dG9wOjExMnB4O2JvcmRlci1yYWRpdXM6NTglIDQyJSA0NiUgNTQlIC8gNTIlIDU4JSA0MiUgNDglOwogICAgYmFja2dyb3VuZDpyZ2JhKHZhcigtLWVmZm9ydC1yZ2IpLC4xMyk7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKHZhcigtLWVmZm9ydC1yZ2IpLC4zKTsKICAgIGZsZXgtZGlyZWN0aW9uOnJvdztnYXA6NnB4O2ZvbnQtZmFtaWx5OidKZXRCcmFpbnMgTW9ubyc7Zm9udC1zaXplOjExcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLWVmZm9ydDIpO30KCiAgLmRyb3Atc3RyZWFre3dpZHRoOjEyMnB4O2hlaWdodDo3MHB4O2xlZnQ6MjBweDt0b3A6MTk4cHg7Ym9yZGVyLXJhZGl1czo0MiUgNTglIDYyJSAzOCUgLyA0NiUgNDIlIDU4JSA1NCU7CiAgICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNTVkZWcsIHJnYmEodmFyKC0tZWZmb3J0LXJnYiksLjk0KSwgcmdiYSgyMTYsNjcsMjgsLjk0KSk7Ym9yZGVyOm5vbmU7CiAgICBib3gtc2hhZG93OjAgMTRweCAzMHB4IC0xMnB4IHJnYmEodmFyKC0tZWZmb3J0LXJnYiksLjUpO30KICAuZHJvcC1zdHJlYWsgLnZhbHtmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjIxcHg7Y29sb3I6IzE1MDkwMDt9CiAgLmRyb3Atc3RyZWFrIC5sYWJ7Zm9udC1zaXplOjlweDtjb2xvcjpyZ2JhKDIxLDksMCwuNjUpO2ZvbnQtd2VpZ2h0OjcwMDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bWFyZ2luLXRvcDoycHg7fQoKICAuZ3Jhdi1zcGFya3twb3NpdGlvbjphYnNvbHV0ZTtsZWZ0OjA7Ym90dG9tOjJweDt3aWR0aDoxMDAlO2hlaWdodDo0NnB4O29wYWNpdHk6LjY1O30KCiAgLmhlcm8td2Vla3tkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLXRvcDoxNnB4O3BhZGRpbmc6MCA2cHg7fQogIC5ody1kYXl7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweDt9CiAgLmh3LWJhcnt3aWR0aDo1cHg7aGVpZ2h0OjMwcHg7Ym9yZGVyLXJhZGl1czozcHg7YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wOCk7cG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO30KICAuaHctYmFyIGJ7cG9zaXRpb246YWJzb2x1dGU7Ym90dG9tOjA7bGVmdDowO3dpZHRoOjEwMCU7Ym9yZGVyLXJhZGl1czozcHg7ZGlzcGxheTpibG9jazt9CiAgLmh3LWJhciBiLmRvbmV7YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4zMik7fQogIC5ody1iYXIgYi5lZmZvcnR7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHZhcigtLWVmZm9ydDIpLHZhcigtLWVmZm9ydCkpO2JveC1zaGFkb3c6MCAwIDEycHggcmdiYSh2YXIoLS1lZmZvcnQtcmdiKSwuNSk7fQogIC5ody1sYWJ7Zm9udC1mYW1pbHk6J0pldEJyYWlucyBNb25vJztmb250LXNpemU6OXB4O2NvbG9yOnZhcigtLWRpbSk7Zm9udC13ZWlnaHQ6NjAwO30KICAuaHctZGF5LnRvZGF5IC5ody1sYWJ7Y29sb3I6dmFyKC0tc25vdyk7fQogIC5ody1kYXkudG9kYXkgLmh3LWJhcntib3gtc2hhZG93OjAgMCAwIDFweCB2YXIoLS1oYWlyLXN0cm9uZykgaW5zZXQ7fQoKICAud2F2ZXttYXJnaW4tdG9wOjEycHg7bGluZS1oZWlnaHQ6MDt9CiAgLndhdmUgc3Zne3dpZHRoOjEwMCU7aGVpZ2h0OjMycHg7ZGlzcGxheTpibG9jazt9CgogIC5kYXRhLXpvbmV7YmFja2dyb3VuZDp2YXIoLS1MMSk7cGFkZGluZzowIDE4cHggNHB4O21hcmdpbi10b3A6LTJweDt9CgogIC5jYXJke2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDQ1KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWhhaXIpO2JvcmRlci1yYWRpdXM6MjBweDtwYWRkaW5nOjE2cHg7bWFyZ2luLWJvdHRvbToxMnB4OwogICAgLXdlYmtpdC1iYWNrZHJvcC1maWx0ZXI6Ymx1cigxMHB4KTtiYWNrZHJvcC1maWx0ZXI6Ymx1cigxMHB4KTt9CiAgLmNhcmQtdHtmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjEzcHg7bWFyZ2luLWJvdHRvbToxMnB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweDt9CiAgLmxhYntmb250LXNpemU6MTBweDtsZXR0ZXItc3BhY2luZzouOXB4O2NvbG9yOnZhcigtLW11dGVkKTtmb250LXdlaWdodDo3MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO30KCiAgLnJvdzJ7ZGlzcGxheTpmbGV4O2dhcDoxMHB4O21hcmdpbi1ib3R0b206MTZweDtwYWRkaW5nLXRvcDoxNHB4O30KICAuc3RhdHtmbGV4OjE7fQogIC5zdGF0IC5pY3t3aWR0aDoyNnB4O2hlaWdodDoyNnB4O2JvcmRlci1yYWRpdXM6OHB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjttYXJnaW4tYm90dG9tOjlweDtiYWNrZ3JvdW5kOnZhcigtLUwzKTtjb2xvcjp2YXIoLS1tdXRlZCk7fQogIC5zdGF0IC52e2ZvbnQtZmFtaWx5OidVbmJvdW5kZWQnO2ZvbnQtd2VpZ2h0OjgwMDtmb250LXNpemU6MjFweDtsZXR0ZXItc3BhY2luZzotLjVweDt9CiAgLnN0YXQgLmx7Zm9udC1zaXplOjEwLjVweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi10b3A6M3B4O3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtsZXR0ZXItc3BhY2luZzouM3B4O30KCiAgLnNlYy1sYWJ7Zm9udC1zaXplOjEwcHg7bGV0dGVyLXNwYWNpbmc6LjlweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC13ZWlnaHQ6NzAwO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTttYXJnaW46NnB4IDAgMnB4OwogICAgcGFkZGluZy10b3A6MTZweDtib3JkZXItdG9wOjFweCBzb2xpZCB2YXIoLS1oYWlyKTtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YWxpZ24taXRlbXM6Y2VudGVyO30KICAuc2VjLWxhYiAuc2Vle2NvbG9yOnZhcigtLWUyKTt0ZXh0LXRyYW5zZm9ybTpub25lO2ZvbnQtd2VpZ2h0OjcwMDtsZXR0ZXItc3BhY2luZzowO2ZvbnQtc2l6ZToxMS41cHg7fQoKICAubmV4dC1yb3d7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTJweDtwYWRkaW5nOjE0cHggMDtib3JkZXItYm90dG9tOjFweCBzb2xpZCB2YXIoLS1oYWlyKTt9CiAgLm5leHQtaWN7d2lkdGg6NDBweDtoZWlnaHQ6NDBweDtib3JkZXItcmFkaXVzOjEycHg7YmFja2dyb3VuZDp2YXIoLS1MMyk7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKHZhcigtLWVmZm9ydC1yZ2IpLC4zKTsKICAgIGRpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtjb2xvcjp2YXIoLS1lZmZvcnQyKTtmbGV4LXNocmluazowO30KICAubmV4dC1ib2R5e2ZsZXg6MTttaW4td2lkdGg6MDt9CiAgLm5leHQtdGl0bGV7Zm9udC1mYW1pbHk6J1VuYm91bmRlZCc7Zm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToxNHB4O30KICAubmV4dC1tZXRhe2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTEuNXB4O21hcmdpbi10b3A6M3B4O2ZvbnQtd2VpZ2h0OjUwMDt9CiAgLm5leHQtYXJyb3d7Y29sb3I6dmFyKC0tZGltKTt9CgogIC5wbGFuLXJvd3tkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMnB4O3BhZGRpbmc6MTJweCAwO30KICAucGxhbi1yb3crLnBsYW4tcm93e2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWhhaXIpO30KICAucGxhbi1pY3t3aWR0aDoyOHB4O2hlaWdodDoyOHB4O2JvcmRlci1yYWRpdXM6OXB4O2JhY2tncm91bmQ6dmFyKC0tTDMpO2NvbG9yOnZhcigtLWUyKTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7ZmxleC1zaHJpbms6MDtmb250LXNpemU6MTJweDtmb250LXdlaWdodDo3MDA7fQogIC5wbGFuLXJvdy5kb25lIC5wbGFuLWlje2NvbG9yOnZhcigtLW9rKTt9CiAgLnBsYW4tYm9keXtmbGV4OjE7fQogIC5wbGFuLXRpdGxle2ZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTNweDt9CiAgLnBsYW4tc3Vie2NvbG9yOnZhcigtLW11dGVkKTtmb250LXNpemU6MTFweDttYXJnaW4tdG9wOjJweDtmb250LXdlaWdodDo1MDA7fQoKICAubGlzdC1yb3d7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6MTJweDtwYWRkaW5nOjEycHggMnB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWhhaXIpO2N1cnNvcjpwb2ludGVyO30KICAubGlzdC1yb3c6bGFzdC1jaGlsZHtib3JkZXItYm90dG9tOm5vbmU7fQogIC5sci1pY29ue3dpZHRoOjM2cHg7aGVpZ2h0OjM2cHg7Ym9yZGVyLXJhZGl1czoxMXB4O2JhY2tncm91bmQ6dmFyKC0tTDMpO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtjb2xvcjp2YXIoLS1lMik7ZmxleC1zaHJpbms6MDt9CiAgLmxyLXR4dHtmbGV4OjE7bWluLXdpZHRoOjA7fQogIC5sci10aXRsZXtmb250LXdlaWdodDo3MDA7Zm9udC1zaXplOjEzLjVweDt9CiAgLmxyLXN1Yntjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjExcHg7bWFyZ2luLXRvcDoycHg7fQogIC5sci12YWx7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDt9CiAgLmxyLWNoZXZ7Y29sb3I6dmFyKC0tZGltKTt9CgogIC56cm93e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjhweDtwYWRkaW5nOjhweCAwO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWhhaXIpO2ZvbnQtc2l6ZToxMi41cHg7fQogIC56cm93Omxhc3QtY2hpbGR7Ym9yZGVyLWJvdHRvbTpub25lO30KICAuemRvdHt3aWR0aDo4cHg7aGVpZ2h0OjhweDtib3JkZXItcmFkaXVzOjUwJTtmbGV4LXNocmluazowO30KICAuem5hbWV7ZmxleDoxO2ZvbnQtd2VpZ2h0OjYwMDtjb2xvcjp2YXIoLS1zbm93KTt9CiAgLnp2YWx7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtd2VpZ2h0OjYwMDt9CgogIC5uYXZ7cG9zaXRpb246YWJzb2x1dGU7bGVmdDoxOHB4O3JpZ2h0OjE4cHg7Ym90dG9tOjE4cHg7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1hcm91bmQ7CiAgICBiYWNrZ3JvdW5kOnJnYmEoMTgsMjAsMjMsLjcyKTstd2Via2l0LWJhY2tkcm9wLWZpbHRlcjpibHVyKDIycHgpIHNhdHVyYXRlKDEuNCk7YmFja2Ryb3AtZmlsdGVyOmJsdXIoMjJweCkgc2F0dXJhdGUoMS40KTsKICAgIGJvcmRlcjoxcHggc29saWQgdmFyKC0taGFpci1zdHJvbmcpO2JvcmRlci1yYWRpdXM6MjJweDtwYWRkaW5nOjhweCA2cHg7ei1pbmRleDo2O2JveC1zaGFkb3c6MCAyMHB4IDQwcHggLTE4cHggcmdiYSgwLDAsMCwuNyk7fQogIC5uYXYtaXRlbXtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NXB4O2NvbG9yOnZhcigtLWRpbSk7Zm9udC1zaXplOjlweDtmb250LXdlaWdodDo2MDA7ZmxleDoxO3BhZGRpbmc6NnB4IDA7Ym9yZGVyLXJhZGl1czoxNHB4O2xldHRlci1zcGFjaW5nOi4ycHg7fQogIC5uYXYtaXRlbS5vbntjb2xvcjp2YXIoLS1zbm93KTtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA4KTt9CiAgLm5hdi1pY3t3aWR0aDoyMHB4O2hlaWdodDoyMHB4O2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjt9CgogIC5ub3Rlc3t3aWR0aDozOTBweDttYXgtd2lkdGg6ODh2dztmb250LXNpemU6MTJweDtjb2xvcjojOTk5O2xpbmUtaGVpZ2h0OjEuNjtmb250LWZhbWlseTonSW50ZXInO30KICAubm90ZXMgYntjb2xvcjojZGRkO30KCiAgLmhlcm8tZHJvcHtwb3NpdGlvbjpyZWxhdGl2ZTtib3JkZXItcmFkaXVzOjM2cHggNDRweCA0MHB4IDQ4cHggLyA0NHB4IDM4cHggNDZweCA0MHB4O3BhZGRpbmc6MjBweCAyMHB4IDIycHg7bWFyZ2luOjEwcHggMCAxNnB4OwogICAgYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTUwZGVnLCByZ2JhKDI1NSw5MCw0NiwuMTYpLCByZ2JhKDYxLDEyNywyNTUsLjEwKSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1oYWlyLXN0cm9uZyk7b3ZlcmZsb3c6aGlkZGVuO30KICAuaGVyby1kcm9wOjpiZWZvcmV7Y29udGVudDonJztwb3NpdGlvbjphYnNvbHV0ZTt3aWR0aDoyMjBweDtoZWlnaHQ6MjIwcHg7Ym9yZGVyLXJhZGl1czo1MCU7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlLCByZ2JhKHZhcigtLWVmZm9ydC1yZ2IpLC4yOCksIHRyYW5zcGFyZW50IDcwJSk7dG9wOi0xMjBweDtyaWdodDotODBweDt9CiAgLmhlcm8tZHJvcC10b3B7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2FsaWduLWl0ZW1zOmZsZXgtc3RhcnQ7cG9zaXRpb246cmVsYXRpdmU7fQogIC5oZXJvLWRyb3AtY2hpcHtmb250LWZhbWlseTonSmV0QnJhaW5zIE1vbm8nO2ZvbnQtc2l6ZTo5LjVweDtmb250LXdlaWdodDo3MDA7bGV0dGVyLXNwYWNpbmc6LjZweDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7Y29sb3I6dmFyKC0tZWZmb3J0Mik7CiAgICBiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjI1KTtib3JkZXI6MXB4IHNvbGlkIHJnYmEodmFyKC0tZWZmb3J0LXJnYiksLjM1KTtib3JkZXItcmFkaXVzOjIwcHg7cGFkZGluZzo1cHggMTBweDt9CiAgLmhlcm8tZHJvcC10aXRsZXtmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjIxcHg7bWFyZ2luLXRvcDoxNHB4O2xldHRlci1zcGFjaW5nOi0uM3B4O3Bvc2l0aW9uOnJlbGF0aXZlO30KICAuaGVyby1kcm9wLW1ldGF7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtc2l6ZToxMnB4O21hcmdpbi10b3A6NnB4O2ZvbnQtd2VpZ2h0OjYwMDtwb3NpdGlvbjpyZWxhdGl2ZTt9CiAgLmhlcm8tZHJvcC1yb3d7ZGlzcGxheTpmbGV4O2dhcDoxOHB4O21hcmdpbi10b3A6MTZweDtwb3NpdGlvbjpyZWxhdGl2ZTt9CiAgLmhlcm8tZHJvcC1zdGF0IGJ7ZGlzcGxheTpibG9jaztmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjE2cHg7fQogIC5oZXJvLWRyb3Atc3RhdCBzcGFue2ZvbnQtc2l6ZTo5LjVweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC13ZWlnaHQ6NzAwO3RleHQtdHJhbnNmb3JtOnVwcGVyY2FzZTtsZXR0ZXItc3BhY2luZzouNHB4O30KCiAgLmNhbC1zdHJpcHtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wNCk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1oYWlyKTtib3JkZXItcmFkaXVzOjE4cHg7cGFkZGluZzoxMnB4IDEwcHg7bWFyZ2luLWJvdHRvbToxNnB4O30KICAuY2FsLWR7ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjZweDtmb250LWZhbWlseTonSmV0QnJhaW5zIE1vbm8nO2ZvbnQtc2l6ZTo5cHg7Y29sb3I6dmFyKC0tZGltKTtmb250LXdlaWdodDo3MDA7fQogIC5jYWwtZCAubnt3aWR0aDozMHB4O2hlaWdodDozMHB4O2JvcmRlci1yYWRpdXM6NTAlO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtjb2xvcjp2YXIoLS1zbm93KTtmb250LXNpemU6MTJweDtmb250LWZhbWlseTonSW50ZXInO2ZvbnQtd2VpZ2h0OjcwMDt9CiAgLmNhbC1kLmhhcyAubntiYWNrZ3JvdW5kOnJnYmEodmFyKC0tZS1yZ2IpLC4xOCk7Y29sb3I6dmFyKC0tZTIpO30KICAuY2FsLWQudG9kYXkgLm57YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLHZhcigtLWVmZm9ydDIpLHZhcigtLWVmZm9ydCkpO2NvbG9yOiMxNTA5MDA7fQoKICAua2NoYXJ0LWNhcmR7YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wNDUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0taGFpcik7Ym9yZGVyLXJhZGl1czoyMHB4O3BhZGRpbmc6MThweDttYXJnaW4tYm90dG9tOjEycHg7fQogIC5rY2hhcnQtdG9we2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpmbGV4LXN0YXJ0O30KICAua2NoYXJ0LWxhYntmb250LXNpemU6MTAuNXB4O2NvbG9yOnZhcigtLW11dGVkKTtmb250LXdlaWdodDo3MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO2xldHRlci1zcGFjaW5nOi40cHg7fQogIC5rY2hhcnQtdmFse2ZvbnQtZmFtaWx5OidVbmJvdW5kZWQnO2ZvbnQtd2VpZ2h0OjgwMDtmb250LXNpemU6MjZweDttYXJnaW4tdG9wOjVweDtsZXR0ZXItc3BhY2luZzotLjVweDt9CiAgLmtjaGFydC12YWwgc3Bhbntmb250LXNpemU6MTJweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC13ZWlnaHQ6NjAwO21hcmdpbi1sZWZ0OjRweDt9CiAgLmtjaGFydC1kZWx0YXtmb250LWZhbWlseTonSmV0QnJhaW5zIE1vbm8nO2ZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTNweDtjb2xvcjp2YXIoLS1vayk7dGV4dC1hbGlnbjpyaWdodDt9CiAgLmtjaGFydC1kZWx0YS5iYWR7Y29sb3I6dmFyKC0tZWZmb3J0Mik7fQogIC5rY2hhcnQtZGVsdGEtc3Vie2ZvbnQtc2l6ZTo5LjVweDtjb2xvcjp2YXIoLS1tdXRlZCk7dGV4dC1hbGlnbjpyaWdodDttYXJnaW4tdG9wOjJweDt9CiAgLmtiYXJze2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpmbGV4LWVuZDtnYXA6NnB4O2hlaWdodDo2NHB4O21hcmdpbi10b3A6MTZweDt9CiAgLmtiYXJzIGJ7ZmxleDoxO2JvcmRlci1yYWRpdXM6NXB4IDVweCAzcHggM3B4O2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMSk7cG9zaXRpb246cmVsYXRpdmU7fQogIC5rYmFycyBiLnRvZGF5e2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE4MGRlZyx2YXIoLS1lZmZvcnQyKSx2YXIoLS1lZmZvcnQpKTt9CiAgLmtiYXJzLWxhYntkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47bWFyZ2luLXRvcDo4cHg7Zm9udC1mYW1pbHk6J0pldEJyYWlucyBNb25vJztmb250LXNpemU6OXB4O2NvbG9yOnZhcigtLWRpbSk7fQoKICAua3JvdzN7ZGlzcGxheTpmbGV4O2dhcDo4cHg7bWFyZ2luLWJvdHRvbToxNHB4O30KICAua3RpbGV7ZmxleDoxO2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDQ1KTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWhhaXIpO2JvcmRlci1yYWRpdXM6MTZweDtwYWRkaW5nOjEycHggMTBweDt0ZXh0LWFsaWduOmNlbnRlcjt9CiAgLmt0aWxlLWxhYntmb250LXNpemU6OXB4O2NvbG9yOnZhcigtLW11dGVkKTtmb250LXdlaWdodDo3MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO21hcmdpbi1ib3R0b206NnB4O30KICAua3RpbGUtdmFse2ZvbnQtZmFtaWx5OidVbmJvdW5kZWQnO2ZvbnQtd2VpZ2h0OjgwMDtmb250LXNpemU6MTRweDt9CiAgLmt0aWxlLXN1Yntmb250LXNpemU6OS41cHg7Y29sb3I6dmFyKC0tb2spO2ZvbnQtd2VpZ2h0OjcwMDttYXJnaW4tdG9wOjNweDt9CgogIC5oZWF0e2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDEzLDFmcik7Z2FwOjNweDt9CiAgLmhlYXQgZGl2e2FzcGVjdC1yYXRpbzoxO2JvcmRlci1yYWRpdXM6MnB4O30KCiAgLnNlYXJjaGJveHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMHB4O2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDUpO2JvcmRlcjoxcHggc29saWQgdmFyKC0taGFpcik7Ym9yZGVyLXJhZGl1czoxNnB4O3BhZGRpbmc6MTJweCAxNHB4O21hcmdpbjoxNHB4IDAgMThweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEzcHg7fQogIC5mYXZncmlke2Rpc3BsYXk6Z3JpZDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDQsMWZyKTtnYXA6OXB4O21hcmdpbi1ib3R0b206NnB4O30KICAuZmF2dGlsZXtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA0NSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1oYWlyKTtib3JkZXItcmFkaXVzOjE2cHg7cGFkZGluZzoxNHB4IDRweDt0ZXh0LWFsaWduOmNlbnRlcjt9CiAgLmZhdmxhYntmb250LXNpemU6OS41cHg7Zm9udC13ZWlnaHQ6NzAwO21hcmdpbi10b3A6OHB4O2NvbG9yOnZhcigtLXNub3cpO30KCiAgLnBmLWhlcm97ZGlzcGxheTpmbGV4O2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjthbGlnbi1pdGVtczpjZW50ZXI7dGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoyNHB4IDE4cHg7fQogIC5wZi1hdnt3aWR0aDo4OHB4O2hlaWdodDo4OHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE0NWRlZyx2YXIoLS1lKSwjMWM0ZmM3KTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7CiAgICBmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjI4cHg7Ym9yZGVyOjNweCBzb2xpZCB2YXIoLS1MMCk7Ym94LXNoYWRvdzowIDAgMCAycHggcmdiYSh2YXIoLS1lLXJnYiksLjQpO30KICAucGYtbmFtZXtmb250LWZhbWlseTonVW5ib3VuZGVkJztmb250LXdlaWdodDo4MDA7Zm9udC1zaXplOjE5cHg7bWFyZ2luLXRvcDoxMnB4O30KICAucGYtbWFpbHtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC1zaXplOjEycHg7bWFyZ2luLXRvcDozcHg7fQogIC5yYW5rY2hpcHttYXJnaW4tdG9wOjEycHg7cGFkZGluZzo2cHggMTRweDtib3JkZXItcmFkaXVzOjIwcHg7Zm9udC1zaXplOjExLjVweDtmb250LXdlaWdodDo3MDA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLHZhcigtLWVmZm9ydDIpLHZhcigtLWVmZm9ydCkpO2NvbG9yOiMxNTA5MDA7fQogIC5ncnAtY2FyZHtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjA0NSk7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1oYWlyKTtib3JkZXItcmFkaXVzOjE4cHg7cGFkZGluZzoycHggMTRweDttYXJnaW4tYm90dG9tOjE0cHg7fQogIC5ncnAtcm93e2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEycHg7cGFkZGluZzoxMnB4IDA7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0taGFpcik7fQogIC5ncnAtcm93Omxhc3QtY2hpbGR7Ym9yZGVyLWJvdHRvbTpub25lO30KICAuZ3JwLWxhYntmb250LXNpemU6MTBweDtsZXR0ZXItc3BhY2luZzouOHB4O2NvbG9yOnZhcigtLW11dGVkKTtmb250LXdlaWdodDo3MDA7dGV4dC10cmFuc2Zvcm06dXBwZXJjYXNlO21hcmdpbjoxOHB4IDJweCA4cHg7fQogIC5iZC1jbHVzdGVye2Rpc3BsYXk6ZmxleDtnYXA6MTBweDtmbGV4LXdyYXA6d3JhcDt9CiAgLmJkLWljb257d2lkdGg6NTJweDtoZWlnaHQ6NTJweDtib3JkZXItcmFkaXVzOjQ0JSA1NiUgNjAlIDQwJSAvIDUwJSA0NiUgNTQlIDUwJTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Zm9udC1zaXplOjIycHg7CiAgICBiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxNTBkZWcsIHJnYmEodmFyKC0tZ29sZC1yZ2IpLC4yOCksIHJnYmEodmFyKC0tZ29sZC1yZ2IpLC4wNikpO2JvcmRlcjoxcHggc29saWQgcmdiYSh2YXIoLS1nb2xkLXJnYiksLjM1KTt9Cjwvc3R5bGU+CjwvaGVhZD4KPGJvZHk+Cgo8ZGl2IGNsYXNzPSJkZW1vLWZyYW1lIj4KICA8ZGl2IGNsYXNzPSJkZW1vLWxhYmVsIj5NYXF1ZXR0ZSBWNiDigJQgQWNjdWVpbCBhZmZpbsOpICsgU3BvcnQsIFN0YXRzLCBPdXRpbHMsIFByb2ZpbDwvZGl2PgogIDxkaXYgY2xhc3M9InJhaWwiPgoKICAgIDxkaXYgY2xhc3M9InBob25lLWNvbCI+CiAgICAgIDxkaXYgY2xhc3M9InBob25lLXRhZyI+MDEgwrcgQWNjdWVpbDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwaG9uZSI+CiAgICAgICAgPGRpdiBjbGFzcz0ibGl2aW5nLWJnIj48c3BhbiBjbGFzcz0ibGIxIj48L3NwYW4+PHNwYW4gY2xhc3M9ImxiMiI+PC9zcGFuPjxzcGFuIGNsYXNzPSJsYjMiPjwvc3Bhbj48L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJwaG9uZS1pbm5lciI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJoZHIiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJoZHItbG9nbyI+PHNwYW4gY2xhc3M9ImRvdCI+PC9zcGFuPklLT1JVTjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJoZHItaWNvbiI+PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTE4IDhhNiA2IDAgMTAtMTIgMGMwIDctMyA5LTMgOWgxOHMtMy0yLTMtOSIvPjxwYXRoIGQ9Ik0xMy43MyAyMWEyIDIgMCAwMS0zLjQ2IDAiLz48L3N2Zz48L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9ImdyZWV0Ij48aDE+U2FsdXQgSGFtb3U8L2gxPjxwPlNlbWFpbmUgNiDCtyBibG9jIGFmZsO7dGFnZTwvcD48L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJncmF2aXR5Ij4KICAgICAgICAgICAgPHN2ZyBjbGFzcz0iZ3Jhdi1zcGFyayIgdmlld0JveD0iMCAwIDM1MCA1MCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+CiAgICAgICAgICAgICAgPGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJnc0ZpbGwiIHgxPSIwIiB5MT0iMCIgeDI9IjAiIHkyPSIxIj4KICAgICAgICAgICAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9InJnYmEoMTExLDE2MCwyNTUsLjIwKSIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0icmdiYSgxMTEsMTYwLDI1NSwwKSIvPgogICAgICAgICAgICAgIDwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPgogICAgICAgICAgICAgIDxwb2x5bGluZSBwb2ludHM9IjAsMzYgNTAsMzAgMTAwLDM4IDE1MCwyMCAyMDAsMjggMjUwLDEwIDMwMCwyMiAzNTAsOCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjNkZBMEZGIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgb3BhY2l0eT0iLjc1Ii8+CiAgICAgICAgICAgICAgPHBvbHlnb24gcG9pbnRzPSIwLDM2IDUwLDMwIDEwMCwzOCAxNTAsMjAgMjAwLDI4IDI1MCwxMCAzMDAsMjIgMzUwLDggMzUwLDUwIDAsNTAiIGZpbGw9InVybCgjZ3NGaWxsKSIvPgogICAgICAgICAgICA8L3N2Zz4KCiAgICAgICAgICAgIDxkaXYgY2xhc3M9InJpbmctd3JhcCI+CiAgICAgICAgICAgICAgPHN2ZyB2aWV3Qm94PSIwIDAgMTg0IDE4NCI+CiAgICAgICAgICAgICAgICA8ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9InJpbmdHcmFkIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3RvcC1jb2xvcj0iI0ZGODY1NyIvPjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iI0ZGNUEyRSIvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPgogICAgICAgICAgICAgICAgPGNpcmNsZSBjbGFzcz0icmluZy10cmFjayIgY3g9IjkyIiBjeT0iOTIiIHI9IjgwIiBmaWxsPSJub25lIiBzdHJva2Utd2lkdGg9IjkiLz4KICAgICAgICAgICAgICAgIDxjaXJjbGUgY2xhc3M9InJpbmctdmFsIiBjeD0iOTIiIGN5PSI5MiIgcj0iODAiIGZpbGw9Im5vbmUiIHN0cm9rZS13aWR0aD0iOSIgc3Ryb2tlLWRhc2hhcnJheT0iNTAzIiBzdHJva2UtZGFzaG9mZnNldD0iMTE1Ii8+CiAgICAgICAgICAgICAgPC9zdmc+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0icmluZy1jZW50ZXIiPjxkaXYgY2xhc3M9ImxhYiI+QWxsdXJlIHNldWlsPC9kaXY+PGRpdiBjbGFzcz0ibiI+MzozODwvZGl2PjxkaXYgY2xhc3M9InUiPi9rbTwvZGl2PjwvZGl2PgogICAgICAgICAgICAgIDxkaXYgY2xhc3M9InJpbmctYmFkZ2UiPvCflKUgMTIgam91cnMgZGUgc8OpcmllPC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAgPGRpdiBjbGFzcz0iZHJvcCBkcm9wLXZkb3QiPgogICAgICAgICAgICAgIDxkaXYgY2xhc3M9ImxhYiI+VkRPVDwvZGl2PjxkaXYgY2xhc3M9InZhbCI+Njc8L2Rpdj48ZGl2IGNsYXNzPSJzdWIiPuKGkSArMiBjZSBtb2lzPC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJkcm9wIGRyb3AtdHJlbmQiPgogICAgICAgICAgICAgIDxzdmcgd2lkdGg9IjExIiBoZWlnaHQ9IjExIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjMiPjxwYXRoIGQ9Ik0xOCAxNWwtNi02LTYgNiIvPjwvc3ZnPgogICAgICAgICAgICAgIC00cyB2cyBTNQogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9Imhlcm8td2VlayI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Imh3LWRheSI+PGRpdiBjbGFzcz0iaHctYmFyIj48YiBjbGFzcz0iZG9uZSIgc3R5bGU9ImhlaWdodDo3MCUiPjwvYj48L2Rpdj48c3BhbiBjbGFzcz0iaHctbGFiIj5MPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJody1kYXkiPjxkaXYgY2xhc3M9Imh3LWJhciI+PGIgY2xhc3M9ImVmZm9ydCIgc3R5bGU9ImhlaWdodDo5NSUiPjwvYj48L2Rpdj48c3BhbiBjbGFzcz0iaHctbGFiIj5NPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJody1kYXkiPjxkaXYgY2xhc3M9Imh3LWJhciI+PGIgY2xhc3M9ImRvbmUiIHN0eWxlPSJoZWlnaHQ6NDAlIj48L2I+PC9kaXY+PHNwYW4gY2xhc3M9Imh3LWxhYiI+TTwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaHctZGF5IHRvZGF5Ij48ZGl2IGNsYXNzPSJody1iYXIiPjxiIHN0eWxlPSJoZWlnaHQ6MCUiPjwvYj48L2Rpdj48c3BhbiBjbGFzcz0iaHctbGFiIj5KPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJody1kYXkiPjxkaXYgY2xhc3M9Imh3LWJhciI+PGIgY2xhc3M9ImVmZm9ydCIgc3R5bGU9ImhlaWdodDoxMDAlIj48L2I+PC9kaXY+PHNwYW4gY2xhc3M9Imh3LWxhYiI+Vjwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaHctZGF5Ij48ZGl2IGNsYXNzPSJody1iYXIiPjxiIHN0eWxlPSJoZWlnaHQ6MCUiPjwvYj48L2Rpdj48c3BhbiBjbGFzcz0iaHctbGFiIj5TPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJody1kYXkiPjxkaXYgY2xhc3M9Imh3LWJhciI+PGIgc3R5bGU9ImhlaWdodDowJSI+PC9iPjwvZGl2PjxzcGFuIGNsYXNzPSJody1sYWIiPkQ8L3NwYW4+PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJ3YXZlIj48c3ZnIHZpZXdCb3g9IjAgMCA0MDAgMzIiIHByZXNlcnZlQXNwZWN0UmF0aW89Im5vbmUiPjxwYXRoIGQ9Ik0wLDE4IEM2MCwyIDEyMCwzMiAyMDAsMTYgQzI4MCwyIDM0MCwyOCA0MDAsMTIgTDQwMCwzMiBMMCwzMiBaIiBmaWxsPSIjMTIxNDE3Ii8+PC9zdmc+PC9kaXY+CgogICAgICAgICAgPGRpdiBjbGFzcz0iZGF0YS16b25lIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0icm93MiI+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0ic3RhdCI+PGRpdiBjbGFzcz0iaWMiPjxzdmcgd2lkdGg9IjEzIiBoZWlnaHQ9IjEzIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTEyIDJsMyA3aDdsLTUuNSA0LjVMMTggMjFsLTYtNC02IDQgMS41LTcuNUwyIDloN3oiLz48L3N2Zz48L2Rpdj48ZGl2IGNsYXNzPSJ2Ij40Mi4zPHNwYW4gc3R5bGU9ImZvbnQtc2l6ZToxMXB4OyI+a208L3NwYW4+PC9kaXY+PGRpdiBjbGFzcz0ibCI+Q2V0dGUgc2VtYWluZTwvZGl2PjwvZGl2PgogICAgICAgICAgICAgIDxkaXYgY2xhc3M9InN0YXQiPjxkaXYgY2xhc3M9ImljIiBzdHlsZT0iY29sb3I6dmFyKC0tZTIpIj48c3ZnIHdpZHRoPSIxMyIgaGVpZ2h0PSIxMyIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjkiLz48cGF0aCBkPSJNMTIgN3Y1bDMgMyIvPjwvc3ZnPjwvZGl2PjxkaXYgY2xhc3M9InYiPjZoMTI8L2Rpdj48ZGl2IGNsYXNzPSJsIj5UZW1wcyB0b3RhbDwvZGl2PjwvZGl2PgogICAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICAgIDxkaXYgY2xhc3M9InNlYy1sYWIiPlPDqWFuY2Ugc3VpdmFudGU8L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibmV4dC1yb3ciPgogICAgICAgICAgICAgIDxkaXYgY2xhc3M9Im5leHQtaWMiPjxzdmcgd2lkdGg9IjE3IiBoZWlnaHQ9IjE3IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMyAyTDQgMTRoNmwtMSA4IDktMTJoLTZ6Ii8+PC9zdmc+PC9kaXY+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0ibmV4dC1ib2R5Ij48ZGl2IGNsYXNzPSJuZXh0LXRpdGxlIj42IMOXIDgwMG0gVk1BPC9kaXY+PGRpdiBjbGFzcz0ibmV4dC1tZXRhIj5EZW1haW4gwrcgMDY6MzAgwrcgUsOpY3VwIDInPC9kaXY+PC9kaXY+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0ibmV4dC1hcnJvdyI+PHN2ZyB3aWR0aD0iMTciIGhlaWdodD0iMTciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTkgMThsNi02LTYtNiIvPjwvc3ZnPjwvZGl2PgogICAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICAgIDxkaXYgY2xhc3M9InNlYy1sYWIiPlBsYW4gZGUgbGEgc2VtYWluZTwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJwbGFuLXJvdyBkb25lIj48ZGl2IGNsYXNzPSJwbGFuLWljIj7inJM8L2Rpdj48ZGl2IGNsYXNzPSJwbGFuLWJvZHkiPjxkaXYgY2xhc3M9InBsYW4tdGl0bGUiPkZvb3RpbmcgOGttPC9kaXY+PGRpdiBjbGFzcz0icGxhbi1zdWIiPkx1bmRpIMK3IEVuZHVyYW5jZSBmb25kYW1lbnRhbGU8L2Rpdj48L2Rpdj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0icGxhbi1yb3cgZG9uZSI+PGRpdiBjbGFzcz0icGxhbi1pYyI+4pyTPC9kaXY+PGRpdiBjbGFzcz0icGxhbi1ib2R5Ij48ZGl2IGNsYXNzPSJwbGFuLXRpdGxlIj5TZXVpbCAzw5cya208L2Rpdj48ZGl2IGNsYXNzPSJwbGFuLXN1YiI+TWFyZGkgwrcgQWxsdXJlIHNldWlsPC9kaXY+PC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9InBsYW4tcm93Ij48ZGl2IGNsYXNzPSJwbGFuLWljIj7ihpI8L2Rpdj48ZGl2IGNsYXNzPSJwbGFuLWJvZHkiPjxkaXYgY2xhc3M9InBsYW4tdGl0bGUiPjbDlzgwMG0gVk1BPC9kaXY+PGRpdiBjbGFzcz0icGxhbi1zdWIiPlZlbmRyZWRpIMK3IEZyYWN0aW9ubsOpIGNvdXJ0PC9kaXY+PC9kaXY+PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KCiAgICAgICAgPGRpdiBjbGFzcz0ibmF2Ij4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIG9uIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTMgOWw5LTcgOSA3djExYTIgMiAwIDAxLTIgMkg1YTIgMiAwIDAxLTItMnoiLz48L3N2Zz48L2Rpdj5BY2N1ZWlsPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuYXYtaXRlbSI+PGRpdiBjbGFzcz0ibmF2LWljIj48c3ZnIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxwYXRoIGQ9Ik0xMyAyTDQgMTRoNmwtMSA4IDktMTJoLTZ6Ii8+PC9zdmc+PC9kaXY+U3BvcnQ8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTMgMTJoNGwzIDggNC0xNiAzIDhoNCIvPjwvc3ZnPjwvZGl2PlN0YXRzPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuYXYtaXRlbSI+PGRpdiBjbGFzcz0ibmF2LWljIj48c3ZnIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxwYXRoIGQ9Ik0xNCA0bDYgNi05IDlINXYtNnoiLz48L3N2Zz48L2Rpdj5PdXRpbHM8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PHBhdGggZD0iTTUuNSAyMWE2LjUgNi41IDAgMDExMyAwIi8+PC9zdmc+PC9kaXY+UHJvZmlsPC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJub3RlcyI+CiAgICAgICAgPGI+Q2UgcXVpIGNoYW5nZSB2cyBWNSA6PC9iPiBhbm5lYXUgcmVzc2VycsOpICgxODRweCkgcG91ciBkw6lnYWdlciBkZSBsJ2FpciBlbiBoYXV0LCBiYWRnZSBzw6lyaWUgaW50w6lncsOpIHNvdXMgbCdhbm5lYXUgKHBsdXMgZGUgZ291dHRlIHPDqXBhcsOpZSBxdWkgw6ljcmFzYWl0IGxlIGJhcyksIGdvdXR0ZSBWRE9UIGVucmljaGllIGQndW4gZGVsdGEgbWVuc3VlbCwgdHJhbnNpdGlvbiBlbiB2YWd1ZSBhbGzDqWfDqWUuIExlIG1vdGlmICJnb3V0dGUgb3JnYW5pcXVlIiBkZXZpZW50IGxhIHNpZ25hdHVyZSByw6l1dGlsaXPDqWUgc3VyIGxlcyA0IGF1dHJlcyDDqWNyYW5zIChoZXJvIFNwb3J0LCBiYWRnZXMgUHJvZmlsKS4KICAgICAgPC9kaXY+CiAgICA8L2Rpdj4KCiAgICA8ZGl2IGNsYXNzPSJwaG9uZS1jb2wiPgogICAgICA8ZGl2IGNsYXNzPSJwaG9uZS10YWciPjAyIMK3IFNwb3J0PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9InBob25lIj4KICAgICAgICA8ZGl2IGNsYXNzPSJsaXZpbmctYmciPjxzcGFuIGNsYXNzPSJsYjEiPjwvc3Bhbj48c3BhbiBjbGFzcz0ibGIyIj48L3NwYW4+PHNwYW4gY2xhc3M9ImxiMyI+PC9zcGFuPjwvZGl2PgogICAgICAgIDxkaXYgY2xhc3M9InBob25lLWlubmVyIj4KICAgICAgICAgIDxkaXYgY2xhc3M9ImhkciI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Imhkci1sb2dvIj48c3BhbiBjbGFzcz0iZG90Ij48L3NwYW4+SUtPUlVOPC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Imhkci1pY29uIj48c3ZnIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSI0IiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIzIi8+PHBhdGggZD0iTTE2IDJ2NE04IDJ2NE0zIDEwaDE4Ii8+PC9zdmc+PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9ImdyZWV0Ij48aDE+U3BvcnQ8L2gxPjxwPlJ1bm5pbmcgJmFtcDsgTXVzY3VsYXRpb248L3A+PC9kaXY+CgogICAgICAgICAgPGRpdiBjbGFzcz0icGlsbHMiIHN0eWxlPSJtYXJnaW4tdG9wOjE0cHgiPjxkaXYgY2xhc3M9InBpbGwgb24iPvCfj4MgUnVubmluZzwvZGl2PjxkaXYgY2xhc3M9InBpbGwiPvCfj4vvuI8gTXVzY3VsYXRpb248L2Rpdj48L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJjYWwtc3RyaXAiIHN0eWxlPSJtYXJnaW4tdG9wOjE2cHgiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJjYWwtZCI+PHNwYW4+TDwvc3Bhbj48ZGl2IGNsYXNzPSJuIj4yMTwvZGl2PjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJjYWwtZCBoYXMiPjxzcGFuPk08L3NwYW4+PGRpdiBjbGFzcz0ibiI+MjI8L2Rpdj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iY2FsLWQiPjxzcGFuPk08L3NwYW4+PGRpdiBjbGFzcz0ibiI+MjM8L2Rpdj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iY2FsLWQgdG9kYXkiPjxzcGFuPko8L3NwYW4+PGRpdiBjbGFzcz0ibiI+MjQ8L2Rpdj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iY2FsLWQgaGFzIj48c3Bhbj5WPC9zcGFuPjxkaXYgY2xhc3M9Im4iPjI1PC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNhbC1kIj48c3Bhbj5TPC9zcGFuPjxkaXYgY2xhc3M9Im4iPjI2PC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImNhbC1kIj48c3Bhbj5EPC9zcGFuPjxkaXYgY2xhc3M9Im4iPjI3PC9kaXY+PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJoZXJvLWRyb3AiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJoZXJvLWRyb3AtdG9wIj48ZGl2IGNsYXNzPSJoZXJvLWRyb3AtY2hpcCI+U8OpYW5jZSBkdSBqb3VyPC9kaXY+CiAgICAgICAgICAgICAgPHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3R5bGU9ImNvbG9yOnZhcigtLWVmZm9ydDIpIj48cGF0aCBkPSJNOSAxOGw2LTYtNi02Ii8+PC9zdmc+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Imhlcm8tZHJvcC10aXRsZSI+NiDDlyA4MDBtIFZNQTwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJoZXJvLWRyb3AtbWV0YSI+VmVuZHJlZGkgwrcgMDY6MzAgwrcgUsOpY3Vww6lyYXRpb24gMic8L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGVyby1kcm9wLXJvdyI+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGVyby1kcm9wLXN0YXQiPjxiPjQuOCBrbTwvYj48c3Bhbj5EaXN0YW5jZTwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgICA8ZGl2IGNsYXNzPSJoZXJvLWRyb3Atc3RhdCI+PGI+MzoxMjwvYj48c3Bhbj5BbGx1cmUgY2libGU8L3NwYW4+PC9kaXY+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGVyby1kcm9wLXN0YXQiPjxiPjM4IG1pbjwvYj48c3Bhbj5EdXLDqWUgZXN0Ljwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJzZWMtbGFiIj7DgCB2ZW5pcjxzcGFuIGNsYXNzPSJzZWUiPkNhbGVuZHJpZXI8L3NwYW4+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuZXh0LXJvdyI+PGRpdiBjbGFzcz0ibmV4dC1pYyIgc3R5bGU9ImNvbG9yOnZhcigtLW9rKTtib3JkZXItY29sb3I6cmdiYSh2YXIoLS1vay1yZ2IpLC4zKSI+PHN2ZyB3aWR0aD0iMTciIGhlaWdodD0iMTciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTEzIDJMNCAxNGg2bC0xIDggOS0xMmgtNnoiLz48L3N2Zz48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibmV4dC1ib2R5Ij48ZGl2IGNsYXNzPSJuZXh0LXRpdGxlIj5Gb290aW5nIDEwa208L2Rpdj48ZGl2IGNsYXNzPSJuZXh0LW1ldGEiPlNhbWVkaSDCtyBFbmR1cmFuY2UgZm9uZGFtZW50YWxlPC9kaXY+PC9kaXY+PGRpdiBjbGFzcz0ibmV4dC1hcnJvdyI+4oC6PC9kaXY+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuZXh0LXJvdyIgc3R5bGU9ImJvcmRlci1ib3R0b206bm9uZSI+PGRpdiBjbGFzcz0ibmV4dC1pYyI+PHN2ZyB3aWR0aD0iMTciIGhlaWdodD0iMTciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTEzIDJMNCAxNGg2bC0xIDggOS0xMmgtNnoiLz48L3N2Zz48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibmV4dC1ib2R5Ij48ZGl2IGNsYXNzPSJuZXh0LXRpdGxlIj5Tb3J0aWUgbG9uZ3VlIDE2a208L2Rpdj48ZGl2IGNsYXNzPSJuZXh0LW1ldGEiPkRpbWFuY2hlIMK3IEFsbHVyZSBtYXJhdGhvbjwvZGl2PjwvZGl2PjxkaXYgY2xhc3M9Im5leHQtYXJyb3ciPuKAujwvZGl2PjwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9InNlYy1sYWIiPk1lcyByZWNvcmRzPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4Ij4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ienJvdyI+PHNwYW4gY2xhc3M9Inpkb3QiIHN0eWxlPSJiYWNrZ3JvdW5kOnZhcigtLWUpIj48L3NwYW4+PHNwYW4gY2xhc3M9InpuYW1lIj41MDAwbTwvc3Bhbj48c3BhbiBjbGFzcz0ienZhbCI+MTg6NDI8L3NwYW4+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Inpyb3ciPjxzcGFuIGNsYXNzPSJ6ZG90IiBzdHlsZT0iYmFja2dyb3VuZDp2YXIoLS1lMikiPjwvc3Bhbj48c3BhbiBjbGFzcz0iem5hbWUiPjEwa208L3NwYW4+PHNwYW4gY2xhc3M9Inp2YWwiPjM5OjA1PC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJ6cm93Ij48c3BhbiBjbGFzcz0iemRvdCIgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0tZWZmb3J0MikiPjwvc3Bhbj48c3BhbiBjbGFzcz0iem5hbWUiPlNlbWk8L3NwYW4+PHNwYW4gY2xhc3M9Inp2YWwiPjE6Mjg6NTA8L3NwYW4+PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJzZWMtbGFiIj5NZXMgcGxhbnM8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9InBsYW4tcm93Ij48ZGl2IGNsYXNzPSJwbGFuLWljIiBzdHlsZT0iY29sb3I6dmFyKC0tZWZmb3J0MikiPvCfk4s8L2Rpdj48ZGl2IGNsYXNzPSJwbGFuLWJvZHkiPjxkaXYgY2xhc3M9InBsYW4tdGl0bGUiPlBsYW4gSUtPUlVOIOKAlCBTZW1pIGFmZsO7dGFnZTwvZGl2PjxkaXYgY2xhc3M9InBsYW4tc3ViIj5TdWl2aSBhY3R1ZWxsZW1lbnQgwrcgMTIgc2VtLjwvZGl2PjwvZGl2PjxzcGFuIGNsYXNzPSJsci1jaGV2Ij7igLo8L3NwYW4+PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJwbGFuLXJvdyI+PGRpdiBjbGFzcz0icGxhbi1pYyI+8J+TizwvZGl2PjxkaXYgY2xhc3M9InBsYW4tYm9keSI+PGRpdiBjbGFzcz0icGxhbi10aXRsZSI+MTBrbSBkw6ljb3V2ZXJ0ZTwvZGl2PjxkaXYgY2xhc3M9InBsYW4tc3ViIj5QbGFuIHBlcnNvIMK3IDggc2VtLjwvZGl2PjwvZGl2PjxzcGFuIGNsYXNzPSJsci1jaGV2Ij7igLo8L3NwYW4+PC9kaXY+CiAgICAgICAgPC9kaXY+CgogICAgICAgIDxkaXYgY2xhc3M9Im5hdiI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuYXYtaXRlbSI+PGRpdiBjbGFzcz0ibmF2LWljIj48c3ZnIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxwYXRoIGQ9Ik0zIDlsOS03IDkgN3YxMWEyIDIgMCAwMS0yIDJINWEyIDIgMCAwMS0yLTJ6Ii8+PC9zdmc+PC9kaXY+QWNjdWVpbDwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0gb24iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48cGF0aCBkPSJNMTMgMkw0IDE0aDZsLTEgOCA5LTEyaC02eiIvPjwvc3ZnPjwvZGl2PlNwb3J0PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuYXYtaXRlbSI+PGRpdiBjbGFzcz0ibmF2LWljIj48c3ZnIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxwYXRoIGQ9Ik0zIDEyaDRsMyA4IDQtMTYgMyA4aDQiLz48L3N2Zz48L2Rpdj5TdGF0czwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48cGF0aCBkPSJNMTQgNGw2IDYtOSA5SDV2LTZ6Ii8+PC9zdmc+PC9kaXY+T3V0aWxzPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuYXYtaXRlbSI+PGRpdiBjbGFzcz0ibmF2LWljIj48c3ZnIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iNyIgcj0iNCIvPjxwYXRoIGQ9Ik01LjUgMjFhNi41IDYuNSAwIDAxMTMgMCIvPjwvc3ZnPjwvZGl2PlByb2ZpbDwvZGl2PgogICAgICAgIDwvZGl2PgogICAgICA8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ibm90ZXMiPjxiPlNwb3J0IDo8L2I+IGxhIGNhcnRlICJzw6lhbmNlIGR1IGpvdXIiIHJlcHJlbmQgbGEgZm9ybWUgZ291dHRlIG9yZ2FuaXF1ZSBldCBsYSBjb3VsZXVyIGVmZm9ydCBkZSBsJ2FubmVhdSBkJ2FjY3VlaWwg4oCUIGMnZXN0IGxlIG3Dqm1lIHNpZ25hbCB2aXN1ZWwuIEJhbmRlYXUgZGUgc2VtYWluZSBjYWxlbmRyaWVyIGNvbXBhY3QgcG91ciBzd2l0Y2hlciB2aXRlIHNhbnMgcXVpdHRlciBsJ8OpY3Jhbi48L2Rpdj4KICAgIDwvZGl2PgoKICAgIDxkaXYgY2xhc3M9InBob25lLWNvbCI+CiAgICAgIDxkaXYgY2xhc3M9InBob25lLXRhZyI+MDMgwrcgU3RhdHM8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGhvbmUiPgogICAgICAgIDxkaXYgY2xhc3M9ImxpdmluZy1iZyI+PHNwYW4gY2xhc3M9ImxiMSI+PC9zcGFuPjxzcGFuIGNsYXNzPSJsYjIiPjwvc3Bhbj48c3BhbiBjbGFzcz0ibGIzIj48L3NwYW4+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0icGhvbmUtaW5uZXIiPgogICAgICAgICAgPGRpdiBjbGFzcz0iaGRyIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGRyLWxvZ28iPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj5JS09SVU48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGRyLWljb24iPjxzdmcgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAydjIwTTIgMTJoMjAiLz48L3N2Zz48L2Rpdj4KICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0iZ3JlZXQiPjxoMT5TdGF0aXN0aXF1ZXM8L2gxPjxwPkJpbGFuIMK3IFJ1bm5pbmcgwrcgTXVzY3UgwrcgTcOpZGFpbGxlczwvcD48L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJzZWciIHN0eWxlPSJtYXJnaW4tdG9wOjE2cHgiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJzZWctYnRuIG9uIj5TZW1haW5lPC9kaXY+PGRpdiBjbGFzcz0ic2VnLWJ0biI+TW9pczwvZGl2PjxkaXYgY2xhc3M9InNlZy1idG4iPjMgbW9pczwvZGl2PjxkaXYgY2xhc3M9InNlZy1idG4iPkFubsOpZTwvZGl2PgogICAgICAgICAgPC9kaXY+CgogICAgICAgICAgPGRpdiBjbGFzcz0ia2NoYXJ0LWNhcmQiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJrY2hhcnQtdG9wIj4KICAgICAgICAgICAgICA8ZGl2PjxkaXYgY2xhc3M9ImtjaGFydC1sYWIiPktpbG9tw6l0cmFnZTwvZGl2PjxkaXYgY2xhc3M9ImtjaGFydC12YWwiPjQyLjM8c3Bhbj5rbSBjdW11bMOpczwvc3Bhbj48L2Rpdj48L2Rpdj4KICAgICAgICAgICAgICA8ZGl2PjxkaXYgY2xhc3M9ImtjaGFydC1kZWx0YSI+4oaRIDEyJTwvZGl2PjxkaXYgY2xhc3M9ImtjaGFydC1kZWx0YS1zdWIiPnZzIHNlbWFpbmUgcHLDqWMuPC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJrYmFycyI+CiAgICAgICAgICAgICAgPGIgc3R5bGU9ImhlaWdodDo1NSUiPjwvYj48YiBjbGFzcz0idG9kYXkiIHN0eWxlPSJoZWlnaHQ6ODglIj48L2I+PGIgc3R5bGU9ImhlaWdodDozMCUiPjwvYj48YiBzdHlsZT0iaGVpZ2h0OjAlIj48L2I+PGIgY2xhc3M9InRvZGF5IiBzdHlsZT0iaGVpZ2h0OjEwMCUiPjwvYj48YiBzdHlsZT0iaGVpZ2h0OjAlIj48L2I+PGIgc3R5bGU9ImhlaWdodDowJSI+PC9iPgogICAgICAgICAgICA8L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ia2JhcnMtbGFiIj48c3Bhbj5MPC9zcGFuPjxzcGFuPk08L3NwYW4+PHNwYW4+TTwvc3Bhbj48c3Bhbj5KPC9zcGFuPjxzcGFuPlY8L3NwYW4+PHNwYW4+Uzwvc3Bhbj48c3Bhbj5EPC9zcGFuPjwvZGl2PgogICAgICAgICAgPC9kaXY+CgogICAgICAgICAgPGRpdiBjbGFzcz0ia2NoYXJ0LWNhcmQiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJrY2hhcnQtdG9wIj4KICAgICAgICAgICAgICA8ZGl2PjxkaXYgY2xhc3M9ImtjaGFydC1sYWIiPlRlbmRhbmNlIHZvbHVtZTwvZGl2PjxkaXYgY2xhc3M9ImtjaGFydC12YWwiPjQyLjM8c3Bhbj5rbSBjZXR0ZSBzZW1haW5lPC9zcGFuPjwvZGl2PjwvZGl2PgogICAgICAgICAgICAgIDxkaXYgY2xhc3M9ImtjaGFydC1kZWx0YSIgc3R5bGU9ImNvbG9yOnZhcigtLW11dGVkKSI+OCBzZW0uPC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgICA8c3ZnIHZpZXdCb3g9IjAgMCAzMDAgNjAiIHN0eWxlPSJtYXJnaW4tdG9wOjE0cHg7d2lkdGg6MTAwJTtoZWlnaHQ6NjBweCI+CiAgICAgICAgICAgICAgPHBvbHlsaW5lIHBvaW50cz0iMCw0MiA0MCwzOCA4MCw0NCAxMjAsMjYgMTYwLDMyIDIwMCwxNCAyNDAsMjIgMjgwLDgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzZGQTBGRiIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgogICAgICAgICAgICA8L3N2Zz4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9Imtyb3czIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ia3RpbGUiPjxkaXYgY2xhc3M9Imt0aWxlLWxhYiI+S20gLyBzw6lhbmNlPC9kaXY+PGRpdiBjbGFzcz0ia3RpbGUtdmFsIj44LjQga208L2Rpdj48ZGl2IGNsYXNzPSJrdGlsZS1zdWIiPuKGkSA2JTwvZGl2PjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJrdGlsZSI+CiAgICAgICAgICAgICAgPGRpdiBjbGFzcz0ia3RpbGUtbGFiIj5UeXBlczwvZGl2PgogICAgICAgICAgICAgIDxzdmcgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiB2aWV3Qm94PSIwIDAgNTAgNTAiIHN0eWxlPSJtYXJnaW46MCBhdXRvIj4KICAgICAgICAgICAgICAgIDxjaXJjbGUgY3g9IjI1IiBjeT0iMjUiIHI9IjIwIiBmaWxsPSJub25lIiBzdHJva2U9InZhcigtLUwzKSIgc3Ryb2tlLXdpZHRoPSI5Ii8+CiAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PSIyNSIgY3k9IjI1IiByPSIyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ2YXIoLS1lKSIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtZGFzaGFycmF5PSI3MCAxMjYiIHN0cm9rZS1kYXNob2Zmc2V0PSIwIiB0cmFuc2Zvcm09InJvdGF0ZSgtOTAgMjUgMjUpIi8+CiAgICAgICAgICAgICAgICA8Y2lyY2xlIGN4PSIyNSIgY3k9IjI1IiByPSIyMCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ2YXIoLS1lZmZvcnQyKSIgc3Ryb2tlLXdpZHRoPSI5IiBzdHJva2UtZGFzaGFycmF5PSI0MCAxMjYiIHN0cm9rZS1kYXNob2Zmc2V0PSItNzAiIHRyYW5zZm9ybT0icm90YXRlKC05MCAyNSAyNSkiLz4KICAgICAgICAgICAgICA8L3N2Zz4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Imt0aWxlIj48c3BhbiBzdHlsZT0iZm9udC1zaXplOjE2cHgiPuKtkDwvc3Bhbj48ZGl2IGNsYXNzPSJrdGlsZS1sYWIiPk1laWxsZXVyIGpvdXI8L2Rpdj48ZGl2IGNsYXNzPSJrdGlsZS12YWwiPlZlbi48L2Rpdj48ZGl2IGNsYXNzPSJrdGlsZS1zdWIiIHN0eWxlPSJjb2xvcjp2YXIoLS1tdXRlZCkiPjEwLjIga208L2Rpdj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9ImNhcmQtdCI+8J+PhSBab25lcyBkJ2FsbHVyZSDigJQgVkRPVCA2NzwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJ6cm93Ij48c3BhbiBjbGFzcz0iemRvdCIgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0tb2spIj48L3NwYW4+PHNwYW4gY2xhc3M9InpuYW1lIj5FRjwvc3Bhbj48c3BhbiBjbGFzcz0ienZhbCI+NToxMiAva208L3NwYW4+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Inpyb3ciPjxzcGFuIGNsYXNzPSJ6ZG90IiBzdHlsZT0iYmFja2dyb3VuZDojRjVCOTQyIj48L3NwYW4+PHNwYW4gY2xhc3M9InpuYW1lIj5UZW1wbzwvc3Bhbj48c3BhbiBjbGFzcz0ienZhbCI+NDowNSAva208L3NwYW4+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9Inpyb3ciPjxzcGFuIGNsYXNzPSJ6ZG90IiBzdHlsZT0iYmFja2dyb3VuZDp2YXIoLS1lZmZvcnQyKSI+PC9zcGFuPjxzcGFuIGNsYXNzPSJ6bmFtZSI+U2V1aWw8L3NwYW4+PHNwYW4gY2xhc3M9Inp2YWwiPjM6MzggL2ttPC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJ6cm93Ij48c3BhbiBjbGFzcz0iemRvdCIgc3R5bGU9ImJhY2tncm91bmQ6dmFyKC0tZWZmb3J0KSI+PC9zcGFuPjxzcGFuIGNsYXNzPSJ6bmFtZSI+Vk1BPC9zcGFuPjxzcGFuIGNsYXNzPSJ6dmFsIj4zOjEyIC9rbTwvc3Bhbj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9ImNhcmQiPjxkaXYgY2xhc3M9ImNhcmQtdCI+8J+UpSAxMyBkZXJuacOocmVzIHNlbWFpbmVzPC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImhlYXQiIGlkPSJoZWF0Z2VuIj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgogICAgICAgIDwvZGl2PgoKICAgICAgICA8ZGl2IGNsYXNzPSJuYXYiPgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48cGF0aCBkPSJNMyA5bDktNyA5IDd2MTFhMiAyIDAgMDEtMiAySDVhMiAyIDAgMDEtMi0yeiIvPjwvc3ZnPjwvZGl2PkFjY3VlaWw8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTEzIDJMNCAxNGg2bC0xIDggOS0xMmgtNnoiLz48L3N2Zz48L2Rpdj5TcG9ydDwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0gb24iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48cGF0aCBkPSJNMyAxMmg0bDMgOCA0LTE2IDMgOGg0Ii8+PC9zdmc+PC9kaXY+U3RhdHM8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTE0IDRsNiA2LTkgOUg1di02eiIvPjwvc3ZnPjwvZGl2Pk91dGlsczwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz48cGF0aCBkPSJNNS41IDIxYTYuNSA2LjUgMCAwMTEzIDAiLz48L3N2Zz48L2Rpdj5Qcm9maWw8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Im5vdGVzIj48Yj5TdGF0cyA6PC9iPiBzZWdtZW50ZWQgY29udHJvbCBmYcOnb24gcGlsdWxlLCBjYXJ0ZXMga20vdGVuZGFuY2UgZW4gcGxlaW5lIGxhcmdldXIgKGxpc2liaWxpdMOpIGRhdGEpLCBkb251dCArIDIgdHVpbGVzIHBvdXIgbGVzIGluc2lnaHRzIGNvbmRlbnPDqXMgZW4gdW5lIGxpZ25lLCBoZWF0bWFwIDEzIHNlbWFpbmVzIGNvbnNlcnbDqWUuPC9kaXY+CiAgICA8L2Rpdj4KCiAgICA8ZGl2IGNsYXNzPSJwaG9uZS1jb2wiPgogICAgICA8ZGl2IGNsYXNzPSJwaG9uZS10YWciPjA0IMK3IE91dGlsczwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJwaG9uZSI+CiAgICAgICAgPGRpdiBjbGFzcz0ibGl2aW5nLWJnIj48c3BhbiBjbGFzcz0ibGIxIj48L3NwYW4+PHNwYW4gY2xhc3M9ImxiMiI+PC9zcGFuPjxzcGFuIGNsYXNzPSJsYjMiPjwvc3Bhbj48L2Rpdj4KICAgICAgICA8ZGl2IGNsYXNzPSJwaG9uZS1pbm5lciI+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJoZHIiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJoZHItbG9nbyI+PHNwYW4gY2xhc3M9ImRvdCI+PC9zcGFuPklLT1JVTjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJkcm9wIiBzdHlsZT0icG9zaXRpb246c3RhdGljO3dpZHRoOjUycHg7aGVpZ2h0OjUycHg7Ym9yZGVyLXJhZGl1czo1MCU7Ym9yZGVyOjJweCBzb2xpZCB2YXIoLS1lKTtiYWNrZ3JvdW5kOnJnYmEoNjEsMTI3LDI1NSwuMDgpIj4KICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJmb250LWZhbWlseTonSmV0QnJhaW5zIE1vbm8nO2ZvbnQtd2VpZ2h0OjgwMDtmb250LXNpemU6MTRweDtjb2xvcjp2YXIoLS1lKSI+Njc8L2Rpdj48ZGl2IHN0eWxlPSJmb250LXNpemU6N3B4O2NvbG9yOnZhcigtLW11dGVkKTtsZXR0ZXItc3BhY2luZzouNXB4Ij5WRE9UPC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJncmVldCI+PGgxPk91dGlsczwvaDE+PHA+Q2FsY3VsYXRldXJzICZhbXA7IGNocm9ub23DqHRyZXM8L3A+PC9kaXY+CgogICAgICAgICAgPGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDoxMHB4O21hcmdpbjoxNnB4IDAiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6MTRweDttYXJnaW46MDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tZSk7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpjZW50ZXIiPjxzdmcgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTMiIHI9IjgiLz48cGF0aCBkPSJNMTIgOXY0bDMgMk05IDJoNk0xNy41IDYuNWwxLjUtMS41Ii8+PC9zdmc+PC9kaXY+PGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2ZvbnQtc2l6ZToxMi41cHg7bWFyZ2luLXRvcDo3cHgiPkNocm9ubzwvZGl2PjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6MTRweDttYXJnaW46MDt0ZXh0LWFsaWduOmNlbnRlciI+PGRpdiBzdHlsZT0iY29sb3I6I0Y1Qjk0MjtkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OmNlbnRlciI+PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iMyIvPjxwYXRoIGQ9Ik0xMiA4djRsMi41IDIuNSIvPjwvc3ZnPjwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtd2VpZ2h0OjcwMDtmb250LXNpemU6MTIuNXB4O21hcmdpbi10b3A6N3B4Ij5NaW51dGV1cjwvZGl2PjwvZGl2PgogICAgICAgICAgPC9kaXY+CgogICAgICAgICAgPGRpdiBjbGFzcz0ic2VhcmNoYm94Ij48c3ZnIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48Y2lyY2xlIGN4PSIxMSIgY3k9IjExIiByPSI3Ii8+PHBhdGggZD0iTTIxIDIxbC00LTQiLz48L3N2Zz4gUmVjaGVyY2hlciB1biBvdXRpbOKApjwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9InNlYy1sYWIiIHN0eWxlPSJib3JkZXItdG9wOm5vbmU7cGFkZGluZy10b3A6MCI+RmF2b3JpczxzcGFuIGNsYXNzPSJzZWUiPk1vZGlmaWVyPC9zcGFuPjwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0iZmF2Z3JpZCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImZhdnRpbGUiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLWUpIj7wn6eqPC9kaXY+PGRpdiBjbGFzcz0iZmF2bGFiIj5QZXJmLiBMYWI8L2Rpdj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZmF2dGlsZSI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tZSkiPuKdpO+4jzwvZGl2PjxkaXYgY2xhc3M9ImZhdmxhYiI+U2FudMOpPC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImZhdnRpbGUiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLWUpIj7wn5OIPC9kaXY+PGRpdiBjbGFzcz0iZmF2bGFiIj5WRE9UPC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImZhdnRpbGUiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLWUpIj7wn5KnPC9kaXY+PGRpdiBjbGFzcz0iZmF2bGFiIj5FYXU8L2Rpdj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9InNlYy1sYWIiPk91dGlscyBwcmluY2lwYXV4PC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIiBzdHlsZT0ibWFyZ2luLXRvcDoxMHB4O3BhZGRpbmc6NHB4IDE0cHgiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJsaXN0LXJvdyI+PGRpdiBjbGFzcz0ibHItaWNvbiI+8J+nqjwvZGl2PjxkaXYgY2xhc3M9ImxyLXR4dCI+PGRpdiBjbGFzcz0ibHItdGl0bGUiPlBlcmYuIExhYjwvZGl2PjxkaXYgY2xhc3M9ImxyLXN1YiI+QW5hbHlzZSBjb21wbMOodGUgZGUgcGVyZm9ybWFuY2U8L2Rpdj48L2Rpdj48c3BhbiBjbGFzcz0ibHItY2hldiI+4oC6PC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJsaXN0LXJvdyI+PGRpdiBjbGFzcz0ibHItaWNvbiI+4p2k77iPPC9kaXY+PGRpdiBjbGFzcz0ibHItdHh0Ij48ZGl2IGNsYXNzPSJsci10aXRsZSI+U2FudMOpPC9kaXY+PGRpdiBjbGFzcz0ibHItc3ViIj5UYWJsZWF1IGRlIGJvcmQgc2FudMOpPC9kaXY+PC9kaXY+PHNwYW4gY2xhc3M9ImxyLWNoZXYiPuKAujwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0ibGlzdC1yb3ciPjxkaXYgY2xhc3M9ImxyLWljb24iPuKPse+4jzwvZGl2PjxkaXYgY2xhc3M9ImxyLXR4dCI+PGRpdiBjbGFzcz0ibHItdGl0bGUiPkNocm9ub23DqHRyZTwvZGl2PjxkaXYgY2xhc3M9ImxyLXN1YiI+VG91cnMgJmFtcDsgc3BsaXRzPC9kaXY+PC9kaXY+PHNwYW4gY2xhc3M9ImxyLWNoZXYiPuKAujwvc3Bhbj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9InNlYy1sYWIiPkF1dHJlcyBvdXRpbHM8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9ImZhdmdyaWQiIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJmYXZ0aWxlIj48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1lKSI+8J+UgTwvZGl2PjxkaXYgY2xhc3M9ImZhdmxhYiI+Q29udmVydC48L2Rpdj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZmF2dGlsZSI+PGRpdiBzdHlsZT0iY29sb3I6dmFyKC0tZSkiPvCfk508L2Rpdj48ZGl2IGNsYXNzPSJmYXZsYWIiPk5vdGVzPC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImZhdnRpbGUiPjxkaXYgc3R5bGU9ImNvbG9yOnZhcigtLWUpIj7impbvuI88L2Rpdj48ZGl2IGNsYXNzPSJmYXZsYWIiPklNQzwvZGl2PjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJmYXZ0aWxlIj48ZGl2IHN0eWxlPSJjb2xvcjp2YXIoLS1lKSI+8J+UpTwvZGl2PjxkaXYgY2xhc3M9ImZhdmxhYiI+Q2Fsb3JpZXM8L2Rpdj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgogICAgICAgIDwvZGl2PgoKICAgICAgICA8ZGl2IGNsYXNzPSJuYXYiPgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48cGF0aCBkPSJNMyA5bDktNyA5IDd2MTFhMiAyIDAgMDEtMiAySDVhMiAyIDAgMDEtMi0yeiIvPjwvc3ZnPjwvZGl2PkFjY3VlaWw8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTEzIDJMNCAxNGg2bC0xIDggOS0xMmgtNnoiLz48L3N2Zz48L2Rpdj5TcG9ydDwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48cGF0aCBkPSJNMyAxMmg0bDMgOCA0LTE2IDMgOGg0Ii8+PC9zdmc+PC9kaXY+U3RhdHM8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIG9uIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTE0IDRsNiA2LTkgOUg1di02eiIvPjwvc3ZnPjwvZGl2Pk91dGlsczwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0ibmF2LWl0ZW0iPjxkaXYgY2xhc3M9Im5hdi1pYyI+PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMi4yIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjciIHI9IjQiLz48cGF0aCBkPSJNNS41IDIxYTYuNSA2LjUgMCAwMTEzIDAiLz48L3N2Zz48L2Rpdj5Qcm9maWw8L2Rpdj4KICAgICAgICA8L2Rpdj4KICAgICAgPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9Im5vdGVzIj48Yj5PdXRpbHMgOjwvYj4gYmFkZ2UgVkRPVCBlbiBoYXV0IMOgIGRyb2l0ZSBkZXZpZW50IHVuIGNlcmNsZSBwbGVpbiAocmVww6hyZSBjb25zdGFudCBzdXIgY2V0IMOpY3JhbiksIHJhY2NvdXJjaXMgQ2hyb25vL01pbnV0ZXVyIGVuIGNhcnRlcyBqdW1lbGxlcywgZ3JpbGxlcyBkZSB0dWlsZXMgcG91ciBmYXZvcmlzL2F1dHJlcyBvdXRpbHMsIGxpc3RlIGNsYXNzaXF1ZSBwb3VyIGxlcyAzIG91dGlscyBwcmluY2lwYXV4LjwvZGl2PgogICAgPC9kaXY+CgogICAgPGRpdiBjbGFzcz0icGhvbmUtY29sIj4KICAgICAgPGRpdiBjbGFzcz0icGhvbmUtdGFnIj4wNSDCtyBQcm9maWw8L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icGhvbmUiPgogICAgICAgIDxkaXYgY2xhc3M9ImxpdmluZy1iZyI+PHNwYW4gY2xhc3M9ImxiMSI+PC9zcGFuPjxzcGFuIGNsYXNzPSJsYjIiPjwvc3Bhbj48c3BhbiBjbGFzcz0ibGIzIj48L3NwYW4+PC9kaXY+CiAgICAgICAgPGRpdiBjbGFzcz0icGhvbmUtaW5uZXIiPgogICAgICAgICAgPGRpdiBjbGFzcz0iaGRyIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGRyLWxvZ28iPjxzcGFuIGNsYXNzPSJkb3QiPjwvc3Bhbj5JS09SVU48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iaGRyLWljb24iPjxzdmcgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48cGF0aCBkPSJNMTkuNCAxNWExLjcgMS43IDAgMDAuMyAxLjlsLjEuMWEyIDIgMCAxMS0yLjggMi44bC0uMS0uMWExLjcgMS43IDAgMDAtMS45LS4zIDEuNyAxLjcgMCAwMC0xIDEuNVYyMWEyIDIgMCAwMS00IDB2LS4xYTEuNyAxLjcgMCAwMC0xLTEuNiAxLjcgMS43IDAgMDAtMS45LjNsLS4xLjFhMiAyIDAgMTEtMi44LTIuOGwuMS0uMWExLjcgMS43IDAgMDAuMy0xLjkgMS43IDEuNyAwIDAwLTEuNS0xSDNhMiAyIDAgMDEwLTRoLjFhMS43IDEuNyAwIDAwMS41LTEgMS43IDEuNyAwIDAwLS4zLTEuOWwtLjEtLjFhMiAyIDAgMTEyLjgtMi44bC4xLjFhMS43IDEuNyAwIDAwMS45LjNIOWExLjcgMS43IDAgMDAxLTEuNVYzYTIgMiAwIDAxNCAwdi4xYTEuNyAxLjcgMCAwMDEgMS41IDEuNyAxLjcgMCAwMDEuOS0uM2wuMS0uMWEyIDIgMCAxMTIuOCAyLjhsLS4xLjFhMS43IDEuNyAwIDAwLS4zIDEuOVY5YTEuNyAxLjcgMCAwMDEuNSAxaC4xYTIgMiAwIDAxMCA0aC0uMWExLjcgMS43IDAgMDAtMS41IDF6Ii8+PC9zdmc+PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KCiAgICAgICAgICA8ZGl2IGNsYXNzPSJjYXJkIHBmLWhlcm8iIHN0eWxlPSJtYXJnaW4tdG9wOjE0cHgiPgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJwZi1hdiI+SDwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJwZi1uYW1lIj5IYW1vdTwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJwZi1tYWlsIj5oYW1vdUBpa29ydW4uYXBwPC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9InJhbmtjaGlwIj5OaXZlYXUgMTQgwrcgQ291cmV1ciBjb25maXJtw6kgwrcgMyAyNDAgWFA8L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9ImdycC1jYXJkIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZ3JwLXJvdyI+PGRpdiBjbGFzcz0ibHItaWNvbiI+8J+TjzwvZGl2PjxkaXYgY2xhc3M9ImxyLXRpdGxlIj5UYWlsbGUgLyBQb2lkczwvZGl2PjxkaXYgY2xhc3M9ImxyLXZhbCI+MTc4IGNtIMK3IDcxIGtnPC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImdycC1yb3ciPjxkaXYgY2xhc3M9ImxyLWljb24iPvCfjoI8L2Rpdj48ZGl2IGNsYXNzPSJsci10aXRsZSI+w4JnZTwvZGl2PjxkaXYgY2xhc3M9ImxyLXZhbCI+MjcgYW5zPC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImdycC1yb3ciPjxkaXYgY2xhc3M9ImxyLWljb24iPvCfk4g8L2Rpdj48ZGl2IGNsYXNzPSJsci10aXRsZSI+VkRPVDwvZGl2PjxkaXYgY2xhc3M9ImxyLXZhbCI+Njc8L2Rpdj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZ3JwLXJvdyI+PGRpdiBjbGFzcz0ibHItaWNvbiI+8J+OrzwvZGl2PjxkaXYgY2xhc3M9ImxyLXRpdGxlIj5PYmplY3RpZjwvZGl2PjxkaXYgY2xhc3M9ImxyLXZhbCI+U2VtaSDCtyBKLTM4PC9kaXY+PHNwYW4gY2xhc3M9ImxyLWNoZXYiPuKAujwvc3Bhbj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9InNlYy1sYWIiIHN0eWxlPSJib3JkZXItdG9wOm5vbmU7cGFkZGluZy10b3A6MCI+UHJvZ3Jlc3Npb248c3BhbiBjbGFzcz0ic2VlIj4xOCAvIDQyPC9zcGFuPjwvZGl2PgogICAgICAgICAgPGRpdiBjbGFzcz0iY2FyZCIgc3R5bGU9Im1hcmdpbi10b3A6MTBweCI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImJkLWNsdXN0ZXIiPgogICAgICAgICAgICAgIDxkaXYgY2xhc3M9ImJkLWljb24iPvCfj4U8L2Rpdj48ZGl2IGNsYXNzPSJiZC1pY29uIj7wn5SlPC9kaXY+PGRpdiBjbGFzcz0iYmQtaWNvbiI+4pqhPC9kaXY+PGRpdiBjbGFzcz0iYmQtaWNvbiI+8J+PlO+4jzwvZGl2PjxkaXYgY2xhc3M9ImJkLWljb24iPvCfjpbvuI88L2Rpdj4KICAgICAgICAgICAgPC9kaXY+CiAgICAgICAgICAgIDxkaXYgc3R5bGU9Im1hcmdpbi10b3A6MTRweDtwYWRkaW5nLXRvcDoxMnB4O2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWhhaXIpIj4KICAgICAgICAgICAgICA8ZGl2IHN0eWxlPSJkaXNwbGF5OmZsZXg7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47Zm9udC1zaXplOjEycHg7Y29sb3I6dmFyKC0tbXV0ZWQpO21hcmdpbi1ib3R0b206NnB4Ij5Qcm9jaGFpbiA6IE1hcmF0aG9uaWVuIDxzcGFuIHN0eWxlPSJjb2xvcjp2YXIoLS1lKSI+NzIlPC9zcGFuPjwvZGl2PgogICAgICAgICAgICAgIDxkaXYgc3R5bGU9ImhlaWdodDo2cHg7YmFja2dyb3VuZDp2YXIoLS1MMyk7Ym9yZGVyLXJhZGl1czo0cHg7b3ZlcmZsb3c6aGlkZGVuIj48ZGl2IHN0eWxlPSJ3aWR0aDo3MiU7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsdmFyKC0tZSksdmFyKC0tZTIpKSI+PC9kaXY+PC9kaXY+CiAgICAgICAgICAgIDwvZGl2PgogICAgICAgICAgPC9kaXY+CgogICAgICAgICAgPGRpdiBjbGFzcz0iZ3JwLWxhYiI+Q29tcHRlPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJncnAtY2FyZCI+CiAgICAgICAgICAgIDxkaXYgY2xhc3M9ImdycC1yb3ciPjxkaXYgY2xhc3M9ImxyLWljb24iPvCfkaU8L2Rpdj48ZGl2IGNsYXNzPSJsci10aXRsZSI+QW1pcyAmYW1wOyBjbGFzc2VtZW50PC9kaXY+PHNwYW4gY2xhc3M9ImxyLWNoZXYiPuKAujwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZ3JwLXJvdyI+PGRpdiBjbGFzcz0ibHItaWNvbiI+8J+RpDwvZGl2PjxkaXYgY2xhc3M9ImxyLXRpdGxlIj5Hw6lyZXIgbGUgcHJvZmlsPC9kaXY+PHNwYW4gY2xhc3M9ImxyLWNoZXYiPuKAujwvc3Bhbj48L2Rpdj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZ3JwLXJvdyI+PGRpdiBjbGFzcz0ibHItaWNvbiI+8J+UlDwvZGl2PjxkaXYgY2xhc3M9ImxyLXRpdGxlIj5Ob3RpZmljYXRpb25zPC9kaXY+PHNwYW4gY2xhc3M9ImxyLWNoZXYiPuKAujwvc3Bhbj48L2Rpdj4KICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgIDxkaXYgY2xhc3M9ImdycC1sYWIiPlByw6lmw6lyZW5jZXM8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9ImdycC1jYXJkIj4KICAgICAgICAgICAgPGRpdiBjbGFzcz0iZ3JwLXJvdyI+PGRpdiBjbGFzcz0ibHItaWNvbiI+8J+PhTwvZGl2PjxkaXYgY2xhc3M9ImxyLXRpdGxlIj5IaXN0b3JpcXVlICZhbXA7IHJlY29yZHM8L2Rpdj48c3BhbiBjbGFzcz0ibHItY2hldiI+4oC6PC9zcGFuPjwvZGl2PgogICAgICAgICAgICA8ZGl2IGNsYXNzPSJncnAtcm93IiBzdHlsZT0iYm9yZGVyLWJvdHRvbTpub25lIj48ZGl2IGNsYXNzPSJsci1pY29uIj7wn46oPC9kaXY+PGRpdiBjbGFzcz0ibHItdGl0bGUiPlRow6htZTwvZGl2PjxkaXYgY2xhc3M9ImxyLXZhbCI+U29tYnJlPC9kaXY+PC9kaXY+CiAgICAgICAgICA8L2Rpdj4KICAgICAgICA8L2Rpdj4KCiAgICAgICAgPGRpdiBjbGFzcz0ibmF2Ij4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTMgOWw5LTcgOSA3djExYTIgMiAwIDAxLTIgMkg1YTIgMiAwIDAxLTItMnoiLz48L3N2Zz48L2Rpdj5BY2N1ZWlsPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuYXYtaXRlbSI+PGRpdiBjbGFzcz0ibmF2LWljIj48c3ZnIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxwYXRoIGQ9Ik0xMyAyTDQgMTRoNmwtMSA4IDktMTJoLTZ6Ii8+PC9zdmc+PC9kaXY+U3BvcnQ8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PHBhdGggZD0iTTMgMTJoNGwzIDggNC0xNiAzIDhoNCIvPjwvc3ZnPjwvZGl2PlN0YXRzPC9kaXY+CiAgICAgICAgICA8ZGl2IGNsYXNzPSJuYXYtaXRlbSI+PGRpdiBjbGFzcz0ibmF2LWljIj48c3ZnIHdpZHRoPSIxOCIgaGVpZ2h0PSIxOCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyLjIiPjxwYXRoIGQ9Ik0xNCA0bDYgNi05IDlINXYtNnoiLz48L3N2Zz48L2Rpdj5PdXRpbHM8L2Rpdj4KICAgICAgICAgIDxkaXYgY2xhc3M9Im5hdi1pdGVtIG9uIj48ZGl2IGNsYXNzPSJuYXYtaWMiPjxzdmcgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIuMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSI3IiByPSI0Ii8+PHBhdGggZD0iTTUuNSAyMWE2LjUgNi41IDAgMDExMyAwIi8+PC9zdmc+PC9kaXY+UHJvZmlsPC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICAgIDwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJub3RlcyI+PGI+UHJvZmlsIDo8L2I+IGxlcyBiYWRnZXMgcmVwcmVubmVudCBsYSBmb3JtZSBnb3V0dGUgb3JnYW5pcXVlIChkb3LDqSBjZXR0ZSBmb2lzLCBjb2jDqXJlbnQgYXZlYyBsZSB0aMOobWUgcsOpY29tcGVuc2UpIGF1IGxpZXUgZCdpY8O0bmVzIGNhcnLDqWVzLiBMaXN0ZXMgZ3JvdXDDqWVzIGNvbnNlcnbDqWVzIHBvdXIgbGEgbGlzaWJpbGl0w6kgZGVzIHLDqWdsYWdlcy48L2Rpdj4KICAgIDwvZGl2PgoKICA8L2Rpdj4KPC9kaXY+Cgo8c2NyaXB0PgogIChmdW5jdGlvbigpewogICAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuaGVhdCcpOwogICAgZWwuZm9yRWFjaChib3g9PnsKICAgICAgbGV0IGg9Jyc7CiAgICAgIGZvcihsZXQgaT0wO2k8OTE7aSsrKXsKICAgICAgICBjb25zdCBjID0gTWF0aC5yYW5kb20oKTsKICAgICAgICBjb25zdCBvcCA9IGM8MC4zNSA/IDAgOiBNYXRoLm1pbigxLCAuMjUrYyouOSk7CiAgICAgICAgaCArPSAnPGRpdiBzdHlsZT0iYmFja2dyb3VuZDonKyhvcD4wID8gJ3JnYmEoNjEsMTI3LDI1NSwnK29wLnRvRml4ZWQoMikrJyknIDogJ3JnYmEoMjU1LDI1NSwyNTUsLjA1KScpKyciPjwvZGl2Pic7CiAgICAgIH0KICAgICAgYm94LmlubmVySFRNTCA9IGg7CiAgICB9KTsKICB9KSgpOwo8L3NjcmlwdD4KPC9ib2R5Pgo8L2h0bWw+Cg==";

function openV6Preview(){
  const f=document.getElementById('v6Frame');
  if(f && !f.dataset.loaded){
    try{ f.srcdoc=decodeURIComponent(escape(atob(V6_MOCKUP_B64))); f.dataset.loaded='1'; }
    catch(e){ f.srcdoc=atob(V6_MOCKUP_B64); f.dataset.loaded='1'; }
  }
  openOv('ovV6Preview');
}
