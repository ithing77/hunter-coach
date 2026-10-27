# 헌터 감독 (데모)

몬스터 헌터를 감독 시뮬레이션으로. 헌터 4명이 알아서 싸우고, 몬스터가 큰 공격을 예고하면 명령 창이 열려 CP로 회피·가드·반격·회복·섬광탄·응원가를 지시한다.

## 파일
- `data.js` — 헌터·명령·CP·몬스터 공격 수치. **수치는 여기서만 고친다.**
- `sim.js` — 사냥 시뮬레이션 (화면과 무관한 순수 계산, 나중에 멀티 방장 계산으로 옮길 수 있게)
- `view.js` — 경기장·헌터(LPC 그림)·몬스터(코드로 그린 임시 비룡)·범위·효과 그리기
- `main.js` — 진행 루프, 명령 창, 헌터 카드, 결과 화면
- `art/hunters/<id>/<동작>.png` — 헌터 그림 (tools/build_hunters.py 로 생성), `art/CREDITS.txt` 제작자 목록

## 그림 만들기
LPC 생성기 저장소(부분만 받은 것)가 `C:\AI\_lpc\repo` 에 있다. 헌터 옷·무기는 `tools/build_hunters.py` 의 HUNTERS 표에서 고른 뒤:
`python -I tools/build_hunters.py C:/AI/_lpc/repo`

작업실(workshop.html)의 [🧩 캐릭터 만들기] = 공식 LPC 생성기를 그대로 띄운 화면. 거기서 "ZIP: Split by animation" 으로 받은 파일을 가져오기:
`python -I tools/import_generator.py latest <id> <이름> [설명]` (latest = 내려받기 폴더의 가장 최근 압축) → art/showcase/<id>/ + sets.json, 그다음 `python -I tools/credits_all.py C:/AI/_lpc/repo` 로 제작자 목록 갱신

## 확인 도구
`node tools/autohunt.js 30 none` (명령 없이) / `node tools/autohunt.js 30 smart` (위험한 헌터에게 회피·가드)
