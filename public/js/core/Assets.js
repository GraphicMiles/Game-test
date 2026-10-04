import * as THREE from 'three';
import { GLTFLoader } from '../../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from '../../vendor/three/examples/jsm/loaders/RGBELoader.js';

const TEX_DIR = './assets/textures/';

/** Which ambientCG maps each material set ships with. */
const SETS = {
  wood_siding:  { color: 0.78, normal: 1.0, rough: 0.86,  tint: null },
  wood_painted: { color: 0.72, normal: 0.85, rough: 0.72, tint: null },
  wood_deck:    { color: 0.80, normal: 0.9,  rough: 0.88, tint: null },
  ground_dirt:  { color: 0.74, normal: 1.15, rough: 0.97, tint: null },
  ground_sand:  { color: 0.82, normal: 0.95, rough: 0.98, tint: null },
  ground_scrub: { color: 0.76, normal: 1.05, rough: 0.96, tint: null },
  rock_mesa:    { color: 0.68, normal: 1.30, rough: 0.94, tint: null },
  roof_metal:   { color: 0.62, normal: 1.10, rough: 0.58, metal: 0.35 },
  brick:        { color: 0.70, normal: 1.15, rough: 0.90, tint: null },
  plaster:      { color: 0.80, normal: 0.80, rough: 0.85, tint: null },
};

export class Assets {
  constructor(renderer) {
    this.renderer = renderer;
    this.loader = new THREE.TextureLoader();
    this.gltf = new GLTFLoader();
    this.rgbe = new RGBELoader();
    this.textures = {};
    this.materials = {};
    this.models = {};
    this.envMaps = {};
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  // ---------------------------------------------------------------- loading
  async load(onProgress) {
    const jobs = [];
    // --- PBR texture sets
    for (const name of Object.keys(SETS)) {
      jobs.push(['texture', name]);
    }
    // --- HDRI skies
    jobs.push(['hdr', 'day', './assets/hdri/sweetwater_day.hdr']);
    jobs.push(['hdr', 'dusk', './assets/hdri/sweetwater_dusk.hdr']);
    // --- GLB models
    jobs.push(['glb', 'horse', './assets/models/horse.glb']);
    jobs.push(['glb', 'bird', './assets/models/stork.glb']);

    let done = 0;
    const bump = (label) => { done++; onProgress?.(done / jobs.length, label); };

    await Promise.all(jobs.map(async ([kind, key, url]) => {
      try {
        if (kind === 'texture') {
          const cfg = SETS[key];
          const maps = {};
          const files = { color: `${key}_color.jpg`, normal: `${key}_normal.jpg`, ao: `${key}_ao.jpg` };
          await Promise.all(Object.entries(files).map(async ([slot, f]) => {
            try { maps[slot] = await this._tex(TEX_DIR + f); } catch (e) { /* optional map */ }
          }));
          this.textures[key] = maps;
          bump(`${key} textures`);
        } else if (kind === 'hdr') {
          const t = await this.rgbe.loadAsync(url);
          t.mapping = THREE.EquirectangularReflectionMapping;
          const env = this.pmrem.fromEquirectangular(t).texture;
          this.envMaps[key] = { equirect: t, pmrem: env };
          t.dispose();
          bump(`${key} sky`);
        } else if (kind === 'glb') {
          const g = await this.gltf.loadAsync(url);
          this.models[key] = g;
          bump(`${key} model`);
        }
      } catch (err) {
        console.warn('[assets] missing', key, err.message);
        bump(`${key} (skipped)`);
      }
    }));
  }

  _tex(url) {
    return new Promise((res, rej) => {
      this.loader.load(url, (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = Math.min(8, this.maxAniso);
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        if (!url.includes('normal')) t.colorSpace = THREE.SRGBColorSpace;
        res(t);
      }, undefined, () => rej(new Error(url)));
    });
  }

  // -------------------------------------------------------------- materials
  /**
   * Get (and cache) a standard material.
   * @param {string} set    key of SETS
   * @param {object} o      { repeat:[x,y], color:0x.., rough, metal, ao, side, transparent, vertexColors, emissive }
   */
  mat(set, o = {}) {
    const key = set + '|' + JSON.stringify(o);
    if (this.materials[key]) return this.materials[key];

    const cfg = SETS[set] || SETS.wood_siding;
    const maps = this.textures[set] || {};
    const clone = (t) => (t ? t.clone() : null);

    const map = clone(maps.color);
    const nrm = clone(maps.normal);
    const ao  = clone(maps.ao);
    const rep = o.repeat || [1, 1];
    for (const t of [map, nrm, ao]) if (t) {
      t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep[0], rep[1]);
    }

    const m = new THREE.MeshStandardMaterial({
      map: map || null,
      normalMap: nrm || null,
      aoMap: ao || null,
      color: new THREE.Color(o.color !== undefined ? o.color : 0xffffff).multiplyScalar(cfg.color),
      roughness: o.rough !== undefined ? o.rough : cfg.rough,
      metalness: o.metal !== undefined ? o.metal : (cfg.metal || 0.0),
      envMapIntensity: o.env !== undefined ? o.env : 0.75,
      side: o.side || THREE.FrontSide,
      flatShading: !!o.flat,
      vertexColors: !!o.vertexColors,
      transparent: !!o.transparent,
      opacity: o.opacity !== undefined ? o.opacity : 1,
      depthWrite: o.depthWrite !== undefined ? o.depthWrite : true,
      emissive: new THREE.Color(o.emissive || 0x000000),
      emissiveIntensity: o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1,
    });
    if (nrm) m.normalScale.set(cfg.normal, cfg.normal);
    if (ao) m.aoMapIntensity = o.aoIntensity !== undefined ? o.aoIntensity : 1.0;
    m.userData.set = set;
    this.materials[key] = m;
    return m;
  }

