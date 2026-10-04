import * as THREE from 'three';
import { makeBuilding } from './Buildings.js';

export const MARIPOSA_CONFIG = Object.freeze({
  z: 12, w: 19, d: 15, h: 7.2,
  name: 'The Mariposa Saloon', sub: 'Faro · Poker · Rye',
  facade: 0x914735, interior: 'saloon', roof: 'gable', roofTint: 0x66574b,
  parapet: 2.7, chimney: { x: 6.5, z: -5 },
  upper: { y: 3.4, windows: 4, stairX: -6.4, stairZ: -4.2,
    door: { x: 0, w: 1.9, h: 2.4, y: 3.48 } },
  sign: { text: 'MARIPOSA', sub: 'SALOON', bg: '#3a1f14', fg: '#f0dcae', accent: '#d8a13c', width: 11.5, ratio: 0.20, y: 7.9 },
  door: { batwing: true, w: 1.7, h: 2.4 },
  porch: { w: 18.8, h: 5.75, depth: 3.6, posts: 8,
    postXs: [-9, -6, -2.8, -1.35, 1.35, 2.8, 6, 9], rail: true, stepW: 3.0 },
  windows: 3, winW: 1.2, winH: 1.9, winY: 1.35, showbill: true,
});

/**
 * Mariposa-only treatment: a real upper-floor doorway, covered gallery,
 * restrained false-front trim, and colliders for the exposed edges.  The
 * shared building kit remains the source of its shell, interior, stairs,
 * porch, doors and windows; no other Sweetwater building uses these details.
 */
export function makeMariposa(B, A, ctx, cfg) {
  const upper = cfg.upper || { y: 3.4 };
  const buildCfg = {
    ...cfg,
    facade: cfg.facade ?? 0x914735,
    roofTint: cfg.roofTint ?? 0x66574b,
    upper: {
      ...upper,
      windows: 4,
      door: {
        ...(upper.door || {}),
        x: upper.door?.x ?? 0,
        w: upper.door?.w ?? 1.9,
        h: upper.door?.h ?? 2.4,
        y: upper.door?.y ?? upper.y + 0.08,
      },
    },
    blade: cfg.blade || { text: 'SALOON', y: 5.30, z: 0.42 },
  };

  // The shared box-sign UVs are world-scaled; use a Mariposa-specific flat
  // sign below so its lettering remains legible on the wide false front.
  makeBuilding(B, A, ctx, { ...buildCfg, sign: null });
  B.save();
  B.translate(buildCfg.x || 0, 0, buildCfg.z || 0);
  B.rotateY(buildCfg.rot || 0);
  addMariposaFacade(B, A, ctx, buildCfg);
  B.restore();
  return buildCfg;
}

function addMariposaFacade(B, A, ctx, cfg) {
  const M = ctx.M;
  const trim = M.trim || (M.trim = A.mat('wood_siding', { vertexColors: true, rough: 0.78 }));
  const beam = M.beam || (M.beam = A.mat('wood_siding', { vertexColors: true, rough: 0.88 }));
  const deck = M.deckMat || (M.deckMat = A.mat('wood_deck', { vertexColors: true, rough: 0.87 }));
  const metal = M.mariposaMetal || (M.mariposaMetal = A.mat('roof_metal', { vertexColors: true, rough: 0.58, metal: 0.36 }));
  const dark = M.dark || (M.dark = A.plain(0x241c14, { rough: 0.9 }));
  const w = cfg.w, h = cfg.h || 7.2, d = cfg.d, hw = w / 2, hd = d / 2;
  const upper = cfg.upper;
  const sy = upper.y;
  const deckTop = sy + 0.08;
  const porch = cfg.porch || {};

  // Strong, quiet belt course at the upper floor line: it ties the gallery to
  // the false front without obscuring the storefront windows or the doorway.
  B.box({ w: w + 0.18, h: 0.13, d: 0.25, x: 0, y: sy + 0.02, z: hd + 0.13,
    mat: trim, uv: 1.5, tint: 0x68422f, collide: false });
  B.box({ w: w + 0.04, h: 0.07, d: 0.28, x: 0, y: sy + 0.14, z: hd + 0.13,
    mat: trim, uv: 1.8, tint: 0xc19a5a, collide: false });

  addMariposaSign(B, A, ctx, { sign: cfg.sign, hd, beam, trim, metal });
  addUpperBalcony(B, { w, hd, sy, deckTop, trim, beam, deck, metal });
  addUpperDoor(B, A, ctx, { upper, hd, trim, beam, metal, dark });
  addLanterns(B, A, ctx, { hd, trim, metal, dark });
  addFalseFrontAccents(B, { w, h, hd, trim, metal });

  // The existing porch has visual end rails.  Mirror those rails in collision
  // so a player cannot step through the porch's open sides and fall off.
  if (porch.rail !== false) {
    const pw = porch.w || w;
    const depth = porch.depth || 2.6;
    const railLen = Math.max(0.6, depth - 0.7);
    const railZ = hd + depth / 2 + 0.01;
    const railX = pw / 2 - 0.14;
    for (const side of [-1, 1]) {
      B.collideBox({ w: 0.16, h: 1.02, d: railLen, x: side * railX, y: 0.93, z: railZ });
    }
  }
}

