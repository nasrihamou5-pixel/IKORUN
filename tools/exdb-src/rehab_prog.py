# Programmes de rééducation par zone (trilingues). Les ids renvoient à rehab_ex.py ou à free-exercise-db (tr/*.tsv).
P = {}
def z(zid, ph, what, advice, avoid, cross):
    P[zid] = dict(phases=ph, what=what, advice=advice, avoid=avoid, cross=cross)

z('hip', [['rh_clamshell','rh_adductor_squeeze','Lying_Glute'],['rh_side_leg_raise','rh_step_down','Kneeling_Hip_Flexor'],['rh_single_rdl','rh_march_run']],
 dict(fr="Douleur de hanche ou d'aine : souvent surcharge des muscles stabilisateurs (fessiers, adducteurs, fléchisseurs).", en="Hip or groin pain: usually overload of the stabilising muscles (glutes, adductors, hip flexors).", ar="ألم الورك أو الأربية: غالباً إجهاد للعضلات المثبّتة (الأرداف، المقرّبات، ثانيات الورك)."),
 dict(fr=["Renforce les fessiers 3 fois par semaine : ils déchargent la hanche.","Évite de rester assis longtemps sans bouger.","Reprends la course en alternant marche et course."], en=["Strengthen the glutes 3 times a week: they offload the hip.","Avoid sitting for long periods without moving.","Return to running by alternating walking and running."], ar=["قوِّ الأرداف 3 مرات أسبوعياً فهي تخفف الحمل عن الورك.","تجنب الجلوس طويلاً دون حركة.","عد إلى الجري بالتناوب بين المشي والجري."]),
 dict(fr=["Les côtes, descentes et fentes profondes tant que la douleur dépasse 3/10.","Les étirements forcés de l'aine."], en=["Hills, downhills and deep lunges while pain is above 3/10.","Forced groin stretching."], ar=["المرتفعات والمنحدرات والاندفاع العميق ما دام الألم فوق 3/10.","التمدد القسري للأربية."]),
 dict(fr="Vélo, natation (sans brasse), elliptique", en="Cycling, swimming (no breaststroke), elliptical", ar="الدراجة، السباحة (دون سباحة الضفدع)، الإهليلجي"))

z('thighF', [['rh_quad_iso','Quad_Stretch'],['rh_tke','rh_spanish_squat','Kneeling_Hip_Flexor'],['rh_step_down','rh_march_run']],
 dict(fr="Douleur à l'avant de la cuisse : surcharge du quadriceps ou des fléchisseurs de hanche.", en="Pain at the front of the thigh: quadriceps or hip flexor overload.", ar="ألم أمام الفخذ: إجهاد للعضلة الرباعية أو ثانيات الورك."),
 dict(fr=["Renforce le quadriceps en isométrie puis en excentrique lent.","Fais un échauffement progressif avant chaque séance.","Masse doucement, sans appuyer sur la zone douloureuse."], en=["Strengthen the quadriceps isometrically, then with slow eccentrics.","Warm up progressively before each session.","Massage gently, never press on the sore spot."], ar=["قوِّ الرباعية بالانقباض الثابت ثم بالحركة البطيئة.","سخّن تدريجياً قبل كل حصة.","دلّك بلطف دون الضغط على موضع الألم."]),
 dict(fr=["Les descentes et la vitesse tant que la douleur persiste.","Les étirements violents sur un muscle douloureux."], en=["Downhills and speed work while pain lasts.","Aggressive stretching on a sore muscle."], ar=["المنحدرات والسرعة ما دام الألم موجوداً.","التمدد العنيف على عضلة متألمة."]),
 dict(fr="Vélo léger, natation, aquajogging", en="Easy cycling, swimming, aqua-jogging", ar="دراجة خفيفة، سباحة، جري في الماء"))

