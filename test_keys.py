#!/usr/bin/env python3
"""Test AUTONOME, sans serveur : Chrome sur file://index.html#game, vraies touches
via CDP, et TEMPS VIRTUEL pilote (boucle de jeu deterministe -> pas de gel headless).
Prouve : no-server (file://) + assets embarques + clavier repare."""
import socket, os, base64, json, struct, time, urllib.request, sys, subprocess, signal

ROOT = os.path.dirname(os.path.abspath(__file__))
URL = "file://" + os.path.join(ROOT, "index.html") + "#game"
PORT = 9222


class WS:
    def __init__(self, url):
        rest = url[5:]; hostport, _, self.path = rest.partition("/"); self.path = "/" + self.path
        host, _, port = hostport.partition(":")
        self.sock = socket.create_connection((host, int(port) or 80), timeout=10)
        key = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall((f"GET {self.path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
                           f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n"
                           f"Sec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf: buf += self.sock.recv(4096)
        assert b"101" in buf.split(b"\r\n")[0], buf[:80]
        self.buf = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n):
        while len(self.buf) < n: self.buf += self.sock.recv(1 << 16)
        out, self.buf = self.buf[:n], self.buf[n:]; return out

    def send(self, data):
        p = data.encode(); m = os.urandom(4); h = bytearray([0x81]); ln = len(p)
        if ln < 126: h.append(0x80 | ln)
        elif ln < 65536: h.append(0x80 | 126); h += struct.pack(">H", ln)
        else: h.append(0x80 | 127); h += struct.pack(">Q", ln)
        h += m; self.sock.sendall(bytes(h) + bytes(b ^ m[i % 4] for i, b in enumerate(p)))

    def recv(self):
        while True:
            b0, b1 = self._read(2); op = b0 & 0xF; ln = b1 & 0x7F
            if ln == 126: ln = struct.unpack(">H", self._read(2))[0]
            elif ln == 127: ln = struct.unpack(">Q", self._read(8))[0]
            d = self._read(ln)
            if op == 0x1: return d.decode()
            if op == 0x8: raise ConnectionError("closed")


_id = 0
def cmd(ws, method, params=None):
    global _id; _id += 1; mid = _id
    ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
    while True:
        m = json.loads(ws.recv())
        if m.get("id") == mid:
            if "error" in m: raise RuntimeError(method + " " + json.dumps(m["error"]))
            return m.get("result", {})

def ev(ws, expr):
    return cmd(ws, "Runtime.evaluate", {"expression": expr, "returnByValue": True}).get("result", {}).get("value")

def key(ws, typ, k, code, vk):
    cmd(ws, "Input.dispatchKeyEvent", {"type": typ, "key": k, "code": code,
                                       "windowsVirtualKeyCode": vk, "nativeVirtualKeyCode": vk})

def advance(ws, ms):
    """Laisse passer ms en TEMPS REEL en forçant des frames (screenshot) pour
    reveiller le requestAnimationFrame, sinon le headless gele la boucle."""
    end = time.time() + ms / 1000.0
    while time.time() < end:
        try: cmd(ws, "Page.captureScreenshot", {"format": "jpeg", "quality": 10})
        except Exception: pass
        time.sleep(0.008)

STATE = ("(function(){var p=window.LQ&&window.LQ.player;return p?JSON.stringify({"
         "x:Math.round(p.pos.x),y:Math.round(p.pos.y),score:p.score,hp:p.hp,"
         "bullets:(typeof get==='function'?get('pbullet').length:-1),"
         "grounded:p.isGrounded()}):'NO';})()")
def state(ws):
    return json.loads(ev(ws, STATE))


def main():
    subprocess.run(["pkill", "-f", "cr_test_lq"], capture_output=True)  # motif unique (user-data-dir)
    time.sleep(0.4)
    chrome = subprocess.Popen([
        "google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu",
        "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
        "--allow-file-access-from-files", f"--remote-debugging-port={PORT}",
        "--disable-background-timer-throttling", "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding", "--disable-features=CalculateNativeWinOcclusion",
        "--window-size=980,600", "--user-data-dir=/tmp/cr_test_lq", "--no-first-run", URL],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        page = None
        for _ in range(40):
            try:
                ts = json.load(urllib.request.urlopen(f"http://localhost:{PORT}/json"))
                page = next((t for t in ts if t.get("type") == "page" and "index.html" in t.get("url", "")), None) \
                    or next((t for t in ts if t.get("type") == "page"), None)
                if page and page.get("webSocketDebuggerUrl"): break
            except Exception: pass
            time.sleep(0.25)
        if not page: print("ECHEC: pas de cible CDP"); return 1

        ws = WS(page["webSocketDebuggerUrl"])
        cmd(ws, "Runtime.enable"); cmd(ws, "Page.enable")

        # laisse tourner jusqu'a ce que le jeu soit charge
        loaded = False
        for _ in range(20):
            advance(ws, 300)
            if ev(ws, "!!(window.LQ && window.LQ.player)"): loaded = True; break
        if not loaded: print("ECHEC: jeu non charge (assets/JS ?)"); return 1

        nspr = ev(ws, "(window.ASSETS?Object.keys(window.ASSETS.sprites).length:-1)")
        # focus du canvas via un vrai clic (comme un joueur)
        cmd(ws, "Input.dispatchMouseEvent", {"type": "mousePressed", "x": 480, "y": 260, "button": "left", "clickCount": 1})
        cmd(ws, "Input.dispatchMouseEvent", {"type": "mouseReleased", "x": 480, "y": 260, "button": "left", "clickCount": 1})
        advance(ws, 200)
        focus = ev(ws, "document.activeElement?document.activeElement.tagName:'NONE'")
        s0 = state(ws); print("assets embarques:", nspr, "| focus:", focus, "| AVANT:", s0)

        # 0) SAUT EN PREMIER (slot le plus fiable pour la livraison de touche)
        y00 = state(ws)["y"]
        key(ws, "keyDown", " ", "Space", 32)
        ksp = ev(ws, "(typeof isKeyDown==='function'&&isKeyDown('space'))?1:0")
        t0 = []
        for _ in range(8):
            advance(ws, 45); t0.append(state(ws)["y"])
        key(ws, "keyUp", " ", "Space", 32)
        print("SAUT EN PREMIER: isKeyDown(space)=%s min=%d traj=%s => montee=%d"
              % (ksp, min(t0), t0, min(t0) - y00))
        advance(ws, 700)  # retomber

        # 1) MOUVEMENT par une LETTRE ('d')
        key(ws, "keyDown", "d", "KeyD", 68)
        kd = ev(ws, "(typeof isKeyDown==='function'&&isKeyDown('d'))?1:0")
        advance(ws, 600)
        s1 = state(ws); key(ws, "keyUp", "d", "KeyD", 68)
        print("apres 'd' (lettre): isKeyDown(d)=%s" % kd, s1, "=> dx =", s1["x"] - s0["x"])

        fps = ev(ws, "(typeof debug!=='undefined'&&debug.fps)?Math.round(debug.fps()):-1")

        # 2) TIR ('x')
        key(ws, "keyDown", "x", "KeyX", 88)
        kx = ev(ws, "(typeof isKeyDown==='function'&&isKeyDown('x'))?1:0")
        maxb = 0
        for _ in range(8):
            advance(ws, 50)
            st = state(ws); maxb = max(maxb, st["bullets"])
        key(ws, "keyUp", "x", "KeyX", 88)
        print("apres 'x' (tir): fps=%s isKeyDown(x)=%s => max bullets = %d" % (fps, kx, maxb))

        # 3) SAUT (espace)
        y0 = state(ws)["y"]
        key(ws, "keyDown", " ", "Space", 32)
        traj = []
        for _ in range(10):
            advance(ws, 45); traj.append(state(ws)["y"])
        key(ws, "keyUp", " ", "Space", 32)
        rise = min(traj) - y0
        print("apres ESPACE (saut): y0=%d min=%d traj=%s => montee=%d" % (y0, min(traj), traj, rise))

        # screenshot (preuve visuelle assets base64)
        advance(ws, 200)
        shot = cmd(ws, "Page.captureScreenshot", {"format": "png"})
        with open(os.path.join(ROOT, "shot_filetest.png"), "wb") as f:
            f.write(base64.b64decode(shot["data"]))

        ok_move = (s1["x"] - s0["x"]) > 10
        ok_shoot = maxb >= 1
        ok_jump = rise < -8
        print("\nRESULTAT  move(lettre)=%s  tir=%s  saut=%s  (file://, sans serveur)"
              % (ok_move, ok_shoot, ok_jump))
        return 0 if (ok_move and ok_shoot and ok_jump) else 2
    finally:
        chrome.send_signal(signal.SIGTERM)
        try: chrome.wait(timeout=5)
        except Exception: chrome.kill()


if __name__ == "__main__":
    sys.exit(main())
