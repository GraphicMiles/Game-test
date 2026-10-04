import * as THREE from 'three';

/**
 * Parametric Old-West building kit.
 *
 * Local space:  footprint w (x) × d (z), front face at +z, floor at y = 0.
 * The builder's transform stack is used so callers just translate+rotate.
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ------------------------------------------------------------------ walls */
/** Wall with rectangular holes (doors + windows) cut out of it. */
export function wallWithHoles(B, o) {
  const { axis, at, a0, a1, y0, y1, holes = [], mat, uv = 0.55, tint, solid = true, t = 0.20 } = o;
  const xs = [a0, a1];
  for (const h of holes) { xs.push(clamp(h.a0, a0, a1), clamp(h.a1, a0, a1)); }
  xs.sort((p, q) => p - q);
  const uniq = [];
  for (const v of xs) if (!uniq.length || Math.abs(v - uniq[uniq.length - 1]) > 1e-4) uniq.push(v);

  for (let i = 0; i < uniq.length - 1; i++) {
    const s = uniq[i], e = uniq[i + 1];
    if (e - s < 0.02) continue;
    const mid = (s + e) / 2;
    const hs = holes
      .filter((h) => h.a1 > s + 0.01 && h.a0 < e - 0.01)
      .map((h) => [Math.max(h.y0, y0), Math.min(h.y1, y1)])
      .sort((p, q) => p[0] - q[0]);
    let cy = y0; const spans = [];
    for (const [hy0, hy1] of hs) {
      if (hy0 > cy + 0.01) spans.push([cy, Math.min(hy0, y1)]);
      cy = Math.max(cy, hy1);
    }
    if (cy < y1 - 0.01) spans.push([cy, y1]);

    for (const [sy0, sy1] of spans) {
      if (sy1 - sy0 < 0.02) continue;
      const cx = axis === 'x' ? mid : at;
      const cz = axis === 'x' ? at : mid;
      const w = axis === 'x' ? (e - s) : t;
      const d = axis === 'x' ? t : (e - s);
      const args = { w, h: sy1 - sy0, d, x: cx, y: (sy0 + sy1) / 2, z: cz, mat, uv, tint, collide: false };
      B.box(args);
      if (solid) B.collideBox(args, 'wall');
    }
  }
}

/* ---------------------------------------------------------------- windows */
/**
 * Double-hung window: casing, sill, lintel, mullions, reflective glass and a
 * second "lit" pane that glows after dark.
 * @param o {x, z, axis:'x'|'z', w, h, y, tint}
 */
export function windowUnit(B, A, ctx, o) {
  const { x, z, axis, w, h, y } = o;
  const trim = ctx.M.trim || (ctx.M.trim = A.mat('wood_siding', { vertexColors: true, rough: 0.78 }));
  const sillM = ctx.M.sill || (ctx.M.sill = A.mat('wood_siding', { vertexColors: true, rough: 0.8 }));
  const glassM = ctx.M.windowGlass || (ctx.M.windowGlass = A.glass(0xa9bfc6, 0.28));
  const litM = ctx.M.windowLit || (ctx.M.windowLit = new THREE.MeshStandardMaterial({
    color: 0x2a2118, emissive: new THREE.Color(0xffb562), emissiveIntensity: 0,
    roughness: 0.92, side: THREE.DoubleSide,
  }));
  if (ctx.night && !ctx.night.find((n) => n.mat === litM)) ctx.night.push({ mat: litM, max: 1.5 });

  const along = axis === 'x';            // wall runs along X -> pane faces Z
  const cx = x, cz = z;
  const pw = along ? w : 0.03;           // pane footprint
  const pd = along ? 0.03 : w;
  const fw = along ? w + 0.22 : 0.13;    // casing footprint
  const fd = along ? 0.13 : w + 0.22;
  const faceX = along ? cx : cx + 0.13;
  const faceZ = along ? cz + 0.13 : cz;
  const trimX = along ? cx : faceX + 0.055;
  const trimZ = along ? faceZ + 0.055 : cz;

  // Move the casing, projecting sill, glazing and muntins outside the shell
  // face, so the window reads as fitted joinery rather than a dark wall hole.
  B.box({ w: fw, h: h + 0.20, d: fd, x: faceX, y: y + h / 2, z: faceZ,
    mat: trim, uv: 1.4, tint: o.tint || 0x8b7350, collide: false });
  B.box({ w: along ? w + 0.44 : 0.34, h: 0.09, d: along ? 0.34 : w + 0.44,
    x: faceX, y: y - 0.05, z: faceZ, mat: sillM, uv: 1.6, tint: 0x7d6440, collide: false });
  B.box({ w: along ? w + 0.30 : 0.26, h: 0.08, d: along ? 0.26 : w + 0.30,
    x: faceX, y: y + h + 0.06, z: faceZ, mat: sillM, uv: 1.6, tint: 0x7d6440, collide: false });

  // Cool, lightly reflective outer pane and a warm interior pane for night.
  const inward = along ? -0.055 : (cx > 0 ? -0.055 : 0.055);
  B.box({ w: pw, h, d: pd, x: faceX, y: y + h / 2, z: faceZ, mat: glassM, uv: 1, collide: false });
  // Wall apertures are intentional, but glazing still blocks a player. Match
  // the shell thickness so even a crouch-jump cannot slip through the pane.
  B.collideBox({ w: along ? w : 0.20, h, d: along ? 0.20 : w,
    x: cx, y: y + h / 2, z: cz }, 'window');
  B.box({ w: pw, h: h * 0.94, d: pd,
    x: along ? cx : faceX + inward, y: y + h / 2, z: along ? faceZ + inward : cz,
    mat: litM, uv: 1, collide: false });

  // Project the crossed muntins slightly ahead of the pane, with a separate
  // lower sash rail for a readable double-hung silhouette at gameplay scale.
  B.box({ w: along ? w + 0.2 : 0.055, h: 0.06, d: along ? 0.055 : w + 0.2,
    x: trimX, y: y + h / 2, z: trimZ, mat: trim, uv: 2, tint: 0x6f5836, collide: false });
  B.box({ w: along ? 0.055 : w + 0.2, h, d: along ? w + 0.2 : 0.055,
    x: trimX, y: y + h / 2, z: trimZ, mat: trim, uv: 2, tint: 0x6f5836, collide: false });
  B.box({ w: along ? w : 0.05, h: 0.05, d: along ? 0.05 : w,
    x: trimX, y: y + h * 0.34, z: trimZ, mat: trim, uv: 2, tint: 0x6f5836, collide: false });
}

