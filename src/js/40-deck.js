// ---------- 항모 운용: 발진 준비 → 스키점프 발진 → 착함 → 승조원 보급 (단계: prep→deck→run→fly→land→serve→deck)
const DECK_Y = CV_DECK_Y; // 실측 모델 비행갑판 높이 16.56 (13-carrier-glb)
const SHIP_V = 15;
const EYE = -MIG29_GLB_Y; // 로컬 단위. MiG 바퀴 바닥이 갑판에 닿는 높이 (모델 원점에서 바퀴까지 1.09)
// 갑판 신호수는 기수 정면 중앙이 아니라 기수 왼쪽 앞에 배치한다.
// 로컬 좌표이므로 항모 그룹의 스케일/방향이 함께 적용된다.
const SIGNALMAN_OFFSET = [-3, -9];
const CREW_OFFSETS = [SIGNALMAN_OFFSET, [-6, 1], [6, 1], [-5, 6], [3, -3], [5, 9]];
const rampY = cvRampY; // 실측 스키점프 단면 (13-carrier-glb)
const rampPitch = cvRampPitch;
const SKI_EXIT_PITCH = Math.atan(60 / 240); // 이륙 순간 기수각은 예전 그대로 (약 14°) — 이륙 성능 유지

const ops = {
  st: 'prep',
  t: 0,
  ev: {},
  loc: V(0, DECK_Y + EYE, -30),
  v: 0,
  v0: 0,
  pitch: 0,
  safe: 0,
  hose: 0,
};

const cgeo = {
  b: new T.BoxGeometry(0.5, 0.9, 0.3),
  h: new T.BoxGeometry(0.28, 0.28, 0.28),
  a: new T.BoxGeometry(0.14, 0.7, 0.14),
  l: new T.BoxGeometry(0.4, 0.7, 0.25),
};
const pant = new T.MeshLambertMaterial({ color: 0x2b2f36 });

function mkCrew(color) {
  const crew = new T.Group();
  const uniform = new T.MeshLambertMaterial({ color });
  const addPart = (geometry, material, y) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.y = y;
    crew.add(mesh);
  };

  addPart(cgeo.l, pant, 0.35);
  addPart(cgeo.b, uniform, 1.15);
  addPart(cgeo.h, uniform, 1.74);
  crew.userData.arms = [-1, 1].map(side => {
    const arm = new T.Group();
    const mesh = new T.Mesh(cgeo.a, uniform);
    arm.position.set(side * 0.32, 1.5, 0);
    mesh.position.y = -0.3;
    arm.add(mesh);
    crew.add(arm);
    return arm;
  });
  return crew;
}

// 노란색 신호수, 빨간색 무장요원 2명, 급유·정비·안전 요원
const CREW_COLORS = [0xe8c020, 0xc02a2a, 0xc02a2a, 0x7a3fb0, 0x2a5ac0, 0x2fa04a];
ops.crew = CREW_COLORS.map(color => {
  const crew = mkCrew(color);
  crew.visible = false;
  CV.add(crew);
  return crew;
});

ops.hoseM = new T.Mesh(new T.CylinderGeometry(0.08, 0.08, 1, 6), new T.MeshLambertMaterial({ color: 0x222222 }));
ops.hoseM.visible = false;
CV.add(ops.hoseM);

const once = (key, time, callback) => {
  if (ops.t >= time && !ops.ev[key]) {
    ops.ev[key] = 1;
    callback();
  }
};

function setSt(state) {
  ops.st = state;
  ops.t = 0;
  ops.ev = {};
}

function opsPlace() {
  const orientation = CV.quaternion.clone();
  if (ops.pitch) {
    orientation.multiply(new T.Quaternion().setFromEuler(new T.Euler(ops.pitch, 0, 0)));
  }
  p.q.copy(orientation);
  p.pos.copy(ops.loc).applyMatrix4(CV.matrixWorld);
  p.vd.copy(p.fwd());
}

function opsInit() {
  setSt('prep');
  ops.loc.set(0, DECK_Y + EYE, -30);
  ops.v = 0;
  ops.pitch = 0;
  ops.safe = 0;
  ops.hose = 0;
  ops.bolter = 0; // 재출격 시 이전 판의 볼터 타이머가 남지 않게
  ops.crew.forEach(crew => crew.position.set(11, DECK_Y, -14));
  cvPlace();
  p.flap = 0;
  p.gearDown = true;
  if (p.mesh?.userData.setGear) p.mesh.userData.setGear(true);
  p.thr = 0;
  p.ab = 0;
  p.speed = SHIP_V;
  opsPlace();
  msg('항모 갑판 — 발진 준비 시작', '#9cf');
}
