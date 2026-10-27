# 이 저장소에 들어 있는 LPC 그림 전부의 제작자 목록: python -I tools/credits_all.py <LPC 저장소 폴더> → art/CREDITS.txt
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
sys.argv = [sys.argv[0], sys.argv[1]]
import build_hunters as B
import armor_sets as S
looks = list(B.HUNTERS.values()) + list(S.SETS.values()) + list(S.ENEMIES.values()) + list(S.PARTY.values()) + list(S.WEAPONS.values())
credits = {}
for h in looks:
    for part in h['parts']:
        d = B.find_def(part[0])
        for c in d.get('credits', []):
            credits[c['file']] = c
out = os.path.join(os.path.dirname(__file__), '..', 'art', 'CREDITS.txt')
with open(out, 'w', encoding='utf-8') as f:
    f.write('이 저장소의 캐릭터 그림(art/)은 Universal LPC Spritesheet Character Generator 의 부위를 조합해 만들었습니다.\n')
    f.write('https://github.com/LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator\n')
    f.write('라이선스: 아래 각 부위의 라이선스(CC-BY-SA 3.0 / OGA-BY 3.0 / GPL 3.0 등)를 따릅니다. 색을 바꾸거나 겹쳐 조합했습니다.\n\n')
    for k in sorted(credits):
        c = credits[k]
        f.write(f"{c['file']}\n  작가: {', '.join(c.get('authors', []))}\n  라이선스: {', '.join(c.get('licenses', []))}\n  출처: {' '.join(c.get('urls', []))}\n\n")
    # 생성기에서 만들어 가져온 캐릭터 (tools/import_generator.py) 는 생성기가 준 출처를 그대로 붙인다
    import glob
    for sub in ('fx', 'sfx'):   # 게임에 넣은 이펙트·소리 출처
        fxc = os.path.join(os.path.dirname(out), sub, 'CREDITS.txt')
        if os.path.exists(fxc):
            f.write('\n===== ' + open(fxc, encoding='utf-8').read())
    for cf in sorted(glob.glob(os.path.join(os.path.dirname(out), 'showcase', '*', 'CREDITS.txt'))):
        f.write('\n===== 생성기로 만든 캐릭터: ' + os.path.basename(os.path.dirname(cf)) + ' =====\n')
        f.write(open(cf, encoding='utf-8').read())
print(len(credits), '부위')
