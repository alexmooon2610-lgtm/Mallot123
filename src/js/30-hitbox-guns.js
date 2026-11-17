// ---------- 충돌 히트박스 (기체별 OBB 3개: 동체/주익/꼬리)
function hbDist(a, pos) {
  const l = pos.clone().sub(a.pos).applyQuaternion(a.q.clone().invert());
  let m = 1e9;
  for (const b of a.hb) {
    m = Math.min(
      m,
      Math.hypot(
        Math.max(Math.abs(l.x - b.c.x) - b.h.x, 0),
        Math.max(Math.abs(l.y - b.c.y) - b.h.y, 0),
        Math.max(Math.abs(l.z - b.c.z) - b.h.z, 0)
      )
    );
  }
  return m;
}
// 히트박스 전체를 감싸는 반경 (빠른 배제용)
function hbRadius(a) {
  if (a.hbR === undefined) a.hbR = Math.max(...a.hb.map(b => b.c.length() + b.h.length()));
  return a.hbR;
}
const _segQ = V();
function segHit(a, p0, p1, r) {
  // 선분과 기체 중심의 최근접 거리로 먼저 배제한다
  if (new T.Line3(p0, p1).closestPointToPoint(a.pos, true, _segQ).distanceTo(a.pos) > hbRadius(a) + r) return false;
  // 이동 구간을 반경 r 이하 간격으로 나눠 검사 → 30fps 이하에서도 관통 없음
  const n = Math.min(32, Math.max(2, Math.ceil(p0.distanceTo(p1) / r)));
  for (let i = 0; i <= n; i++) if (hbDist(a, _segQ.lerpVectors(p0, p1, i / n)) < r) return true;
  return false;
}
function samples(a) {
  const o = [];
  for (const b of a.hb)
    for (const sx of [-1, 0, 1])
      for (const sz of [-1, 0, 1])
        o.push(
          V(b.c.x + sx * b.h.x, b.c.y, b.c.z + sz * b.h.z)
            .applyQuaternion(a.q)
            .add(a.pos)
        );
  return o;
}
function collide() {
  const L = [p, ...es];
  for (let i = 0; i < L.length; i++)
    for (let j = i + 1; j < L.length; j++) {
      const a = L[i],
        b = L[j];
      if (
        a.hp > 0 &&
        b.hp > 0 &&
        a.pos.distanceTo(b.pos) < 90 &&
        (samples(a).some(q => hbDist(b, q) < 1) || samples(b).some(q => hbDist(a, q) < 1))
      ) {
        msg('공중 충돌!', '#f44');
        boom(a.pos.clone().lerp(b.pos, 0.5), 90);
        kill(a);
        kill(b);
        if (S == 'over') return;
      }
    }
}
function hbViz(a) {
  const gp = new T.Group(),
    k = a.mesh.scale.x || 1;
  for (const b of a.hb) {
    const m = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry((b.h.x * 2) / k, (b.h.y * 2) / k, (b.h.z * 2) / k)),
      new T.LineBasicMaterial({ color: 0xff3333, depthTest: false })
    );
    m.position.set(b.c.x / k, b.c.y / k, b.c.z / k);
    gp.add(m);
  }
  gp.visible = !!showHB;
  a.mesh.add(gp);
  a.viz = gp;
}
// ---------- HMD (MiG 전용): 헬멧 조준선 방향으로 IR 시커 지향
function hmdDir() {
  if (!hmd.on) return p.fwd();
  const a = hmd.az * D,
    e2 = hmd.el * D;
  return V(Math.sin(a) * Math.cos(e2), Math.sin(e2), -Math.cos(a) * Math.cos(e2)).applyQuaternion(p.q);
}
// ---------- 기총
function bullet(a, f) {
  const d = f
      .clone()
      .add(V(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(a === p ? 0.008 : 0.02))
      .normalize(),
    m = new T.Mesh(bGeo, bMat[a === p ? 0 : 1]);
  m.position
    .copy(a.pos)
    .addScaledVector(f, 28)
    .add(V(0, -1.5, 0));
  m.quaternion.setFromUnitVectors(V(0, 0, -1), d);
  scene.add(m);
  bl.push({ m, side: a.side, age: 0, v: d.multiplyScalar(1000) });
}
function hurt(a, d) {
  if (a === p && isAirbase()) missionStats.hits++;
  a.hp -= d;
  if (a.hp <= 0) weaponKill(a);
  else if (a === p) {
    tone(200, 0.08, 'square', 0.1);
    if (!p.hm || t - p.hm > 1) {
      p.hm = t;
      msg('피격! HULL ' + ((p.hp * 100) | 0) + '%', '#f44');
    }
  }
}
function updBul(dt) {
  for (const b of bl) {
    b.age += dt;
    const pp = b.m.position.clone();
    b.m.position.addScaledVector(b.v, dt);
    if (b.m.position.y < 0) b.age = 9;
    for (const a of b.side == 'P' ? es : [p]) {
      if (a.hp > 0 && segHit(a, pp, b.m.position, 3)) {
        b.age = 9;
        puff(b.m.position, 0xffaa44, 25, 0.5, 2, 1);
        if (a.drone) a.lastHit = 'GUN';
        hurt(a, a === p ? 0.03 : 0.045);
        break;
      }
    }
  }
  bl = bl.filter(b => {
    if (b.age > 1.6) {
      scene.remove(b.m);
      return false;
    }
    return true;
  });
}
