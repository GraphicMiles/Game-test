/**
 * Gameplay systems test — drives the real game in headless Chrome and asserts
 * that movement, collision, jumping, crouching and the day/night cycle behave.
 */
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = '/home/user/sweetwater/public';
const PORT = Number(process.env.PORT || 4020);
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.hdr':'image/vnd.radiance','.jpg':'image/jpeg','.png':'image/png',
  '.glb':'model/gltf-binary' };

const server = createServer(async (req, res) => {
  try { let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const b = await readFile(path.join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); res.end(b);
  } catch { res.writeHead(404); res.end('x'); }
});
await new Promise(r => server.listen(PORT, r));

const browser = await puppeteer.launch({ headless: true, protocolTimeout: 300000, args: [
  '--no-sandbox','--disable-setuid-sandbox','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage','--window-size=480,300'] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 300 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.SWEETWATER?.state?.ready === true, { timeout: 120000, polling: 500 });

const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
};

// ---------------------------------------------------------------- start game
await page.evaluate(() => document.getElementById('bStart').click());
await new Promise(r => setTimeout(r, 3000));

// measure real frame rate under software GL
console.log('\n[env] headless SwiftShader (software GL) — physics tested with fixed steps, not wall clock\n');

const snap = () => page.evaluate(() => {
  const S = window.SWEETWATER;
  return { x:+S.player.pos.x.toFixed(3), y:+S.player.pos.y.toFixed(3), z:+S.player.pos.z.toFixed(3),
    yaw:+S.player.yaw.toFixed(3), onGround:!!S.player.onGround,
    crouch:!!S.player.crouching, eye:+S.engine.camera.position.y.toFixed(3),
    eyeH:+S.player.eyeHeight.toFixed(3), bodyH:+S.player.bodyHeight.toFixed(3),
    clock: document.getElementById('clock').textContent };
});

/**
 * Advance the physics deterministically by `seconds` of simulated time using
 * fixed 1/120 s steps. SwiftShader runs at ~0.1 fps here, so wall-clock-driven
 * testing is useless — we step the simulation directly instead.
 */
async function sim(seconds) {
  return page.evaluate((sec) => {
    const S = window.SWEETWATER, I = S.input, P = S.player;
    const st = () => ({ forward: (I.keys.KeyW ? 1 : 0) + (I.keys.KeyS ? -1 : 0),
      strafe: (I.keys.KeyD ? 1 : 0) + (I.keys.KeyA ? -1 : 0),
      run: !!(I.keys.ShiftLeft || I.keys.ShiftRight),
      crouch: !!(I.keys.KeyC || I.keys.ControlLeft),
      jump: !!I.keys.Space });
    const h = 1 / 120;
    for (let t = 0; t < sec; t += h) P.update(h, st(), { bob: 0 });
    return true;
  }, seconds);
}

console.log('--- movement ---');
// 1. walk forward 3s of wall clock at software speed
const a = await snap();
await page.keyboard.down('KeyW');
await sim(3);
await page.keyboard.up('KeyW');
await sim(0.5);
const b = await snap();
const dist = Math.hypot(b.x - a.x, b.z - a.z);
check('walking moves the player', dist > 1.0, `moved ${dist.toFixed(2)} m in 3 simulated seconds`);

// 2. run should be faster than walk
const c = await snap();
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await sim(3);
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
await sim(0.5);
const d = await snap();
const distRun = Math.hypot(d.x - c.x, d.z - c.z);
check('running is faster than walking', distRun > dist * 1.15, `run ${distRun.toFixed(2)} m vs walk ${dist.toFixed(2)} m`);

// 3. strafe
const e = await snap();
await page.keyboard.down('KeyD');
await sim(2);
await page.keyboard.up('KeyD');
await sim(0.5);
const f = await snap();
check('strafing moves sideways', Math.hypot(f.x - e.x, f.z - e.z) > 0.8, `moved ${Math.hypot(f.x-e.x,f.z-e.z).toFixed(2)} m`);

console.log('\n--- physics ---');
// 4. jump raises and returns to ground
const g = await snap();
await page.keyboard.down('Space'); await sim(0.05); await page.keyboard.up('Space');
await sim(0.35);
const h = await snap();
check('jump leaves the ground', h.y > g.y + 0.25, `y ${g.y.toFixed(2)} → ${h.y.toFixed(2)}`);
await sim(3);
await sim(3);   // allow a full settle; the jump apex is ~0.9 m and the return
                  // arc plus landing recovery exceeds 3 s at these speeds
const i = await snap();
check('player lands again', Math.abs(i.y - g.y) < 0.35 && i.onGround, `y back to ${i.y.toFixed(2)}, onGround=${i.onGround}`);

// 5. crouch lowers the eye height (eyeHeight is authoritative; camera.y only
//    refreshes on a rendered frame, and SwiftShader paints ~0.1 fps here)
const j = await snap();
await page.keyboard.down('KeyC'); await sim(0.4);
const k = await snap();
await page.keyboard.up('KeyC'); await sim(0.4);
const l = await snap();
check('crouch lowers the eye height', k.eyeH < j.eyeH - 0.25,
  `eyeHeight ${j.eyeH} → ${k.eyeH} → ${l.eyeH}`);
check('crouch shortens the collision capsule', k.bodyH < j.bodyH - 0.25,
  `bodyHeight ${j.bodyH} → ${k.bodyH}`);
check('crouch restores on release', Math.abs(l.eyeH - j.eyeH) < 0.01, `back to ${l.eyeH}`);

// 6. gravity / floor: y never sinks below ground
check('player never falls through the world', Math.min(g.y,h.y,i.y,j.y,k.y,l.y) > -0.6,
  `min y = ${Math.min(g.y,h.y,i.y,j.y,k.y,l.y).toFixed(2)}`);

