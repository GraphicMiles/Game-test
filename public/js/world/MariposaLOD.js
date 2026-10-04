import * as THREE from 'three';
import { MeshBuilder } from './Builder.js';
import { makeMariposa } from './Mariposa.js';

export const MARIPOSA_LOD_DISTANCES = Object.freeze({ medium: 40, low: 92 });

/**
 * Build Mariposa as an independently managed, quality-biased three-level
 * distance LOD. Geometry is authored in world space by MeshBuilder, so groups
 * counter-offset the LOD's origin: the LOD can sit at the saloon for distance
 * tests without moving the baked world-space vertices.
 */
export function buildMariposaLOD(parent, worldBuilder, A, ctx, cfg, quality = {}) {
  const x = cfg.x || 0;
  const z = cfg.z || 0;
  const rot = cfg.rot || 0;
  const w = cfg.w || 19;
  const d = cfg.d || 15;

  // Preserve the shared town builder's doorway/footprint collision clean-up.
  // The saloon's visible geometry and its own walkable colliders are built in
  // the isolated high-detail builder below.
  if (worldBuilder) {
    worldBuilder.save();
    worldBuilder.translate(x, 0, z);
    worldBuilder.rotateY(rot);
    worldBuilder.clearRegion({ x: 0, y: 3.0, z: 0, w: w - 0.25, h: 6.0, d: d - 0.25 });
    worldBuilder.restore();
  }

  const lod = new THREE.LOD();
  lod.name = 'MariposaSaloonLOD';
  lod.position.set(x, 0, z);
  lod.userData.location = 'Mariposa';
  lod.userData.qualityLod = true;

  const offset = new THREE.Vector3(-x, 0, -z);
  const addLevel = (name, builder, distance) => {
    const group = new THREE.Group();
    group.name = name;
    group.position.copy(offset);
    const output = builder.build(group, { shadows: true });
    lod.addLevel(group, distance);
    return { group, output };
  };

  const highBuilder = new MeshBuilder('mariposa-lod-high');
  const buildCfg = makeMariposa(highBuilder, A, ctx, { ...cfg });
  const high = addLevel('Mariposa-LOD0-High', highBuilder, 0);
  const initialThresholds = getThresholds(quality);

  const mediumBuilder = new MeshBuilder('mariposa-lod-medium');
  makeMariposaSilhouette(mediumBuilder, A, ctx, buildCfg, 'medium');
  const medium = addLevel('Mariposa-LOD1-Medium', mediumBuilder, initialThresholds.medium);

  const lowBuilder = new MeshBuilder('mariposa-lod-low');
  makeMariposaSilhouette(lowBuilder, A, ctx, buildCfg, 'low');
  const low = addLevel('Mariposa-LOD2-Low', lowBuilder, initialThresholds.low);

  parent.add(lod);

  const stats = {
    high: { meshes: high.output.meshes.length, tris: Math.round(high.output.tris) },
    medium: { meshes: medium.output.meshes.length, tris: Math.round(medium.output.tris) },
    low: { meshes: low.output.meshes.length, tris: Math.round(low.output.tris) },
    thresholds: initialThresholds,
  };
  const setQuality = (nextQuality = {}) => {
    const thresholds = getThresholds(nextQuality);
    lod.levels[1].distance = thresholds.medium;
    lod.levels[2].distance = thresholds.low;
    stats.thresholds = thresholds;
    lod.userData.lodStats = stats;
    return thresholds;
  };
  setQuality(quality);

  return {
    lod,
    colliders: high.output.colliders,
    slopes: high.output.slopes,
    stats,
    setQuality,
  };
}

function getThresholds(quality = {}) {
  // Engine quality profiles already expose lodBias. Higher values (low spec)
  // transition sooner; lower values (ultra) preserve detail farther away.
  const lodBias = Number.isFinite(quality.lodBias) && quality.lodBias > 0 ? quality.lodBias : 1;
  const distanceScale = THREE.MathUtils.clamp(1 / lodBias, 0.5, 1.5);
  return {
    medium: MARIPOSA_LOD_DISTANCES.medium * distanceScale,
    low: MARIPOSA_LOD_DISTANCES.low * distanceScale,
  };
}

