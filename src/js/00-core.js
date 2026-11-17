/* =====================================================================
   STEEL TEMPEST — 브라우저 항모 공중전 (캠페인 · 진행 저장 · 다큐식 오프닝)
   소스는 src/ 에서 파일별로 편집하고 build.py 로 한 파일(dist/)로 합친다.
   구성: 1) 유틸/상수  2) 기체 모델 (F-16 · MiG-29 · GLB)  3) 에어베이스
         4) 항모(쿠즈네초프)  5) 게임 로직 (물리 · 무장 · AI · 미션)
         6) HUD/콕핏  7) 입력/메뉴  8) 프론트 화면(인트로·커버·설정)
         9) FX · 외부시점 HUD · 커버 히어로 렌더
   대용량 에셋(MiG-29 GLB, 커버 JPEG)은 파일 맨 아래 data 블록으로 분리.
   ===================================================================== */
const T = THREE,
  V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z),
  // 판정 전용 난수 (mulberry32). 예전엔 Math.random 그 자체여서 three.js 가 객체 uuid 를 만들 때마다,
  // 그리고 Math.random 을 쓰는 연출이 돌 때마다 판정 난수열이 밀렸다 (V14.4.1 에서 분리).
  // 시드는 시작할 때 Math.random 에서 한 번만 받는다. 검사 하네스는 rnd.seed() 로 고정하고 rnd.state() 로 추적한다.
  rnd = (() => {
    let s = (Math.random() * 4294967296) >>> 0;
    const f = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let z = s;
      z = Math.imul(z ^ (z >>> 15), z | 1);
      z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
      return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
    };
    f.seed = v => (s = v >>> 0);
    f.state = () => s;
    return f;
  })(),
  D = Math.PI / 180,
  clamp = T.MathUtils.clamp,
  $ = i => document.getElementById(i),
  G = '#8cffb4';
// 화면 단위는 소련 기체답게 km/h · m 로 통일한다 (HUD · 계기판 · 안내 문구). 게임 내부 값은 m/s · m 그대로.
const MS2KMH = 3.6,
  kmh = v => Math.round(v * MS2KMH);
