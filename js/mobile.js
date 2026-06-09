/* =====================================================================
 *  MOBILE — Manette tactile (web mobile ; pas de natif).
 *
 *  - Detecte le tactile (pointeur "grossier") -> affiche une manette a
 *    l'ecran. Sinon : NE FAIT RIEN, le clavier reste maitre (desktop intact).
 *  - Chaque bouton SYNTHETISE un evenement clavier (keydown/keyup) sur le
 *    <canvas>. KAPLAY ecoute keydown/keyup SUR le canvas et lit e.key (mappe
 *    " "->space, "ArrowLeft"->left, ...), donc TOUT le gameplay (isKeyDown /
 *    onKeyPress via C.controls) fonctionne SANS modifier la logique du jeu.
 *    cf. js/game.js : keysDown(C.controls.X) / onKeys(C.controls.X, ...).
 *  - Detection forcable : ?touch=1 (force ON) / ?touch=0 (force OFF) dans
 *    l'URL ; ou #...mobile / #...nopad dans le hash (pratique pour tester).
 *  - DOIT etre charge AVANT game.js : il pose window.LQ_TOUCH AVANT l'appel
 *    kaplay() (qui lit .active pour le letterbox). L'overlay DOM se construit
 *    au DOMContentLoaded (le canvas existe alors).
 *
 *  Reglages : CONFIG.mobile (js/config.js). Sprite/textes : aucun (DOM pur).
 * ===================================================================== */
