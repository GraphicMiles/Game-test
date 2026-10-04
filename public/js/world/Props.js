import * as THREE from 'three';

/**
 * Every loose object in Sweetwater. All helpers build into a MeshBuilder
 * using the CURRENT transform, so callers can position/rotate freely.
 */

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ barrels
export function barrel(B, A, ctx, x, z, o = {}) {
  const h = o.h || 0.92, r = o.r || 0.32;
  const wood = ctx.M.barrel || (ctx.M.barrel = A.mat('wood_siding', { vertexColors: true, rough: 0.86 }));
  const hoop = ctx.M.hoop || (ctx.M.hoop = A.plain(0x4a4038, { rough: 0.55, metal: 0.75 }));
  const tint = o.tint || 0xb08a5e;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  // staved body (slight barrel bulge)
  B.cyl({ r, h, y: h / 2, seg: 14, mat: wood, uv: 1.1, tint, collide: false });
  B.cyl({ r: r * 0.94, h: h * 0.16, y: h * 0.30, seg: 14, mat: hoop, uv: 1.6, collide: false });
  B.cyl({ r: r * 0.94, h: h * 0.16, y: h * 0.72, seg: 14, mat: hoop, uv: 1.6, collide: false });
  B.cyl({ r: r * 0.99, h: 0.05, y: h - 0.02, seg: 14, mat: wood, uv: 1.6, tint, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: 0, w: r * 2, h, d: r * 2 });
  B.restore();
}

export function crate(B, A, ctx, x, z, o = {}) {
  const s = o.s || 0.72, h = o.h || s;
  const wood = ctx.M.crate || (ctx.M.crate = A.mat('wood_siding', { vertexColors: true, rough: 0.9 }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: s, h, d: s, y: h / 2, mat: wood, uv: 1.25, tint: o.tint || 0xa8845a, collide: false });
  // corner battens
  const bat = ctx.M.batten || (ctx.M.batten = A.mat('wood_siding', { vertexColors: true }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.box({ w: 0.07, h: h * 0.98, d: 0.07, x: sx * (s / 2 - 0.035), y: h / 2, z: sz * (s / 2 - 0.035), mat: bat, uv: 2, tint: 0x7d6340, collide: false });
  }
  B.box({ w: s * 1.02, h: 0.06, d: s * 1.02, y: h * 0.5, mat: bat, uv: 2, tint: 0x7d6340, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: 0, w: s, h, d: s });
  B.restore();
}

export function sack(B, A, ctx, x, z, o = {}) {
  const canvas = ctx.M.canvas || (ctx.M.canvas = A.mat('plaster', { vertexColors: true, rough: 0.95 }));
  const h = o.h || 0.62;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.sphere({ r: h * 0.55, y: h * 0.5, seg: 10, seg2: 8, mat: canvas, tint: o.tint || 0xc4b189 });
  B.cyl({ rt: h * 0.30, rb: h * 0.22, h: h * 0.3, y: h * 0.86, seg: 8, mat: canvas, tint: o.tint || 0xb8a57e });
  B.collideBox({ x: 0, y: h / 2, z: 0, w: h * 0.9, h, d: h * 0.9 });
  B.restore();
}

// ------------------------------------------------------------------ street
export function hitchingPost(B, A, ctx, x, z, o = {}) {
  const len = o.len || 3.0;
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true, rough: 0.88 }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  for (const sx of [-1, 1]) {
    B.box({ w: 0.13, h: 1.25, d: 0.13, x: sx * len / 2, y: 0.62, mat: wood, uv: 1.4, tint: 0x7a6141, collide: false });
  }
  B.box({ w: len + 0.28, h: 0.11, d: 0.11, y: 1.16, mat: wood, uv: 1.6, tint: 0x8b7048, collide: false });
  B.collideBox({ x: 0, y: 0.6, z: 0, w: len + 0.3, h: 1.2, d: 0.24 });
  B.restore();
}