/* ------------------------------------------------------------------- doors */
/**
 * Door: casing, transom light and either a solid door swung inward or
 * saloon batwings. Leaves NO collider so the player can walk straight in.
 * @param o {x, z, axis:'x'|'z', w, h, batwing, open, tint}
 */
export function doorUnit(B, A, ctx, o) {
  const { x, z, axis, w, h, open = 1.0, batwing = false } = o;
  const trim = ctx.M.trim || (ctx.M.trim = A.mat('wood_siding', { vertexColors: true, rough: 0.78 }));
  const doorM = ctx.M.door || (ctx.M.door = A.mat('wood_painted', { vertexColors: true, rough: 0.72 }));
  const along = axis === 'x';
  const cx = x, cz = z;
  const inward = along ? -1 : (cx > 0 ? -1 : 1);

  // casing
  B.box({
    w: along ? w + 0.26 : 0.30, h: h + 0.18, d: along ? 0.30 : w + 0.26,
    x: cx, y: (h + 0.18) / 2, z: cz, mat: trim, uv: 1.4, tint: 0x7d6440, collide: false,
  });
  // threshold
  B.box({
    w: along ? w + 0.3 : 0.4, h: 0.07, d: along ? 0.4 : w + 0.3,
    x: cx, y: 0.5, z: cz, mat: trim, uv: 1.8, tint: 0x6a5433, collide: false,
  });
  // transom
  if (o.transom !== false) {
    const litM = ctx.M.windowLit || (ctx.M.windowLit = new THREE.MeshStandardMaterial({
      color: 0x2a2118, emissive: new THREE.Color(0xffb562), emissiveIntensity: 0, roughness: 0.9, side: THREE.DoubleSide,
    }));
    if (ctx.night && !ctx.night.find((n) => n.mat === litM)) ctx.night.push({ mat: litM, max: 1.5 });
    B.box({
      w: along ? w : 0.05, h: 0.36, d: along ? 0.05 : w,
      x: cx, y: h + 0.28, z: cz, mat: litM, uv: 1, collide: false,
    });
  }

  if (batwing) {
    for (const s of [-1, 1]) {
      B.save();
      B.translate(cx + (along ? s * w / 2 : 0), 0, cz + (along ? 0 : s * w / 2));
      B.rotateY((along ? 0 : Math.PI / 2) + s * 0.62);
      B.box({ w: w / 2 - 0.03, h: h * 0.60, d: 0.05, x: -s * (w / 4 - 0.02), y: h * 0.52,
        mat: doorM, uv: 1.6, tint: o.tint || 0xa8845a, collide: false });
      for (let i = 0; i < 3; i++) {
        B.box({ w: w / 2 - 0.05, h: 0.07, d: 0.07, x: -s * (w / 4 - 0.02),
          y: h * 0.52 - h * 0.20 + i * h * 0.20, mat: trim, uv: 2, tint: 0x6f5836, collide: false });
      }
      B.restore();
    }
  } else {
    // hinge on one jamb, swung into the room
    B.save();
    B.translate(cx + (along ? -w / 2 : 0), 0, cz + (along ? 0 : -w / 2));
    B.rotateY((along ? 0 : Math.PI / 2) + open * 1.5 * (along ? 1 : inward));
    B.box({ w, h: h - 0.06, d: 0.06, x: w / 2, y: (h - 0.06) / 2,
      mat: doorM, uv: 1.4, tint: o.tint || 0x8a6f4a, collide: false });
    for (const sy of [0.30, -0.28]) {
      B.box({ w: w * 0.58, h: h * 0.40, d: 0.03, x: w / 2, y: h / 2 + sy * h * 0.40,
        mat: trim, uv: 1.8, tint: 0x6f5836, collide: false });
    }
    B.sphere({ r: 0.05, x: w - 0.15, y: h * 0.46, mat: ctx.M.hoop || (ctx.M.hoop = A.plain(0x6b5a3a, { rough: 0.4, metal: 0.8 })) });
    B.restore();
  }
}

