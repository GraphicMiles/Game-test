import * as THREE from 'three';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(opts = {}) {
    this.el = {
      hud: $('hud'), cross: $('cross'), compass: $('compass'), strip: $('cstrip'),
      place: $('place'), placeName: $('placename'), placeSub: $('placesub'),
      prompt: $('prompt'), toast: $('toast'), stats: $('stats'),
      clock: $('clock'), clockSub: $('clocksub'), flash: $('flash'),
      menu: $('menu'), loader: $('loader'),
      pSettings: $('pSettings'), pControls: $('pControls'), pPause: $('pPause'), pMap: $('pMap'),
      mapcv: $('mapcv'), maphint: $('maphint'),
    };
    this.places = [];
    this.pois = [];
    this.onStart = opts.onStart || (() => {});
    this.onSetting = opts.onSetting || (() => {});
    this.onResume = opts.onResume || (() => {});
    this.onRestart = opts.onRestart || (() => {});
    this.onTravel = opts.onTravel || (() => {});
    this._toastT = 0;
    this._placeT = 0;
    this._current = null;
    this._buildCompass();
    this._wire();
  }

  /* ----------------------------------------------------------- compass */
  _buildCompass() {
    const strip = this.el.strip;
    this.W = 560;
    const CARD = { 0: 'S', 45: 'SW', 90: 'W', 135: 'NW', 180: 'N', 225: 'NE', 270: 'E', 315: 'SE' };
    for (let a = 0; a < 360; a += 15) {
      const d = document.createElement('div');
      d.className = 'ctick';
      d.dataset.a = a;
      strip.appendChild(d);
      if (CARD[a] !== undefined) {
        const l = document.createElement('div');
        l.className = 'clab';
        l.textContent = CARD[a];
        l.dataset.a = a;
        strip.appendChild(l);
      }
    }
    this.ticks = [...strip.querySelectorAll('.ctick')];
    this.labs = [...strip.querySelectorAll('.clab')];
  }

  setPOIs(places) {
    this.places = places;
    const strip = this.el.strip;
    for (const p of this.pois) p.el.remove();
    this.pois = [];
    for (const pl of places) {
      const el = document.createElement('div');
      el.className = 'cpoi';
      el.textContent = '•';
      el.title = pl.name;
      strip.appendChild(el);
      this.pois.push({ el, place: pl });
    }
  }

  updateCompass(camera, fovDeg) {
    // camera yaw: 0 = looking down -Z (north)
    let yaw = camera.rotation.y;
    const W = this.W;
    const half = THREE.MathUtils.degToRad(fovDeg || 75) * (W / (W * 0.62)) * 0.5;
    const scale = (W / 2) / (Math.PI * 0.62);

    const place = (el, ang) => {
      let d = ang - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      const x = W / 2 + d * (W / 2) / (Math.PI * 0.56);
      if (Math.abs(d) > Math.PI * 0.56) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.left = x + 'px';
    };
    for (const t of this.ticks) place(t, THREE.MathUtils.degToRad(+t.dataset.a) + Math.PI);
    for (const l of this.labs) place(l, THREE.MathUtils.degToRad(+l.dataset.a) + Math.PI);
    for (const p of this.pois) {
      const ang = Math.atan2(p.place.pos.x - camera.position.x, -(p.place.pos.z - camera.position.z));
      place(p.el, ang);
    }
  }

  /* -------------------------------------------------------------- misc */
  setClock(text, mood) { this.el.clock.textContent = text; this.el.clockSub.textContent = mood; }

  toast(msg, dur = 2.6) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('on');
    this._toastT = dur;
  }

  showPlace(name, sub) {
    if (this._current === name) return;
    this._current = name;
    this.el.placeName.textContent = name;
    this.el.placeSub.textContent = sub || '';
    this.el.place.classList.add('show');
    this._placeT = 3.4;
  }

  prompt(text, key) {
    if (!text) { this.el.prompt.classList.remove('on'); return; }
    this.el.prompt.innerHTML = (key ? `<kbd>${key}</kbd>` : '') + text;
    this.el.prompt.classList.add('on');
  }

  setStats(on) { this.el.stats.classList.toggle('on', !!on); }
  setStatsText(s) { this.el.stats.textContent = s; }
  flash(a = 0.5) { this.el.flash.style.opacity = a; setTimeout(() => { this.el.flash.style.opacity = 0; }, 60); }

  showHud(on) { this.el.hud.classList.toggle('on', !!on); }
  hideLoader() {
    this.el.loader.classList.add('gone');
    setTimeout(() => { this.el.loader.style.display = 'none'; }, 800);
  }
  loading(pct, text) {
    document.getElementById('barf').style.width = Math.round(pct * 100) + '%';
    if (text) document.getElementById('ltext').textContent = text;
  }

  openMenu(on) { this.el.menu.classList.toggle('on', !!on); }
  openPanel(name) {
    for (const k of ['pSettings', 'pControls', 'pPause', 'pMap']) {
      this.el[k].classList.toggle('on', k === name);
    }
    this._panel = name || null;
    if (name === 'pMap') this._drawMap();
  }
  get panel() { return this._panel; }

  /* -------------------------------------------------------------- map */
  _drawMap() {
    const cv = this.el.mapcv, dpr = Math.min(devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    // world: x -80..80, z -125..105  -> fit
    const X0 = -85, X1 = 85, Z0 = 130, Z1 = -125;   // z flipped so north is up
    const sx = w / (X1 - X0), sz = h / (Z0 - Z1);
    const px = (x) => (x - X0) * sx;
    const pz = (z) => (Z0 - z) * sz;

    // ground
    g.fillStyle = '#171009'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(216,178,106,.10)'; g.lineWidth = 1;
    for (let i = 0; i <= 16; i++) {
      g.beginPath(); g.moveTo((w / 16) * i, 0); g.lineTo((w / 16) * i, h); g.stroke();
      g.beginPath(); g.moveTo(0, (h / 16) * i); g.lineTo(w, (h / 16) * i); g.stroke();
    }
    // main street
    g.fillStyle = 'rgba(216,178,106,.13)';
    g.fillRect(px(-9), pz(100), 18 * sx, Math.abs(pz(-80) - pz(100)));
    g.fillStyle = 'rgba(216,178,106,.10)';
    g.fillRect(px(-60), pz(7.5), 130 * sx, 15 * sz);
    // railroad
    g.strokeStyle = 'rgba(216,178,106,.45)'; g.lineWidth = 1.6;
    g.setLineDash([6, 4]);
    g.beginPath(); g.moveTo(0, pz(97)); g.lineTo(w, pz(97)); g.stroke();
    g.setLineDash([]);

    // buildings
    g.font = '8px ui-sans-serif, system-ui, sans-serif';
    g.textAlign = 'center';
    for (const p of this.places) {
      const b = p.building;
      if (!b) {
        g.fillStyle = 'rgba(216,178,106,.9)';
        g.beginPath(); g.arc(px(p.pos.x), pz(p.pos.z), 3, 0, 7); g.fill();
        continue;
      }
      const [x, z, w2, d2] = b;
      g.fillStyle = 'rgba(216,178,106,.22)';
      g.strokeStyle = 'rgba(216,178,106,.55)'; g.lineWidth = 1;
      g.fillRect(px(x - w2 / 2), pz(z + d2 / 2), w2 * sx, d2 * sz);
      g.strokeRect(px(x - w2 / 2), pz(z + d2 / 2), w2 * sx, d2 * sz);
      g.fillStyle = 'rgba(232,217,184,.85)';
      const label = (p.name || '').split(' ')[0].toUpperCase().slice(0, 12);
      g.fillText(label, px(x), pz(z) + 2);
    }
    // player
    if (this.playerPos) {
      const pxp = px(this.playerPos.x), pzp = pz(this.playerPos.z);
      g.save();
      g.translate(pxp, pzp); g.rotate(-(this.playerYaw || 0));
      g.fillStyle = '#d8b26a';
      g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill();
      g.restore();
    }
    // compass rose
    g.fillStyle = 'rgba(216,178,106,.75)';
    g.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
    g.fillText('N', w - 16, 16);
    this._mapTransform = { px, pz, X0, Z0, sx, sz };
  }

  /* ------------------------------------------------------------ wiring */
  _wire() {
    $('bStart').onclick = () => this.onStart();
    $('bSettings').onclick = () => this.openPanel('pSettings');
    $('bControls').onclick = () => this.openPanel('pControls');
    $('sClose').onclick = () => this.openPanel(this._wasPaused ? 'pPause' : null);
    $('cClose').onclick = () => this.openPanel(this._wasPaused ? 'pPause' : null);
    $('pResume').onclick = () => this.onResume();
    $('pSet2').onclick = () => { this._wasPaused = true; this.openPanel('pSettings'); };
    $('pCtrl2').onclick = () => { this._wasPaused = true; this.openPanel('pControls'); };
    $('pRestart').onclick = () => this.onRestart();
    $('mClose').onclick = () => { this.openPanel(null); this.onResume(); };

    const seg = (id, key, fn) => {
      const wrap = $(id);
      wrap.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          wrap.querySelectorAll('button').forEach((o) => o.classList.remove('on'));
          b.classList.add('on');
          fn(b.dataset.v);
        };
      });
    };
    seg('sQual', 'quality', (v) => this.onSetting('quality', v));

    const rng = (id, key, fn, fmt) => {
      const el = $(id), out = $(id + 'V');
      el.oninput = () => {
        const v = +el.value;
        if (out) out.textContent = fmt ? fmt(v) : v;
        fn(v);
      };
    };
    rng('sScale', 'scale', (v) => this.onSetting('scale', v / 100), (v) => v + '%');
    rng('sFov', 'fov', (v) => this.onSetting('fov', v));
    rng('sSens', 'sens', (v) => this.onSetting('sens', v / 100));
    rng('sSpeed', 'speed', (v) => this.onSetting('speed', v), (v) => (v === 0 ? 'Static' : (v / 20).toFixed(1) + '×'));
    rng('sVol', 'vol', (v) => this.onSetting('volume', v / 100));
    rng('sBob', 'bob', (v) => this.onSetting('bob', v / 100), (v) => v + '%');
    $('sInv').onchange = (e) => this.onSetting('invertY', e.target.checked);
    $('sFps').onchange = (e) => this.onSetting('fps', e.target.checked);
    $('sTime').onchange = (e) => {
      const [h, m] = e.target.value.split(':').map(Number);
      this.onSetting('time', h + m / 60);
    };

    // map click -> fast travel
    this.el.mapcv.addEventListener('click', (e) => {
      if (!this._mapTransform) return;
      const r = this.el.mapcv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const T = this._mapTransform;
      const wx = T.X0 + x / T.sx;
      const wz = T.Z0 - y / T.sz;
      this.onTravel(wx, wz);
    });
  }

  syncSettings(s) {
    $('sQual').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === s.quality));
    $('sScale').value = Math.round(s.scale * 100); $('sScaleV').textContent = Math.round(s.scale * 100) + '%';
    $('sFov').value = s.fov; $('sFovV').textContent = s.fov;
    $('sSens').value = Math.round(s.sens * 100); $('sSensV').textContent = Math.round(s.sens * 100);
    $('sVol').value = Math.round(s.volume * 100); $('sVolV').textContent = Math.round(s.volume * 100);
    $('sBob').value = Math.round(s.bob * 100); $('sBobV').textContent = Math.round(s.bob * 100);
    $('sSpeed').value = s.speed * 20; $('sSpeedV').textContent = s.speed === 0 ? 'Static' : s.speed.toFixed(2) + '×';
    $('sInv').checked = !!s.invertY;
    $('sFps').checked = !!s.fps;
    const hh = Math.floor(s.time), mm = Math.round((s.time - hh) * 60);
    $('sTime').value = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  tick(dt) {
    if (this._toastT > 0) {
      this._toastT -= dt;
      if (this._toastT <= 0) this.el.toast.classList.remove('on');
    }
    if (this._placeT > 0) {
      this._placeT -= dt;
      if (this._placeT <= 0) { this.el.place.classList.remove('show'); this._current = null; }
    }
  }
}