export function waterTrough(B, A, ctx, x, z, o = {}) {
  const w = o.w || 2.4, d = o.d || 0.72, h = 0.62;
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true, rough: 0.9 }));
  const water = ctx.M.water || (ctx.M.water = new THREE.MeshStandardMaterial({
    color: 0x2e4a4a, roughness: 0.06, metalness: 0.25, envMapIntensity: 2.4,
    transparent: true, opacity: 0.86,
  }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  const t = 0.09;
  B.box({ w, h, d, y: h / 2, mat: wood, uv: 1.2, tint: 0x6f5836, collide: false });
  B.box({ w: w - t * 2, h: h - t, d: d - t * 2, y: h - t / 2 - 0.02, mat: water, uv: 1, collide: false });
  B.box({ w: 0.12, h: 0.5, d: 0.12, x: -w / 2 + 0.1, y: 0.25, mat: wood, uv: 2, tint: 0x6f5836, collide: false });
  B.box({ w: 0.12, h: 0.5, d: 0.12, x: w / 2 - 0.1, y: 0.25, mat: wood, uv: 2, tint: 0x6f5836, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: 0, w, h, d });
  B.restore();
}

export function lampPost(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const metal = ctx.M.hoop || (ctx.M.hoop = A.plain(0x4a4038, { rough: 0.55, metal: 0.75 }));
  const glassM = ctx.M.lampGlass || (ctx.M.lampGlass = new THREE.MeshStandardMaterial({
    color: 0xffdca8, emissive: new THREE.Color(0xffb055), emissiveIntensity: 0, roughness: 0.3,
    transparent: true, opacity: 0.9,
  }));
  ctx.night.push({ mat: glassM, max: 2.6 });
  const h = o.h || 3.1;
  B.save(); B.translate(x, 0, z);
  B.box({ w: 0.16, h, d: 0.16, y: h / 2, mat: wood, uv: 1.5, tint: 0x5e4a30, collide: false });
  B.box({ w: 0.55, h: 0.08, d: 0.55, y: h - 0.34, mat: metal, uv: 2, collide: false });
  // lantern housing
  B.box({ w: 0.30, h: 0.36, d: 0.30, y: h - 0.14, mat: glassM, uv: 2, collide: false });
  B.box({ w: 0.40, h: 0.06, d: 0.40, y: h + 0.06, mat: metal, uv: 2, collide: false });
  B.box({ w: 0.06, h: 0.10, d: 0.06, y: h + 0.12, mat: metal, uv: 2, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: 0, w: 0.30, h, d: 0.30 });
  if (o.light) {
    B.light(ctx.lights, {
      type: 'point', x, y: h - 0.1, z, color: 0xffb055, intensity: 0, max: 34, distance: 20,
      decay: 1.5, castShadow: false,
    });
  }
  B.restore();
}

export function fenceRun(B, A, ctx, x0, z0, x1, z1, o = {}) {
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true, rough: 0.9 }));
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz);
  if (len < 0.1) return;
  const ang = Math.atan2(dx, dz) - Math.PI / 2;
  const n = Math.max(2, Math.round(len / 2.6));
  const rails = o.rails || 2;
  B.save(); B.translate(x0, 0, z0); B.rotateY(ang);
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * len;
    const hh = 1.18 + (Math.random() - 0.5) * 0.06;
    B.box({ w: 0.11, h: hh, d: 0.11, x: p, y: hh / 2, z: 0, mat: wood, uv: 1.5, tint: 0x7c6543, collide: false });
  }
  for (let r = 0; r < rails; r++) {
    const y = 0.46 + r * 0.52;
    B.box({ w: len, h: 0.09, d: 0.06, x: len / 2, y, z: 0, mat: wood, uv: 1.1, tint: 0x8a7049, collide: false });
  }
  // one long collider for the whole run
  B.collideBox({ x: len / 2, y: 0.7, z: 0, w: len, h: 1.4, d: 0.2 });
  B.restore();
}

export function cactus(B, A, ctx, x, z, o = {}) {
  const m = ctx.M.cactus || (ctx.M.cactus = A.mat('plaster', { vertexColors: true, rough: 0.85 }));
  const h = o.h || 1.8 + Math.random() * 1.4;
  B.save(); B.translate(x, 0, z); B.rotateY(Math.random() * TAU);
  B.cyl({ r: 0.19, h, y: h / 2, seg: 9, mat: m, uv: 1.1, tint: 0x6f7f4a, collide: false });
  B.sphere({ r: 0.19, y: h, seg: 9, seg2: 6, mat: m, tint: 0x6f7f4a });
  const arms = 1 + (Math.random() * 2 | 0);
  for (let i = 0; i < arms; i++) {
    const side = i % 2 ? 1 : -1;
    const ay = h * (0.42 + Math.random() * 0.24);
    const al = 0.45 + Math.random() * 0.35;
    B.save();
    B.translate(side * 0.19, ay, 0); B.rotateZ(side * -1.15);
    B.cyl({ r: 0.12, h: al, y: al / 2, seg: 8, mat: m, uv: 1.3, tint: 0x6f7f4a, collide: false });
    B.sphere({ r: 0.12, y: al, seg: 8, seg2: 6, mat: m, tint: 0x6f7f4a });
    B.restore();
    B.save();
    B.translate(side * 0.42, ay + al * 0.72, 0);
    B.cyl({ r: 0.12, h: al * 0.9, y: al * 0.45, seg: 8, mat: m, uv: 1.3, tint: 0x6f7f4a, collide: false });
    B.sphere({ r: 0.12, y: al * 0.9, seg: 8, seg2: 6, mat: m, tint: 0x6f7f4a });
    B.restore();
  }
  B.collideBox({ x: 0, y: h / 2, z: 0, w: 0.7, h, d: 0.7 });
  B.restore();
}

