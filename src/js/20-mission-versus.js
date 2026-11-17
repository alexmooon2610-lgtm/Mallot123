// =====================================================================
// 멀티플레이 1대1 대전 (VERSUS) — V15 기틀 1단계. 설계: docs/MULTIPLAYER.md
//  - 자기 기체는 자기 컴퓨터가 계산하고 초당 20번 상태를 보낸다 (NET 's').
//  - 남의 기체는 받은 상태를 100 ms 늦게 보간해 그린다. 끊기면 속도로 250 ms 까지 외삽한다.
//  - 원격 기체는 es 에 들어가는 적(E) 개체지만 e.net 이 붙어 AI 대신 보간으로 움직인다 (36-enemy-ai 의 aiUpdate).
//    e.mock 도 붙여 항모 방공이 쏘지 않게 한다.
//  - 1단계: 비행 동기화만. 무장은 쏠 수 있지만 원격 기체에 맞아도 판정하지 않는다 (mockKill). 무장 동기화는 2단계.
//  - 싱글 플레이 판정 경로는 건드리지 않는다 — 이 파일은 VERSUS 임무일 때만 움직인다.
// =====================================================================
const VS = {
  SEND_HZ: 20, // 상태 전송 빈도
  DELAY: 100, // 보간 지연 (ms)
  EXTRA: 250, // 상태가 끊겼을 때 외삽 최대 (ms)
  ARENA: { x: 0, y: 5000, z: -60000, r: 5000 }, // 항모에서 60 km 떨어진 공역 · 출발 반경 5 km
};
let vs = null; // 판 상태: { sendT, n, remotes: Map(slot → 개체) }

// 자리별 출발점: 공역 중심을 둘러싸고 중심을 바라본다 (1대1 이면 10 km 떨어져 마주 본다)
function vsSpawn(slot) {
  // 0 · 1 은 남북으로 마주 보고, 2 · 3 은 동서로 마주 본다. 같은 높이에서 겹치지 않게 자리마다 60 m 씩 띄운다
  const A = VS.ARENA,
    ang = slot < 2 ? slot * Math.PI : Math.PI / 2 + (slot - 2) * Math.PI,
    pos = V(A.x + Math.sin(ang) * A.r, A.y + slot * 60, A.z + Math.cos(ang) * A.r),
    dir = V(A.x, A.y, A.z).sub(pos).setY(0).normalize();
  return { pos, dir };
}
// 원격 기체 하나 만들기
function vsRemote(slot) {
  const x = mkAc('E');
  x.net = { slot, buf: [], base: Infinity, last: 0 };
  x.mock = 1;
  x.am = { SARH: 0, IR: 0 };
  x.rd = { phase: 'SEARCH', t: 0, lost: 0, relock: 0 };
  x.ai = { hint: 0, goal: V(0, 0, -1), irT: 0, fd: 0, tick: 0 };
  x.mesh = createMiG29({ gearDown: false });
  x.mesh.scale.setScalar(3);
  scene.add(x.mesh);
  hbViz(x);
  es.push(x);
  vs.remotes.set(slot, x);
  return x;
}
function vsDrop(slot) {
  const x = vs && vs.remotes.get(slot);
  if (!x) return;
  scene.remove(x.mesh);
  es = es.filter(e => e !== x);
  rd.ct = rd.ct.filter(c => c.tg !== x);
  if (rd.sel && rd.sel.tg === x) rd.sel = null;
  if (rd.lock && rd.lock.tg === x) rd.lock = null;
  vs.remotes.delete(slot);
}
const r1 = v => Math.round(v * 10) / 10,
  r4 = v => Math.round(v * 1e4) / 1e4;
