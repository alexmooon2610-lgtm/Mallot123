// =====================================================================
// 캠페인 TR-1 · 표적 드론 요격 (TARGET DRONES)
//  - 1999-12-18, 항모 「자랴」 훈련 공역. 무장을 쏘지 않는 표적 드론 5기를 단계별로 격추한다.
//    1단계 레이더 유도(R-27R · SARH) 2기 → 2단계 열추적(R-73 · IR) 2기 → 3단계 기총 1기 → 귀함 · 착함
//  - 드론은 적(E) 진영 기체로 es 에 들어가지만 공격·회피·방공 판정에서 빠진다 (e.drone).
//  - 출격 전 무장 구성(LOADOUTS)은 캠페인 임무에만 적용된다. 자유 모드는 늘 표준(4/4).
// =====================================================================
const LOADOUTS = {
  STD: { SARH: 4, IR: 4, ko: '표준', en: 'STANDARD', note: { ko: 'R-27R ×4 · R-73 ×4', en: 'R-27R ×4 · R-73 ×4' } },
  BVR: { SARH: 6, IR: 2, ko: '요격', en: 'INTERCEPT', note: { ko: 'R-27R ×6 · R-73 ×2', en: 'R-27R ×6 · R-73 ×2' } },
  WVR: { SARH: 2, IR: 6, ko: '근접', en: 'DOGFIGHT', note: { ko: 'R-27R ×2 · R-73 ×6', en: 'R-27R ×2 · R-73 ×6' } },
};
let loadoutPick = 'STD';
const loadout = () => (curM().campaign && LOADOUTS[loadoutPick]) || LOADOUTS.STD;

// ---------- 표적 드론: La-17M 실측 GLB (10-model-la17-glb). 못 읽었으면 아래 단순 모델을 쓴다.
function droneMesh() {
  if (la17GLBTemplate) {
    const g = la17GLBTemplate.clone();
    g.userData.prop = g.getObjectByName('prop_pivot');
    // 엔진(RD-9BK) 노즐 열기: 나셀 출구 (y 0.36, z 1.06) 바로 뒤
    const gl = new T.Sprite(
      new T.SpriteMaterial({ map: TX, color: 0xffaa55, blending: T.AdditiveBlending, depthWrite: false })
    );
    gl.scale.set(1.1, 1.1, 1);
    gl.position.set(0, 0.36, 1.25); // 모델(미터) 좌표
    g.children[0].add(gl);
    return g;
  }
  const g = new T.Group(),
    orange = new T.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.55, metalness: 0.15 }),
    white = new T.MeshStandardMaterial({ color: 0xeef1f2, roughness: 0.6, metalness: 0.1 }),
    dark = new T.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.7, metalness: 0.3 }),
    add = (geo, mat, x, y, z, rx = 0) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.x = rx;
      g.add(m);
      return m;
    };
  add(new T.CylinderGeometry(2.6, 2.2, 26, 16), orange, 0, 0, 0, Math.PI / 2);
  add(new T.ConeGeometry(2.6, 7, 16), orange, 0, 0, -16.5, -Math.PI / 2);
  for (const z of [-7, 4]) add(new T.CylinderGeometry(2.66, 2.66, 1.4, 16), white, 0, 0, z, Math.PI / 2);
  add(new T.BoxGeometry(26, 0.5, 5), white, 0, 0.3, 0);
  for (const s of [-1, 1]) add(new T.BoxGeometry(3, 0.55, 5.1), orange, s * 11.6, 0.3, 0);
  add(new T.BoxGeometry(0.45, 5.5, 4), orange, 0, 3.6, 11);
  add(new T.BoxGeometry(10, 0.4, 3), white, 0, 0.6, 12);
  add(new T.CylinderGeometry(1.5, 1.5, 11, 12), dark, 0, -3.6, 5, Math.PI / 2);
  add(
    new T.CylinderGeometry(1.0, 1.0, 0.4, 12),
    new T.MeshBasicMaterial({ color: 0x0b0d0f }),
    0,
    -3.6,
    -0.6,
    Math.PI / 2
  );
  add(new T.BoxGeometry(0.6, 1.8, 6), dark, 0, -2.2, 5);
  return g;
}
// 드론 하나를 만든다. wps: 순서대로 도는 경유점 (y 는 유지할 고도)
function spawnDrone(kind, pos, heading, speed, wps, hp = 1) {
  const x = mkAc('E');
  x.drone = 1;
  x.kind = kind;
  x.hp = hp;
  x.pos.copy(pos);
  x.q.setFromRotationMatrix(new T.Matrix4().lookAt(V(), heading.clone().normalize(), V(0, 1, 0)));
  x.speed = speed;
  x.thr = 0.8;
  x.vd.copy(x.fwd());
  x.am = { SARH: 0, IR: 0 };
  x.gun = 0;
  x.fl = 0;
  x.ch = 0;
  // 히트박스: La-17M ×3 (전장 27 · 전폭 22.4) 보다 조금 넉넉하게 — 동체+나셀 / 주익 / 꼬리
  x.hb = la17GLBTemplate
    ? [
        { c: V(0, -0.7, 0), h: V(2.4, 3.3, 14) },
        { c: V(0, -0.2, 0.75), h: V(11.6, 1.0, 2.2) },
        { c: V(0, 2.4, 9.5), h: V(3.6, 2.8, 3.4) },
      ]
    : [
        { c: V(0, 0, -2), h: V(3.2, 3.2, 17) },
        { c: V(0, 0.3, 0), h: V(13, 1.2, 3) },
        { c: V(0, 2.5, 11.5), h: V(5, 4, 2.5) },
      ];
  x.rd = { phase: 'SEARCH', t: 0, lost: 0, relock: 0 };
  x.ai = { wp: wps, i: 0, spd: speed };
  x.mesh = droneMesh();
  x.mesh.position.copy(x.pos);
  x.mesh.quaternion.copy(x.q);
  scene.add(x.mesh);
  hbViz(x);
  es.push(x);
  return x;
}
// 드론 비행: 경유점을 차례로 돌며 고도를 지킨다. 무장·레이더 락·회피 없음.
function droneUpdate(dt, e) {
  if (e.hp <= 0) return;
  const A = e.ai,
    w = A.wp[A.i];
  if (Math.hypot(w.x - e.pos.x, w.z - e.pos.z) < 1500) A.i = (A.i + 1) % A.wp.length;
  const des = V(w.x - e.pos.x, 0, w.z - e.pos.z);
  if (des.lengthSq() < 1) des.copy(e.fwd()).setY(0);
  des.normalize();
  des.y = clamp((w.y - e.pos.y) / 2500, -0.25, 0.25);
  des.normalize();
  const qT = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(V(), des, V(0, 1, 0))),
    lat = des.clone().applyQuaternion(e.q.clone().invert()).x;
  qT.multiply(new T.Quaternion().setFromAxisAngle(V(0, 0, 1), -clamp(lat * 3, -1, 1) * 0.7));
  e.q.rotateTowards(qT, 0.6 * dt);
  e.thr = clamp(0.55 + (A.spd - e.speed) / 120, 0.3, 1);
  e.ab = 0;
  phys(e, dt);
  if (e.pos.y < 8) kill(e);
  if (e.mesh.userData.prop) e.mesh.userData.prop.rotation.z += dt * 38; // 풍차 프로펠러
  e.mesh.position.copy(e.pos);
  e.mesh.quaternion.copy(e.q);
}