export function rock(B, A, ctx, x, z, o = {}) {
  const m = ctx.M.rock || (ctx.M.rock = A.mat('rock_mesa', { vertexColors: true, rough: 0.95 }));
  const r = o.r || 0.6 + Math.random() * 0.9;
  B.save(); B.translate(x, r * 0.32, z); B.rotateY(Math.random() * TAU);
  B.sphere({ r, y: 0, seg: 7, seg2: 5, mat: m, tint: o.tint || 0xa08b6c, rx: Math.random(), rz: Math.random() });
  B.restore();
}

export function tumbleweeds(B, A, ctx, count, radius) {
  const m = ctx.M.tumble || (ctx.M.tumble = A.mat('ground_scrub', { vertexColors: true, rough: 1, side: THREE.DoubleSide }));
  const g = new THREE.IcosahedronGeometry(0.36, 1);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const n = 0.55 + Math.random() * 0.7;
    pos.setXYZ(i, pos.getX(i) * n * 1.3, pos.getY(i) * n, pos.getZ(i) * n * 1.3);
  }
  g.computeVertexNormals();
  const inst = new THREE.InstancedMesh(g, m, count);
  inst.castShadow = true; inst.receiveShadow = false;
  ctx.tumble = inst;
  return inst;
}

// ------------------------------------------------------------------ vehicles
export function wagon(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.wagonWood || (ctx.M.wagonWood = A.mat('wood_siding', { vertexColors: true, rough: 0.88 }));
  const iron = ctx.M.hoop || (ctx.M.hoop = A.plain(0x4a4038, { rough: 0.5, metal: 0.8 }));
  const canvasM = ctx.M.canvasTop || (ctx.M.canvasTop = A.mat('plaster', { vertexColors: true, rough: 0.95, side: THREE.DoubleSide }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  const L = 3.6, W = 1.7, deckY = 0.72;
  // bed
  B.box({ w: W, h: 0.12, d: L, y: deckY, mat: wood, uv: 1.2, tint: 0x8a6f47, collide: false });
  for (const sz of [-1, 1]) B.box({ w: W, h: 0.52, d: 0.08, y: deckY + 0.32, z: sz * L / 2, mat: wood, uv: 1.2, tint: 0x7a6141, collide: false });
  for (const sx of [-1, 1]) B.box({ w: 0.08, h: 0.52, d: L, y: deckY + 0.32, x: sx * W / 2, mat: wood, uv: 1.2, tint: 0x7a6141, collide: false });
  // wheels
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const r = sz > 0 ? 0.46 : 0.62;
    B.save();
    B.translate(sx * (W / 2 + 0.05), r, sz * (L / 2 - 0.75));
    B.rotateZ(Math.PI / 2);
    B.cyl({ r, h: 0.09, seg: 14, mat: wood, uv: 1.6, tint: 0x6d5636, collide: false });
    B.cyl({ r: r * 0.16, h: 0.11, seg: 8, mat: iron, uv: 3, collide: false });
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * TAU;
      B.box({ w: 0.04, h: r * 0.95, d: 0.04, x: Math.cos(a) * r * 0.5, y: Math.sin(a) * r * 0.5, rz: a + Math.PI / 2, mat: wood, uv: 2, tint: 0x6d5636, collide: false });
    }
    B.restore();
  }
  // canvas bows + cover
  if (o.cover !== false) {
    const bows = 4;
    for (let i = 0; i < bows; i++) {
      const p = -L / 2 + 0.5 + (i / (bows - 1)) * (L - 1.0);
      B.save(); B.translate(0, deckY + 0.06, p); B.rotateZ(Math.PI / 2);
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k / 6) * Math.PI;
        B.box({ w: 0.05, h: 0.42, d: 0.05, x: Math.cos(a) * 0.45, y: Math.sin(a) * 0.45 + 0.4, rz: a + Math.PI / 2, mat: wood, uv: 2, tint: 0x7a6141, collide: false });
      }
      B.restore();
    }
    B.save(); B.translate(0, deckY + 0.86, 0);
    B.cyl({ r: 0.92, h: L - 0.9, seg: 12, mat: canvasM, uv: 0.9, tint: 0xd8cbaa, rx: Math.PI / 2, open: true, collide: false });
    B.restore();
  }
  // tongue
  B.box({ w: 0.09, h: 0.09, d: 1.5, y: deckY - 0.2, z: L / 2 + 0.7, mat: wood, uv: 1.5, tint: 0x7a6141, collide: false });
  B.collideBox({ x: 0, y: deckY + 0.3, z: 0, w: W + 0.3, h: 1.3, d: L });
  B.restore();
}