// 내 상태 보내기
function vsSend() {
  const v = p.vd.clone().multiplyScalar(p.speed);
  NET.send({
    t: 's',
    slot: NET.st.slot,
    n: vs.n++,
    tm: Math.round(performance.now()),
    p: [r1(p.pos.x), r1(p.pos.y), r1(p.pos.z)],
    v: [r1(v.x), r1(v.y), r1(v.z)],
    q: [r4(p.q.x), r4(p.q.y), r4(p.q.z), r4(p.q.w)],
    thr: r4(p.thr),
    ab: p.ab ? 1 : 0,
    gr: p.gearDown ? 1 : 0,
    fp: p.flap,
    hp: r4(p.hp),
  });
}
// 받은 상태 쌓기
function vsRecv(m) {
  if (!vs || activeMission !== 'VERSUS' || m.slot === NET.st.slot) return;
  const x = vs.remotes.get(m.slot) || vsRemote(m.slot),
    N = x.net,
    lt = performance.now();
  // 보낸 쪽 시계 → 내 시계: (받은 시각 − 보낸 시각) 의 최솟값을 기준으로 삼는다 (가장 빨리 온 것 = 지연 최소)
  N.base = Math.min(N.base, lt - m.tm);
  N.last = lt;
  if (N.buf.length && m.n <= N.buf[N.buf.length - 1].n) return; // 늦게 온 옛 상태는 버린다
  N.buf.push({
    n: m.n,
    tm: m.tm,
    p: V(...m.p),
    v: V(...m.v),
    q: new T.Quaternion(...m.q),
    thr: m.thr,
    ab: m.ab,
    gr: m.gr,
    fp: m.fp,
    hp: m.hp,
  });
  if (N.buf.length > 60) N.buf.splice(0, N.buf.length - 60);
}
// 보간: 36-enemy-ai 의 aiUpdate 가 원격 개체에 대해 AI 대신 부른다
const _vh = [V(), V(), V(), V()];
function netRemoteUpdate(dt, x) {
  const N = x.net,
    B = N.buf;
  if (!B.length) return;
  const rt = performance.now() - N.base - VS.DELAY; // 보낸 쪽 시계로 지금 그릴 시각
  let a = B[0],
    b = null;
  for (let i = B.length - 1; i >= 0; i--)
    if (B[i].tm <= rt) {
      a = B[i];
      b = B[i + 1] || null;
      break;
    }
  if (b) {
    // 두 상태 사이: 위치는 에르미트(위치 + 속도), 자세는 구면 보간
    const T0 = (b.tm - a.tm) / 1000,
      u = clamp((rt - a.tm) / (b.tm - a.tm), 0, 1),
      u2 = u * u,
      u3 = u2 * u;
    const [h1, h2, h3, h4] = _vh;
    h1.copy(a.p).multiplyScalar(2 * u3 - 3 * u2 + 1);
    h2.copy(a.v).multiplyScalar((u3 - 2 * u2 + u) * T0);
    h3.copy(b.p).multiplyScalar(-2 * u3 + 3 * u2);
    h4.copy(b.v).multiplyScalar((u3 - u2) * T0);
    x.pos.copy(h1).add(h2).add(h3).add(h4);
    x.q.copy(a.q).slerp(b.q, u);
    const v = a.v.clone().lerp(b.v, u);
    x.speed = v.length();
    if (x.speed > 1e-3) x.vd.copy(v).divideScalar(x.speed);
  } else {
    // 최신 상태보다 앞: 속도로 내다본다 (최대 EXTRA ms)
    const e = clamp(rt - a.tm, 0, VS.EXTRA) / 1000;
    x.pos.copy(a.p).addScaledVector(a.v, e);
    x.q.copy(a.q);
    x.speed = a.v.length();
    if (x.speed > 1e-3) x.vd.copy(a.v).divideScalar(x.speed);
  }
  const s = b || a;
  x.thr = s.thr;
  x.ab = s.ab;
  x.flap = s.fp;
  x.gearDown = !!s.gr;
  x.hp = s.hp;
  // 아주 오래된 상태는 버린다 (지금 그리는 구간 앞의 하나는 남김)
  while (B.length > 2 && B[1].tm < rt - 1000) B.shift();
  x.mesh.position.copy(x.pos);
  x.mesh.quaternion.copy(x.q);
  x.mesh.userData.setAfterburner?.(x.ab);
  x.mesh.userData.setGear?.(x.gearDown);
}
NET.on('msg', m => {
  if (m.t === 's') vsRecv(m);
});
NET.on('left', slot => {
  if (!vs || activeMission !== 'VERSUS') return;
  vsDrop(slot);
  if (S === 'play') msg(`상대(${slot}번 자리)가 나갔다`, '#fa4');
  if (S === 'play' && slot === 0 && NET.st.role !== 'host') end('대전 종료 — 방장과 연결이 끊겼다');
});

MISSIONS.VERSUS = {
  id: 'VERSUS',
  label: 'MP',
  title: 'VERSUS',
  category: 'MULTI',
  net: true, // 임무 목록(missionsOf)에서 빠진다 — 멀티 메뉴로만 들어온다
  env: 'CARRIER',
  weather: 'CLEAR',
  start: 'air',
  waves: false,
  sub: { ko: '1대1 대전 (멀티플레이 알파)', en: '1v1 versus (multiplayer alpha)' },
  intro: '멀티플레이 1대1 대전',
  brief: {
    ko: { sum: '친구와 1대1 공중전.', obj: [], tips: [] },
    en: { sum: '1v1 dogfight with a friend.', obj: [], tips: [] },
  },
  init() {
    missionReset();
    vs = { sendT: 0, n: 0, remotes: new Map() };
    // 공중 출발: 갑판 절차를 건너뛴다
    setSt('fly');
    ops.safe = 0;
    const { pos, dir } = vsSpawn(Math.max(0, NET.st.slot));
    p.pos.copy(pos);
    p.q.setFromRotationMatrix(new T.Matrix4().lookAt(V(), dir, V(0, 1, 0)));
    p.vd.copy(dir);
    p.speed = 235;
    p.thr = 0.8;
    p.ab = 0;
    p.gearDown = false;
    p.mesh?.userData.setGear?.(false);
    p.flap = 0;
    missionPhase = 'fight';
    msg(`VERSUS — 방 ${NET.st.code || '-'} · ${NET.st.slot}번 자리`, '#9cf');
  },
  update(dt) {
    if (!vs) return;
    NET.tick();
    const now = performance.now();
    if (S === 'play' && NET.active && now - vs.sendT >= 1000 / VS.SEND_HZ) {
      vs.sendT = now;
      vsSend();
    }
  },
  // 1단계: 원격 기체는 맞아도 이 컴퓨터에서 격추하지 않는다 (판정은 맞는 쪽 컴퓨터가 — 2단계)
  mockKill(a) {
    if (!a.net) return false;
    if (!a._hitMsg || t - a._hitMsg > 1) {
      a._hitMsg = t;
      msg('명중 — 판정 동기화는 다음 단계에서 (지금은 표시만)', '#ffd36b');
    }
    return true;
  },
  hud() {
    const live = vs ? vs.remotes.size : 0;
    return {
      objective: `VERSUS · 방 ${NET.st.code || '-'} · ${live ? '상대 비행 중' : '상대 신호 기다리는 중'}`,
      hint: `핑 ${Math.round(NET.st.rtt)} ms · 알파: 비행 동기화만 (무장 판정은 다음 단계)`,
      guidance: '',
    };
  },
  isComplete() {
    return false;
  },
  isFailed() {
    return false;
  },
  score() {
    return { score: 0, rank: '-', lines: [] };
  },
  evaluate() {
    return { score: 0, rank: '-', lines: [] };
  },
};
