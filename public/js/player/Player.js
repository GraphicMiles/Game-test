import * as THREE from 'three';
import { heightAt } from '../world/Terrain.js';

const UP = new THREE.Vector3(0, 1, 0);

/* -------------------------------------------------------------- collision */
export class CollisionWorld {
  constructor(boxes, cell = 8, slopes = []) {
    this.boxes = boxes;
    this.slopes = slopes;
    this.cell = cell;
    this.grid = new Map();
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      const x0 = Math.floor(b.x0 / cell), x1 = Math.floor(b.x1 / cell);
      const z0 = Math.floor(b.z0 / cell), z1 = Math.floor(b.z1 / cell);
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const k = x + ',' + z;
          let arr = this.grid.get(k);
          if (!arr) this.grid.set(k, arr = []);
          arr.push(i);
        }
      }
    }
    this._seen = new Set();
    this._out = [];
  }

  /** Ramp height at (x,z), or null when the point is off every ramp. */
  slopeAt(x, z) {
    const S = this.slopes;
    if (!S.length) return null;
    let best = null;
    for (let i = 0; i < S.length; i++) {
      const s = S[i];
      if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) continue;
      const t = Math.min(1, Math.max(0, ((x - s.px) * s.ux + (z - s.pz) * s.uz) / s.len));
      const y = s.y0 + (s.y1 - s.y0) * t;
      if (best === null || y > best) best = y;
    }
    return best;
  }

  /** Highest walkable surface at (x,z): terrain, floors, decks, ramps. */
  groundAt(x, z, maxAbove = 3.0) {
    let g = heightAt(x, z);
    const idx = this.query(x - 0.05, z - 0.05, x + 0.05, z + 0.05, []);
    for (const i of idx) {
      const b = this.boxes[i];
      if (x <= b.x0 || x >= b.x1 || z <= b.z0 || z >= b.z1) continue;
      if (b.y1 > g && b.y1 < g + maxAbove) g = b.y1;
    }
    const sy = this.slopeAt(x, z);
    if (sy !== null && sy > g && sy < g + maxAbove) g = sy;
    return g;
  }

  /** Colliders that could touch an AABB. */
  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const c = this.cell;
    const x0 = Math.floor(minX / c), x1 = Math.floor(maxX / c);
    const z0 = Math.floor(minZ / c), z1 = Math.floor(maxZ / c);
    if (x1 - x0 > 24 || z1 - z0 > 24) {                 // degenerate: return everything
      for (let i = 0; i < this.boxes.length; i++) out.push(i);
      return out;
    }
    this._seen.clear();
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const arr = this.grid.get(x + ',' + z);
        if (!arr) continue;
        for (const i of arr) if (!this._seen.has(i)) { this._seen.add(i); out.push(i); }
      }
    }
    return out;
  }
}

/* ----------------------------------------------------------------- player */
export class Player {
  /**
   * @param {CollisionWorld} world
   * @param {object} o { x, z, yaw }
   */
  constructor(world, o = {}) {
    this.world = world;
    this.pos = new THREE.Vector3(o.x || 0, 0, o.z || 0);
    this.vel = new THREE.Vector3();
    this.yaw = o.yaw || 0;
    this.pitch = 0;

    this.radius = 0.36;
    this.height = 1.80;
    this.crouchHeight = 1.15;
    this.eye = 1.66;
    this.eyeCrouch = 1.02;
    this.stepHeight = 0.46;

    this.speedWalk = 3.3;
    this.speedRun = 6.6;
    this.speedCrouch = 1.55;
    this.accelGround = 14;
    this.accelAir = 3.0;
    this.friction = 11;
    this.gravity = 23.5;
    this.jumpVel = 7.15;
    this.maxFall = 55;

    this.onGround = false;
    this.crouching = false;
    this.running = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.bobPhase = 0;
    this.bobAmount = 0;
    this.landDip = 0;
    this.lean = 0;
    this.leanTarget = 0;
    this.fovKick = 0;
    this.stepFlag = 0;
    this.surface = 'dirt';
    this.airTime = 0;
    this.lastY = 0;
    this.stamina = 1;

    this._idx = [];
    this._tmp = new THREE.Vector3();
    this.events = { step: null, land: null, jump: null };
  }

