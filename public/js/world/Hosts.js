import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Sweetwater's population. Every host is a procedural low-poly figure on a
 * fixed narrative loop; horses are the real GLB asset, morphed into a walk.
 */

const SKIN = [0xd9ab86, 0xc4916c, 0xa87450, 0x8a5a3a, 0xe0c0a0];
const CLOTH = {
  dolores: { shirt: 0xbcd4e6, skirt: 0x2f5f8a, trim: 0xf0e4cc },
  clementine: { shirt: 0xc4486a, skirt: 0x8e2f4a, trim: 0xe8d0a8 },
  teddy: { shirt: 0xd8cbaa, skirt: 0x6a5334, trim: 0x8a3a2a },
  sheriff: { shirt: 0x8a9aa8, skirt: 0x3a4048, trim: 0xc8963c },
  guest: { shirt: 0xc8bda0, skirt: 0x5a4a34, trim: 0x9a8a6a },
  bartender: { shirt: 0xe4dcc4, skirt: 0x3a3228, trim: 0x6a5a3a },
  worker: { shirt: 0xa89a80, skirt: 0x4a3f2c, trim: 0x7a6a4a },
  black: { shirt: 0x2a2622, skirt: 0x14120f, trim: 0x8a7442 },

  // Scouted character archetypes from sweetwater-human-model-scout.html
  westernCowboy: { shirt: 0xd0c4ae, skirt: 0x382d22, trim: 0x6f4c2c, hat: 0x4a3828 }, // Ref 01
  cowboyGirl: { shirt: 0xc87050, skirt: 0x384c60, trim: 0x7a4d2c, hat: 0x5a3e2a },    // Ref 02
  cowboyLady: { shirt: 0x40322c, skirt: 0x684e3a, trim: 0x8c6442, hat: 0x32241b },    // Ref 03
  cowboyElderly: { shirt: 0xb4a896, skirt: 0x443d34, trim: 0x584c3c, hat: 0x786a58, skin: 0xb48260 }, // Ref 04
  wildWestOutlaw: { shirt: 0x8c2c28, skirt: 0x262220, trim: 0x4c3c2e, hat: 0x221d1a }, // Ref 05 / 07
  frontierSeries: { shirt: 0x8fa286, skirt: 0x443a28, trim: 0xbca472, hat: 0x544634 }, // Ref 06
};

function box(w, h, d, x, y, z, ry = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rz) g.rotateZ(rz);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}
function cyl(rt, rb, h, x, y, z, seg = 8, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (rx) g.rotateX(rx);
  if (rz) g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}
function sph(r, x, y, z, seg = 10) {
  const g = new THREE.SphereGeometry(r, seg, seg * 0.7);
  g.translate(x, y, z);
  return g;
}
function merged(parts) { return mergeGeometries(parts, false); }