/* ------------------------------------------------------------------ roofs */
export function roof(B, A, ctx, o) {
  const { w, d, h, type, overhang = 0.34, ridge = true } = o;
  const mat = ctx.M.roofMat || (ctx.M.roofMat = A.mat('roof_metal', { vertexColors: true, rough: 0.62, metal: 0.30 }));
  const trim = ctx.M.trim || (ctx.M.trim = A.mat('wood_siding', { vertexColors: true }));
  const W = w + overhang * 2, D = d + overhang * 2;
  const T = 0.14;

  if (type === 'shed') {
    const drop = o.drop || Math.min(1.9, d * 0.28);
    const ang = Math.atan2(drop, d);
    const len = Math.hypot(drop, d) + overhang * 2;
    B.save();
    B.translate(0, h + drop / 2, 0);
    B.rotateX(-ang);
    B.box({ w: W, h: T, d: len, mat, uv: 0.55, tint: o.tint || 0x9a9184, collide: false });
    B.restore();
    // fascia
    B.box({ w: W, h: 0.22, d: 0.1, y: h + drop + 0.06, z: -d / 2 - overhang + 0.05, mat: trim, uv: 1.6, tint: 0x6f5836, collide: false });
    B.box({ w: W, h: 0.26, d: 0.1, y: h - 0.08, z: d / 2 + overhang - 0.05, mat: trim, uv: 1.6, tint: 0x6f5836, collide: false });
  } else if (type === 'gable') {
    const rise = o.rise || Math.min(2.2, d * 0.30);
    const ang = Math.atan2(rise, d / 2);
    const len = Math.hypot(rise, d / 2) + overhang;
    for (const s of [-1, 1]) {
      B.save();
      B.translate(0, h + rise / 2, s * d / 4);
      B.rotateX(s * -ang);
      B.box({ w: W, h: T, d: len, mat, uv: 0.55, tint: o.tint || 0x9a9184, collide: false });
      B.restore();
    }
    if (ridge) B.box({ w: W, h: 0.18, d: 0.34, y: h + rise + 0.06, mat: trim, uv: 1.6, tint: 0x6f5836, collide: false });
    // raking fascia
    for (const s of [-1, 1]) {
      B.save(); B.translate(0, h + rise / 2, s * (d / 2 + overhang - 0.06));
      B.box({ w: W, h: 0.24, d: 0.1, mat: trim, uv: 1.6, tint: 0x6f5836, collide: false });
      B.restore();
    }
  } else { // flat
    B.box({ w: W, h: T * 1.4, d: D, y: h, mat, uv: 0.5, tint: o.tint || 0x8f887c, collide: false });
    for (const s of [-1, 1]) {
      B.box({ w: W, h: 0.24, d: 0.12, y: h + 0.14, z: s * (d / 2 + overhang - 0.06), mat: trim, uv: 1.6, tint: 0x6f5836, collide: false });
    }
  }
  // roof collider so you can't phase through the eaves
  B.collideBox({ w: W, h: 0.3, d: D, y: h + (type === 'flat' ? 0.1 : 0.4) });
}