  get eyeHeight() { return this.crouching ? this.eyeCrouch : this.eye; }
  get bodyHeight() { return this.crouching ? this.crouchHeight : this.height; }

  /** Input: { forward, strafe, run, crouch, jump } */
  update(dt, input, opts = {}) {
    const bobScale = opts.bob !== undefined ? opts.bob : 1;

    // ------------------------------------------------------- target speed
    let f = input.forward || 0, s = input.strafe || 0;
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    this.crouching = !!input.crouch;
    const wantRun = !!input.run && !this.crouching && len > 0.1 && this.stamina > 0.02;
    this.running = wantRun;

    if (this.running) this.stamina = Math.max(0, this.stamina - dt * 0.085);
    else this.stamina = Math.min(1, this.stamina + dt * 0.14);

    let speed = this.crouching ? this.speedCrouch : (this.running ? this.speedRun : this.speedWalk);
    if (this.running && this.stamina < 0.15) speed *= 0.72;

    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const tx = (-sin * f + cos * s) * speed;
    const tz = (-cos * f - sin * s) * speed;

    // -------------------------------------------------- horizontal accel
    const rate = this.onGround ? this.accelGround : this.accelAir;
    const k = 1 - Math.exp(-rate * dt);
    if (len > 0.01) {
      this.vel.x += (tx - this.vel.x) * k;
      this.vel.z += (tz - this.vel.z) * k;
    } else if (this.onGround) {
      const fk = 1 - Math.exp(-this.friction * dt);
      this.vel.x -= this.vel.x * fk;
      this.vel.z -= this.vel.z * fk;
    }

    // ------------------------------------------------------------- jump
    this.coyote = this.onGround ? 0.12 : Math.max(0, this.coyote - dt);
    this.jumpBuffer = input.jump ? 0.14 : Math.max(0, this.jumpBuffer - dt);
    if (input.jump) this.jumpBuffer = 0.14;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vel.y = this.jumpVel;
      this.coyote = 0; this.jumpBuffer = 0; this.onGround = false;
      if (this.events.jump) this.events.jump();
    }

    // ------------------------------------------------------- integrate
    this.vel.y -= this.gravity * dt;
    if (this.vel.y < -this.maxFall) this.vel.y = -this.maxFall;

    const dist = Math.hypot(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    const steps = Math.max(1, Math.min(6, Math.ceil(dist / 0.22)));
    const h = dt / steps;
    const wasGround = this.onGround;
    this.onGround = false;
    for (let i = 0; i < steps; i++) this._step(h);

    // ------------------------------------------------------------ landing
    if (!wasGround && this.onGround) {
      const impact = Math.min(1, Math.abs(this.lastFallVel || 0) / 16);
      this.landDip = Math.min(0.30, impact * 0.30);
      if (this.events.land && impact > 0.12) this.events.land(impact);
    }
    if (!this.onGround) this.airTime += dt; else this.airTime = 0;

    // ------------------------------------------------------- head bob
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const target = this.onGround ? Math.min(1, hspeed / this.speedWalk) : 0;
    this.bobAmount += (target - this.bobAmount) * Math.min(1, dt * 8);
    const prevPhase = this.bobPhase;
    if (this.onGround) this.bobPhase += hspeed * dt * 1.62;
    // one footstep per half bob cycle
    if (Math.floor(this.bobPhase / Math.PI) !== Math.floor(prevPhase / Math.PI) && hspeed > 0.7 && this.onGround) {
      if (this.events.step) this.events.step(hspeed, this.running);
    }
    this.landDip += (0 - this.landDip) * Math.min(1, dt * 9);

    // --------------------------------------------------- lean + fov kick
    this.leanTarget = -(input.strafe || 0) * 0.028 - (this.running ? 0.006 : 0);
    this.lean += (this.leanTarget - this.lean) * Math.min(1, dt * 6);
    const fovTarget = this.running && hspeed > 3 ? 5.5 : 0;
    this.fovKick += (fovTarget - this.fovKick) * Math.min(1, dt * 4);

    this._bob = bobScale;
  }