export function handcart(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: 0.9, h: 0.1, d: 1.4, y: 0.6, mat: wood, uv: 1.4, tint: 0x866c46, collide: false });
  B.save(); B.translate(0, 0.42, -0.4); B.rotateZ(Math.PI / 2);
  B.cyl({ r: 0.42, h: 0.08, seg: 12, mat: wood, uv: 2, tint: 0x6d5636, collide: false });
  B.restore();
  for (const sx of [-1, 1]) B.box({ w: 0.06, h: 0.06, d: 1.5, y: 0.6, x: sx * 0.36, z: 0.5, mat: wood, uv: 1.4, tint: 0x6d5636, collide: false });
  B.collideBox({ x: 0, y: 0.5, z: 0, w: 1.0, h: 1.0, d: 1.6 });
  B.restore();
}

export function coffin(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.crate || (ctx.M.crate = A.mat('wood_siding', { vertexColors: true, rough: 0.8 }));
  B.save(); B.translate(x, o.y || 0, z); B.rotateY(o.ry || 0);
  // hexagonal pine box
  B.box({ w: 0.62, h: 0.42, d: 1.95, y: 0.21, mat: wood, uv: 1.3, tint: o.tint || 0x7d6142, collide: false });
  B.box({ w: 0.5, h: 0.08, d: 1.75, y: 0.45, mat: wood, uv: 1.3, tint: 0x6a5138, collide: false });
  B.collideBox({ x: 0, y: 0.25, z: 0, w: 0.7, h: 0.5, d: 2.0 });
  B.restore();
}

// ------------------------------------------------------------------ furniture
export function table(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.furn || (ctx.M.furn = A.mat('wood_deck', { vertexColors: true, rough: 0.82 }));
  const legM = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const w = o.w || 1.15, d = o.d || 1.15, h = o.h || 0.78;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w, h: 0.08, d, y: h, mat: wood, uv: 1.4, tint: o.tint || 0x8a6c46, collide: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.box({ w: 0.09, h: h, d: 0.09, x: sx * (w / 2 - 0.1), y: h / 2, z: sz * (d / 2 - 0.1), mat: legM, uv: 2, tint: 0x6f5836, collide: false });
  }
  B.collideBox({ x: 0, y: h / 2, z: 0, w, h, d });
  B.restore();
}

export function chair(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.furn || (ctx.M.furn = A.mat('wood_deck', { vertexColors: true, rough: 0.82 }));
  const legM = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const h = 0.46;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: 0.44, h: 0.06, d: 0.44, y: h, mat: wood, uv: 2, tint: 0x866c46, collide: false });
  B.box({ w: 0.44, h: 0.52, d: 0.06, y: h + 0.29, z: -0.19, mat: wood, uv: 2, tint: 0x7d6340, collide: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.box({ w: 0.06, h: h, d: 0.06, x: sx * 0.17, y: h / 2, z: sz * 0.17, mat: legM, uv: 2, tint: 0x6f5836, collide: false });
  }
  B.collideBox({ x: 0, y: 0.4, z: 0, w: 0.5, h: 0.9, d: 0.5 });
  B.restore();
}

export function bar(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.furn || (ctx.M.furn = A.mat('wood_deck', { vertexColors: true, rough: 0.6 }));
  const dark = ctx.M.darkWood || (ctx.M.darkWood = A.mat('wood_deck', { vertexColors: true, rough: 0.7 }));
  const len = o.len || 9;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: len, h: 1.08, d: 0.66, y: 0.54, mat: dark, uv: 1.1, tint: 0x5d4326, collide: false });
  B.box({ w: len + 0.22, h: 0.09, d: 0.86, y: 1.12, mat: wood, uv: 1.1, tint: 0x8a6a3e, collide: false });
  B.box({ w: len, h: 0.06, d: 0.1, y: 0.26, z: 0.38, mat: wood, uv: 1.4, tint: 0x6f5836, collide: false });
  // back-bar with shelves + mirror
  B.box({ w: len, h: 2.5, d: 0.34, y: 1.25, z: -2.1, mat: dark, uv: 1.0, tint: 0x4e3a22, collide: false });
  for (let i = 0; i < 3; i++) {
    B.box({ w: len - 0.3, h: 0.07, d: 0.30, y: 1.15 + i * 0.62, z: -1.92, mat: wood, uv: 1.4, tint: 0x6f5836, collide: false });
  }
  const glassM = A.glass(0xc9d6d8, 0.30);
  B.box({ w: len * 0.7, h: 1.0, d: 0.06, y: 1.75, z: -1.86, mat: glassM, uv: 1, collide: false });
  B.collideBox({ x: 0, y: 0.6, z: 0, w: len, h: 1.2, d: 0.8 });
  B.collideBox({ x: 0, y: 1.25, z: -2.1, w: len, h: 2.5, d: 0.4 });
  B.restore();
  return { bottlesAt: (fn) => {
    const n = Math.floor(len / 0.42);
    for (let i = 0; i < n; i++) {
      const bx = -len / 2 + 0.3 + i * 0.42;
      for (let s = 0; s < 3; s++) fn(new THREE.Vector3(x + bx, 1.19 + s * 0.62, z - 1.92 + (o.ry ? 0 : 0)));
    }
  } };
}

