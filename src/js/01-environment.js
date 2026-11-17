// ===== 환경 그래픽: 하늘 돔 · 바다 셰이더 · 태양광 (에이스 컴뱃 풍 대기감) =====
// 화면 표현만 바꾼다. 물리 · 충돌 · 게임 판정은 이 파일과 무관하다.
const SUN_DIR = V(0.52, 0.5, -0.69).normalize();
sun.position.copy(SUN_DIR);
sun.color.set(0xfff0d6);
sun.intensity = 1.9; // 톤매핑을 켜면 햇빛 쪽과 그늘 쪽 차이가 살아난다
scene.children
  .filter(o => o.isHemisphereLight)
  .forEach(h => {
    h.color.set(0xcfe0ff);
    h.groundColor.set(0x3e4a5a);
    h.intensity = 0.45;
  });
scene.fog.near = 6000;
scene.fog.far = 62000;

// ---------- 그림자: 태양 방향 직교 그림자 카메라가 플레이어를 따라다닌다.
// 갑판 위 기체 · 아일랜드 · 공중의 기체 자체 그림자. 바다 · 구름 · 하늘(셰이더 재질)은 받지 않는다.
// 비용: 그림자 깊이 패스 한 번 + 조명 픽셀마다 PCF 샘플. 폰에서는 1024 맵, 해상도가 두 단 넘게 떨어지면 끈다.
const SHADOW_HALF = 520, // 그림자 상자 반경 (월드 단위 = m × 3 → 약 350 m)
  SHADOW_MAP = MOBILE ? 1024 : 2048;
R.shadowMap.enabled = true;
R.shadowMap.type = T.PCFSoftShadowMap;
// 그림자 지도는 프레임마다 월드 렌더 직전에 한 번만 다시 그린다 (90-main-loop 에서 needsUpdate).
// 자동이면 R.render 를 부를 때마다 다시 그려서, 후방 거울 렌더 때 그림자 패스(항모 · 주기기)를 한 번 더 그렸다.
R.shadowMap.autoUpdate = false;
sun.castShadow = true;
sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
sun.shadow.camera.left = sun.shadow.camera.bottom = -SHADOW_HALF;
sun.shadow.camera.right = sun.shadow.camera.top = SHADOW_HALF;
sun.shadow.camera.near = 50;
sun.shadow.camera.far = 4000;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 1.2;
sun.shadow.camera.updateProjectionMatrix(); // 범위를 바꿨으면 반드시 — 안 부르면 기본 ±5 상자 그대로다
scene.add(sun.target);
let shadowScanT = 0;
// 어떤 메시가 그림자를 만들고 받는지: 셰이더 재질(바다 · 하늘 · 항적)과 거대한 판(구름층)은 제외
function shadowFlag(o) {
  if (!o.isMesh || !o.geometry || o.material.isShaderMaterial) return;
  if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
  const small = o.geometry.boundingSphere.radius < 3000;
  o.castShadow = small;
  o.receiveShadow = true;
}
// 그림자 켜고 끄기 (V15.0.0-alpha.3 개편): 예전엔 sun.castShadow 를 바꿔 껐는데, 그러면 그림자를 받는 셰이더가
// 전부(하늘 · 바다 · 기체 · 입자 등 8개 이상) 다시 컴파일된다. 해상도가 3단 떨어질 때(=기기가 힘들 때) 꺼지고
// 회복하면 다시 켜져서, 버거운 순간마다 긴 멈칫이 왕복으로 생겼다.
// 이제 castShadow 는 그대로 두고, 끌 때는 그림자 상자를 아무것도 없는 먼 곳으로 한 번 옮겨 그린 뒤(모든 면이 '그림자 밖' = 밝음)
// 그림자 지도 갱신을 멈춘다. 셰이더는 바뀌지 않는다. shadowLive 가 거짓이면 메인 루프가 그림자 지도를 다시 그리지 않는다.
let shadowLive = true,
  shadowParked = false;
