# Exercices de rééducation rédigés pour IKORUN (originaux, pas de la base free-exercise-db).
# id: (img_db_id|None, zones, phase, dose(sets, reps), equip, level, primary muscles FR, nameFR, nameEN, nameAR, stepsFR, stepsEN, stepsAR)
R = {}
def add(i, img, zones, phase, sets, reps, equip, level, prim, fr, en, ar, sfr, sen, sar):
    R[i] = dict(img=img, zones=zones, phase=phase, sets=sets, reps=reps, equip=equip, level=level, primary=prim,
                name=dict(fr=fr, en=en, ar=ar), steps=dict(fr=sfr, en=sen, ar=sar))

add('rh_calf_iso', 'Standing_Calf_Raises', ['achilles','calf'], 1, 4, '30 s', 'Poids du corps', 'Débutant', ['Mollets'],
 'Mollets en isométrie (maintien sur pointes)', 'Isometric calf hold', 'ثبات السمانة (الوقوف على الأصابع)',
 ['Debout, mains sur un mur, monte sur la pointe des deux pieds à mi-hauteur.','Maintiens la position 30 à 45 s en respirant, sans rebond.','Redescends lentement. Soulage souvent la douleur du tendon. Pas de douleur au-delà de 3/10.'],
 ['Stand with hands on a wall and rise halfway onto the balls of both feet.','Hold 30 to 45 seconds while breathing, no bouncing.','Lower slowly. Often eases tendon pain. Keep pain at or below 3/10.'],
 ['قف واليدان على الحائط وارتفع إلى منتصف الطريق على مقدمة القدمين.','اثبت 30 إلى 45 ثانية مع التنفس دون نطّ.','انزل ببطء. يخفف غالباً ألم الوتر. لا يتجاوز الألم 3/10.'])
add('rh_heel_drop', 'Standing_Calf_Raises', ['achilles','calf'], 2, 3, '12-15 lent', 'Poids du corps', 'Débutant', ['Mollets'],
 'Descente excentrique du talon', 'Eccentric heel drop', 'خفض الكعب بطريقة لا مركزية',
 ['Debout sur le sol (ou le bord d\'une marche si tendon non insertionnel), monte sur les deux pointes.','Passe le poids sur la jambe à soigner et descends le talon en 3 s.','Remonte avec les deux jambes. 3 séries, 1 à 2 fois par jour. Douleur tolérée jusqu\'à 4/10, calmée sous 24 h.'],
 ['Stand on the floor (or a step edge if the tendon pain is not at the heel bone) and rise on both toes.','Shift your weight to the injured leg and lower the heel over 3 seconds.','Rise using both legs. 3 sets, 1 to 2 times a day. Pain up to 4/10 is acceptable if it settles within 24 hours.'],
 ['قف على الأرض (أو حافة درجة إن لم يكن الألم عند عظم الكعب) وارتفع على الأصابع.','انقل الوزن إلى الساق المصابة وأنزل الكعب خلال 3 ثوانٍ.','اصعد بالساقين معاً. 3 مجموعات مرة إلى مرتين يومياً. الألم حتى 4/10 مقبول إن هدأ خلال 24 ساعة.'])
add('rh_soleus_raise', 'Seated_Calf_Raise', ['calf','achilles'], 2, 3, '15', 'Poids du corps', 'Débutant', ['Mollets'],
 'Mollets genoux fléchis (soléaire)', 'Bent-knee calf raise (soleus)', 'رفع السمانة بركبتين مثنيتين',
 ['Debout, mains sur un mur, fléchis légèrement les genoux et garde-les fléchis.','Monte sur la pointe des pieds en poussant sur le gros orteil.','Redescends en 3 s. 3 séries de 15, ajoute un sac à dos pour progresser.'],
 ['Stand with hands on a wall, bend your knees slightly and keep them bent.','Rise onto your toes, pushing through the big toe.','Lower over 3 seconds. 3 sets of 15; add a backpack to progress.'],
 ['قف واليدان على الحائط وثنِ الركبتين قليلاً وأبقهما مثنيتين.','ارتفع على أصابع القدمين بالدفع عبر الإبهام.','انزل خلال 3 ثوانٍ. 3 مجموعات من 15، أضف حقيبة ظهر للتدرج.'])