function addMariposaSign(B, A, ctx, o) {
  const { sign, hd, beam, trim, metal } = o;
  if (!sign) return;
  const width = sign.width || 11.5;
  const height = width * (sign.ratio || 0.20);
  const y = sign.y !== undefined ? sign.y : 7.9;
  const z = hd + 0.18;
  const wood = ctx.M.mariposaSignWood || (ctx.M.mariposaSignWood = A.mat('wood_siding', { vertexColors: true, rough: 0.78 }));
  const texture = A.sign(sign.text || 'MARIPOSA', {
    w: sign.w || 1024, h: sign.h || 224, sub: sign.sub || 'SALOON',
    bg: sign.bg || '#3a1f14', fg: sign.fg || '#f0dcae',
    accent: sign.accent || '#d8a13c', style: sign.style || 'board', font: sign.font,
  });
  const face = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.86, metalness: 0, side: THREE.DoubleSide });
  ctx.signs = ctx.signs || [];
  ctx.signs.push(face);

  // A thin, framed fascia with an unscaled 0..1 label UV keeps the title crisp;
  // the shared kit's world-scaled box UVs are better for wood than typography.
  B.box({ w: width + 0.34, h: height + 0.28, d: 0.14, x: 0, y, z,
    mat: wood, uv: 1.2, tint: 0x563423, collide: false });
  const front = z + 0.078;
  const rail = 0.07;
  for (const side of [-1, 1]) {
    B.box({ w: rail, h: height + 0.14, d: 0.035, x: side * (width / 2 + 0.08), y, z: front,
      mat: metal, uv: 1.4, tint: 0xb38a4d, collide: false });
  }
  for (const side of [-1, 1]) {
    B.box({ w: width + 0.16, h: rail, d: 0.035, x: 0, y: y + side * (height / 2 + 0.08), z: front,
      mat: metal, uv: 1.4, tint: 0xb38a4d, collide: false });
  }
  B.quad({ w: width, h: height, x: 0, y, z: front + 0.006, uvScale: [1, 1], mat: face, collide: false });
}