function sunShadowUpdate(dt, focus) {
  const want = typeof FXS !== 'undefined' && FXS.q > 0 && (typeof resStep === 'undefined' || resStep < 3);
  if (!want) {
    if (!shadowParked) {
      // 마지막으로 한 번: 상자를 하늘 높이 빈 곳으로 → 그 지도로 그리면 모든 면이 상자 밖이라 그림자가 없다
      sun.target.position.set(0, 4e5, 0);
      sun.position.set(0, 4e5, 0).addScaledVector(SUN_DIR, 1500);
      shadowParked = true;
      shadowLive = true; // 이번 프레임만 그린다
    } else shadowLive = false;
    return;
  }
  shadowParked = false;
  shadowLive = true;
  if ((shadowScanT -= dt) <= 0) {
    shadowScanT = 1;
    scene.traverse(shadowFlag);
  }
  // 그림자 상자를 텍셀 단위로 맞춰 옮긴다 (안 맞추면 움직일 때 그림자 가장자리가 지글거린다)
  const texel = (SHADOW_HALF * 2) / SHADOW_MAP,
    lx = V(1, 0, 0).cross(SUN_DIR).normalize(),
    ly = SUN_DIR.clone().cross(lx).normalize(),
    px = Math.round(focus.dot(lx) / texel) * texel,
    py = Math.round(focus.dot(ly) / texel) * texel,
    pz = focus.dot(SUN_DIR),
    snapped = lx.multiplyScalar(px).addScaledVector(ly, py).addScaledVector(SUN_DIR, pz);
  sun.target.position.copy(snapped);
  sun.position.copy(snapped).addScaledVector(SUN_DIR, 1500);
}

// ---------- 하늘 돔: 천정은 짙은 파랑, 지평선은 안개색, 태양 주변은 빛 번짐
const SKY_TOP = new T.Color(0x1d4f9a);
const skyDome = new T.Mesh(
  new T.SphereGeometry(1000, 32, 16),
  new T.ShaderMaterial({
    side: T.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      top: { value: SKY_TOP.clone() },
      horizon: { value: new T.Color() },
      sunDir: { value: SUN_DIR },
      sunCol: { value: new T.Color(0xfff2d8) },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top, horizon, sunDir, sunCol; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 col = mix(horizon, top, pow(clamp(h, 0.0, 1.0), 0.42));
        col = mix(col, horizon * 0.82, smoothstep(0.0, -0.25, h));
        float s = max(dot(d, sunDir), 0.0);
        col += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 60.0) * 0.32 + pow(s, 7.0) * 0.12);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  })
);
skyDome.renderOrder = -1000;
// 환경맵: 하늘 돔을 한 번 구워 두고 모든 표준 재질의 반사로 쓴다 (캐노피 · 금속 · 도색의 광택).
// 이게 없으면 GLB 재질이 비추는 하늘이 없어 흐릿한 점토처럼 보인다.
function bakeEnvironment() {
  try {
    const pm = new T.PMREMGenerator(R);
    const sc = new T.Scene();
    const d = skyDome.clone();
    d.material = skyDome.material.clone();
    d.material.uniforms.horizon.value.copy(scene.fog.color);
    sc.add(d);
    const rt = pm.fromScene(sc, 0.02);
    scene.environment = rt.texture;
    pm.dispose();
  } catch (e) {
    console.warn('[STEEL TEMPEST] environment map failed; materials stay matte', e);
  }
}
bakeEnvironment();
skyDome.frustumCulled = false;
skyDome.onBeforeRender = (r, s, c) => {
  skyDome.position.copy(c.position);
  skyDome.updateMatrixWorld();
  skyDome.material.uniforms.horizon.value.copy(scene.fog.color);
};
scene.add(skyDome);

