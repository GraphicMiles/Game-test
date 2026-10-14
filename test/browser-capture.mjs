/** Capture hero screenshots from scouted Sweetwater viewpoints. */
import puppeteer from 'puppeteer';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT='/home/user/sweetwater/public', PORT=4030;
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json',
  '.hdr':'image/vnd.radiance','.jpg':'image/jpeg','.png':'image/png','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{let p=decodeURIComponent(req.url.split('?')[0]);
  if(p==='/')p='/index.html';
  const b=await readFile(path.join(ROOT,p));
  res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'application/octet-stream'});res.end(b);
 }catch{res.writeHead(404);res.end('x');}});
await new Promise(r=>server.listen(PORT,r));

const browser=await puppeteer.launch({headless:true,protocolTimeout:600000,
  args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--window-size=480,300']});
const page=await browser.newPage();
await page.setViewport({width:480,height:300});
await page.goto(`http://localhost:${PORT}/`,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>window.SWEETWATER?.state?.ready===true,{timeout:180000,polling:500});
console.log('ready');

await page.evaluate(()=>document.getElementById('bStart').click());
await new Promise(r=>setTimeout(r,2500));

const VIEWS=[
  ['a-street-north',  0, 62,   Math.PI,      '16:20', -0.04, 'Main Street, looking north to the chapel'],
  ['b-mariposa',    -21, 16,   Math.PI*0.72, '16:20', -0.02, 'The Mariposa Saloon'],
  ['c-church',        0, -50,  0,            '16:20', -0.02, 'Sweetwater Chapel'],
  ['d-dusk',          0, 40,   Math.PI,      '20:10', -0.05, 'Dusk on Main Street'],
  ['e-night',        -18, 12,   Math.PI*0.72,'23:30', -0.02, 'The Mariposa at night'],
  ['f-dawn',          0, 55,   Math.PI,      '06:00', -0.03, 'Dawn arrival'],
  ['g-station',       0, 88,   Math.PI,      '16:20', -0.02, 'Sweetwater Station (spawn)'],
  ['h-west',        -14, 0,    Math.PI*1.5,  '18:40', -0.03, 'Golden hour, west side'],
];

for (const [name,x,z,yaw,time,pitch,desc] of VIEWS) {
  await page.evaluate(({x,z,yaw,time,pitch})=>{
    const S=window.SWEETWATER;
    const sel=document.getElementById('sTime'); sel.value=time; sel.dispatchEvent(new Event('change'));
    const p=S.player;
    p.pos.set(x, 0, z);
    p.pos.y = S.town.slopes ? p.pos.y : 0;
    p.yaw=yaw; p.pitch=pitch; p.vel.set(0,0,0);
    // settle onto the ground
    for(let i=0;i<240;i++) p.update(1/120,{forward:0,strafe:0,run:false,crouch:false,jump:false},{bob:0});
  },{x,z,yaw,time,pitch});
  await new Promise(r=>setTimeout(r,7000));       // let SwiftShader paint
  await page.screenshot({path:`/home/user/shots/${name}.png`});
  const y=await page.evaluate(()=>+window.SWEETWATER.player.pos.y.toFixed(2));
  console.log(`  ${name.padEnd(16)} ${desc}  (eye y=${y})`);
}
await browser.close(); server.close();
console.log('done');