function addUpperBalcony(B, o) {
  const { w, hd, sy, deckTop, trim, beam, deck, metal } = o;
  const balconyW = w - 2.0;
  const balconyD = 1.85;
  const balconyZ = hd + balconyD / 2;
  const outerZ = hd + balconyD - 0.08;
  const railH = 1.08;
  const railCY = deckTop + railH / 2;
  const outerThickness = 0.14;
  const sideX = balconyW / 2 - 0.07;

  // Walkable gallery deck meets the second-storey slab exactly.
  B.box({ w: balconyW, h: 0.16, d: balconyD, x: 0, y: sy, z: balconyZ,
    mat: deck, uv: 0.72, tint: 0x846744, collide: false });
  B.collideBox({ w: balconyW, h: 0.16, d: balconyD, x: 0, y: sy, z: balconyZ });
  B.box({ w: balconyW, h: 0.20, d: 0.13, x: 0, y: sy - 0.08, z: outerZ,
    mat: beam, uv: 1.4, tint: 0x5f402d, collide: false });

  // Heavy lower/top rails and closely spaced balusters read as a proper
  // Western gallery.  The continuous hidden AABBs keep the player on it.
  B.box({ w: balconyW, h: 0.12, d: outerThickness, x: 0, y: deckTop + 0.20, z: outerZ,
    mat: trim, uv: 1.7, tint: 0x725237, collide: false });
  B.box({ w: balconyW + 0.08, h: 0.16, d: 0.20, x: 0, y: deckTop + railH - 0.02, z: outerZ,
    mat: beam, uv: 1.8, tint: 0x563b2a, collide: false });
  B.collideBox({ w: balconyW, h: railH, d: outerThickness, x: 0, y: railCY, z: outerZ });

  const frontPosts = Math.ceil(balconyW / 1.9);
  for (let i = 0; i <= frontPosts; i++) {
    const x = -balconyW / 2 + (i / frontPosts) * balconyW;
    B.box({ w: 0.13, h: railH - 0.06, d: 0.14, x, y: railCY, z: outerZ,
      mat: beam, uv: 1.4, tint: 0x64472f, collide: false });
    B.box({ w: 0.19, h: 0.10, d: 0.19, x, y: deckTop + railH - 0.06, z: outerZ,
      mat: trim, uv: 1.8, tint: 0xc09a5f, collide: false });
  }
  const pickets = Math.ceil(balconyW / 0.56);
  for (let i = 0; i <= pickets; i++) {
    const x = -balconyW / 2 + (i / pickets) * balconyW;
    B.box({ w: 0.055, h: 0.72, d: 0.065, x, y: deckTop + 0.59, z: outerZ,
      mat: trim, uv: 2, tint: 0x98754a, collide: false });
  }

  // Return rails and their colliders close the two exposed gallery ends while
  // leaving the central upper doorway completely clear.
  for (const side of [-1, 1]) {
    B.box({ w: 0.13, h: 0.12, d: balconyD - 0.16, x: side * sideX, y: deckTop + 0.20, z: balconyZ,
      mat: trim, uv: 1.6, tint: 0x725237, collide: false });
    B.box({ w: 0.18, h: 0.16, d: balconyD - 0.10, x: side * sideX, y: deckTop + railH - 0.02, z: balconyZ,
      mat: beam, uv: 1.6, tint: 0x563b2a, collide: false });
    B.collideBox({ w: 0.14, h: railH, d: balconyD - 0.08, x: side * sideX, y: railCY, z: balconyZ });
    const sidePosts = 3;
    for (let i = 0; i <= sidePosts; i++) {
      const z = hd + 0.08 + (i / sidePosts) * (balconyD - 0.16);
      B.box({ w: 0.13, h: railH - 0.06, d: 0.13, x: side * sideX, y: railCY, z,
        mat: beam, uv: 1.4, tint: 0x64472f, collide: false });
      B.box({ w: 0.19, h: 0.10, d: 0.19, x: side * sideX, y: deckTop + railH - 0.06, z,
        mat: trim, uv: 1.8, tint: 0xc09a5f, collide: false });
    }
    for (let i = 0; i < 5; i++) {
      const z = hd + 0.16 + (i / 4) * (balconyD - 0.32);
      B.box({ w: 0.065, h: 0.72, d: 0.055, x: side * sideX, y: deckTop + 0.59, z,
        mat: trim, uv: 2, tint: 0x98754a, collide: false });
    }
  }

  // Short timber knees make the cantilever look supported, not like a floating
  // slab. They remain visual-only; the deck and rail are the walkable collision.
  const braces = 7;
  for (let i = 0; i < braces; i++) {
    const x = -balconyW * 0.40 + (i / (braces - 1)) * balconyW * 0.80;
    B.box({ w: 0.15, h: 0.16, d: balconyD - 0.28, x, y: sy - 0.25,
      z: hd + balconyD / 2 - 0.04, rx: 0.30, mat: beam, uv: 1.4, tint: 0x573a28, collide: false });
  }

  // Small forged-metal corner straps and lamp-like end caps add silhouette
  // breakup without introducing loose, high-poly props.
  for (const side of [-1, 1]) {
    B.box({ w: 0.10, h: 0.28, d: 0.06, x: side * (balconyW / 2 - 0.22), y: sy + 0.33,
      z: hd + 0.18, mat: metal, uv: 1.6, tint: 0x9a7744, collide: false });
  }
}

function addUpperDoor(B, A, ctx, o) {
  const { upper, hd, trim, beam, metal, dark } = o;
  const door = upper.door;
  if (!door) return;
  const x = door.x ?? 0;
  const w = door.w || 1.9;
  const h = door.h || 2.4;
  const base = door.y ?? upper.y + 0.08;
  const z = hd + 0.17;
  const leafW = (w - 0.12) / 2;

  // Cream/gold casing and a timber header frame the actual walk-through gap.
  for (const side of [-1, 1]) {
    B.box({ w: 0.12, h: h + 0.12, d: 0.16, x: x + side * (w / 2 + 0.02),
      y: base + h / 2, z, mat: trim, uv: 1.5, tint: 0xc19a5a, collide: false });
  }
  B.box({ w: w + 0.26, h: 0.14, d: 0.18, x, y: base + h + 0.04, z,
    mat: beam, uv: 1.5, tint: 0x563b2a, collide: false });
  B.box({ w: w + 0.14, h: 0.07, d: 0.24, x, y: base + 0.02, z: z + 0.04,
    mat: trim, uv: 1.6, tint: 0xc19a5a, collide: false });

  // Both lightweight battened leaves are swung outward and deliberately have
  // no collider: the wall opening and balcony remain fully traversable.
  for (const side of [-1, 1]) {
    B.save();
    B.translate(x + side * w / 2, base + 0.06, z + 0.06);
    B.rotateY(side * 0.68);
    B.box({ w: leafW, h: h - 0.12, d: 0.075, x: -side * leafW / 2, y: (h - 0.12) / 2,
      mat: dark, uv: 1.6, tint: 0x633c29, collide: false });
    B.box({ w: leafW - 0.10, h: 0.72, d: 0.035, x: -side * leafW / 2, y: 0.53,
      mat: beam, uv: 1.5, tint: 0x7b4b32, collide: false });
    B.box({ w: leafW - 0.10, h: 0.08, d: 0.05, x: -side * leafW / 2, y: 0.15,
      mat: metal, uv: 1.6, tint: 0xb28a4e, collide: false });
    B.box({ w: leafW - 0.10, h: 0.08, d: 0.05, x: -side * leafW / 2, y: h - 0.38,
      mat: metal, uv: 1.6, tint: 0xb28a4e, collide: false });
    B.restore();
  }
  B.cyl({ r: 0.15, h: 0.07, seg: 12, x, y: base + h + 0.28, z: hd + 0.18,
    rx: Math.PI / 2, mat: metal, uv: 2, tint: 0xb58a48, collide: false });
}