function makeMariposaSilhouette(B, A, ctx, cfg, detail) {
  const M = ctx.M;
  const w = cfg.w || 19;
  const d = cfg.d || 15;
  const h = cfg.h || 7.2;
  const hw = w / 2;
  const hd = d / 2;
  const parapet = cfg.parapet || 0;
  const facade = cfg.facade ?? 0x914735;
  const shell = M.siding || (M.siding = A.mat('wood_painted', { vertexColors: true, rough: 0.80 }));
  const trim = M.trim || (M.trim = A.mat('wood_siding', { vertexColors: true, rough: 0.78 }));
  const deck = M.deckMat || (M.deckMat = A.mat('wood_deck', { vertexColors: true, rough: 0.87 }));
  const roof = M.roofMat || (M.roofMat = A.mat('roof_metal', { vertexColors: true, rough: 0.62, metal: 0.30 }));
  const dark = M.dark || (M.dark = A.plain(0x241c14, { rough: 0.9 }));
  const roofTint = cfg.roofTint ?? 0x66574b;

  B.save();
  B.translate(cfg.x || 0, 0, cfg.z || 0);
  B.rotateY(cfg.rot || 0);

  // Low-poly massing keeps the false-front silhouette readable at town scale.
  B.box({ w: w + 0.24, h: 0.44, d: d + 0.24, y: 0.22, mat: shell, uv: 0.9,
    tint: 0x6f5836, collide: false });
  B.box({ w, h: h - 0.44, d, y: 0.44 + (h - 0.44) / 2, mat: shell, uv: 0.62,
    tint: facade, collide: false });
  if (parapet > 0.1) {
    B.box({ w: w + 0.12, h: parapet, d: 0.22, y: h + parapet / 2, z: hd,
      mat: shell, uv: 0.62, tint: facade, collide: false });
    B.box({ w: w + 0.32, h: 0.16, d: 0.34, y: h + parapet - 0.08, z: hd + 0.08,
      mat: trim, uv: 1.4, tint: 0x76543a, collide: false });
  }

  // Keep the gable and ridge even when the architectural joinery is removed.
  const rise = Math.min(2.2, d * 0.30);
  const roofAngle = Math.atan2(rise, d / 2);
  const roofLength = Math.hypot(rise, d / 2) + 0.32;
  for (const side of [-1, 1]) {
    B.save();
    B.translate(0, h + rise / 2, side * d / 4);
    B.rotateX(side * -roofAngle);
    B.box({ w: w + 0.64, h: 0.14, d: roofLength, mat: roof, uv: 0.55,
      tint: roofTint, collide: false });
    B.restore();
  }
  B.box({ w: w + 0.4, h: 0.18, d: 0.34, y: h + rise + 0.06,
    mat: trim, uv: 1.4, tint: 0x76543a, collide: false });

  addLodSign(B, ctx, cfg, hd, trim);

  if (detail === 'medium') {
    addMediumFacade(B, A, ctx, cfg, { w, d, h, hw, hd, dark, trim, deck });
  }
  B.restore();
}

function addLodSign(B, ctx, cfg, hd, trim) {
  const sign = cfg.sign;
  if (!sign) return;
  const width = sign.width || 11.5;
  const height = width * (sign.ratio || 0.20);
  const y = sign.y !== undefined ? sign.y : 7.9;
  const z = hd + 0.18;
  const wood = ctx.M.mariposaSignWood || trim;
  const face = ctx.M.mariposaSignFace;
  B.box({ w: width + 0.34, h: height + 0.28, d: 0.14, y, z,
    mat: wood, uv: 1.2, tint: 0x563423, collide: false });
  if (face) {
    B.quad({ w: width, h: height, y, z: z + 0.086, uvScale: [1, 1], mat: face, collide: false });
  }
}