/* ------------------------------------------------------------------ porch */
export function porch(B, A, ctx, o) {
  const { w, h, depth, posts = 4, rail = true, deck = 0.42 } = o;
  const deckM = ctx.M.deckMat || (ctx.M.deckMat = A.mat('wood_deck', { vertexColors: true, rough: 0.87 }));
  const post = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const trim = ctx.M.trim || (ctx.M.trim = A.mat('wood_siding', { vertexColors: true }));
  const frontZ = o.z0 !== undefined ? o.z0 : 0;
  const cz = frontZ + depth / 2;

  // deck boards (run lengthwise along the facade)
  B.box({ w, h: deck, d: depth, y: deck / 2, z: cz, mat: deckM, uv: 0.62, tint: 0xa08657, collide: false });
  B.collideBox({ w, h: deck, d: depth, y: deck / 2, z: cz });
  B.box({ w, h: 0.1, d: 0.14, y: deck + 0.03, z: cz + depth / 2, mat: trim, uv: 1.6, tint: 0x836a45, collide: false });

  // steps (three, centred, a little wider than the door)
  const sw = o.stepW || 1.9;
  for (let i = 0; i < 3; i++) {
    const y = deck - (i + 1) * (deck / 3);
    B.box({ w: sw, h: deck / 3, d: 0.30, y: y + deck / 6, z: cz + depth / 2 + 0.15 + i * 0.30, mat: deckM, uv: 1.4, tint: 0x95794e, collide: false });
    B.collideBox({ w: sw, h: deck / 3, d: 0.30, y: y + deck / 6, z: cz + depth / 2 + 0.15 + i * 0.30 });
  }
  // stringers
  for (const s of [-1, 1]) {
    B.box({ w: 0.12, h: deck, d: depth * 0.55, y: deck / 2, x: s * sw / 2, z: cz + depth / 2 + 0.3, mat: trim, uv: 1.6, tint: 0x7d6440, collide: false });
  }

  // posts
  const py = 0, ph = h - deck;
  const xs = Array.isArray(o.postXs) ? o.postXs : [];
  if (!Array.isArray(o.postXs)) {
    for (let i = 0; i < posts; i++) xs.push(-w / 2 + 0.4 + (i / (posts - 1)) * (w - 0.8));
  }
  for (const px of xs) {
    // posts stay non-solid so the boardwalk reads as one continuous walkway
    B.box({ w: 0.15, h: ph, d: 0.15, x: px, y: deck + ph / 2, z: cz + depth - 0.28, mat: post, uv: 1.1, tint: 0x7d6440, collide: false });
    // capital
    B.box({ w: 0.24, h: 0.1, d: 0.24, x: px, y: deck + ph - 0.05, z: cz + depth - 0.28, mat: trim, uv: 2, tint: 0x8b7350, collide: false });
  }

  // porch roof (shed, sloping away from the street)
  const drop = 0.55;
  const ang = Math.atan2(drop, depth);
  const len = Math.hypot(drop, depth) + 0.5;
  B.save();
  B.translate(0, h + drop / 2 + 0.05, cz);
  B.rotateX(ang);
  B.box({ w: w + 0.4, h: 0.12, d: len, mat: ctx.M.roofMat || (ctx.M.roofMat = A.mat('roof_metal', { vertexColors: true, rough: 0.62, metal: 0.3 })), uv: 0.6, tint: 0x9a9184, collide: false });
  B.restore();
  B.box({ w: w + 0.5, h: 0.2, d: 0.12, y: h + 0.12, z: cz + depth / 2 + 0.1, mat: trim, uv: 1.6, tint: 0x6f5836, collide: false });
  // beam
  B.box({ w: w + 0.2, h: 0.16, d: 0.14, y: h - 0.12, z: cz + depth - 0.28, mat: trim, uv: 1.6, tint: 0x7d6440, collide: false });

  // railing — closes the two ENDS of the porch only, so the walkway stays open
  if (rail) {
    const railLen = Math.max(0.6, depth - 0.7);
    const rzc = cz + depth / 2 - 0.34 - railLen / 2;
    for (const s2 of [-1, 1]) {
      const rx = s2 * (w / 2 - 0.14);
      B.box({ w: 0.09, h: 0.09, d: railLen, x: rx, y: deck + 0.95, z: rzc, mat: trim, uv: 1.4, tint: 0x8b7350, collide: false });
      B.box({ w: 0.09, h: 0.09, d: railLen, x: rx, y: deck + 0.55, z: rzc, mat: trim, uv: 1.4, tint: 0x8b7350, collide: false });

      const nb = Math.max(2, Math.round(railLen / 0.34));
      for (let i = 0; i <= nb; i++) {
        B.box({ w: 0.06, h: 0.86, d: 0.06, x: rx, y: deck + 0.5, z: rzc - railLen / 2 + (i / nb) * railLen,
          mat: trim, uv: 2, tint: 0x775f3d, collide: false });
      }
    }
  }
}

/* --------------------------------------------------------------- cornices */
export function cornice(B, A, ctx, o) {
  const { w, y, z, depth = 0.34, tiers = 3 } = o;
  const trim = ctx.M.trim || (ctx.M.trim = A.mat('wood_siding', { vertexColors: true }));
  for (let i = 0; i < tiers; i++) {
    const f = 1 - i * 0.22;
    B.box({
      w: w * (1 + i * 0.012), h: 0.13, d: depth * f,
      y: y + 0.065 + i * 0.13, z, mat: trim, uv: 1.5, tint: i % 2 ? 0x8b7350 : 0x7d6440, collide: false,
    });
  }
  // dentils
  const n = Math.max(6, Math.floor(w / 0.3));
  for (let i = 0; i < n; i++) {
    const bx = -w / 2 + (i + 0.5) * (w / n);
    B.box({ w: 0.12, h: 0.12, d: depth * 0.7, y: y - 0.06, z, x: bx, mat: trim, uv: 2, tint: 0x6f5836, collide: false });
  }
}

/* -------------------------------------------------------------- the build */
const _c1 = new THREE.Color();

function tintOf(hexA, hexB) {
  return _c1.set(hexA).multiply(new THREE.Color(hexB)).getHex();
}

/**
 * Complete building: shell, false front, porch, roof, interior and furnishing.
 * @param {MeshBuilder} B
 * @param {Assets}      A
 * @param {object}      ctx  shared { M, night, lights, animated, interactables, furnish }
 */
