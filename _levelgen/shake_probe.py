#!/usr/bin/env python3
"""Teste qu'un GROS tremblement ne decouvre AUCUNE bande de couleur 'sky'.
Lance Chrome en remote-debugging, va au niveau, force shake(24) (pire cas >
max 14 du jeu), capture plusieurs frames et les enregistre pour inspection."""
import base64, json, subprocess, time, urllib.request, os, signal
import websocket  # websocket-client

URL = "file:///home/delete/laura_quest/index.html#game/niveau2"
PORT = 9222
CHROME = "google-chrome"

proc = subprocess.Popen([
    CHROME, "--headless=new", "--no-sandbox", "--use-gl=swiftshader",
    "--enable-unsafe-swiftshader", "--window-size=960,528",
    "--remote-debugging-port=%d" % PORT, "--remote-allow-origins=*", URL,
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

def get_ws():
    for _ in range(60):
        try:
            data = json.load(urllib.request.urlopen("http://localhost:%d/json" % PORT))
            for t in data:
                if t.get("type") == "page" and t.get("webSocketDebuggerUrl"):
                    return t["webSocketDebuggerUrl"]
        except Exception:
            pass
        time.sleep(0.3)
    raise RuntimeError("pas de cible CDP")

try:
    ws = websocket.create_connection(get_ws(), max_size=None)
    _id = [0]
    def cmd(method, params=None):
        _id[0] += 1
        ws.send(json.dumps({"id": _id[0], "method": method, "params": params or {}}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == _id[0]:
                return m
    cmd("Page.enable"); cmd("Runtime.enable")
    time.sleep(4.0)  # laisse KAPLAY booter + le niveau se construire
    def shoot(name):
        r = cmd("Page.captureScreenshot", {"format": "png"})
        d = r.get("result", {}).get("data")
        if d:
            open("/tmp/%s.png" % name, "wb").write(base64.b64decode(d))
            print("shot", name)
    shoot("shake_rest")
    # force et SOUTIENS un gros shake, capture plusieurs frames pour choper le pic
    for i in range(8):
        cmd("Runtime.evaluate", {"expression": "shake(24)"})
        time.sleep(0.035)
        shoot("shake_%d" % i)
    ws.close()
finally:
    proc.send_signal(signal.SIGTERM)
    try: proc.wait(timeout=5)
    except Exception: proc.kill()
print("done")
