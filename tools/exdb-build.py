#!/usr/bin/env python3
"""Génère exercises/exdb.js depuis : free-exercise-db (Unlicense), les traductions FR/AR (tr/*.tsv) et les
exercices de rééducation rédigés pour IKORUN (rehab_ex.py / rehab_prog.py).
Usage : python3 -I tools/exdb-build.py <dossier-source> <sortie.js>"""
import json, glob, sys, os
src, out = sys.argv[1], sys.argv[2]
D = {e['id']: e for e in json.load(open(os.path.join(src, 'exercises.json'), encoding='utf8'))}
R = {}; P = {}; COMMON = {}
g = {}; exec(open(os.path.join(src, 'rehab_ex.py'), encoding='utf8').read(), g); R = g['R']
g2 = {}; exec(open(os.path.join(src, 'rehab_prog.py'), encoding='utf8').read(), g2); P = g2['P']; COMMON = g2['COMMON']
GRP = {'abdominals':'Abdominaux','abductors':'Abducteurs','adductors':'Adducteurs','biceps':'Biceps','calves':'Mollets','chest':'Pectoraux',
 'forearms':'Avant-bras','glutes':'Fessiers','hamstrings':'Ischios','lats':'Dos','lower back':'Lombaires','middle back':'Dos','neck':'Cou',
 'quadriceps':'Quadriceps','shoulders':'Épaules','traps':'Trapèzes','triceps':'Triceps'}
MUS = dict(GRP); MUS['lats'] = 'Grand dorsal'
EQ = {'body only':'Poids du corps','barbell':'Barre','dumbbell':'Haltères','machine':'Machine','cable':'Poulie','bands':'Élastique','kettlebells':'Kettlebell',
 'e-z curl bar':'Barre','foam roll':'Accessoire','exercise ball':'Accessoire','medicine ball':'Accessoire','other':'Accessoire', None:'Poids du corps'}
LV = {'beginner':'Débutant','intermediate':'Intermédiaire','expert':'Avancé'}
CARDIO = {'Bicycling_Stationary','Recumbent_Bike','Elliptical_Trainer','Rowing_Stationary'}
PLYO = {'Front_Box_Jump','Split_Jump','Lateral_Bound','Fast_Skipping','Single-Leg_Hop_Progression','Standing_Long_Jump'}
EXISTING = {'Planche latérale','Curl barre EZ','Curl araignée','Mollets à la presse','Développé haltères assis'}   # déjà dans la bibliothèque de base
rows = []; seen = set()
for f in sorted(glob.glob(os.path.join(src, 'tr', '*.tsv'))):
    for l in open(f, encoding='utf8'):
        l = l.rstrip('\n')
        if not l.strip(): continue
        i, fr, ar, sfr, sar = l.split('|'); e = D[i]
        if fr in seen or fr in EXISTING: continue
        seen.add(fr)
        if i in CARDIO: kind = 'cardio'
        elif i in PLYO: kind = 'plyo'
        elif e['category'] == 'stretching':
            kind = 'mobilite' if ('SMR' in i or 'Circles' in i) else 'etirement'
        else: kind = 'force'
        prim = [MUS[m] for m in e['primaryMuscles']]
        sec = [MUS[m] for m in e['secondaryMuscles'] if m in MUS][:3]
        grp = GRP[e['primaryMuscles'][0]] if e['primaryMuscles'] else 'Corps entier'
        sen = [s.strip() for s in e['instructions']][:5]
        sfrl = [s.strip() for s in sfr.split(';;')]; sarl = [s.strip() for s in sar.split(';;')]
        rows.append([i, fr, grp, EQ[e['equipment']], LV.get(e['level'], 'Intermédiaire'), prim, sec, kind, i, 0, e['name'], ar, sfrl, sen, sarl, 0])
for i, r in R.items():
    img = r['img']
    rows.append([i, r['name']['fr'], 'Corps entier' if len(r['zones']) > 6 else GRP.get('quadriceps'), r['equip'], r['level'], r['primary'], [], 'rehab', img, r['zones'],
                 r['name']['en'], r['name']['ar'], r['steps']['fr'], r['steps']['en'], r['steps']['ar'], [r['phase'], r['sets'], r['reps']]])
# groupe d'un exercice de rééducation = 1er muscle (pour l'affichage)
M2G = {'Mollets':'Mollets','Quadriceps':'Quadriceps','Fessiers':'Fessiers','Ischios':'Ischios','Abdominaux':'Abdominaux','Lombaires':'Lombaires','Adducteurs':'Adducteurs','Abducteurs':'Abducteurs'}
for r in rows:
    if r[7] == 'rehab':
        p = (r[5] or ['Corps entier'])[0]; r[2] = M2G.get(p, 'Corps entier')
light = [r[:12] + [r[15]] for r in rows]          # id..nomAR, dose  (sans les étapes)
steps = {r[0]: [r[12], r[13], r[14]] for r in rows}
hdr = ['/* IKORUN — bibliothèque étendue (généré par tools/exdb-build.py).',
 '   Démonstrations : free-exercise-db (The Unlicense, domaine public). Traductions FR/AR et fiches de rééducation : originales IKORUN. */']
j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
base = os.path.splitext(out)[0]
open(out, 'w', encoding='utf8').write('\n'.join(hdr + [
 '// ligne = [id, nomFR, groupe, matériel, niveau, primaires, secondaires, type, imageDb, zonesRééduc, nomEN, nomAR, dose]',
 'const EXD_ROWS=' + j(light) + ';']) + '\n')
# V4.8 : consignes propres à chaque exercice de la base d'origine (cues_in.json : id → noms ; cues_out.tsv : id|consigneFR|pointsFR|consigneEN|pointsEN|consigneAR|pointsAR)
cues = {}
cin, cout = os.path.join(src, 'cues_in.json'), os.path.join(src, 'cues_out.tsv')
if os.path.exists(cin) and os.path.exists(cout):
    names = {x['id']: x['names'] for x in json.load(open(cin, encoding='utf8'))}
    for l in open(cout, encoding='utf8'):
        l = l.rstrip('\n')
        if not l.strip(): continue
        c = l.split('|')
        if len(c) != 7 or c[0] not in names: raise SystemExit('ligne de consignes invalide : ' + l[:60])
        v = [[c[1], [x.strip() for x in c[2].split(';;')]], [c[3], [x.strip() for x in c[4].split(';;')]], [c[5], [x.strip() for x in c[6].split(';;')]]]
        for nm in names[c[0]]: cues[nm] = v
open(base + '-steps.js', 'w', encoding='utf8').write('\n'.join(hdr + [
 '// chargé à la demande (ikLoad("exdb")) : tutos pas à pas FR/EN/AR + programmes de rééducation',
 'window.EXD_STEPS=' + j(steps) + ';',
 'window.EXD_REHAB=' + j({'zones': P, 'common': COMMON}) + ';',
 'window.EXD_CUES=' + j(cues) + ';']) + '\n')
print(len(rows), 'exercices ->', out, os.path.getsize(out), 'et', base + '-steps.js', os.path.getsize(base + '-steps.js'))