/** Build one host figure. Returns { root, parts } with animatable limbs. */
function makeFigure(A, opts = {}) {
  const look = CLOTH[opts.look || 'guest'] || CLOTH.guest;
  const skin = look.skin ? new THREE.Color(look.skin) : new THREE.Color(SKIN[(Math.random() * SKIN.length) | 0]);
  const female = !!opts.female;
  const scale = opts.scale || 1;

  const mSkin = A.plain(skin.getHex(), { rough: 0.78 });
  const mShirt = A.plain(look.shirt, { rough: 0.86 });
  const mSkirt = A.plain(look.skirt, { rough: 0.88 });
  const mTrim = A.plain(look.trim, { rough: 0.7 });
  const mDark = A.plain(0x2a211a, { rough: 0.8 });
  const mHat = A.plain(opts.hatColor || look.hat || 0x6a5334, { rough: 0.9 });

  const root = new THREE.Group();
  const H = 1.76 * scale;

  /* ------------------------------------------------------------ torso */
  const torsoParts = [];
  if (female) {
    torsoParts.push(cyl(0.19 * scale, 0.26 * scale, 1.30 * scale, 0, 0.60 * scale, 0, 10)); // skirt
    torsoParts.push(cyl(0.155 * scale, 0.18 * scale, 0.60 * scale, 0, 1.05 * scale, 0, 10)); // bodice
    torsoParts.push(box(0.40 * scale, 0.10 * scale, 0.28 * scale, 0, 1.28 * scale, 0)); // shoulders
  } else {
    torsoParts.push(cyl(0.20 * scale, 0.23 * scale, 0.72 * scale, 0, 1.02 * scale, 0, 10));
    torsoParts.push(box(0.44 * scale, 0.12 * scale, 0.26 * scale, 0, 1.34 * scale, 0));
    torsoParts.push(cyl(0.215 * scale, 0.20 * scale, 0.34 * scale, 0, 0.62 * scale, 0, 10)); // hips
  }
  const torso = new THREE.Mesh(merged(torsoParts), female ? mSkirt : mShirt);
  torso.castShadow = true; torso.receiveShadow = true;
  root.add(torso);

  // vest / apron / gunbelt
  const trimParts = [];
  if (female) {
    trimParts.push(cyl(0.265 * scale, 0.26 * scale, 0.09 * scale, 0, 0.14 * scale, 0, 12));
    trimParts.push(box(0.06 * scale, 0.62 * scale, 0.05 * scale, 0, 1.02 * scale, 0.19 * scale));
  } else {
    trimParts.push(cyl(0.235 * scale, 0.235 * scale, 0.10 * scale, 0, 0.72 * scale, 0, 12)); // belt
    trimParts.push(box(0.10 * scale, 0.08 * scale, 0.08 * scale, 0.20 * scale, 0.72 * scale, 0.02 * scale)); // buckle
    trimParts.push(box(0.26 * scale, 0.52 * scale, 0.06 * scale, 0, 1.02 * scale, 0.20 * scale)); // vest front
    if (opts.gun) {
      trimParts.push(box(0.07 * scale, 0.16 * scale, 0.07 * scale, 0.20 * scale, 0.78 * scale, 0.10 * scale));
      trimParts.push(box(0.07 * scale, 0.07 * scale, 0.14 * scale, 0.20 * scale, 0.70 * scale, 0.18 * scale));
    }
  }
  const trim = new THREE.Mesh(merged(trimParts), mTrim);
  trim.castShadow = true;
  root.add(trim);

  /* ------------------------------------------------------------- head */
  const headG = new THREE.Group();
  headG.position.y = (female ? 1.44 : 1.50) * scale;
  const headParts = [
    sph(0.135 * scale, 0, 0.10 * scale, 0),
    cyl(0.055 * scale, 0.07 * scale, 0.14 * scale, 0, 0.03 * scale, 0.10 * scale, 8, Math.PI / 2),
  ];
  const head = new THREE.Mesh(merged(headParts), mSkin);
  head.castShadow = true;
  headG.add(head);

  if (opts.hat !== false) {
    const hatParts = [];
    if (female) {
      hatParts.push(cyl(0.18 * scale, 0.22 * scale, 0.12 * scale, 0, 0.20 * scale, -0.02 * scale, 12));
      hatParts.push(cyl(0.11 * scale, 0.13 * scale, 0.10 * scale, 0, 0.26 * scale, 0.02 * scale, 10));
    } else {
      hatParts.push(cyl(0.30 * scale, 0.32 * scale, 0.035 * scale, 0, 0.20 * scale, 0, 14));
      hatParts.push(cyl(0.135 * scale, 0.155 * scale, 0.19 * scale, 0, 0.30 * scale, 0, 12));
      hatParts.push(cyl(0.158 * scale, 0.158 * scale, 0.03 * scale, 0, 0.225 * scale, 0, 12));
    }
    const hat = new THREE.Mesh(merged(hatParts), mHat);
    hat.castShadow = true;
    headG.add(hat);
  }
  root.add(headG);

  /* ------------------------------------------------------------- arms */
  const mkArm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.235 * scale, (female ? 1.28 : 1.34) * scale, 0);
    const upper = [cyl(0.055 * scale, 0.05 * scale, 0.36 * scale, 0, -0.18 * scale, 0, 7)];
    const lower = [cyl(0.048 * scale, 0.042 * scale, 0.34 * scale, 0, -0.52 * scale, 0, 7),
      sph(0.055 * scale, 0, -0.71 * scale, 0, 7)];
    const a1 = new THREE.Mesh(merged(upper), mShirt);
    const a2 = new THREE.Mesh(merged(lower), mSkin);
    a1.castShadow = true; a2.castShadow = true;
    g.add(a1); g.add(a2);
    return g;
  };
  const armL = mkArm(-1), armR = mkArm(1);
  root.add(armL); root.add(armR);

  /* ------------------------------------------------------------- legs */
  const mkLeg = (side) => {
    const g = new THREE.Group();
    g.position.set(side * 0.10 * scale, 0.78 * scale, 0);
    const legG = female ? mSkirt : mSkirt;
    const l1 = new THREE.Mesh(merged([cyl(0.075 * scale, 0.065 * scale, 0.44 * scale, 0, -0.22 * scale, 0, 7)]), legG);
    const l2 = new THREE.Mesh(merged([
      cyl(0.062 * scale, 0.055 * scale, 0.34 * scale, 0, -0.60 * scale, 0, 7),
      box(0.11 * scale, 0.10 * scale, 0.24 * scale, 0, -0.82 * scale, 0.04 * scale),
    ]), mDark);
    l1.castShadow = true; l2.castShadow = true;
    g.add(l1); g.add(l2);
    return g;
  };
  const legL = mkLeg(-1), legR = mkLeg(1);
  root.add(legL); root.add(legR);

  root.scale.setScalar(1);
  return { root, head: headG, armL, armR, legL, legR, height: H };
}