const readAsset = id => document.getElementById(id).textContent.replace(/\s+/g, '');
// 게임용 조정 파라미터 — 실제 기체/무장 성능값이 아님
const P = {
  // g: 실기 한계 9G · gun: 기총 탄수. MiG-29 GSh-30-1 은 실기도 150발이다 (V14.4.2, 모든 모드 공통).
  // rof: 기총 발사 속도(발/초). GSh-30-1 실기 1500~1800발/분 → 30발/초면 150발이 5초에 바닥난다 (V14.5.0 부터).
  // tracer: 몇 발에 한 발이 예광탄인가. 나머지는 무광탄 — 판정은 똑같이 하고 화면에만 안 그린다.
  // gunDmg: 이 기체가 쏜 탄 한 발의 피해 (표적 hp 1 기준). MiG 30 mm 는 10발이면 격추 (V14.6.0, 사용자 결정)
  // thr · ab: 해면 기준 추력 가속도(m/s²). V14.7.0 에서 실기 추중비 쪽으로 낮췄다 (예전 16 · 15 = 3.2 G 로 수직 상승이 끝없이 가속했다).
  //   건식 10 (≈1.0 G) — 수직으로 세우면 언젠가 반드시 실속. 애프터버너 합 15 (≈1.5 G) — 저고도에서만 수직 상승 유지.
  //   추력은 고도에 따라 줄고(밀도^0.75) 항력도 밀도에 비례한다 (34-flight 의 phys).
  mig: { maxV: 270, stall: 85, thr: 10, ab: 5, pit: 1.5, rol: 3, yaw: 0.5, g: 9, vc: 135, gun: 150, rof: 30, tracer: 4, gunDmg: 0.1 },
  // gun: 게임값 (실기 M61 511발). 적기 발사 간격은 36-enemy-ai 의 0.09초 그대로. gunDmg 는 예전 값 그대로
  f16: { maxV: 265, stall: 90, thr: 9.4, ab: 4.7, pit: 1.35, rol: 4.2, yaw: 0.4, g: 9, vc: 140, gun: 300, tracer: 3, gunDmg: 0.03 }, // thr · ab: MiG 와 같은 비율로 낮춤 (V14.7.0)
  // Su-33 (V15.0.0-alpha.3) — 실기 제원을 MiG-29 9.12 와의 비율로 옮겼다 (출처: DVIDS 제원표 · MILAVIA).
  //   추력: AL-31F3 2기 AB 251 kN · 건식 149 kN, 정상 이륙중량 29,940 kg → 추중비 AB 0.85 · 건식 0.51
  //         (MiG-29: RD-33 2기 AB 162.8 kN · 건식 98.8 kN, 15,240 kg → 1.09 · 0.66) → thr 10×0.77 = 7.7, 합 15×0.785 = 11.8
  //   최고속도 해면 1,300~1,400 km/h (MiG 1,500) → maxV 245 (AB 해면 최고속 약 1,090 km/h, MiG 의 약 0.92 배)
  //   G 한계 +9 (MiG 와 같다). 날개 62 m² · 카나드 → 실속 82 (MiG 85). 무거워 선회 기준속도 140 · 롤 2.6 (게임 판단)
  //   기총은 MiG 와 같은 GSh-30-1 150발이다.
  su33: { maxV: 245, stall: 82, thr: 7.7, ab: 4.1, pit: 1.5, rol: 2.6, yaw: 0.45, g: 9, vc: 140, gun: 150, rof: 30, tracer: 4, gunDmg: 0.1 },
  MUZZLE_V: 1000, // 탄의 포구 속도 (월드 단위/초). V14.6.0 부터 쏜 기체의 속도가 더해진다
  flapLim: [999, 210, 160],
  // range 는 미사일이 실제로 도달할 수 있는 거리에 맞춘 값 (예전 10000 / 6500 은 도달 불가 거리까지 발사 허용)
  // g: 최대 횡가속(G) · vq: 해면에서 그 G 를 다 낼 수 있는 속도(m/s) · gimbal: 시커 시야 반각(°) · seek: IR 시커 탐지 거리(m)
  SARH: { v: 800, boost: 4, life: 22, range: 9000, min: 700, g: 25, vq: 450, gimbal: 50 },
  IR: { v: 700, boost: 3, life: 15, range: 5000, min: 300, g: 40, vq: 400, gimbal: 60, seek: 6000 },
};
// ---------- 플레이어가 고를 수 있는 기체 (V15.0.0-alpha.3). 비행 제원은 P[키], 나머지 차이는 여기에
// load: 자유 모드 기본 무장 · cm: 플레어 · 채프 각각 · radar: 레이더 탐지 거리 배율 · burn: 연료 % 소모 배율
// hb: 히트박스 배율 (가로 · 높이 · 길이) — 기체가 크면 맞기도 쉽다
//   Su-33: R-27 6 + R-73 4 (12 하드포인트), APP-50 96발(48+48, MiG-29 는 60발), N001K 레이더(N019 보다 약 1.3 배),
//          내부 연료 9,400 kg (MiG 약 3,500 kg) · 추력 1.54 배 → 같은 비율로 쓰면 체공 약 1.75 배 → burn 0.57,
//          전장 21.18 / 17.32 · 전폭 14.70 / 11.36 · 전고 5.93 / 4.73
// 캠페인은 이야기 설정상 MiG-29 고정 (20-game-init 의 init).
const ACFT = {
  mig: { name: 'MiG-29 9.12', short: 'MiG-29', load: { SARH: 4, IR: 4 }, cm: 30, radar: 1, burn: 1, hb: [1, 1, 1] },
  su33: { name: 'Su-33', short: 'Su-33', load: { SARH: 6, IR: 4 }, cm: 48, radar: 1.3, burn: 0.57, hb: [1.29, 1.25, 1.22] },
};
let playerAc = 'mig'; // 이번 출격 기체 (init 에서 정한다)
const pickedAc = () => {
  try {
    return localStorage.getItem('stAc') === 'su33' ? 'su33' : 'mig';
  } catch (e) {
    return 'mig';
  }
};
// 지금 레이더 모드의 탐지 거리 (기체 배율 포함)
const rdRange = () => RM[rd.mode].rng * ((p && ACFT[playerAc].radar) || 1);
const RM = [
  { n: 'SEARCH', az: 60, rng: 16000, rate: 0.8 },
  { n: 'MULTI-TRK', az: 50, rng: 14000, rate: 1.6 },
  { n: 'SINGLE-STT', az: 30, rng: 14000, rate: 3 },
  { n: 'QUICK-ACQ', az: 20, rng: 9000, rate: 3 },
];
// ---------- 3D 장면
const R = new T.WebGLRenderer({ antialias: true }),
  scene = new T.Scene(),
  cam = new T.PerspectiveCamera(70, 1, 1, 150000);