add('rh_tib_raise', None, ['shin'], 2, 3, '15', 'Poids du corps', 'Débutant', ['Tibial antérieur'],
 'Relevé de pointes de pieds (tibial)', 'Toe raises (tibialis)', 'رفع أصابع القدمين (الظنبوبية)',
 ['Dos contre un mur, talons à 30 cm du mur, jambes tendues.','Lève les pointes de pieds vers les tibias, talons au sol.','Redescends lentement. 3 séries de 15. Une sensation de brûlure musculaire est normale.'],
 ['Lean back against a wall with heels about 30 cm from it, legs straight.','Lift the toes toward your shins, heels staying down.','Lower slowly. 3 sets of 15. A muscular burning feeling is normal.'],
 ['استند بظهرك إلى الحائط والكعبان على بعد 30 سم والساقان ممدودتان.','ارفع أصابع القدمين نحو الساقين والكعبان على الأرض.','انزل ببطء. 3 مجموعات من 15. الإحساس بحرقة عضلية طبيعي.'])
add('rh_short_foot', None, ['foot','ankle'], 1, 3, '10 x 5 s', 'Poids du corps', 'Débutant', ['Pied'],
 'Voûte plantaire (« short foot »)', 'Short foot exercise', 'تمرين قوس القدم',
 ['Assis, pied à plat. Sans plier les orteils, rapproche l\'avant du pied du talon pour « creuser » la voûte.','Maintiens 5 s en gardant orteils et talon au sol.','Relâche. 10 répétitions par pied, puis fais-le debout.'],
 ['Sit with your foot flat. Without curling your toes, draw the ball of the foot toward the heel to "dome" the arch.','Hold 5 seconds keeping toes and heel on the floor.','Release. 10 repetitions per foot, then try it standing.'],
 ['اجلس والقدم مسطحة. دون ثني الأصابع قرّب مقدمة القدم من الكعب لتقوّس القوس.','اثبت 5 ثوانٍ مع بقاء الأصابع والكعب على الأرض.','أرخِ. 10 تكرارات لكل قدم ثم جرّبه واقفاً.'])
add('rh_towel_scrunch', None, ['foot'], 1, 3, '15', 'Poids du corps', 'Débutant', ['Pied'],
 'Froissement de serviette avec les orteils', 'Towel scrunch', 'تجميع المنشفة بالأصابع',
 ['Assis, pied à plat sur une serviette posée au sol.','Plie les orteils pour rapprocher la serviette vers toi.','Défroisse puis recommence. 3 séries de 15 par pied.'],
 ['Sit with your foot flat on a towel on the floor.','Curl your toes to pull the towel toward you.','Smooth it out and repeat. 3 sets of 15 per foot.'],
 ['اجلس والقدم مسطحة على منشفة على الأرض.','اثن الأصابع لسحب المنشفة نحوك.','افردها وكرّر. 3 مجموعات من 15 لكل قدم.'])
add('rh_plantar_raise', 'Standing_Calf_Raises', ['foot'], 2, 3, '12 lent', 'Poids du corps', 'Débutant', ['Mollets','Pied'],
 'Montée sur pointes, orteils relevés (fascia plantaire)', 'Heel raise with toes extended (plantar fascia)', 'رفع الكعب مع أصابع مرفوعة (اللفافة الأخمصية)',
 ['Debout, orteils posés sur une serviette roulée contre le mur, talons au sol.','Monte les talons en 3 s, tiens 2 s en haut.','Redescends en 3 s. 3 séries de 12, un jour sur deux. Douleur tolérée ≤ 4/10.'],
 ['Stand with toes resting on a rolled towel against a wall, heels on the floor.','Raise the heels over 3 seconds and hold 2 seconds at the top.','Lower over 3 seconds. 3 sets of 12, every other day. Pain ≤ 4/10 is acceptable.'],
 ['قف وأصابع القدمين على منشفة ملفوفة عند الحائط والكعبان على الأرض.','ارفع الكعبين خلال 3 ثوانٍ وثبّت ثانيتين في الأعلى.','انزل خلال 3 ثوانٍ. 3 مجموعات من 12 يوماً بعد يوم. الألم ≤ 4/10 مقبول.'])
