// ===== 비행 화면 효과 (설정의 비행 효과 단계 OFF/LIGHT/FULL) =====
const G_LOC_START = 7; // 이 G 를 넘겨 버텨야 시야가 좁아지기 시작한다
const FXS = {
  q: 2,
  sh: 0,
  imp: 0,
  fov: 0,
  gv: 0,
  rd: 0,
  gs: 0, // G 스트레스 (지속된 양의 G 누적) — 블랙아웃
  bo: 0,
  cl: 0,
  fl: 0,
  ab0: 0,
  pf: 0,
  pg: true,
  t0: performance.now(),
  a: 0,
  b: 0,
  c: 0,
  wind: null,
};
try {
  const s = localStorage.getItem('stFx');
  if (s !== null) FXS.q = +s;
} catch (e) {}
// 화면 효과 층. 효과마다 요소를 따로 두고 매 프레임 불투명도(와 터널 시야의 배율)만 바꾼다.
// 전에는 한 요소에 그라데이션 5겹을 CSS 변수로 칠해서, 값이 바뀔 때마다 전체 화면을 다시 래스터했다
// (폰에서는 구름 속 화이트아웃이 켜지는 순간 GPU 메모리가 치솟아 탭이 죽었다).
// 그라데이션은 96×96 캔버스에 한 번만 그려 두고 GPU 가 늘려 붙인다. 단색 층은 텍스처가 없다.
const fxOv = document.createElement('div'),
  fxC = document.createElement('canvas');
fxOv.id = 'st-fxov';
fxC.id = 'st-fxc';
fxC.style.cssText = 'position:fixed;left:0;top:0';
R.domElement.after(fxOv, fxC);
const fxg = fxC.getContext('2d');
const fxLayer = (id, paint) => {
  const el = paint ? document.createElement('canvas') : document.createElement('div');
  el.className = 'fx-layer ' + id;
  if (paint) {
    el.width = el.height = 96;
    paint(el.getContext('2d'));
  }
  el.style.opacity = '0';
  fxOv.appendChild(el);
  return el;
};
const radial =
  (stops, cx = 48, cy = 48, r = 68) =>
  g => {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    for (const [o, c] of stops) gr.addColorStop(o, c);
    g.fillStyle = gr;
    g.fillRect(0, 0, 96, 96);
  };
