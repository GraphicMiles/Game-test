#!/usr/bin/env node
/**
 * SWEETWATER — game server
 *
 * Zero-dependency Node HTTP server:
 *   • static hosting of /public with gzip + caching
 *   • /healthz   health probe (Render / uptime monitors)
 *   • /api/info  build + runtime info for the in-game HUD
 *   • /ws        multiplayer relay — ACTIVE automatically when the optional
 *                `ws` package is installed (npm i ws), otherwise the game
 *                silently falls back to single-player.
 *
 *   PORT            default 3000
 *   HOST            default 0.0.0.0
 *   NO_MULTIPLAYER  set to 1 to force single-player
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const zlib = require('zlib');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.hdr': 'image/vnd.radiance',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};
const COMPRESSIBLE = /\.(html|js|mjs|css|json|svg|txt|md|gltf)$/i;
const IMMUTABLE = /\.(glb|hdr|jpg|jpeg|png|webp|woff2?|ttf)$/i;

/** Optional multiplayer transport. */
let WS = null;
if (!process.env.NO_MULTIPLAYER) {
  try { WS = require('ws'); } catch (e) { /* not installed — single player */ }
}

const startedAt = Date.now();
let peakPlayers = 0;

/* --------------------------------------------------------------- static */
function sendFile(req, res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  const etag = 'W/"' + stat.size + '-' + Number(stat.mtimeMs).toString(36) + '"';

  res.setHeader('Content-Type', type);
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', IMMUTABLE.test(ext)
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=60, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304); res.end(); return;
  }

  const accept = req.headers['accept-encoding'] || '';
  const canGzip = COMPRESSIBLE.test(ext) && stat.size > 1024 && /\bgzip\b/.test(accept);
  const canBr = COMPRESSIBLE.test(ext) && stat.size > 1024 && /\bbr\b/.test(accept) && zlib.createBrotliCompress;

  res.setHeader('Vary', 'Accept-Encoding');
  let stream = fs.createReadStream(filePath);
  if (canBr) { res.setHeader('Content-Encoding', 'br'); stream = stream.pipe(zlib.createBrotliCompress()); }
  else if (canGzip) { res.setHeader('Content-Encoding', 'gzip'); stream = stream.pipe(zlib.createGzip({ level: 6 })); }
  else { res.setHeader('Content-Length', stat.size); }

  if (req.method === 'HEAD') { res.writeHead(200); res.end(); return; }
  stream.pipe(res);
  stream.on('error', () => { try { res.end(); } catch (e) {} });
}

/* ------------------------------------------------------------ multiplayer */
const players = new Map();
function setupMultiplayer(server) {
  if (!WS) return false;
  const wss = new WS.Server({ server, path: '/ws', maxPayload: 4096 });
  wss.on('connection', (socket, req) => {
    const id = crypto.randomBytes(6).toString('hex');
    const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
    players.set(id, { id, socket, ip, joined: Date.now(), state: null });
    peakPlayers = Math.max(peakPlayers, players.size);

    socket.send(JSON.stringify({ t: 'welcome', id, players: [...players.values()]
      .filter((p) => p.id !== id && p.state).map((p) => ({ id: p.id, ...p.state })) }));
    broadcast({ t: 'join', id }, id);

    socket.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      const p = players.get(id);
      if (!p) return;
      if (msg.t === 'state') {
        // { x, y, z, yaw, pitch, look, moving, name }
        p.state = {
          x: clampNum(msg.x), y: clampNum(msg.y), z: clampNum(msg.z),
          yaw: clampNum(msg.yaw), pitch: clampNum(msg.pitch),
          look: typeof msg.look === 'string' ? msg.look.slice(0, 24) : 'guest',
          moving: !!msg.moving,
        };
        broadcast({ t: 'state', id, ...p.state }, id);
      } else if (msg.t === 'ping') {
        socket.send(JSON.stringify({ t: 'pong', ts: msg.ts || 0 }));
      }
    });

    const close = () => {
      if (!players.has(id)) return;
      players.delete(id);
      broadcast({ t: 'leave', id });
    };
    socket.on('close', close);
    socket.on('error', close);
  });

  function broadcast(obj, exceptId) {
    const s = JSON.stringify(obj);
    for (const p of players.values()) {
      if (p.id === exceptId) continue;
      if (p.socket.readyState === 1) { try { p.socket.send(s); } catch (e) {} }
    }
  }
  setInterval(() => {
    for (const p of players.values()) {
      if (p.socket.readyState !== 1) { players.delete(p.id); broadcast({ t: 'leave', id: p.id }); }
    }
  }, 15000).unref?.();
  return true;
}

function clampNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(-10000, Math.min(10000, n)) : 0;
}

/* -------------------------------------------------------------- server */
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname || '/');

  if (pathname === '/healthz' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, uptime: Math.floor((Date.now() - startedAt) / 1000) }));
  }
  if (pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({
      game: 'Sweetwater',
      version: require('./package.json').version,
      multiplayer: !!WS && !process.env.NO_MULTIPLAYER,
      online: players.size,
      peak: peakPlayers,
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      node: process.version,
    }));
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  const filePath = path.join(ROOT, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA fallback
      const idx = path.join(ROOT, 'index.html');
      return fs.stat(idx, (e2, s2) => {
        if (e2) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404 Not Found'); }
        sendFile(req, res, idx, s2);
      });
    }
    sendFile(req, res, filePath, stat);
  });
});

// WebSocket upgrade is handled by `ws` when it is installed
if (WS) {
  server.on('upgrade', (req, socket, head) => {
    // handled inside setupMultiplayer
  });
}

server.listen(PORT, HOST, () => {
  const mp = setupMultiplayer(server);
  console.log('┌───────────────────────────────────────────────┐');
  console.log('│  SWEETWATER  ·  Delos Destinations, Sector 6  │');
  console.log('└───────────────────────────────────────────────┘');
  console.log(`  HTTP        http://${HOST}:${PORT}`);
  console.log(`  Health      /healthz`);
  console.log(`  Multiplayer ${mp ? 'ENABLED  (ws://…/ws)' : 'disabled — install `ws` to enable'}`);
  console.log(`  Serving     ${ROOT}`);
});