add('rh_clamshell', None, ['hip','knee'], 1, 3, '15', 'Poids du corps', 'Débutant', ['Fessiers'],
 'Coquille (clamshell)', 'Clamshell', 'المحارة',
 ['Allongé sur le côté, genoux fléchis à 90°, pieds joints, bassin stable.','Ouvre le genou du dessus sans faire basculer le bassin.','Redescends lentement. 3 séries de 15 par côté. Ajoute un élastique pour progresser.'],
 ['Lie on your side, knees bent to 90°, feet together, pelvis steady.','Open the top knee without rolling the pelvis back.','Lower slowly. 3 sets of 15 per side. Add a band to progress.'],
 ['استلقِ على جنبك والركبتان مثنيتان 90° والقدمان متلاصقتان والحوض ثابت.','افتح الركبة العليا دون أن يميل الحوض للخلف.','انزل ببطء. 3 مجموعات من 15 لكل جهة. أضف شريطاً للتدرج.'])
add('rh_side_leg_raise', 'Side_Leg_Raises', ['hip'], 1, 3, '12', 'Poids du corps', 'Débutant', ['Fessiers','Abducteurs'],
 'Abduction latérale allongé', 'Side-lying hip abduction', 'رفع الساق جانباً مستلقياً',
 ['Allongé sur le côté, jambe du bas fléchie, jambe du dessus tendue dans l\'axe du corps.','Lève la jambe du dessus de 30 à 40 cm, orteils vers l\'avant.','Redescends lentement. 3 séries de 12 par côté.'],
 ['Lie on your side, bottom leg bent, top leg straight in line with the body.','Lift the top leg 30 to 40 cm with toes pointing forward.','Lower slowly. 3 sets of 12 per side.'],
 ['استلقِ على جنبك والساق السفلى مثنية والعليا ممدودة بمحاذاة الجسم.','ارفع الساق العليا 30 إلى 40 سم والأصابع للأمام.','انزل ببطء. 3 مجموعات من 12 لكل جهة.'])
add('rh_adductor_squeeze', None, ['hip'], 1, 3, '10 x 5 s', 'Poids du corps', 'Débutant', ['Adducteurs'],
 'Serrage d\'un ballon entre les genoux', 'Adductor squeeze', 'ضغط الكرة بين الركبتين',
 ['Allongé sur le dos, genoux fléchis, un ballon ou un coussin entre les genoux.','Serre doucement le ballon pendant 5 s, sans douleur à l\'aine.','Relâche. 10 répétitions, 2 à 3 séries.'],
 ['Lie on your back, knees bent, a ball or cushion between the knees.','Squeeze gently for 5 seconds with no groin pain.','Release. 10 repetitions, 2 to 3 sets.'],
 ['استلقِ على ظهرك والركبتان مثنيتان وكرة أو وسادة بينهما.','اضغط برفق 5 ثوانٍ دون ألم في الأربية.','أرخِ. 10 تكرارات و2 إلى 3 مجموعات.'])
