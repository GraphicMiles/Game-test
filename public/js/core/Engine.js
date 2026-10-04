import * as THREE from 'three';
import { EffectComposer } from '../../vendor/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }     from '../../vendor/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass }     from '../../vendor/three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass} from '../../vendor/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass }     from '../../vendor/three/examples/jsm/postprocessing/OutputPass.js';
import { GradeShader }    from './GradeShader.js';

export const QUALITY = {
  low:    { dpr: 0.72, maxDpr: 1.0, shadow: 1024, msaa: 0, bloom: false, aniso: 2,  far: 420, dust: 0,   grass: 0,    lodBias: 1.9 },
  medium: { dpr: 0.95, maxDpr: 1.4, shadow: 2048, msaa: 0, bloom: true,  aniso: 4,  far: 700, dust: 500, grass: 4000, lodBias: 1.35 },
  high:   { dpr: 1.0,  maxDpr: 1.75,shadow: 2048, msaa: 4, bloom: true,  aniso: 8,  far: 1000,dust: 1400,grass: 9000, lodBias: 1.0 },
  ultra:  { dpr: 1.0,  maxDpr: 2.0, shadow: 4096, msaa: 4, bloom: true,  aniso: 16, far: 1600,dust: 2600,grass: 16000,lodBias: 0.75 },
};

export class Engine {
  constructor(container) {
    this.container = container;
    this.clock = new THREE.Clock();
    this.frameTimes = [];
    this.fps = 60;
    this.settings = {
      quality: 'high', scale: 1.0, fov: 75, sens: 100, bob: 1.0,
      volume: 0.7, fps: false, invertY: false, time: 16.33, speed: 0,
    };

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false,
    });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = true;
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.08, 1200);
    this.camera.rotation.order = 'YXZ';

    this._buildComposer();
    this.applyQuality('high');

    addEventListener('resize', () => this.resize());
    addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
  }

  _buildComposer() {
    const size = new THREE.Vector2(innerWidth, innerHeight);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      colorSpace: THREE.LinearSRGBColorSpace, samples: 4, depthBuffer: true,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setSize(size.x, size.y);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(size, 0.28, 0.72, 0.92);
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(GradeShader);
    this.gradePass.renderToScreen = false;
    this.composer.addPass(this.gradePass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  applyQuality(name) {
    const q = QUALITY[name] || QUALITY.high;
    this.settings.quality = name;
    this.q = q;
    const dpr = Math.min(devicePixelRatio || 1, q.maxDpr) * q.dpr * this.settings.scale;
    this.renderer.setPixelRatio(Math.max(0.5, dpr));
    this.renderer.shadowMap.enabled = q.shadow > 0;
    this.bloomPass.enabled = q.bloom;
    this.camera.far = q.far;
    this.camera.updateProjectionMatrix();
    if (this.composer.renderTarget1) this.composer.renderTarget1.samples = q.msaa;
    if (this.composer.renderTarget2) this.composer.renderTarget2.samples = q.msaa;
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
    return q;
  }

  setScale(s) { this.settings.scale = s; this.applyQuality(this.settings.quality); }
  setFov(f) { this.settings.fov = f; this.camera.fov = f; this.camera.updateProjectionMatrix(); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
    if (this.gradePass) {
      this.gradePass.uniforms.uRes.value.set(w, h);
    }
  }

  /** Adaptive resolution: nudges pixel ratio to hold ~55 fps. */
  _adapt(dt) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 45) this.frameTimes.shift();
    if (this.frameTimes.length < 30) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.fps = 1 / avg;
    if (!this._adaptT) this._adaptT = 0;
    this._adaptT += dt;
    if (this._adaptT < 2.5) return;
    this._adaptT = 0;
    if (this.settings.scale > 0.6 && this.fps < 42) {
      this.settings.scale = Math.max(0.6, this.settings.scale - 0.1);
      this.applyQuality(this.settings.quality);
    } else if (this.settings.scale < 1.0 && this.fps > 78) {
      this.settings.scale = Math.min(1.0, this.settings.scale + 0.05);
      this.applyQuality(this.settings.quality);
    }
  }

  render(scene, camera) {
    if (scene) this.renderPass.scene = scene;
    if (camera) this.renderPass.camera = camera;
    this.composer.render();
  }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.renderer.info.reset();
    this._adapt(dt);
    return dt;
  }
}
