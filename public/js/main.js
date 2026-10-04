import * as THREE from 'three';
import { Engine, QUALITY } from './core/Engine.js';
import { Assets } from './core/Assets.js';
import { Audio } from './core/Audio.js';
import { HUD } from './ui/HUD.js';
import { Sky } from './world/Sky.js';
import { Sweetwater } from './world/Sweetwater.js';
import { Player, Input, CollisionWorld } from './player/Player.js';
import { Hosts } from './world/Hosts.js';

const TIPS = [
  'Every person you will meet in Sweetwater is a host. They are on a loop.',
  'The Mariposa serves rye, faro and trouble. Try the piano.',
  'Follow Main Street north and the chapel closes the view.',
  'The train brings new guests at the top of every hour.',
  'Bounties are posted at the Sheriff\'s Office. Ask Pickett.',
  'Hosts cannot harm you. That is the promise. Mostly.',
  'The water tower feeds the locomotive. The windmill feeds the stock.',
  'Somewhere out past the mesas, the park is much larger than this town.',
];

const LINES = {
  dolores: ['There is a path for everyone. Mine goes where I choose.',
    'I dropped a can in town once. Someone always picks it up.'],
  clementine: ['Why don\'t you come inside, stranger? It\'s cooler in the dark.'],
  sheriff: ['Looking for work? There\'s a bounty board inside.',
    'Keep your pistol holstered in town, and we\'ll get along.'],
  teddy: ['I\'ve been waiting for someone. Maybe it\'s you.'],
  black: ['I\'ve been coming here for thirty years. There\'s a deeper game.'],
  guest: ['Have you been to the Coronado? The baths are extraordinary.',
    'They say the park was built so we could find ourselves.'],
  bartender: ['Rye? Beer? Or something that\'ll take the dust off?'],
  worker: ['Freight comes in on the four o\'clock. Every day. Like clockwork.'],
};

/* ------------------------------------------------------------------ boot */
const engine = new Engine(document.getElementById('app'));
const hud = new HUD({
  onStart: () => startGame(),
  onResume: () => resumeGame(),
  onRestart: () => restart(),
  onSetting: (k, v) => applySetting(k, v),
  onTravel: (x, z) => travel(x, z),
});
hud.loading(0.02, 'Booting systems');

const TIPS_EL = document.getElementById('lspin');
let tipIdx = 0;
TIPS_EL.textContent = TIPS[0];
const tipTimer = setInterval(() => { tipIdx = (tipIdx + 1) % TIPS.length; TIPS_EL.textContent = TIPS[tipIdx]; }, 3600);

const assets = new Assets(engine.renderer);
const audio = new Audio();

let sky, town, player, hosts, collision, input;
let running = false, paused = false, worldReady = false;
const SALOON = new THREE.Vector3(-(12.6 + 15 / 2), 0, 12);
/** Arrival point: on the train platform, looking north up Main Street. */
const SPAWN = { x: 0, z: 91.2, yaw: 0 };

/* ------------------------------------------------------------ load world */
const T0 = performance.now();
const DEBUG = /[?&]debug/.test(location.search);
const mark = (s) => {
  const ms = Math.round(performance.now() - T0);
  (window.__BUILD = window.__BUILD || []).push([s, ms]);
  if (DEBUG) console.log('[build]', s, ms + 'ms');
};
(async () => {
  mark('boot');
  await assets.load((p, label) => {
    hud.loading(0.05 + p * 0.55, 'Loading ' + label);
  });

  hud.loading(0.64, 'Raising Sweetwater');
  await new Promise((r) => setTimeout(r, 30));
  mark('assets');

  sky = new Sky(engine.scene, assets, { time: engine.settings.time });
  mark('sky');
  town = new Sweetwater(engine.scene, assets, engine.q);
  mark('town');
  hud.loading(0.82, 'Waking the hosts');

  await new Promise((r) => setTimeout(r, 30));
  collision = new CollisionWorld(town.colliders, 8, town.slopes || []);
  mark('collision:' + town.colliders.length);
  hosts = new Hosts(engine.scene, assets, collision);
  mark('hosts');

  input = new Input(engine.renderer.domElement);
  player = new Player(collision, { x: 0, z: SPAWN.z, yaw: SPAWN.yaw });
  player.pos.y = collision.groundAt(SPAWN.x, SPAWN.z) + 0.1;

  player.events.step = (speed, run) => audio.step(surfaceAt(player.pos), run);
  player.events.land = (i) => audio.land(i);
  player.events.jump = () => audio.jump();

  input.onLockChange = (locked) => {
    if (!locked && running && !paused && !hud.panel && !input.isTouch) pauseGame();
  };
  hud.setPOIs(town.places.filter((p) => p.name));
  hud.loading(1.0, 'Arrival');
  mark('ready');
  worldReady = true;

  clearInterval(tipTimer);
  TIPS_EL.textContent = '';
  setTimeout(() => { hud.hideLoader(); hud.openMenu(true); }, 500);

  // gentle opening camera drift while the menu is up
  engine.clock.start();
  requestAnimationFrame(loop);
})();