z('knee', [['rh_quad_iso','rh_clamshell','rh_balance'],['rh_tke','rh_spanish_squat','rh_step_down'],['rh_march_run','Iliotibial_Tract-SMR']],
 dict(fr="Douleur au genou : syndrome fémoro-patellaire ou bandelette ilio-tibiale le plus souvent chez le coureur.", en="Knee pain: in runners most often patellofemoral pain or iliotibial band syndrome.", ar="ألم الركبة: عند العدّائين غالباً متلازمة الرضفة أو الشريط الحرقفي الظنبوبي."),
 dict(fr=["Renforce quadriceps et fessiers : c'est le traitement de référence.","Raccourcis la foulée et augmente la cadence de 5 %.","Privilégie les terrains plats et souples."], en=["Strengthen quads and glutes: this is the reference treatment.","Shorten your stride and raise cadence by 5%.","Prefer flat, soft surfaces."], ar=["قوِّ الرباعية والأرداف فهذا هو العلاج المرجعي.","اقصّر الخطوة وارفع الوتيرة 5٪.","فضّل الأرض المسطحة واللينة."]),
 dict(fr=["Les descentes, escaliers et squats profonds tant que ça fait mal.","Courir en boitant : tu aggraverais la compensation."], en=["Downhills, stairs and deep squats while it hurts.","Running with a limp: it worsens compensation."], ar=["المنحدرات والدرج والقرفصاء العميق ما دام مؤلماً.","الجري مع العرج فهو يزيد التعويض."]),
 dict(fr="Vélo (selle haute), natation, elliptique", en="Cycling (high saddle), swimming, elliptical", ar="دراجة (مقعد مرتفع)، سباحة، إهليلجي"))

z('shin', [['rh_tib_raise','Anterior_Tibialis-SMR'],['rh_heel_walk','rh_band_eversion','rh_soleus_raise'],['rh_march_run','Calves-SMR']],
 dict(fr="Douleur au tibia : périostite tibiale, très fréquente quand on augmente trop vite le volume.", en="Shin pain: medial tibial stress syndrome, common after raising volume too quickly.", ar="ألم الساق الأمامية: التهاب السمحاق، شائع عند زيادة الحجم بسرعة."),
 dict(fr=["Réduis le volume de 30 à 50 % et supprime les côtes.","Change de chaussures si elles ont plus de 700 km.","Reprends sur terrain souple, par petites étapes."], en=["Cut volume by 30 to 50% and drop hills.","Replace shoes older than 700 km.","Return on soft ground in small steps."], ar=["اخفض الحجم 30 إلى 50٪ وأوقف المرتفعات.","بدّل الحذاء إذا تجاوز 700 كم.","عد على أرض لينة بخطوات صغيرة."]),
 dict(fr=["La vitesse, le bitume et les sauts tant que la zone est sensible.","Courir à travers la douleur."], en=["Speed, tarmac and jumping while the area is tender.","Running through the pain."], ar=["السرعة والأسفلت والقفز ما دامت المنطقة حساسة.","الجري رغم الألم."]),
 dict(fr="Vélo, natation, aquajogging", en="Cycling, swimming, aqua-jogging", ar="دراجة، سباحة، جري في الماء"))

z('ankle', [['rh_ankle_alphabet','rh_short_foot','rh_balance'],['rh_band_eversion','rh_soleus_raise','Peroneals_Stretch'],['rh_single_rdl','rh_march_run']],
 dict(fr="Douleur à la cheville : entorse ancienne ou tendons péroniers fatigués.", en="Ankle pain: an old sprain or tired peroneal tendons.", ar="ألم الكاحل: التواء قديم أو إجهاد أوتار الشظية."),
 dict(fr=["Retrouve d'abord la mobilité puis l'équilibre sur une jambe.","Travaille pieds nus à la maison pour réveiller les petits muscles.","Évite les sols irréguliers au début."], en=["Restore mobility first, then single-leg balance.","Train barefoot at home to wake the small muscles.","Avoid uneven ground at first."], ar=["استعد الحركة أولاً ثم التوازن على ساق واحدة.","تمرّن حافي القدمين في المنزل لإيقاظ العضلات الصغيرة.","تجنب الأرض غير المستوية في البداية."]),
 dict(fr=["Les sentiers techniques et les appuis latéraux brusques.","Un bandage permanent : il affaiblit la cheville."], en=["Technical trails and sharp side-steps.","A permanent brace: it weakens the ankle."], ar=["المسارات الوعرة والحركات الجانبية المفاجئة.","الرباط الدائم فهو يضعف الكاحل."]),
 dict(fr="Vélo, natation", en="Cycling, swimming", ar="دراجة، سباحة"))

