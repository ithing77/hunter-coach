# 몬스터 세트 느낌의 갑옷 조합 (작업실 보기용). 부위 = LPC sheet_definitions 경로, 세 번째 칸 = 색.
#   색 (r,g,b) 곱하기 = 밑에 까는 옷 / {'ramp': [어두운, 중간, 밝은]} = 쇠·천 색 바꾸기
R = lambda a, b, c: {'ramp': [a, b, c]}
RED = R((60, 12, 10), (176, 40, 30), (255, 170, 120))
DARKRED = R((35, 5, 5), (110, 18, 18), (210, 80, 70))
BONE = R((70, 58, 40), (200, 186, 150), (255, 250, 232))
BLUE = R((15, 25, 60), (40, 70, 150), (140, 180, 240))
GREEN = R((18, 36, 16), (78, 118, 48), (190, 220, 140))
MOSS = R((25, 30, 15), (95, 100, 50), (200, 205, 140))
GOLD = R((70, 40, 5), (205, 150, 40), (255, 240, 170))
ICE = R((18, 38, 70), (110, 170, 215), (238, 250, 255))
DARK = (0.42, 0.42, 0.48)
BROWN = (0.55, 0.42, 0.3)

BASE = [('body/body.json', None), ('head/heads/human/heads_human_male.json', None), ('head/faces/face_neutral.json', None)]
UNDER = lambda c=DARK: [('legs/pants/legs_pants.json', None, c), ('feet/boots/feet_boots_revised.json', None, c), ('torso/shirts/longsleeve/torso_clothes_longsleeve.json', None, c)]
SWORD = [('weapons/sword/weapon_sword_longsword.json', 'longsword')]

SETS = {
    'rios': {'name': '리오스 세트', 'desc': '불꽃비룡의 붉은 비늘 — 뿔 투구, 찢어진 망토', 'sex': 'male', 'parts': BASE + UNDER() + [
        ('torso/armour/torso_armour_plate.json', None, RED), ('legs/legs_armour.json', None, RED), ('feet/feet_armour.json', None, DARKRED),
        ('arms/shoulders/shoulders_pauldrons.json', None, RED), ('arms/arms_gloves.json', None, DARKRED),
        ('torso/cape/cape_tattered.json', None, DARKRED), ('headwear/helmets/helmets/hat_helmet_horned.json', None, RED)] + SWORD},
    'bone': {'name': '뼈 세트', 'desc': '첫 사냥꾼의 세트 — 짐승 뼈와 가죽', 'sex': 'male', 'parts': BASE + UNDER(BROWN) + [
        ('hair/short/hair_plain.json', None),
        ('torso/armour/torso_armour_leather.json', None, BONE), ('arms/bauldron.json', None, BONE), ('arms/wrists/arms_bracers.json', None, BONE),
        ('headwear/helmets/helmets/hat_helmet_barbarian.json', None, BONE)] + SWORD},
    'golem': {'name': '강철 골렘 세트', 'desc': '돌과 쇠로 된 골렘의 단단함 — 통짜 투구', 'sex': 'male', 'parts': BASE + UNDER() + [
        ('torso/armour/torso_armour_plate.json', None), ('legs/legs_armour.json', None), ('feet/feet_armour.json', None),
        ('arms/shoulders/shoulders_pauldrons.json', None), ('arms/arms_gloves.json', None, R((20, 20, 24), (70, 70, 80), (160, 160, 170))),
        ('torso/cape/cape_solid.json', None, BLUE), ('headwear/helmets/helmets/hat_helmet_greathelm.json', None)] + SWORD},
    'swamp': {'name': '늪 괴물 세트', 'desc': '독 늪의 이끼 낀 갑옷 — 돼지코 면갑', 'sex': 'male', 'parts': BASE + UNDER((0.35, 0.45, 0.3)) + [
        ('torso/armour/torso_armour_legion.json', None, GREEN), ('legs/skirts/legs_skirts_legion.json', None, MOSS),
        ('arms/shoulders/shoulders_legion.json', None, GREEN), ('arms/wrists/arms_bracers.json', None, MOSS),
        ('headwear/helmets/helmets/hat_helmet_kettle.json', None, MOSS), ('headwear/helmets/visors/hat_visor_pigface.json', None, GREEN)] + SWORD},
    'lion': {'name': '황금 사자 세트', 'desc': '희귀한 금빛 갑옷 — 붉은 망토', 'sex': 'male', 'parts': BASE + UNDER() + [
        ('torso/armour/torso_armour_plate.json', None, GOLD), ('legs/legs_armour.json', None, GOLD), ('feet/feet_armour.json', None, GOLD),
        ('arms/shoulders/shoulders_pauldrons.json', None, GOLD), ('arms/arms_gloves.json', None, GOLD),
        ('torso/cape/cape_solid.json', None, DARKRED), ('headwear/helmets/helmets/hat_helmet_maximus.json', None, GOLD)] + SWORD},
    'frost': {'name': '얼음 정령 세트', 'desc': '서리 낀 푸른 갑옷 — 뿔 면갑', 'sex': 'male', 'parts': BASE + UNDER((0.4, 0.45, 0.6)) + [
        ('torso/armour/torso_armour_plate.json', None, ICE), ('legs/legs_armour.json', None, ICE), ('feet/feet_armour.json', None, ICE),
        ('arms/shoulders/shoulders_mantal.json', None, ICE), ('arms/arms_gloves.json', None, BLUE),
        ('headwear/helmets/helmets/hat_helmet_close.json', None, ICE), ('headwear/helmets/visors/hat_visor_horned.json', None, ICE)] + SWORD},
}

