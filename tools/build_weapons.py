# 무기 보기용 동작 그림을 한꺼번에 만든다: python -I tools/build_weapons.py <LPC 저장소 폴더>
#   무기 목록은 armor_sets.WEAPON_LIST. 결과: art/showcase/w_<id>/ + art/showcase/weapons.json (작업실 [동작] 탭이 읽음)
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(__file__))
import armor_sets as S

here = os.path.dirname(__file__)
out = []
for k, n, g, w in S.WEAPON_LIST:
    r = subprocess.run([sys.executable, '-I', os.path.join(here, 'build_showcase.py'), sys.argv[1], 'w_' + k], capture_output=True, text=True, encoding='utf-8')
    ok = r.returncode == 0
    print(('ok  ' if ok else 'FAIL') + ' w_' + k, '' if ok else r.stderr[-300:])
    if ok:
        out.append({'id': 'w_' + k, 'name': n, 'kind': g})
json.dump(out, open(os.path.join(here, '..', 'art', 'showcase', 'weapons.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), '무기')