const FXL = {
  wh: fxLayer('fx-wh'), // 구름 속 화이트아웃 (단색)
  rd: fxLayer(
    'fx-rd',
    radial([
      [0.4, 'rgba(200,0,0,0)'],
      [1, 'rgba(200,0,0,0.75)'],
    ])
  ),
  gr: fxLayer('fx-gr'), // 그레이아웃 (단색 회색 덧칠 — backdrop-filter 는 매 프레임 화면을 되읽어 너무 비싸다)
  gv: fxLayer(
    'fx-gv',
    radial([
      [0.18, 'rgba(0,0,0,0)'],
      [0.62, 'rgba(0,0,0,0.8)'],
      [1, 'rgba(0,0,0,0.97)'],
    ])
  ), // 터널 시야: 배율을 줄여 구멍을 좁힌다
  bo: fxLayer('fx-bo'), // 블랙아웃 (단색)
  fl: fxLayer(
    'fx-fl',
    radial(
      [
        [0, 'rgba(255,150,40,0.55)'],
        [1, 'rgba(255,150,40,0)'],
      ],
      48,
      100,
      60
    )
  ), // 점화 섬광 (아래쪽)
};
const fxSet = (el, op, tf) => {
  op = op < 0.004 ? '0' : op.toFixed(3);
  if (el.style.opacity !== op) el.style.opacity = op;
  if (tf !== undefined && el.style.transform !== tf) el.style.transform = tf;
};
function fxGlow(pos, col, size, life) {
  const s = getSprite(col, true);
  s.material.opacity = 0.85;
  s.position.copy(pos);
  s.scale.setScalar(size);
  fx.push({ s, t: 0, life, size, grow: -0.6 });
}
function fxClear() {
  fxg.clearRect(0, 0, fxC.width, fxC.height);
  for (const k in FXL) fxSet(FXL[k], 0);
  hud.style.opacity = '';
  FXS.gs = FXS.bo = 0;
  if (FXS.wind) FXS.wind.g.gain.value = 0;
}
function fxWind(k) {
  if (!AC) return;
  if (!FXS.wind) {
    const n = AC.sampleRate * 2,
      b = AC.createBuffer(1, n, AC.sampleRate),
      d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
    const s = AC.createBufferSource(),
      f = AC.createBiquadFilter(),
      g = AC.createGain();
    s.buffer = b;
    s.loop = true;
    f.type = 'bandpass';
    f.Q.value = 0.6;
    g.gain.value = 0;
    s.connect(f);
    f.connect(g);
    g.connect(ACOUT || AC.destination);
    s.start();
    FXS.wind = { f, g };
  }
  FXS.wind.g.gain.value = k * 0.09;
  FXS.wind.f.frequency.value = 350 + k * 2200;
}
function flightFx() {
  const now = performance.now(),
    dt = Math.min(0.05, (now - FXS.t0) / 1000);
  FXS.t0 = now;
  if (!p || p.hp <= 0 || FXS.q === 0 || dt <= 0) {
    fxClear();
    return;
  }
  const Q = FXS.q,
    pr = p.prm,
    v = clamp((p.speed - pr.stall) / (pr.maxV * 1.1 - pr.stall), 0, 1.4),
    g0 = p.g,
    aoa = p.aoa,
    ext = cameraMode === 'external',
    sm = (c, t, r) => c + (t - c) * Math.min(1, r * dt);
  if (fxC.width !== innerWidth || fxC.height !== innerHeight) {
    fxC.width = innerWidth;
    fxC.height = innerHeight;
  }
  // 구름 통과 (타원체 근사)
  let cl = 0;
  for (const c of clouds) {
    const x = (p.pos.x - c.position.x) / (c.scale.x * 0.5),
      y = (p.pos.y - c.position.y) / (c.scale.y * 0.5),
      z = (p.pos.z - c.position.z) / (c.scale.x * 0.25),
      d = x * x + y * y + z * z;
    if (d < 1) cl = Math.max(cl, 1 - d);
  }
  cl = Math.max(cl, cloudLayer.density(p.pos) * 0.5); // 구름층 속
  FXS.cl = sm(FXS.cl, Math.min(1, cl * 2.2), 4);
  // 충격(임팩트): 애프터버너 점화 / 플랩 / 착륙장치
  if (p.ab && !FXS.ab0) {
    FXS.imp += 0.9;
    FXS.fl = 1;
    tone(70, 0.5, 'sawtooth', 0.08, 35);
  }
  FXS.ab0 = p.ab;
  if (p.flap !== FXS.pf) {
    FXS.imp += 0.35;
    FXS.pf = p.flap;
  }
  if (!!p.gearDown !== FXS.pg) {
    FXS.imp += 0.5;
    FXS.pg = !!p.gearDown;
  }
  // 진동
  let sh = v * 0.05 + p.thr * 0.04 + p.ab * 0.12 + FXS.cl * 0.25;
  if (p.stl) sh += 0.5;
  if (aoa > 0.3) sh += (aoa - 0.3) * 2.2;
  if (g0 > 6) sh += (g0 - 6) * 0.12;
  if (K.g && p.gun > 0) sh += 0.18;
  if (p.ovs) sh += 0.5;
  FXS.sh = sm(FXS.sh, sh, 6);
  FXS.imp *= Math.exp(-5 * dt);
  FXS.fl *= Math.exp(-3 * dt);
  const a = (FXS.sh + FXS.imp) * (Q === 1 ? 0.6 : 1) * (ext ? 0.5 : 1);
  cam.position.add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.7 * a));
  cam.rotateZ((rnd() - 0.5) * 0.012 * a);
  cam.rotateX((rnd() - 0.5) * 0.008 * a);
  FXS.fov = sm(FXS.fov, (p.ab ? 5 : 0) + v * 5 + Math.max(0, g0 - 4) * 0.6, 3);
  cam.fov += FXS.fov;
  cam.updateProjectionMatrix();
  // G 시야 / 구름 / 점화 섬광
  // G-LOC: 양의 G 를 버틸수록 스트레스가 쌓여 터널 시야 → 회색 시야(그레이아웃) → 블랙아웃 순으로 간다.
  // 예전에는 순간 G 만 봐서 8G 에서도 가장자리만 조금 어두워졌다. 화면 효과만 바꾸고 조종은 그대로다.
  // 중간 판정: 짧게 확 당기는 건 터널 시야로 끝나고, 9G 언저리로 5초쯤 끌면 블랙아웃.
  // 7G 아래로 풀면 1~2초 안에 돌아온다.
  if (g0 > G_LOC_START) FXS.gs = Math.min(1.25, FXS.gs + (g0 - G_LOC_START) * 0.13 * dt);
  else FXS.gs = Math.max(0, FXS.gs - (0.5 + (G_LOC_START - Math.max(g0, 1)) * 0.1) * dt);
  const bo0 = FXS.bo;
  FXS.bo = sm(FXS.bo, clamp((FXS.gs - 0.8) / 0.35, 0, 1), 3);
  if (FXS.bo > 0.6 && bo0 <= 0.6) msg('블랙아웃 — G 를 풀어라', '#f66');
  FXS.gv = sm(
    FXS.gv,
    clamp(Math.max(((g0 - G_LOC_START) / 2.5) * 0.4, FXS.gs * 0.85), 0, 1),
    g0 > G_LOC_START ? 1.5 : 4
  );
  FXS.rd = sm(FXS.rd, clamp(-g0 / 2, 0, 1), 4);
  const grey = clamp((FXS.gs - 0.25) * 1.3, 0, 1) * 0.85;
  // 터널 시야: 예전 그라데이션은 투명 구간이 80% → 20% 로 좁아졌다. 배율 1.9 → 1.0 으로 같은 느낌을 낸다.
  fxSet(FXL.gv, FXS.gv, `scale(${(1.9 - 0.9 * FXS.gv).toFixed(3)})`);
  fxSet(FXL.bo, FXS.bo * 0.97);
  hud.style.opacity = FXS.bo > 0.01 ? (1 - FXS.bo * 0.92).toFixed(3) : ''; // 블랙아웃 땐 HUD 도 안 보인다
  fxSet(FXL.gr, grey * 0.55);
  fxSet(FXL.rd, FXS.rd);
  fxSet(FXL.wh, FXS.cl * 0.8 * 0.85);
  fxSet(FXL.fl, FXS.fl);
  // 속도선
  const w = fxC.width,
    h = fxC.height,
    k = clamp((v - 0.45) / 0.55, 0, 1) * 0.75 + p.ab * 0.25;
  fxg.clearRect(0, 0, w, h);
  if (k > 0.05 && !ext) {
    const n = ((Q === 1 ? 0.5 : 1) * (10 + k * 34)) | 0,
      R0 = Math.hypot(w, h) / 2;
    fxg.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const an = rnd() * 6.283,
        r = R0 * (0.3 + 0.7 * rnd()),
        l = r * (0.05 + 0.22 * k),
        c = Math.cos(an),
        s = Math.sin(an);
      fxg.strokeStyle = `rgba(225,240,255,${(0.04 + 0.2 * k * rnd()).toFixed(3)})`;
      fxg.lineWidth = 1 + rnd() * 1.6;
      fxg.beginPath();
      fxg.moveTo(w / 2 + c * r, h / 2 + s * r);
      fxg.lineTo(w / 2 + c * (r + l), h / 2 + s * (r + l));
      fxg.stroke();
    }
  }
  // 월드 이펙트 (익단 베이퍼 · 항적 · 불꽃 · 물보라)
  if (Q === 2) {
    const f = p.fwd(),
      rt = V(1, 0, 0).applyQuaternion(p.q);
    FXS.a -= dt;
    FXS.b -= dt;
    FXS.c -= dt;
    if (FXS.a <= 0 && (g0 > 5 || aoa > 0.33)) {
      FXS.a = 0.03;
      for (const sd of [-1, 1])
        vaporPush(
          sd,
          p.pos
            .clone()
            .addScaledVector(rt, sd * 15)
            .addScaledVector(f, -4)
        ); // 38-trails-fx: 날개 끝 베이퍼 리본 (m 은 예전 퍼프 크기용)
    }
    if (FXS.b <= 0 && p.thr > 0.3) {
      FXS.b = p.ab ? 0.04 : 0.07;
      for (const sd of [-1, 1]) {
        const e = p.pos
          .clone()
          .addScaledVector(rt, sd * 3.2)
          .addScaledVector(f, -14);
        if (p.ab) {
          fxGlow(e, 0xff9a3c, 10, 0.28);
          fxGlow(e, 0x66aaff, 5, 0.18);
        }
        if (p.pos.y > 8000) puff(e, 0xffffff, 7, 4.5, 0.9);
      }
    }
    if (FXS.c <= 0 && p.pos.y < 90 && p.speed > 80 && !isAirbase()) {
      FXS.c = 0.05;
      const sp = clamp(1 - p.pos.y / 90, 0.2, 1);
      puff(V(p.pos.x + (rnd() - 0.5) * 30, 1, p.pos.z + (rnd() - 0.5) * 30), 0xcfe8ff, 6 + 16 * sp, 1.3, 1.6);
    }
  }
  fxWind(clamp(v * 0.6 + aoa * 1.2 + FXS.cl * 0.3, 0, 1.2));
}
setInterval(() => {
  if (S !== 'play') fxClear();
}, 300);
