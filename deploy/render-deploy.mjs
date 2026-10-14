#!/usr/bin/env node
/**
 * Create (or reuse) the Sweetwater web service on Render and trigger a deploy.
 *
 *   RENDER_API_KEY=rnd_xxx node deploy/render-deploy.mjs
 *
 * Idempotent: if a service with the target name already exists it is reused and
 * updated rather than duplicated. Prints the live URL on success.
 */
const KEY = process.env.RENDER_API_KEY;
if (!KEY) {
  console.error('RENDER_API_KEY is not set.\nCreate one at https://dashboard.render.com/u/settings#api-keys');
  process.exit(2);
}

const API = 'https://api.render.com/v1';
const OWNER = 'GraphicMiles';
const REPO = 'Game-test';
const NAME = process.env.RENDER_SERVICE_NAME || 'sweetwater';
const REGION = process.env.RENDER_REGION || 'oregon';
const PLAN = process.env.RENDER_PLAN || 'free';
const BRANCH = process.env.RENDER_BRANCH || 'main';
const MULTIPLAYER = process.env.RENDER_MULTIPLAYER || '0';   // '0' = relay enabled

const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' };

async function api(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await res.text();
  let body; try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body.message || body.error || body.raw || `${res.status} ${res.statusText}`;
    const e = new Error(`Render API ${res.status}: ${msg}`);
    e.status = res.status; e.body = body; throw e;
  }
  return body;
}

/* ---------------------------------------------------------------- helpers */
async function findOwner() {
  const owners = await api('/owners?limit=100');
  return owners.find(o => o.owner?.name?.toLowerCase() === OWNER.toLowerCase())?.owner
      || owners[0]?.owner;
}

async function findService(id) {
  const services = await api(`/services?limit=100&ownerId=${id}`);
  return services.find(s => s.service?.name === NAME || s.service?.slug === NAME)?.service;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
const statusEmoji = s => ({ live: '🟢', build_failed: '🔴', build_in_progress: '🟡',
  update_in_progress: '🟡', deploy_in_progress: '🟡', suspended: '😴',
  canceled: '⚪️', deprovisioned: '⚪️' }[s] || '⚪️');

/* ------------------------------------------------------------------- main */
(async () => {
  console.log('Render API: authenticating…');
  const owner = await findOwner();
  if (!owner) throw new Error('No Render owner found for this API key.');
  console.log(`  owner: ${owner.name} (${owner.id})`);

  let svc = await findService(owner.id);

  const config = {
    name: NAME,
    type: 'web_service',
    repo: `https://github.com/${OWNER}/${REPO}`,
    branch: BRANCH,
    runtime: 'node',
    region: REGION,
    plan: PLAN,
    buildCommand: 'npm install --omit=dev',
    startCommand: 'node server.js',
    healthCheckPath: '/healthz',
    autoDeploy: 'yes',
    envVars: [
      { key: 'NODE_VERSION', value: '20' },
      { key: 'NODE_ENV', value: 'production' },
      { key: 'NO_MULTIPLAYER', value: MULTIPLAYER },
    ],
  };

  if (svc) {
    console.log(`  found existing service: ${svc.name} (${svc.id})`);
    console.log('  updating configuration…');
    await api(`/services/${svc.id}`, { method: 'PATCH', body: JSON.stringify(config) });
  } else {
    console.log(`  creating new service "${NAME}"…`);
    const body = { ...config, ownerId: owner.id };
    const created = await api('/services', { method: 'POST', body: JSON.stringify(body) });
    svc = created.service || created;
    console.log(`  created: ${svc.id}`);
  }

  // Trigger a deploy
  console.log('  triggering deploy…');
  let deploy;
  try {
    deploy = await api(`/services/${svc.id}/deploys`, { method: 'POST', body: JSON.stringify({ clearCache: 'clear' }) });
  } catch (e) {
    // A deploy may already be in flight from the PATCH/POST; that is fine.
    if (!/409|already/i.test(String(e.message))) throw e;
    console.log('  a deploy was already in flight');
  }
  const deployId = deploy?.id || deploy?.deploy?.id;

  // Poll until live
  const URL = svc.url || `https://${svc.name}.onrender.com`;
  console.log(`\n  service URL: ${URL}`);
  if (deployId) console.log(`  deploy id  : ${deployId}`);
  console.log('\n  waiting for the build to finish (this takes a few minutes)…');

  const deadline = Date.now() + 15 * 60 * 1000;
  let last = '';
  while (Date.now() < deadline) {
    const [d] = await api(`/services/${svc.id}/deploys?limit=1`);
    const st = d?.deploy?.status;
    if (st && st !== last) {
      last = st;
      console.log(`  ${new Date().toLocaleTimeString()}  ${statusEmoji(st)} ${st}`);
    }
    if (st === 'live') break;
    if (/failed|canceled/.test(st || '')) {
      console.error('\n❌ Deploy did not succeed:', st);
      console.error('   Check the build log in the Render dashboard for details.');
      process.exit(1);
    }
    await wait(15000);
  }

  // Confirm it actually serves the game
  console.log('\n  verifying the live URL…');
  for (let i = 1; i <= 20; i++) {
    try {
      const r = await fetch(`${URL}/healthz`, { headers: { 'Cache-Control': 'no-store' } });
      if (r.ok) {
        const info = await (await fetch(`${URL}/api/info`, { headers: { 'Cache-Control': 'no-store' } })).json();
        console.log(`  ✓ /healthz  ${r.status}`);
        console.log(`  ✓ /api/info ${JSON.stringify(info)}`);
        break;
      }
    } catch { /* cold start — retry */ }
    if (i === 20) console.log('  ⚠️  health check did not answer yet (free tier may be waking up)');
    await wait(10000);
  }

  console.log(`\n✅ LIVE: ${URL}`);
})().catch(e => {
  console.error('\n❌ Deploy failed:', e.message);
  if (e.body) console.error('  ', JSON.stringify(e.body).slice(0, 600));
  if (e.status === 401) console.error('   The API key was rejected. Generate a new one at dashboard.render.com → Account Settings → API Keys.');
  if (e.status === 404) console.error('   Repo not visible to Render. Connect the GitHub account that owns GraphicMiles/Game-test first.');
  process.exit(1);
});