// ---------- 바다: 타일 노이즈 노멀맵 3겹(큰 너울 · 잔물결 · 잔잔한 결) + 프레넬 + 태양 반짝임 + 안개
// 예전 사인파 5개 합은 규칙적인 간섭무늬(모아레)가 생겼다. 노이즈 텍스처는 GPU 샘플 3번이라 더 싸기도 하다.
// 바다 색은 선형 (00-core 의 색 규칙). 그림자는 받지 않는다 (셰이더 재질).
function seaNormalTexture(size = 256) {
  // 반복되는 격자 값 노이즈 4옥타브 → 높이 → 법선. 격자 크기를 2의 거듭제곱으로 두면 가장자리가 이어진다.
  const perm = new Uint8Array(512);
  let seed = 7;
  const r = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const base = Array.from({ length: 256 }, (_, k) => k);
  for (let k = 255; k > 0; k--) {
    const q = Math.floor(r() * (k + 1));
    [base[k], base[q]] = [base[q], base[k]];
  }
  for (let k = 0; k < 512; k++) perm[k] = base[k & 255];
  const lat = (x, y, n) => perm[(perm[x & (n - 1) & 255] + (y & (n - 1))) & 255] / 255;
  const fade = u => u * u * (3 - 2 * u);
  const noise = (x, y, n) => {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      u = fade(x - xi),
      v = fade(y - yi);
    const a = lat(xi, yi, n),
      b = lat(xi + 1, yi, n),
      c = lat(xi, yi + 1, n),
      d = lat(xi + 1, yi + 1, n);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0,
        amp = 0.55,
        cells = 4;
      for (let o = 0; o < 4; o++) {
        v += (noise((x / size) * cells, (y / size) * cells, cells) - 0.5) * amp;
        amp *= 0.5;
        cells *= 2;
      }
      h[y * size + x] = v;
    }
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const img = c.getContext('2d').createImageData(size, size),
    d = img.data,
    K = 6.0; // 기울기 세기
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = h[y * size + ((x + 1) & (size - 1))] - h[y * size + ((x - 1) & (size - 1))],
        dy = h[((y + 1) & (size - 1)) * size + x] - h[((y - 1) & (size - 1)) * size + x],
        i = (y * size + x) * 4;
      d[i] = clamp(128 - dx * K * 128, 0, 255);
      d[i + 1] = clamp(128 - dy * K * 128, 0, 255);
      d[i + 2] = 255;
      d[i + 3] = 255;
    }
  c.getContext('2d').putImageData(img, 0, 0);
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.magFilter = T.LinearFilter;
  try {
    t.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
  } catch (e) {}
  return t; // 법선 데이터 — 선형 그대로 (sRGB 아님)
}
sea.material = new T.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    nmap: { value: seaNormalTexture() },
    sunDir: { value: SUN_DIR },
    sunCol: { value: new T.Color(0xfff0d0) },
    deep: { value: new T.Color(0x07243f) },
    shallow: { value: new T.Color(0x1b5f8a) },
    skyCol: { value: new T.Color(0x8fb4d8) },
    fogColor: { value: new T.Color() },
    fogNear: { value: 6000 },
    fogFar: { value: 62000 },
  },
  vertexShader: `varying vec3 wPos;
    void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wPos = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform float time, fogNear, fogFar; uniform vec3 sunDir, sunCol, deep, shallow, skyCol, fogColor;
    uniform sampler2D nmap;
    varying vec3 wPos;
    vec2 nrm(vec2 uv){ return texture2D(nmap, uv).xy * 2.0 - 1.0; }
    void main(){
      vec2 p = wPos.xz;
      float dist = length(cameraPosition - wPos);
      // 멀수록 잔결을 죽인다 (멀리서 반짝이는 노이즈 방지) · 큰 너울은 오래 남긴다
      float dFine = 1.0 - smoothstep(600.0, 9000.0, dist);
      float dMid  = 1.0 - smoothstep(3000.0, 30000.0, dist);
      float dBig  = 1.0 - smoothstep(12000.0, 70000.0, dist);
      vec2 g = nrm(p / 1400.0 + time * vec2(0.010, 0.006)) * 0.9 * dBig
             + nrm(p / 260.0 - time * vec2(0.028, 0.019)) * 0.7 * dMid
             + nrm(p / 46.0 + time * vec2(0.09, -0.06)) * 0.45 * dFine;
      vec3 n = normalize(vec3(g.x, 1.0, g.y));
      vec3 v = normalize(cameraPosition - wPos);
      float ndv = max(dot(n, v), 0.0);
      float fr = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
      // 물색: 태양을 향한 면은 얕은 색, 등진 면은 깊은 색. 비스듬히 볼수록 하늘이 비친다
      vec3 base = mix(deep, shallow, 0.3 + 0.5 * max(dot(n, sunDir), 0.0));
      vec3 col = mix(base, skyCol, clamp(fr, 0.0, 0.75));
      // 태양 반짝임: 날카로운 중심 + 넓은 광택
      float rv = max(dot(reflect(-sunDir, n), v), 0.0);
      col += sunCol * (pow(rv, 420.0) * 2.6 + pow(rv, 40.0) * 0.22 + pow(rv, 6.0) * 0.04);
      float f = smoothstep(fogNear, fogFar, dist);
      gl_FragColor = vec4(mix(col, fogColor, f), 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
});
sea.onBeforeRender = () => {
  const u = sea.material.uniforms;
  u.time.value = performance.now() / 1000;
  u.fogColor.value.copy(scene.fog.color);
  u.fogNear.value = scene.fog.near;
  u.fogFar.value = scene.fog.far;
};
