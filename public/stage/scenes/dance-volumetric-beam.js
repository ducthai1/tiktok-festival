// Chùm sáng thể tích (đèn moving-head trên trần, tia từ quả cầu disco): mép nón mờ dần theo góc nhìn, sáng nhạt dần theo
// khoảng cách từ đầu đèn — trông như ánh sáng xuyên khói thay vì một khối nón đặc.
// Chuyển thể từ SpotLightMaterial của pmndrs/drei (MIT License, Copyright (c) 2020 react-spring); bỏ phần "soft particles"
// cần ảnh độ sâu (cảnh này không có), giữ nguyên công thức cường độ.
import * as THREE from '/vendor/three/three.module.js';

export function createBeamMaterial({ color = '#ffffff', attenuation = 9, anglePower = 6, opacity = 1 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: opacity },
      attenuation: { value: attenuation },
      anglePower: { value: anglePower },
      spotPosition: { value: new THREE.Vector3() },
      lightColor: { value: new THREE.Color(color) }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vNormal;
      varying float vIntensity;
      uniform vec3 spotPosition;
      uniform float attenuation;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vIntensity = 1.0 - clamp(distance(worldPosition.xyz, spotPosition) / attenuation, 0.0, 1.0);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      varying float vIntensity;
      uniform vec3 lightColor;
      uniform float anglePower;
      uniform float opacity;
      void main() {
        vec3 normal = vec3(vNormal.x, vNormal.y, abs(vNormal.z));
        float angleIntensity = pow(dot(normal, vec3(0.0, 0.0, 1.0)), anglePower);
        gl_FragColor = vec4(lightColor * vIntensity * angleIntensity * opacity, 1.0);
        #include <colorspace_fragment>
      }`
  });
}

/** Nón sáng mở đáy, đỉnh ở gốc toạ độ, chiếu theo -y; gắn vào một Object3D làm "đầu đèn" rồi xoay đầu đèn. */
export function beamCone(length, radius, material) {
  const geometry = new THREE.CylinderGeometry(0.06, radius, length, 40, 1, true).translate(0, -length / 2, 0);
  return new THREE.Mesh(geometry, material);
}

/** Cập nhật vị trí đầu đèn (thế giới) cho shader tính độ nhạt theo khoảng cách. */
export function syncBeamOrigin(mesh) {
  mesh.updateWorldMatrix(true, false);
  mesh.material.uniforms.spotPosition.value.setFromMatrixPosition(mesh.matrixWorld);
}