/* --------------------------------------------------------------- surface */
function surfaceAt(pos) {
  // boardwalk / porch decks sit at 0.42, the street at 0
  if (Math.abs(pos.y) < 0.05) return 'dirt';
  if (pos.y > 0.3 && pos.y < 0.9) return 'wood';
  return 'dirt';
}

/* ------------------------------------------------------------ game flow */
function startGame() {
  if (!worldReady || !input) return;
  audio.init(); audio.resume();
  hud.openMenu(false);
  hud.showHud(true);
  hud.syncSettings(engine.settings);
  running = true; paused = false;
  input.enabled = true;
  if (!input.isTouch) engine.renderer.domElement.requestPointerLock?.();
  setupTouch();
  hud.toast('Welcome to Sweetwater');
  setTimeout(() => hud.toast('WASD to move · SHIFT to run · M for the town map'), 3200);
}

function pauseGame() {
  if (!running || paused) return;
  paused = true;
  input.enabled = false;
  document.exitPointerLock?.();
  hud.openPanel('pPause');
}
function resumeGame() {
  if (!running) { startGame(); return; }
  paused = false;
  hud.openPanel(null);
  input.enabled = true;
  if (!input.isTouch) engine.renderer.domElement.requestPointerLock?.();
}
function restart() {
  if (!worldReady || !input) return;
  hud.openPanel(null);
  paused = false;
  player.pos.set(SPAWN.x, collision.groundAt(SPAWN.x, SPAWN.z) + 0.1, SPAWN.z);
  player.vel.set(0, 0, 0);
  player.yaw = SPAWN.yaw; player.pitch = 0;
  input.enabled = true;
  if (!input.isTouch) engine.renderer.domElement.requestPointerLock?.();
  hud.toast('Returned to the train platform');
}
function travel(x, z) {
  const y = collision.groundAt(x, z);
  player.pos.set(x, y + 0.15, z);
  player.vel.set(0, 0, 0);
  hud.flash(0.45);
  hud.toast('Fast travel');
}

/* -------------------------------------------------------------- settings */
function applySetting(key, value) {
  const s = engine.settings;
  switch (key) {
    case 'quality':
      engine.applyQuality(value);
      if (sky) {
        const sz = QUALITY[value].shadow;
        if (sky.sun.shadow.mapSize.width !== sz) {
          sky.sun.shadow.mapSize.set(sz, sz);
          if (sky.sun.shadow.map) { sky.sun.shadow.map.dispose(); sky.sun.shadow.map = null; }
        }
      }
      break;
    case 'scale': engine.settings.scale = value; engine.applyQuality(s.quality); break;
    case 'fov': engine.setFov(value); break;
    case 'sens': input.sensitivity = value; break;
    case 'invertY': input.invertY = value; break;
    case 'volume': audio.setVolume(value); break;
    case 'bob': s.bob = value; break;
    case 'fps': s.fps = value; hud.setStats(value); break;
    case 'time': if (sky) sky.setTime(value); break;
    case 'speed': if (sky) sky.speed = value * 0.006; break;      // 100 ≈ one full day per 40 s
    default: break;
  }
  s[key] = value;
}