// ---------- TR-1 진행
const TR1_STAGES = {
  R: { n: 2, weapon: 'SARH', phase: 'radar', next: 'I' },
  I: { n: 2, weapon: 'IR', phase: 'ir', next: 'G' },
  G: { n: 1, weapon: 'GUN', phase: 'gun', next: 'return' },
};
const TR1_TOTAL = 5,
  TR1_MIN_MISSILES = 4;
let tr1 = null;
// 플레이어 기준 수평 앞·오른쪽 벡터
function tr1Frame() {
  const f = p.fwd().setY(0);
  if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
  f.normalize();
  return { f, r: V(-f.z, 0, f.x) };
}
function tr1Stage(k) {
  const T1 = tr1;
  T1.stage = k;
  T1.left = 0;
  if (k === 'return') {
    missionPhase = 'return';
    msg('훈련 표적 전부 격추 — 항모로 귀함해 착함하라', '#ffd36b');
    tone(660, 0.14, 'sine', 0.05, 990);
    return;
  }
  const S0 = TR1_STAGES[k],
    { f, r } = tr1Frame(),
    at = (fw, rt, y) => p.pos.clone().addScaledVector(f, fw).addScaledVector(r, rt).setY(y);
  missionPhase = S0.phase;
  if (k === 'R') {
    // 정면 17~19 km, 좌우로 갈라져 시선과 비스듬히 오가는 2기
    for (const [fw, rt, y] of [
      [17000, 3000, 3600],
      [19500, -3000, 4300],
    ]) {
      const c = at(fw, rt, y),
        a = c
          .clone()
          .addScaledVector(f, -5000)
          .addScaledVector(r, 5000 * Math.sign(rt)),
        b = c
          .clone()
          .addScaledVector(f, 5000)
          .addScaledVector(r, -5000 * Math.sign(rt));
      spawnDrone('R', c, a.clone().sub(c), 220, [a, b]);
    }
    msg('1단계 — 전방 18 km 표적 드론 2기. 레이더로 락해 R-27R(SARH)로 격추하라', '#9cf');
  } else if (k === 'I') {
    // 같은 방향으로 느리게 나는 2기를 뒤에서 따라잡는다 (열추적은 뒤쪽이 잘 보인다)
    const y = clamp(p.pos.y, 1800, 6000);
    for (const [fw, rt, dy] of [
      [6500, 700, 0],
      [7600, -800, 250],
    ]) {
      const c = at(fw, rt, y + dy);
      spawnDrone('I', c, f, 190, [c.clone().addScaledVector(f, 30000), c.clone().addScaledVector(f, -6000)]);
    }
    msg('2단계 — 전방 7 km 드론 2기. 뒤에서 접근해 R-73(IR)으로 격추하라', '#9cf');
  } else {
    // 반경 2.5 km 로 천천히 선회하는 저속 드론 1기
    const y = clamp(p.pos.y, 1500, 5000),
      c0 = at(4000, 2500, y),
      wps = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      wps.push(
        c0
          .clone()
          .addScaledVector(r, -Math.cos(a) * 2500)
          .addScaledVector(f, -Math.sin(a) * 2500)
      );
    }
    spawnDrone('G', wps[0].clone(), f, 150, wps.slice(1).concat([wps[0]]), 0.35);
    msg('3단계 — 저속 드론 1기. 1 km 안으로 붙어 기총(G)으로 격추하라', '#9cf');
  }
  T1.left = S0.n;
  tone(520, 0.12, 'sine', 0.05, 780);
}
MISSIONS.TR1 = {
  id: 'TR1',
  label: 'TR-1',
  title: 'TARGET DRONES',
  category: 'TRAINING',
  env: 'CARRIER',
  weather: 'CLEAR',
  requires: null,
  start: 'deck',
  waves: false,
  loadout: true,
  par: [480, 660, 900],
  sub: { ko: '레이더 · 락온 · 미사일 기본', en: 'Radar, lock-on and missile basics' },
  intro: '표적 드론 5기를 지정 무장으로 격추하고 귀함',
  brief: {
    ko: {
      sum: '1999년 12월 18일, 북태평양. 항모 「자랴」 훈련 공역에서 무장 운용을 점검한다. 표적 드론 5기를 단계마다 지정한 무장으로 격추하고 항모에 착함한다. 드론은 반격하지 않는다.',
      obj: [
        'Shift 로 스키점프 발진',
        '1단계 · 레이더 락 → R-27R(SARH)로 드론 2기 격추',
        '2단계 · 뒤에서 접근 → R-73(IR)으로 드론 2기 격추',
        '3단계 · 기총(G)으로 저속 드론 1기 격추',
        '항모로 귀함해 착함',
      ],
      tips: [
        '레이더: T 로 MULTI-TRK → Tab 으로 표적 선택 → Y 로 락 → 1 · Space. R-27R 은 명중할 때까지 락을 유지해야 한다 — 락이 풀리면 2.5초 뒤 유도를 잃는다.',
        '열추적: 2 를 누르면 시커가 자동 탐색한다. R-73 은 쏘고 나면 미사일 시커가 알아서 쫓는다 (락 없이 쏘면 시야 60° 안에서 스스로 표적을 찾는다). 꼬리 쪽에서 쏘면 잘 맞는다.',
        '평가: 지정 무장 격추 50 · 미사일 절약 20 (최소 4발) · 비행 시간 15 · 착함 15.',
        '지정과 다른 무장으로 떨어뜨려도 단계는 넘어가지만 점수가 낮다. 탄이 떨어지면 착함해서 재무장할 수 있다.',
      ],
    },
    en: {
      sum: 'North Pacific, 18 December 1999. A weapons check in the carrier ZARYA training area: shoot down five target drones, each stage with its assigned weapon, then recover aboard. The drones do not shoot back.',
      obj: [
        'Press Shift to launch off the ski jump',
        'Stage 1 · Radar lock → down 2 drones with R-27R (SARH)',
        'Stage 2 · Close from behind → down 2 drones with R-73 (IR)',
        'Stage 3 · Down the slow drone with the gun (G)',
        'Return to the carrier and trap',
      ],
      tips: [
        'Radar: T for MULTI-TRK → Tab to select → Y to lock → 1 · Space. The R-27R needs the lock held until impact — lose it and guidance fails 2.5 s later.',
        'IR: press 2 and the seeker searches on its own. The R-73 is fire-and-forget (fired without a lock it finds a target within 60° by itself). Tail shots work best.',
        'Grading: assigned-weapon kills 50 · missile economy 20 (4 minimum) · time 15 · trap 15.',
        'A kill with another weapon still clears the stage but scores less. Land to rearm if you run dry.',
      ],
    },
  },
  init() {
    missionReset();
    tr1 = { stage: 'deck', left: 0, right: 0, wrong: 0, fired: 0, bolters: 0, bolterOn: false, wait: 0, next: null };
    missionPhase = 'deck';
    msg('TR-1 TARGET DRONES — 발진 준비 후 훈련 공역으로', '#9cf');
  },
  update(dt) {
    if (S !== 'play' || missionComplete || missionFailed || !tr1) return;
    const T1 = tr1;
    for (const m of ms)
      if (m.sh === p && !m.tr1c) {
        m.tr1c = 1;
        T1.fired++;
      }
    const b = ops.bolter > 0;
    if (b && !T1.bolterOn) T1.bolters++;
    T1.bolterOn = b;
    if (T1.stage === 'deck') {
      if (ops.st === 'fly') {
        missionStartTime = t;
        T1.stage = 'wait';
        T1.wait = 6;
        T1.next = 'R';
        missionPhase = 'transit';
        msg('발진 완료 — 훈련 공역으로 상승하라. 표적 드론 곧 투입', '#9cf');
      }
      return;
    }
    if (T1.stage === 'wait') {
      if ((T1.wait -= dt) <= 0) tr1Stage(T1.next);
      return;
    }
    if (T1.stage === 'return' && (ops.st === 'land' || ops.st === 'serve')) {
      missionElapsed = Math.max(0, t - missionStartTime);
      completeMission(this);
    }
  },
  onKill(a) {
    if (!a.drone || !tr1) return;
    const T1 = tr1,
      S0 = TR1_STAGES[a.kind],
      ok = S0 && a.lastHit === S0.weapon;
    if (ok) T1.right++;
    else T1.wrong++;
    const done = T1.right + T1.wrong;
    msg(
      ok ? `드론 격추 (${done}/${TR1_TOTAL})` : `드론 격추 (${done}/${TR1_TOTAL}) — 지정 무장 아님`,
      ok ? '#52ffc0' : '#ffd36b'
    );
    if (T1.stage === a.kind && --T1.left <= 0) {
      T1.stage = 'wait';
      T1.next = S0.next;
      T1.wait = S0.next === 'return' ? 1.5 : 4;
      missionPhase = 'transit';
      if (S0.next !== 'return') msg('단계 완료 — 다음 표적 투입 대기', '#9cf');
    }
  },
  hud() {
    const T1 = tr1 || {};
    const done = (T1.right || 0) + (T1.wrong || 0);
    const obj = {
      deck: 'Shift — 스키점프 발진',
      transit: '훈련 공역으로 — 다음 표적 대기',
      radar: `레이더 표적 ${done}/${TR1_TOTAL} — R-27R(SARH)로 격추`,
      ir: `열추적 표적 ${done}/${TR1_TOTAL} — R-73(IR)으로 격추`,
      gun: `저속 표적 ${done}/${TR1_TOTAL} — 기총으로 격추`,
      return: '항모로 귀함 — 착함하라',
      complete: '임무 완료',
      failed: '임무 실패',
    }[missionPhase];
    const hint = {
      radar: 'T 레이더 모드 → Tab 표적 선택 → Y 락 → 1 SARH → Space',
      ir: '2 IR 선택(시커 자동 탐색) → 드론 뒤 30° 안 → 시커 톤 → Space',
      gun: 'G 기총 — 1 km 안으로 붙어 드론을 조준선에',
      return: '항모 후방 정렬 · 590 km/h 미만 · 완만한 강하 · 기어·플랩은 자동 보조',
    }[missionPhase];
    return { objective: obj || '임무 진행', hint: hint || '', guidance: '' };
  },
  isComplete() {
    return !!missionComplete;
  },
  isFailed() {
    return !!missionFailed;
  },
  score() {
    return { ...this.evaluate(), stats: { ...missionStats } };
  },
  evaluate() {
    const T1 = tr1 || { right: 0, wrong: 0, fired: 0, bolters: 0 },
      el = missionElapsed,
      wpn = T1.right * 10 + T1.wrong * 4,
      extra = Math.max(0, T1.fired - TR1_MIN_MISSILES),
      eff = Math.max(0, 20 - extra * 5),
      ts = el <= this.par[0] ? 15 : el <= this.par[1] ? 10 : el <= this.par[2] ? 6 : 3,
      land = Math.max(5, 15 - T1.bolters * 5),
      score = Math.round(wpn + eff + ts + land);
    return {
      score,
      rank: rankOf(score),
      lines: [
        ['지정 무장 격추', `${T1.right}/${TR1_TOTAL}  (${wpn}/50)`],
        ['다른 무장 격추', `${T1.wrong}`],
        ['미사일 사용', `${T1.fired}발 · 최소 ${TR1_MIN_MISSILES}발  (${eff}/20)`],
        ['비행 시간', `${fmtTime(el)}  (목표 ${fmtTime(this.par[0])} · ${ts}/15)`],
        ['볼터', `${T1.bolters}회  (${land}/15)`],
        ['점수', score],
      ],
    };
  },
};
