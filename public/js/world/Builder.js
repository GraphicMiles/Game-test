import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

/**
 * Accumulates geometry per material and merges it into a handful of draw calls.
 * Every primitive gets world-scaled UVs (so texel density is constant no matter
 * how big the surface is) and an optional per-instance vertex-colour tint.
 */
export class MeshBuilder {
  constructor(name = 'built') {
    this.name = name;
    this.groups = new Map();      // material -> [geometry]
    this.colliders = [];          // {x0,x1,y0,y1,z0,z1}
    this.slopes = [];             // walkable ramps {a,b,...}
    this.interactables = [];      // {pos, radius, label, type, onUse}
    this.tx = new THREE.Matrix4();  // current transform
    this.stack = [];
    this.noCollide = false;
  }

  // ---------------------------------------------------------- transform stack
  save()     { this.stack.push(this.tx.clone()); return this; }
  restore()  { this.tx = this.stack.pop() || new THREE.Matrix4(); return this; }
  translate(x, y, z) { this.tx.multiply(new THREE.Matrix4().makeTranslation(x, y, z)); return this; }
  rotateY(a) { this.tx.multiply(new THREE.Matrix4().makeRotationY(a)); return this; }
  rotateX(a) { this.tx.multiply(new THREE.Matrix4().makeRotationX(a)); return this; }
  rotateZ(a) { this.tx.multiply(new THREE.Matrix4().makeRotationZ(a)); return this; }
  setTransform(m) { this.tx.copy(m); return this; }

  /** Run fn() with a fresh transform, then restore. */
  scope(fn) { this.save(); fn(); this.restore(); }

  /** Add already-transformed geometry. */
  push(geo, mat, tint = null) {
    if (!geo || !mat) return;
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.index) {
      const n = geo.attributes.position.count;
      const idx = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    // a vertex-coloured material needs the attribute on EVERY merged geometry
    if (mat.vertexColors && !geo.attributes.color) paint(geo, tint || 0xffffff);
    else if (tint) paint(geo, tint);
    if (geo.attributes.uv && !geo.attributes.uv1) geo.setAttribute('uv1', geo.attributes.uv.clone());
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(geo);
  }

  /**
   * Box with world-scaled UVs.
   * @param o {w,h,d,x,y,z,ry,rx,rz,uv,uvTop,mat,tint,collide}
   */
  box(o) {
    const { w, h, d } = o;
    const g = new THREE.BoxGeometry(w, h, d, o.seg ? o.seg : 1, o.seg ? o.seg : 1, o.seg ? o.seg : 1);
    scaleBoxUV(g, w, h, d, o.uv || 0.5, o.uvTop);
    place(g, o, this.tx);
    if (o.tint) paint(g, o.tint);
    this.push(g, o.mat);
    if (o.collide !== false && !this.noCollide) {
      const c = boxBounds(o, this.tx);
      if (c) this.colliders.push(c);
    }
    return g;
  }

  /** Thin plank / board — the workhorse of western carpentry. */
  plank(o) { return this.box(o); }

  cyl(o) {
    const g = new THREE.CylinderGeometry(o.rt !== undefined ? o.rt : o.r, o.rb !== undefined ? o.rb : o.r,
      o.h, o.seg || 10, 1, !!o.open);
    // cylindrical UVs scaled by circumference & height
    const uvA = g.attributes.uv;
    const circ = Math.PI * 2 * (o.r || 0.5);
    for (let i = 0; i < uvA.count; i++) {
      uvA.setXY(i, uvA.getX(i) * circ * (o.uv || 0.5), uvA.getY(i) * (o.h * (o.uv || 0.5)));
    }
    place(g, o, this.tx);
    if (o.tint) paint(g, o.tint);
    this.push(g, o.mat);
    if (o.collide && !this.noCollide) {
      const c = boxBounds({ ...o, w: (o.r || 0.5) * 2, d: (o.r || 0.5) * 2 }, this.tx);
      if (c) this.colliders.push(c);
    }
    return g;
  }

  sphere(o) {
    const g = new THREE.SphereGeometry(o.r, o.seg || 12, o.seg2 || 8);
    place(g, o, this.tx);
    if (o.tint) paint(g, o.tint);
    this.push(g, o.mat);
    return g;
  }