add('rh_quad_iso', None, ['knee','thighF'], 1, 4, '10 x 10 s', 'Poids du corps', 'Débutant', ['Quadriceps'],
 'Quadriceps en isométrie (genou sur serviette)', 'Quad set (towel under knee)', 'شد الرباعية بالثبات (منشفة تحت الركبة)',
 ['Assis jambe tendue, serviette roulée sous le genou.','Écrase la serviette en contractant le quadriceps, orteils vers toi.','Maintiens 10 s, relâche. 10 répétitions, 2 à 4 séries par jour.'],
 ['Sit with the leg straight and a rolled towel under the knee.','Press the knee into the towel by tightening the quadriceps, toes toward you.','Hold 10 seconds, release. 10 repetitions, 2 to 4 sets a day.'],
 ['اجلس والساق ممدودة ومنشفة ملفوفة تحت الركبة.','اضغط المنشفة بشدّ الرباعية والأصابع نحوك.','اثبت 10 ثوانٍ وأرخِ. 10 تكرارات و2 إلى 4 مجموعات يومياً.'])
add('rh_tke', None, ['knee','thighF'], 2, 3, '15', 'Élastique', 'Débutant', ['Quadriceps'],
 'Extension terminale du genou à l\'élastique', 'Terminal knee extension (band)', 'بسط الركبة الأخير بالشريط',
 ['Élastique fixé derrière le genou, debout, genou légèrement fléchi.','Tends le genou complètement en contractant le quadriceps.','Reviens lentement. 3 séries de 15 par jambe.'],
 ['Band anchored behind the knee, standing with the knee slightly bent.','Straighten the knee fully by tightening the quadriceps.','Return slowly. 3 sets of 15 per leg.'],
 ['شريط مثبت خلف الركبة وأنت واقف والركبة مثنية قليلاً.','مدّ الركبة كاملاً بشدّ الرباعية.','ارجع ببطء. 3 مجموعات من 15 لكل ساق.'])
add('rh_spanish_squat', 'Leg_Press', ['knee','thighF'], 2, 4, '30 s', 'Élastique', 'Débutant', ['Quadriceps'],
 'Squat espagnol isométrique', 'Spanish squat (isometric)', 'القرفصاء الإسبانية بالثبات',
 ['Élastique solide fixé derrière les genoux, tibias verticaux, buste droit.','Descends à environ 60° de flexion en laissant l\'élastique porter le poids vers l\'arrière.','Tiens 30 à 45 s. 4 séries. Très efficace contre la douleur du tendon rotulien.'],
 ['Strong band anchored behind the knees, shins vertical, torso upright.','Lower to about 60° of knee bend, letting the band take your weight backward.','Hold 30 to 45 seconds. 4 sets. Very effective for patellar tendon pain.'],
 ['شريط قوي مثبت خلف الركبتين والساقان عموديتان والجذع مستقيم.','انزل إلى نحو 60° من ثني الركبة مع تحمّل الشريط للوزن للخلف.','اثبت 30 إلى 45 ثانية. 4 مجموعات. فعّال جداً لألم وتر الرضفة.'])
add('rh_step_down', None, ['knee','hip'], 2, 3, '10 lent', 'Poids du corps', 'Débutant', ['Quadriceps','Fessiers'],
 'Descente de marche contrôlée', 'Controlled step-down', 'النزول المتحكَّم من الدرجة',
 ['Debout sur une marche, une jambe sur le bord, l\'autre dans le vide.','Fléchis lentement la jambe d\'appui en gardant le genou aligné sur le pied, talon libre touche le sol.','Remonte sans élan. 3 séries de 10 par jambe, marche basse puis plus haute.'],
 ['Stand on a step with one leg at the edge and the other hanging.','Slowly bend the standing leg, keeping the knee over the foot, until the free heel touches the floor.','Rise without momentum. 3 sets of 10 per leg, low step first then higher.'],
 ['قف على درجة وساق عند الحافة والأخرى معلقة.','ثنِ ساق الارتكاز ببطء مع محاذاة الركبة للقدم حتى يلامس الكعب الحر الأرض.','اصعد دون زخم. 3 مجموعات من 10 لكل ساق بدرجة منخفضة ثم أعلى.'])