/* ------------------------------------------------------------------ host */
class Host {
  constructor(A, opts) {
    this.opts = opts;
    this.fig = makeFigure(A, opts);
    this.root = this.fig.root;
    this.speed = opts.speed || 1.15;
    this.path = (opts.path || []).map((p) => new THREE.Vector3(p[0], 0, p[1]));
    this.i = 0;
    this.t = Math.random() * 10;
    this.paused = 0;
    this.state = 'walk';
    this.dir = new THREE.Vector3(0, 0, 1);
    this.idleAnim = opts.idle || null;
    this.talking = false;
    this.lookAt = opts.lookAt !== false;
    if (this.path.length) {
      this.root.position.copy(this.path[0]);
      this.root.position.y = opts.y !== undefined ? opts.y : 0.42;
    }
    this.baseY = this.root.position.y;
    this.phase = Math.random() * 6.28;
  }

  update(dt, t, playerPos) {
    this.t += dt;
    const p = this.root.position;

    /* ------------------------------------------------------ navigation */
    if (this.path.length > 1) {
      if (this.paused > 0) {
        this.paused -= dt;
        this.state = 'idle';
      } else {
        const target = this.path[this.i];
        const d = new THREE.Vector3(target.x - p.x, 0, target.z - p.z);
        const dist = d.length();
        if (dist < 0.35) {
          this.i = (this.i + 1) % this.path.length;
          if (this.opts.pause) this.paused = this.opts.pause * (0.6 + Math.random() * 0.9);
        } else {
          d.normalize();
          this.dir.lerp(d, Math.min(1, dt * 4));
          p.x += d.x * this.speed * dt;
          p.z += d.z * this.speed * dt;
          this.state = 'walk';
        }
      }
    } else {
      this.state = 'idle';
    }

    const yaw = Math.atan2(this.dir.x, this.dir.z);
    this.root.rotation.y = yaw;

    /* --------------------------------------------------------- posing */
    const walking = this.state === 'walk';
    const sp = walking ? this.speed : 0;
    const cyc = this.phase + t * sp * 3.1;
    const amp = walking ? 0.62 : 0.0;
    this.fig.legL.rotation.x = Math.sin(cyc) * amp;
    this.fig.legR.rotation.x = -Math.sin(cyc) * amp;
    this.fig.armL.rotation.x = -Math.sin(cyc) * amp * 0.66;
    this.fig.armR.rotation.x = Math.sin(cyc) * amp * 0.66;
    this.fig.armL.rotation.z = 0.06 + Math.sin(cyc) * 0.02;
    this.fig.armR.rotation.z = -0.06 - Math.sin(cyc) * 0.02;

    // breathing / idle sway
    const br = Math.sin(t * 1.4 + this.phase) * 0.012;
    this.root.position.y = this.baseY + br + (walking ? Math.abs(Math.sin(cyc)) * 0.035 : 0);
    this.fig.head.rotation.z = Math.sin(t * 0.7 + this.phase) * 0.03;

    if (this.idleAnim === 'polish') {
      this.fig.armR.rotation.x = -1.1 + Math.sin(t * 5.5) * 0.32;
      this.fig.armL.rotation.x = -0.5 + Math.sin(t * 5.5 + 1) * 0.1;
    } else if (this.idleAnim === 'piano') {
      this.fig.armL.rotation.x = -0.95 + Math.sin(t * 7.2) * 0.16;
      this.fig.armR.rotation.x = -0.95 + Math.sin(t * 7.2 + 1.6) * 0.16;
      this.fig.head.rotation.x = Math.sin(t * 1.2) * 0.08;
    } else if (this.idleAnim === 'sweep') {
      this.fig.armL.rotation.x = -0.9 + Math.sin(t * 2.1) * 0.30;
      this.fig.armR.rotation.x = -0.9 + Math.sin(t * 2.1) * 0.26;
      this.root.rotation.y = yaw + Math.sin(t * 2.1) * 0.10;
    } else if (this.idleAnim === 'drink') {
      this.fig.armR.rotation.x = -1.5 + Math.sin(t * 0.9) * 0.12;
    }

    /* ------------------------------------------------- look at player */
    if (this.lookAt && playerPos) {
      const d = new THREE.Vector3(playerPos.x - p.x, 0, playerPos.z - p.z);
      if (d.length() < 9) {
        const want = Math.atan2(d.x, d.z) - this.root.rotation.y;
        const wrap = Math.atan2(Math.sin(want), Math.cos(want));
        const target = THREE.MathUtils.clamp(wrap, -0.85, 0.85);
        this.fig.head.rotation.y += (target - this.fig.head.rotation.y) * Math.min(1, dt * 3.2);
      } else {
        this.fig.head.rotation.y *= (1 - Math.min(1, dt * 2));
      }
    }
  }
}