// 색 파이프라인: 재질 계산은 선형, 출력은 sRGB, 밝기는 ACES 필름 곡선으로 눌러 담는다.
// 이게 없으면 모든 색이 바래고 태양 · 폭발 · 애프터버너가 하얗게 터진다.
// 색 텍스처(캔버스 · GLB 도색)는 전부 sRGB 로 표시해야 한다 (canvTex · parseSimpleGLB · 계기판 · 구름).
R.outputEncoding = T.sRGBEncoding;
R.toneMapping = T.ACESFilmicToneMapping;
R.toneMappingExposure = 0.85;
// 코드에 적힌 16진수 · CSS 색은 전부 "눈에 보이는 색(sRGB)" 이다. three 는 선형 값으로 계산하므로
// 색을 넣는 순간 변환한다 (훗날 three 의 ColorManagement 와 같은 규칙). copy · setRGB 는 선형 그대로.
{
  const sh = T.Color.prototype.setHex,
    ss = T.Color.prototype.setStyle;
  T.Color.prototype.setHex = function (h) {
    sh.call(this, h);
    return this.convertSRGBToLinear();
  };
  T.Color.prototype.setStyle = function (s) {
    ss.call(this, s);
    return this.convertSRGBToLinear();
  };
}
// ---------- 텍스처 크기 제한 (GPU 메모리)
// 4096 모델 텍스처 네 장(MiG-29 · F-16 · La-17 · 항모)만으로 GPU 메모리를 330MB 가까이 써서,
// 휴대폰 · 내장 그래픽에서는 WebGL 컨텍스트를 잃고 화면이 멈췄다. 기기에 맞춰 줄여서 올린다:
// 휴대폰 1024 · 그 밖 2048 (scale 로 모델별 가감: 항모 ×2 · 표적 드론 ×0.5).
const MOBILE =
  /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