add('rh_ham_iso_bridge', 'Butt_Lift_Bridge', ['thighB'], 1, 4, '30 s', 'Poids du corps', 'Débutant', ['Ischios','Fessiers'],
 'Pont isométrique (ischios)', 'Isometric hamstring bridge', 'جسر بالثبات (الفخذ الخلفي)',
 ['Allongé sur le dos, talons posés au sol genoux fléchis à ~60°.','Monte le bassin en poussant dans les talons et maintiens.','Tiens 30 s sans douleur vive, 4 séries.'],
 ['Lie on your back with heels on the floor and knees bent to about 60°.','Lift the hips by pressing through the heels and hold.','Hold 30 seconds without sharp pain, 4 sets.'],
 ['استلقِ على ظهرك والكعبان على الأرض والركبتان بزاوية نحو 60°.','ارفع الحوض بالدفع عبر الكعبين وثبّت.','اثبت 30 ثانية دون ألم حاد، 4 مجموعات.'])
add('rh_ham_slide', 'Lying_Leg_Curls', ['thighB'], 2, 3, '8', 'Poids du corps', 'Intermédiaire', ['Ischios'],
 'Curl ischios en glissant', 'Hamstring slider curl', 'ثني الفخذ الخلفي بالانزلاق',
 ['Allongé, talons sur une serviette ou des chaussettes sur sol lisse, bassin monté.','Fais glisser les talons loin de toi en gardant le bassin haut.','Ramène les talons lentement. 3 séries de 8, lentement.'],
 ['Lie with heels on a towel or socks on a smooth floor, hips lifted.','Slide the heels away while keeping the hips high.','Pull the heels back slowly. 3 sets of 8, slowly.'],
 ['استلقِ والكعبان على منشفة أو جوارب على أرض ملساء والحوض مرفوع.','اسحب الكعبين بعيداً مع إبقاء الحوض مرتفعاً.','أعد الكعبين ببطء. 3 مجموعات من 8 ببطء.'])
add('rh_balance', None, ['ankle','knee','foot'], 1, 3, '30-45 s', 'Poids du corps', 'Débutant', ['Cheville'],
 'Équilibre sur une jambe', 'Single-leg balance', 'التوازن على ساق واحدة',
 ['Debout sur une jambe près d\'un appui, genou légèrement fléchi.','Garde le bassin de niveau et la voûte plantaire active pendant 30 à 45 s.','Progresse : yeux fermés, puis sur un coussin. 3 essais par jambe.'],
 ['Stand on one leg near a support, knee slightly bent.','Keep the pelvis level and the arch active for 30 to 45 seconds.','Progress: eyes closed, then on a cushion. 3 trials per leg.'],
 ['قف على ساق واحدة قرب دعامة والركبة مثنية قليلاً.','أبقِ الحوض مستوياً وقوس القدم نشطاً 30 إلى 45 ثانية.','تدرّج: عينان مغمضتان ثم على وسادة. 3 محاولات لكل ساق.'])
add('rh_band_eversion', None, ['ankle','shin'], 2, 3, '15', 'Élastique', 'Débutant', ['Péroniers'],
 'Éversion de cheville à l\'élastique', 'Ankle eversion (band)', 'إبعاد الكاحل للخارج بالشريط',
 ['Assis, jambe tendue, élastique autour de l\'avant du pied fixé à l\'intérieur.','Tourne le pied vers l\'extérieur sans bouger la jambe.','Reviens lentement. 3 séries de 15 par pied.'],
 ['Sit with the leg straight, band around the forefoot anchored on the inside.','Turn the foot outward without moving the leg.','Return slowly. 3 sets of 15 per foot.'],
 ['اجلس والساق ممدودة والشريط حول مقدمة القدم مثبت من الداخل.','أدر القدم للخارج دون تحريك الساق.','ارجع ببطء. 3 مجموعات من 15 لكل قدم.'])