/* --------------------------------------------------------------- manager */
export class Hosts {
  constructor(scene, assets, collision) {
    this.scene = scene;
    this.A = assets;
    this.collision = collision;
    this.group = new THREE.Group();
    this.group.name = 'Hosts';
    scene.add(this.group);
    this.hosts = [];
    this.horses = [];
    this.mixers = [];
    this.build();
  }

  groundAt(x, z) {
    return this.collision ? this.collision.groundAt(x, z) : 0;
  }

  add(opts) {
    const h = new Host(this.A, opts);
    h.root.position.y = opts.y !== undefined ? opts.y : this.groundAt(h.root.position.x, h.root.position.z);
    h.baseY = h.root.position.y;
    this.group.add(h.root);
    this.hosts.push(h);
    return h;
  }

  build() {
    /* ------------------------------------------------------ Main Street
       Buildings occupy |x| > 12.6 except at their doorways, so paths stay
       on the street / boardwalk (|x| <= 12) and only duck through a door
       at that building's own z.                                          */
    // Dolores: general store -> street -> back again (door at z = -16)
    this.add({
      look: 'dolores', female: true, speed: 1.05, pause: 3.5,
      path: [[-11.4, -6], [-11.4, -16], [-15.0, -16], [-15.6, -20], [-15.0, -20.5], [-11.4, -16.5], [-11.4, -8], [-6.0, -2]],
    });
    // Clementine on the Mariposa porch (door at z = 12)
    this.add({
      look: 'clementine', female: true, pause: 5, speed: 0.85,
      path: [[11.2, 7], [11.2, 17], [11.9, 17], [11.2, 7]],
    });
    // Sheriff Pickett working the street
    this.add({
      look: 'sheriff', gun: true, speed: 1.0, pause: 4,
      path: [[-5.0, -44], [5.0, -50], [5.0, -18], [-5.0, 6], [-5.0, -22], [4.0, -40]],
    });
    // Teddy on the boardwalk by the saloon
    this.add({
      look: 'teddy', gun: true, pause: 6, speed: 1.0,
      path: [[11.0, 14], [11.0, 22], [10.6, 23.5]],
    });
    // The Man in Black, motionless at the far end of the street
    this.add({
      look: 'black', gun: true, hatColor: 0x141210, pause: 999,
      path: [[0, -71]], lookAt: true, idle: 'idle',
    });
    // guests arriving from the station
    this.add({
      look: 'guest', female: false, speed: 1.25,
      path: [[2.0, 74], [2.0, 38], [-3.0, 18], [-3.0, 56], [3.0, 74]], pause: 2,
    });
    this.add({
      look: 'guest', female: true, speed: 1.1,
      path: [[-2.5, 72], [-2.5, 32], [3.0, 10], [3.0, 42], [-1.0, 70]], pause: 2.5,
    });
    // townsfolk
    this.add({
      look: 'worker', speed: 1.0, pause: 4,
      path: [[-11.0, 42], [-11.0, 56], [-7.0, 58], [-7.0, 40]],
    });
    this.add({
      look: 'worker', female: true, speed: 0.95, pause: 3,
      path: [[11.0, -26], [11.0, -38], [7.5, -44], [7.5, -22]],
    });
    this.add({
      look: 'guest', speed: 1.15, pause: 3,
      path: [[36, 1.5], [54, 0.5], [54, 6], [36, 6.5]],
    });
    // station master
    this.add({
      look: 'worker', pause: 6, speed: 0.9,
      path: [[-6, 89.0], [6, 89.0], [6, 88.2], [-6, 88.2]],
    });
    // a loiterer by the water tower
    this.add({
      look: 'worker', pause: 8, speed: 0.85,
      path: [[-28, 74], [-28, 66], [-24, 64]],
    });

    /* ------------------------------------------- scouted cast archetypes */
    // Ref 01: Western Cowboy (Rigged) on the boardwalk by the livery
    this.add({
      look: 'westernCowboy', gun: true, speed: 1.05, pause: 3.5,
      path: [[-10.8, -2], [-10.8, 12], [-6.5, 14], [-6.5, 0]],
    });
    // Ref 02: Cowboy Girl 1 walking near the station plaza
    this.add({
      look: 'cowboyGirl', female: true, speed: 1.1, pause: 3,
      path: [[5.0, 62], [5.0, 46], [-2.0, 44], [-2.0, 60]],
    });
    // Ref 03: Cowboy Lady on the Mariposa upper balcony
    this.add({
      look: 'cowboyLady', female: true, pause: 8, speed: 0.75, y: 4.88,
      path: [[-11.8, 8.5], [-11.8, 15.5]],
    });
    // Ref 04: Cowboy Elderly resting on the hotel porch bench
    this.add({
      look: 'cowboyElderly', gun: true, pause: 999,
      path: [[11.4, 38]], idle: 'idle', lookAt: true,
    });
    // Ref 05 & 07: Wild West Outlaw lurking at the livery alley
    this.add({
      look: 'wildWestOutlaw', gun: true, pause: 6, speed: 0.9,
      path: [[-12.0, -32], [-6.0, -32], [-6.0, -42], [-12.0, -42]],
    });
    // Ref 06: Western Characters Series 2025 patrolling south boardwalk
    this.add({
      look: 'frontierSeries', gun: true, speed: 1.15, pause: 4,
      path: [[10.8, -48], [10.8, -62], [4.5, -60], [4.5, -48]],
    });

    /* ---------------------------------------------------- interior hosts */
    // Mariposa: centre x = -(12.6 + 15/2), z = 12; local +Z = world +X,
    // local +X = world -Z
    const saloonCx = -(12.6 + 15 / 2), saloonCz = 12;
    const inSaloon = (lx, lz) => [saloonCx + lz, saloonCz - lx];

    const bt = this.add({ look: 'bartender', pause: 999, path: [inSaloon(0, -5.6)], idle: 'polish' });
    bt.root.rotation.y = Math.PI / 2; bt.dir.set(1, 0, 0); bt.baseY = 0.52;

    const pn = this.add({ look: 'guest', pause: 999, path: [inSaloon(6.2, -3.6)], idle: 'piano' });
    pn.root.rotation.y = -Math.PI / 2; pn.dir.set(-1, 0, 0); pn.baseY = 0.52;

    const seats = [[-4.2, 4.6], [-0.6, 4.9], [3.2, 4.4]];
    for (let i = 0; i < seats.length; i++) {
      const t = this.add({
        look: i === 2 ? 'worker' : 'guest', female: i === 1, pause: 999,
        path: [inSaloon(seats[i][0], seats[i][1])], idle: i === 0 ? 'drink' : null,
      });
      t.root.rotation.y = -Math.PI / 2 + (Math.random() - .5) * 0.7;
      t.dir.set(0, 0, -1); t.baseY = 0.52;
    }

    // Coronado desk clerk (east row: local +Z = world -X, local +X = world +Z)
    const hotelCx = (12.6 + 15 / 2), hotelCz = 44;
    const inHotel = (lx, lz) => [hotelCx - lz, hotelCz + lx];
    const cl = this.add({ look: 'guest', pause: 999, path: [inHotel(0, -5.4)], idle: 'polish' });
    cl.root.rotation.y = -Math.PI / 2; cl.dir.set(-1, 0, 0); cl.baseY = 0.52;

    /* ------------------------------------------------------------ horses */
    this.buildHorses();
  }

