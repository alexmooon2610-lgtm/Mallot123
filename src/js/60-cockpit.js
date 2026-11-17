// ===== MiG-29 9.12 콕핏 (3D) =====
// 좌표: 조종사 눈(콕핏 카메라) 이 원점, -Z 전방, +Y 위, 단위 m.
// 콕핏은 전용 카메라(ckCam)로 월드 위에 따로 그린다 → 월드 깊이 정밀도와 무관하고, 화면에 고정된다.
// 구성: 윈드실드 프레임 · 후방 거울 3개 · 글레어실드 · ILS-31 HUD 결합유리 · 청록색 계기판
//       (КПП 자세계 볼 · ПНП 방위계 카드 · 아날로그 바늘 계기 · СПО-15 경보기 · 레이더 B-스코프 · 무장 패널 · 경고등)
//       · 측면 벽/콘솔 · 조종간 · 스로틀. 바늘·볼·카드는 매 프레임, 화면형 계기는 초당 10회 갱신.
// 표시 값은 게임 상태(p, rd, sk, es, ms …) 를 읽기만 한다.
const cockpitScene = new T.Scene();
const ckCam = new T.PerspectiveCamera(78, 16 / 9, 0.05, 20);
cockpitScene.add(ckCam);
const ck = new T.Group();
ckCam.add(ck);
// 콕핏 조명: 하늘빛 + 태양 (월드 태양 방향을 매 프레임 콕핏 좌표로 바꿔 넣는다 → 선회하면 햇빛이 콕핏을 훑는다)
const ckHemi = new T.HemisphereLight(0xdde8f2, 0x2a3034, 0.72);
const ckSun = new T.DirectionalLight(0xfff0d8, 0.8);
cockpitScene.add(ckHemi, ckSun, ckSun.target);

// ---------- 재질
const ckM = (color, rough = 0.8, metal = 0.1, extra = {}) =>
  new T.MeshStandardMaterial(Object.assign({ color, roughness: rough, metalness: metal }, extra));
const CKM = {
  frame: ckM(0x5a646a, 0.6, 0.35),
  seal: ckM(0x111314, 0.95, 0),
  hood: ckM(0x191b1d, 0.97, 0),
  teal: ckM(0x35736f, 0.85, 0.05),
  tealDk: ckM(0x2c6866, 0.85, 0.05),
  wall: ckM(0x37423f, 0.85, 0.1),
  bezel: ckM(0x23272a, 0.45, 0.6),
  black: ckM(0x0e1011, 0.7, 0.2),
  metal: ckM(0x8a9296, 0.35, 0.8),
  red: ckM(0xa3241c, 0.6, 0.1),
  yellow: ckM(0xd7b13a, 0.6, 0.1),
};
const ckAdd = (geo, mat, x, y, z, parent = ck) => {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
};
const ckCanvas = (w, h) => {
  const c = document.createElement('canvas');
  // 폰에서는 계기판 텍스처도 줄인다 (2048 짜리 한 장이 10 MB 다)
  const k = Math.min(1, texCap() / Math.max(w, h));
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const tex = new T.CanvasTexture(c);
  tex.encoding = T.sRGBEncoding;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.magFilter = T.LinearFilter;
  try {
    tex.anisotropy = Math.min(8, R.capabilities.getMaxAnisotropy());
  } catch (e) {}
  const x = c.getContext('2d');
  if (k < 1) x.scale(k, k); // 그리는 쪽은 원래 좌표(w · h)를 그대로 쓴다
  return { c, x, tex, w, h };
};
const CKF = (sz, w = 600) => `${w} ${sz}px Arial, "Helvetica Neue", sans-serif`;

// ---------- 후방 거울 (81-rear-mirror 가 15Hz 로 렌더 타깃에 그린다)
const mirrorRT = new T.WebGLRenderTarget(512, 192, { depthBuffer: true, stencilBuffer: false });
mirrorRT.texture.generateMipmaps = false;
mirrorRT.texture.minFilter = T.LinearFilter;
mirrorRT.texture.magFilter = T.LinearFilter;
// 화면과 같은 sRGB 로 그린다 (V15.0.0-alpha.3): three r128 은 렌더 타깃의 encoding 을 셰이더 키에 넣어서,
// 선형(기본값)이면 거울을 처음 그릴 때 장면의 셰이더를 전부 한 벌 더 컴파일했다(측정 +8개 · 교전 중 멈칫).
// sRGB 로 저장하면 어두운 쪽 계조도 더 좋다. 콕핏의 거울 재질은 이 텍스처를 sRGB 로 읽어 색은 그대로다.
mirrorRT.texture.encoding = T.sRGBEncoding;
const mirrorCam = new T.PerspectiveCamera(70, 512 / 192, 0.5, 60000);
const mirrorYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI);
const mirrorInterval = 1000 / 15;
let mirrorLast = 0;
// 거울 면: 좌우가 뒤집혀 보이도록 U 를 반전하고, 세 거울이 렌더 타깃의 왼쪽·가운데·오른쪽을 나눠 쓴다
function ckMirror(w, h, u0, u1, x, y, z, ry, rz) {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.rotation.set(0.18, ry, rz);
  ck.add(g);
  ckAdd(new T.BoxGeometry(w + 0.012, h + 0.012, 0.012), CKM.frame, 0, 0, -0.008, g);
  const geo = new T.PlaneGeometry(w, h),
    uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) > 0.5 ? u0 : u1);
  ckAdd(geo, new T.MeshBasicMaterial({ map: mirrorRT.texture, color: 0xd8dde0 }), 0, 0, -0.001, g);
  ckAdd(new T.CylinderGeometry(0.004, 0.004, 0.03, 6), CKM.frame, 0, h / 2 + 0.012, -0.012, g);
  return g;
}