add('rh_ankle_alphabet', 'Ankle_Circles', ['ankle'], 1, 2, '1 alphabet', 'Poids du corps', 'Débutant', ['Cheville'],
 'Alphabet avec le pied', 'Ankle alphabet', 'كتابة الأبجدية بالقدم',
 ['Assis, jambe tendue, pied dans le vide.','Écris les lettres de l\'alphabet avec le gros orteil, mouvement venant de la cheville.','Fais-le 2 à 3 fois par jour, sans douleur vive. Idéal les premiers jours après une entorse.'],
 ['Sit with the leg straight, foot off the floor.','Trace the alphabet with the big toe, moving from the ankle.','Do it 2 to 3 times a day without sharp pain. Ideal in the first days after a sprain.'],
 ['اجلس والساق ممدودة والقدم في الهواء.','اكتب حروف الأبجدية بالإبهام والحركة من الكاحل.','كرّره 2 إلى 3 مرات يومياً دون ألم حاد. مثالي في الأيام الأولى بعد الالتواء.'])
add('rh_heel_walk', None, ['shin','ankle'], 2, 3, '20 m', 'Poids du corps', 'Débutant', ['Tibial antérieur'],
 'Marche sur les talons', 'Heel walk', 'المشي على الكعبين',
 ['Debout, relève les pointes de pieds et marche sur les talons.','Garde le buste droit et de petits pas contrôlés.','20 m, 3 allers. Renforce le tibial antérieur.'],
 ['Stand, lift the toes and walk on your heels.','Keep the torso upright with small controlled steps.','20 m, 3 passes. Strengthens the tibialis anterior.'],
 ['قف وارفع أصابع القدمين وامشِ على الكعبين.','أبقِ الجذع مستقيماً بخطوات صغيرة متحكَّمة.','20 متراً و3 ذهابات. يقوّي الظنبوبية الأمامية.'])
add('rh_bird_dog', None, ['lowBack'], 1, 3, '8 x 5 s', 'Poids du corps', 'Débutant', ['Lombaires','Abdominaux'],
 'Bird dog (chien-oiseau)', 'Bird dog', 'الكلب والطائر',
 ['À quatre pattes, dos neutre, mains sous les épaules.','Tends un bras et la jambe opposée sans bouger le bassin ni creuser le dos.','Tiens 5 s, reviens et change de côté. 3 séries de 8.'],
 ['On all fours, spine neutral, hands under the shoulders.','Extend one arm and the opposite leg without rotating the pelvis or arching the back.','Hold 5 seconds, return and switch. 3 sets of 8.'],
 ['على أربع بظهر محايد واليدان تحت الكتفين.','مدّ ذراعاً والساق المعاكسة دون تدوير الحوض أو تقعير الظهر.','اثبت 5 ثوانٍ وارجع وبدّل. 3 مجموعات من 8.'])
add('rh_curl_up', None, ['lowBack'], 1, 3, '8 x 8 s', 'Poids du corps', 'Débutant', ['Abdominaux'],
 'Curl-up de McGill', 'McGill curl-up', 'شد البطن بأسلوب ماكغيل',
 ['Allongé, une jambe fléchie, l\'autre tendue, mains sous le creux des lombaires.','Soulève légèrement la tête et les épaules en gardant le dos immobile.','Tiens 8 s, redescends. 3 séries de 8, en changeant la jambe fléchie.'],
 ['Lie with one leg bent and one straight, hands under the small of the back.','Lift the head and shoulders slightly while keeping the back still.','Hold 8 seconds, lower. 3 sets of 8, switching the bent leg.'],
 ['استلقِ وساق مثنية والأخرى ممدودة واليدان تحت تقعير أسفل الظهر.','ارفع الرأس والكتفين قليلاً مع ثبات الظهر.','اثبت 8 ثوانٍ وانزل. 3 مجموعات من 8 مع تبديل الساق المثنية.'])