function addMediumFacade(B, A, ctx, cfg, o) {
  const { w, hw, hd, dark, trim, deck } = o;
  const front = hd + 0.14;
  const glass = ctx.M.windowGlass || (ctx.M.windowGlass = A.glass(0xa9bfc6, 0.28));

  // Door, storefront windows and upper openings are simplified overlays.
  B.box({ w: 1.72, h: 2.42, d: 0.06, y: 1.62, z: front, mat: dark, uv: 1, collide: false });
  for (const x of [-hw + 0.62 + 0.6, hw - 0.62 - 0.6]) {
    B.box({ w: 1.2, h: 1.9, d: 0.055, x, y: 2.30, z: front + 0.035,
      mat: glass, uv: 1, collide: false });
    B.box({ w: 1.38, h: 2.08, d: 0.07, x, y: 2.30, z: front - 0.025,
      mat: trim, uv: 1.3, tint: 0x7d6440, collide: false });
  }

  const upper = cfg.upper || { y: 3.4, windows: 4 };
  const count = upper.windows || 4;
  const span = w - 1.6;
  for (let i = 0; i < count; i++) {
    const x = -span / 2 + (i / Math.max(1, count - 1)) * span;
    const door = upper.door;
    if (door && Math.abs(x - (door.x || 0)) < (1.2 + (door.w || 1.9)) / 2 + 0.08) continue;
    const winH = 1.71;
    const y = upper.y + 0.55 + winH / 2;
    B.box({ w: 1.2, h: winH, d: 0.055, x, y, z: front,
      mat: glass, uv: 1, collide: false });
    B.box({ w: 1.38, h: winH + 0.18, d: 0.07, x, y, z: front - 0.025,
      mat: trim, uv: 1.3, tint: 0x7d6440, collide: false });
  }

  // Shallow balcony, continuous top rail and sparse supports: enough geometry
  // for the gallery silhouette without the high-detail pickets and hardware.
  const upperY = upper.y || 3.4;
  const balconyW = w - 2.0;
  const balconyD = 1.85;
  const outerZ = hd + balconyD - 0.08;
  const deckY = upperY + 0.08;
  B.box({ w: balconyW, h: 0.16, d: balconyD, y: upperY, z: hd + balconyD / 2,
    mat: deck, uv: 0.72, tint: 0x846744, collide: false });
  B.box({ w: balconyW, h: 0.16, d: 0.16, y: deckY + 0.96, z: outerZ,
    mat: trim, uv: 1.4, tint: 0x563b2a, collide: false });
  for (let i = 0; i < 8; i++) {
    const x = -balconyW / 2 + (i / 7) * balconyW;
    B.box({ w: 0.12, h: 0.95, d: 0.12, x, y: deckY + 0.48, z: outerZ,
      mat: trim, uv: 1.4, tint: 0x64472f, collide: false });
  }

  // Porch outline: deck, front roof, and columns keep its Westworld profile.
  const porch = cfg.porch || {};
  const porchW = porch.w || w;
  const porchD = porch.depth || 3.6;
  const porchH = porch.h || 5.75;
  B.box({ w: porchW, h: 0.42, d: porchD, y: 0.21, z: hd + porchD / 2,
    mat: deck, uv: 0.62, tint: 0xa08657, collide: false });
  B.box({ w: porchW + 0.4, h: 0.14, d: porchD + 0.5, y: porchH + 0.28,
    z: hd + porchD / 2, mat: ctx.M.roofMat || trim, uv: 0.6, tint: 0x9a9184, collide: false });
  const postXs = Array.isArray(porch.postXs) ? porch.postXs : [-7, -3.5, 0, 3.5, 7];
  for (const x of postXs) {
    B.box({ w: 0.16, h: porchH - 0.42, d: 0.16, x, y: 0.42 + (porchH - 0.42) / 2,
      z: hd + porchD - 0.28, mat: trim, uv: 1.1, tint: 0x7d6440, collide: false });
  }

  // Compact side lantern volumes echo the full facade treatment.
  const glow = ctx.M.mariposaGlow;
  if (glow) {
    for (const x of [-6.35, 6.35]) {
      B.box({ w: 0.26, h: 0.42, d: 0.24, x, y: 2.90, z: hd + 0.42,
        mat: glow, uv: 1.6, collide: false });
    }
  }
}