function addLanterns(B, A, ctx, o) {
  const { hd, trim, metal, dark } = o;
  const M = ctx.M;
  const glow = M.mariposaGlow || (M.mariposaGlow = new THREE.MeshStandardMaterial({
    color: 0xffbd72,
    emissive: new THREE.Color(0xff7a26),
    emissiveIntensity: 0.12,
    roughness: 0.42,
    metalness: 0.02,
    transparent: true,
    opacity: 0.92,
  }));
  if (ctx.night && !ctx.night.some((n) => n.mat === glow)) ctx.night.push({ mat: glow, max: 0.75 });

  for (const x of [-6.35, 6.35]) {
    const y = 2.90, z = hd + 0.28;
    B.box({ w: 0.10, h: 0.10, d: 0.66, x, y: y + 0.25, z: hd + 0.42,
      mat: metal, uv: 1.7, tint: 0x7b5b31, collide: false });
    B.box({ w: 0.22, h: 0.11, d: 0.22, x, y: y + 0.54, z: z + 0.12,
      mat: trim, uv: 1.8, tint: 0x593a28, collide: false });
    B.box({ w: 0.28, h: 0.46, d: 0.27, x, y, z: z + 0.12,
      mat: glow, uv: 1.6, collide: false });
    B.box({ w: 0.34, h: 0.07, d: 0.32, x, y: y + 0.24, z: z + 0.12,
      mat: metal, uv: 1.6, tint: 0x64472f, collide: false });
    B.box({ w: 0.34, h: 0.07, d: 0.32, x, y: y - 0.24, z: z + 0.12,
      mat: metal, uv: 1.6, tint: 0x64472f, collide: false });
    B.box({ w: 0.07, h: 0.48, d: 0.07, x: x - 0.14, y, z: z + 0.12,
      mat: metal, uv: 1.6, tint: 0x64472f, collide: false });
    B.box({ w: 0.07, h: 0.48, d: 0.07, x: x + 0.14, y, z: z + 0.12,
      mat: metal, uv: 1.6, tint: 0x64472f, collide: false });
    B.light(ctx.lights, { type: 'point', x, y, z: z + 0.22, local: true, color: 0xffa34f,
      colDay: 0xffeedc, intensity: 0, max: 13, day: 0.04, distance: 15, decay: 1.45, castShadow: false });
  }
}

function addFalseFrontAccents(B, o) {
  const { w, h, hd, trim, metal } = o;
  const y = h + 1.98;
  // A shallow two-step crown lifts the central sign into the false front.
  B.box({ w: Math.min(7.8, w * 0.43), h: 0.12, d: 0.18, x: 0, y, z: hd + 0.17,
    mat: trim, uv: 1.8, tint: 0x593a28, collide: false });
  B.box({ w: Math.min(6.2, w * 0.34), h: 0.10, d: 0.22, x: 0, y: y + 0.16, z: hd + 0.16,
    mat: trim, uv: 1.8, tint: 0xb1894b, collide: false });
  for (const side of [-1, 1]) {
    B.box({ w: 0.20, h: 1.45, d: 0.18, x: side * (w / 2 - 0.22), y: h + 1.05,
      z: hd + 0.17, mat: trim, uv: 1.6, tint: 0x69452f, collide: false });
    B.box({ w: 0.28, h: 0.12, d: 0.26, x: side * (w / 2 - 0.22), y: h + 0.38,
      z: hd + 0.18, mat: metal, uv: 1.6, tint: 0xa47c3e, collide: false });
  }
}