export function makeBuilding(B, A, ctx, cfg) {
  const {
    w, d, h = 3.9, x = 0, z = 0, rot = 0,
    facade = 0xb9a184, siding = 'wood_painted', tint = 0xffffff,
    roof: roofType = 'gable', parapet = 1.5, porch: porchCfg = null,
    windows = 3, door = {}, interior = 'empty', stone = false, chimney = false,
    sign = null, name = '', sub = '', batten = true,
    upper = null, roofTint = 0x9a9184, deux = false,
  } = cfg;

  const M = ctx.M;
  if (!M.siding) {
    M.siding = A.mat('wood_painted', { vertexColors: true, rough: 0.80 });
    M.sidingPlain = A.mat('wood_siding', { vertexColors: true, rough: 0.86 });
    M.trim = A.mat('wood_siding', { vertexColors: true, rough: 0.78 });
    M.deckMat = A.mat('wood_deck', { vertexColors: true, rough: 0.87 });
    M.roofMat = A.mat('roof_metal', { vertexColors: true, rough: 0.62, metal: 0.30 });
    M.floor = A.mat('wood_deck', { vertexColors: true, rough: 0.85 });
    M.stone = A.mat('brick', { vertexColors: true, rough: 0.92 });
    M.beam = A.mat('wood_siding', { vertexColors: true, rough: 0.88 });
    M.ceil = A.mat('plaster', { vertexColors: true, rough: 0.95 });
    M.dark = A.plain(0x241c14, { rough: 0.9 });
  }

  B.save();
  B.translate(x, 0, z);
  B.rotateY(rot);

  /* ------------------------------------------- sweep the footprint clean
     Street dressing (fences, corrals, wagons, wood piles) is laid down
     before the buildings, so anything that overlaps this footprint is
     removed here rather than poking through the walls and floors. */
  B.clearRegion({ x: 0, y: 3.0, z: 0, w: w - 0.25, h: 6.0, d: d - 0.25 });


  const t = 0.22, hw = w / 2, hd = d / 2;
  const wallH = h;

  /* ---------------------------------------------------- foundation */
  const fM = stone ? M.stone : M.sidingPlain;
  B.box({ w: w + 0.24, h: 0.44, d: d + 0.24, y: 0.22, mat: fM, uv: 0.9,
    tint: stone ? 0x9c8371 : 0x6f5836, collide: false });
  B.collideBox({ w: w + 0.24, h: 0.44, d: d + 0.24, y: 0.22 });

  /* ---------------------------------------------------- openings */
  const doorW = door.w || 1.18, doorH = door.h || 2.28;
  const winW = cfg.winW || 0.98, winH = cfg.winH || 1.6, winY = cfg.winY || 1.2;

  const frontHoles = [{ a0: -doorW / 2, a1: doorW / 2, y0: 0, y1: doorH + 0.42 }];
  const doorCx = 0;
  if (windows >= 2) {
    frontHoles.push({ a0: -hw + 0.62, a1: -hw + 0.62 + winW, y0: winY, y1: winY + winH });
    frontHoles.push({ a0: hw - 0.62 - winW, a1: hw - 0.62, y0: winY, y1: winY + winH });
  } else if (windows === 1) {
    frontHoles.push({ a0: -winW / 2, a1: winW / 2, y0: winY + 0.55, y1: winY + 0.55 + winH * 0.85 });
  }
  const upperWindowXs = [];
  if (upper) {
    const nUpper = upper.windows || 3;
    const span = w - 1.6;
    const uy = upper.y + 0.55;
    for (let i = 0; i < nUpper; i++) {
      const cxx = -span / 2 + (i / Math.max(1, nUpper - 1)) * span;
      const ud = upper.door;
      if (ud && Math.abs(cxx - (ud.x || 0)) < (winW + (ud.w || 1.6)) / 2 + 0.08) continue;
      upperWindowXs.push(cxx);
      frontHoles.push({ a0: cxx - winW / 2, a1: cxx + winW / 2, y0: uy, y1: uy + winH * 0.9 });
    }
    // Optional upper-floor access is a real wall opening; building-specific
    // trim/door leaves can then be added without punching a collidable hole
    // into every other upper-storey facade.
    if (upper.door) {
      const ud = upper.door;
      const ux = ud.x || 0, uw = ud.w || 1.6, uh = ud.h || 2.35;
      const uy0 = ud.y !== undefined ? ud.y : upper.y + 0.08;
      frontHoles.push({ a0: ux - uw / 2, a1: ux + uw / 2, y0: uy0, y1: uy0 + uh });
    }
  }
  const sideHoles = [];
  const nSide = Math.max(1, Math.floor((d - 1.6) / 3.0));
  for (let i = 0; i < nSide; i++) {
    const p = -hd + 1.7 + i * ((d - 3.0) / Math.max(1, nSide - 1 || 1));
    if (nSide === 1) { sideHoles.push({ a0: -winW / 2, a1: winW / 2, y0: winY + 0.1, y1: winY + 0.1 + winH * 0.92 }); break; }
    sideHoles.push({ a0: p - winW / 2, a1: p + winW / 2, y0: winY + 0.1, y1: winY + 0.1 + winH * 0.92 });
  }
  if (upper) {
    for (let i = 0; i < nSide; i++) {
      const p = sideHoles[i] ? (sideHoles[i].a0 + sideHoles[i].a1) / 2 : 0;
      sideHoles.push({ a0: p - winW / 2, a1: p + winW / 2, y0: upper.y + 0.65, y1: upper.y + 0.65 + winH * 0.85 });
    }
  }

  /* ---------------------------------------------------- shell */
  const wallTintC = tintOf(facade, tint);
  wallWithHoles(B, { axis: 'x', at: hd, a0: -hw, a1: hw, y0: 0.44, y1: wallH, t,
    holes: frontHoles, mat: M.siding, uv: 0.62, tint: wallTintC });
  wallWithHoles(B, { axis: 'x', at: -hd, a0: -hw, a1: hw, y0: 0.44, y1: wallH, t,
    holes: [], mat: M.sidingPlain, uv: 0.62, tint: 0x8a8478 });
  for (const s of [-1, 1]) {
    wallWithHoles(B, { axis: 'z', at: s * hw, a0: -hd, a1: hd, y0: 0.44, y1: wallH, t,
      holes: sideHoles, mat: M.sidingPlain, uv: 0.62, tint: 0x948d80 });
  }

  /* ---------------------------------------------------- corner posts + battens */
  for (const sx of [-1, 1]) {
    B.box({ w: 0.17, h: wallH - 0.44, d: 0.17, x: sx * (hw - 0.02), y: 0.44 + (wallH - 0.44) / 2, z: hd - 0.02,
      mat: M.trim, uv: 1.2, tint: 0x7d6440, collide: false });
  }
  if (batten) {
    const step = 0.62;
    for (let bx = -hw + step; bx < hw - 0.4; bx += step) {
      let blocked = false;
      for (const h2 of frontHoles) if (bx > h2.a0 - 0.16 && bx < h2.a1 + 0.16) blocked = true;
      if (blocked) continue;
      B.box({ w: 0.075, h: wallH - 0.5, d: 0.03, x: bx, y: 0.46 + (wallH - 0.5) / 2, z: hd + 0.12,
        mat: M.trim, uv: 1.5, tint: 0x77613c, collide: false });
    }
  }

  /* ---------------------------------------------------- false front parapet */
  if (parapet > 0.1) {
    const pTop = wallH + parapet;
    wallWithHoles(B, { axis: 'x', at: hd, a0: -hw, a1: hw, y0: wallH, y1: pTop, t,
      holes: [], mat: M.siding, uv: 0.62, tint: wallTintC });
    // pilasters flanking the facade
    for (const sx of [-1, 1]) {
      B.box({ w: 0.24, h: parapet, d: 0.24, x: sx * (hw - 0.06), y: wallH + parapet / 2, z: hd + 0.12,
        mat: M.trim, uv: 1.2, tint: 0x7d6440, collide: false });
    }
    cornice(B, A, ctx, { w: w + 0.3, y: pTop - 0.14, z: hd + 0.10, depth: 0.42, tiers: 3 });
    // cap flashing
    B.box({ w: w + 0.36, h: 0.1, d: 0.5, y: pTop + 0.28, z: hd + 0.10,
      mat: M.roofMat, uv: 1.1, tint: 0x8c8378, collide: false });
  }

  /* ---------------------------------------------------- roof */
  roof(B, A, ctx, { w, d, h: wallH, type: roofType, tint: roofTint, overhang: 0.32 });

  /* ---------------------------------------------------- chimney */
  if (chimney) {
    const cx = chimney.x !== undefined ? chimney.x : -hw + 0.9;
    const cz = chimney.z !== undefined ? chimney.z : -hd + 0.9;
    const top = wallH + (roofType === 'gable' ? 2.5 : 1.9);
    B.box({ w: 0.66, h: top - 0.4, d: 0.66, x: cx, y: (top - 0.4) / 2 + 0.2, z: cz,
      mat: M.stone, uv: 1.0, tint: 0x8f7566, collide: false });
    B.box({ w: 0.86, h: 0.16, d: 0.86, x: cx, y: top + 0.02, z: cz,
      mat: M.stone, uv: 1.0, tint: 0x7a6355, collide: false });
    B.box({ w: 0.44, h: 0.4, d: 0.44, x: cx, y: top + 0.28, z: cz,
      mat: M.stone, uv: 1.4, tint: 0x6f4f42, collide: false });
    B.collideBox({ w: 0.7, h: top - 0.4, d: 0.7, x: cx, y: (top - 0.4) / 2 + 0.2, z: cz });
  }

  /* ---------------------------------------------------- porch */
  if (porchCfg) {
    porch(B, A, ctx, {
      w: porchCfg.w || w, h: porchCfg.h || (wallH - 0.15), depth: porchCfg.depth || 2.6,
      posts: porchCfg.posts || 4, postXs: porchCfg.postXs, rail: porchCfg.rail !== false, z0: hd,
      stepW: porchCfg.stepW, deck: porchCfg.deck || 0.42,
    });
  }

  /* ---------------------------------------------------- interior shell */
  const iw = w - t * 2, id = d - t * 2;
  const floorY = 0.46;
  B.box({ w: iw, h: 0.08, d: id, y: floorY, mat: M.floor, uv: 0.55, tint: 0x8f7449, collide: false });
  B.collideBox({ w: iw, h: 0.08, d: id, y: floorY });

  // wainscot + baseboard so the walls read from inside too
  for (const [ax, at2, len, thick] of [['x', hd - t / 2 - 0.03, iw, 0.05], ['x', -hd + t / 2 + 0.03, iw, 0.05],
    ['z', hw - t / 2 - 0.03, id, 0.05], ['z', -hw + t / 2 + 0.03, id, 0.05]]) {
    B.box({
      w: ax === 'x' ? len : thick, h: 0.16, d: ax === 'x' ? thick : len,
      x: ax === 'x' ? 0 : at2, z: ax === 'x' ? at2 : 0, y: floorY + 0.12,
      mat: M.trim, uv: 1.4, tint: 0x6f5836, collide: false,
    });
  }

  // ceiling + exposed joists
  const ceilY = wallH - 0.34;
  B.box({ w: iw, h: 0.1, d: id, y: ceilY, mat: M.ceil, uv: 0.5, tint: 0x6a5c48, collide: false });
  B.collideBox({ w: iw, h: 0.1, d: id, y: ceilY });
  const joists = Math.max(2, Math.floor(id / 1.15));
  for (let i = 0; i < joists; i++) {
    const p = -id / 2 + (i + 0.5) * (id / joists);
    B.box({ w: iw, h: 0.17, d: 0.12, y: ceilY - 0.14, z: p, mat: M.beam, uv: 1.2, tint: 0x6b5535, collide: false });
  }
  B.box({ w: 0.24, h: 0.3, d: id, y: ceilY - 0.24, mat: M.beam, uv: 1.2, tint: 0x5f4a2d, collide: false });

  /* ---------------------------------------------------- upper storey */
  if (upper) {
    const sy = upper.y, sx = upper.stairX !== undefined ? upper.stairX : -hw + 1.5;
    const sz = upper.stairZ !== undefined ? upper.stairZ : -hd + 1.8;
    const openW = 2.0, openD = 3.2;
    // floor slabs around the stairwell
    const ox0 = sx - openW / 2, ox1 = sx + openW / 2;
    const oz0 = sz - openD / 2, oz1 = sz + openD / 2;
    const strips = [
      { x: (-hw + ox0) / 2, z: 0, w: ox0 + hw, d: id },
      { x: (ox1 + hw) / 2, z: 0, w: hw - ox1, d: id },
      { x: sx, z: (-hd + oz0) / 2, w: openW, d: oz0 + hd },
      { x: sx, z: (oz1 + hd) / 2, w: openW, d: hd - oz1 },
    ];
    for (const s2 of strips) {
      if (s2.w <= 0.02 || s2.d <= 0.02) continue;
      B.box({ w: s2.w, h: 0.16, d: s2.d, x: s2.x, y: sy, z: s2.z, mat: M.floor, uv: 0.55, tint: 0x8f7449, collide: false });
      B.collideBox({ w: s2.w, h: 0.16, d: s2.d, x: s2.x, y: sy, z: s2.z });
    }
    // railing around the well
    for (const s3 of [[ox0, -1], [ox1, 1]]) {
      B.box({ w: 0.08, h: 0.9, d: openD, x: s3[0], y: sy + 0.53, z: sz, mat: M.trim, uv: 1.4, tint: 0x7d6440, collide: false });
      B.collideBox({ w: 0.12, h: 0.95, d: openD, x: s3[0], y: sy + 0.5, z: sz });
    }
    B.box({ w: openW, h: 0.9, d: 0.08, x: sx, y: sy + 0.53, z: oz1, mat: M.trim, uv: 1.4, tint: 0x7d6440, collide: false });
    B.collideBox({ w: openW, h: 0.95, d: 0.12, x: sx, y: sy + 0.5, z: oz1 });

    // staircase: rise/run computed to fit the opening exactly
    const nSteps = Math.max(6, Math.round(sy / 0.30));
    const rise = sy / nSteps;
    const run = Math.min(0.30, (openD - 0.8) / nSteps);
    const width = openW - 0.1;
    for (let i = 0; i < nSteps; i++) {
      const y = floorY + i * rise + rise / 2;
      const zz = sz + openD / 2 - 0.35 - i * run;
      B.box({ w: width, h: rise, d: run * 1.7, x: sx, y, z: zz, mat: M.floor, uv: 1.5, tint: 0x82693f, collide: false });
    }
    // the flight collides as one smooth ramp from the treads, not as risers
    B.slope({
      x: sx, z: sz + openD / 2 - 0.35 - (nSteps - 1) * run / 2,
      w: width, d: (nSteps - 1) * run + run * 0.9,
      y0: floorY + 0.04, y1: sy + 0.08, axis: '-z',
    });
    // handrail
    for (let i = 0; i < nSteps; i++) {
      const y = floorY + i * rise + 0.95;
      const zz = sz + openD / 2 - 0.35 - i * run;
      B.box({ w: 0.07, h: 0.07, d: 0.07, x: sx - width / 2 + 0.05, y, z: zz, mat: M.trim, uv: 2, tint: 0x7d6440, collide: false });
    }
  }

  /* ---------------------------------------------------- signage */
  if (sign) {
    const tex = A.sign(sign.text, {
      w: sign.w || 1024, h: sign.h || 224, sub: sign.sub || '',
      bg: sign.bg || '#2a1c11', fg: sign.fg || '#e8d9b8', accent: sign.accent || '#c8963c',
      style: sign.style || 'board', font: sign.font,
    });
    const sw = sign.width || Math.min(w - 0.9, 5.2), sh = sw * (sign.ratio || 0.23);
    const sy2 = sign.y !== undefined ? sign.y : wallH + parapet * 0.42;
    const signMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.85, metalness: 0, envMapIntensity: 0.7, side: THREE.DoubleSide,
    });
    ctx.signs = ctx.signs || [];
    ctx.signs.push(signMat);
    B.box({ w: sw, h: sh, d: 0.09, y: sy2, z: hd + 0.19, mat: signMat, uv: 1, collide: false });
    // ironstone shadow line under the board
    B.box({ w: sw + 0.14, h: 0.06, d: 0.16, y: sy2 - sh / 2 - 0.05, z: hd + 0.16,
      mat: M.trim, uv: 2, tint: 0x4a3a24, collide: false });
  }
  if (cfg.blade) {
    const b = cfg.blade;
    const tex = A.sign(b.text, { w: 512, h: 512, sub: '', bg: '#241a10', fg: '#e8d9b8', accent: '#c8963c', style: 'board' });
    const bm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
    ctx.signs = ctx.signs || []; ctx.signs.push(bm);
    const bw = 0.78;
    B.box({ w: 0.1, h: 0.1, d: bw + 0.2, y: (b.y || 2.9), z: hd + (b.z || 0.35), mat: M.trim, uv: 2, tint: 0x4a3a24, collide: false });
    B.box({ w: 0.05, h: bw, d: bw, y: (b.y || 2.9) - bw / 2 - 0.05, z: hd + (b.z || 0.35) + bw / 2, mat: bm, uv: 1, collide: false });
  }

  /* ---------------------------------------------------- doors & windows */
  doorUnit(B, A, ctx, {
    x: doorCx, z: hd, axis: 'x', w: doorW, h: doorH,
    batwing: !!door.batwing, open: door.open !== undefined ? door.open : 1.0,
    tint: door.tint || 0x8a6f4a, transom: door.transom !== false,
  });
  if (windows >= 2) {
    windowUnit(B, A, ctx, { x: -hw + 0.62 + winW / 2, z: hd, axis: 'x', w: winW, h: winH, y: winY, tint: 0x8b7350 });
    windowUnit(B, A, ctx, { x: hw - 0.62 - winW / 2, z: hd, axis: 'x', w: winW, h: winH, y: winY, tint: 0x8b7350 });
  } else if (windows === 1) {
    windowUnit(B, A, ctx, { x: 0, z: hd, axis: 'x', w: winW, h: winH * 0.85, y: winY + 0.55, tint: 0x8b7350 });
  }
  for (const hh of sideHoles) {
    const p = (hh.a0 + hh.a1) / 2;
    windowUnit(B, A, ctx, { x: hw, z: p, axis: 'z', w: winW, h: hh.y1 - hh.y0, y: hh.y0, tint: 0x8b7350 });
    B.save(); B.rotateY(Math.PI);
    windowUnit(B, A, ctx, { x: hw, z: p, axis: 'z', w: winW, h: hh.y1 - hh.y0, y: hh.y0, tint: 0x8b7350 });
    B.restore();
  }
  if (upper) {
    for (const cxx of upperWindowXs) {
      windowUnit(B, A, ctx, { x: cxx, z: hd, axis: 'x', w: winW, h: winH * 0.9, y: upper.y + 0.55, tint: 0x8b7350 });
    }
  }

  /* ---------------------------------------------------- furnishing */
  if (ctx.furnish) ctx.furnish(interior, B, A, ctx, { w: iw, d: id, h: wallH, floorY, cfg });

  /* --------------------------------------------- doorway keep-clear */
  // Clear props and furnishing from an approach corridor. Shell-wall
  // colliders are tagged and preserved so this broad sweep cannot widen a
  // doorway into a walk-through gap in the facade.
  B.clearRegion(
    { x: 0, y: 1.70, z: hd + 1.4, w: 2.9, h: 2.4, d: 6.0 },
    { preserve: (collider) => collider.tag === 'wall' },
  );

  /* ---------------------------------------------------- interior light */
  if (cfg.lit !== false) {
    // one lamp per storey — a single ceiling lamp above an upper floor would
    // leave the ground floor in the dark.  decay is softened below 2 so a
    // whole room reads evenly instead of a hot circle under the bulb.
    const big = Math.max(w, d);
    const saloon = interior === 'saloon';
    const lamp = (x, y, max) => B.light(ctx.lights, {
      type: 'point', x, y, z: 0, local: true,
      color: 0xffb060, colDay: 0xfff0dc, intensity: 0, max,
      day: 0.75, distance: big * 2.8, decay: 1.30, castShadow: false,
    });
    const groundY = upper ? Math.min(wallH - 1.4, upper.y - 1.0) : wallH - 0.8;
    const gMax = saloon ? 26 : 44;
    // rooms longer than 14 m get a second lamp so no corner goes black
    if (big > 14) { lamp(-big * 0.22, groundY, gMax * 0.8); lamp(big * 0.22, groundY, gMax * 0.8); }
    else lamp(0, groundY, gMax);
    if (upper) lamp(0, (upper.y + wallH) / 2 + 0.3, saloon ? 24 : 40);
  }

  /* ---------------------------------------------------- label trigger */
  if (name) {
    const wp = new THREE.Vector3(x, 0, z).add(new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot)).multiplyScalar(hd + 2.2));
    ctx.places.push({ pos: wp, radius: 7.5, name, sub, building: [x, z, w, d, rot] });
  }

  B.restore();
}