z('foot', [['rh_towel_scrunch','rh_short_foot','Foot-SMR'],['rh_plantar_raise','rh_balance','Calf_Stretch_Hands_Against_Wall'],['rh_march_run']],
 dict(fr="Douleur au pied : fasciite plantaire ou fatigue de la voûte, surtout au premier pas le matin.", en="Foot pain: plantar fasciitis or arch fatigue, worst with the first steps in the morning.", ar="ألم القدم: التهاب اللفافة الأخمصية أو إجهاد قوس القدم، خاصة عند أول خطوات الصباح."),
 dict(fr=["Roule la voûte sur une balle 2 minutes par jour.","Étire les mollets : ils tirent sur la plante.","Évite de marcher pieds nus sur sol dur."], en=["Roll the arch over a ball 2 minutes a day.","Stretch the calves: they pull on the sole.","Avoid walking barefoot on hard floors."], ar=["دحرج القوس على كرة دقيقتين يومياً.","مدّد السمانة فهي تشدّ باطن القدم.","تجنب المشي حافياً على أرض صلبة."]),
 dict(fr=["Les chaussures trop plates ou usées.","La vitesse et les sprints tant que la plante est douloureuse."], en=["Flat or worn-out shoes.","Speed and sprints while the sole is sore."], ar=["الأحذية المسطحة أو البالية.","السرعة والعدو ما دام باطن القدم مؤلماً."]),
 dict(fr="Vélo, natation, aquajogging", en="Cycling, swimming, aqua-jogging", ar="دراجة، سباحة، جري في الماء"))

z('lowBack', [['rh_bird_dog','rh_curl_up','Cat_Stretch'],['rh_side_plank_knees','rh_hip_hinge','Childs_Pose'],['rh_single_rdl','rh_march_run']],
 dict(fr="Douleur lombaire : le plus souvent une fatigue musculaire du tronc, sans gravité si elle reste locale.", en="Low back pain: usually trunk muscle fatigue, harmless when it stays local.", ar="ألم أسفل الظهر: غالباً إجهاد عضلات الجذع، وهو غير خطير إن بقي موضعياً."),
 dict(fr=["Reste actif : marcher aide plus que le repos complet.","Renforce le tronc (gainage doux) chaque jour.","Bouge toutes les 45 minutes si tu es assis."], en=["Stay active: walking helps more than complete rest.","Strengthen the trunk (gentle bracing) daily.","Move every 45 minutes if you sit a lot."], ar=["ابقَ نشيطاً فالمشي أفضل من الراحة التامة.","قوِّ الجذع بتمارين ثبات لطيفة يومياً.","تحرّك كل 45 دقيقة إن كنت تجلس كثيراً."]),
 dict(fr=["Les charges lourdes (soulevé de terre, squat) tant que ça tire.","Flexions complètes du buste avec les jambes tendues."], en=["Heavy loads (deadlift, squat) while it pulls.","Full trunk bends with straight legs."], ar=["الأحمال الثقيلة (الرفعة الميتة، القرفصاء) ما دام الشدّ موجوداً.","ثني الجذع الكامل بساقين مستقيمتين."]),
 dict(fr="Marche, natation sur le dos, vélo droit", en="Walking, backstroke, upright cycling", ar="المشي، السباحة على الظهر، دراجة بوضعية منتصبة"))

z('thighB', [['rh_ham_iso_bridge','Hamstring-SMR'],['rh_ham_slide','rh_hip_hinge','Lying_Hamstring'],['rh_single_rdl','rh_march_run']],
 dict(fr="Douleur à l'arrière de la cuisse : ischio-jambiers, souvent à la reprise de la vitesse.", en="Pain at the back of the thigh: hamstrings, often when speed work resumes.", ar="ألم خلف الفخذ: أوتار الركبة، غالباً عند العودة للسرعة."),
 dict(fr=["Isométrie d'abord, puis charge progressive en excentrique.","Reprends la vitesse en dernier, après 2 semaines sans douleur.","Échauffe-toi longtemps avant les fractionnés."], en=["Isometrics first, then progressive eccentric load.","Add speed last, after 2 pain-free weeks.","Warm up for longer before intervals."], ar=["الانقباض الثابت أولاً ثم حمل تدريجي بالحركة السلبية.","أضف السرعة في النهاية بعد أسبوعين بلا ألم.","سخّن مدة أطول قبل التقطيع."]),
 dict(fr=["Les sprints et les fractionnés tant qu'une gêne subsiste.","Les étirements forcés : le muscle est déjà tendu."], en=["Sprints and intervals while any discomfort remains.","Forced stretching: the muscle is already tight."], ar=["العدو والتقطيع ما دام أي انزعاج قائماً.","التمدد القسري فالعضلة مشدودة أصلاً."]),
 dict(fr="Vélo, natation, aquajogging", en="Cycling, swimming, aqua-jogging", ar="دراجة، سباحة، جري في الماء"))