export function bottle(B, A, ctx, x, y, z, o = {}) {
  const g = ctx.M.glassBottle || (ctx.M.glassBottle = new THREE.MeshStandardMaterial({
    color: o.color || 0x4a6b3a, roughness: 0.12, metalness: 0.0, envMapIntensity: 2.0,
    transparent: true, opacity: 0.72,
  }));
  B.save(); B.translate(x, y, z);
  B.cyl({ r: 0.035, h: 0.20, y: 0.10, seg: 7, mat: g, uv: 3, collide: false });
  B.cyl({ r: 0.016, h: 0.09, y: 0.245, seg: 6, mat: g, uv: 3, collide: false });
  B.restore();
}

export function shelf(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.furn || (ctx.M.furn = A.mat('wood_deck', { vertexColors: true, rough: 0.8 }));
  const w = o.w || 3.0, h = o.h || 2.1, d = o.d || 0.42;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  for (const sx of [-1, 1]) B.box({ w: 0.09, h, d, x: sx * w / 2, y: h / 2, mat: wood, uv: 1.4, tint: 0x775c3a, collide: false });
  const rows = Math.max(2, Math.floor(h / 0.55));
  for (let i = 0; i < rows; i++) {
    B.box({ w, h: 0.06, d, y: 0.32 + i * ((h - 0.4) / (rows - 1)), mat: wood, uv: 1.3, tint: 0x8a6c46, collide: false });
  }
  B.box({ w, h: 0.06, d, y: h, mat: wood, uv: 1.3, tint: 0x775c3a, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: 0, w, h, d });
  B.restore();
}

export function piano(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.darkWood || (ctx.M.darkWood = A.mat('wood_deck', { vertexColors: true, rough: 0.55 }));
  const keyM = ctx.M.keys || (ctx.M.keys = A.plain(0xe8e2d0, { rough: 0.35 }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: 1.5, h: 1.15, d: 0.62, y: 0.58, mat: wood, uv: 1.2, tint: 0x4a331e, collide: false });
  B.box({ w: 1.6, h: 0.09, d: 0.72, y: 1.20, mat: wood, uv: 1.2, tint: 0x56402a, collide: false });
  B.box({ w: 1.3, h: 0.05, d: 0.26, y: 0.86, z: 0.25, mat: keyM, uv: 2, collide: false });
  for (const sx of [-1, 1]) B.box({ w: 0.1, h: 1.15, d: 0.1, x: sx * 0.62, y: 0.58, z: 0.22, mat: wood, uv: 2, tint: 0x3d2a17, collide: false });
  B.collideBox({ x: 0, y: 0.6, z: 0, w: 1.6, h: 1.25, d: 0.8 });
  B.restore();
}

export function bed(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.furn || (ctx.M.furn = A.mat('wood_deck', { vertexColors: true, rough: 0.85 }));
  const clothM = ctx.M.bedding || (ctx.M.bedding = A.mat('plaster', { vertexColors: true, rough: 0.95 }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: 1.0, h: 0.42, d: 2.0, y: 0.21, mat: wood, uv: 1.3, tint: 0x775c3a, collide: false });
  B.box({ w: 1.02, h: 0.16, d: 2.02, y: 0.5, mat: clothM, uv: 1.2, tint: 0xd6c8a8, collide: false });
  B.box({ w: 0.94, h: 0.10, d: 0.62, y: 0.60, z: -0.62, mat: clothM, uv: 1.6, tint: 0xe6dcc4, collide: false });
  B.box({ w: 1.04, h: 0.85, d: 0.09, y: 0.64, z: -1.05, mat: wood, uv: 1.3, tint: 0x6f5836, collide: false });
  B.box({ w: 0.98, h: 0.5, d: 0.09, y: 0.47, z: 1.05, mat: wood, uv: 1.3, tint: 0x6f5836, collide: false });
  B.collideBox({ x: 0, y: 0.35, z: 0, w: 1.1, h: 0.7, d: 2.1 });
  B.restore();
}