/* ------------------------------------------------------------------ keys */
addEventListener('keydown', (e) => {
  if (!worldReady) return;
  if (e.code === 'Escape') {
    if (hud.panel) { if (hud.panel === 'pPause') resumeGame(); else hud.openPanel(paused ? 'pPause' : null); }
    else if (running && !paused) pauseGame();
  }
  if (e.code === 'KeyM' && running) {
    if (hud.panel === 'pMap') { hud.openPanel(null); resumeGame(); }
    else { pauseGame(); hud.openPanel('pMap'); }
  }
  if (e.code === 'F3') { e.preventDefault(); engine.settings.fps = !engine.settings.fps; hud.setStats(engine.settings.fps); }
  if (e.code === 'KeyE' && running && !paused) interact();
  if (e.code === 'KeyT' && running && !paused) {
    lanternOn = !lanternOn;
    hud.toast(lanternOn ? 'Lantern lit' : 'Lantern out');
  }
});
/* ------------------------------------------------------------- interact */
let lastTalk = 0, jumpQueued = false;
addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !input.keys.Space) jumpQueued = true;
});
function interact() {
  const near = hosts.nearest(player.pos, 2.6);
  if (near) {
    const look = near.host.opts.look || 'guest';
    const pool = LINES[look] || LINES.guest;
    const line = pool[(Math.random() * pool.length) | 0];
    hud.toast(line, 4.2);
    audio.coin();
    lastTalk = performance.now();
    near.host.lookAt = true;
  }
}

/* ------------------------------------------------------------ lantern */
function buildLantern() {
  const l = new THREE.PointLight(0xffc070, 0, 14, 2);
  l.name = 'PlayerLantern';
  l.visible = false;
  engine.scene.add(l);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0 }),
  );
  mesh.visible = false;
  engine.scene.add(mesh);
  return { light: l, mesh };
}
let lantern = null;

/* --------------------------------------------------------------- loop */
let t = 0, fpsAcc = 0, fpsN = 0, fpsShown = 60, lanternOn = false, menuDrift = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = engine.tick();
  t += dt;

  if (!worldReady) { engine.render(); return; }
  hud.tick(dt);

  /* ------------------------------------------------------------ look */
  if (!running && worldReady) {
    // slow establishing shot while the menu is up
    menuDrift += dt * 0.06;
    player.yaw = Math.sin(menuDrift) * 0.28;
    player.pitch = -0.02 + Math.sin(menuDrift * 0.7) * 0.03;
  }
  if (input.enabled && !paused) {
    const m = input.consumeMouse();
    if (m.dx || m.dy) {
      player.yaw -= m.dx * 0.0022 * input.sensitivity;
      player.pitch = THREE.MathUtils.clamp(player.pitch - m.dy * 0.0022 * input.sensitivity, -1.52, 1.52);
    }
  }

  /* ----------------------------------------------------------- move */
  const st = running && !paused ? input.state : { forward: 0, strafe: 0, run: false, crouch: false, jump: false };
  if (running && !paused) { st.jump = jumpQueued; jumpQueued = false; }
  if (running && !paused) player.update(dt, st, { bob: engine.settings.bob });
  else player.update(dt, { forward: 0, strafe: 0, run: false, crouch: false, jump: false }, { bob: 0 });

  player.applyCamera(engine.camera, t);
  engine.camera.fov = engine.settings.fov + player.fovKick;
  engine.camera.updateProjectionMatrix();

  /* ------------------------------------------------------------ world */
  sky.update(dt, t);
  sky.setDomePosition(engine.camera.position);
  sky.follow(engine.camera.position, engine.q);
  town.update(dt, t, engine.camera, sky);
  if (running && !paused) hosts.update(dt, t, player.pos);

  // lantern
  if (!lantern) lantern = buildLantern();
  lantern.light.visible = lanternOn && sky.nightAmount > 0.05;
  lantern.light.intensity = 12 * sky.nightAmount;
  lantern.light.position.copy(engine.camera.position).addScaledVector(
    new THREE.Vector3(0, 0, -1).applyEuler(engine.camera.rotation), 0.9);
  lantern.mesh.visible = lantern.light.visible;
  lantern.mesh.position.copy(lantern.light.position);

  /* ------------------------------------------------------------- HUD */
  const lab = sky.label();
  hud.setClock(lab.clock, lab.mood);
  hud.updateCompass(engine.camera, engine.camera.fov);

  // place names
  for (const p of town.places) {
    if (Math.hypot(player.pos.x - p.pos.x, player.pos.z - p.pos.z) < p.radius) {
      hud.showPlace(p.name, p.sub); break;
    }
  }
  // interaction prompt
  if (running && !paused) {
    const near = hosts.nearest(player.pos, 2.4);
    hud.prompt(near ? 'Speak with host' : '', 'E');
    hud.el.cross.classList.toggle('hot', !!near);
  } else hud.prompt('');

  /* ----------------------------------------------------------- audio */
  audio.update(dt, t, player.pos, SALOON);

  /* ----------------------------------------------------------- stats */
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.4) { fpsShown = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (engine.settings.fps) {
    const i = engine.renderer.info;
    hud.setStatsText(
      `${fpsShown.toFixed(0)} fps   ${(engine.settings.scale * 100) | 0}% scale\n` +
      `draw ${i.render.calls}   tris ${(i.render.triangles / 1000).toFixed(0)}k\n` +
      `x ${player.pos.x.toFixed(1)}  y ${player.pos.y.toFixed(1)}  z ${player.pos.z.toFixed(1)}\n` +
      `colliders ${town.colliders.length}   meshes ${i.memory.geometries}`,
    );
  }

  input.endFrame();
  engine.render();
}