  /** Triangular prism — gable ends, roof ridges, ramps. */
  wedge(o) {
    const { w, h, d } = o;
    const hw = w / 2, hh = h, hd = d / 2;
    const verts = new Float32Array([
      -hw, 0, hd, hw, 0, hd, hw, hh, hd, -hw, 0, hd, hw, hh, hd, -hw, hh, hd, // +z face
      hw, 0, -hd, -hw, 0, -hd, -hw, hh, -hd, hw, 0, -hd, -hw, hh, -hd, hw, hh, -hd, // -z
      -hw, 0, -hd, -hw, 0, hd, -hw, hh, hd, -hw, 0, -hd, -hw, hh, hd, -hw, hh, -hd, // -x
      hw, 0, hd, hw, 0, -hd, hw, hh, -hd, hw, 0, hd, hw, hh, -hd, hw, hh, hd, // +x
      -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, -hd, hw, 0, hd, -hw, 0, hd, // bottom
    ]);
    const uvs = new Float32Array(30 * 2);
    const uv = o.uv || 0.5;
    const set = (i0, a, b, c, d2, e, f) => {
      const p = [a, b, c, d2, e, f];
      for (let k = 0; k < 6; k++) { uvs[(i0 + k) * 2] = p[k * 2] * uv; uvs[(i0 + k) * 2 + 1] = p[k * 2 + 1] * uv; }
    };
    set(0, 0, 0, w, 0, 0, h); set(0, 0, 0, w, 0, 0, h);
    // simpler: flat triplanar UVs
    for (let i = 0; i < 30; i++) {
      const x = verts[i * 3], y = verts[i * 3 + 1], z = verts[i * 3 + 2];
      uvs[i * 2] = (x + z) * uv; uvs[i * 2 + 1] = (y + Math.abs(z) * 0.6) * uv;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.computeVertexNormals();
    place(g, o, this.tx);
    if (o.tint) paint(g, o.tint);
    this.push(g, o.mat);
    return g;
  }

  /** Flat quad (ground sheets, rugs, posters, water). */
  quad(o) {
    const g = new THREE.PlaneGeometry(o.w, o.h || o.d, o.seg, o.seg2);
    const uvA = g.attributes.uv, uv = o.uv || 0.5;
    for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * o.w * uv, uvA.getY(i) * (o.h || o.d) * uv);
    if (o.flat) g.rotateX(-Math.PI / 2);
    place(g, o, this.tx);
    if (o.tint) paint(g, o.tint);
    this.push(g, o.mat);
    return g;
  }

  /** Queue a runtime light, remembering the transform it was declared under. */
  light(list, cfg) { list.push({ ...cfg, _m: this.tx.clone() }); }

  /** Collider from a LOCAL box, transformed by the current transform. */
  collideBox(o) {
    if (this.noCollide) return;
    this.colliders.push(boxBounds(o, this.tx));
  }

  /** Register a raw world-space AABB collider (invisible wall, doorway frame, etc). */
  wall(x, z, w, d, y0 = 0, y1 = 4) {
    this.colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0, y1 });
  }

  /** Merge everything into meshes and add to `parent`. */
