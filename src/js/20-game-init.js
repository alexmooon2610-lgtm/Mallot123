// ---------- 기체 생성 · 게임 초기화(init) · 적 편대 생성(spawnWave)
const mkAc = s => ({
  side: s,
  prm: s == 'P' ? P.mig : P.f16,
  pos: V(),
  q: new T.Quaternion(),
  speed: 200,
  thr: 0.7,
  ab: 0,
  flap: 0,
  hp: 1,
  fuel: 100,
  fuelWarn: 0,
  am: { SARH: s == 'P' ? 4 : 2, IR: s == 'P' ? 4 : 2 },
  gun: (s == 'P' ? P.mig : P.f16).gun,
  gc: 0,
  vd: V(0, 0, -1),
  g: 1,
  aoa: 0,
  hb:
    s == 'P'
      ? [
          { c: V(0, 0, 0), h: V(4, 3.3, 27.5) },
          { c: V(0, -0.4, 1.5), h: V(14, 1.5, 10) },
          { c: V(0, 3, 18), h: V(8.3, 4, 5.5) },
        ]
      : [
          { c: V(0, 0, -7.5), h: V(3.8, 3.8, 24) },
          { c: V(0, 0, -3), h: V(15, 1.8, 8) },
          { c: V(0, 6, 8.4), h: V(1, 5, 5.7) },
        ],
  fl: s == 'P' ? 30 : 20,
  ch: s == 'P' ? 30 : 20,
  cd: 0,
  chT: 0,
  cm: { IR: { n: 0, last: -99 }, SARH: { n: 0, last: -99 } },
  fwd() {
    return V(0, 0, -1).applyQuaternion(this.q);
  },
});
function clearInput() {
  K = {};
  if (heldKeys) heldKeys.clear();
}
// 고유 geometry/material 을 가진 오브젝트를 장면에서 빼고 GPU 자원을 해제한다
function disposeObject(root) {
  if (!root) return;
  root.parent?.remove(root);
  root.traverse(o => {
    o.geometry?.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
  });
}
function clearMissionMarker() {
  disposeObject(missionMarker);
  missionMarker = null;
}
function disposePlayerModel(root) {
  if (!root) return;
  scene.remove(root);
  root.traverse(node => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) {
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach(material => {
        if (material.map) material.map.dispose();
        material.dispose();
      });
    }
  });
}
function init() {
  resetGroundThreats();
  if (p?.mesh) disposePlayerModel(p.mesh);
  clearMissionMarker();
  ms.forEach(m => scene.remove(m.mesh));
  fl.forEach(f => {
    freeSprite(f.s);
    flareFree(f);
  });
  fx.forEach(f => freeSprite(f.s));
  es.forEach(x => scene.remove(x.mesh));
  bl.forEach(b => b.m && scene.remove(b.m));
  cvTracers.forEach(q => {
    scene.remove(q.line);
    q.line.geometry?.dispose();
    q.line.material?.dispose();
  });
  cvTracers = [];
  cvGunCd = 0;
  cvSamCd = 0;
  es = [];
  bl = [];
  hmd.on = 0;
  hmd.az = hmd.el = 0;
  wv = 0;
  wt = 0;
  kills = 0;
  ms = [];
  fl = [];
  fx = [];
  logs = [];
  t = 0;
  clearInput();
  cmHud = { type: '', until: 0, text: '' };
  showHB = 0;
  over = '';
  CVO.th = Math.PI / 2;
  p = mkAc('P');
  p.pos.set(0, 3000, 0);
  p.speed = 210;
  p.sel = 'SARH';
  p.chTk = 0;
  cameraMode = 'cockpit';
  p.gearDown = true;
  p.mesh = createMiG29({ gearDown: true });
  p.mesh.scale.setScalar(3);
  scene.add(p.mesh);
  if (curM().loadout) {
    // 캠페인 출격 전 무장 구성 (자유 모드는 mkAc 기본값 4/4 그대로)
    p.am.SARH = loadout().SARH;
    p.am.IR = loadout().IR;
  }
  CV.visible = !isAirbase();
  AIRBASE.visible = isAirbase();
  sea.visible = !isAirbase();
  // 날씨 훅: Phase 7 에서 curM().weather 에 따라 배경/안개/구름/비를 바꾼다. 현재는 모든 임무 CLEAR.
  scene.background.set(isAirbase() ? 0xb5d2e8 : 0x78aee6);
  scene.fog.color.set(isAirbase() ? 0xb5d2e8 : 0x9cc4ea);
  scene.fog.near = isAirbase() ? 14000 : 9000;
  scene.fog.far = isAirbase() ? 56000 : 70000;
  clouds.forEach(c => {
    c.visible = true;
  });
  cloudLayer.setWeather(curM().weather);
  chaseCamera.initialized = false;
  if (isAirbase()) {
    airbaseInit();
  } else {
    if (curM().waves !== false) spawnWave();
    opsInit();
  }
  curM().init();
  if (isAirbase() && curM().start === 'air') missionBeginWaypoint();

  rd = { on: 1, mode: 0, ct: [], sel: null, lock: null, ph: 0, sweep: 0, q: { st: '', t: 0, c: null, w: 0 } };
  sk = { on: 0, st: 'OFF', tg: null, t: 0, nx: 0 };
  rw = { lvl: 0, brg: 0, hold: 0, nx: 0, alt: 0 };
  inp = { p: 0, r: 0, y: 0 };
  msg('레이더 SEARCH 작동 중 — T:MULTI-TRK → Tab → Y 로 락', '#9cf');
}
const msg = (s, c = G) => {
  logs.unshift({ t, s, c });
  if (logs.length > 5) logs.pop();
};
function spawnWave() {
  wv++;
  const n = Math.min(wv, 5);
  let made = 0;
  for (let i = 0; i < n; i++) {
    let pos = null;
    for (let tries = 0; tries < 40; tries++) {
      const a = rnd() * 6.28,
        d = 18000 + rnd() * 7000,
        q = V(p.pos.x + Math.sin(a) * d, 2000 + rnd() * 3500, p.pos.z - Math.cos(a) * d);
      if (q.distanceTo(CV.position) > CARRIER_SPAWN_CLEAR) {
        pos = q;
        break;
      }
    }
    if (!pos) {
      const a = rnd() * 6.28;
      pos = V(
        CV.position.x + Math.sin(a) * (CARRIER_SPAWN_CLEAR + 5000),
        2500 + rnd() * 3000,
        CV.position.z + Math.cos(a) * (CARRIER_SPAWN_CLEAR + 5000)
      );
    }
    const x = mkAc('E');
    x.pos.copy(pos);
    x.q.setFromEuler(new T.Euler(0, rnd() * 6.28, 0));
    x.speed = 240;
    x.vd.copy(x.fwd());
    x.rd = { phase: 'SEARCH', t: 0, lost: 0, relock: 0 };
    x.ai = {
      hint: 2 + rnd() * 4,
      goal: x.fwd(),
      irT: 0,
      fd: 0,
      tick: 0,
      cvIgnore: 0,
      cvDecision: 0,
      cvEvade: 0,
      cvMissileResponseTimer: 0,
      cvMissileResponseChosen: 0,
    };
    x.mesh = f16Mesh();
    scene.add(x.mesh);
    hbViz(x);
    es.push(x);
    made++;
  }
  msg(`WAVE ${wv} — F-16 x${made}`, '#ff4');
  tone(700, 0.3, 'sawtooth', 0.06, 1000);
}
const CARRIER_SPAWN_CLEAR = 21000;
