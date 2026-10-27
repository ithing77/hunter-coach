# 리소스 탭(resources.html)이 읽는 그림 묶음 목록을 만든다: C:\AI\Assets\_gallery.json
#   python -I tools/build_resources.py
# 이펙트·마법·맵·몬스터·소리는 이미 있는 index.json / monsters.json 을 그대로 읽으므로 여기선
# 표가 없는 그림 폴더(HEROES 99·직접 만든 그림·기타 팩)만 훑는다. Assets 는 재배포 금지 그림이 있어 공개 저장소에 넣지 않는다.
import json, os
from PIL import Image

ASSETS = os.path.join(os.path.dirname(__file__), '..', '..', 'Assets')
PACKS = [   # 폴더, 보일 이름, 라이선스 한 줄
    ('custom', '직접 만든 그림', '사용자 것 (GPT 등) · 공개 OK'),
    ('HEROES99', 'HEROES 99', '구매 · 수정·상업 OK · 재배포·AI 학습 금지'),
    ('ManaSeed', 'Mana Seed 체험판', '상업·수정 OK'),
    ('Minifantasy', 'Minifantasy', '상업·수정 OK · 재판매 금지'),
    ('TinySwords', 'Tiny Swords', '무료판 · 라이선스 판매 페이지 확인'),
    ('NinjaAdventure', 'Ninja Adventure', 'CC0'),
    ('OpenGameArt', 'OpenGameArt 모음', '묶음마다 다름 (폴더 안 설명 확인)'),
    ('Sunnyside', 'Sunnyside World', '폴더 안 라이선스_읽어주세요.txt 확인'),
]
SKIP = ('_zip', '_zips', '_src', '_built', 'Gamemaker')


def main():
    out = []
    for folder, name, lic in PACKS:
        root = os.path.join(ASSETS, folder)
        files = []
        for dp, dns, fns in os.walk(root):
            dns[:] = sorted(d for d in dns if not d.startswith(SKIP))
            for fn in sorted(fns):
                if fn.lower().endswith(('.png', '.gif')):
                    p = os.path.join(dp, fn)
                    try:
                        w, h = Image.open(p).size
                    except Exception:
                        continue
                    grp = os.path.relpath(dp, root).replace(os.sep, '/')
                    grp = '(맨 위)' if grp == '.' else grp
                    rel = os.path.relpath(p, ASSETS).replace(os.sep, '/')
                    files.append({'src': rel, 'name': os.path.splitext(fn)[0], 'group': grp, 'size': [w, h]})
        out.append({'id': folder, 'name': name, 'license': lic, 'files': files})
        print(folder, len(files))
    with open(os.path.join(ASSETS, '_gallery.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False)


main()