/**
 * Drop every already-registered collider that overlaps a local-space box.
 * Used to guarantee a walkable path from the street into every doorway —
 * furniture, barrels, hitching rails and porch clutter never seal a shop.
 */
  clearRegion(o) {
    const box = boxBounds(o, this.tx);
    this.colliders = this.colliders.filter(c =>
      c.x1 <= box.x0 || c.x0 >= box.x1 ||
      c.z1 <= box.z0 || c.z0 >= box.z1 ||
      c.y1 <= box.y0 || c.y0 >= box.y1);
    return this;
  }

  /**
   * Register a walkable ramp.  Staircases are drawn as discrete steps but
   * collide as one smooth slope, so the player glides up them instead of
   * catching a toe on every riser.
   *   o = { x, z, w, d, y0, y1, axis }
   * `axis` is the uphill direction in LOCAL space: 'z', '-z', 'x' or '-x'
   * (y0 is the low end, y1 the high end).  The transform rotates it.
   */
  slope(o) {
    const hw = (o.w || 1) / 2, hd = (o.d !== undefined ? o.d : 1) / 2;
    const axis = o.axis || 'z';
    const alongX = axis === 'x' || axis === '-x';
    const dir = (axis === '-z' || axis === '-x') ? -1 : 1;   // uphill direction
    const yA = o.y0 !== undefined ? o.y0 : (o.y || 0);       // low end
    const yB = o.y1 !== undefined ? o.y1 : yA + (o.h || 0);  // high end
    const cx = o.x || 0, cz = o.z || 0;
    const ax = alongX ? dir * hw : 0, az = alongX ? 0 : dir * hd;
    const s = new THREE.Vector3(cx - ax, yA, cz - az).applyMatrix4(this.tx);   // low end
    const e = new THREE.Vector3(cx + ax, yB, cz + az).applyMatrix4(this.tx);   // high end
    const dx = e.x - s.x, dz = e.z - s.z, len = Math.hypot(dx, dz);
    if (len < 1e-4) return this;
    // lateral corners give the true world footprint of the ramp
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const c0 = alongX ? [[cx - ax, cz - hd], [cx - ax, cz + hd]] : [[cx - hw, cz - az], [cx + hw, cz - az]];
    const c1 = alongX ? [[cx + ax, cz - hd], [cx + ax, cz + hd]] : [[cx - hw, cz + az], [cx + hw, cz + az]];
    for (const [lx, lz, ly] of [...c0.map(c => [c[0], c[1], yA]), ...c1.map(c => [c[0], c[1], yB])]) {
      const v = new THREE.Vector3(lx, ly, lz).applyMatrix4(this.tx);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x);
      z0 = Math.min(z0, v.z); z1 = Math.max(z1, v.z);
    }
    this.slopes.push({
      x0: x0 - 0.05, x1: x1 + 0.05, z0: z0 - 0.05, z1: z1 + 0.05,
      px: s.x, pz: s.z, ux: dx / len, uz: dz / len, len, y0: s.y, y1: e.y,
    });
    return this;
  }

  build(parent, { shadows = true, colliders = true } = {}) {
    const meshes = [];
    let tris = 0;
    for (const [mat, geos] of this.groups) {
      if (!geos.length) continue;
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      if (!merged.attributes.uv1) merged.setAttribute('uv1', merged.attributes.uv.clone());
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = shadows && mat.opacity === undefined ? true : shadows;
      mesh.receiveShadow = shadows;
      mesh.matrixAutoUpdate = false;
      mesh.userData.builder = this.name;
      parent.add(mesh);
      meshes.push(mesh);
      tris += merged.index ? merged.index.count / 3 : merged.attributes.position.count / 3;
      for (const g of geos) g.dispose();
    }
    this.groups.clear();
    this.stats = { meshes: meshes.length, tris: Math.round(tris), colliders: this.colliders.length, slopes: this.slopes.length };
    return { meshes, colliders: colliders ? this.colliders : [], slopes: this.slopes, tris };
  }
}

// ------------------------------------------------------------------ helpers
function place(g, o, tx) {
  _e.set(o.rx || 0, o.ry || 0, o.rz || 0);
  _q.setFromEuler(_e);
  _v.set(o.x || 0, o.y || 0, o.z || 0);
  _m.compose(_v, _q, _s);
  if (tx) _m.premultiply(tx);
  g.applyMatrix4(_m);
}

function paint(g, tint) {
  const n = g.attributes.position.count;
  const c = new THREE.Color(tint);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

function scaleBoxUV(g, w, h, d, uv, uvTop) {
  const a = g.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z  (4 verts each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const sc = (f === 2 || f === 3) && uvTop ? uvTop : uv;
    const [fw, fh] = dims[f];
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      a.setXY(idx, a.getX(idx) * fw * sc, a.getY(idx) * fh * sc);
    }
  }
}

function boxBounds(o, tx) {
  const yaw = o.ry || 0, pit = o.rx || 0, rol = o.rz || 0;
  const W = o.w, H = o.h, D = o.d !== undefined ? o.d : o.h;
  const local = new THREE.Matrix4();
  const ee = new THREE.Euler(pit, yaw, rol);
  const qq = new THREE.Quaternion().setFromEuler(ee);
  local.compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), qq, new THREE.Vector3(1, 1, 1));
  const m = tx ? new THREE.Matrix4().multiplyMatrices(tx, local) : local;
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    v.set((i & 1 ? 1 : -1) * W / 2, (i & 2 ? 1 : -1) * H / 2, (i & 4 ? 1 : -1) * D / 2).applyMatrix4(m);
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }
  return { x0: minX, x1: maxX, z0: minZ, z1: maxZ, y0: minY, y1: maxY };
}

export { boxBounds, paint };