# 비교 장면용 적 (LPC 몸에 괴물 머리)
SKIN_G = R((20, 40, 15), (95, 140, 60), (200, 230, 150))
SKIN_O = R((30, 35, 25), (110, 125, 85), (210, 220, 170))
SKIN_B = R((40, 20, 10), (130, 80, 50), (230, 190, 150))
ENEMIES = {
    'goblin': {'name': '고블린', 'sex': 'male', 'parts': [('body/body.json', None, SKIN_G), ('head/heads/fantasy/heads_goblin.json', None, SKIN_G),
        ('legs/pants/legs_pants.json', None, BROWN), ('torso/armour/torso_armour_leather.json', None, R((30, 20, 10), (100, 70, 40), (190, 150, 100))),
        ('weapons/sword/weapon_sword_dagger.json', 'dagger')]},
    'orc': {'name': '오크', 'sex': 'male', 'parts': [('body/body.json', None, SKIN_O), ('head/heads/fantasy/heads_orc_male.json', None, SKIN_O),
        ('legs/pants/legs_pants.json', None, DARK), ('torso/armour/torso_armour_legion.json', None, R((30, 25, 20), (110, 90, 60), (200, 180, 140))),
        ('weapons/polearm/weapon_polearm_spear.json', 'iron')]},
    'skel': {'name': '해골', 'sex': 'male', 'parts': [('body/special/body_skeleton.json', None), ('head/heads/undead/heads_skeleton.json', None),
        ('weapons/sword/weapon_sword_dagger.json', 'dagger')]},
    'mino': {'name': '미노타우로스 대장', 'sex': 'muscular', 'parts': [('body/body.json', None, SKIN_B), ('head/heads/beast/heads_minotaur.json', None, SKIN_B),
        ('legs/pants/legs_pants.json', None, DARK), ('torso/armour/torso_armour_plate.json', None, R((25, 10, 10), (90, 40, 35), (190, 130, 110))),
        ('weapons/blunt/weapon_blunt_waraxe.json', 'waraxe')]},
}

# 탐험 시험판 파티·적
PARTY = {
    'knight': {'name': '기사', 'sex': 'male', 'parts': BASE + UNDER() + [
        ('hair/short/hair_plain.json', None), ('torso/armour/torso_armour_plate.json', None), ('legs/legs_armour.json', None), ('feet/feet_armour.json', None),
        ('arms/shoulders/shoulders_pauldrons.json', None), ('headwear/helmets/helmets/hat_helmet_nasal.json', None),
        ('weapons/shields/heater/shield_heater_wood.json', None), ('weapons/sword/weapon_sword_arming.json', 'steel')]},
    'skel_archer': {'name': '해골 궁수', 'sex': 'male', 'parts': [('body/special/body_skeleton.json', None), ('head/heads/undead/heads_skeleton.json', None),
        ('weapons/ranged/bow/weapon_ranged_bow_normal.json', 'light'), ('weapons/ranged/bow/weapon_ranged_bow_arrow.json', 'arrow')]},
}