// ---------- 윈드실드 프레임 (뒤집힌 U 자) · 캐노피 레일
const archPts = s => [
  V(0.7 * s, -0.125, -0.69),
  V(0.8 * s, 0.06, -0.645),
  V(0.84 * s, 0.24, -0.605),
  V(0.72 * s, 0.38, -0.575),
  V(0.4 * s, 0.425, -0.56),
];
const archCurve = new T.CatmullRomCurve3([...archPts(-1), V(0, 0.43, -0.555), ...archPts(1).reverse()]);
ckAdd(new T.TubeGeometry(archCurve, 90, 0.016, 10, false), CKM.frame, 0, 0, 0);
// 안쪽 고무 실링 (유리와 프레임 경계의 검은 테)
const sealCurve = new T.CatmullRomCurve3(
  archCurve.getPoints(40).map(q =>
    q
      .clone()
      .multiplyScalar(0.985)
      .add(V(0, 0, 0.004))
  )
);
ckAdd(new T.TubeGeometry(sealCurve, 90, 0.006, 6, false), CKM.seal, 0, 0, 0);
// 기둥을 넓적하게 보이게 하는 판 (기둥 바깥쪽)
for (const s of [-1, 1]) {
  const pts = archPts(s).slice(0, 4),
    shape = new T.CatmullRomCurve3(pts.map(q => q.clone().add(V(0.022 * s, 0, 0.01))));
  ckAdd(new T.TubeGeometry(shape, 40, 0.012, 8, false), CKM.frame, 0, 0, 0);
}
// 거울 3개 (가운데는 넓게, 양옆은 안쪽으로 비스듬히)
ckMirror(0.15, 0.05, 0.3, 0.7, 0, 0.402, -0.55, 0, 0);
ckMirror(0.085, 0.042, 0.0, 0.32, -0.4, 0.39, -0.558, 0.35, -0.12);
ckMirror(0.085, 0.042, 0.68, 1.0, 0.4, 0.39, -0.558, -0.35, 0.12);
// 캐노피 레일 (조종석 양옆 위 테두리) 과 측면 벽
for (const s of [-1, 1]) {
  const rail = ckAdd(new T.BoxGeometry(0.05, 0.035, 0.62), CKM.frame, 0.655 * s, -0.135, -0.39);
  rail.rotation.y = -0.05 * s;
  const wall = ckAdd(new T.PlaneGeometry(0.72, 0.62), CKM.wall, 0.64 * s, -0.45, -0.42);
  wall.rotation.y = (-s * Math.PI) / 2;
  // 계기판 옆을 막는 앞 칸막이 (계기판 가장자리 ~ 측면 벽)
  ckAdd(new T.BoxGeometry(0.1, 0.66, 0.04), CKM.wall, 0.655 * s, -0.46, -0.735);
  ckAdd(new T.BoxGeometry(0.08, 0.5, 0.12), CKM.tealDk, 0.62 * s, -0.45, -0.68);
  // 측면 콘솔 (화면 아래 모서리에 조금만 보인다)
  const con = new T.Group();
  con.position.set(0.53 * s, -0.6, -0.38);
  con.rotation.set(-0.06, 0, 0.12 * s);
  ck.add(con);
  ckAdd(new T.BoxGeometry(0.2, 0.06, 0.6), CKM.wall, 0, 0, 0, con);
  for (let i = 0; i < 7; i++) {
    const z = -0.24 + i * 0.075;
    ckAdd(new T.BoxGeometry(0.06, 0.012, 0.045), CKM.teal, -0.04 * s, 0.036, z, con);
    const tg = ckAdd(
      new T.CylinderGeometry(0.004, 0.006, 0.03, 6),
      i % 4 === 0 ? CKM.red : CKM.metal,
      0.05 * s,
      0.05,
      z,
      con
    );
    tg.rotation.x = -0.4;
  }
}

