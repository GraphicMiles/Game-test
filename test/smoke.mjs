/**
 * Browser smoke test — boots the real game in headless Chrome with WebGL.
 *
 * This is the check that static analysis cannot do: it proves the module graph
 * resolves in a browser (importmap + bare `three` specifier), that the HDRIs and
 * GLB assets decode, that the world builds, and that the render loop runs with
 * no shader or JS errors.
 *
 *   node test/smoke.mjs
 */
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = 3999;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.hdr': 'image/vnd.radiance',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.glb': 'model/gltf-binary' };

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const buf = await readFile(path.join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(buf);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  headless: true,
  protocolTimeout: 600000,            // SwiftShader is slow; never let CDP time out
  args: [
    '--disable-dev-shm-usage',
    '--no-sandbox', '--disable-setuid-sandbox',
    '--use-gl=angle', '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--window-size=1280,760',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 760 });

const errors = [], warnings = [], logs = [];
page.on('console', (m) => {
  const t = m.type(), x = `${t}: ${m.text()}`;
  if (t === 'error') errors.push(x);
  else if (t === 'warning') warnings.push(x);
  else logs.push(x);
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));

console.log('→ booting http://localhost:' + PORT);
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });

// Wait for the world to finish building (main.js sets window.SWEETWATER with state.ready).
let ready = false;
try {
  await page.waitForFunction(
    () => window.SWEETWATER && window.SWEETWATER.state && window.SWEETWATER.state.ready === true,
    { timeout: 90000, polling: 250 });
  ready = true;
} catch { /* reported below */ }

await new Promise((r) => setTimeout(r, 1500));

const probe = await page.evaluate(() => {
  const S = window.SWEETWATER || {};
  const info = S.engine?.renderer?.info;
  return {
    build: window.__BUILD || [],
    colliders: S.town?.colliders?.length ?? null,
    hosts: S.hosts?.hosts?.length ?? null,
    places: (S.town?.places || []).map((p) => p.name).filter(Boolean),
    drawCalls: info?.render?.calls ?? null,
    triangles: info?.render?.triangles ?? null,
    geometries: info?.memory?.geometries ?? null,
    textures: info?.memory?.textures ?? null,
    camera: S.engine?.camera ? {
      x: +S.engine.camera.position.x.toFixed(2),
      y: +S.engine.camera.position.y.toFixed(2),
      z: +S.engine.camera.position.z.toFixed(2) } : null,
    player: S.player ? { x: +S.player.pos.x.toFixed(2), y: +S.player.pos.y.toFixed(2), z: +S.player.pos.z.toFixed(2) } : null,
    webgl: (() => { const c = document.querySelector('canvas');
      return c ? { w: c.width, h: c.height } : null; })(),
  };
});

// Render a few frames and confirm the canvas is not a blank/black frame.
const pix = await page.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return null;
  const g = document.createElement('canvas');
  g.width = 160; g.height = 96;
  const ctx = g.getContext('2d');
  ctx.drawImage(c, 0, 0, 160, 96);
  const d = ctx.getImageData(0, 0, 160, 96).data;
  let sum = 0, min = 255, max = 0, uniq = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
    sum += l; if (l < min) min = l; if (l > max) max = l;
    uniq.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4}`);
  }
  return { mean: +(sum / (d.length / 4)).toFixed(1), min, max, distinctColors: uniq.size };
});

await page.screenshot({ path: process.env.SHOT || '/tmp/shot-menu.png' });

console.log('\n=== BUILD TIMELINE ===');
for (const [s, ms] of probe.build) console.log(`  ${String(ms).padStart(6)}ms  ${s}`);
console.log('\n=== WORLD ===');
console.log('  colliders :', probe.colliders);
console.log('  hosts     :', probe.hosts);
console.log('  places    :', probe.places.length, '->', probe.places.join(' · '));
console.log('  player    :', JSON.stringify(probe.player));
console.log('  camera    :', JSON.stringify(probe.camera));
console.log('  canvas    :', JSON.stringify(probe.webgl));
console.log('\n=== RENDER ===');
console.log('  draw calls:', probe.drawCalls, ' triangles:', probe.triangles);
console.log('  geometries:', probe.geometries, ' textures:', probe.textures);
console.log('  pixels    :', JSON.stringify(pix));
console.log('\n=== CONSOLE ===');
console.log('  errors:', errors.length, ' warnings:', warnings.length);
for (const e of errors.slice(0, 25)) console.log('   ✗', e);
for (const w of warnings.slice(0, 8)) console.log('   !', w);

await browser.close();
server.close();

const ok = ready && errors.length === 0 && pix && pix.distinctColors > 40 && probe.colliders > 50;
console.log('\n' + (ok ? '✅ SMOKE TEST PASS' : '❌ SMOKE TEST FAIL'));
process.exit(ok ? 0 : 1);
