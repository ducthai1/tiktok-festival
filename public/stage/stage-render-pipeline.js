// Renderer WebGL + hậu kỳ "bloom" (đèn neon, nến, nước lấp lánh phát sáng).
import * as THREE from '/vendor/three/three.module.js';
import { EffectComposer } from '/vendor/three-addons/postprocessing/EffectComposer.js';
import { RenderPass } from '/vendor/three-addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/vendor/three-addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/vendor/three-addons/postprocessing/OutputPass.js';

export const STAGE_WIDTH = 1080;
export const STAGE_HEIGHT = 1920;

export function createRenderPipeline(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
  const bloom = new UnrealBloomPass(new THREE.Vector2(STAGE_WIDTH / 2, STAGE_HEIGHT / 2), 0.7, 0.55, 0.82);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize(displayScale) {
    // Vẽ đúng số điểm ảnh đang hiển thị: OBS 1080×1920 = 1:1, khung xem trước nhỏ thì nhẹ máy.
    const ratio = Math.min(1, Math.max(0.2, displayScale * (window.devicePixelRatio || 1)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(STAGE_WIDTH, STAGE_HEIGHT, false);
    composer.setPixelRatio(ratio);
    composer.setSize(STAGE_WIDTH, STAGE_HEIGHT);
  }

  return {
    renderer,
    resize,
    setBloom({ strength = 0.7, radius = 0.55, threshold = 0.82 } = {}) {
      bloom.strength = strength;
      bloom.radius = radius;
      bloom.threshold = threshold;
    },
    render(scene, camera) {
      renderPass.scene = scene;
      renderPass.camera = camera;
      composer.render();
    }
  };
}
