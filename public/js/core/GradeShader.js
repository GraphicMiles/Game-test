/**
 * Final image grade: filmic contrast, split-tone, vignette, chromatic aberration,
 * animated film grain, desert heat-haze and a subtle anamorphic sun streak.
 * Runs in linear HDR space before OutputPass.
 */
import * as THREE from 'three';

export const GradeShader = {
  name: 'GradeShader',
  uniforms: {
    tDiffuse:   { value: null },
    uTime:      { value: 0 },
    uRes:       { value: new THREE.Vector2(1, 1) },
    uVignette:  { value: 0.82 },
    uGrain:     { value: 0.035 },
    uAberration:{ value: 1.0 },
    uSaturation:{ value: 1.06 },
    uContrast:  { value: 1.045 },
    uLift:      { value: new THREE.Vector3(0.006, 0.008, 0.014) },
    uGain:      { value: new THREE.Vector3(1.02, 0.995, 0.955) },
    uHaze:      { value: 0.55 },
    uSun:       { value: new THREE.Vector2(0.5, 0.5) },
    uSunAmount: { value: 0.0 },
    uFade:      { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */`
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uAberration, uSaturation, uContrast;
    uniform float uHaze, uSunAmount, uFade;
    uniform vec2  uRes, uSun;
    uniform vec3  uLift, uGain;
    varying vec2 vUv;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

    void main(){
      vec2 uv = vUv;
      vec2 c  = uv - 0.5;
      float r2 = dot(c, c);

      // --- desert heat haze: low-frequency vertical shimmer that grows with distance from centre
      float hazeMask = smoothstep(0.02, 0.30, r2) * uHaze;
      float sh = sin(uv.y * 190.0 + uTime * 2.3) * cos(uv.x * 133.0 - uTime * 1.7);
      float sh2 = sin((uv.y + uv.x) * 96.0 - uTime * 3.1);
      uv += vec2(sh * 0.00085, sh2 * 0.0011) * hazeMask;

      // --- barrel-ish chromatic aberration (stronger at the edges)
      float ca = uAberration * 0.0016 * r2;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;

      // --- anamorphic sun streak
      if (uSunAmount > 0.001) {
        vec2 d = (uv - uSun) * vec2(1.0, 3.4);
        float streak = exp(-abs(d.x) * 92.0) * exp(-abs(d.y) * 5.2);
        float halo   = exp(-length(d) * 8.0) * 0.32;
        col += vec3(1.0, 0.86, 0.62) * (streak * 1.5 + halo) * uSunAmount;
      }

      // --- grade: lift / gain / saturation / contrast
      col = col * uGain + uLift;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = (col - 0.5) * uContrast + 0.5;
      col = max(col, vec3(0.0));

      // --- split tone: warm highlights, cool shadows (Dolores' Kodachrome look)
      float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
      vec3 warm = vec3(1.045, 1.0, 0.90);
      vec3 cool = vec3(0.93, 0.97, 1.09);
      col *= mix(cool, warm, smoothstep(0.0, 0.72, lum));

      // --- vignette
      float vig = 1.0 - uVignette * smoothstep(0.18, 0.95, r2 * 1.35);
      col *= vig;

      // --- film grain (luminance aware, animated)
      float g = hash(vUv * uRes + fract(uTime) * 431.7) - 0.5;
      col += g * uGrain * (0.35 + 0.65 * (1.0 - lum));

      // --- fade to/from black
      col *= (1.0 - uFade);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