export function stove(B, A, ctx, x, z, o = {}) {
  const iron = ctx.M.stove || (ctx.M.stove = A.plain(0x2a2622, { rough: 0.55, metal: 0.65 }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: 0.72, h: 0.78, d: 0.62, y: 0.39, mat: iron, uv: 1.6, collide: false });
  B.cyl({ r: 0.09, h: 1.8, y: 1.68, seg: 8, mat: iron, uv: 1.6, collide: false });
  B.collideBox({ x: 0, y: 0.4, z: 0, w: 0.8, h: 0.8, d: 0.7 });
  B.restore();
}

export function jailCell(B, A, ctx, x, z, o = {}) {
  const iron = ctx.M.bars || (ctx.M.bars = A.plain(0x32302c, { rough: 0.45, metal: 0.85 }));
  const w = o.w || 3.0, h = o.h || 2.6, d = o.d || 3.2;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  // bar wall on the +z face
  const n = Math.max(4, Math.floor(w / 0.22));
  for (let i = 0; i <= n; i++) {
    const bx = -w / 2 + (i / n) * w;
    B.box({ w: 0.045, h, d: 0.045, x: bx, y: h / 2, z: d / 2, mat: iron, uv: 2, collide: false });
  }
  B.box({ w, h: 0.07, d: 0.07, y: h, z: d / 2, mat: iron, uv: 2, collide: false });
  B.box({ w, h: 0.07, d: 0.07, y: 0.1, z: d / 2, mat: iron, uv: 2, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: d / 2, w, h, d: 0.14 });
  B.restore();
}

export function pew(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.furn || (ctx.M.furn = A.mat('wood_deck', { vertexColors: true, rough: 0.82 }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  const w = o.w || 2.4;
  B.box({ w, h: 0.08, d: 0.42, y: 0.44, mat: wood, uv: 1.4, tint: 0x7d6142, collide: false });
  B.box({ w, h: 0.62, d: 0.07, y: 0.75, z: -0.19, mat: wood, uv: 1.4, tint: 0x755a3c, collide: false });
  for (const sx of [-1, 1]) B.box({ w: 0.09, h: 0.44, d: 0.36, x: sx * (w / 2 - 0.12), y: 0.22, mat: wood, uv: 1.8, tint: 0x6f5836, collide: false });
  B.collideBox({ x: 0, y: 0.4, z: 0, w, h: 0.9, d: 0.45 });
  B.restore();
}

export function counter(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.furn || (ctx.M.furn = A.mat('wood_deck', { vertexColors: true, rough: 0.7 }));
  const w = o.w || 3.4;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w, h: 0.95, d: 0.6, y: 0.48, mat: wood, uv: 1.2, tint: 0x7d6142, collide: false });
  B.box({ w: w + 0.2, h: 0.08, d: 0.76, y: 0.99, mat: wood, uv: 1.2, tint: 0x8a6c46, collide: false });
  B.collideBox({ x: 0, y: 0.5, z: 0, w, h: 1.0, d: 0.7 });
  B.restore();
}

export function telegraphPole(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const h = o.h || 7.5;
  B.save(); B.translate(x, 0, z);
  B.cyl({ rb: 0.16, rt: 0.12, h, y: h / 2, seg: 8, mat: wood, uv: 0.8, tint: 0x6b5535, collide: false });
  B.box({ w: 1.5, h: 0.1, d: 0.1, y: h - 0.5, mat: wood, uv: 1.6, tint: 0x6b5535, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: 0, w: 0.4, h, d: 0.4 });
  B.restore();
}