// ---------- 글레어실드 (계기판 위 검은 차양) · 앞쪽 둥근 립
{
  const sh = new T.Shape();
  sh.moveTo(-0.665, 0.69);
  sh.quadraticCurveTo(0, 0.6, 0.665, 0.69);
  sh.lineTo(0.7, 0.88);
  sh.lineTo(-0.7, 0.88);
  sh.closePath();
  const geo = new T.ExtrudeGeometry(sh, { depth: 0.022, bevelEnabled: false, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2); // 모양의 y → -z, 두께는 위로
  ckAdd(geo, CKM.hood, 0, -0.127, 0);
  const lip = new T.QuadraticBezierCurve3(V(-0.665, -0.124, -0.69), V(0, -0.124, -0.6), V(0.665, -0.124, -0.69));
  ckAdd(new T.TubeGeometry(lip, 40, 0.018, 10, false), CKM.hood, 0, 0, 0);
}

// ---------- ILS-31 HUD: 받침 · 결합유리 · 유리 테
const HUDG = { w: 0.5, h: 0.3, x: 0, y: 0.055, z: -0.675, tilt: -0.32 };
const hudUnit = new T.Group();
hudUnit.position.set(HUDG.x, HUDG.y, HUDG.z);
ck.add(hudUnit);
ckAdd(new T.BoxGeometry(0.2, 0.05, 0.14), CKM.black, 0, -0.178, -0.05, hudUnit);
ckAdd(new T.BoxGeometry(0.24, 0.012, 0.16), CKM.bezel, 0, -0.152, -0.05, hudUnit);
const hudGlassG = new T.Group();
hudGlassG.rotation.x = HUDG.tilt;
hudUnit.add(hudGlassG);
const hudGlass = ckAdd(
  new T.PlaneGeometry(HUDG.w, HUDG.h),
  new T.MeshBasicMaterial({ color: 0xa8e8c0, transparent: true, opacity: 0.07, depthWrite: false, side: T.DoubleSide }),
  0,
  0,
  0,
  hudGlassG
);
for (const s of [-1, 1]) {
  ckAdd(new T.BoxGeometry(0.012, HUDG.h + 0.01, 0.012), CKM.bezel, (s * HUDG.w) / 2, 0, 0, hudGlassG);
  const arm = ckAdd(
    new T.BoxGeometry(0.014, 0.06, 0.03),
    CKM.bezel,
    (s * HUDG.w) / 2.6,
    -HUDG.h / 2 - 0.02,
    -0.02,
    hudGlassG
  );
  arm.rotation.x = 0.4;
}
ckAdd(new T.BoxGeometry(HUDG.w + 0.012, 0.01, 0.012), CKM.bezel, 0, HUDG.h / 2, 0, hudGlassG);
// HUD 유리의 화면 사각형 (98-ace-hud 가 콕핏 HUD 를 이 안에만 그린다)
const _hudCorner = V();
function ckHudRect() {
  hudGlass.updateMatrixWorld(true);
  let x0 = 1e9,
    y0 = 1e9,
    x1 = -1e9,
    y1 = -1e9;
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    _hudCorner
      .set((sx * HUDG.w) / 2, (sy * HUDG.h) / 2, 0)
      .applyMatrix4(hudGlass.matrixWorld)
      .project(ckCam);
    const x = ((_hudCorner.x + 1) / 2) * W,
      y = ((1 - _hudCorner.y) / 2) * VH;
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

// ---------- 계기판 (청록색 판, 위가 뒤로 기운다)
const PW = 1.2,
  PHT = 0.56,
  PK = 2048 / PW; // 판 위 1 m = PK px
const panel = new T.Group();
panel.position.set(0, -0.4, -0.74);
panel.rotation.x = -0.3;
ck.add(panel);
// 판 두께는 테두리 막대로만 낸다 (뒤판이 있으면 КПП 볼이 가려진다)
for (const [w, h, x, y] of [
  [PW + 0.03, 0.03, 0, PHT / 2 + 0.012],
  [PW + 0.03, 0.03, 0, -PHT / 2 - 0.012],
  [0.03, PHT + 0.03, -PW / 2 - 0.012, 0],
  [0.03, PHT + 0.03, PW / 2 + 0.012, 0],
])
  ckAdd(new T.BoxGeometry(w, h, 0.05), CKM.tealDk, x, y, -0.02, panel);
// 계기 배치 (판 중심 기준 m)
const INS = {
  spo: { x: -0.47, y: 0.095, w: 0.16, h: 0.118 },
  kus: { x: -0.255, y: 0.095, r: 0.056 },
  adi: { x: 0, y: 0.095, r: 0.079 },
  vdi: { x: 0.255, y: 0.095, r: 0.056 },
  ipv: { x: 0.47, y: 0.095, w: 0.17, h: 0.14 },
  uap: { x: -0.43, y: -0.062, r: 0.047 },
  rv: { x: -0.3, y: -0.062, r: 0.043 },
  hsi: { x: 0, y: -0.068, r: 0.064 },
  var: { x: 0.185, y: -0.062, r: 0.047 },
  ita: { x: 0.315, y: -0.062, r: 0.044 },
  fuel: { x: 0.445, y: -0.062, r: 0.044 },
  pui: { x: -0.25, y: -0.18, w: 0.3, h: 0.07 },
  egt: { x: 0.2, y: -0.175, r: 0.038 },
  clk: { x: 0.33, y: -0.175, r: 0.038 },
  gear: { x: 0.0, y: -0.178, w: 0.13, h: 0.05 },
};
const PX = x => (x + PW / 2) * PK,
  PY = y => (PHT / 2 - y) * PK;
const face = ckCanvas(2048, Math.round(PHT * PK));
// 값 → 다이얼 각도 (12시 기준 시계방향 도) 를 계기별로 정의
const DIAL = {
  kus: v => (clamp(v, 0, 1600) / 1600) * 320,
  vdiL: m => ((((m % 1000) + 1000) % 1000) / 1000) * 360,
  vdiS: m => (clamp(m, 0, 10000) / 10000) * 360,
  uapA: a => -135 + ((clamp(a, -10, 40) + 10) / 50) * 270,
  uapG: n => -135 + ((clamp(n, -3, 9) + 3) / 12) * 270,
  rv: h => Math.sqrt(clamp(h, 0, 1500) / 1500) * 300,
  var: v => 270 + Math.sign(v) * 165 * Math.sqrt(clamp(Math.abs(v), 0, 150) / 150),
  ita: r => -135 + (clamp(r, 0, 110) / 110) * 270,
  fuel: kg => -135 + (clamp(kg, 0, 4000) / 4000) * 270,
  egt: c => -135 + ((clamp(c, 200, 1000) - 200) / 800) * 270,
};
const toCan = deg => ((deg - 90) * Math.PI) / 180; // 12시 기준 시계방향 도 → 캔버스 각도

function drawPanelFace() {
  const c = face.x,
    w = face.w,
    h = face.h;
  // 청록 도장 + 미세한 얼룩·마모
  const gr = c.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#478f8b');
  gr.addColorStop(1, '#3a7b77');
  c.fillStyle = gr;
  c.fillRect(0, 0, w, h);
  let seed = 29;
  const rr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 2600; i++) {
    c.fillStyle = `rgba(${rr() < 0.5 ? '0,0,0' : '255,255,255'},${0.025 + rr() * 0.03})`;
    c.fillRect(rr() * w, rr() * h, 1 + rr() * 5, 1 + rr() * 5);
  }
  // 하위 패널 판: 살짝 어두운 판 + 음각 테 + 나사
  const plate = (x0, y0, x1, y1) => {
    const X0 = PX(x0),
      Y0 = PY(y1),
      X1 = PX(x1),
      Y1 = PY(y0);
    c.fillStyle = 'rgba(20,60,58,.18)';
    c.fillRect(X0, Y0, X1 - X0, Y1 - Y0);
    c.strokeStyle = 'rgba(0,0,0,.45)';
    c.lineWidth = 3;
    c.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    c.strokeStyle = 'rgba(255,255,255,.18)';
    c.lineWidth = 2;
    c.strokeRect(X0 + 3, Y0 + 3, X1 - X0 - 6, Y1 - Y0 - 6);
    for (const [sx, sy] of [
      [X0 + 12, Y0 + 12],
      [X1 - 12, Y0 + 12],
      [X0 + 12, Y1 - 12],
      [X1 - 12, Y1 - 12],
    ])
      screw(sx, sy);
  };
  const screw = (x, y) => {
    c.fillStyle = '#222a2a';
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8a9a98';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(x - 4, y - 2);
    c.lineTo(x + 4, y + 2);
    c.stroke();
  };
  plate(-0.585, 0.02, 0.585, 0.255);
  plate(-0.585, -0.125, 0.585, 0.018);
  plate(-0.585, -0.27, 0.585, -0.128);
  // 문자 (흰 도장)
  const label = (s, x, y, sz = 20, al = 'center') => {
    c.fillStyle = '#e8ece4';
    c.font = CKF(sz, 700);
    c.textAlign = al;
    c.fillText(s, PX(x), PY(y));
  };
  // 다이얼 얼굴: 검은 면 + 눈금 + 숫자
  const dial = (k, title, scales) => {
    const d = INS[k],
      X = PX(d.x),
      Y = PY(d.y),
      Rr = d.r * PK;
    c.fillStyle = '#0b0d0e';
    c.beginPath();
    c.arc(X, Y, Rr, 0, Math.PI * 2);
    c.fill();
    const gl = c.createRadialGradient(X - Rr * 0.3, Y - Rr * 0.35, 4, X, Y, Rr);
    gl.addColorStop(0, '#1d2224');
    gl.addColorStop(1, '#070909');
    c.fillStyle = gl;
    c.fill();
    for (const s of scales) {
      const { v0, v1, step, major, map, rr: rad = 0.9, lab, red } = s;
      if (red) {
        c.strokeStyle = '#c8322a';
        c.lineWidth = Rr * 0.07;
        c.beginPath();
        c.arc(X, Y, Rr * rad - Rr * 0.05, toCan(map(red[0])), toCan(map(red[1])));
        c.stroke();
      }
      for (let v = v0; v <= v1 + 1e-6; v += step) {
        const a = toCan(map(v)),
          isMaj = Math.abs(v / major - Math.round(v / major)) < 1e-6,
          r0 = Rr * rad,
          r1 = Rr * (rad - (isMaj ? 0.14 : 0.07));
        c.strokeStyle = '#eef0e8';
        c.lineWidth = isMaj ? Rr * 0.035 : Rr * 0.018;
        c.beginPath();
        c.moveTo(X + Math.cos(a) * r0, Y + Math.sin(a) * r0);
        c.lineTo(X + Math.cos(a) * r1, Y + Math.sin(a) * r1);
        c.stroke();
        if (isMaj && lab) {
          const txt = lab(v);
          if (txt === null) continue;
          c.fillStyle = '#eef0e8';
          c.font = CKF(Math.round(Rr * 0.2), 700);
          c.textAlign = 'center';
          const rt = Rr * (rad - 0.3);
          c.fillText(txt, X + Math.cos(a) * rt, Y + Math.sin(a) * rt + Rr * 0.07);
        }
      }
    }
    if (title) {
      c.fillStyle = '#c9d0c6';
      c.font = CKF(Math.round(Rr * 0.13), 700);
      c.textAlign = 'center';
      c.fillText(title, X, Y + Rr * 0.42);
    }
  };
  dial('kus', 'км/ч', [{ v0: 0, v1: 1600, step: 50, major: 200, map: DIAL.kus, lab: v => String(v / 100) }]);
  dial('vdi', 'ВЫСОТА  м', [
    { v0: 0, v1: 950, step: 50, major: 100, map: DIAL.vdiL, lab: v => String(v / 100) },
    { v0: 0, v1: 9000, step: 1000, major: 1000, map: DIAL.vdiS, rr: 0.52, lab: null },
  ]);
  dial('uap', 'α  /  n', [
    { v0: -10, v1: 40, step: 5, major: 10, map: DIAL.uapA, lab: v => String(v), red: [26, 40] },
    { v0: -3, v1: 9, step: 1, major: 3, map: DIAL.uapG, rr: 0.5, lab: null },
  ]);
  dial('rv', 'РВ  м', [
    {
      v0: 0,
      v1: 1500,
      step: 50,
      major: 500,
      map: DIAL.rv,
      lab: v => (v === 0 ? '0' : String(v)),
    },
    { v0: 0, v1: 200, step: 50, major: 100, map: DIAL.rv, lab: v => (v ? String(v) : null) },
  ]);
  dial('var', 'ВАР  м/с', [
    { v0: -150, v1: 150, step: 5, major: 50, map: DIAL.var, lab: v => String(Math.abs(v)) },
    { v0: -20, v1: 20, step: 5, major: 10, map: DIAL.var, lab: null },
  ]);
  dial('ita', 'ОБОРОТЫ %', [
    { v0: 0, v1: 110, step: 5, major: 20, map: DIAL.ita, lab: v => String(v), red: [102, 110] },
  ]);
  dial('fuel', 'ТОПЛИВО т', [{ v0: 0, v1: 4000, step: 250, major: 1000, map: DIAL.fuel, lab: v => String(v / 1000) }]);
  dial('egt', 'Т ГАЗОВ', [
    { v0: 200, v1: 1000, step: 50, major: 200, map: DIAL.egt, lab: v => String(v / 100), red: [880, 1000] },
  ]);
  dial('clk', 'АЧС', [
    { v0: 0, v1: 11.5, step: 0.5, major: 1, map: h => h * 30, lab: v => (v % 3 === 0 ? String(v || 12) : null) },
  ]);
  // КПП 자세계: 볼이 보이도록 가운데를 뚫는다
  {
    const d = INS.adi,
      X = PX(d.x),
      Y = PY(d.y),
      Rr = d.r * PK;
    c.fillStyle = '#0b0d0e';
    c.beginPath();
    c.arc(X, Y, Rr, 0, Math.PI * 2);
    c.fill();
    for (let a = -60; a <= 60; a += 10) {
      const an = toCan(a),
        big = a % 30 === 0;
      c.strokeStyle = '#eef0e8';
      c.lineWidth = big ? 5 : 3;
      c.beginPath();
      c.moveTo(X + Math.cos(an) * Rr * 0.97, Y + Math.sin(an) * Rr * 0.97);
      c.lineTo(X + Math.cos(an) * Rr * (big ? 0.86 : 0.9), Y + Math.sin(an) * Rr * (big ? 0.86 : 0.9));
      c.stroke();
    }
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(X, Y, Rr * 0.84, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // ПНП 방위계: 카드 둘레의 고정 눈금
  {
    const d = INS.hsi,
      X = PX(d.x),
      Y = PY(d.y),
      Rr = d.r * PK;
    c.fillStyle = '#0b0d0e';
    c.beginPath();
    c.arc(X, Y, Rr, 0, Math.PI * 2);
    c.fill();
    for (let a = 0; a < 360; a += 45) {
      const an = toCan(a);
      c.strokeStyle = '#eef0e8';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(X + Math.cos(an) * Rr * 0.99, Y + Math.sin(an) * Rr * 0.99);
      c.lineTo(X + Math.cos(an) * Rr * 0.93, Y + Math.sin(an) * Rr * 0.93);
      c.stroke();
    }
  }
  // 화면형 계기 자리 (검은 오목면)
  for (const k of ['spo', 'ipv', 'pui', 'gear']) {
    const d = INS[k];
    c.fillStyle = '#050606';
    c.fillRect(PX(d.x - d.w / 2), PY(d.y + d.h / 2), d.w * PK, d.h * PK);
    c.strokeStyle = 'rgba(255,255,255,.2)';
    c.lineWidth = 3;
    c.strokeRect(PX(d.x - d.w / 2) - 4, PY(d.y + d.h / 2) - 4, d.w * PK + 8, d.h * PK + 8);
  }
  // 이름표
  label('СПО-15', INS.spo.x, INS.spo.y - INS.spo.h / 2 - 0.016, 17);
  label('СКОРОСТЬ', INS.kus.x, INS.kus.y - INS.kus.r - 0.016, 17);
  label('КПП', INS.adi.x, INS.adi.y - INS.adi.r - 0.014, 17);
  label('ВДИ', INS.vdi.x, INS.vdi.y - INS.vdi.r - 0.016, 17);
  label('ИПВ  РЛС', INS.ipv.x, INS.ipv.y - INS.ipv.h / 2 - 0.016, 17);
  label('УАП', INS.uap.x, INS.uap.y - INS.uap.r - 0.014, 16);
  label('ПНП', INS.hsi.x, INS.hsi.y - INS.hsi.r - 0.012, 16);
  label('ИТА', INS.ita.x, INS.ita.y - INS.ita.r - 0.014, 16);
  label('МиГ-29  9.12', -0.555, 0.237, 18, 'left');
  label('ЛЕВ  ·  ПРАВ', INS.ita.x, INS.ita.y + INS.ita.r + 0.008, 13);
  face.tex.needsUpdate = true;
}
drawPanelFace();
ckAdd(
  new T.PlaneGeometry(PW, PHT),
  new T.MeshStandardMaterial({
    map: face.tex,
    emissive: 0x1c1c1c,
    emissiveMap: face.tex,
    roughness: 0.82,
    metalness: 0.05,
    alphaTest: 0.5,
  }),
  0,
  0,
  0,
  panel
);
// 글레어실드 그림자: 판 위쪽을 어둡게 (차양 아래라 빛이 덜 든다)
{
  const sh = ckCanvas(8, 128),
    x = sh.x,
    gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(0,0,0,.62)');
  gr.addColorStop(0.55, 'rgba(0,0,0,.18)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 8, 128);
  sh.tex.needsUpdate = true;
  ckAdd(
    new T.PlaneGeometry(PW, 0.16),
    new T.MeshBasicMaterial({ map: sh.tex, transparent: true, depthWrite: false }),
    0,
    PHT / 2 - 0.08,
    0.02,
    panel
  ).renderOrder = 6;
}
// 둥근 계기 테 (3D 링) 와 유리 반사
const glareTex = (() => {
  const g2 = ckCanvas(128, 128),
    x = g2.x,
    gr = x.createRadialGradient(42, 36, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,.55)');
  gr.addColorStop(0.35, 'rgba(255,255,255,.08)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  g2.tex.needsUpdate = true;
  return g2.tex;
})();
const glareMat = new T.MeshBasicMaterial({ map: glareTex, transparent: true, opacity: 0.35, depthWrite: false });
for (const k of ['kus', 'adi', 'vdi', 'uap', 'rv', 'hsi', 'var', 'ita', 'fuel', 'egt', 'clk']) {
  const d = INS[k];
  ckAdd(new T.TorusGeometry(d.r + 0.004, 0.006, 8, 48), CKM.bezel, d.x, d.y, 0.004, panel);
  ckAdd(new T.CircleGeometry(d.r, 32), glareMat, d.x, d.y, 0.016, panel).renderOrder = 5;
}
for (const k of ['spo', 'ipv', 'pui', 'gear']) {
  const d = INS[k];
  for (const [w, h, x, y] of [
    [d.w + 0.024, 0.012, 0, d.h / 2 + 0.006],
    [d.w + 0.024, 0.012, 0, -d.h / 2 - 0.006],
    [0.012, d.h, -d.w / 2 - 0.006, 0],
    [0.012, d.h, d.w / 2 + 0.006, 0],
  ])
    ckAdd(new T.BoxGeometry(w, h, 0.014), CKM.bezel, d.x + x, d.y + y, 0.005, panel);
}

// ---------- 바늘 (회전축이 아래쪽 끝 근처)
const NEEDLE_W = new T.MeshBasicMaterial({ color: 0xf1eee4 }),
  NEEDLE_Y = new T.MeshBasicMaterial({ color: 0xf0c040 }),
  NEEDLE_R = new T.MeshBasicMaterial({ color: 0xd8382c }),
  CAP = new T.MeshBasicMaterial({ color: 0x1a1d1e });
function needle(k, len, wid, mat = NEEDLE_W, z = 0.008, tip = true) {
  const d = INS[k],
    g = new T.Group();
  g.position.set(d.x, d.y, z);
  panel.add(g);
  const geo = new T.PlaneGeometry(wid, len);
  geo.translate(0, len / 2 - len * 0.15, 0);
  g.add(new T.Mesh(geo, mat));
  if (tip) {
    const tg = new T.PlaneGeometry(wid * 1.05, len * 0.18);
    tg.translate(0, len * 0.76, 0.0005);
    g.add(new T.Mesh(tg, NEEDLE_R));
  }
  return g;
}
const setNeedle = (n, deg) => (n.rotation.z = (-deg * Math.PI) / 180);
const NDL = {
  kus: needle('kus', 0.05, 0.005),
  vdiL: needle('vdi', 0.05, 0.005),
  vdiS: needle('vdi', 0.032, 0.008, NEEDLE_W, 0.009, false),
  uapA: needle('uap', 0.042, 0.0045),
  uapG: needle('uap', 0.028, 0.006, NEEDLE_Y, 0.009, false),
  rv: needle('rv', 0.038, 0.0045),
  var: needle('var', 0.042, 0.0045),
  ita1: needle('ita', 0.04, 0.0045),
  ita2: needle('ita', 0.03, 0.0055, NEEDLE_Y, 0.009, false),
  fuel: needle('fuel', 0.039, 0.0045),
  egt1: needle('egt', 0.034, 0.004),
  egt2: needle('egt', 0.026, 0.005, NEEDLE_Y, 0.009, false),
  clkH: needle('clk', 0.022, 0.005, NEEDLE_W, 0.008, false),
  clkM: needle('clk', 0.032, 0.0035, NEEDLE_W, 0.009, false),
  clkS: needle('clk', 0.033, 0.0015, NEEDLE_R, 0.01, false),
};
for (const k of ['kus', 'vdi', 'uap', 'rv', 'var', 'ita', 'fuel', 'egt', 'clk'])
  ckAdd(new T.CircleGeometry(0.0055, 16), CAP, INS[k].x, INS[k].y, 0.011, panel);

// ---------- КПП 자세계 볼 (하늘/땅 구, 피치 눈금) · 고정 기체 표시
const adiBall = (() => {
  const b = ckCanvas(1024, 512),
    x = b.x;
  x.fillStyle = '#5c87ad';
  x.fillRect(0, 0, 1024, 256);
  x.fillStyle = '#5a3f27';
  x.fillRect(0, 256, 1024, 256);
  x.fillStyle = '#f2f2ea';
  x.fillRect(0, 252, 1024, 8);
  for (let a = -80; a <= 80; a += 10) {
    if (!a) continue;
    const y = 256 - (a / 90) * 256,
      big = a % 30 === 0;
    x.fillStyle = a > 0 ? '#eef2f4' : '#f0e2cf';
    for (const u of [0.25]) {
      const cxp = u * 1024,
        half = big ? 70 : 40;
      x.fillRect(cxp - half, y - 2, half * 2, 4);
      if (big) {
        x.font = CKF(22, 700);
        x.textAlign = 'center';
        x.fillText(String(Math.abs(a)), cxp - half - 26, y + 8);
        x.fillText(String(Math.abs(a)), cxp + half + 26, y + 8);
      }
    }
  }
  b.tex.needsUpdate = true;
  const d = INS.adi,
    rb = d.r * 0.86;
  const m = ckAdd(
    new T.SphereGeometry(rb, 48, 32),
    ckM(0xffffff, 0.5, 0, { map: b.tex, emissive: 0x333333, emissiveMap: b.tex }),
    d.x,
    d.y,
    -rb + 0.002,
    panel
  );
  m.rotation.order = 'ZXY';
  return m;
})();
{
  // 고정 기체 표시 (주황 W) 와 경사 지시 삼각형
  const d = INS.adi,
    sym = ckCanvas(256, 256),
    x = sym.x;
  x.strokeStyle = '#ff9a2a';
  x.lineWidth = 9;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(30, 128);
  x.lineTo(92, 128);
  x.lineTo(112, 148);
  x.lineTo(128, 128);
  x.lineTo(144, 148);
  x.lineTo(164, 128);
  x.lineTo(226, 128);
  x.stroke();
  x.fillStyle = '#ff9a2a';
  x.beginPath();
  x.moveTo(128, 18);
  x.lineTo(116, 40);
  x.lineTo(140, 40);
  x.fill();
  sym.tex.needsUpdate = true;
  ckAdd(
    new T.PlaneGeometry(d.r * 1.7, d.r * 1.7),
    new T.MeshBasicMaterial({ map: sym.tex, transparent: true, depthWrite: false }),
    d.x,
    d.y,
    0.012,
    panel
  );
}

// ---------- ПНП 방위계: 회전 카드 · 귀환 방위 바늘 · 고정 기체 표시
const hsiCard = (() => {
  const cv = ckCanvas(512, 512),
    x = cv.x;
  x.fillStyle = '#0b0d0e';
  x.beginPath();
  x.arc(256, 256, 256, 0, Math.PI * 2);
  x.fill();
  x.translate(256, 256);
  for (let a = 0; a < 360; a += 5) {
    x.save();
    x.rotate((a * Math.PI) / 180);
    x.fillStyle = '#eef0e8';
    const big = a % 30 === 0;
    x.fillRect(-(big ? 3 : 1.5), -246, big ? 6 : 3, big ? 34 : a % 10 ? 14 : 22);
    if (big) {
      x.font = CKF(44, 700);
      x.textAlign = 'center';
      const lab = { 0: 'С', 90: 'В', 180: 'Ю', 270: 'З' }[a] || String(a / 10);
      x.fillStyle = { 0: '#ffd36b' }[a] || '#eef0e8';
      x.fillText(lab, 0, -170);
    }
    x.restore();
  }
  cv.tex.needsUpdate = true;
  const d = INS.hsi;
  return ckAdd(new T.CircleGeometry(d.r * 0.9, 64), new T.MeshBasicMaterial({ map: cv.tex }), d.x, d.y, 0.003, panel);
})();
const hsiHome = (() => {
  const d = INS.hsi,
    g = new T.Group();
  g.position.set(d.x, d.y, 0.007);
  panel.add(g);
  const sh = new T.Shape();
  const L = d.r * 0.78,
    w = d.r * 0.07;
  sh.moveTo(0, L);
  sh.lineTo(w * 2.2, L - w * 4);
  sh.lineTo(w * 0.6, L - w * 4);
  sh.lineTo(w * 0.6, -L);
  sh.lineTo(-w * 0.6, -L);
  sh.lineTo(-w * 0.6, L - w * 4);
  sh.lineTo(-w * 2.2, L - w * 4);
  sh.closePath();
  g.add(new T.Mesh(new T.ShapeGeometry(sh), new T.MeshBasicMaterial({ color: 0xf0c040 })));
  return g;
})();
{
  const d = INS.hsi,
    sym = ckCanvas(256, 256),
    x = sym.x;
  x.fillStyle = '#ffffff';
  x.beginPath();
  x.moveTo(128, 6);
  x.lineTo(118, 26);
  x.lineTo(138, 26);
  x.fill();
  x.strokeStyle = '#ff9a2a';
  x.lineWidth = 7;
  x.beginPath();
  x.moveTo(128, 96);
  x.lineTo(128, 168);
  x.moveTo(96, 122);
  x.lineTo(160, 122);
  x.moveTo(114, 160);
  x.lineTo(142, 160);
  x.stroke();
  sym.tex.needsUpdate = true;
  ckAdd(
    new T.PlaneGeometry(d.r * 2, d.r * 2),
    new T.MeshBasicMaterial({ map: sym.tex, transparent: true, depthWrite: false }),
    d.x,
    d.y,
    0.012,
    panel
  );
}

// ---------- 화면형 계기: СПО-15 · ИПВ 레이더 · ПУИ 무장 · 착륙장치 표시
function ckScreen(k, pxW) {
  const d = INS[k],
    s = ckCanvas(pxW, Math.round((pxW * d.h) / d.w));
  s.tex.minFilter = T.LinearFilter;
  s.tex.generateMipmaps = false;
  s.mesh = ckAdd(new T.PlaneGeometry(d.w, d.h), new T.MeshBasicMaterial({ map: s.tex }), d.x, d.y, 0.002, panel);
  return s;
}
const SPO = ckScreen('spo', 320),
  IPV = ckScreen('ipv', 384),
  PUI = ckScreen('pui', 512),
  GEAR = ckScreen('gear', 256);
// 상대 방위(도, 기수 0 · 오른쪽 +) 로 위협 목록 만들기: 적기 레이더 · 날아오는 미사일 · 지상 위협
function ckThreats() {
  const out = [];
  if (!p) return out;
  const qi = p.q.clone().invert();
  const relBrg = pos => {
    const l = pos.clone().sub(p.pos).applyQuaternion(qi);
    return Math.atan2(l.x, -l.z) / D;
  };
  for (const e of es)
    if (e.rwl) out.push({ brg: e.brg ?? relBrg(e.pos), lvl: e.rwl, type: 'П', d: e.pos.distanceTo(p.pos) });
  for (const m of ms)
    if (!m.dead && m.side != 'P' && m.pos.distanceTo(p.pos) < 9000)
      out.push({ brg: relBrg(m.pos), lvl: 3, type: 'Р', d: m.pos.distanceTo(p.pos) });
  if (typeof samRwr !== 'undefined' && (samRwr.state === 'TRACK' || samRwr.state === 'SEARCH')) {
    const f = p.fwd(),
      hdg = (Math.atan2(f.x, -f.z) / D + 360) % 360;
    out.push({
      brg: ((samRwr.bearing - hdg + 540) % 360) - 180,
      lvl: samRwr.state === 'TRACK' ? 2 : 1,
      type: 'Н',
      d: samRwr.range,
    });
  }
  if (typeof SAM_PROJECTILES !== 'undefined')
    for (const q of SAM_PROJECTILES)
      if (!q.dead) out.push({ brg: relBrg(q.mesh.position), lvl: 3, type: 'Н', d: q.mesh.position.distanceTo(p.pos) });
  return out;
}
function drawSPO(blink) {
  const x = SPO.x,
    w = SPO.w,
    h = SPO.h,
    th = ckThreats();
  x.fillStyle = '#0c0f10';
  x.fillRect(0, 0, w, h);
  const cx = w / 2,
    cy = h * 0.56;
  // 기체 실루엣
  x.fillStyle = '#9aa6a4';
  x.beginPath();
  x.moveTo(cx, cy - 34);
  x.lineTo(cx + 6, cy - 6);
  x.lineTo(cx + 40, cy + 10);
  x.lineTo(cx + 40, cy + 16);
  x.lineTo(cx + 7, cy + 12);
  x.lineTo(cx + 16, cy + 30);
  x.lineTo(cx - 16, cy + 30);
  x.lineTo(cx - 7, cy + 12);
  x.lineTo(cx - 40, cy + 16);
  x.lineTo(cx - 40, cy + 10);
  x.lineTo(cx - 6, cy - 6);
  x.closePath();
  x.fill();
  // 방위 등: 앞 ±10 ±30 ±50 ±90, 뒤 ±135
  const SECT = [-135, -90, -50, -30, -10, 10, 30, 50, 90, 135];
  for (const a of SECT) {
    const hit = th.filter(q => Math.abs(((q.brg - a + 540) % 360) - 180) < (Math.abs(a) > 60 ? 30 : 12));
    const lv = hit.reduce((m, q) => Math.max(m, q.lvl), 0),
      on = lv > 0 && (lv < 3 || blink),
      an = toCan(a),
      rx = 120,
      ry = 92;
    x.fillStyle = on ? (lv >= 3 ? '#ff3b2e' : lv == 2 ? '#ffb02e' : '#ffe36b') : '#2b3233';
    x.beginPath();
    x.arc(cx + Math.cos(an) * rx, cy + Math.sin(an) * ry, 10, 0, Math.PI * 2);
    x.fill();
  }
  // 신호 세기 막대 (가장 가까운 위협)
  const near = th.reduce((m, q) => Math.min(m, q.d), Infinity),
    lev = isFinite(near) ? clamp(Math.round(15 - near / 2000), 1, 15) : 0;
  for (let i = 0; i < 15; i++) {
    x.fillStyle = i < lev ? (i > 10 ? '#ff3b2e' : '#ffd36b') : '#232a2b';
    x.fillRect(12 + i * 19.5, 10, 15, 12);
  }
  // 위협 종류 등: П 전투기 · Н 나이키 · Р 미사일
  [
    ['П', th.some(q => q.type === 'П')],
    ['Н', th.some(q => q.type === 'Н')],
    ['Р', th.some(q => q.type === 'Р')],
  ].forEach(([s, on], i) => {
    x.fillStyle = on ? (s === 'Р' ? '#ff3b2e' : '#ffd36b') : '#2b3233';
    x.fillRect(w - 46, h - 108 + i * 34, 34, 28);
    x.fillStyle = on ? '#111' : '#5a6466';
    x.font = CKF(22, 800);
    x.textAlign = 'center';
    x.fillText(s, w - 29, h - 86 + i * 34);
  });
  SPO.tex.needsUpdate = true;
}
const CRT = '#7dffa0',
  CRT_D = 'rgba(125,255,160,.35)';
function drawIPV() {
  const x = IPV.x,
    w = IPV.w,
    h = IPV.h;
  x.fillStyle = '#031006';
  x.fillRect(0, 0, w, h);
  const bh = h * 0.66,
    bx0 = 34,
    bx1 = w - 14,
    by0 = 22,
    by1 = by0 + bh - 26;
  x.strokeStyle = CRT_D;
  x.lineWidth = 1.5;
  x.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
  for (let i = 1; i < 4; i++) {
    const yy = by0 + ((by1 - by0) * i) / 4;
    x.beginPath();
    x.moveTo(bx0, yy);
    x.lineTo(bx1, yy);
    x.stroke();
  }
  x.font = CKF(15, 700);
  x.fillStyle = CRT;
  x.textAlign = 'left';
  const on = rd && rd.on,
    mode = on ? RM[rd.mode] : null;
  x.fillText(on ? mode.n : 'РЛС ОТКЛ', 6, 16);
  x.textAlign = 'right';
  x.fillText(on ? (rdRange() / 1000).toFixed(0) + ' км' : '', w - 6, 16);
  if (on && p) {
    const az = mode.az,
      rng = rdRange(),
      qi = p.q.clone().invert();
    // 탐색 빔 (좌우로 쓸기)
    const sw = Math.sin(performance.now() / 650) * az,
      sx = bx0 + ((sw + az) / (2 * az)) * (bx1 - bx0);
    x.strokeStyle = 'rgba(125,255,160,.5)';
    x.beginPath();
    x.moveTo(sx, by0);
    x.lineTo(sx, by1);
    x.stroke();
    for (const c of rd.ct) {
      const l = c.pos.clone().sub(p.pos).applyQuaternion(qi),
        a = Math.atan2(l.x, -l.z) / D;
      if (Math.abs(a) > az || c.dr > rng) continue;
      const px = bx0 + ((a + az) / (2 * az)) * (bx1 - bx0),
        py = by1 - (c.dr / rng) * (by1 - by0),
        L = rdLockedC(c);
      x.fillStyle = CRT;
      x.fillRect(px - 7, py - 2, 14, 5);
      if (L) {
        x.strokeStyle = CRT;
        x.lineWidth = 2;
        x.strokeRect(px - 12, py - 10, 24, 20);
        x.textAlign = 'center';
        x.font = CKF(13, 700);
        x.fillText((c.dr / 1000).toFixed(1), px, py - 14);
      }
    }
  }
  // 아래: 보조 컴퓨터 쪽 (O 키로 바꿈)
  x.strokeStyle = CRT_D;
  x.beginPath();
  x.moveTo(6, bh + 2);
  x.lineTo(w - 6, bh + 2);
  x.stroke();
  x.textAlign = 'left';
  x.font = CKF(15, 700);
  const names = ['FLIGHT', 'NAV', 'STATUS', 'MISSION', 'RECORD'];
  x.fillStyle = CRT;
  x.fillText('◆ ' + names[computerPage], 6, bh + 20);
  if (p) {
    const f = p.fwd(),
      hdg = (Math.atan2(f.x, -f.z) / D + 360) % 360;
    const L =
      computerPage === 0
        ? [
            `IAS ${(p.speed * MS2KMH).toFixed(0)} км/ч   H ${p.pos.y.toFixed(0)} м`,
            `КУРС ${hdg.toFixed(0).padStart(3, '0')}   n ${p.g.toFixed(1)}`,
          ]
        : computerPage === 1
          ? [
              missionTarget ? `ППМ ${(p.pos.distanceTo(missionTarget) / 1000).toFixed(1)} км` : 'ППМ —',
              isAirbase()
                ? `АЭР ${(p.pos.length() / 1000).toFixed(1)} км`
                : `АВИАНОСЕЦ ${(p.pos.distanceTo(CV.position) / 1000).toFixed(1)} км`,
            ]
          : computerPage === 2
            ? [
                `ПЛАНЕР ${(p.hp * 100).toFixed(0)}%   ТОПЛ ${p.fuel.toFixed(0)}%`,
                `ШАССИ ${p.gearDown ? 'ВЫП' : 'УБР'}   ЗАКР ${['0', '1', '2'][p.flap]}`,
              ]
            : computerPage === 3
              ? [`${activeMission}`, `СБИТО ${kills}   ВОЛНА ${wv}`]
              : [`ВРЕМЯ ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, `СБИТО ${kills}`];
    x.fillStyle = CRT_D.replace('.35', '.9');
    x.font = CKF(14, 600);
    L.forEach((s, i) => x.fillText(s, 6, bh + 40 + i * 18));
  }
  IPV.tex.needsUpdate = true;
}
function drawPUI() {
  const x = PUI.x,
    w = PUI.w,
    h = PUI.h;
  x.fillStyle = '#0c0f10';
  x.fillRect(0, 0, w, h);
  if (!p) return;
  const lamp = (cx, cy, on, sel, txt) => {
    x.fillStyle = on ? (sel ? '#7dffa0' : '#3d7f52') : '#20292a';
    x.beginPath();
    x.arc(cx, cy, 11, 0, Math.PI * 2);
    x.fill();
    if (txt) {
      x.fillStyle = sel ? '#e8ffe8' : '#7f8c8a';
      x.font = CKF(15, 700);
      x.textAlign = 'center';
      x.fillText(txt, cx, cy + 32);
    }
  };
  // 무장 스테이션: 바깥 Р-73 (IR) · 안쪽 Р-27Р (SARH)
  const st = [
    ['IR', 3],
    ['IR', 1],
    ['SARH', 1],
    ['SARH', 3],
    ['SARH', 4],
    ['SARH', 2],
    ['IR', 2],
    ['IR', 4],
  ];
  st.forEach(([type, n], i) => {
    const cx = 34 + i * 46 + (i >= 4 ? 18 : 0);
    lamp(cx, 34, p.am[type] >= n, p.sel === type, i === 1 ? 'Р-73' : i === 3 ? 'Р-27Р' : null);
  });
  x.fillStyle = '#7dffa0';
  x.font = CKF(26, 800);
  x.textAlign = 'right';
  x.fillText(String(p.gun).padStart(3, '0'), w - 14, 42);
  x.font = CKF(14, 700);
  x.fillStyle = '#7f8c8a';
  x.fillText('ГШ-301', w - 14, 64);
  x.textAlign = 'left';
  x.fillText(`ЛТЦ ${p.fl}  ДО ${p.ch}`, 12, h - 10);
  PUI.tex.needsUpdate = true;
}
function drawGear() {
  const x = GEAR.x,
    w = GEAR.w,
    h = GEAR.h;
  x.fillStyle = '#0c0f10';
  x.fillRect(0, 0, w, h);
  if (!p) return;
  const dn = p.gearDown;
  [
    [w / 2, 26],
    [w * 0.25, 62],
    [w * 0.75, 62],
  ].forEach(([cx, cy]) => {
    x.fillStyle = dn ? '#5fe07a' : '#d23a2c';
    x.beginPath();
    x.arc(cx, cy, 14, 0, Math.PI * 2);
    x.fill();
  });
  x.fillStyle = '#9aa6a4';
  x.font = CKF(15, 700);
  x.textAlign = 'center';
  x.fillText(dn ? 'ВЫПУЩ' : 'УБРАНО', w / 2, h - 8);
  GEAR.tex.needsUpdate = true;
}

// ---------- 경고등 줄 (러시아어 표시, 상황에 따라 켜짐)
const LAMPS = [
  ['ПОЖАР', '#ff3a2e', () => p.hp < 0.35],
  ['РАКЕТА', '#ff3a2e', () => ckThreatsCache.some(q => q.lvl >= 3), true],
  ['ОБЛУЧЕНИЕ', '#ffb02e', () => ckThreatsCache.some(q => q.lvl == 2)],
  ['СРЫВ', '#ff3a2e', () => p.stl, true],
  ['ВЫСОТА', '#ffb02e', () => p.pos.y - (isAirbase() ? terrainHeightAt(p.pos.x, p.pos.z) : 0) < 500 && p.vd.y < -0.1],
  ['ПЕРЕГРУЗ', '#ffb02e', () => p.g > p.prm.g * 0.85],
  ['ТОПЛИВО', '#ffb02e', () => p.fuel < 20],
  ['ФОРСАЖ', '#ffd36b', () => !!p.ab],
  ['ЗАКРЫЛКИ', '#7dffa0', () => p.flap > 0],
  ['ЗАХВАТ', '#7dffa0', () => !!(rd.lock || (sk.on && sk.st === 'LOCKED'))],
];
let ckThreatsCache = [];
const lampMeshes = LAMPS.map(([txt, col], i) => {
  const cv = ckCanvas(256, 96),
    x = cv.x;
  x.fillStyle = '#f4f4ec';
  x.fillRect(0, 0, 256, 96);
  x.fillStyle = '#101010';
  x.font = CKF(txt.length > 7 ? 34 : 40, 800);
  x.textAlign = 'center';
  x.fillText(txt, 128, 62);
  cv.tex.needsUpdate = true;
  const m = ckAdd(
    new T.PlaneGeometry(0.086, 0.032),
    new T.MeshBasicMaterial({ map: cv.tex, color: 0x2e3131 }),
    -0.432 + i * 0.096,
    0.214,
    0.003,
    panel
  );
  m.userData.on = new T.Color(col);
  m.userData.off = new T.Color(0x2e3131);
  return m;
});

// ---------- 조종간 · 스로틀 (입력에 따라 움직인다)
const stick = new T.Group();
stick.position.set(0, -0.6, -0.36);
ck.add(stick);
ckAdd(new T.CylinderGeometry(0.06, 0.07, 0.04, 16), CKM.black, 0, 0, 0, stick);
ckAdd(new T.CylinderGeometry(0.012, 0.016, 0.16, 10), CKM.metal, 0, 0.09, 0, stick);
const grip = ckAdd(new T.CylinderGeometry(0.022, 0.026, 0.11, 12), CKM.black, 0, 0.215, 0.005, stick);
grip.rotation.x = 0.15;
ckAdd(new T.BoxGeometry(0.03, 0.012, 0.03), CKM.red, 0, 0.275, 0.01, stick);
ckAdd(new T.BoxGeometry(0.012, 0.035, 0.012), CKM.metal, 0, 0.2, 0.03, stick);
const thr = new T.Group();
thr.position.set(-0.4, -0.5, -0.36);
ck.add(thr);
for (const s of [-1, 1]) {
  const lev = ckAdd(new T.BoxGeometry(0.03, 0.1, 0.035), CKM.black, s * 0.02, 0.06, 0, thr);
  lev.userData.base = 0.06;
}
ckAdd(new T.BoxGeometry(0.1, 0.04, 0.16), CKM.tealDk, 0, 0, 0, thr);

// ---------- 정적 부분 합치기 (V15.0.0-alpha.3): 콕핏 메시 164개 · 재질 40개 → 매 프레임 그리기 호출이 124번이었다.
// 움직이는 것(바늘 · 자세계 · 방위계 · 조종간 · 스로틀 · 경고등)은 그대로 두고 나머지를 재질별로 합친다.
{
  const moving = new Set([...Object.values(NDL), adiBall, hsiCard, hsiHome, stick, thr, ...lampMeshes]);
  ck.updateMatrixWorld(true);
  mergeStaticInPlace(ck, o => moving.has(o));
}

// ---------- 매 프레임 갱신
const CKS = { rpm1: 0, rpm2: 0, egt1: 350, egt2: 350, screens: 0, hx: 0, hy: 0 };
const _q = new T.Quaternion();
let _ckSeed = 991;
const ckRnd = () => (_ckSeed = (_ckSeed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; // 콕핏 연출 전용 난수
function ckUpdate(dt = 0) {
  // 콕핏 카메라 = 화면 비율만 따른다 (흔들림·FOV 효과는 월드에만)
  if (ckCam.aspect !== cam.aspect) {
    ckCam.aspect = cam.aspect;
    ckCam.updateProjectionMatrix();
  }
  // 조명: 월드 태양·하늘 방향을 콕핏 좌표로
  _q.copy(cam.quaternion).invert();
  ckSun.position.copy(SUN_DIR).applyQuaternion(_q);
  ckHemi.position.set(0, 1, 0).applyQuaternion(_q);
  if (!p) return;
  // 머리 움직임: 양의 G 에 머리가 눌려 내려가고(콕핏이 위로 올라 보임), 진동이 있으면 흔들린다
  const gY = clamp((p.g - 1) * 0.0035, -0.012, 0.028),
    sh = typeof FXS !== 'undefined' ? (FXS.sh || 0) + (FXS.imp || 0) : 0,
    j = Math.min(sh, 1.5) * 0.0018;
  CKS.hy += (-gY - CKS.hy) * Math.min(1, dt * 6);
  CKS.hx += (-clamp(inp.r, -1, 1) * 0.006 - CKS.hx) * Math.min(1, dt * 4);
  ckCam.position.set(CKS.hx + (ckRnd() - 0.5) * j, CKS.hy + (ckRnd() - 0.5) * j, 0);
  const f = p.fwd(),
    up = V(0, 1, 0).applyQuaternion(p.q),
    rt = V(1, 0, 0).applyQuaternion(p.q),
    pitch = Math.asin(clamp(f.y, -1, 1)),
    bank = Math.atan2(-rt.y, up.y),
    hdg = (Math.atan2(f.x, -f.z) / D + 360) % 360,
    agl = Math.max(0, p.pos.y - (isAirbase() ? terrainHeightAt(p.pos.x, p.pos.z) : 0));
  // 엔진 계기는 실제 엔진처럼 늦게 따라온다
  const k1 = 1 - Math.exp(-dt / 0.9),
    k2 = 1 - Math.exp(-dt / 1.1),
    rpmT = 62 + p.thr * 38 + (p.ab ? 3 : 0);
  CKS.rpm1 += (rpmT - CKS.rpm1) * k1;
  CKS.rpm2 += (rpmT - 0.6 - CKS.rpm2) * k2;
  CKS.egt1 += (380 + p.thr * 420 + (p.ab ? 90 : 0) - CKS.egt1) * k1 * 0.7;
  CKS.egt2 += (372 + p.thr * 420 + (p.ab ? 90 : 0) - CKS.egt2) * k2 * 0.7;
  setNeedle(NDL.kus, DIAL.kus(p.speed * MS2KMH));
  setNeedle(NDL.vdiL, DIAL.vdiL(p.pos.y));
  setNeedle(NDL.vdiS, DIAL.vdiS(p.pos.y));
  setNeedle(NDL.uapA, DIAL.uapA(p.aoa / D));
  setNeedle(NDL.uapG, DIAL.uapG(p.g));
  setNeedle(NDL.rv, DIAL.rv(agl));
  setNeedle(NDL.var, DIAL.var(p.vd.y * p.speed));
  setNeedle(NDL.ita1, DIAL.ita(CKS.rpm1));
  setNeedle(NDL.ita2, DIAL.ita(CKS.rpm2));
  setNeedle(NDL.fuel, DIAL.fuel((p.fuel / 100) * 3800));
  setNeedle(NDL.egt1, DIAL.egt(CKS.egt1));
  setNeedle(NDL.egt2, DIAL.egt(CKS.egt2));
  const now = new Date(),
    sec = now.getSeconds() + now.getMilliseconds() / 1000;
  setNeedle(NDL.clkH, ((now.getHours() % 12) + now.getMinutes() / 60) * 30);
  setNeedle(NDL.clkM, (now.getMinutes() + sec / 60) * 6);
  setNeedle(NDL.clkS, sec * 6);
  // КПП 볼: 피치만큼 앞뒤로, 경사만큼 굴린다
  adiBall.rotation.x = pitch;
  adiBall.rotation.z = bank;
  // ПНП: 카드는 기수 방위, 노란 바늘은 귀환 방향 (항모 / 비행장 / 임무 목표)
  hsiCard.rotation.z = (hdg * Math.PI) / 180;
  const home = missionTarget && isAirbase() ? missionTarget : isAirbase() ? V(0, 0, 0) : CV.position,
    hb = (Math.atan2(home.x - p.pos.x, -(home.z - p.pos.z)) / D + 360) % 360;
  hsiHome.rotation.z = (-(hb - hdg) * Math.PI) / 180;
  // 조종간 · 스로틀
  stick.rotation.z = -inp.r * 0.3;
  stick.rotation.x = inp.p * 0.22;
  thr.children.forEach(c => {
    if (c.userData.base !== undefined) c.position.z = 0.05 - p.thr * 0.1 - (p.ab ? 0.02 : 0);
  });
  // 화면형 계기 · 경고등: 초당 10회
  CKS.screens += dt;
  if (CKS.screens >= 0.1 || !SPO.tex.version) {
    CKS.screens = 0;
    ckThreatsCache = ckThreats();
    const blink = ((t * 3) | 0) % 2 === 0;
    drawSPO(blink);
    drawIPV();
    drawPUI();
    drawGear();
    LAMPS.forEach(([, , cond, flash], i) => {
      let on = false;
      try {
        on = !!cond();
      } catch (e) {}
      if (flash && on) on = blink;
      lampMeshes[i].material.color.copy(on ? lampMeshes[i].userData.on : lampMeshes[i].userData.off);
    });
  }
}
