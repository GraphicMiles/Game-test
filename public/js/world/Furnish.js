import * as THREE from 'three';
import * as P from './Props.js';

/**
 * Interior dressing per shop type. Called inside the building's transform,
 * so coordinates are local: origin at the building centre, floor at `floorY`.
 */
export function furnish(type, B, A, ctx, o) {
  const { w, d, floorY } = o;
  const hw = w / 2, hd = d / 2;
  const R = (a, b) => a + Math.random() * (b - a);
  const fn = FURNISH[type];
  if (fn) fn(B, A, ctx, { w, d, hw, hd, floorY, R, ceil: (o.h || 3.6) - 0.42, o });
}

const FURNISH = {
  /* ------------------------------------------------------------- saloon */
  saloon(B, A, ctx, { w, d, hw, hd, floorY, R, ceil }) {
    // long bar down the left wall, tables to the right
    P.bar(B, A, ctx, 0, -hd + 3.6, { len: Math.min(w - 1.6, 9), ry: 0 });
    const nB = Math.floor(Math.min(w - 1.6, 9) / 0.42) * 3;
    for (let i = 0; i < nB; i++) {
      const side = i % 3;
      const bx = -Math.min(w - 1.6, 9) / 2 + 0.3 + Math.floor(i / 3) * 0.42;
      const cols = [0x4a6b3a, 0x6b4a2a, 0x2f4256, 0x6b2f2f];
      const col = cols[(i * 7 + side) % 4];
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.12, transparent: true, opacity: 0.72, envMapIntensity: 2 });
      ctx.M.bottles = ctx.M.bottles || [];
      const g = new THREE.CylinderGeometry(0.035, 0.035, 0.2, 6);
      g.translate(bx, 1.19 + side * 0.62, -hd + 3.6 - 1.92);
      B.push(g, mat);
      const g2 = new THREE.CylinderGeometry(0.016, 0.016, 0.09, 6);
      g2.translate(bx, 1.19 + side * 0.62 + 0.145, -hd + 3.6 - 1.92);
      B.push(g2, mat);
    }
    // round tables + chairs
    const nt = Math.max(2, Math.floor(w / 3));
    for (let i = 0; i < nt; i++) {
      const tx = -hw + 1.6 + i * ((w - 3.2) / Math.max(1, nt - 1));
      const tz = hd - 2.4;
      P.table(B, A, ctx, tx, tz, { w: 1.1, d: 1.1, ry: R(-0.4, 0.4) });
      P.chair(B, A, ctx, tx - 1.0, tz, { ry: Math.PI / 2 });
      P.chair(B, A, ctx, tx + 1.0, tz, { ry: -Math.PI / 2 });
      P.chair(B, A, ctx, tx, tz + 1.0, { ry: Math.PI });
    }
    // upright piano against the back wall
    P.piano(B, A, ctx, hw - 1.6, -hd + 5.2, { ry: -Math.PI / 2 });
    // poker table
    P.table(B, A, ctx, -hw + 2.2, hd - 5.2, { w: 1.5, d: 1.5 });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      P.chair(B, A, ctx, -hw + 2.2 + Math.cos(a) * 1.5, hd - 5.2 + Math.sin(a) * 1.5, { ry: -a + Math.PI / 2 });
    }
    // spittoons, crates, barrels
    P.barrel(B, A, ctx, hw - 0.8, hd - 0.9);
    P.barrel(B, A, ctx, hw - 1.7, hd - 1.1);
    P.crate(B, A, ctx, -hw + 0.9, hd - 0.9, { s: 0.62 });
    // hanging chandelier
    const chain = ctx.M.hoop || (ctx.M.hoop = A.plain(0x4a4038, { rough: 0.5, metal: 0.8 }));
    B.box({ w: 0.04, h: 0.9, d: 0.04, y: ceil - 0.55, mat: chain, uv: 3, collide: false });
    B.cyl({ rt: 0.5, rb: 0.62, h: 0.4, y: ceil - 1.2, seg: 12, mat: chain, uv: 2, collide: false });
    B.light(ctx.lights, { type: 'point', x: 0, y: ceil - 1.4, z: 0, local: true, color: 0xffa94d, intensity: 0, max: 9, distance: 14, decay: 2 });
  },

  /* -------------------------------------------------------------- store */
  general(B, A, ctx, { w, d, hw, hd, floorY, R }) {
    P.counter(B, A, ctx, 0, -hd + 1.6, { w: Math.min(w - 2, 5.5) });
    P.shelf(B, A, ctx, 0, -hd + 0.5, { w: Math.min(w - 2, 5.5), h: 2.3, d: 0.4 });
    for (const sx of [-1, 1]) {
      P.shelf(B, A, ctx, sx * (hw - 0.4), 0, { w: Math.min(d - 2, 6), h: 2.2, d: 0.4, ry: Math.PI / 2 });
    }
    // dry goods
    for (let i = 0; i < 14; i++) {
      P.crate(B, A, ctx, R(-hw + 0.9, hw - 0.9), R(-hd + 3.0, hd - 0.8), { s: R(0.45, 0.72), ry: R(0, 3) });
    }
    for (let i = 0; i < 6; i++) P.sack(B, A, ctx, R(-hw + 1, hw - 1), R(-hd + 3, hd - 1), { ry: R(0, 3) });
    P.barrel(B, A, ctx, -hw + 0.7, hd - 1.0);
    P.barrel(B, A, ctx, -hw + 1.6, hd - 1.2, { h: 0.8 });
    // canned goods row on the counter
    for (let i = 0; i < 9; i++) {
      const bx = -Math.min(w - 2, 5.5) / 2 + 0.4 + i * 0.36;
      const can = new THREE.MeshStandardMaterial({ color: [0xa8442a, 0x2f6b4a, 0x8a6a2a][i % 3], roughness: 0.5, metalness: 0.3 });
      const g = new THREE.CylinderGeometry(0.055, 0.055, 0.13, 8);
      g.translate(bx, 1.11, -hd + 1.6);
      B.push(g, can);
    }
  },

  /* -------------------------------------------------------------- hotel */
  hotel(B, A, ctx, { w, d, hw, hd, floorY }) {
    P.counter(B, A, ctx, -hw + 2.0, -hd + 1.8, { w: 3.2, ry: Math.PI / 2 });
    P.shelf(B, A, ctx, -hw + 0.4, -hd + 2.4, { w: 2.4, h: 1.9, d: 0.34, ry: Math.PI / 2 });
    // lobby seating
    P.table(B, A, ctx, hw - 2.4, -hd + 2.6, { w: 0.9, d: 0.9 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      P.chair(B, A, ctx, hw - 2.4 + Math.cos(a) * 1.1, -hd + 2.6 + Math.sin(a) * 1.1, { ry: -a + Math.PI / 2 });
    }
    // dining room
    const nt = Math.max(2, Math.floor((d - 4) / 2.6));
    for (let i = 0; i < nt; i++) {
      const tz = -hd + 4.4 + i * 2.6;
      P.table(B, A, ctx, -1.2, tz, { w: 1.3, d: 1.3 });
      P.chair(B, A, ctx, -2.6, tz, { ry: Math.PI / 2 });
      P.chair(B, A, ctx, 0.2, tz, { ry: -Math.PI / 2 });
      P.table(B, A, ctx, 2.6, tz, { w: 1.1, d: 1.1 });
      P.chair(B, A, ctx, 1.4, tz, { ry: Math.PI / 2 });
      P.chair(B, A, ctx, 3.8, tz, { ry: -Math.PI / 2 });
    }
    P.piano(B, A, ctx, hw - 1.2, hd - 2.2, { ry: -Math.PI / 2 });
    for (let i = 0; i < 4; i++) P.barrel(B, A, ctx, -hw + 0.8, -hd + 0.8 + i * 0.9);
  },

  /* ------------------------------------------------------------ sheriff */
  sheriff(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, -hw + 1.6, -hd + 1.4, { w: 2.6, ry: Math.PI / 2 });
    P.shelf(B, A, ctx, -hw + 0.4, 0, { w: 3.0, h: 1.6, d: 0.32, ry: Math.PI / 2 });
    // two cells along the right wall
    P.jailCell(B, A, ctx, hw - 2.2, 1.4, { w: 3.0, d: 3.2, h: 2.6 });
    P.jailCell(B, A, ctx, hw - 2.2, -2.0, { w: 3.0, d: 3.2, h: 2.6 });
    // solid dividing wall between the cells
    B.box({ w: 0.18, h: 2.6, d: 3.2, x: hw - 2.2, y: 1.3, z: -0.3, mat: ctx.M.trim, uv: 1.2, tint: 0x6f5836 });
    for (const cz of [1.4, -2.0]) {
      P.bed(B, A, ctx, hw - 3.0, cz, { ry: Math.PI / 2 });
    }
    P.table(B, A, ctx, 0, -hd + 2.0, { w: 1.4, d: 0.9 });
    P.chair(B, A, ctx, 0, -hd + 2.9, { ry: 0 });
    P.stove(B, A, ctx, -hw + 1.0, hd - 1.2);
  },

  /* --------------------------------------------------------------- bank */
  bank(B, A, ctx, { w, d, hw, hd }) {
    // teller grille
    const bars = ctx.M.bars || (ctx.M.bars = A.plain(0x3a342c, { rough: 0.4, metal: 0.85 }));
    const cw = Math.min(w - 2, 5.4);
    P.counter(B, A, ctx, 0, -hd + 2.2, { w: cw });
    for (let i = 0; i <= Math.floor(cw / 0.24); i++) {
      B.box({ w: 0.035, h: 1.35, d: 0.035, x: -cw / 2 + i * 0.24, y: 1.72, z: -hd + 2.2, mat: bars, uv: 2, collide: false });
    }
    B.box({ w: cw, h: 0.06, d: 0.06, y: 2.42, z: -hd + 2.2, mat: bars, uv: 2, collide: false });
    // vault
    const vault = ctx.M.stone || (ctx.M.stone = A.mat('brick', { vertexColors: true, rough: 0.9 }));
    B.box({ w: 2.6, h: 2.4, d: 2.0, x: hw - 1.8, y: 1.2, z: -hd + 1.6, mat: vault, uv: 0.9, tint: 0x8a8072 });
    B.cyl({ r: 0.62, h: 0.22, x: hw - 1.8, y: 1.2, z: -hd + 0.55, rx: Math.PI / 2, seg: 16, mat: bars, uv: 1.6, collide: false });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.box({ w: 0.07, h: 0.07, d: 0.1, x: hw - 1.8 + Math.cos(a) * 0.44, y: 1.2 + Math.sin(a) * 0.44, z: -hd + 0.48, mat: bars, uv: 2, collide: false });
    }
    P.table(B, A, ctx, -hw + 1.8, hd - 2.0, { w: 1.5, d: 1.0 });
    P.chair(B, A, ctx, -hw + 1.8, hd - 3.0, { ry: 0 });
    for (let i = 0; i < 3; i++) P.crate(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 1, 0), { s: 0.6 });
  },

  /* ---------------------------------------------------------- undertaker */
  undertaker(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, 0, -hd + 1.5, { w: Math.min(w - 2, 4.5) });
    for (let i = 0; i < 3; i++) {
      P.coffin(B, A, ctx, -hw + 1.4 + i * 1.5, hd - 2.0 - (i % 2) * 0.5, { ry: 0.06 * (i - 1) });
    }
    // coffins stacked on trestles
    for (let i = 0; i < 2; i++) {
      P.coffin(B, A, ctx, hw - 1.4, -hd + 3.4 + i * 1.1, { y: 0.62 + i * 0.5, ry: Math.PI / 2 });
    }
    P.shelf(B, A, ctx, -hw + 0.4, 0, { w: 2.6, h: 1.8, d: 0.34, ry: Math.PI / 2 });
    for (let i = 0; i < 5; i++) P.crate(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 2, hd - 1), { s: 0.55 });
    P.stove(B, A, ctx, hw - 1.0, hd - 1.0);
  },

  /* ------------------------------------------------------------- church */
  church(B, A, ctx, { w, d, hw, hd }) {
    const rows = Math.max(3, Math.floor(d / 2.2));
    for (let i = 0; i < rows; i++) {
      const tz = -hd + 1.6 + i * 2.1;
      P.pew(B, A, ctx, -1.4, tz, { w: 2.4 });
      P.pew(B, A, ctx, 1.6, tz, { w: 2.4 });
    }
    // pulpit
    B.box({ w: 1.3, h: 1.15, d: 0.7, y: 0.58, z: hd - 1.6, mat: ctx.M.darkWood || (ctx.M.darkWood = A.mat('wood_deck', { vertexColors: true, rough: 0.6 })), uv: 1.3, tint: 0x5d4326 });
    B.box({ w: 1.4, h: 0.08, d: 0.8, y: 1.2, z: hd - 1.6, mat: ctx.M.trim, uv: 1.6, tint: 0x6f5836, collide: false });
  },

  /* ------------------------------------------------------------- livery */
  livery(B, A, ctx, { w, d, hw, hd }) {
    // stalls down each side
    const stalls = Math.max(3, Math.floor(d / 3.0));
    for (let i = 0; i < stalls; i++) {
      const tz = -hd + 2.0 + i * ((d - 3.0) / Math.max(1, stalls - 1));
      for (const sx of [-1, 1]) {
        B.box({ w: 0.14, h: 1.5, d: 0.14, x: sx * (hw - 1.6), y: 1.2, z: tz, mat: ctx.M.post, uv: 1.4, tint: 0x6b5535, collide: false });
        B.box({ w: 1.6, h: 0.09, d: 0.09, x: sx * (hw - 0.85), y: 1.55, z: tz, mat: ctx.M.post, uv: 1.4, tint: 0x7d6440, collide: false });
      }
    }
    for (let i = 0; i < 8; i++) P.hayBale(B, A, ctx, R2(-hw + 1.2, hw - 1.2), R2(-hd + 1.2, hd - 1.2), { ry: R2(0, 3) });
    P.wagon(B, A, ctx, 0, hd - 2.4, { ry: Math.PI / 2, cover: false });
    P.handcart(B, A, ctx, -hw + 1.4, -hd + 1.6);
    for (let i = 0; i < 4; i++) P.barrel(B, A, ctx, hw - 0.8, -hd + 1.2 + i * 0.9);
  },

  /* ------------------------------------------------------------ printing */
  gazette(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, -hw + 2.0, 0, { w: 3.0, ry: Math.PI / 2 });
    // printing press
    const iron = ctx.M.stove || (ctx.M.stove = A.plain(0x2a2622, { rough: 0.5, metal: 0.7 }));
    B.box({ w: 1.5, h: 1.5, d: 1.0, x: 1.2, y: 0.75, z: -hd + 1.6, mat: iron, uv: 1.4, collide: false });
    B.box({ w: 1.2, h: 0.1, d: 0.8, x: 1.2, y: 1.2, z: -hd + 2.4, mat: iron, uv: 1.6, collide: false });
    B.cyl({ r: 0.42, h: 0.14, x: 1.2, y: 1.9, z: -hd + 1.6, rz: Math.PI / 2, seg: 14, mat: iron, uv: 2, collide: false });
    for (let i = 0; i < 4; i++) P.crate(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 1, 0), { s: 0.55 });
    P.shelf(B, A, ctx, hw - 0.4, -1.0, { w: Math.min(d - 2, 4), h: 1.6, d: 0.34, ry: Math.PI / 2 });
  },

  /* --------------------------------------------------------------- post */
  post(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, 0, -hd + 1.4, { w: Math.min(w - 2, 4.2) });
    // pigeon holes
    const grid = ctx.M.trim || (ctx.M.trim = A.mat('wood_siding', { vertexColors: true }));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      B.box({ w: 0.38, h: 0.30, d: 0.34, x: -1.2 + c * 0.42, y: 1.35 + r * 0.36, z: -hd + 0.5, mat: grid, uv: 2, tint: 0x6f5836, collide: false });
    }
    P.table(B, A, ctx, 0, hd - 2.2, { w: 1.4, d: 0.9 });
    for (let i = 0; i < 3; i++) P.sack(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 1, 0), { ry: R2(0, 3) });
  },

  /* ------------------------------------------------------------- clinic */
  clinic(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, -hw + 1.8, -hd + 1.4, { w: 2.6, ry: Math.PI / 2 });
    P.shelf(B, A, ctx, -hw + 0.4, 0, { w: 2.4, h: 1.8, d: 0.32, ry: Math.PI / 2 });
    // examining couch
    const cloth = ctx.M.bedding || (ctx.M.bedding = A.mat('plaster', { vertexColors: true, rough: 0.95 }));
    B.box({ w: 0.9, h: 0.6, d: 2.0, y: 0.3, x: 1.2, mat: cloth, uv: 1.2, tint: 0xd6c8a8 });
    B.box({ w: 0.94, h: 0.14, d: 2.04, y: 0.67, x: 1.2, mat: cloth, uv: 1.4, tint: 0xe6dcc4, collide: false });
    P.table(B, A, ctx, 1.2, -hd + 1.6, { w: 0.8, d: 0.6 });
    P.stove(B, A, ctx, hw - 1.0, hd - 1.0);
    for (let i = 0; i < 6; i++) P.crate(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 1, -1), { s: 0.5 });
  },

  /* ------------------------------------------------------------- tailor */
  tailor(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, 0, -hd + 1.4, { w: Math.min(w - 2, 4.0) });
    P.shelf(B, A, ctx, 0, -hd + 0.5, { w: Math.min(w - 2, 4.0), h: 1.9, d: 0.34 });
    for (const sx of [-1, 1]) P.shelf(B, A, ctx, sx * (hw - 0.4), 0, { w: Math.min(d - 2, 4), h: 1.7, d: 0.34, ry: Math.PI / 2 });
    // bolts of cloth
    const cols = [0x8a3b3b, 0x3b5a8a, 0x6b6b3a, 0x6b3a6b, 0x3a6b4a];
    for (let i = 0; i < 10; i++) {
      const col = cols[i % cols.length];
      const m = new THREE.MeshStandardMaterial({ color: col, roughness: 0.9 });
      const g = new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8);
      g.rotateZ(Math.PI / 2);
      g.translate(R2(-1.4, 1.4), R2(0.6, 1.7), -hd + 1.9);
      B.push(g, m);
    }
    P.table(B, A, ctx, 1.0, hd - 2.0, { w: 1.3, d: 0.9 });
  },

  /* ------------------------------------------------------------ gunsmith */
  gunsmith(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, 0, -hd + 1.4, { w: Math.min(w - 2, 4.4) });
    P.shelf(B, A, ctx, 0, -hd + 0.5, { w: Math.min(w - 2, 4.4), h: 2.1, d: 0.36 });
    // rifle rack
    const wood = ctx.M.trim || (ctx.M.trim = A.mat('wood_siding', { vertexColors: true }));
    for (const yy of [1.5, 2.0]) {
      B.box({ w: 2.6, h: 0.08, d: 0.14, y: yy, z: hd - 0.35, mat: wood, uv: 1.6, tint: 0x6f5836, collide: false });
    }
    for (let i = 0; i < 6; i++) {
      const g = new THREE.BoxGeometry(0.05, 1.25, 0.05);
      g.rotateZ(0.14);
      g.translate(-1.0 + i * 0.4, 2.05, hd - 0.32);
      B.push(g, new THREE.MeshStandardMaterial({ color: 0x50301c, roughness: 0.7 }));
      const b = new THREE.BoxGeometry(0.04, 0.5, 0.04);
      b.rotateZ(0.14); b.translate(-1.0 + i * 0.4, 1.62, hd - 0.32);
      B.push(b, new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.4, metalness: 0.7 }));
    }
    P.stove(B, A, ctx, -hw + 1.0, hd - 1.2);
    for (let i = 0; i < 4; i++) P.crate(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 2.5, hd - 1), { s: 0.55 });
  },

  /* ------------------------------------------------------------- office */
  office(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, 0, -hd + 1.3, { w: Math.min(w - 2, 3.6) });
    P.shelf(B, A, ctx, -hw + 0.4, 0, { w: Math.min(d - 2, 4), h: 2.0, d: 0.34, ry: Math.PI / 2 });
    P.table(B, A, ctx, 0.6, hd - 2.0, { w: 1.5, d: 0.9 });
    P.chair(B, A, ctx, 0.6, hd - 2.9, {});
    for (let i = 0; i < 3; i++) P.crate(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 2.5, hd - 1), { s: 0.55 });
  },

  /* ------------------------------------------------------------ station */
  station(B, A, ctx, { w, d, hw, hd }) {
    P.counter(B, A, ctx, -hw + 1.6, 0, { w: 2.6, ry: Math.PI / 2 });
    P.pew(B, A, ctx, 0, -hd + 1.6, { w: 2.6 });
    P.pew(B, A, ctx, 0, -hd + 3.0, { w: 2.6 });
    P.pew(B, A, ctx, 2.2, -hd + 1.6, { w: 2.0 });
    for (let i = 0; i < 5; i++) P.crate(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 1, 0), { s: 0.6 });
    P.barrel(B, A, ctx, hw - 0.9, hd - 1.0);
  },

  /* ------------------------------------------------------------- stable */
  stable(B, A, ctx, { w, d, hw, hd }) {
    for (let i = 0; i < 6; i++) P.hayBale(B, A, ctx, R2(-hw + 1, hw - 1), R2(-hd + 1, hd - 1), { ry: R2(0, 3) });
    P.handcart(B, A, ctx, -hw + 1.4, hd - 1.6);
    P.barrel(B, A, ctx, hw - 0.9, -hd + 1.0);
    P.waterTrough(B, A, ctx, 0, hd - 1.2, { w: 2.2 });
  },
};

function R2(a, b) { return a + Math.random() * (b - a); }