// ------------------------------------------------------------------ landmark
export function waterTower(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true, rough: 0.9 }));
  const metal = ctx.M.hoop || (ctx.M.hoop = A.plain(0x4a4038, { rough: 0.55, metal: 0.75 }));
  const tankH = 4.6, tankR = 3.1, legH = 7.0;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  // four splayed legs + cross bracing
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const bx = sx * 2.0, bz = sz * 2.0, tx = sx * 2.5, tz = sz * 2.5;
    const len = Math.hypot(tx - bx, legH);
    const mx = (bx + tx) / 2, mz = (bz + bz + tz) / 2 - bz / 2;
    B.save();
    B.translate((bx + tx) / 2, legH / 2, (bz + tz) / 2);
    B.rotateZ(-Math.atan2(tx - bx, legH));
    B.box({ w: 0.26, h: len, d: 0.26, mat: wood, uv: 0.7, tint: 0x6b5535, collide: false });
    B.restore();
  }
  for (let i = 1; i <= 3; i++) {
    const y = (legH / 4) * i, sp = 2.0 + (2.5 - 2.0) * (y / legH);
    for (const ax of [0, 1]) {
      B.save(); B.translate(0, y, 0); B.rotateY(ax ? Math.PI / 2 : 0);
      B.box({ w: sp * 2, h: 0.12, d: 0.1, mat: wood, uv: 1.2, tint: 0x6b5535, collide: false });
      B.restore();
    }
    // diagonal braces
    B.save(); B.translate(0, y, sp); B.rotateZ(0.62);
    B.box({ w: 0.09, h: legH / 3.2, d: 0.09, mat: wood, uv: 1.6, tint: 0x5f4a2d, collide: false });
    B.restore();
  }
  // platform + tank
  B.box({ w: 6.4, h: 0.18, d: 6.4, y: legH, mat: wood, uv: 0.9, tint: 0x775c3a, collide: false });
  const base = legH + 0.09;
  B.cyl({ r: tankR, h: tankH, y: base + tankH / 2, seg: 18, mat: wood, uv: 0.55, tint: 0x7a5f3c, collide: false });
  for (let i = 0; i < 3; i++) {
    B.cyl({ r: tankR + 0.03, h: 0.14, y: base + tankH * (0.2 + i * 0.3), seg: 18, mat: metal, uv: 1.4, collide: false });
  }
  // conical roof
  B.save(); B.translate(0, base + tankH, 0);
  B.cyl({ rt: 0.15, rb: tankR + 0.25, h: 1.5, y: 0.75, seg: 18, mat: A.mat('roof_metal', { vertexColors: true, rough: 0.6, metal: 0.35 }), uv: 0.7, tint: 0x8c8378, collide: false });
  B.restore();
  // spout
  B.cyl({ r: 0.22, h: 2.4, y: base + 0.4, x: -tankR - 0.6, seg: 8, mat: metal, uv: 1.6, collide: false });
  B.collideBox({ x: 0, y: 2.0, z: 0, w: 4.6, h: 4.0, d: 4.6 });
  B.restore();
}

export function windmill(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const metal = ctx.M.hoop || (ctx.M.hoop = A.plain(0x4a4038, { rough: 0.5, metal: 0.8 }));
  const h = o.h || 8.5;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    B.save();
    B.translate(sx * 0.9, h / 2, sz * 0.9);
    B.rotateZ(-sx * 0.06); B.rotateX(sz * 0.06);
    B.box({ w: 0.14, h, d: 0.14, mat: wood, uv: 0.8, tint: 0x6b5535, collide: false });
    B.restore();
  }
  for (let i = 1; i < 4; i++) {
    B.save(); B.translate(0, (h / 4) * i, 0);
    for (const ax of [0, 1]) { B.save(); B.rotateY(ax ? Math.PI / 2 : 0); B.box({ w: 1.9, h: 0.08, d: 0.08, mat: wood, uv: 1.6, tint: 0x6b5535, collide: false }); B.restore(); }
    B.restore();
  }
  B.box({ w: 1.5, h: 0.16, d: 1.5, y: h, mat: wood, uv: 1.6, tint: 0x775c3a, collide: false });
  B.save(); B.translate(0, h + 0.5, 0.9);
  B.cyl({ r: 0.16, h: 1.0, seg: 8, mat: metal, uv: 2, rx: Math.PI / 2, collide: false });
  B.restore();
  // fan — stored for animation
  const fan = new THREE.Group();
  const bladeMat = A.plain(0x9a9184, { rough: 0.6, metal: 0.4, side: THREE.DoubleSide });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.30, 1.5), bladeMat);
    bl.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0);
    bl.rotation.z = a + Math.PI / 2;
    bl.rotation.y = 0.42;
    bl.castShadow = true;
    fan.add(bl);
  }
  B.cyl({ r: 0.16, h: 0.2, y: h + 0.5, z: 1.5, seg: 8, mat: metal, uv: 2, rx: Math.PI / 2, collide: false });
  fan.position.set(x, h + 0.5, z + 1.55);
  ctx.animated.push({ obj: fan, kind: 'windmill', speed: 0.55 });
  B.collideBox({ x: 0, y: 2.5, z: 0, w: 2.2, h: 5, d: 2.2 });
  B.restore();
  return fan;
}