  /** Cheap shared material with no textures (paint, glass, metal trim). */
  plain(color, o = {}) {
    const key = 'plain|' + color + '|' + JSON.stringify(o);
    if (this.materials[key]) return this.materials[key];
    const m = new THREE.MeshStandardMaterial({
      color, roughness: o.rough !== undefined ? o.rough : 0.8,
      metalness: o.metal || 0, envMapIntensity: o.env !== undefined ? o.env : 0.6,
      side: o.side || THREE.FrontSide, flatShading: !!o.flat,
      transparent: !!o.transparent, opacity: o.opacity !== undefined ? o.opacity : 1,
      emissive: new THREE.Color(o.emissive || 0x000000),
      emissiveIntensity: o.emissiveIntensity !== undefined ? o.emissiveIntensity : 1,
      vertexColors: !!o.vertexColors,
    });
    this.materials[key] = m;
    return m;
  }

  /** Physically-plausible glass with a touch of grime. */
  glass(tint = 0xbcd2dd, opacity = 0.24) {
    const key = 'glass|' + tint + '|' + opacity;
    if (this.materials[key]) return this.materials[key];
    const m = new THREE.MeshPhysicalMaterial({
      color: tint, roughness: 0.08, metalness: 0.0, transmission: 0.0,
      transparent: true, opacity, envMapIntensity: 2.2,
      side: THREE.DoubleSide, depthWrite: false,
    });
    this.materials[key] = m;
    return m;
  }

  // ------------------------------------------------------------ sign canvas
  /**
   * Painted wooden shop sign, procedurally drawn and weathered.
   */
  sign(text, o = {}) {
    const {
      w = 1024, h = 256, bg = '#2a1c11', fg = '#e8d9b8', accent = '#c8963c',
      font = 'Georgia, "Times New Roman", serif', style = 'board', sub = '',
    } = o;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    // base wood
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, shade(bg, 1.18)); grd.addColorStop(0.5, bg); grd.addColorStop(1, shade(bg, 0.78));
    g.fillStyle = grd; g.fillRect(0, 0, w, h);

