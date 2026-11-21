/* Escape from Dema: an unofficial 8-bit fan game.
   All art and music here are original and drawn or played in code.
   Plain JS, no build step. */
(() => {
  'use strict';

  const W = 320, H = 180, T = 16, ROWS = 12;
  const TEST = /[?&]test\b/.test(location.search);
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const isTouch = ('ontouchstart' in window) ||
    !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (isTouch) document.body.classList.add('touch');

  function resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const scale = s >= 2 ? Math.floor(s) : s;
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked */ } }
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- sprites
  const PAL = {
    k: '#0b0b10', d: '#24242e', g: '#4c4c5c', l: '#8e8e9e', w: '#ecece2',
    r: '#9c1c1c', R: '#e0443c', y: '#f8d038', Y: '#b88a14', s: '#e4b08a',
    o: '#56682a', f: '#f07818'
  };
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function sprite(rows) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const c = mk(w, h), x = c.getContext('2d');
    for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
      const col = PAL[rows[j][i]];
      if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
    }
    return c;
  }
  function flip(c) {
    const f = mk(c.width, c.height), x = f.getContext('2d');
    x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
    return f;
  }
  function tint(c, color) {
    const t = mk(c.width, c.height), x = t.getContext('2d');
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return t;
  }
  const pair = s => [s, flip(s)];

  const P_TOP = [
    '...kkkkk....',
    '..kgggggk...',
    '.kgggggggk..',
    '.kggsssssk..',
    '.kgssskssk..',
    '.kggssssk...',
    '..kkkkkkk...',
    '.kyyyyyyyk..',
    'kggyyggggk..',
    'kgggggggggk.',
    'ksgggggggsk.',
    '.kgggggggk..'
  ];
  const P_LEGS = {
    idle: ['.kddk.kddk..', '.kddk.kddk..', '.kddk.kddk..', '.kkkk.kkkk..'],
    run1: ['..kddkddk...', '.kddk..kddk.', 'kddk....kdk.', 'kkk......kk.'],
    run2: ['...kddddk...', '...kddkdk...', '...kdkdk....', '...kkkkk....'],
    jump: ['..kddkddk...', '.kddk.kddk..', 'kdk.....kdk.', 'kk.......kk.']
  };
  const PF = {}, PFY = {};
  for (const k in P_LEGS) {
    const s = sprite(P_TOP.concat(P_LEGS[k]));
    PF[k] = pair(s);
    PFY[k] = pair(tint(s, PAL.y));
  }

  const B_BODY = [
    '......kk......',
    '.....krrk.....',
    '....krRRrk....',
    '....krRRrk....',
    '...krrrrrrk...',
    '...kwwwwwwk...',
    '...kwRwwRwk...',
    '...kwwwwwwk...',
    '....kwwwwk....',
    '...kgrrrrgk...',
    '..kggrrrrggk..',
    '..kgggrrgggk..',
    '.kggggrrggggk.',
    '.kwgggrrgggwk.',
    '.kggggrrggggk.',
    'kgggggrrgggggk',
    'kgggggrrgggggk',
    'kgggggrrgggggk',
    'kgggggrrgggggk',
    'kgggggrrgggggk',
    'kgggggrrgggggk'
  ];
  const BF = [
    pair(sprite(B_BODY.concat(['kddgggrrgggddk', 'kddddddddddddk', '.kkkkkkkkkkkk.']))),
    pair(sprite(B_BODY.concat(['kgddggrrggddgk', 'kddddddddddddk', 'kk.kkkkkkkk.kk'])))
  ];
  const FLOWER = sprite([
    '..yyyy..',
    '.yyYYyy.',
    '.yYkkYy.',
    '.yYkkYy.',
    '.yyYYyy.',
    '..yyyy..',
    '...oo...',
    '...oo...'
  ]);
  const HEART_ROWS = ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];
  const HEART = sprite(HEART_ROWS);
  const HEART_EMPTY = tint(HEART, '#3a3a48');
  const VULTURE = [
    sprite(['k........k', '.kk....kk.', '..kkkkkk..', '....kk....']),
    sprite(['..........', '....kk....', '..kkkkkk..', '.kk....kk.', 'k........k'])
  ];

  // ---------------------------------------------------------------- font (3x5)
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
    E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
    I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111101101101', N: '111101101101101', O: '010101101101010', P: '110101110100100',
    Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
    U: '101101101101111', V: '101101101101010', W: '101101101111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111',
    0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
    4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
    8: '111101111101111', 9: '111101111001110',
    '.': '000000000000010', ',': '000000000010100', '!': '010010010000010', '?': '110001010000010',
    ':': '000010000010000', '-': '000000111000000', "'": '010010000000000', '/': '001001010100100',
    '(': '001010010010001', ')': '100010010010100', '+': '000010111010000', '<': '001010100010001',
    '>': '100010001010100'
  };
  function text(str, x, y, color, scale, align) {
    scale = scale || 1;
    str = String(str).toUpperCase();
    const wpx = str.length * 4 * scale - scale;
    if (align === 'center') x = Math.round(x - wpx / 2);
    else if (align === 'right') x = Math.round(x - wpx);
    ctx.fillStyle = color || PAL.w;
    for (let i = 0; i < str.length; i++) {
      const g = FONT[str[i]];
      if (!g) continue;
      for (let p = 0; p < 15; p++) {
        if (g[p] === '1') ctx.fillRect(x + i * 4 * scale + (p % 3) * scale, y + ((p / 3) | 0) * scale, scale, scale);
      }
    }
  }
  const BIG = {
    D: '1111010001100011000111110', E: '1111110000111101000011111',
    M: '1000111011101011000110001', A: '0111010001111111000110001'
  };
  function bigWord(str, cx, y, scale, color) {
    const w = str.length * 6 * scale - scale, x0 = Math.round(cx - w / 2);
    for (const [col, off] of [[PAL.k, scale], [color, 0]]) {
      ctx.fillStyle = col;
      for (let i = 0; i < str.length; i++) {
        const g = BIG[str[i]];
        for (let p = 0; p < 25; p++) if (g[p] === '1') ctx.fillRect(x0 + off + i * 6 * scale + (p % 5) * scale, y + off + ((p / 5) | 0) * scale, scale, scale);
      }
    }
  }
  function say(str, x, y, color, scale, align) {
    scale = scale || 1;
    text(str, x + scale, y + scale, PAL.k, scale, align);
    text(str, x, y, color, scale, align);
  }

  // ---------------------------------------------------------------- audio
  const Snd = {
    ctx: null, master: null, music: null, sfx: null, noise: null, pending: null,
    muted: store.get('dema-muted', '0') === '1',
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.5; this.master.connect(c.destination);
      this.music = c.createGain(); this.music.gain.value = 0.32; this.music.connect(this.master);
      this.sfx = c.createGain(); this.sfx.gain.value = 0.55; this.sfx.connect(this.master);
      const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      if (this.pending) { const p = this.pending; this.pending = null; Music.play(p); }
    },
    tone(type, f0, f1, t, dur, vol, dest) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur + 0.03);
    },
    hiss(t, dur, vol, hp, dest) {
      const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noise;
      f.type = 'highpass'; f.frequency.value = hp;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(dest);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    toggleMute() {
      this.muted = !this.muted;
      store.set('dema-muted', this.muted ? '1' : '0');
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    }
  };

  function sfx(n) {
    const a = Snd;
    if (!a.ctx || a.muted) return;
    const t = a.ctx.currentTime, d = a.sfx;
    switch (n) {
      case 'jump': a.tone('square', 260, 540, t, 0.09, 0.12, d); break;
      case 'collect': a.tone('square', 988, 988, t, 0.05, 0.1, d); a.tone('square', 1319, 1319, t + 0.05, 0.08, 0.1, d); break;
      case 'heal': a.tone('triangle', 659, 659, t, 0.07, 0.3, d); a.tone('triangle', 880, 880, t + 0.07, 0.1, 0.3, d); break;
      case 'hurt': a.tone('square', 220, 70, t, 0.25, 0.15, d); a.hiss(t, 0.15, 0.2, 800, d); break;
      case 'cloak': [523, 659, 784, 1047].forEach((f, i) => a.tone('triangle', f, f, t + i * 0.05, 0.09, 0.32, d)); break;
      case 'nope': a.tone('square', 140, 110, t, 0.12, 0.1, d); break;
      case 'alert': a.tone('square', 880, 880, t, 0.05, 0.09, d); a.tone('square', 660, 660, t + 0.07, 0.06, 0.09, d); break;
      case 'check': a.tone('square', 523, 523, t, 0.07, 0.1, d); a.tone('square', 784, 784, t + 0.08, 0.12, 0.1, d); break;
      case 'crumble': a.hiss(t, 0.22, 0.2, 300, d); break;
      case 'thump': a.tone('sine', 90, 40, t, 0.25, 0.45, d); break;
      case 'die': [440, 370, 311, 262, 196].forEach((f, i) => a.tone('square', f, f * 0.97, t + i * 0.09, 0.1, 0.12, d)); break;
      case 'select': a.tone('square', 660, 990, t, 0.08, 0.1, d); break;
      case 'tick': a.tone('square', 1200, 1200, t, 0.03, 0.06, d); break;
      default: break;
    }
  }

  function noteFreq(n) {
    const m = /^([A-G])(#?)(\d)$/.exec(n);
    if (!m) return 0;
    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
    const midi = (Number(m[3]) + 1) * 12 + base;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  function parseTrack(str) {
    const tok = str.trim().split(/\s+/), out = [];
    for (let i = 0; i < tok.length; i++) {
      const f = noteFreq(tok[i]);
      if (!f) { out.push(null); continue; }
      let d = 1;
      while (tok[i + d] === '-') d++;
      out.push({ f, d });
    }
    return out;
  }
  const bassBar = r => `${r}2 . ${r}3 . ${r}2 . ${r}3 . ${r}2 . ${r}3 . ${r}2 . ${r}3 .`;
  function song(bpm, lead, bass, drums, loop) {
    const s = { bpm, loop: loop !== false, lead: parseTrack(lead), bass: parseTrack(bass), drums: drums ? drums.trim().split(/\s+/) : [] };
    s.len = Math.max(s.lead.length, s.bass.length, s.drums.length);
    return s;
  }
  const DR1 = 'k . h . s . h . k k h . s . h h ';
  const SONGS = {
    title: song(96,
      'A4 . C5 . E5 . D5 C5 B4 - - . G4 - A4 . A4 . C5 . E5 . G5 . F5 - E5 . D5 - - .',
      bassBar('A') + ' ' + bassBar('C'), null),
    dema: song(132,
      'A4 . C5 . E5 . D5 C5 B4 - - . G4 - A4 . A4 . C5 . E5 . G5 . F5 - E5 . D5 - - . ' +
      'F4 . A4 . C5 . F5 - E5 . D5 . C5 . B4 . E4 . G#4 . B4 . E5 - D5 . C5 . B4 - - .',
      [bassBar('A'), bassBar('C'), bassBar('F'), bassBar('E')].join(' '), DR1.repeat(4)),
    wall: song(150,
      'D5 . D5 . F5 . D5 . A5 - G5 . F5 . E5 . D5 . D5 . F5 . A5 . C6 - A5 . G5 - - . ' +
      'A#4 . D5 . F5 . A#5 - A5 . G5 . F5 . D5 . A4 . C#5 . E5 . A5 - G5 . E5 . C#5 - - .',
      [bassBar('D'), bassBar('F'), bassBar('A#'), bassBar('A')].join(' '),
      'k . h k s . h . k . h k s . h s '.repeat(4)),
    trench: song(126,
      'E4 . G4 . B4 . E5 - - . D5 . B4 . A4 . G4 . B4 . D5 . G5 - - . F#5 . D5 . B4 . ' +
      'C5 . E5 . G5 . C6 - - . B5 . G5 . E5 . D5 . F#5 . A5 . B5 - - - - - - . . . .',
      [bassBar('E'), bassBar('G'), bassBar('C'), bassBar('D')].join(' '),
      'k . h . s . h . k . h . s . h k '.repeat(4)),
    clear: song(160, 'C5 E5 G5 C6 - - G5 C6 - - - - . . . .', 'C3 - - - G2 - - - C3 - - - - - . .', null, false),
    win: song(140, 'E5 G#5 B5 E6 - - B5 E6 - - - - . . . . B4 E5 G#5 B5 - - G#5 B5 E6 - - - - - - .',
      'E3 - - - B2 - - - E3 - - - - - . . E3 - - - B2 - - - E3 - - - - - - .', null, false),
    over: song(110, 'A4 . G4 . F4 . E4 - - - - - . . . .', 'A2 - - - G2 - - - F2 - - - E2 - - -', null, false)
  };
  const Music = {
    cur: null, name: null, step: 0, next: 0, timer: null,
    play(name) {
      this.stop();
      this.name = name;
      if (!Snd.ctx) { Snd.pending = name; return; }
      this.cur = SONGS[name];
      this.step = 0;
      this.next = Snd.ctx.currentTime + 0.06;
      this.timer = setInterval(() => this.tick(), 25);
    },
    stop() { if (this.timer) clearInterval(this.timer); this.timer = null; this.cur = null; Snd.pending = null; },
    tick() {
      const s = this.cur, c = Snd.ctx;
      if (!s || !c || c.state !== 'running') return;
      const sd = 60 / s.bpm / 4;
      if (this.next < c.currentTime - 0.2) this.next = c.currentTime + 0.02;
      while (this.next < c.currentTime + 0.12) {
        if (this.step >= s.len) {
          if (s.loop) this.step = 0;
          else { this.stop(); return; }
        }
        const t = this.next, i = this.step, m = Snd.music;
        const L = s.lead[i], B = s.bass[i], D = s.drums[i];
        if (L) Snd.tone('square', L.f, L.f, t, L.d * sd * 0.92, 0.12, m);
        if (B) Snd.tone('triangle', B.f, B.f, t, B.d * sd * 0.9, 0.34, m);
        if (D === 'k' || D === 'x') Snd.tone('sine', 150, 40, t, 0.12, 0.55, m);
        if (D === 's') Snd.hiss(t, 0.12, 0.22, 1500, m);
        if (D === 'h' || D === 'x') Snd.hiss(t, 0.03, 0.09, 7000, m);
        this.next += sd;
        this.step++;
      }
    }
  };

  // ---------------------------------------------------------------- input
  const keys = {}, pressed = {}, pad = {}, touchKeys = {};
  let padPrev = {};
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump', KeyK: 'jump',
    KeyX: 'yellow', ShiftLeft: 'yellow', ShiftRight: 'yellow', KeyJ: 'yellow',
    ArrowDown: 'down', KeyS: 'down', Enter: 'start', NumpadEnter: 'start',
    KeyP: 'pause', Escape: 'pause', KeyM: 'mute'
  };
  window.addEventListener('keydown', e => {
    const a = KEYMAP[e.code];
    if (!a || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    Snd.init();
    if (!keys[a]) pressed[a] = true;
    keys[a] = true;
  });
  window.addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) keys[a] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in touchKeys) touchKeys[k] = false; });

  document.querySelectorAll('#touch .tb').forEach(el => {
    const a = el.dataset.k;
    const on = e => { e.preventDefault(); Snd.init(); if (!touchKeys[a]) pressed[a] = true; touchKeys[a] = true; el.classList.add('on'); };
    const off = e => { e.preventDefault(); touchKeys[a] = false; el.classList.remove('on'); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('contextmenu', e => e.preventDefault());
  });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    Snd.init();
    if (G.state !== 'play' && G.state !== 'dying') pressed.start = true;
  });

  function pollPad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (let i = 0; i < (list ? list.length : 0); i++) if (list[i]) { gp = list[i]; break; }
    const now = {};
    if (gp) {
      const ax = gp.axes[0] || 0;
      const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      now.left = ax < -0.4 || b(14);
      now.right = ax > 0.4 || b(15);
      now.jump = b(0) || b(12);
      now.yellow = b(2) || b(1) || b(5);
      now.start = b(9);
    }
    for (const k of ['left', 'right', 'jump', 'yellow', 'start']) {
      if (now[k] && !padPrev[k]) pressed[k] = true;
      pad[k] = !!now[k];
    }
    padPrev = now;
  }
  const inp = a => !!(keys[a] || pad[a] || touchKeys[a]);

  // ---------------------------------------------------------------- themes & backgrounds
  function makeSky(bands) {
    const c = mk(W, H), x = c.getContext('2d'), bh = Math.ceil(H / bands.length);
    bands.forEach((col, i) => { x.fillStyle = col; x.fillRect(0, i * bh, W, bh); });
    for (let i = 1; i < bands.length; i++) {
      x.fillStyle = bands[i];
      const y0 = i * bh;
      for (let px = 0; px < W; px++) {
        if (px % 2 === 0) x.fillRect(px, y0 - 1, 1, 1);
        if (px % 4 === 0) x.fillRect(px, y0 - 2, 1, 1);
      }
    }
    return c;
  }
  function disc(x, cx, cy, r, col) {
    x.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy));
      x.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }
  function layer(c, cx, cy, factor) {
    const off = -Math.round((cx * factor) % c.width);
    const y = -Math.round(cy * factor * 0.5);
    for (let x = off; x < W; x += c.width) ctx.drawImage(c, x, y);
  }

  function bgDema() {
    const rnd = rng(7);
    const sky = makeSky(['#120f19', '#171420', '#1d1927', '#241f2f', '#2b2436']);
    const far = mk(480, H + 8), fx = far.getContext('2d');
    let px = 0;
    while (px < 470) {
      let w = 14 + (rnd() * 18 | 0); const h = 50 + (rnd() * 80 | 0);
      if (px + w > 480) w = 480 - px;
      fx.fillStyle = '#1f1c2b'; fx.fillRect(px, H + 8 - h, w, h);
      fx.fillStyle = '#34304a';
      for (let wy = H + 12 - h; wy < H; wy += 6) for (let wx = px + 2; wx < px + w - 2; wx += 4) if (rnd() < 0.18) fx.fillRect(wx, wy, 1, 2);
      px += w + (rnd() * 6 | 0);
    }
    const spires = [40, 93, 146, 199, 252, 305, 358, 411, 464];
    for (const sx of spires) {
      const top = 20 + (rnd() * 20 | 0);
      fx.fillStyle = '#1f1c2b'; fx.fillRect(sx, top, 5, H + 8 - top); fx.fillRect(sx - 3, top + 16, 11, 3);
    }
    const mid = mk(640, H + 8), mx = mid.getContext('2d');
    px = 0;
    while (px < 640) {
      let w = 24 + (rnd() * 30 | 0); const h = 30 + (rnd() * 50 | 0);
      if (px + w > 640) w = 640 - px;
      mx.fillStyle = '#15121d'; mx.fillRect(px, H + 8 - h, w, h);
      mx.fillRect(px + 2, H + 6 - h, w - 4, 2);
      if (rnd() < 0.35) mx.fillRect(px + (w >> 1), H - h - 4, 1, 10);
      mx.fillStyle = '#2f2a3e';
      for (let wy = H + 14 - h; wy < H; wy += 7) for (let wx = px + 3; wx < px + w - 3; wx += 5) if (rnd() < 0.12) mx.fillRect(wx, wy, 2, 2);
      px += w;
    }
    return (cx, cy, t) => {
      ctx.drawImage(sky, 0, 0);
      layer(far, cx, cy, 0.15);
      // the nine spires blink red, slowly and out of step
      const off = -Math.round((cx * 0.15) % 480), y = -Math.round(cy * 0.075);
      for (let i = 0; i < spires.length; i++) {
        if (((t + i * 23) % 140) < 90) {
          ctx.fillStyle = '#b81c1c';
          for (let x = off; x < W; x += 480) ctx.fillRect(x + spires[i] + 1, y + 14, 3, 3);
        }
      }
      layer(mid, cx, cy, 0.4);
    };
  }

  function bgWall() {
    const rnd = rng(11);
    const sky = makeSky(['#0b0d15', '#0f121b', '#131725', '#181c2c', '#1d2232']);
    const sx = sky.getContext('2d');
    sx.fillStyle = '#c8c8d8';
    for (let i = 0; i < 45; i++) sx.fillRect(rnd() * W | 0, rnd() * 100 | 0, 1, 1);
    disc(sx, 252, 34, 11, '#d8d6c8');
    disc(sx, 248, 31, 2, '#b8b6a8'); disc(sx, 256, 38, 3, '#b8b6a8'); disc(sx, 255, 28, 1, '#b8b6a8');
    const far = mk(480, H + 8), fx = far.getContext('2d');
    let px = 0;
    while (px < 480) {
      let w = 10 + (rnd() * 14 | 0); const h = 10 + (rnd() * 22 | 0);
      if (px + w > 480) w = 480 - px;
      fx.fillStyle = '#141722'; fx.fillRect(px, H + 8 - h - 40, w, h + 40);
      if (rnd() < 0.2) { fx.fillStyle = '#8c1a1a'; fx.fillRect(px + (w >> 1), H + 8 - h - 42, 1, 2); }
      px += w;
    }
    const mid = mk(640, H + 8), mx = mid.getContext('2d');
    const top = 78;
    mx.fillStyle = '#25221e'; mx.fillRect(0, top, 640, H + 8 - top);
    for (let x = 0; x < 640; x += 32) mx.fillRect(x, top - 10, 16, 10);
    mx.fillStyle = '#1b1916';
    for (let y = top; y < H + 8; y += 12) {
      mx.fillRect(0, y, 640, 1);
      for (let x = ((y / 12) % 2) * 12; x < 640; x += 24) mx.fillRect(x, y, 1, 12);
    }
    return (cx, cy) => {
      ctx.drawImage(sky, 0, 0);
      layer(far, cx, cy, 0.12);
      layer(mid, cx, cy, 0.35);
    };
  }

  function bgTrench() {
    const rnd = rng(23);
    const sky = makeSky(['#16211e', '#1b2a24', '#22342a', '#2e3f2c', '#43502e']);
    const sx = sky.getContext('2d');
    for (let r = 23; r > 19; r--) {
      sx.fillStyle = '#7a7432';
      for (let a = 0; a < 360; a += 4) {
        const x = 236 + Math.round(Math.cos(a * Math.PI / 180) * r), y = 58 + Math.round(Math.sin(a * Math.PI / 180) * r);
        if ((x + y + r) % 2 === 0) sx.fillRect(x, y, 1, 1);
      }
    }
    disc(sx, 236, 58, 18, '#e8c040');
    disc(sx, 236, 58, 13, '#f4d660');
    const far = mk(480, H + 8), fx = far.getContext('2d');
    const hs = [];
    let h = 80;
    for (let i = 0; i < 120; i++) { h = Math.max(55, Math.min(115, h + rnd() * 18 - 9)); hs.push(h); }
    for (let i = 100; i < 120; i++) hs[i] = hs[i] + (hs[0] - hs[i]) * ((i - 100) / 20);
    fx.fillStyle = '#1c2b1a';
    hs.forEach((v, i) => fx.fillRect(i * 4, H + 8 - Math.round(v), 4, Math.round(v)));
    const mid = mk(640, H + 8), mx = mid.getContext('2d');
    mx.fillStyle = '#121c0e';
    let px = 6;
    while (px < 620) {
      const w = 8 + (rnd() * 12 | 0), hh = 50 + (rnd() * 60 | 0);
      for (let y = 0; y < hh; y += 4) {
        const ww = Math.max(2, Math.round(w * Math.min(1, (y + 8) / hh * 1.6)));
        mx.fillRect(px + ((w - ww) >> 1), H + 8 - hh + y, ww, 4);
      }
      px += w + 14 + (rnd() * 40 | 0);
    }
    mx.fillRect(0, H - 14, 640, 22);
    return (cx, cy, t) => {
      ctx.drawImage(sky, 0, 0);
      layer(far, cx, cy, 0.15);
      for (let i = 0; i < 4; i++) {
        const x = ((i * 137 + t * (0.22 + i * 0.03) - cx * 0.05) % (W + 60) + W + 60) % (W + 60) - 30;
        const y = 26 + i * 13 + Math.sin(t * 0.02 + i * 2) * 6;
        ctx.drawImage(VULTURE[((t >> 4) + i) % 2], Math.round(x), Math.round(y));
      }
      layer(mid, cx, cy, 0.4);
    };
  }

  const THEMES = {
    dema: {
      tile: { base: '#3c3a48', light: '#5c5a6c', dark: '#24222e', lip: '#6e6c80' },
      pattern: 'brick', plank: ['#6a6a7a', '#2a2a36'], crumble: '#4a4650',
      spike: ['#a8a8b4', '#5a5a68'], sign: '#8a889c', song: 'dema', bg: bgDema()
    },
    wall: {
      tile: { base: '#57524a', light: '#77705f', dark: '#2f2b26', lip: '#8a8270' },
      pattern: 'brick', plank: ['#7a5a3a', '#3a2a1a'], crumble: '#6e604c',
      spike: ['#b4ac9c', '#5e584c'], sign: '#a49c88', song: 'wall', bg: bgWall()
    },
    trench: {
      tile: { base: '#34442a', light: '#4e6436', dark: '#1a2414', lip: '#7a8a3a' },
      pattern: 'rock', plank: ['#6a5030', '#2e2214'], crumble: '#4a5032',
      spike: ['#c8c4a8', '#6a6650'], sign: '#a8b070', song: 'trench', bg: bgTrench(), grass: true
    }
  };

  // ---------------------------------------------------------------- levels
  const LEVELS = [
    {
      name: 'INSIDE DEMA', theme: 'dema', width: 150,
      intro: 'SLIP PAST THE BISHOPS AND REACH THE GATE.',
      outro: 'YOU SLIPPED THROUGH THE GATE.',
      build(a) {
        a.start(2, 9);
        a.ground(0, 34);
        a.flower(7, 9); a.flower(9, 9);
        a.fill(13, 13, 9, 9); a.fill(16, 18, 8, 9);
        a.flower(17, 6);
        a.bishop(27, 9);
        a.ground(38, 60); a.check(40, 9);
        a.row(43, 46, 7, '-'); a.flower(44, 6); a.flower(45, 6);
        a.bishop(52, 9);
        a.row(57, 58, 9, '^');
        a.fill(64, 66, 8, 11); a.flower(65, 7);
        a.ground(70, 100);
        a.bishop(76, 9); a.bishop(91, 9);
        a.row(79, 86, 7, '-'); a.flower(80, 6); a.flower(82, 6); a.flower(84, 6);
        a.heart(95, 9); a.check(97, 9);
        a.plat(102, 8, 'h', 5);
        a.ground(110, 150);
        a.flower(112, 9); a.flower(113, 9);
        a.row(117, 123, 7, '-'); a.row(127, 133, 6, '-'); a.flower(120, 6); a.flower(130, 5);
        a.bishop(121, 9); a.bishop(126, 9); a.bishop(132, 9);
        a.exit(145, 9);
        a.sign(2, 5, isTouch ? 'USE THE PAD TO MOVE AND JUMP.' : 'ARROWS TO MOVE. Z OR SPACE TO JUMP.');
        a.sign(5, 7, 'YELLOW FLOWERS FILL YOUR METER.');
        a.sign(19, 4, "BISHOPS CAN'T SEE YELLOW.");
        a.sign(19, 5, isTouch ? 'TAP Y TO WEAR IT AND SLIP PAST.' : 'PRESS X TO WEAR IT AND SLIP PAST.');
        a.sign(38, 5, 'FLAGS SAVE YOUR SPOT.');
        a.sign(112, 4, 'THREE BISHOPS GUARD THE GATE.');
      }
    },
    {
      name: 'THE WALL', theme: 'wall', width: 150,
      intro: "CLIMB THE WALL. DON'T LOOK DOWN.",
      outro: "YOU'RE OVER THE WALL.",
      build(a) {
        a.start(2, 9);
        a.ground(0, 12); a.flower(5, 9); a.flower(7, 9);
        a.fill(13, 15, 8, 11); a.fill(16, 18, 6, 11);
        a.row(19, 26, 6, 'c'); a.flower(22, 4);
        a.fill(27, 30, 6, 11); a.flower(27, 5); a.flower(28, 5); a.check(30, 5);
        a.fill(31, 44, 8, 11); a.bishop(35, 7); a.row(41, 42, 7, '^');
        a.fill(48, 50, 7, 11);
        a.row(52, 54, 5, '-'); a.row(56, 58, 3, '-'); a.flower(57, 2);
        a.fill(61, 70, 6, 11); a.check(62, 5);
        a.plat(72, 9, 'v', 5);
        a.fill(76, 90, 4, 11); a.flower(77, 3); a.flower(78, 3);
        a.bishop(83, 3); a.bishop(88, 3);
        a.row(92, 94, 6, 'c');
        a.fill(96, 110, 8, 11); a.heart(100, 7); a.check(102, 7);
        a.ground(111, 130); a.row(114, 116, 9, '^'); a.row(121, 123, 9, '^');
        a.flower(113, 9); a.flower(118, 9); a.flower(119, 9);
        a.bishop(127, 9);
        a.plat(132, 8, 'h', 4);
        a.ground(140, 150); a.flower(143, 9);
        a.exit(146, 9);
        a.sign(17, 3, "CRACKED STONE WON'T HOLD. KEEP MOVING.");
      }
    },
    {
      name: 'TRENCH', theme: 'trench', width: 185, chaser: true,
      intro: 'RUN FOR THE BANDITO CAMP.',
      outro: '',
      build(a) {
        a.start(3, 9);
        a.ground(0, 30); a.flower(8, 9); a.flower(10, 9); a.flower(12, 9);
        a.fill(18, 19, 9, 9); a.flower(19, 7);
        a.ground(34, 60); a.flower(36, 9); a.flower(37, 9);
        a.fill(40, 41, 8, 9); a.flower(40, 6); a.flower(41, 6);
        a.bishop(50, 9);
        a.ground(64, 90); a.check(66, 9);
        a.row(70, 74, 7, '-'); a.flower(71, 6); a.flower(73, 6);
        a.flower(76, 9); a.flower(77, 9);
        a.bishop(81, 9); a.fill(86, 86, 9, 9);
        a.fill(94, 96, 8, 11);
        a.ground(100, 130); a.check(102, 9); a.heart(106, 9);
        a.row(110, 111, 9, '^');
        a.flower(114, 9); a.flower(115, 9);
        a.bishop(119, 9); a.bishop(125, 9);
        a.ground(134, 185); a.check(136, 9); a.flower(140, 9); a.flower(141, 9);
        a.fill(145, 146, 9, 9);
        a.row(150, 154, 7, '-'); a.flower(152, 6);
        a.bishop(160, 9); a.flower(165, 9);
        a.exit(176, 9);
        a.sign(6, 4, 'A BISHOP IS COMING. RUN!');
        a.sign(6, 5, 'WEARING YELLOW STOPS IT COLD.');
      }
    }
  ];

  // ---------------------------------------------------------------- game state
  const G = {
    state: 'title', t: 0, time: 0, level: 0, score: 0, levelScore0: 0, lives: 3, hearts: 3,
    meter: 0, cloak: 0, usedCloak: false, best: Number(store.get('dema-best', '0')) || 0,
    camX: 0, camY: 0, shake: 0, particles: [], flowersTotal: 0, flowersGot: 0, allFlowers: 0,
    god: false
  };

  function buildLevel(n) {
    const L = LEVELS[n], w = L.width;
    const grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Array(w).fill('.'));
    const e = { start: { x: 2, y: 9 }, bishops: [], flowers: [], hearts: [], checks: [], plats: [], signs: [], exit: null };
    const a = {
      fill(x0, x1, y0, y1, ch) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (y >= 0 && y < ROWS && x >= 0 && x < w) grid[y][x] = ch || '#';
      },
      ground(x0, x1, top) { a.fill(x0, x1, top === undefined ? 10 : top, ROWS - 1, '#'); },
      row(x0, x1, y, ch) { a.fill(x0, x1, y, y, ch); },
      start(x, y) { e.start = { x, y }; },
      bishop(x, y) { e.bishops.push({ x, y }); },
      flower(x, y) { e.flowers.push({ x, y }); },
      heart(x, y) { e.hearts.push({ x, y }); },
      check(x, y) { e.checks.push({ x, y }); },
      plat(x, y, kind, range) { e.plats.push({ x, y, kind, range }); },
      exit(x, y) { e.exit = { x, y }; },
      sign(x, y, s) { e.signs.push({ x, y, s }); }
    };
    L.build(a);
    return { grid, e };
  }

  const spawnAt = (x, row) => ({ x: x * T + 4, y: (row + 1) * T - 15 });

  function startLevel(n) {
    const L = LEVELS[n];
    const { grid, e } = buildLevel(n);
    G.level = n; G.L = L; G.theme = THEMES[L.theme]; G.w = L.width; G.grid = grid;
    G.levelScore0 = G.score;
    const s = spawnAt(e.start.x, e.start.y);
    G.p = { x: s.x, y: s.y, w: 8, h: 15, vx: 0, vy: 0, dir: 1, onGround: false, plat: null, coyote: 0, buffer: 0, inv: 0, kb: 0 };
    G.cp = { x: s.x, y: s.y };
    G.bishops = e.bishops.map(b => ({ x: b.x * T + 3, y: (b.y + 1) * T - 22, w: 10, h: 22, dir: -1, alert: 0, mark: 0, anim: (b.x * 7) % 32 }));
    G.flowers = e.flowers.map(f => ({ x: f.x * T + 4, y: f.y * T + 4, taken: false, ph: f.x }));
    G.hearts_ = e.hearts.map(h => ({ x: h.x * T + 4, y: h.y * T + 5, taken: false }));
    G.checks = e.checks.map(c => ({ x: c.x * T, y: (c.y + 1) * T, on: false, sp: spawnAt(c.x, c.y) }));
    G.plats = e.plats.map(p => {
      const x0 = p.x * T, y0 = p.y * T;
      return { x: x0, y: y0, x0, y0, w: 48, h: 6, kind: p.kind, range: p.range * T, t: 0, speed: Math.PI * 2 / 260, dx: 0, dy: 0 };
    });
    G.signs = e.signs;
    G.exit = { x: e.exit.x * T, y: (e.exit.y + 1) * T - 48, w: 32, h: 48 };
    G.chaser = L.chaser ? { x: -90, delay: 150, speed: 1.2, done: false, fade: 1, bob: 0 } : null;
    G.crumbles = new Map();
    G.cloak = 0; G.meter = 0; G.hearts = 3;
    G.flowersTotal = G.flowers.length; G.flowersGot = 0;
    G.particles = [];
    G.time = 0;
    G.camX = 0; G.camY = ROWS * T - H;
    G.tiles = renderTiles();
    setState('intro');
    Music.stop();
  }

  function setState(s) {
    G.state = s; G.t = 0;
    if (document.body.dataset.state !== s) document.body.dataset.state = s;
  }

  function newGame() { G.score = 0; G.lives = 3; G.allFlowers = 0; G.usedCloak = false; startLevel(0); }
  function retryLevel() { G.score = G.levelScore0; G.lives = 3; startLevel(G.level); }

  // ---------------------------------------------------------------- tiles
  function tile(tx, ty) {
    if (tx < 0 || tx >= G.w) return '#';
    if (ty < 0 || ty >= ROWS) return '.';
    return G.grid[ty][tx];
  }
  const solidCh = c => c === '#' || c === 'c';

  function renderTiles() {
    const c = mk(G.w * T, ROWS * T), x = c.getContext('2d'), th = G.theme, t = th.tile, rnd = rng(G.level * 31 + 5);
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < G.w; tx++) {
      const ch = G.grid[ty][tx], px = tx * T, py = ty * T;
      if (ch === '#') {
        x.fillStyle = t.base; x.fillRect(px, py, T, T);
        x.fillStyle = t.dark;
        if (th.pattern === 'brick') {
          x.fillRect(px, py + 7, T, 1); x.fillRect(px, py + 15, T, 1);
          const o = (ty % 2) * 8;
          x.fillRect(px + (o + 3) % 16, py, 1, 7); x.fillRect(px + (o + 11) % 16, py + 8, 1, 7);
        } else {
          const cx = rnd() * 12 | 0;
          x.fillRect(px + cx, py + 4, 3, 1); x.fillRect(px + cx + 2, py + 5, 1, 3);
          x.fillRect(px + (rnd() * 12 | 0), py + 11, 4, 1);
        }
        for (let i = 0; i < 5; i++) {
          x.fillStyle = rnd() < 0.5 ? t.light : t.dark;
          x.fillRect(px + (rnd() * 16 | 0), py + (rnd() * 16 | 0), 1, 1);
        }
        if (!solidCh(tile(tx, ty - 1)) && ty > 0) {
          x.fillStyle = t.lip; x.fillRect(px, py, T, 2);
          x.fillStyle = t.light; x.fillRect(px, py + 2, T, 1);
          if (th.grass) for (let i = 0; i < 4; i++) { x.fillStyle = t.lip; x.fillRect(px + (rnd() * 16 | 0), py - 1, 1, 1); }
        }
        x.fillStyle = t.dark;
        if (tile(tx - 1, ty) !== '#' && tx > 0) x.fillRect(px, py, 1, T);
        if (tile(tx + 1, ty) !== '#' && tx < G.w - 1) x.fillRect(px + T - 1, py, 1, T);
      } else if (ch === '-') {
        x.fillStyle = th.plank[0]; x.fillRect(px, py, T, 4);
        x.fillStyle = th.plank[1]; x.fillRect(px, py + 4, T, 1); x.fillRect(px + (tx % 2 ? 3 : 11), py + 1, 1, 3);
        x.fillStyle = t.lip; x.fillRect(px, py, T, 1);
      } else if (ch === '^') {
        for (let s = 0; s < 2; s++) for (let r = 0; r < 8; r++) {
          const hw = r >> 1;
          x.fillStyle = r < 2 ? th.spike[0] : (r % 3 === 0 ? th.spike[1] : th.spike[0]);
          x.fillRect(px + s * 8 + 3 - hw, py + 8 + r, 2 + hw * 2, 1);
        }
      }
    }
    return c;
  }

  // ---------------------------------------------------------------- physics
  function moveX(e, dx) {
    e.x += dx;
    const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 0.01) / T);
    if (dx > 0) {
      const tx = Math.floor((e.x + e.w - 0.01) / T);
      for (let ty = top; ty <= bot; ty++) if (solidCh(tile(tx, ty))) { e.x = tx * T - e.w; return true; }
    } else if (dx < 0) {
      const tx = Math.floor(e.x / T);
      for (let ty = top; ty <= bot; ty++) if (solidCh(tile(tx, ty))) { e.x = (tx + 1) * T; return true; }
    }
    return false;
  }
  function moveY(e, dy, prevBottom) {
    e.y += dy;
    const l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 0.01) / T);
    if (dy > 0) {
      const ty = Math.floor((e.y + e.h - 0.01) / T);
      for (let tx = l; tx <= r; tx++) {
        const c = tile(tx, ty);
        if (solidCh(c) || (c === '-' && prevBottom <= ty * T + 0.01)) { e.y = ty * T - e.h; e.vy = 0; e.onGround = true; return true; }
      }
    } else if (dy < 0) {
      const ty = Math.floor(e.y / T);
      for (let tx = l; tx <= r; tx++) if (solidCh(tile(tx, ty))) { e.y = (ty + 1) * T; e.vy = 0; return true; }
    }
    return false;
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const PHY = { acc: 0.28, airAcc: 0.22, fric: 0.32, max: 1.9, grav: 0.32, jump: 6.3, maxFall: 6 };

  function updatePlayer() {
    const p = G.p;
    if (p.inv > 0) p.inv--;
    if (G.cloak > 0) {
      G.cloak--;
      if (G.cloak > 0 && G.cloak <= 60 && G.cloak % 15 === 0) sfx('tick');
    }
    if (p.plat) { moveX(p, p.plat.dx); p.y = p.plat.y - p.h; }

    const L = inp('left'), R = inp('right');
    if (p.kb > 0) p.kb--;
    else {
      const acc = p.onGround ? PHY.acc : PHY.airAcc;
      if (L && !R) { p.vx = Math.max(p.vx - acc, -PHY.max); p.dir = -1; }
      else if (R && !L) { p.vx = Math.min(p.vx + acc, PHY.max); p.dir = 1; }
      else if (p.vx > 0) p.vx = Math.max(0, p.vx - PHY.fric);
      else p.vx = Math.min(0, p.vx + PHY.fric);
    }
    if (pressed.jump) p.buffer = 7; else if (p.buffer > 0) p.buffer--;
    if (p.onGround) p.coyote = 6; else if (p.coyote > 0) p.coyote--;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -PHY.jump; p.buffer = 0; p.coyote = 0; p.onGround = false; p.plat = null;
      sfx('jump');
    }
    if (!inp('jump') && p.vy < -2.5 && p.kb <= 0) p.vy = -2.5;
    p.vy = Math.min(p.vy + PHY.grav, PHY.maxFall);
    if (pressed.yellow) tryCloak();

    if (moveX(p, p.vx)) p.vx = 0;
    const prevBottom = p.y + p.h;
    const wasGround = p.onGround;
    p.onGround = false;
    moveY(p, p.vy, prevBottom);
    let onPlat = null;
    if (!p.onGround && p.vy >= 0) {
      for (const pl of G.plats) {
        if (p.x + p.w > pl.x && p.x < pl.x + pl.w && p.y + p.h >= pl.y && prevBottom <= pl.y - pl.dy + 2) {
          p.y = pl.y - p.h; p.vy = 0; p.onGround = true; onPlat = pl; break;
        }
      }
    }
    p.plat = onPlat;
    if (p.onGround && !wasGround && p.vy === 0) dust(p.x + p.w / 2, p.y + p.h);

    // crumbling stone under the feet
    if (p.onGround && !onPlat) {
      const ty = Math.floor((p.y + p.h + 1) / T);
      for (let tx = Math.floor(p.x / T); tx <= Math.floor((p.x + p.w - 0.01) / T); tx++) {
        const k = ty * G.w + tx;
        if (tile(tx, ty) === 'c' && !G.crumbles.has(k)) G.crumbles.set(k, { tx, ty, t: 26, gone: false, back: 0 });
      }
    }
    // spikes
    const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - 0.01) / T);
    const tt = Math.floor(p.y / T), tb = Math.floor((p.y + p.h - 0.01) / T);
    for (let ty = tt; ty <= tb; ty++) for (let tx = l; tx <= r; tx++) {
      if (tile(tx, ty) === '^' && overlap(p, { x: tx * T + 2, y: ty * T + 9, w: 12, h: 7 })) { hurt('spike', -p.dir); return; }
    }
    if (p.y > ROWS * T + 10) hurt('pit');
  }

  function tryCloak() {
    if (G.cloak > 0) return;
    if (G.meter >= 50) {
      G.meter -= 50; G.cloak = 240; G.usedCloak = true;
      sfx('cloak');
      burst(G.p.x + 4, G.p.y + 8, PAL.y, 16, 1.6);
      for (const b of G.bishops) b.alert = 0;
    } else sfx('nope');
  }

  function hurt(kind, dir) {
    if (G.state !== 'play') return;
    if (G.god) { // test mode only: geometry checks without damage
      if (kind === 'pit' || kind === 'chaser') { G.godFalls = (G.godFalls || 0) + 1; respawn(false); }
      return;
    }
    const p = G.p;
    if (kind === 'pit' || kind === 'chaser') {
      G.hearts--; sfx('hurt'); G.shake = 10;
      burst(p.x + 4, Math.min(p.y, ROWS * T - 8), PAL.R, 14, 1.8);
      if (G.hearts <= 0) { die(); return; }
      respawn(false);
      return;
    }
    if (p.inv > 0) return;
    G.hearts--; sfx('hurt'); G.shake = 8;
    p.inv = 90; p.kb = 14; p.vx = 2.2 * (dir || -p.dir); p.vy = -3.6; p.plat = null;
    burst(p.x + 4, p.y + 8, PAL.R, 10, 1.4);
    if (G.hearts <= 0) die();
  }

  function die() {
    G.lives--;
    setState('dying');
    G.dieT = 80;
    G.p.vy = -4;
    Music.stop();
    sfx('die');
  }

  function respawn(full) {
    const p = G.p;
    p.x = G.cp.x; p.y = G.cp.y; p.vx = 0; p.vy = 0; p.plat = null; p.kb = 0; p.inv = 90; p.onGround = false;
    if (full) G.hearts = 3;
    G.cloak = 0;
    for (const b of G.bishops) b.alert = 0;
    for (const [, m] of G.crumbles) if (m.gone) G.grid[m.ty][m.tx] = 'c';
    G.crumbles.clear();
    if (G.chaser && !G.chaser.done) { G.chaser.x = p.x - 230; G.chaser.delay = 120; }
    G.camX = clampCamX(p.x + p.w / 2 - W / 2);
  }

  const clampCamX = v => Math.max(0, Math.min(G.w * T - W, v));

  function updateBishops() {
    const p = G.p;
    for (const b of G.bishops) {
      b.anim++;
      if (b.mark > 0) b.mark--;
      const dx = (p.x + p.w / 2) - (b.x + b.w / 2), dy = (p.y + p.h / 2) - (b.y + b.h / 2);
      const sees = G.cloak <= 0 && Math.abs(dx) < 112 && Math.abs(dy) < 36 && Math.sign(dx) === b.dir;
      if (sees) { if (b.alert <= 0) { sfx('alert'); b.mark = 45; } b.alert = 70; }
      else if (b.alert > 0) b.alert--;
      let speed = 0.45;
      if (b.alert > 0) { speed = 1.1; if (Math.abs(dx) > 4) b.dir = Math.sign(dx); }
      const ax = b.dir > 0 ? b.x + b.w + 1 : b.x - 1;
      const below = tile(Math.floor(ax / T), Math.floor((b.y + b.h + 1) / T));
      if (!(solidCh(below) || below === '-')) { if (b.alert > 0) speed = 0; else b.dir *= -1; }
      if (speed > 0 && moveX(b, b.dir * speed) && b.alert <= 0) b.dir *= -1;
      if (G.cloak <= 0 && overlap(p, b)) hurt('touch', Math.sign(dx) || 1);
      if (G.state !== 'play') return;
    }
  }

  function updateChaser() {
    const c = G.chaser;
    if (!c) return;
    c.bob = Math.sin(G.time * 0.08) * 3;
    if (c.done) { c.fade = Math.max(0, c.fade - 0.02); return; }
    if (G.p.x > G.exit.x - 90) { c.done = true; return; }
    if (c.delay > 0) { c.delay--; return; }
    if (G.cloak <= 0) c.x += c.speed;
    c.x = Math.max(c.x, G.camX - 200);
    const onScreen = c.x + 42 > G.camX && c.x < G.camX + W;
    if (onScreen && G.time % 45 === 0) { sfx('thump'); G.shake = Math.max(G.shake, 3); }
    if (G.cloak <= 0 && G.p.x + G.p.w > c.x + 10 && G.p.x < c.x + 34 && G.p.y + G.p.h > 84) hurt('chaser');
  }

  function updateCrumbles() {
    for (const [k, m] of G.crumbles) {
      if (!m.gone) {
        if (--m.t <= 0) {
          m.gone = true; m.back = 200; G.grid[m.ty][m.tx] = '.';
          sfx('crumble');
          for (let i = 0; i < 6; i++) G.particles.push({ x: m.tx * T + Math.random() * 16, y: m.ty * T + Math.random() * 8, vx: Math.random() - 0.5, vy: Math.random(), g: 0.25, life: 50, col: G.theme.crumble, s: 3 });
        }
      } else if (--m.back <= 0) {
        if (!overlap(G.p, { x: m.tx * T, y: m.ty * T, w: T, h: T })) { G.grid[m.ty][m.tx] = 'c'; G.crumbles.delete(k); } else m.back = 10;
      }
    }
  }

  function updatePickups() {
    const p = G.p;
    for (const f of G.flowers) {
      if (!f.taken && overlap(p, { x: f.x - 1, y: f.y - 1, w: 10, h: 10 })) {
        f.taken = true; G.flowersGot++; G.allFlowers++;
        G.meter = Math.min(100, G.meter + 25); G.score += 100;
        sfx('collect'); burst(f.x + 4, f.y + 4, PAL.y, 8, 1.2);
      }
    }
    for (const h of G.hearts_) {
      if (!h.taken && overlap(p, { x: h.x, y: h.y, w: 8, h: 7 })) {
        h.taken = true;
        if (G.hearts < 3) { G.hearts++; sfx('heal'); } else { G.score += 250; sfx('collect'); }
        burst(h.x + 3, h.y + 3, PAL.R, 8, 1.2);
      }
    }
    for (const c of G.checks) {
      if (!c.on && overlap(p, { x: c.x, y: c.y - 32, w: 16, h: 32 })) {
        for (const o of G.checks) if (o.x <= c.x) o.on = true;
        G.cp = { x: c.sp.x, y: c.sp.y };
        sfx('check'); burst(c.x + 9, c.y - 22, PAL.y, 10, 1.2);
      }
    }
    if (overlap(p, { x: G.exit.x + 8, y: G.exit.y + 10, w: 16, h: 38 })) levelClear();
  }

  function levelClear() {
    G.score += 1000;
    if (G.flowersGot === G.flowersTotal) G.score += 500;
    setState('clear');
    Music.play(G.level === LEVELS.length - 1 ? 'win' : 'clear');
    burst(G.p.x + 4, G.p.y + 4, PAL.y, 24, 2);
  }

  function nextLevel() {
    if (G.level < LEVELS.length - 1) startLevel(G.level + 1);
    else {
      if (G.score > G.best) { G.best = G.score; store.set('dema-best', String(G.best)); }
      setState('win');
    }
  }

  function dust(x, y) {
    for (let i = 0; i < 4; i++) G.particles.push({ x, y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.6, g: 0.02, life: 16, col: '#8e8e9e', s: 1 });
  }
  function burst(x, y, col, n, spd) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (0.4 + Math.random()) * spd;
      G.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, g: 0.06, life: 26 + (Math.random() * 14 | 0), col, s: Math.random() < 0.3 ? 2 : 1 });
    }
  }
  function updateParticles() {
    const ps = G.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.x += q.vx; q.y += q.vy; q.vy += q.g;
      if (--q.life <= 0) ps.splice(i, 1);
    }
  }

  function updateCamera(snap) {
    const p = G.p;
    const tx = clampCamX(p.x + p.w / 2 - W / 2 + p.dir * 24);
    const ty = Math.max(0, Math.min(ROWS * T - H, p.y + p.h / 2 - H * 0.55));
    if (snap) { G.camX = tx; G.camY = ty; return; }
    G.camX += (tx - G.camX) * 0.12;
    G.camY += (ty - G.camY) * 0.15;
  }

  function updatePlay() {
    G.time++;
    for (const pl of G.plats) {
      pl.t++;
      const ph = (1 - Math.cos(pl.t * pl.speed)) / 2;
      const nx = pl.kind === 'h' ? pl.x0 + ph * pl.range : pl.x0;
      const ny = pl.kind === 'v' ? pl.y0 - ph * pl.range : pl.y0;
      pl.dx = nx - pl.x; pl.dy = ny - pl.y; pl.x = nx; pl.y = ny;
    }
    updatePlayer();
    if (G.state !== 'play') return;
    updateBishops();
    if (G.state !== 'play') return;
    updateChaser();
    if (G.state !== 'play') return;
    updateCrumbles();
    updatePickups();
    updateParticles();
    updateCamera(false);
    if (G.shake > 0) G.shake--;
  }

  function update() {
    pollPad();
    if (pressed.mute) Snd.toggleMute();
    G.t++;
    switch (G.state) {
      case 'title':
        G.time++;
        if (Snd.ctx && !Music.cur && !Music.timer && Music.name !== 'title') Music.play('title');
        if (pressed.start || pressed.jump) { sfx('select'); setState('story'); }
        break;
      case 'story':
        if ((pressed.start || pressed.jump) && G.t > 20) { sfx('select'); newGame(); }
        break;
      case 'intro':
        if (G.t > 160 || ((pressed.start || pressed.jump) && G.t > 30)) {
          setState('play'); updateCamera(true); Music.play(G.theme.song);
        }
        break;
      case 'play':
        if (pressed.pause || pressed.start) { setState('paused'); Music.stop(); sfx('select'); break; }
        updatePlay();
        break;
      case 'paused':
        if (pressed.pause || pressed.start || pressed.jump) { setState('play'); Music.play(G.theme.song); }
        break;
      case 'dying':
        G.p.y += G.p.vy; G.p.vy = Math.min(G.p.vy + 0.25, 5);
        updateParticles();
        if (--G.dieT <= 0) {
          if (G.lives < 0) { setState('gameover'); Music.play('over'); }
          else { respawn(true); setState('play'); updateCamera(true); Music.play(G.theme.song); }
        }
        break;
      case 'clear':
        G.time++;
        updateParticles();
        if (G.chaser) G.chaser.fade = Math.max(0, G.chaser.fade - 0.03);
        if (G.t > 60 && (pressed.start || pressed.jump)) nextLevel();
        break;
      case 'gameover':
        if (G.t > 40 && (pressed.start || pressed.jump)) retryLevel();
        break;
      case 'win':
        G.time++;
        if (G.t > 90 && (pressed.start || pressed.jump)) { setState('title'); Music.play('title'); }
        break;
      default: break;
    }
    for (const k in pressed) delete pressed[k];
  }

  // ---------------------------------------------------------------- drawing
  function drawSprite(frames, dir, x, y) { ctx.drawImage(frames[dir < 0 ? 1 : 0], Math.round(x), Math.round(y)); }

  function drawPlayer(ox, oy) {
    const p = G.p;
    if (G.state === 'play' && p.inv > 0 && (G.time >> 2) % 2 && G.cloak <= 0) return;
    let k = 'idle';
    if (!p.onGround) k = 'jump';
    else if (Math.abs(p.vx) > 0.3) k = (G.time >> 3) % 2 ? 'run1' : 'run2';
    const x = p.x - 2 + ox, y = p.y - 1 + oy;
    if (G.cloak > 0 && (G.cloak > 60 || (G.cloak >> 2) % 2)) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawSprite(PFY[k], p.dir, x + dx, y + dy);
      ctx.globalAlpha = 0.75;
      drawSprite(PF[k], p.dir, x, y);
      ctx.globalAlpha = 1;
    } else drawSprite(PF[k], p.dir, x, y);
  }

  function drawExit(ox, oy, t) {
    const e = G.exit, x = Math.round(e.x + ox), y = Math.round(e.y + oy);
    if (G.theme === THEMES.trench) {
      // the bandito camp: a fire, a yellow flag and the torchbearer
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x + 8, y + 44, 16, 3); ctx.fillRect(x + 10, y + 42, 12, 2);
      for (let i = 0; i < 7; i++) {
        const fh = 6 + ((Math.sin(t * 0.3 + i * 1.7) + 1) * 4 | 0);
        ctx.fillStyle = i % 3 === 0 ? PAL.R : (i % 3 === 1 ? PAL.f : PAL.y);
        ctx.fillRect(x + 10 + i * 2, y + 42 - fh, 2, fh);
      }
      ctx.globalAlpha = 0.12 + Math.sin(t * 0.2) * 0.03; disc(ctx, x + 16, y + 38, 22, PAL.y); ctx.globalAlpha = 1;
      ctx.fillStyle = '#3a3428'; ctx.fillRect(x + 40, y - 8, 2, 56);
      ctx.fillStyle = PAL.y; for (let r = 0; r < 8; r++) ctx.fillRect(x + 42, y - 8 + r, 12 + (((t >> 3) + r) % 3) - 1, 1);
      const fig = (fx, torch) => {
        ctx.fillStyle = '#14140f'; ctx.fillRect(fx, y + 34, 6, 13); ctx.fillRect(fx + 1, y + 29, 4, 5);
        ctx.fillStyle = PAL.y; ctx.fillRect(fx, y + 38, 6, 1); ctx.fillRect(fx + 1, y + 41, 1, 4);
        if (torch) {
          ctx.fillStyle = '#5a4020'; ctx.fillRect(fx + 6, y + 26, 1, 12);
          ctx.fillStyle = (t >> 2) % 2 ? PAL.y : PAL.f; ctx.fillRect(fx + 5, y + 22, 3, 4);
          ctx.fillStyle = PAL.R; ctx.fillRect(fx + 6, y + 20 - ((t >> 3) % 2), 1, 2);
        }
      };
      fig(x - 6, false); fig(x + 28, true); fig(x - 16, false);
      return;
    }
    ctx.fillStyle = '#16141c'; ctx.fillRect(x - 2, y - 2, 36, 50);
    ctx.fillStyle = '#2c2a36'; ctx.fillRect(x, y, 32, 48);
    const glow = 0.55 + Math.sin(t * 0.08) * 0.2;
    ctx.globalAlpha = glow; ctx.fillStyle = '#f0e8c8'; ctx.fillRect(x + 4, y + 6, 24, 42);
    ctx.globalAlpha = glow * 0.6; ctx.fillStyle = '#fff8d8'; ctx.fillRect(x + 8, y + 10, 16, 38);
    ctx.globalAlpha = 1;
    for (let i = 0; i < 30; i++) {
      const a = x + 1 + i, b1 = y + 8 + Math.round(i * 1.2), b2 = y + 44 - Math.round(i * 1.2);
      ctx.fillStyle = (i >> 2) % 2 ? PAL.y : PAL.k;
      ctx.fillRect(a, b1, 1, 3); ctx.fillRect(a, b2, 1, 3);
    }
  }

  function drawWorld() {
    const th = G.theme, t = G.time;
    let sx = 0, sy = 0;
    if (G.shake > 0) { sx = (Math.random() * 4 - 2) | 0; sy = (Math.random() * 4 - 2) | 0; }
    const cx = Math.round(G.camX), cy = Math.round(G.camY);
    th.bg(cx, cy, t);
    ctx.drawImage(G.tiles, cx, cy, W, H, sx, sy, W, H);
    const ox = -cx + sx, oy = -cy + sy;
    for (const s of G.signs) text(s.s, s.x * T + ox, s.y * T + oy, th.sign, 1);
    // crumbling stone
    const tx0 = Math.max(0, Math.floor(cx / T) - 1), tx1 = Math.min(G.w - 1, tx0 + 22);
    for (let ty = 0; ty < ROWS; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      if (G.grid[ty][tx] !== 'c') continue;
      const m = G.crumbles.get(ty * G.w + tx);
      const j = m && !m.gone ? ((t >> 1) % 2 ? 1 : -1) : 0;
      const px = tx * T + ox + j, py = ty * T + oy;
      ctx.fillStyle = th.crumble; ctx.fillRect(px, py, T, T);
      ctx.fillStyle = th.tile.lip; ctx.fillRect(px, py, T, 2);
      ctx.fillStyle = th.tile.dark;
      ctx.fillRect(px + 3, py + 3, 1, 5); ctx.fillRect(px + 4, py + 7, 4, 1); ctx.fillRect(px + 8, py + 8, 1, 5);
      ctx.fillRect(px + 11, py + 4, 3, 1); ctx.fillRect(px + 12, py + 5, 1, 4); ctx.fillRect(px, py + 15, T, 1);
    }
    for (const c of G.checks) {
      const x = c.x + ox, y = c.y + oy;
      ctx.fillStyle = '#6a6a78'; ctx.fillRect(x + 7, y - 26, 2, 26);
      ctx.fillStyle = c.on ? PAL.y : '#5c5a6c';
      for (let r = 0; r < 6; r++) ctx.fillRect(x + 9, y - 26 + r, 7 + (c.on ? (((t >> 3) + r) % 3) - 1 : 0), 1);
    }
    drawExit(ox, oy, t);
    for (const f of G.flowers) if (!f.taken) ctx.drawImage(FLOWER, Math.round(f.x + ox), Math.round(f.y + oy + Math.sin(t * 0.08 + f.ph) * 1.5));
    for (const h of G.hearts_) if (!h.taken) ctx.drawImage(HEART, Math.round(h.x + ox), Math.round(h.y + oy + Math.sin(t * 0.1) * 1.5));
    for (const pl of G.plats) {
      const x = Math.round(pl.x + ox), y = Math.round(pl.y + oy);
      ctx.fillStyle = th.plank[0]; ctx.fillRect(x, y, pl.w, 5);
      ctx.fillStyle = th.tile.lip; ctx.fillRect(x, y, pl.w, 1);
      ctx.fillStyle = th.plank[1]; ctx.fillRect(x, y + 5, pl.w, 1);
      for (let i = 4; i < pl.w; i += 10) ctx.fillRect(x + i, y + 2, 2, 2);
      ctx.fillStyle = PAL.y; ctx.fillRect(x, y + 6, 3, 1); ctx.fillRect(x + pl.w - 3, y + 6, 3, 1);
    }
    for (const b of G.bishops) {
      const x = b.x - 2 + ox, y = b.y - 2 + oy;
      if (x < -20 || x > W + 4) continue;
      if (G.cloak <= 0) {
        ctx.globalAlpha = b.alert > 0 ? 0.16 : 0.07;
        ctx.fillStyle = PAL.R;
        const ex = b.dir > 0 ? x + 11 : x + 3, ey = y + 7;
        for (let i = 0; i < 110; i += 2) { const hh = 1 + (i / 5 | 0); ctx.fillRect(ex + b.dir * i, ey - (hh >> 1), 2, Math.min(hh, 24)); }
        ctx.globalAlpha = 1;
      }
      drawSprite(BF[(b.anim >> 4) & 1], b.dir, x, y);
      if (b.alert > 0 && G.cloak <= 0) say('!', x + 6, y - 9, PAL.R, 1);
      else if (G.cloak > 0 && Math.abs(G.p.x - b.x) < 110 && (t >> 5) % 2) say('?', x + 6, y - 9, PAL.l, 1);
    }
    const c = G.chaser;
    if (c && c.fade > 0) {
      const x = Math.round(c.x + ox), y = Math.round(160 - 72 + c.bob + oy);
      ctx.globalAlpha = 0.18 * c.fade; disc(ctx, x + 21, y + 34, 34, PAL.r);
      ctx.globalAlpha = c.fade;
      ctx.drawImage(BF[(t >> 4) & 1][0], x, y, 42, 72);
      ctx.globalAlpha = 1;
      if (G.cloak > 0 && !c.done) say('?', x + 19, y - 8, PAL.l, 1);
      if (!c.done && c.x + 42 < G.camX && (t >> 3) % 2) say('<!', 3, 90, PAL.R, 2);
    }
    if (G.state !== 'dying') drawPlayer(ox, oy);
    else { const p = G.p; if ((G.dieT >> 2) % 2) drawSprite(PF.jump, p.dir, p.x - 2 + ox, p.y - 1 + oy); }
    for (const q of G.particles) { ctx.fillStyle = q.col; ctx.fillRect(Math.round(q.x + ox), Math.round(q.y + oy), q.s, q.s); }
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(11,11,16,0.7)'; ctx.fillRect(0, 0, W, 13);
    for (let i = 0; i < 3; i++) ctx.drawImage(i < G.hearts ? HEART : HEART_EMPTY, 3 + i * 9, 3);
    say('X' + Math.max(0, G.lives), 33, 4, PAL.l, 1);
    ctx.drawImage(FLOWER, 50, 2);
    const bx = 61, by = 4, bw = 50;
    ctx.fillStyle = '#2a2a36'; ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
    ctx.fillStyle = '#14141c'; ctx.fillRect(bx, by, bw, 5);
    if (G.cloak > 0) {
      ctx.fillStyle = (G.cloak > 60 || (G.cloak >> 2) % 2) ? '#fff2a8' : PAL.y;
      ctx.fillRect(bx, by, Math.round(bw * G.cloak / 240), 5);
    } else {
      ctx.fillStyle = G.meter >= 50 ? PAL.y : PAL.Y;
      ctx.fillRect(bx, by, Math.round(bw * G.meter / 100), 5);
    }
    ctx.fillStyle = '#6a6a78'; ctx.fillRect(bx + bw / 2, by, 1, 5);
    say(G.flowersGot + '/' + G.flowersTotal, 116, 4, PAL.y, 1);
    say('SCORE ' + String(G.score).padStart(6, '0'), W - 3, 4, PAL.w, 1, 'right');
    if (G.cloak > 0) say('HIDDEN IN YELLOW', W / 2, 17, PAL.y, 1, 'center');
    else if (G.level === 0 && !G.usedCloak && G.meter >= 50 && (G.time >> 4) % 2)
      say(isTouch ? 'TAP Y TO WEAR YELLOW' : 'PRESS X TO WEAR YELLOW', W / 2, 17, PAL.y, 1, 'center');
  }

  function dim(a) { ctx.fillStyle = `rgba(11,11,16,${a})`; ctx.fillRect(0, 0, W, H); }
  const GO = isTouch ? 'TAP TO CONTINUE' : 'PRESS ENTER';

  function drawTitle() {
    G.theme = THEMES.dema;
    THEMES.dema.bg(G.time * 0.6, 0, G.time);
    ctx.fillStyle = '#0d0c12'; ctx.fillRect(0, 150, W, 30);
    ctx.fillStyle = '#3c3a48'; ctx.fillRect(0, 150, W, 2);
    for (let i = 0; i < 9; i++) drawSprite(BF[((G.time >> 4) + i) & 1], i < 4 ? 1 : -1, 14 + i * 34 + (i > 3 ? 14 : 0), 127);
    const k = (G.time >> 3) % 2 ? 'run1' : 'run2';
    drawSprite(PF[k], 1, 154, 134);
    dim(0.35);
    say('ESCAPE FROM', W / 2, 26, PAL.l, 2, 'center');
    bigWord('DEMA', W / 2, 44, 5, PAL.y);
    say('AN UNOFFICIAL 8-BIT FAN GAME', W / 2, 80, PAL.w, 1, 'center');
    if ((G.time >> 5) % 2 === 0) say(isTouch ? 'TAP TO START' : 'PRESS ENTER TO START', W / 2, 98, PAL.y, 1, 'center');
    if (G.best > 0) say('BEST ' + G.best, W / 2, 110, PAL.l, 1, 'center');
    say('NOT AFFILIATED WITH TWENTY ONE PILOTS.', W / 2, 168, '#77768a', 1, 'center');
    if (!isTouch) say('M: SOUND ' + (Snd.muted ? 'OFF' : 'ON'), W - 4, 4, '#77768a', 1, 'right');
  }

  function drawStory() {
    ctx.fillStyle = PAL.k; ctx.fillRect(0, 0, W, H);
    const lines = [
      ['YOU GREW UP INSIDE DEMA,', PAL.w],
      ['A WALLED CITY RUN BY NINE BISHOPS.', PAL.w],
      ['', PAL.w],
      ['PAST THE WALL LIES TRENCH, WHERE', PAL.w],
      ['THE BANDITOS KEEP A FIRE BURNING.', PAL.w],
      ['', PAL.w],
      ['THE BISHOPS CANNOT SEE YELLOW.', PAL.y],
      ['GATHER IT. WEAR IT. GET OUT.', PAL.y]
    ];
    const shown = Math.min(lines.length, (G.t / 14 | 0) + 1);
    for (let i = 0; i < shown; i++) say(lines[i][0], W / 2, 20 + i * 15, lines[i][1], 2, 'center');
    const ctl = isTouch ? 'PAD: MOVE + JUMP   Y: WEAR YELLOW' : 'ARROWS: MOVE   Z: JUMP   X: WEAR YELLOW   P: PAUSE';
    say(ctl, W / 2, 148, PAL.l, 1, 'center');
    if (G.t > 20 && (G.t >> 5) % 2 === 0) say(GO, W / 2, 162, PAL.y, 1, 'center');
  }

  function drawIntro() {
    ctx.fillStyle = PAL.k; ctx.fillRect(0, 0, W, H);
    say('LEVEL ' + (G.level + 1), W / 2, 50, PAL.l, 2, 'center');
    say(G.L.name, W / 2, 68, PAL.y, 4, 'center');
    say(G.L.intro, W / 2, 104, PAL.w, 1, 'center');
    for (let i = 0; i < 3; i++) ctx.drawImage(i < G.hearts ? HEART : HEART_EMPTY, W / 2 - 30 + i * 9, 126);
    say('X' + G.lives, W / 2 + 2, 127, PAL.l, 1);
  }

  function drawCard(title, lines, color) {
    const bh = 30 + lines.length * 12;
    const y0 = Math.round(H / 2 - bh / 2);
    ctx.fillStyle = 'rgba(11,11,16,0.85)'; ctx.fillRect(20, y0, W - 40, bh);
    ctx.fillStyle = color; ctx.fillRect(20, y0, W - 40, 1); ctx.fillRect(20, y0 + bh - 1, W - 40, 1);
    say(title, W / 2, y0 + 8, color, 2, 'center');
    lines.forEach((l, i) => say(l[0], W / 2, y0 + 26 + i * 12, l[1] || PAL.w, 1, 'center'));
  }

  function drawWin() {
    THEMES.trench.bg(900, 0, G.time);
    ctx.fillStyle = THEMES.trench.tile.base; ctx.fillRect(0, 150, W, 30);
    ctx.fillStyle = THEMES.trench.tile.lip; ctx.fillRect(0, 150, W, 2);
    const save = G.exit;
    G.exit = { x: 150, y: 150 - 48, w: 32, h: 48 };
    G.theme = THEMES.trench;
    drawExit(0, 0, G.time);
    G.exit = save;
    drawSprite(PF.idle, 1, 130, 135);
    dim(0.3);
    say('YOU MADE IT TO TRENCH.', W / 2, 18, PAL.y, 2, 'center');
    say('THE BANDITOS PULL YOU INTO THE FIRELIGHT.', W / 2, 38, PAL.w, 1, 'center');
    say('SCORE ' + G.score, W / 2, 56, PAL.w, 2, 'center');
    say('BEST ' + G.best + '   FLOWERS ' + G.allFlowers, W / 2, 74, PAL.l, 1, 'center');
    if (G.t > 90 && (G.t >> 5) % 2 === 0) say(isTouch ? 'TAP TO PLAY AGAIN' : 'PRESS ENTER TO PLAY AGAIN', W / 2, 90, PAL.y, 1, 'center');
  }

  function render() {
    ctx.fillStyle = PAL.k; ctx.fillRect(0, 0, W, H);
    switch (G.state) {
      case 'title': drawTitle(); break;
      case 'story': drawStory(); break;
      case 'intro': drawIntro(); break;
      case 'win': drawWin(); break;
      default:
        drawWorld();
        drawHUD();
        if (G.state === 'paused') {
          dim(0.5);
          say('PAUSED', W / 2, 70, PAL.y, 3, 'center');
          say(isTouch ? 'TAP TO RESUME' : 'PRESS P TO RESUME', W / 2, 96, PAL.w, 1, 'center');
          say('SOUND ' + (Snd.muted ? 'OFF' : 'ON') + (isTouch ? '' : ' (M)'), W / 2, 108, PAL.l, 1, 'center');
        } else if (G.state === 'clear' && G.t > 30) {
          if (G.level < LEVELS.length - 1) {
            drawCard('LEVEL CLEAR', [[G.L.outro], ['FLOWERS ' + G.flowersGot + '/' + G.flowersTotal, PAL.y], ['SCORE ' + G.score], [G.t > 60 ? GO : '', PAL.l]], PAL.y);
          } else drawCard('FREE', [['THE BISHOP CAN\'T FOLLOW YOU HERE.'], ['SCORE ' + G.score], [G.t > 60 ? GO : '', PAL.l]], PAL.y);
        } else if (G.state === 'gameover') {
          dim(0.4);
          drawCard('CAUGHT', [['THE BISHOPS DRAGGED YOU BACK.'], [isTouch ? 'TAP TO TRY THIS LEVEL AGAIN' : 'PRESS ENTER TO TRY THIS LEVEL AGAIN', PAL.l]], PAL.R);
        }
    }
  }

  // ---------------------------------------------------------------- loop
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (G.state === 'play') { setState('paused'); Music.stop(); }
      if (Snd.ctx) Snd.ctx.suspend();
    } else if (Snd.ctx) Snd.ctx.resume();
  });

  const STEP = 1000 / 60;
  let last = performance.now(), acc = 0;
  function frame(now) {
    acc += Math.min(250, now - last);
    last = now;
    while (acc >= STEP) { update(); acc -= STEP; }
    render();
    requestAnimationFrame(frame);
  }
  Music.play('title');
  if (TEST) {
    window.__dema = { G, keys, pressed, update, render, startLevel, newGame, LEVELS, tile };
  }
  requestAnimationFrame(frame);
})();