export function railroad(B, A, ctx, o = {}) {
  const tie = ctx.M.tie || (ctx.M.tie = A.mat('wood_siding', { vertexColors: true, rough: 0.95 }));
  const rail = ctx.M.rail || (ctx.M.rail = A.plain(0x5a5248, { rough: 0.35, metal: 0.9 }));
  const len = o.len || 120, z = o.z || 0, gauge = 1.44;
  B.save(); B.translate(0, 0, z); B.rotateY(o.ry || 0);
  for (let i = 0; i < len / 0.62; i++) {
    const zz = -len / 2 + i * 0.62 + 0.31;
    B.box({ w: 2.4, h: 0.16, d: 0.24, x: 0, y: 0.08, z: zz, mat: tie, uv: 1.4, tint: 0x4a3b26, collide: false });
  }
  for (const sx of [-1, 1]) {
    B.box({ w: 0.14, h: 0.16, d: len, x: sx * gauge / 2, y: 0.24, mat: rail, uv: 1.2, collide: false });
    B.box({ w: 0.24, h: 0.06, d: len, x: sx * gauge / 2, y: 0.17, mat: rail, uv: 1.2, collide: false });
  }
  B.box({ w: 3.2, h: 0.06, d: len, y: 0.03, mat: A.mat('rock_mesa', { vertexColors: true, rough: 1 }), uv: 0.7, tint: 0x8e8271, collide: false });
  B.restore();
}

export function trainPlatform(B, A, ctx, o = {}) {
  const wood = ctx.M.deck || (ctx.M.deck = A.mat('wood_deck', { vertexColors: true, rough: 0.86 }));
  const w = o.w || 6.0, d = o.d || 26, h = 0.45;
  B.save(); B.translate(o.x || 0, 0, o.z || 0); B.rotateY(o.ry || 0);
  B.box({ w, h, d, y: h / 2, mat: wood, uv: 0.75, tint: 0x9a7f55, collide: false });
  // plank edge + steps at both ends
  B.box({ w: w + 0.1, h: 0.1, d: 0.16, y: h, z: d / 2, mat: wood, uv: 1.6, tint: 0x836a45, collide: false });
  for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
    B.box({ w: 2.2, h: 0.15, d: 0.34, y: h - 0.075 - i * 0.15, z: sz * (d / 2 + 0.17 + i * 0.34), mat: wood, uv: 1.6, tint: 0x836a45, collide: false });
  }
  B.collideBox({ x: 0, y: h / 2, z: 0, w, h, d });
  B.restore();
}

export function grainSackStack(B, A, ctx, x, z) {
  for (let i = 0; i < 3; i++) sack(B, A, ctx, x + (Math.random() - .5) * .3, z + (Math.random() - .5) * .3, { ry: Math.random() * TAU });
}

export function hayBale(B, A, ctx, x, z, o = {}) {
  const m = ctx.M.hay || (ctx.M.hay = A.mat('ground_scrub', { vertexColors: true, rough: 1 }));
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: 1.1, h: 0.72, d: 0.78, y: 0.36, mat: m, uv: 1.3, tint: 0xc0a468, collide: false });
  for (let i = 0; i < 2; i++) {
    B.box({ w: 1.16, h: 0.03, d: 0.04, y: 0.24 + i * 0.3, mat: m, uv: 2, tint: 0x7d6a3a, collide: false });
  }
  B.collideBox({ x: 0, y: 0.36, z: 0, w: 1.1, h: 0.72, d: 0.78 });
  B.restore();
}

export function hangingSign(B, A, ctx, x, y, z, o = {}) {
  const tex = o.texture;
  if (!tex) return null;
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const w = o.w || 1.6, h = o.h || 0.42;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0, envMapIntensity: 0.6, side: THREE.DoubleSide });
  B.save(); B.translate(x, y, z); B.rotateY(o.ry || 0);
  B.box({ w: w + 0.1, h: 0.07, d: 0.09, y: h / 2 + 0.06, mat: wood, uv: 2, tint: 0x5f4a2d, collide: false });
  B.box({ w, h, d: 0.05, y: -h / 2 + 0.02, mat, uv: 1, collide: false });
  B.restore();
  return mat;
}

export function signPost(B, A, ctx, x, z, o = {}) {
  const wood = ctx.M.post || (ctx.M.post = A.mat('wood_siding', { vertexColors: true }));
  const h = o.h || 2.4;
  B.save(); B.translate(x, 0, z); B.rotateY(o.ry || 0);
  B.box({ w: 0.14, h, d: 0.14, y: h / 2, mat: wood, uv: 1.4, tint: 0x6b5535, collide: false });
  B.collideBox({ x: 0, y: h / 2, z: 0, w: 0.34, h, d: 0.34 });
  B.restore();
}