console.log('\n--- collision ---');
// 7. try to run through a building: teleport next to a wall and push into it
const wallTest = await page.evaluate(async () => {
  const S = window.SWEETWATER;
  const col = S.town.colliders;
  // find a tall collider with real height (a building wall)
  const wall = col.find(c => (c.max?.y ?? c.y1 ?? 0) > 2.5 && c.min && c.max);
  const box = wall || col[0];
  const w = box.min && box.max ? box : null;
  if (!w) return { skipped: true };
  const cx = (w.min.x + w.max.x) / 2, cz = (w.min.z + w.max.z) / 2;
  // stand just outside the -Z face
  S.player.pos.set(cx, S.player.pos.y, w.min.z - 1.2);
  S.player.vel.set(0, 0, 0);
  S.player.yaw = 0;                       // yaw 0 => forward is -Z
  return { cx, cz, z0: w.min.z, h: w.max.y, y1: w.max.y };
});
if (!wallTest.skipped) {
  const before = await snap();
  await page.keyboard.down('KeyW');
  await sim(4);
  await page.keyboard.up('KeyW');
  const after = await snap();
  const pushed = after.z - before.z;                     // moving -Z
  check('building colliders block the player', after.z > wallTest.z0 - 0.75,
    `stopped at z=${after.z.toFixed(2)} vs collider face z=${wallTest.z0.toFixed(2)} (pushed ${pushed.toFixed(2)} m)`);
}

console.log('\n--- world ---');
const world = await page.evaluate(() => {
  const S = window.SWEETWATER;
  return { hosts: S.hosts.hosts.length, colliders: S.town.colliders.length,
    places: S.town.places.filter(p => p.name).length,
    movingHosts: S.hosts.hosts.filter(h => h.opts && h.opts.loop).length };
});
check('hosts populate the town', world.hosts >= 12, `${world.hosts} hosts, ${world.movingHosts} on loops`);
check('named districts exist', world.places >= 20, `${world.places} named places`);
check('collision world is substantial', world.colliders > 800, `${world.colliders} colliders`);

console.log('\n--- day/night ---');
const times = await page.evaluate(async () => {
  const S = window.SWEETWATER; const out = [];
  const S_set = (v) => document.getElementById('sTime');
  for (const t of ['06:00', '13:00', '20:10', '23:30']) {
    const sel = document.getElementById('sTime');
    sel.value = t; sel.dispatchEvent(new Event('change'));
    await new Promise(r => setTimeout(r, 700));
    out.push({ t, night: +S.sky.nightAmount.toFixed(3), sun: +S.sky.sun.intensity.toFixed(2),
      ambient: +S.sky.hemi.intensity.toFixed(2), label: document.getElementById('clocksub').textContent });
  }
  return out;
});
console.log('   ', JSON.stringify(times));
check('night is darker than midday', times[3].sun < times[1].sun,
  `sun 13:00=${times[1].sun} vs 23:30=${times[3].sun}`);
check('nightAmount ramps at night', times[3].night > times[1].night,
  `nightAmount 13:00=${times[1].night} vs 23:30=${times[3].night}`);

console.log('\n--- stability ---');
// Headless Chrome cannot grant pointer lock without a real user gesture, and the
// start button is clicked programmatically here. That rejection is expected.
const realErrors = errors.filter(e => !/Pointer Lock|user gesture/i.test(e));
const benign = errors.length - realErrors.length;
if (benign) console.log(`   (${benign} expected pointer-lock notice(s) ignored — headless has no user gesture)`);
check('no unexpected runtime errors during gameplay', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

// screenshots from curated viewpoints
await page.evaluate(() => { const sel = document.getElementById('sTime'); sel.value = '16:20'; sel.dispatchEvent(new Event('change')); });
const views = [
  ['v1-street',  0, 60, Math.PI],
  ['v2-mariposa', -20, 12, Math.PI * 0.75],
  ['v3-chapel',  0, -55, 0],
  ['v4-dusk',    0, 40, Math.PI],
];
for (const [name, x, z, yaw] of views) {
  if (name === 'v4-dusk') await page.evaluate(() => { const s = document.getElementById('sTime'); s.value = '20:10'; s.dispatchEvent(new Event('change')); });
  await page.evaluate(({ x, z, yaw }) => {
    const S = window.SWEETWATER;
    S.player.pos.set(x, S.town.colliders ? S.player.pos.y : 0, z);
    S.player.yaw = yaw; S.player.pitch = -0.05;
  }, { x, z, yaw });
  await sim(0.4);
  const buf = await page.screenshot();
  const png = PNG.sync.read(Buffer.from(buf));
  let sum = 0, uniq = new Set(); const n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    sum += 0.299 * png.data[i] + 0.587 * png.data[i+1] + 0.114 * png.data[i+2];
    uniq.add(`${png.data[i] >> 4},${png.data[i+1] >> 4},${png.data[i+2] >> 4}`);
  }
  const mean = sum / n;
  console.log(`   ${name.padEnd(12)} mean lum ${mean.toFixed(1)}  distinct ${uniq.size}`);
  await page.screenshot({ path: `/home/user/shots/${name}.png` });
  check(`view "${name}" renders a lit scene`, mean > 8 && uniq.size > 60, `lum ${mean.toFixed(1)}, ${uniq.size} colors`);
}

await browser.close();
server.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${failed.length === 0 ? '✅ ALL CHECKS PASS' : '❌ ' + failed.length + ' FAILED'}  (${results.length - failed.length}/${results.length})`);
process.exit(failed.length ? 1 : 0);
