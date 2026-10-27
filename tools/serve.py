# 작업실용 그림 서버 (start.vbs 가 창 없이 켠다). pythonw 는 출력 창이 없어서 기본 서버의 기록 출력을 끈다.
import http.server, os, sys

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
http.server.ThreadingHTTPServer(('127.0.0.1', int(sys.argv[1])), Quiet).serve_forever()
