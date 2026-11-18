// ---------- 적군 F-16 AI (자체 센서 상태 준수)
function aiUpdate(dt, e) {
  if (e.net) return netRemoteUpdate(dt, e); // 멀티플레이 원격 기체: AI 대신 받은 상태를 보간 (20-mission-versus)
  if (e.drone) return droneUpdate(dt, e); // 캠페인 표적 드론 (20-mission-tr1)
  if (e.hp <= 0) return;
  const A = e.ai,
    r0 = e.rd,
    d = p.pos.clone().sub(e.pos),
    r = d.length();
  if (!Number.isFinite(r) || r < 1) return;
  d.divideScalar(r);
  const f = e.fwd(),
    ang = Math.acos(clamp(f.dot(d), -1, 1)) / D,
    sees = p.hp > 0 && ang < 55 && r < 17000;
  if (r0.relock > 0) r0.relock -= dt;
  if (r0.phase == 'SEARCH') {
    r0.t = sees ? r0.t + dt : Math.max(0, r0.t - dt);
    if (r0.t > 1.6) {
      r0.phase = 'TRACK';
      r0.t = 0;
    }
  } else if (r0.phase == 'TRACK') {
    r0.lost = sees ? 0 : r0.lost + dt;
    if (r0.lost > 2) {
      r0.phase = 'SEARCH';
      r0.t = 0;
    } else if (sees && r < 13000 && r0.relock <= 0) {
      if ((r0.t += dt) > 1.4) {
        r0.phase = 'LOCK';
        r0.t = 0;
      }
    } else r0.t = 0;
  } else {
    const ok = p.hp > 0 && ang < 65 && r < 15000;
    r0.lost = ok ? 0 : r0.lost + dt;
    if (r0.lost > 1) {
      r0.phase = 'TRACK';
      r0.t = 0;
      r0.lost = 0;
    }
    if (p.chT > 0 && (A.tick += dt) > 0.25) {
      A.tick = 0;
      if (rnd() < 0.3) {
        r0.phase = 'TRACK';
        r0.relock = 2.5;
        r0.t = 0;
      }
    }
  }
  const known = r0.phase != 'SEARCH';
  let des = f.clone(),
    spd = 240;
  A.fd -= dt;
  let cvEvading = false,
    cvSamEvading = false;
  // 항모 방공권(carrierDefenseUpdate 가 정한 cvThreat) 안에서만 이탈을 고민한다.
  // 예전에는 r(플레이어와의 거리) < 9.5 km 로 판정해, 근접전 중인 적기가 55% 확률로 항모 반대쪽으로 도망갔다.
  if (A.cvThreat) {
    if (A.cvDecision <= 0) {
      A.cvDecision = 4 + rnd() * 2.5;
      A.cvEvade = rnd() < 0.55 ? 1 : 0;
    }
    A.cvDecision -= dt;
    if (A.cvEvade) {
      const away = e.pos.clone().sub(CV.position).normalize();
      des = away.add(V(0, 0.35, 0)).normalize();
      spd = 330;
      cvEvading = true;
    }
  } else {
    A.cvDecision = 0;
    A.cvEvade = 0;
  }
  if (A.cvMissileResponseTimer > 0) {
    A.cvMissileResponseTimer -= dt;
    if (A.cvMissileResponseChosen) {
      const incoming = cvTracers.find(q => q.sam && q.target === e);
      if (incoming) {
        const away = e.pos.clone().sub(incoming.line.position).normalize();
        const side = V()
          .crossVectors(incoming.dir, V(0, 1, 0))
          .normalize()
          .multiplyScalar(e.pos.x >= 0 ? 1 : -1);
        des = away.addScaledVector(side, 0.75).normalize();
        spd = 340;
        cvSamEvading = true;
      }
    }
  } else A.cvMissileResponseChosen = 0;
  const th = ms.filter(m => m.side == 'P' && m.tg === e && !m.dead),
    near = th.reduce((a, m) => Math.min(a, m.pos.distanceTo(e.pos)), 1e9),
    nm = th.find(m => m.pos.distanceTo(e.pos) === near);
  if (nm && near < 6500) {
    const pd = V()
      .crossVectors(nm.dir, V(0, 1, 0))
      .normalize();
    if (pd.dot(f) < 0) pd.negate();
    des = pd.add(V(0, -0.25, 0)).normalize();
    spd = 330;
    if (A.fd <= 0 && ((nm.type == 'IR' && near < 3200 && rnd() < 0.75) || (nm.type == 'SARH' && near < 7000))) {
      nm.type == 'IR' ? flare(e) : chaff(e);
      A.fd = 0.7;
    }
  } else if (cvSamEvading || cvEvading) {
    /* 방공 회피 기동을 유지한다. */
  } else if (rdLockedTg(e) && r < 11000) {
    des = V()
      .crossVectors(d, V(0, 1, 0))
      .normalize();
    if (des.dot(f) < 0) des.negate();
    spd = 300;
    if (A.fd <= 0 && e.chT <= 0) {
      chaff(e);
      A.fd = 3;
    }
  } else if (known) {
    const lead = p.pos.clone().addScaledVector(p.vd, p.speed * clamp(r / 700, 0, 6));
    des = lead.sub(e.pos).normalize();
    if (r < 1800) des.y += 0.5;
    spd = r > 6000 ? 330 : 250;
  } else {
    if ((A.hint -= dt) <= 0) {
      A.hint = 10;
      A.goal = V(d.x + rnd() - 0.5, d.y * 0.3, d.z + rnd() - 0.5).normalize();
    }
    des = A.goal.clone();
    spd = 230;
  }
  for (const o of es)
    if (o !== e) {
      const dd = e.pos.clone().sub(o.pos),
        dl = dd.length();
      if (dl < 700) des.addScaledVector(dd.divideScalar(dl), (700 - dl) / 300);
    }
  if (e.pos.y < 900) des.y = Math.max(des.y, 0.4);
  if (e.pos.y > 9000) des.y = Math.min(des.y, -0.2);
  if (des.lengthSq() < 1e-8) des.copy(f);
  else des.normalize();
  const stableUp = Math.abs(des.y) > 0.96 ? V(0, 0, 1) : V(0, 1, 0);
  const qT = new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(V(), des, stableUp)),
    lat = des.clone().applyQuaternion(e.q.clone().invert()).x;
  qT.multiply(new T.Quaternion().setFromAxisAngle(V(0, 0, 1), -clamp(lat * 3, -1, 1) * 1.1));
  e.q.rotateTowards(
    qT,
    0.95 *
      dt *
      clamp((e.speed - e.prm.stall * 0.5) / (e.prm.stall * 0.8), 0.2, 1) *
      clamp(1 - (Math.acos(clamp(e.fwd().dot(e.vd), -1, 1)) - 0.25) / 0.35, 0.2, 1)
  );
  e.thr = clamp(0.55 + (spd - e.speed) / 120, 0.3, 1);
  e.ab = spd > 300 && e.speed < spd ? 1 : 0;
  phys(e, dt);
  if (e.chT > 0) e.chT -= dt;
  e.cd -= dt;
  if (e.pos.y < 8) kill(e);
  if (e.cd <= 0 && p.hp > 0) {
    if (
      r0.phase == 'LOCK' &&
      r < P.SARH.range &&
      r > Math.max(P.SARH.min, 1200) &&
      e.am.SARH > 0 &&
      !ms.some(m => m.sh === e && m.type == 'SARH' && !m.dead)
    ) {
      fire(e, 'SARH', p);
      e.cd = 6;
    } else {
      const sc = heatScore(p, e.pos, f, 14);
      A.irT = sc > 0.2 && r < P.IR.range && r > P.IR.min ? A.irT + dt : 0;
      if (A.irT > 1 && e.am.IR > 0) {
        fire(e, 'IR', p);
        e.cd = 7;
        A.irT = 0;
      }
    }
  }
  e.gc -= dt;
  if (p.hp > 0 && r < 1100 && ang < 4 && e.gun > 0 && e.gc <= 0) {
    bullet(e, f);
    e.gc = 0.09;
    e.gun--;
  }
  e.mesh.position.copy(e.pos);
  e.mesh.quaternion.copy(e.q);
  e.mesh.userData.setAfterburner?.(e.ab); // 보이는 것만 바꾼다
}
// ---------- 발사 가능 판정 / 상태
function canFire() {
  if (p.am[p.sel] <= 0) return [0, '탄약 없음'];
  if (p.cd > 0) return [0, '재장전 대기'];
  if (p.sel == 'SARH') {
    if (!rd.on) return [0, '레이더 OFF'];
    if (!rd.lock) return [0, '레이더 락 필요 (T→Tab→Y)'];
    const r = rd.lock.c.rng;
    if (r > P.SARH.range) return [0, '사거리 밖'];
    if (r < P.SARH.min) return [0, '최소 사거리 미달'];
    return [1, ''];
  }
  // IR 은 락 없이도 쏠 수 있다 (미사일 시커가 발사 뒤 스스로 표적을 찾는다)
  if (!sk.on) return [0, '시커 OFF (H)'];
  if (sk.st == 'LOCKED' && sk.tg && sk.tg.pos.distanceTo(p.pos) < P.IR.min) return [0, '최소 사거리 미달'];
  return [1, ''];
}
function flapNext() {
  const n = (p.flap + 1) % 3;
  if (n && p.speed > P.flapLim[n]) return [0, `속도 초과 (${kmh(P.flapLim[n])} km/h 이하 필요)`];
  return [1, ['UP', 'MID', 'FULL'][n]];
}