/* --------------------------------------------------------------- touch */
function setupTouch() {
  if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return;
  document.body.classList.add('touch');
  const base = document.getElementById('stickbase');
  const knob = document.getElementById('stickknob');
  let moveId = null, lookId = null, mx0 = 0, my0 = 0, lx = 0, ly = 0;
  const dom = engine.renderer.domElement;

  dom.addEventListener('touchstart', (e) => {
    if (!input.enabled) return;
    for (const tc of e.changedTouches) {
      if (tc.clientX < innerWidth * 0.45 && moveId === null) {
        moveId = tc.identifier; mx0 = tc.clientX; my0 = tc.clientY;
        base.style.display = 'block'; base.style.left = mx0 + 'px'; base.style.top = my0 + 'px';
        knob.style.transform = 'translate(0,0)';
      } else if (lookId === null) { lookId = tc.identifier; lx = tc.clientX; ly = tc.clientY; }
    }
    e.preventDefault();
  }, { passive: false });

  dom.addEventListener('touchmove', (e) => {
    for (const tc of e.changedTouches) {
      if (tc.identifier === moveId) {
        let dx = tc.clientX - mx0, dy = tc.clientY - my0;
        const len = Math.hypot(dx, dy), max = 52;
        if (len > max) { dx *= max / len; dy *= max / len; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        input.touch.strafe = dx / max;
        input.touch.fwd = -dy / max;
        input.touch.run = Math.min(len, max) / max > 0.92;
      } else if (tc.identifier === lookId) {
        const s = 0.0055 * input.sensitivity;
        player.yaw -= (tc.clientX - lx) * s;
        player.pitch = THREE.MathUtils.clamp(player.pitch - (tc.clientY - ly) * s, -1.52, 1.52);
        lx = tc.clientX; ly = tc.clientY;
      }
    }
    e.preventDefault();
  }, { passive: false });

  const end = (e) => {
    for (const tc of e.changedTouches) {
      if (tc.identifier === moveId) { moveId = null; input.touch.fwd = 0; input.touch.strafe = 0; input.touch.run = false; base.style.display = 'none'; }
      if (tc.identifier === lookId) lookId = null;
    }
  };
  dom.addEventListener('touchend', end);
  dom.addEventListener('touchcancel', end);

  const jb = document.getElementById('tjump');
  jb.addEventListener('touchstart', (e) => { input.keys.Space = true; e.preventDefault(); }, { passive: false });
  jb.addEventListener('touchend', (e) => { input.keys.Space = false; e.preventDefault(); }, { passive: false });
  const sb = document.getElementById('tsprint');
  sb.addEventListener('touchstart', (e) => { input.touch.run = true; sb.classList.add('on'); e.preventDefault(); }, { passive: false });
  sb.addEventListener('touchend', (e) => { input.touch.run = false; sb.classList.remove('on'); e.preventDefault(); }, { passive: false });
  sb.addEventListener('click', (e) => { lanternOn = !lanternOn; hud.toast(lanternOn ? 'Lantern lit' : 'Lantern out'); });
}

// keep the HUD authoring-time reference valid
hud.playerPos = player ? player.pos : null;
Object.defineProperty(hud, 'playerPos', {
  get() { return player ? player.pos : null; },
});
Object.defineProperty(hud, 'playerYaw', {
  get() { return player ? player.yaw : 0; },
});

// expose for debugging
window.SWEETWATER = {
  engine,
  get town() { return town; },
  get player() { return player; },
  get sky() { return sky; },
  get hosts() { return hosts; },
  get input() { return input; },
  get state() { return { running, paused, ready: worldReady, panel: hud.panel }; },
};
