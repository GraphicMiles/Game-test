import * as THREE from 'three';

/* ------------------------------------------------------------------ noise */
let P = null;
function perm(seed = 1337) {
  const p = new Uint8Array(512);
  let s = seed;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const a = new Uint8Array(256);
  for (let i = 0; i < 256; i++) a[i] = i;
  for (let i = 255; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
  for (let i = 0; i < 512; i++) p[i] = a[i & 255];
  return p;
}
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function grad2(h, x, y) {
  switch (h & 3) { case 0: return x + y; case 1: return -x + y; case 2: return x - y; default: return -x - y; }
}
/** Classic 2D Perlin, range roughly [-1,1]. */
export function perlin(x, y) {
  if (!P) P = perm();
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = fade(xf), v = fade(yf);
  const aa = P[P[X] + Y], ab = P[P[X] + Y + 1], ba = P[P[X + 1] + Y], bb = P[P[X + 1] + Y + 1];
  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u);
  const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}
function lerp(a, b, t) { return a + (b - a) * t; }
export function fbm(x, y, oct = 4, lac = 2.03, gain = 0.5) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * perlin(x * f, y * f); norm += a; a *= gain; f *= lac; }
  return s / norm;
}
function ridge(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) { s += a * (1 - Math.abs(perlin(x * f, y * f))); norm += a; a *= 0.5; f *= 2.07; }
  return s / norm;
}

/* --------------------------------------------------------------- heights */
export const TOWN = { cx: 0, cz: 0, rx: 108, rz: 118 };

/** Elliptical mask: 0 inside Sweetwater, 1 out in open desert. */
function outsideTown(x, z) {
  const dx = (x - TOWN.cx) / TOWN.rx, dz = (z - TOWN.cz) / TOWN.rz;
  const d = Math.sqrt(dx * dx + dz * dz);
  return THREE.MathUtils.smoothstep(d, 0.78, 1.22);
}

/**
 * Ground height anywhere in the world. Used by BOTH the mesh and the
 * player collision, so they can never disagree.
 */
export function heightAt(x, z) {
  const out = outsideTown(x, z);
  if (out < 0.0001) return 0;

  // rolling desert floor
  let h = fbm(x * 0.0022, z * 0.0022, 4) * 14.0;
  h += fbm(x * 0.011, z * 0.011, 3) * 2.4;
  h += fbm(x * 0.045, z * 0.045, 2) * 0.42;

  // far ridgelines rising toward the horizon
  const r = Math.hypot(x, z);
  const far = THREE.MathUtils.smoothstep(r, 380, 1000);
  h += far * (34 + ridge(x * 0.0011, z * 0.0011, 5) * 120);

  // the town sits in a shallow, flat-bottomed bowl
  h *= out;
  h -= (1 - out) * 0.0;
  return h;
}

/** Surface normal from finite differences. */
export function normalAt(x, z, e = 0.6) {
  const hl = heightAt(x - e, z), hr = heightAt(x + e, z);
  const hd = heightAt(x, z - e), hu = heightAt(x, z + e);
  return new THREE.Vector3(hl - hr, 2 * e, hd - hu).normalize();
}