function texCap(scale = 1) {
  // 폰은 갑판처럼 크게 쓰는 텍스처도 1536 을 넘기지 않는다 (GPU 메모리 여유가 적다)
  return Math.min(R.capabilities.maxTextureSize || 4096, MOBILE ? Math.min(1024 * scale, 1536) : 2048 * scale);
}
// PNG · JPEG 머리말에서 크기만 읽는다 (그림을 펼치지 않는다)
function imageSize(b) {
  if (b[0] === 0x89 && b[1] === 0x50) {
    const d = new DataView(b.buffer, b.byteOffset);
    return { w: d.getUint32(16), h: d.getUint32(20) };
  }
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const mk = b[i + 1];
    if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc)
      return { w: (b[i + 7] << 8) | b[i + 8], h: (b[i + 5] << 8) | b[i + 6] };
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return null;
}
// 압축된 그림 바이트를 max 크기 안에서 바로 펼친다.
// createImageBitmap 의 resize 를 쓰면 원본 크기 그림이 메모리에 한 번도 올라가지 않는다.
// (4096 짜리 한 장이 67 MB 라, 폰에서는 이것 때문에 WebGL 컨텍스트가 날아간다.)
function decodeTexImage(bytes, mime, max) {
  const sz = imageSize(bytes);
  if (self.createImageBitmap) {
    const blob = new Blob([bytes], { type: mime || 'image/png' });
    const k = sz ? max / Math.max(sz.w, sz.h) : 1;
    const opt =
      sz && k < 1
        ? {
            resizeWidth: Math.max(1, Math.round(sz.w * k)),
            resizeHeight: Math.max(1, Math.round(sz.h * k)),
            resizeQuality: 'high',
          }
        : undefined;
    return createImageBitmap(blob, opt).catch(() => decodeTexImageViaImg(bytes, mime, max));
  }
  return decodeTexImageViaImg(bytes, mime, max);
}
// 예비 경로: createImageBitmap 이 없거나 실패하면 <img> 로 펼친 뒤 캔버스에서 줄인다
function decodeTexImageViaImg(bytes, mime, max) {
  return new Promise((res, rej) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    const img = new Image();
    img.onload = () => res(fitImage(img, max));
    img.onerror = rej;
    img.src = 'data:' + (mime || 'image/png') + ';base64,' + btoa(bin);
  });
}
// 모델 텍스처는 한 번에 한 장씩만 펼친다 (동시에 펼치면 메모리가 몰린다)
let texQueue = Promise.resolve();
function decodeTexQueued(bytes, mime, max) {
  const r = texQueue.then(() => decodeTexImage(bytes, mime, max));
  texQueue = r.catch(() => {});
  return r;
}
// 이미지가 max 보다 크면 캔버스에 줄여 그려서 돌려준다
function fitImage(img, max) {
  const w = img.naturalWidth || img.width,
    h = img.naturalHeight || img.height,
    k = max / Math.max(w, h);
  if (!(k < 1)) return img;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}
R.autoClear = false;
scene.background = new T.Color(0x78aee6);
scene.fog = new T.Fog(0x9cc4ea, 9000, 70000);
scene.add(new T.HemisphereLight(0xffffff, 0x4a6a90, 1.1));
const sun = new T.DirectionalLight(0xffffff, 0.8);
sun.position.set(1, 2, 0.5);
scene.add(sun);
document.body.prepend(R.domElement);
const hud = $('hud'),
  g = hud.getContext('2d');
