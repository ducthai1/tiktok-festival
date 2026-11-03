// Renderer WebGL + hậu kỳ "bloom" (đèn neon, nến, nước lấp lánh phát sáng).
import * as THREE from '/vendor/three/three.module.js';
import { EffectComposer } from '/vendor/three-addons/postprocessing/EffectComposer.js';
import { RenderPass } from '/vendor/three-addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/vendor/three-addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/vendor/three-addons/postprocessing/OutputPass.js';
import { stageQuality } from './stage-quality.js';

export const STAGE_WIDTH = 1080;
export const STAGE_HEIGHT = 1920;

export function createRenderPipeline(canvas, quality = stageQuality()) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Không có hậu kỳ (chế độ nhẹ) thì vẽ thẳng ra màn: renderer tự áp tone mapping + sRGB như OutputPass,
  // khỏi thêm 1 lần vẽ ra bộ đệm và chuỗi làm mờ nhiều tầng của bloom.
  let composer = null;
  let renderPass = null;
  let bloom = null;
  if (quality.bloom) {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    bloom = new UnrealBloomPass(new THREE.Vector2(STAGE_WIDTH / 2, STAGE_HEIGHT / 2), 0.7, 0.55, 0.82);
    composer.addPass(renderPass);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  function resize(displayScale) {
    // Vẽ đúng số điểm ảnh đang hiển thị: OBS 1080×1920 = 1:1, khung xem trước nhỏ thì nhẹ máy.
    // Chế độ nhẹ chặn trần thấp hơn: vẽ ít điểm ảnh rồi để CSS phóng lên khung.
    const ratio = Math.min(quality.maxPixelRatio, Math.max(0.2, displayScale * (window.devicePixelRatio || 1)));
    renderer.setPixelRatio(ratio);
    renderer.setSize(STAGE_WIDTH, STAGE_HEIGHT, false);
    if (!composer) return;
    composer.setPixelRatio(ratio);
    composer.setSize(STAGE_WIDTH, STAGE_HEIGHT);
  }

  return {
    renderer,
    resize,
    /** Mặc định ACES cho cảnh 3D; cảnh dùng tranh vẽ (chùa) tắt để giữ đúng màu tranh. */
    setToneMapping(mode = THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = mode;
    },
    setBloom({ strength = 0.7, radius = 0.55, threshold = 0.82 } = {}) {
      if (!bloom) return;
      bloom.strength = strength;
      bloom.radius = radius;
      bloom.threshold = threshold;
    },
    render(scene, camera) {
      if (!composer) return void renderer.render(scene, camera);
      renderPass.scene = scene;
      renderPass.camera = camera;
      composer.render();
    }
  };
}
