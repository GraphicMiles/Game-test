/** Targeted verification of crouch, day/night label, and collision blocking. */
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = '/home/user/sweetwater/public', PORT = 4024;
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.hdr':'image/vnd.radiance','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary' };
const server = createServer(async (req,res)=>{ try{ let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  const b=await readFile(path.join(ROOT,p));
  res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(b);
 }catch{res.writeHead(404);res.end('x');}});
await new Promise(r=>server.listen(PORT,r));

const browser = await puppeteer.launch({headless:true,protocolTimeout:300000,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--window-size=420,260']});
const page = await browser.newPage();
await page.setViewport({width:420,height:260});
page.on('pageerror',e=>console.log('[PAGEERROR]',e.message.slice(0,200)));
await page.goto(`http://localhost:${PORT}/`,{waitUntil:'domcontentloaded',timeout:60000});
await page.waitForFunction(()=>window.SWEETWATER?.state?.ready===true,{timeout:120000,polling:500});
await page.evaluate(()=>document.getElementById('bStart').click());
await new Promise(r=>setTimeout(r,2000));

console.log('\n===== 1. CROUCH =====');
const crouch = await page.evaluate(()=>{
  const S=window.SWEETWATER, P=S.player;
  const out={};
  P.crouching=false; out.eyeStanding=+P.eyeHeight.toFixed(3); out.bodyStanding=+P.bodyHeight.toFixed(3);
  P.crouching=true;  out.eyeCrouch=+P.eyeHeight.toFixed(3);   out.bodyCrouch=+P.bodyHeight.toFixed(3);
  P.crouching=false;
  // now the real question: does pressing C actually set crouching?
  S.input.keys.KeyC = true;
  const st = S.input.state;
  out.inputStateCrouch = st.crouch;
  P.update(1/60, st, {bob:0});
  out.crouchingAfterUpdate = P.crouching;
  out.eyeAfterUpdate = +P.eyeHeight.toFixed(3);
  S.input.keys.KeyC = false;
  out.eyeCrouchConst = +P.eyeCrouch.toFixed(3);
  out.eyeConst = +P.eye.toFixed(3);
  return out;
});
console.log(JSON.stringify(crouch,null,2));
console.log('  crouch geometry wired? ', crouch.eyeCrouch < crouch.eyeStanding ? 'YES' : 'NO');
console.log('  KeyC reaches player?   ', crouch.crouchingAfterUpdate ? 'YES' : 'NO');

console.log('\n===== 2. DAY/NIGHT LABEL =====');
const dn = await page.evaluate(async ()=>{
  const S=window.SWEETWATER, out=[];
  for (const t of ['06:00','13:00','16:20','20:10','23:30']) {
    const [th,tm]=t.split(':').map(Number); S.sky.setTime(th+tm/60);
    const lab=S.sky.label();
    out.push({requested:t, skyTime:+S.sky.time.toFixed(2), label:lab.clock, mood:lab.mood,
      night:+S.sky.nightAmount.toFixed(2), sun:+S.sky.sun.intensity.toFixed(2)});
  }
  return out;
});
for (const r of dn) console.log(`  req ${r.requested}  sky.time=${r.skyTime}  label="${r.label} ${r.mood}"  night=${r.night} sun=${r.sun}`);
const labelOk = dn.every(r=>r.label===r.requested);
console.log('  label matches requested time?', labelOk?'YES':'NO  <-- BUG');

// Now check the SELECT handler path (what a real user does)
console.log('\n  -- via the settings dropdown --');
const dnSel = await page.evaluate(async ()=>{
  const S=window.SWEETWATER, out=[];
  for (const t of ['06:00','20:10','23:30']) {
    const sel=document.getElementById('sTime'); sel.value=t;
    sel.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,14000));
    out.push({req:t, sky:+S.sky.time.toFixed(2), clockEl:document.getElementById('clock').textContent,
      subEl:document.getElementById('clocksub').textContent});
  }
  return out;
});
for (const r of dnSel) console.log(`  req ${r.req}  sky.time=${r.sky}  HUD="${r.clockEl}" sub="${r.subEl}"`);

console.log('\n===== 3. COLLISION BLOCKING =====');
const coll = await page.evaluate(()=>{
  const S=window.SWEETWATER, P=S.player, C=S.town.colliders;
  // sample the shapes
  const shapes={};
  for(const c of C){ const k=Object.keys(c).sort().join(','); shapes[k]=(shapes[k]||0)+1; }
  // find a genuinely tall collider (a building wall)
  const tall=C.filter(c=>typeof c.y0==='number' && (c.y1-c.y0)>2.5);
  const w=tall[Math.floor(tall.length/2)];
  return { total:C.length, shapes, tallCount:tall.length,
    sample: w?{x0:+w.x0.toFixed(2),x1:+w.x1.toFixed(2),z0:+w.z0.toFixed(2),z1:+w.z1.toFixed(2),y0:+w.y0.toFixed(2),y1:+w.y1.toFixed(2)}:null };
});
console.log('  collider shapes:', JSON.stringify(coll.shapes));
console.log('  tall (>2.5m) colliders:', coll.tallCount, ' sample:', JSON.stringify(coll.sample));

const block = await page.evaluate(()=>{
  const S=window.SWEETWATER, P=S.player, C=S.town.colliders;
  const tall=C.filter(c=>typeof c.y0==='number' && (c.y1-c.y0)>2.5 && (c.x1-c.x0)<4 && (c.z1-c.z0)>2);
  const w = tall.find(c=>Math.hypot(c.x0,c.z0)<60) || tall[0];
  if(!w) return {skip:'no suitable wall'};
  const cx=(w.x0+w.x1)/2, cz=(w.z0+w.z1)/2;
  // stand 1.5m in front of the -Z face, walk +Z into it
  P.pos.set(cx, 0.2, w.z0-1.5); P.vel.set(0,0,0); P.yaw=Math.PI; // yaw PI => forward = +Z
  P.onGround=true;
  const start=+P.pos.z.toFixed(3);
  const st={forward:1,strafe:0,run:true,crouch:false,jump:false};
  for(let i=0;i<600;i++) P.update(1/120,st,{bob:0});   // 5 simulated seconds of running
  return { start, end:+P.pos.z.toFixed(3), face:+w.z0.toFixed(3),
    stoppedBeforeFace: P.pos.z < w.z0 + 0.05, penetration:+((P.pos.z)-w.z0).toFixed(3),
    wall:{x0:+w.x0.toFixed(2),x1:+w.x1.toFixed(2),z0:+w.z0.toFixed(2),z1:+w.z1.toFixed(2),y1:+w.y1.toFixed(2)} };
});
console.log('  ', JSON.stringify(block));
console.log('  wall blocks the player?', block.stoppedBeforeFace ? 'YES' : 'NO  <-- BUG (player walked through)');

await browser.close(); server.close();