  /** One physics sub-step: axis-separated AABB sweep with step-up. */
  _step(dt) {
    const r = this.radius;
    const H = this.bodyHeight;

    // ------------------------------------------------------------ X axis
    const nx = this.pos.x + this.vel.x * dt;
    if (this._blocked(nx, this.pos.y, this.pos.z, r, H)) {
      // try stepping up onto it
      if (this.onGround || this.vel.y <= 0.01) {
        let lifted = null;
        for (let lift = 0.08; lift <= this.stepHeight; lift += 0.08) {
          if (!this._blocked(nx, this.pos.y + lift, this.pos.z, r, H)) { lifted = lift; break; }
        }
        if (lifted !== null && !this._blocked(this.pos.x, this.pos.y + lifted, this.pos.z, r, H)) {
          this.pos.y += lifted + 0.01;
          this.pos.x = nx;
        } else { this.vel.x = 0; }
      } else { this.vel.x = 0; }
    } else { this.pos.x = nx; }

    // ------------------------------------------------------------ Z axis
    const nz = this.pos.z + this.vel.z * dt;
    if (this._blocked(this.pos.x, this.pos.y, nz, r, H)) {
      if (this.onGround || this.vel.y <= 0.01) {
        let lifted = null;
        for (let lift = 0.08; lift <= this.stepHeight; lift += 0.08) {
          if (!this._blocked(this.pos.x, this.pos.y + lift, nz, r, H)) { lifted = lift; break; }
        }
        if (lifted !== null && !this._blocked(this.pos.x, this.pos.y + lifted, this.pos.z, r, H)) {
          this.pos.y += lifted + 0.01;
          this.pos.z = nz;
        } else { this.vel.z = 0; }
      } else { this.vel.z = 0; }
    } else { this.pos.z = nz; }

    // ------------------------------------------------------------ Y axis
    const y0 = this.pos.y;
    this.pos.y += this.vel.y * dt;
    const idx = this.world.query(this.pos.x - r, this.pos.z - r, this.pos.x + r, this.pos.z + r, this._idx);
    const boxes = this.world.boxes;

    let ground = heightAt(this.pos.x, this.pos.z);
    let ceiling = Infinity;
    const FEET = 0.05;          // tolerance so you never catch on a flush surface
    for (const i of idx) {
      const b = boxes[i];
      if (this.pos.x + r <= b.x0 || this.pos.x - r >= b.x1) continue;
      if (this.pos.z + r <= b.z0 || this.pos.z - r >= b.z1) continue;
      // falling: feet were at/above the top, now at/below it
      if (y0 >= b.y1 - FEET && this.pos.y <= b.y1 + 0.002 && b.y1 > ground) ground = b.y1;
      // rising: head was below the underside, now above it
      if (this.vel.y > 0 && y0 + H <= b.y0 + FEET && this.pos.y + H > b.y0 && b.y0 < ceiling) ceiling = b.y0;
    }

    // ramps: snap up when the surface is within one step, so staircases
    // read as a smooth climb instead of a wall of risers
    const sy = this.world.slopeAt(this.pos.x, this.pos.z);
    if (sy !== null && sy > ground && sy <= y0 + this.stepHeight + 0.02) ground = sy;

    if (this.vel.y > 0 && ceiling < Infinity) {
      this.pos.y = ceiling - H;
      this.vel.y = 0;
    }

    // stay glued to the ground over small downward steps (stair descent)
    const wasGround = this.onGround;
    if (!wasGround) { /* no-op, kept for clarity */ }
    if (wasGround && this.vel.y <= 0 && this.pos.y - ground < 0.34 && this.pos.y >= ground) { /* handled below */ }
    if (this.pos.y <= ground + 0.0005 || (wasGround && this.vel.y <= 0 && ground < this.pos.y && this.pos.y - ground <= 0.34)) {
      if (this.vel.y < 0) this.lastFallVel = this.vel.y;
      this.pos.y = ground;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    if (this.vel.y < -0.1) this.lastFallVel = this.vel.y;
  }

  _blocked(x, y, z, r, H) {
    const idx = this.world.query(x - r, z - r, x + r, z + r, this._idx);
    const boxes = this.world.boxes;
    for (const i of idx) {
      const b = boxes[i];
      if (x + r <= b.x0 || x - r >= b.x1) continue;
      if (z + r <= b.z0 || z - r >= b.z1) continue;
      if (y + H <= b.y0 + 0.001) continue;
      if (y >= b.y1 - 0.05) continue;      // standing on (or above) this box
      return true;
    }
    return false;
  }

  /** Ground height directly beneath (for spawning / NPC placement). */
  groundAt(x, z) {
    let g = heightAt(x, z);
    const idx = this.world.query(x - 0.1, z - 0.1, x + 0.1, z + 0.1, []);
    for (const i of idx) {
      const b = this.world.boxes[i];
      if (x <= b.x0 || x >= b.x1 || z <= b.z0 || z >= b.z1) continue;
      if (b.y1 <= g + 4 && b.y1 > g) g = b.y1;
    }
    return g;
  }

  /** Apply the computed camera transform. */
  applyCamera(camera, t) {
    const bobScale = this._bob === undefined ? 1 : this._bob;
    const bobY = Math.sin(this.bobPhase * 2) * 0.042 * this.bobAmount * bobScale;
    const bobX = Math.cos(this.bobPhase) * 0.036 * this.bobAmount * bobScale;
    const sway = Math.sin(t * 0.7) * 0.006 + Math.sin(t * 1.9) * 0.003;
    camera.position.set(
      this.pos.x + bobX * 0.5,
      this.pos.y + this.eyeHeight + bobY - this.landDip,
      this.pos.z,
    );
    camera.rotation.set(
      this.pitch + sway * 0.14 * (1 - this.bobAmount * 0.5),
      this.yaw,
      this.lean + bobX * 0.22,
    );
  }
}

/* ------------------------------------------------------------------ input */
export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = Object.create(null);
    this.mouse = { dx: 0, dy: 0 };
    this.locked = false;
    this.enabled = false;
    this.sensitivity = 1.0;
    this.invertY = false;
    this.touch = { active: false, fwd: 0, strafe: 0, run: false, lookId: null, moveId: null };
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.pressed = Object.create(null);
    this._bind();
  }

  _bind() {
    const kd = (e) => {
      if (!this.enabled) return;
      if (e.code === 'Tab') e.preventDefault();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      this.pressed[e.code] = true;
    };
    const ku = (e) => { this.keys[e.code] = false; };
    addEventListener('keydown', kd);
    addEventListener('keyup', ku);
    addEventListener('blur', () => { this.keys = Object.create(null); });

    this.dom.addEventListener('mousedown', () => {
      if (this.enabled && !this.isTouch) this.dom.requestPointerLock?.();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      this.onLockChange?.(this.locked);
    });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked || this.dragging) {
        const s = 0.0022 * this.sensitivity;
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += (e.movementY || 0) * (this.invertY ? -1 : 1);
      }
    });
    this.dragging = false;
    this.dom.addEventListener('mousedown', () => { this.dragging = true; });
    addEventListener('mouseup', () => { this.dragging = false; });
  }

  consumeMouse() {
    const d = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return d;
  }

  consumePressed(code) {
    if (this.pressed[code]) { this.pressed[code] = false; return true; }
    return false;
  }
  endFrame() { this.pressed = Object.create(null); }

  get state() {
    const k = this.keys;
    const t = this.touch;
    let forward = 0, strafe = 0;
    if (k.KeyW || k.ArrowUp) forward += 1;
    if (k.KeyS || k.ArrowDown) forward -= 1;
    if (k.KeyD || k.ArrowRight) strafe += 1;
    if (k.KeyA || k.ArrowLeft) strafe -= 1;
    forward += t.fwd; strafe += t.strafe;
    return {
      forward, strafe,
      run: !!(k.ShiftLeft || k.ShiftRight) || t.run,
      crouch: !!(k.ControlLeft || k.KeyC || k.ControlRight),
      jump: false,
    };
  }
}