function canvTex(f, s = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  f(c.getContext('2d'), s);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  return t;
}
const TX = canvTex((x, s) => {
  const r = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, '#fff');
  r.addColorStop(0.4, 'rgba(255,255,255,.5)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = r;
  x.fillRect(0, 0, s, s);
});
// Soft cloud and smoke maps avoid the dotted, multi-colour look of a reused flare sprite.
const CLOUDTX = canvTex((x, s) => {
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 30; i++) {
    const px = s * (0.16 + rnd() * 0.68),
      py = s * (0.28 + rnd() * 0.46),
      rx = s * (0.09 + rnd() * 0.19),
      ry = s * (0.07 + rnd() * 0.16);
    const gr = x.createRadialGradient(px, py, Math.max(1, rx * 0.08), px, py, Math.max(rx, ry));
    gr.addColorStop(0, 'rgba(250,253,255,.30)');
    gr.addColorStop(0.48, 'rgba(238,246,252,.18)');
    gr.addColorStop(1, 'rgba(230,241,249,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.ellipse(px, py, rx, ry, rnd() * 0.25, 0, Math.PI * 2);
    x.fill();
  }
}, 256);
const SMOKETX = canvTex((x, s) => {
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 11; i++) {
    const px = s * (0.25 + rnd() * 0.5),
      py = s * (0.25 + rnd() * 0.5),
      r = s * (0.15 + rnd() * 0.25);
    const gr = x.createRadialGradient(px, py, 1, px, py, r);
    gr.addColorStop(0, 'rgba(205,211,216,.30)');
    gr.addColorStop(0.55, 'rgba(160,169,177,.20)');
    gr.addColorStop(1, 'rgba(125,135,145,0)');
    x.fillStyle = gr;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }
}, 128);
const seaTx = canvTex((x, s) => {
  x.fillStyle = '#1d5f9a';
  x.fillRect(0, 0, s, s);
  x.strokeStyle = '#3a86c4';
  x.lineWidth = 2;
  x.strokeRect(0, 0, s, s);
  for (let i = 0; i < 14; i++) {
    x.fillStyle = 'rgba(255,255,255,.12)';
    x.fillRect(rnd() * s, rnd() * s, 8, 2);
  }
}, 128);
seaTx.wrapS = seaTx.wrapT = T.RepeatWrapping;
seaTx.repeat.set(200, 200);
const sea = new T.Mesh(new T.PlaneGeometry(200000, 200000), new T.MeshBasicMaterial({ map: seaTx }));
sea.rotation.x = -Math.PI / 2;
scene.add(sea);
const clouds = [];
for (let i = 0; i < 34; i++) {
  const sm = new T.SpriteMaterial({
    map: CLOUDTX,
    color: 0xffffff,
    opacity: 0.72,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: T.NormalBlending,
  });
  const cloud = new T.Sprite(sm);
  cloud.scale.set(8500 + rnd() * 6500, 2100 + rnd() * 1900, 1);
  cloud.position.set((rnd() - 0.5) * 90000, 4200 + rnd() * 4200, (rnd() - 0.5) * 90000);
  scene.add(cloud);
  clouds.push(cloud);
}
const CV = createKuznetsov();
CV.scale.setScalar(3);
scene.add(CV);
CV.userData.setSpeed(15);
const GROUND_THREATS = [],
  SAM_PROJECTILES = [];
let samRwr = { state: 'CLEAR', bearing: 0, range: 0, site: null };
const AIRBASE = createAirbase();
scene.add(AIRBASE);
AIRBASE.visible = false;
const CVO = { cx: 0, cz: -12000, R: 7000, th: Math.PI / 2 };
function cvPlace() {
  CV.position.set(CVO.cx + CVO.R * Math.cos(CVO.th), 0, CVO.cz + CVO.R * Math.sin(CVO.th));
  CV.rotation.y = Math.PI - CVO.th;
  CV.updateMatrixWorld(true);
}
function cvUpdate(dt) {
  CVO.th += (15 / CVO.R) * dt;
  cvPlace();
  CV.userData.update(dt);
}
const M = (geo, col) => new T.Mesh(geo, new T.MeshLambertMaterial({ color: col })),
  bx = (w, h, d, c, x, y, z) => {
    const m = M(new T.BoxGeometry(w, h, d), c);
    m.position.set(x, y, z);
    return m;
  };