add('rh_hip_hinge', None, ['lowBack','thighB'], 1, 3, '10', 'Poids du corps', 'Débutant', ['Fessiers','Ischios'],
 'Charnière de hanche au mur', 'Wall hip hinge', 'ثني الورك عند الحائط',
 ['Dos à 15 cm d\'un mur, pieds largeur de hanches, genoux souples.','Recule le bassin pour toucher le mur en gardant le dos plat.','Reviens en poussant les hanches vers l\'avant. 3 séries de 10.'],
 ['Stand 15 cm from a wall facing away, feet hip-width, knees soft.','Push the hips back to touch the wall keeping the back flat.','Return by driving the hips forward. 3 sets of 10.'],
 ['قف على بعد 15 سم من الحائط وظهرك له والقدمان بعرض الوركين والركبتان مرنتان.','ادفع الحوض للخلف ليلامس الحائط مع ظهر مستوٍ.','ارجع بدفع الوركين للأمام. 3 مجموعات من 10.'])
add('rh_side_plank_knees', None, ['lowBack','hip'], 1, 3, '20 s', 'Poids du corps', 'Débutant', ['Abdominaux','Fessiers'],
 'Planche latérale genoux fléchis', 'Side plank (knees bent)', 'لوح جانبي بركبتين مثنيتين',
 ['Sur le côté, genoux fléchis, avant-bras au sol sous l\'épaule.','Soulève le bassin pour aligner épaule, hanche et genou.','Tiens 20 s sans t\'affaisser, 3 fois par côté.'],
 ['On your side, knees bent, forearm on the floor under the shoulder.','Lift the hips to line up shoulder, hip and knee.','Hold 20 seconds without sagging, 3 times per side.'],
 ['على جنبك والركبتان مثنيتان والساعد على الأرض تحت الكتف.','ارفع الحوض ليصطف الكتف والورك والركبة.','اثبت 20 ثانية دون هبوط، 3 مرات لكل جهة.'])
add('rh_single_rdl', 'Romanian_Deadlift', ['thighB','hip','ankle'], 3, 3, '8', 'Poids du corps', 'Intermédiaire', ['Ischios','Fessiers'],
 'Soulevé de terre unijambiste', 'Single-leg Romanian deadlift', 'رفعة ميتة بساق واحدة',
 ['Debout sur une jambe, genou légèrement fléchi, mains devant toi.','Penche le buste en envoyant l\'autre jambe vers l\'arrière, dos plat.','Reviens en contractant le fessier. 3 séries de 8 par jambe, sans charge d\'abord.'],
 ['Stand on one leg with a slightly bent knee, hands in front.','Hinge forward sending the other leg back, back flat.','Return by squeezing the glute. 3 sets of 8 per leg, bodyweight first.'],
 ['قف على ساق واحدة والركبة مثنية قليلاً واليدان أمامك.','أمِل الجذع للأمام مع إرسال الساق الأخرى للخلف والظهر مستوٍ.','ارجع بشدّ الأرداف. 3 مجموعات من 8 لكل ساق بوزن الجسم أولاً.'])
add('rh_march_run', 'Trail_Running_Walking', ['knee','hip','shin','foot','ankle','achilles','calf','thighB','thighF'], 3, 3, '20 m', 'Poids du corps', 'Débutant', ['Quadriceps'],
 'Marche-course : 1 min de course / 2 min de marche', 'Walk-run: 1 min run / 2 min walk', 'مشي-جري: دقيقة جري / دقيقتا مشي',
 ['Sur terrain plat et souple, marche 5 min pour t\'échauffer.','Alterne 1 min de petite foulée facile et 2 min de marche, 6 à 8 fois.','Si la douleur reste ≤ 2/10 et disparaît dans les 24 h, passe à 2 min de course / 1 min de marche la fois suivante.'],
 ['On flat, soft ground, walk 5 minutes to warm up.','Alternate 1 minute of easy short strides and 2 minutes of walking, 6 to 8 times.','If pain stays ≤ 2/10 and settles within 24 hours, move to 2 minutes run / 1 minute walk next time.'],
 ['على أرض مستوية ولينة امشِ 5 دقائق للإحماء.','بدّل دقيقة جري بخطوات صغيرة سهلة مع دقيقتي مشي، 6 إلى 8 مرات.','إن بقي الألم ≤ 2/10 وزال خلال 24 ساعة فانتقل إلى دقيقتي جري / دقيقة مشي في المرة التالية.'])
