# 작업실용 그림 서버 (start.vbs 가 창 없이 켠다). pythonw 는 출력 창이 없어서 기본 서버의 기록 출력을 끈다.
#   /assets/... 는 공용 그림 창고 C:\AI\Assets 를 읽는다 (리소스 탭용, 내 컴퓨터에서만. 공개 사이트엔 없음)
import http.server, os, sys, urllib.parse

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ASSETS = os.path.join(ROOT, '..', 'Assets')


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def translate_path(self, path):
        p = urllib.parse.unquote(urllib.parse.urlsplit(path).path)
        if p.startswith('/assets/'):
            full = os.path.normpath(os.path.join(ASSETS, p[len('/assets/'):]))
            if full.startswith(os.path.normpath(ASSETS)):
                return full
        return super().translate_path(path)


os.chdir(ROOT)
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), Quiet).serve_forever()
