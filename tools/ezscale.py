#!/usr/bin/env python3
"""Usage : python3 tools/ezscale.py (après toute modification de taille de police dans app.css).
Génère le bloc « textes agrandis du mode simple » à partir de app.css.
Chaque règle qui fixe une taille de police en px reçoit une version html.easy-mode,
×1,15 (×1,08 au-delà de 20 px, inchangée au-delà de 32 px), dans le même @media.
Le bloc est encadré par deux marqueurs et régénéré à l'identique à chaque passage."""
import os,re
P=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','app.css')
BEG='/* >>> MODE SIMPLE : TEXTES AGRANDIS (généré par tools/ezscale.py, ne pas éditer à la main) >>> */'
END='/* <<< MODE SIMPLE : TEXTES AGRANDIS <<< */'
css=open(P).read()
if BEG in css: css=css[:css.index(BEG)].rstrip()+'\n'
src=re.sub(r'/\*.*?\*/','',css,flags=re.S)
SKIP_AT=('@keyframes','@-webkit-keyframes','@font-face','@property','@page','@counter-style')
def parse(t,i=0):
    items=[]; n=len(t)
    while i<n:
        j=i
        while j<n and t[j] not in '{};': j+=1
        if j>=n: break
        if t[j]==';': i=j+1; continue
        if t[j]=='}': return items,j+1
        pre=t[i:j].strip()
        if pre.startswith('@'):
            if pre.startswith(SKIP_AT) or not pre.startswith(('@media','@supports','@container','@layer')):
                d=0; k=j
                while k<n:
                    if t[k]=='{': d+=1
                    elif t[k]=='}':
                        d-=1
                        if d==0: break
                    k+=1
                i=k+1; continue
            ch,i=parse(t,j+1); items.append(('at',pre,ch)); continue
        k=t.index('}',j); items.append(('rule',pre,t[j+1:k])); i=k+1
    return items,i
def split_sel(s):
    out=[]; d=0; cur=''
    for c in s:
        if c in '([': d+=1
        elif c in ')]': d-=1
        if c==',' and d==0: out.append(cur.strip()); cur=''; continue
        cur+=c
    if cur.strip(): out.append(cur.strip())
    return out
def tr(sel):
    if sel.startswith(':root') or ':not(#_)' in sel: return None
    if re.match(r'html\b',sel): return 'html.easy-mode'+sel[4:]
    return 'html.easy-mode '+sel
def scale(px):
    if px<=20: v=px*1.15
    elif px<=32: v=px*1.08
    else: return None
    return round(v*2)/2
def gen(items,ind=''):
    out=[]
    for it in items:
        if it[0]=='at':
            inner=gen(it[2],ind+'  ')
            if inner: out.append(ind+it[1]+'{\n'+'\n'.join(inner)+'\n'+ind+'}')
            continue
        _,sel,body=it
        m=list(re.finditer(r'font-size\s*:\s*([\d.]+)px\s*(!important)?',body))
        if not m: continue
        mm=m[-1]; px=float(mm.group(1)); v=scale(px)
        if v is None or v==px: continue
        sels=[x for x in (tr(s) for s in split_sel(sel)) if x]
        if not sels: continue
        out.append(ind+','.join(sels)+'{font-size:'+('%g'%v)+'px'+(' !important' if mm.group(2) else '')+';}')
    return out
items,_=parse(src)
rules=gen(items)
# tailles écrites en ligne dans les gabarits JS (style="font-size:12px")
inl=[]
for px in [9,9.5,10,10.5,11,11.5,12,12.5,13,13.5,14,14.5,15,15.5,16,17,18,19,20]:
    inl.append('html.easy-mode [style*="font-size:%gpx"]{font-size:%gpx !important;}'%(px,scale(px)))
block='\n'+BEG+'\n'+'\n'.join(rules)+'\n'+'\n'.join(inl)+'\n'+END+'\n'
open(P,'w').write(css+block)
print(len(rules),'règles,',len(block)//1024,'Ko')
