' 헌터 감독 작업실 열기: 그림 서버가 꺼져 있으면 창 없이 켜고, 기본 브라우저로 작업실을 연다.
Option Explicit
Const URL = "http://127.0.0.1:8790/workshop.html"
Const ROOT = "C:\AI\HunterCoach"
Const PYTHONW = "C:\Users\tpklo\AppData\Local\Programs\Python\Python312\pythonw.exe"

Dim sh : Set sh = CreateObject("WScript.Shell")

Function ServerUp()
  Dim http
  ServerUp = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 1000, 1000
  http.Open "GET", URL, False
  http.Send
  If Err.Number = 0 Then If http.Status = 200 Then ServerUp = True
  On Error GoTo 0
End Function

If Not ServerUp() Then
  sh.CurrentDirectory = ROOT
  sh.Run """" & PYTHONW & """ -I tools\serve.py 8790", 0, False   ' 0 = 창 없이
  Dim i
  For i = 1 To 30                                                             ' 최대 6초 기다림
    WScript.Sleep 200
    If ServerUp() Then Exit For
  Next
End If

sh.Run URL