function cylZ(r1, r2, l, c, z) {
  const m = M(new T.CylinderGeometry(r1, r2, l, 10), c);
  m.rotation.x = Math.PI / 2;
  m.position.z = z;
  return m;
}
function coneZ(r, l, c, z) {
  const m = M(new T.ConeGeometry(r, l, 10), c);
  m.rotation.x = -Math.PI / 2;
  m.position.z = z;
  return m;
}
let f16Proto;
function f16Mesh() {
  if (!f16Proto && !f16GLBTemplate) {
    f16Proto = createF16({ tanks: true });
    f16Proto.userData = {};
  }
  const gp = new T.Group(),
    jet = f16GLBTemplate ? f16GLBTemplate.clone() : f16Proto.clone(); // 실측 GLB 가 있으면 그것을 쓴다
  if (!f16GLBTemplate) jet.position.z = -2.5;
  gp.add(jet);
  // 노즐 열기: 예전에는 지름 90(×3) 짜리 주황 광원이 기체 전체를 덮어 적기가 주황색으로 보였다.
  // 실측 모델의 노즐 출구(y -0.07, z 4.55)에 작게 붙이고, 애프터버너를 켤 때만 불꽃이 나온다.
  const nz = f16GLBTemplate ? V(0, -0.07, 4.55) : V(0, 0, 7);
  const gl = new T.Sprite(
    new T.SpriteMaterial({ map: TX, color: 0xffaa55, blending: T.AdditiveBlending, depthWrite: false })
  );
  gl.scale.set(2.4, 2.4, 1);
  gl.position.copy(nz).add(V(0, 0, 0.4));
  gp.add(gl);
  const flame = new T.Mesh(
    new T.ConeGeometry(0.3, 2.6, 16, 1, true),
    new T.MeshBasicMaterial({
      color: 0xffa34a,
      transparent: true,
      opacity: 0.8,
      blending: T.AdditiveBlending,
      depthWrite: false,
      side: T.DoubleSide,
    })
  );
  flame.rotation.x = Math.PI / 2;
  flame.position.copy(nz).add(V(0, 0, 1.3));
  flame.visible = false;
  gp.add(flame);
  gp.userData.setAfterburner = on => {
    flame.visible = !!on;
    gl.scale.setScalar(on ? 4.2 : 2.4);
  };
  gp.scale.setScalar(3);
  return gp;
}
const MSLP = {};
function mslMesh(ac, ty) {
  // MiG-29 가 쏘는 R-27R · R-73 은 실측 GLB (10-model-missile-glb). 없으면 절차 모델.
  const side = ac.side,
    glb = (side === 'P' || ac.mock) && typeof mslGLBTemplate !== 'undefined' && mslGLBTemplate[ty];
  if (glb) return glb.clone();
  const k = side + ty;
  return (MSLP[k] || (MSLP[k] = mslBuild(side, ty))).clone();
}
function mslBuild(side, ty) {
  const gp = new T.Group();
  if (side == 'P') {
    // MiG 진영: 가늘고 흰 동체 + 뾰족한 빨간 노즈 + 십자 대형 날개 + 녹색 띠
    gp.add(
      cylZ(0.32, 0.32, 6, 0xf2f2f2, 0),
      coneZ(0.32, 2.6, ty == 'IR' ? 0x6cf : 0xd22, -4.2),
      cylZ(0.34, 0.34, 0.7, 0x1c4, 1),
      bx(3.6, 0.08, 1.1, 0xdddddd, 0, 0, 2),
      bx(0.08, 3.6, 1.1, 0xdddddd, 0, 0, 2)
    );
  } else {
    // F-16 진영: 굵고 어두운 동체 + 뭉툭한 구형 노즈 + 중간 쌍날개 + 주황 띠
    gp.add(
      cylZ(0.55, 0.55, 5.5, 0x4a5238, 0),
      M(new T.SphereGeometry(0.55, 8, 8), ty == 'IR' ? 0x8cf : 0x222),
      cylZ(0.57, 0.57, 0.7, 0xf80, -0.8),
      bx(5.2, 0.1, 1.6, 0x6a7258, 0, 0, -0.3),
      bx(2, 0.1, 0.9, 0x6a7258, 0, 0, 2.4)
    );
    gp.children[1].position.z = -2.9;
  }
  gp.scale.setScalar(2.6);
  return gp;
}
// 예광탄: 스스로 빛나는 막대. 톤매핑을 빼서 어둡게 눌리지 않게 한다.
// 가산 혼합은 밝은 하늘에서 하얗게 묻혀 버려서 쓰지 않는다 — 주황 불투명이 낮 하늘에서 가장 잘 보인다.
// 굵기는 30-hitbox-guns 의 updBul 에서 카메라 거리에 맞춰 키운다 (멀어져도 1픽셀 아래로 사라지지 않게).
const bGeo = new T.BoxGeometry(0.7, 0.7, 32),
  tracerMat = c => new T.MeshBasicMaterial({ color: c, toneMapped: false, fog: false }),
  bMat = [tracerMat(0xff8c1a), tracerMat(0xff3a2a)];