(() => {
  'use strict';
  const C = window.CONFIG || {};
  const M = C.mobile || {};
  const ctrl = C.controls || {};

  // --- Detection ------------------------------------------------------
  const hash = (location.hash || '').toLowerCase();
  const search = (location.search || '').toLowerCase();
  const forceOn = /touch=1/.test(search) || /mobile/.test(hash);
  const forceOff = /touch=0/.test(search) || /(nopad|notouch|forcepc)/.test(hash);
  const mm = (q) => { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } };
  const coarse = mm('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mm('(pointer: fine)'));
  const active = (M.enabled !== false) && !forceOff && (forceOn || coarse);

  // Pose le flag AVANT game.js (lecture synchrone par kaplay()).
  window.LQ_TOUCH = { active: active, assist: active && (M.assistAim !== false) };
  if (!active) return;                       // desktop : rien d'autre a faire.

  document.documentElement.classList.add('lq-mobile');
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn, { once: true }) : fn());

  // --- Synthese de touches clavier vers le canvas ---------------------
  //  Inverse de la normalisation KAPLAY : token interne -> KeyboardEvent.key.
  const DOM_KEY = {
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    space: ' ', enter: 'Enter', shift: 'Shift', escape: 'Escape', tab: 'Tab',
  };
  const CODE = {
    'ArrowLeft': 'ArrowLeft', 'ArrowRight': 'ArrowRight', 'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown', ' ': 'Space', 'Enter': 'Enter', 'Shift': 'ShiftLeft',
    'Escape': 'Escape', 'Tab': 'Tab',
  };
  const domKey = (tok) => DOM_KEY[tok] || tok;                       // 'z','c','x'... passent tels quels
  const codeFor = (k) => CODE[k] || (k.length === 1 ? 'Key' + k.toUpperCase() : k);
  const canvasEl = () => document.querySelector('canvas');
  function fire(type, k) {
    const cv = canvasEl();
    if (!cv) return;
    try { cv.focus({ preventScroll: true }); } catch (e) {}
    cv.dispatchEvent(new KeyboardEvent(type, { key: k, code: codeFor(k), bubbles: true, cancelable: true }));
  }

  // Choisit, pour une action, une touche liee qui EVITE les conflits cites.
  const pick = (action, avoid) => {
    const arr = ctrl[action] || [];
    const banned = (avoid || []).reduce((s, a) => s.concat(ctrl[a] || []), []);
    return arr.find((k) => banned.indexOf(k) < 0) || arr[0] || action;
  };
  const KEY = {
    left: pick('left'),
    right: pick('right'),
    jump: pick('jump'),                         // surtout PAS 'up' si possible -> 'z'/'w'
    shoot: pick('shoot'),
    crouch: pick('crouch'),
    cat: pick('cat'),
    lob: pick('lob'),                           // lob lourd (auto-vise) -> 'x'
    quit: pick('quit'),
  };

  // --- Boutons (DOM) --------------------------------------------------
  function makeBtn(cls, glyph, sub) {
    const b = document.createElement('div');
    b.className = 'lq-btn ' + cls;
    const g = document.createElement('span');
    g.className = 'lq-g'; g.textContent = glyph; b.appendChild(g);
    if (sub) {
      const s = document.createElement('span');
      s.className = 'lq-s'; s.textContent = sub; b.appendChild(s);
    }
    return b;
  }
  // Maintien : keydown au toucher, keyup au relacher. Pour SAUT/sorts, KAPLAY
  //  declenche onKeyPress sur le keydown (1 saut par tap) ; le maintien ne
  //  re-tire pas (garde `on`). Pour DROITE/TIR/CHAT, keysDown reste vrai tant
  //  qu'on appuie. Multi-touch : chaque bouton capture son propre pointeur.
  function bindHold(el, token) {
    const k = domKey(token);
    let on = false, pid = null;
    const press = (e) => {
      if (on) return;
      on = true; pid = e.pointerId; el.classList.add('on');
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      fire('keydown', k);
    };
    const release = (e) => {
      if (!on) return;
      on = false; el.classList.remove('on');
      try { el.releasePointerCapture(pid); } catch (_) {}
      if (e && e.cancelable) e.preventDefault();
      if (e) e.stopPropagation();
      fire('keyup', k);
    };
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function build() {
    if (document.getElementById('lq-touch')) return;
    injectCSS();

    const root = document.createElement('div');
    root.id = 'lq-touch';

    // Deplacement (gauche)
    const bL = makeBtn('lq-move lq-dirL', '◀');   // ◀
    const bR = makeBtn('lq-move lq-dirR', '▶');   // ▶
    const bDown = makeBtn('lq-small lq-crouch', '▼'); // ▼ accroupi
    bindHold(bL, KEY.left); bindHold(bR, KEY.right); bindHold(bDown, KEY.crouch);

    // Actions (droite)
    const bJump = makeBtn('lq-big lq-jump', '▲', 'SAUT');   // ▲
    const bShoot = makeBtn('lq-big lq-shoot', '✸', 'TIR');  // ✸
    const bCat = makeBtn('lq-small lq-cat', '🐱');     // 🐱
    const bLob = makeBtn('lq-small lq-lob', '🎂', 'LOB');   // 🎂 lob lourd (auto-vise)
    bindHold(bJump, KEY.jump); bindHold(bShoot, KEY.shoot);
    bindHold(bCat, KEY.cat); bindHold(bLob, KEY.lob);

    // Coin : pause/quitter (HG)
    const bPause = makeBtn('lq-corner lq-pause', '❚❚');  // ❚❚
    bindHold(bPause, KEY.quit);
    const jumpLabel = bJump.querySelector('.lq-s');

    root.append(bL, bR, bDown, bLob, bCat, bShoot, bJump, bPause);
    document.body.appendChild(root);

    // Astuce "tourne ton telephone" en portrait.
    const rot = document.createElement('div');
    rot.id = 'lq-rotate';
    rot.textContent = '🔄  Tourne ton telephone (paysage)';
    document.body.appendChild(rot);

    armFullscreen();

    // Boucle legere : visibilite selon la scene (gamepad complet en jeu, reduit en menu).
    const tick = () => {
      const sc = (typeof getSceneName === 'function') ? getSceneName() : null;
      const inGame = (sc === 'game' || sc == null);
      root.classList.toggle('lq-menu', !inGame);
      if (jumpLabel) jumpLabel.textContent = inGame ? 'SAUT' : 'OK';
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Plein ecran + verrou paysage au 1er contact (best-effort ; iPhone ignore).
  function armFullscreen() {
    const go = () => {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      try { if (req && !document.fullscreenElement) req.call(el).catch(() => {}); } catch (e) {}
      try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
      window.removeEventListener('pointerdown', go, true);
    };
    window.addEventListener('pointerdown', go, true);
  }

  // --- CSS (injecte) --------------------------------------------------
  function injectCSS() {
    if (document.getElementById('lq-touch-css')) return;
    const op = (M.opacity != null) ? M.opacity : 0.34;
    const big = (M.size || 74);
    const css = `
:root{
  --lq-op:${op}; --lq-big:${big}px; --lq-move:${Math.round(big * 0.9)}px;
  --lq-small:${Math.round(big * 0.7)}px; --lq-corner:${Math.round(big * 0.62)}px;
  --lq-pad:16px; --lq-gap:14px;
  --lq-sl:env(safe-area-inset-left,0px); --lq-sr:env(safe-area-inset-right,0px);
  --lq-sb:env(safe-area-inset-bottom,0px); --lq-st:env(safe-area-inset-top,0px);
}
html.lq-mobile, html.lq-mobile body{ width:100%; height:100%; overflow:hidden;
  overscroll-behavior:none; touch-action:none; }
html.lq-mobile #note{ display:none; }
html.lq-mobile canvas{ width:100vw !important; height:100vh !important; height:100dvh !important;
  border-radius:0 !important; box-shadow:none !important; }

#lq-touch{ position:fixed; inset:0; z-index:50; pointer-events:none;
  font-family:system-ui,-apple-system,sans-serif;
  -webkit-user-select:none; user-select:none; -webkit-touch-callout:none;
  -webkit-tap-highlight-color:transparent; }
#lq-touch .lq-btn{ position:absolute; pointer-events:auto; touch-action:none;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  border-radius:50%; color:#fff; font-weight:800; text-shadow:0 1px 2px rgba(0,0,0,.5);
  background:rgba(18,26,40,var(--lq-op)); border:2px solid rgba(255,255,255,.55);
  box-shadow:0 3px 10px rgba(0,0,0,.35); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px);
  transition:transform .05s ease, background .05s ease; }
#lq-touch .lq-btn .lq-g{ font-size:1.55em; line-height:1; }
#lq-touch .lq-btn .lq-s{ font-size:.6em; letter-spacing:.5px; margin-top:2px; opacity:.95; }
#lq-touch .lq-btn.on{ background:rgba(90,150,230,.88); transform:scale(.9); }

/* tailles */
.lq-big{ width:var(--lq-big); height:var(--lq-big); font-size:1.05rem; }
.lq-move{ width:var(--lq-move); height:var(--lq-move); font-size:1.1rem; }
.lq-small{ width:var(--lq-small); height:var(--lq-small); font-size:.95rem; }
.lq-corner{ width:auto; min-width:var(--lq-corner); height:var(--lq-corner);
  border-radius:22px; padding:0 12px; font-size:.85rem; }

/* gauche : deplacement */
.lq-dirL{ left:calc(var(--lq-sl) + var(--lq-pad)); bottom:calc(var(--lq-sb) + var(--lq-pad)); }
.lq-dirR{ left:calc(var(--lq-sl) + var(--lq-pad) + var(--lq-move) + var(--lq-gap)); bottom:calc(var(--lq-sb) + var(--lq-pad)); }
.lq-crouch{ left:calc(var(--lq-sl) + var(--lq-pad) + var(--lq-move) + var(--lq-gap)/2 - var(--lq-small)/2);
  bottom:calc(var(--lq-sb) + var(--lq-pad) + var(--lq-move) + var(--lq-gap)); }

/* droite : actions */
.lq-jump{ right:calc(var(--lq-sr) + var(--lq-pad)); bottom:calc(var(--lq-sb) + var(--lq-pad)); }
.lq-shoot{ right:calc(var(--lq-sr) + var(--lq-pad) + var(--lq-big) + var(--lq-gap)); bottom:calc(var(--lq-sb) + var(--lq-pad)); }
.lq-cat{ right:calc(var(--lq-sr) + var(--lq-pad)); bottom:calc(var(--lq-sb) + var(--lq-pad) + var(--lq-big) + var(--lq-gap)); }
.lq-lob{ right:calc(var(--lq-sr) + var(--lq-pad) + var(--lq-small) + var(--lq-gap)); bottom:calc(var(--lq-sb) + var(--lq-pad) + var(--lq-big) + var(--lq-gap)); }

/* coins */
.lq-pause{ left:calc(var(--lq-sl) + var(--lq-pad)); top:calc(var(--lq-st) + var(--lq-pad)); }

/* en menu (hors jeu) : on masque les boutons "combat", on garde deplacement + OK + pause */
#lq-touch.lq-menu .lq-shoot, #lq-touch.lq-menu .lq-cat, #lq-touch.lq-menu .lq-lob,
#lq-touch.lq-menu .lq-crouch{ display:none; }

/* rotation conseillee en portrait */
#lq-rotate{ position:fixed; inset:0; z-index:60; display:none; align-items:center; justify-content:center;
  background:#1b2330; color:#cdd6e4; font:600 19px system-ui,sans-serif; text-align:center; padding:24px; }
@media (orientation:portrait){ html.lq-mobile #lq-rotate{ display:flex; } }
`;
    const st = document.createElement('style');
    st.id = 'lq-touch-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  onReady(build);
})();