    // plank seams
    const planks = Math.max(2, Math.round(h / 56));
    for (let i = 1; i < planks; i++) {
      const y = (h / planks) * i;
      g.fillStyle = 'rgba(0,0,0,.42)'; g.fillRect(0, y, w, 2);
      g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y + 2, w, 1);
    }
    // grain
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * h;
      g.strokeStyle = `rgba(${Math.random() > .5 ? '255,255,255' : '0,0,0'},${0.02 + Math.random() * 0.05})`;
      g.lineWidth = 0.6 + Math.random() * 1.6;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.013 + i) * 3.4);
      g.stroke();
    }
    // knots
    for (let i = 0; i < 3; i++) {
      const kx = Math.random() * w, ky = Math.random() * h, kr = 5 + Math.random() * 9;
      for (let r = kr; r > 0; r -= 1.6) {
        g.strokeStyle = `rgba(0,0,0,${0.05 + (kr - r) / kr * 0.16})`;
        g.lineWidth = 1.2; g.beginPath(); g.ellipse(kx, ky, r, r * 0.62, 0.5, 0, 7); g.stroke();
      }
    }

    if (style === 'board') {
      g.strokeStyle = accent; g.lineWidth = 5; g.globalAlpha = 0.8;
      g.strokeRect(15, 15, w - 30, h - 30);
      g.globalAlpha = 1;
    }

    // text
    const pad = 46;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = h * (sub ? 0.40 : 0.52);
    g.font = `700 ${size}px ${font}`;
    while (g.measureText(text).width > w - pad * 2 && size > 14) {
      size -= 1.5; g.font = `700 ${size}px ${font}`;
    }
    const cy = h * (sub ? 0.44 : 0.52);
    g.fillStyle = 'rgba(0,0,0,.62)'; g.fillText(text, w / 2 + 3, cy + 4);
    g.fillStyle = fg; g.fillText(text, w / 2, cy);

    if (sub) {
      g.font = `400 ${h * 0.16}px ${font}`;
      g.fillStyle = accent;
      g.fillText(sub, w / 2, h * 0.79);
      g.fillStyle = 'rgba(0,0,0,.4)';
      g.fillRect(w * 0.28, h * 0.70, w * 0.44, 1);
    }

    // weathering: dust, chips, sun-bleach
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 1 + Math.random() * 5;
      g.fillStyle = `rgba(${Math.random() > .6 ? '210,190,150' : '20,12,6'},${Math.random() * 0.20})`;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    const fade = g.createLinearGradient(0, 0, w, h);
    fade.addColorStop(0, 'rgba(190,170,130,.10)');
    fade.addColorStop(0.5, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(20,12,6,.30)');
    g.fillStyle = fade; g.fillRect(0, 0, w, h);

    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.maxAniso);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  /** Paper poster: wanted / bounty / showbill (for walls & the post office). */
  poster(kind = 'wanted') {
    const W = 512, H = 720;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#d9c79c'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${120 + Math.random() * 90 | 0},${95 + Math.random() * 70 | 0},${55 + Math.random() * 50 | 0},${Math.random() * .12})`;
      g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 22, 2 + Math.random() * 22);
    }
    g.strokeStyle = '#3a2a18'; g.lineWidth = 5; g.strokeRect(16, 16, W - 32, H - 32);
    g.textAlign = 'center';
    g.fillStyle = '#2b1d10';

    if (kind === 'wanted') {
      g.font = '700 84px Georgia, serif';
      g.fillText('WANTED', W / 2, 96);
      g.font = '400 30px Georgia, serif';
      g.fillText('DEAD OR ALIVE', W / 2, 140);
      g.fillStyle = '#b8a071'; g.fillRect(96, 168, W - 192, 300);
      g.strokeStyle = '#3a2a18'; g.lineWidth = 3; g.strokeRect(96, 168, W - 192, 300);
      // crude woodcut portrait
      g.fillStyle = '#3a2a18';
      g.beginPath(); g.ellipse(W / 2, 330, 78, 96, 0, 0, 7); g.fill();
      g.fillStyle = '#d9c79c';
      g.beginPath(); g.ellipse(W / 2 - 30, 305, 15, 11, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(W / 2 + 30, 305, 15, 11, 0, 0, 7); g.fill();
      g.fillStyle = '#3a2a18';
      g.beginPath(); g.ellipse(W / 2, 372, 34, 13, 0, 0, 7); g.fill();
      g.font = '700 46px Georgia, serif';
      g.fillText('THE MAN', W / 2, 520);
      g.font = '700 40px Georgia, serif';
      g.fillText('IN BLACK', W / 2, 570);
      g.font = '400 30px Georgia, serif';
      g.fillText('REWARD  $5,000', W / 2, 632);
    } else if (kind === 'showbill') {
      g.font = '700 58px Georgia, serif'; g.fillText('MARIPOSA', W / 2, 92);
      g.font = '400 30px Georgia, serif'; g.fillText('SALOON', W / 2, 132);
      g.fillStyle = '#3a2a18'; g.fillRect(70, 158, W - 140, 2);
      g.font = '700 40px Georgia, serif'; g.fillText('TONIGHT', W / 2, 210);
      g.font = '700 46px Georgia, serif'; g.fillText('LA BELLE', W / 2, 280);
      g.font = '400 34px Georgia, serif'; g.fillText('& HER DANCERS', W / 2, 326);
      g.font = '400 28px Georgia, serif'; g.fillText('FARO  ·  POKER  ·  RYE', W / 2, 400);
      g.fillStyle = '#3a2a18'; g.fillRect(70, 432, W - 140, 2);
      g.font = '400 26px Georgia, serif'; g.fillText('Admission 25¢', W / 2, 480);
      g.font = 'italic 30px Georgia, serif'; g.fillText('Sweetwater', W / 2, 560);
      g.font = '400 22px Georgia, serif'; g.fillText('Delos Destinations', W / 2, 600);
    } else {
      g.font = '700 54px Georgia, serif'; g.fillText('DELOS', W / 2, 110);
      g.font = '400 26px Georgia, serif'; g.fillText('DESTINATIONS', W / 2, 152);
      g.font = 'italic 32px Georgia, serif'; g.fillText('“Live without limits”', W / 2, 260);
      g.strokeStyle = '#3a2a18'; g.lineWidth = 2;
      g.beginPath(); g.arc(W / 2, 420, 110, 0, 7); g.stroke();
      g.beginPath(); g.arc(W / 2, 420, 92, 0, 7); g.stroke();
      g.font = '700 66px Georgia, serif'; g.fillText('W', W / 2, 442);
      g.font = '400 24px Georgia, serif'; g.fillText('SWEETWATER · EST 1887', W / 2, 590);
    }

    // grime + torn edges
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(${60 + Math.random() * 60 | 0},${45 + Math.random() * 40 | 0},${30 + Math.random() * 30 | 0},${Math.random() * .22})`;
      g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 9, 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, this.maxAniso);
    return t;
  }
}

function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return '#' + c.getHexString();
}