/* --------------------------------------------------------------- terrain */
export class Terrain {
  /**
   * @param {object} o { size, segments, assets }
   */
  constructor(o = {}) {
    const size = o.size || 2200;
    const seg = o.segments || 300;
    const a = o.assets;

    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = heightAt(x, z);
      pos.setY(i, y);

      // large-scale colour patchiness baked into vertex colours
      const patch = fbm(x * 0.014, z * 0.014, 3) * 0.5 + 0.5;
      const patch2 = fbm(x * 0.0026 + 40, z * 0.0026 - 20, 2) * 0.5 + 0.5;
      const dry = 0.78 + patch * 0.30;
      const warm = 0.90 + patch2 * 0.22;
      c.setRGB(dry * warm, dry * 0.955, dry * 0.86);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv1', geo.attributes.uv.clone());
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.97, metalness: 0.0,
      dithering: true, envMapIntensity: 0.55,
    });

    // ---- multi-layer splat injected into the standard material -----------
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.tDirt  = { value: a.textures.ground_dirt.color };
      shader.uniforms.tSand  = { value: a.textures.ground_sand.color };
      shader.uniforms.tScrub = { value: a.textures.ground_scrub.color };
      shader.uniforms.tRock  = { value: a.textures.rock_mesa.color };
      shader.uniforms.tDirtN = { value: a.textures.ground_dirt.normal };
      shader.uniforms.tSandN = { value: a.textures.ground_sand.normal };
      shader.uniforms.tRockN = { value: a.textures.rock_mesa.normal };
      shader.uniforms.uDetail = { value: 0.055 };
      shader.uniforms.uMacro  = { value: 0.0016 };
      shader.uniforms.uTime   = { value: 0 };
      this.shader = shader;

      shader.vertexShader = `
        varying vec3 vWPos;
        varying vec3 vWNrm;
        varying float vDist;
      ` + shader.vertexShader.replace(
        '#include <displacementmap_vertex>',
        `#include <displacementmap_vertex>
         vec4 wp = modelMatrix * vec4(transformed, 1.0);
         vWPos = wp.xyz;
         vWNrm = normalize(mat3(modelMatrix) * objectNormal);
         vDist = length(cameraPosition - wp.xyz);`
      );

      shader.fragmentShader = `
        uniform sampler2D tDirt, tSand, tScrub, tRock, tDirtN, tSandN, tRockN;
        uniform float uDetail, uMacro;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        varying float vDist;

        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1,0)), f.x),
                     mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
        }
        float fbm2(vec2 p){
          return vnoise(p)*0.5 + vnoise(p*2.03)*0.25 + vnoise(p*4.01)*0.125 + vnoise(p*8.07)*0.0625;
        }
        vec3 samp(sampler2D t, vec2 p, float s){ return texture2D(t, p * s).rgb; }

        // blend four layers by slope + altitude + low-frequency noise
        void splat(out vec3 alb, out vec3 nrm){
          float slope = 1.0 - clamp(vWNrm.y, 0.0, 1.0);
          float alt   = vWPos.y;
          float macro = fbm2(vWPos.xz * uMacro);
          float grain = fbm2(vWPos.xz * 0.09);

          // packed dirt dominates the town bowl, sand the flats, rock the slopes
          float wSand = smoothstep(0.5, 0.85, macro) * smoothstep(2.5, 9.0, abs(alt));
          float wRock = smoothstep(0.16, 0.42, slope + grain * 0.10) + smoothstep(14.0, 34.0, alt) * 0.75;
          float wScrub= smoothstep(0.45, 0.72, fbm2(vWPos.xz * 0.006 + 11.0)) * (1.0 - wRock);

          // near/far detail fade kills visible tiling
          float detail = mix(uDetail, uDetail * 0.30, smoothstep(40.0, 420.0, vDist));

          vec3 cD = samp(tDirt,  vWPos.xz, detail);
          vec3 cS = samp(tSand,  vWPos.xz, detail * 0.80);
          vec3 cG = samp(tScrub, vWPos.xz, detail * 1.35);
          vec3 cR = samp(tRock,  vWPos.xz, detail * 0.55);

          vec3 albedo = cD;
          albedo = mix(albedo, cS, clamp(wSand, 0.0, 1.0));
          albedo = mix(albedo, cG, clamp(wScrub * 0.85, 0.0, 1.0));
          albedo = mix(albedo, cR, clamp(wRock, 0.0, 1.0));

          vec3 nD = texture2D(tDirtN, vWPos.xz * detail).rgb * 2.0 - 1.0;
          vec3 nS = texture2D(tSandN, vWPos.xz * detail * 0.80).rgb * 2.0 - 1.0;
          vec3 nR = texture2D(tRockN, vWPos.xz * detail * 0.55).rgb * 2.0 - 1.0;
          vec3 nn = nD;
          nn = mix(nn, nS, clamp(wSand, 0.0, 1.0));
          nn = mix(nn, nR, clamp(wRock, 0.0, 1.0));
          nrm = normalize(vec3(nn.x, nn.y * 0.75, nn.z) + vWNrm * 1.4);
          alb = albedo;
        }
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec3 splatAlb; vec3 splatNrm;
         splat(splatAlb, splatNrm);
         diffuseColor.rgb *= splatAlb;`
      ).replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         normal = normalize(splatNrm + normal * 0.35);`
      );
    };

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = false;
    this.mesh.name = 'terrain';
    this.mesh.matrixAutoUpdate = false;
  }

  update(t) { if (this.shader) this.shader.uniforms.uTime.value = t; }
}
