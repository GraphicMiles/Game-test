import * as THREE from 'three';

/**
 * Procedural atmosphere (Rayleigh + Mie + animated cloud deck + stars)
 * driving a physically laid-out sun/moon rig and matching exponential fog.
 */
export class Sky {
  constructor(scene, assets, opts = {}) {
    this.scene = scene;
    this.assets = assets;
    this.time = opts.time !== undefined ? opts.time : 16.33;   // hours 0..24
    this.speed = 0;                                            // hours per real second
    this.latitude = 34.5;

    // ---------------------------------------------------------- sky dome
    const uniforms = {
      uSunDir:    { value: new THREE.Vector3(0, 1, 0) },
      uTime:      { value: 0 },
      uClouds:    { value: 0.42 },
      uExposure:  { value: 1.0 },
      uStars:     { value: 0.0 },
      uMoonDir:   { value: new THREE.Vector3(0, -1, 0) },
    };
    this.uniforms = uniforms;

    const skyMat = new THREE.ShaderMaterial({
      uniforms, side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main(){
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w;   // always at far plane
        }`,
      fragmentShader: /* glsl */`
        precision highp float;
        uniform vec3  uSunDir, uMoonDir;
        uniform float uTime, uClouds, uExposure, uStars;
        varying vec3  vDir;

        float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
        float vnoise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), u.x),
                     mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), u.x), u.y);
        }
        float fbm(vec2 p, int oct){
          float s = 0.0, a = 0.5;
          for(int i=0;i<6;i++){ if(i>=oct) break; s += a*vnoise(p); p *= 2.07; a *= 0.5; }
          return s;
        }

        void main(){
          vec3 v = normalize(vDir);
          float h = max(v.y, -0.2);
          float sunUp = clamp(uSunDir.y * 6.0 + 0.35, 0.0, 1.0);
          float night = 1.0 - sunUp;

          // --- base atmosphere: Rayleigh-ish gradient that warms at the horizon
          vec3 zenithDay  = vec3(0.16, 0.32, 0.66);
          vec3 horizonDay = vec3(0.76, 0.79, 0.80);
          vec3 zenithSet  = vec3(0.14, 0.20, 0.44);
          vec3 horizonSet = vec3(1.00, 0.52, 0.24);
          vec3 zenithN    = vec3(0.012, 0.020, 0.055);
          vec3 horizonN   = vec3(0.055, 0.070, 0.125);

          float dusk = smoothstep(0.30, -0.04, uSunDir.y);      // 1 when sun is low
          vec3 zen  = mix(mix(zenithN, zenithDay, sunUp), zenithSet, dusk * sunUp);
          vec3 hor  = mix(mix(horizonN, horizonDay, sunUp), horizonSet, dusk * sunUp);

          float grad = pow(clamp(h, 0.0, 1.0), 0.42);
          vec3 col = mix(hor, zen, grad);

          // warm band hugging the horizon at golden hour
          float band = exp(-abs(v.y) * 9.0) * dusk * sunUp;
          col += vec3(1.0, 0.44, 0.12) * band * 0.55;

          // --- sun disc + Mie forward scattering
          float sd = max(dot(v, normalize(uSunDir)), 0.0);
          col += vec3(1.0, 0.72, 0.40) * pow(sd, 8.0)   * 0.30 * sunUp;
          col += vec3(1.0, 0.58, 0.26) * pow(sd, 160.0) * 1.10 * sunUp;
          float disc = smoothstep(0.99955, 0.99988, sd) * sunUp;
          col += vec3(1.0, 0.95, 0.86) * disc * 26.0;

          // --- stars
          if (uStars > 0.001 && v.y > -0.02) {
            vec2 sp = v.xz / max(v.y, 0.06) * 42.0;
            vec2 gi = floor(sp);
            float r = h21(gi);
            float tw = 0.65 + 0.35 * sin(uTime * 1.7 + r * 63.0);
            float s = smoothstep(0.9955, 0.9995, r) * tw;
            s *= smoothstep(-0.02, 0.22, v.y);
            col += vec3(0.95, 0.96, 1.0) * s * uStars * 1.5;
          }

          // --- moon
          float md = max(dot(v, normalize(uMoonDir)), 0.0);
          if (uMoonDir.y > -0.1) {
            col += vec3(0.72, 0.78, 0.95) * pow(md, 900.0) * 2.2 * uStars;
            col += vec3(0.35, 0.42, 0.62) * pow(md, 22.0) * 0.14 * uStars;
          }

          // --- cloud deck (plane projection, animated, lit by the sun)
          if (v.y > 0.012) {
            vec2 cp = v.xz / v.y * 0.55 + vec2(uTime * 0.010, uTime * 0.0042);
            float f1 = fbm(cp * 0.9, 5);
            float f2 = fbm(cp * 2.6 + f1 * 0.7, 4);
            float cov = smoothstep(0.44, 0.80, f1 * 0.65 + f2 * 0.45) * uClouds;
            cov *= smoothstep(0.012, 0.16, v.y);
            // sunlight through the deck + silver lining
            float lit = 0.35 + 0.65 * smoothstep(-0.12, 0.45, uSunDir.y);
            vec3 cloudDark  = mix(vec3(0.16,0.17,0.22), vec3(0.42,0.40,0.42), sunUp);
            vec3 cloudLight = mix(vec3(0.42,0.44,0.55), vec3(1.00,0.96,0.90), sunUp);
            vec3 cc = mix(cloudDark, cloudLight, f2 * 0.85 * lit);
            cc += vec3(1.0, 0.62, 0.30) * pow(sd, 5.0) * 0.35 * dusk;
            col = mix(col, cc, cov * 0.86);
          }

          // gentle ground haze below the horizon
          col = mix(col, mix(vec3(0.30,0.28,0.26), vec3(0.55,0.48,0.40), sunUp), smoothstep(0.0, -0.16, v.y));

          gl_FragColor = vec4(col * uExposure, 1.0);
        }`,
    });

    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 28), skyMat);
    this.dome.scale.setScalar(4000);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -1000;
    scene.add(this.dome);

    // ------------------------------------------------------------ lights
    this.sun = new THREE.DirectionalLight(0xffe6c0, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.near = 0.5; sc.far = 260; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.035;
    this.sun.shadow.radius = 2.2;
    this.sun.shadow.blurSamples = 12;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.moon = new THREE.DirectionalLight(0x9fb6e8, 0.0);
    this.moon.castShadow = false;
    scene.add(this.moon);

    this.hemi = new THREE.HemisphereLight(0xbcd2f0, 0x6a5a3c, 0.35);
    scene.add(this.hemi);

    // bounce light from the desert floor
    this.bounce = new THREE.DirectionalLight(0xffd9a8, 0.22);
    this.bounce.position.set(-40, -30, -20);
    scene.add(this.bounce);

    scene.fog = new THREE.FogExp2(0xcfc0a4, 0.0016);

    this.horizonColor = new THREE.Color();
    this.sunColor = new THREE.Color();
    this.apply(this.time);
  }

  setTime(h) { this.time = ((h % 24) + 24) % 24; this.apply(this.time); }

  apply(hour) {
    // sun path: 6:00 = eastern horizon, 12:00 = zenith-ish, 18:00 = western horizon
    const a = ((hour - 6) / 12) * Math.PI;
    const decl = THREE.MathUtils.degToRad(23.4) * Math.cos(((hour / 24) * 2 - 0.5) * 0.0 + 0.4);
    const elev = Math.asin(Math.max(-1, Math.min(1, Math.sin(a) * Math.cos(decl) * 0.92 + Math.sin(decl) * 0.22)));
    const azim = ((hour - 6) / 12) * Math.PI * 0.86 + Math.PI * 0.10;

    const dir = new THREE.Vector3(
      Math.cos(elev) * Math.sin(azim),
      Math.sin(elev),
      Math.cos(elev) * Math.cos(azim) * 0.55 + 0.35,
    ).normalize();
    this.sunDir = dir;
    this.uniforms.uSunDir.value.copy(dir);
    this.uniforms.uMoonDir.value.copy(dir).negate();

    const sunUp = THREE.MathUtils.clamp(dir.y * 4.0 + 0.28, 0, 1);
    const dusk = THREE.MathUtils.smoothstep(dir.y, 0.30, -0.04);
    this.nightAmount = 1 - sunUp;
    this.uniforms.uStars.value = THREE.MathUtils.smoothstep(dir.y, 0.02, -0.14);

    // --- sun colour & intensity follow atmospheric thickness
    const thick = Math.pow(1 - Math.max(dir.y, 0), 3.2);
    this.sunColor.setRGB(
      1.0,
      0.92 - thick * 0.42,
      0.78 - thick * 0.62,
    ).multiplyScalar(1.0);
    this.sun.color.copy(this.sunColor);
    this.sun.intensity = sunUp * (3.6 - thick * 2.2);

    this.moon.intensity = this.nightAmount * 0.42;
    this.moon.color.setHex(0x9fb6e8);
    this.moon.position.copy(dir).negate().multiplyScalar(120);

    this.hemi.intensity = 0.10 + sunUp * 0.42 + this.nightAmount * 0.06;
    this.hemi.color.setRGB(
      THREE.MathUtils.lerp(0.06, 0.74, sunUp),
      THREE.MathUtils.lerp(0.08, 0.82, sunUp),
      THREE.MathUtils.lerp(0.18, 0.95, sunUp),
    );
    this.hemi.groundColor.setRGB(
      THREE.MathUtils.lerp(0.02, 0.42, sunUp),
      THREE.MathUtils.lerp(0.02, 0.35, sunUp),
      THREE.MathUtils.lerp(0.03, 0.22, sunUp),
    );
    this.bounce.intensity = sunUp * 0.20;

    // --- fog colour tracks the horizon
    const day = new THREE.Color(0.79, 0.76, 0.68);
    const set = new THREE.Color(0.98, 0.62, 0.36);
    const nit = new THREE.Color(0.055, 0.075, 0.135);
    this.horizonColor.copy(nit).lerp(day, sunUp).lerp(set, dusk * sunUp * 0.85);
    this.scene.fog.color.copy(this.horizonColor);
    const density = THREE.MathUtils.lerp(0.0011, 0.0021, dusk) + this.nightAmount * 0.0006;
    this.scene.fog.density = density;

    // --- image based lighting swap
    const env = this.assets.envMaps;
    const wantDusk = (dir.y < 0.02);
    const tex = wantDusk && env.dusk ? env.dusk.pmrem : (env.day ? env.day.pmrem : null);
    if (tex && this.scene.environment !== tex) this.scene.environment = tex;
    this.scene.backgroundIntensity = 1.0;

    this.sunElev = dir.y;
    this.sunAzim = Math.atan2(dir.x, dir.z);
  }

  /** Snap the shadow camera to follow the player, with texel snapping. */
  follow(target, quality) {
    const d = this.sunDir;
    const dist = quality.shadow > 2048 ? 110 : 90;
    const texel = quality.shadow > 2048 ? 0.072 : 0.14;
    const snap = (n) => Math.round(n / texel) * texel;
    const cx = snap(target.x), cz = snap(target.z);
    this.sun.target.position.set(cx, 0, cz);
    this.sun.position.set(cx + d.x * dist, Math.max(12, d.y * dist), cz + d.z * dist);
    this.sun.target.updateMatrixWorld();

    const half = quality.shadow > 2048 ? 78 : 62;
    const sc = this.sun.shadow.camera;
    if (sc.left !== -half) {
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
      sc.updateProjectionMatrix();
    }
    this.sun.shadow.needsUpdate = true;
  }

  update(dt, t) {
    if (this.speed) { this.time = (this.time + this.speed * dt) % 24; this.apply(this.time); }
    this.uniforms.uTime.value = t;
    this.dome.position.copy(this._domePos || (this._domePos = new THREE.Vector3()));
  }

  setDomePosition(v) { this.dome.position.copy(v); }

  /** Human readable time + mood name for the HUD. */
  label() {
    const h = this.time;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    const mood = h < 5.5 ? 'Night' : h < 7.5 ? 'Dawn' : h < 11 ? 'Morning'
      : h < 14.5 ? 'Midday' : h < 17.5 ? 'Afternoon' : h < 19.3 ? 'Golden Hour'
        : h < 20.6 ? 'Dusk' : 'Night';
    return { clock: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, mood };
  }
}