z('calf', [['rh_calf_iso','Calves-SMR'],['rh_soleus_raise','rh_heel_drop','Standing_Soleus_And_Achilles_Stretch'],['rh_single_rdl','rh_march_run']],
 dict(fr="Douleur au mollet : fatigue ou petite lésion du gastrocnémien ou du soléaire.", en="Calf pain: fatigue or a minor strain of the gastrocnemius or soleus.", ar="ألم السمانة: إجهاد أو تمزق صغير في التوأم أو النعلية."),
 dict(fr=["Hydrate-toi et vérifie ton apport en magnésium.","Reprends par la marche rapide avant la course.","Monte progressivement la charge sur les pointes de pied."], en=["Stay hydrated and check your magnesium intake.","Start with brisk walking before running.","Progressively load calf raises."], ar=["اشرب بما يكفي وراجع تناولك للمغنيزيوم.","ابدأ بالمشي السريع قبل الجري.","زد الحمل تدريجياً على رفع الكعبين."]),
 dict(fr=["Les sprints et les côtes tant que la pointe de pied fait mal.","Les massages profonds en phase aiguë."], en=["Sprints and hills while calf raises hurt.","Deep massage in the acute phase."], ar=["العدو والمرتفعات ما دام رفع الكعب مؤلماً.","التدليك العميق في المرحلة الحادة."]),
 dict(fr="Vélo léger, natation", en="Easy cycling, swimming", ar="دراجة خفيفة، سباحة"))

z('achilles', [['rh_calf_iso','Calves-SMR'],['rh_heel_drop','rh_soleus_raise','Calf_Stretch_Hands_Against_Wall'],['rh_single_rdl','rh_march_run']],
 dict(fr="Douleur au tendon d'Achille : tendinopathie, qui guérit par charge progressive et non par repos total.", en="Achilles pain: tendinopathy, which heals with progressive loading rather than complete rest.", ar="ألم وتر أخيل: اعتلال وتري، يشفى بالحمل التدريجي لا بالراحة التامة."),
 dict(fr=["Isométrie 4 × 30 s : elle calme la douleur.","Excentriques lents (talon) une fois par jour, 3 à 6 semaines.","Surélève légèrement le talon de tes chaussures au début."], en=["Isometrics 4 x 30 s: they calm the pain.","Slow heel-drop eccentrics once a day for 3 to 6 weeks.","Slightly raise the heel of your shoes at first."], ar=["انقباض ثابت 4 × 30 ث فهو يهدّئ الألم.","نزول الكعب البطيء مرة يومياً لمدة 3 إلى 6 أسابيع.","ارفع كعب حذائك قليلاً في البداية."]),
 dict(fr=["La vitesse, les côtes et les sauts.","Les étirements violents du tendon et les infiltrations sans avis médical."], en=["Speed, hills and jumping.","Aggressive tendon stretching."], ar=["السرعة والمرتفعات والقفز.","التمدد العنيف للوتر."]),
 dict(fr="Vélo, natation, aquajogging", en="Cycling, swimming, aqua-jogging", ar="دراجة، سباحة، جري في الماء"))

COMMON = dict(
 red=dict(fr=["Impossible d'appuyer sur la jambe ou de marcher normalement.","Gonflement important, chaleur, rougeur ou déformation.","Douleur la nuit ou au repos qui ne s'apaise pas.","Engourdissement, fourmillements ou perte de force."],
          en=["You cannot bear weight or walk normally.","Major swelling, heat, redness or deformity.","Night or rest pain that does not ease.","Numbness, tingling or loss of strength."],
          ar=["عدم القدرة على الاستناد على الساق أو المشي بشكل طبيعي.","تورم كبير أو حرارة أو احمرار أو تشوه.","ألم ليلي أو أثناء الراحة لا يهدأ.","خدر أو تنميل أو فقدان القوة."]),
 ret=dict(fr=["Marche sans douleur 30 minutes","Montée d'escalier et squat sans douleur","Test de saut léger sans douleur","Pas de douleur le lendemain de l'effort"],
          en=["Pain-free 30-minute walk","Pain-free stairs and squat","Pain-free light hopping","No pain the day after effort"],
          ar=["مشي 30 دقيقة دون ألم","صعود الدرج والقرفصاء دون ألم","قفز خفيف دون ألم","لا ألم في اليوم التالي للجهد"]),
 disc=dict(fr="Ces conseils sont généraux et ne remplacent pas un avis médical. Si la douleur persiste, consulte un médecin ou un kiné.", en="This is general guidance and does not replace medical advice. If pain persists, see a doctor or physiotherapist.", ar="هذه نصائح عامة ولا تغني عن الاستشارة الطبية. إذا استمر الألم فاستشر طبيباً أو أخصائي علاج طبيعي."))