  buildHorses() {
    const model = this.A.models.horse;
    if (!model) return;
    const src = model.scene || model.scenes[0];
    let srcMesh = null;
    src.traverse((o) => { if (o.isMesh && !srcMesh) srcMesh = o; });
    if (!srcMesh) return;

    srcMesh.geometry.computeBoundingBox();
    const bb = srcMesh.geometry.boundingBox;
    const size = new THREE.Vector3(); bb.getSize(size);
    const targetH = 2.35;                       // withers height incl. head
    const k = targetH / Math.max(size.y, 0.001);

    const spots = [
      { x: -7.2, z: 34, ry: 0.15, tied: true },
      { x: 7.6, z: -6, ry: -0.2, tied: true },
      { x: 5.4, z: 58, ry: 0.6, tied: true },
      { x: -28, z: 32, ry: 1.2, tied: false },
      { x: -31, z: 27, ry: -0.7, tied: false },
      { x: 44, z: 24, ry: 2.4, tied: false },
    ];
    for (const s of spots) {
      const root = new THREE.Group();
      const m = srcMesh.clone();
      m.material = srcMesh.material.clone();
      m.castShadow = true; m.receiveShadow = true;
      m.scale.setScalar(k);
      m.position.y = 0;
      root.add(m);
      root.position.set(s.x, this.groundAt(s.x, s.z), s.z);
      root.rotation.y = s.ry + Math.PI / 2;   // model faces -X by default
      this.group.add(root);
      const mixer = new THREE.AnimationMixer(m);
      if (model.animations && model.animations.length) {
        const clip = model.animations[0];
        const action = mixer.clipAction(clip);
        action.play();
        action.timeScale = s.tied ? 0.0 : 0.35;
        if (s.tied) { action.paused = true; action.time = 0.35 * clip.duration; }
      }
      this.mixers.push(mixer);
      this.horses.push({ root, mesh: m, mixer, tied: s.tied, phase: Math.random() * 6 });
    }
  }

  update(dt, t, playerPos) {
    for (const h of this.hosts) h.update(dt, t, playerPos);
    for (const mx of this.mixers) mx.update(dt);
    // idle horse movement: slight weight shift + tail-less bob
    for (const h of this.horses) {
      if (!h.tied) continue;
      h.root.position.y += Math.sin(t * 0.8 + h.phase) * 0.0004;
      h.root.rotation.z = Math.sin(t * 0.5 + h.phase) * 0.008;
    }
  }

  /** Nearest host within `range`, used for the interaction prompt. */
  nearest(pos, range = 2.6) {
    let best = null, bd = range;
    for (const h of this.hosts) {
      const d = h.root.position.distanceTo(pos);
      if (d < bd) { bd = d; best = h; }
    }
    return best ? { host: best, dist: bd } : null;
  }
}
