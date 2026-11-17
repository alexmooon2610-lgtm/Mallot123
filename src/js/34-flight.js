// ---------- 공통 비행 물리 (플레이어/적 공용): 기수(q)와 이동 방향(vd) 분리
// 공기 밀도비 (해면 1). 고도 단위는 m — 미사일(32-missiles 의 mslMaxAcc)과 같은 식
const airDensity = y => Math.exp(-Math.max(0, y) / 8500);
// 실속 속도: 플랩 단계마다 12% 감소, 저고도 착륙 형상(기어+플랩)이면 추가 12% 감소.
// V14.7.0: 높이 올라가면 공기가 묽어져 같은 양력에 더 빠른 속도가 필요하다 (1/√밀도) — 실기의 '지시 대기속도 기준 실속'
function stallSpeed(a) {
  return (
    (a.prm.stall * (1 - 0.12 * a.flap) * (a.gearDown && a.flap >= 1 && a.pos.y < 260 ? 0.88 : 1)) /
    Math.sqrt(airDensity(a.pos.y))
  );
}
function phys(a, dt) {
  const pr = a.prm,
    aoaL = 0.25,
    aoaM = 0.6,
    rho = airDensity(a.pos.y),
    stall = stallSpeed(a),
    vc = pr.vc * (1 - 0.12 * a.flap),
    vd0 = a.vd.clone();
  a.stl = a.speed < stall;
  let f = a.fwd(),
    aoa = Math.acos(clamp(f.dot(a.vd), -1, 1));
  if (aoa > aoaM) {
    a.q.premultiply(new T.Quaternion().setFromAxisAngle(V().crossVectors(f, a.vd).normalize(), aoa - aoaM));
    aoa = aoaM;
    f = a.fwd();
  }
  // 선회율: 양력은 밀도 × 속도² 에 비례 (V14.7.0 에서 밀도를 넣었다 — 높이서는 덜 돈다)
  const rate = ((pr.g * clamp((a.speed / vc) ** 2 * rho, 0, 1) * 9.8) / a.speed) * clamp(aoa / aoaL, 0, 1),
    turn = Math.min(aoa, rate * dt);
  if (aoa > 1e-4) a.vd.lerp(f, turn / aoa).normalize();
  const gu = ((turn / dt) * a.speed) / 9.8,
    mk = acMassK(a), // 연료가 줄면 가벼워진다 (Su-33). MiG · 적기는 1
    kd = (pr.thr / (pr.maxV * pr.maxV)) * mk,
    // 추력: 높이 올라갈수록 줄어든다 (밀도^0.75). 항력: 밀도에 비례
    push =
      (a.thr * pr.thr + a.ab * pr.ab) * mk * rho ** 0.75 -
      kd * rho * a.speed * a.speed * (1 + 0.35 * a.flap + 3 * Math.max(0, aoa - aoaL)) -
      (gu / pr.g) ** 2 * 9;
  if (!a.stl) {
    // 정상 비행: 중력의 진행 방향 성분만 속도를 바꾼다 (V14.7.0: 예전엔 0.8 배로 깎여 있었다)
    a.speed = Math.max(35, a.speed + (push - 9.8 * a.vd.y) * dt);
  } else {
    // 실속: 속도를 벡터로 적분한다. 중력은 통째로 걸리고, 양력은 비행경로에 수직인 중력 성분 중 (속도/실속속도)² 만큼만 받친다.
    // 그래서 수직 상승 끝에서는 속도가 0 을 지나 꼬리부터 미끄러지고, 받음각 한계(aoaM)가 기수를 비행 방향으로 끌어내린다.
    // 예전엔 수직 상승 중 실속해도 진행 방향이 위로 고정되고 속도가 35 에서 멈춰 계속 떠올랐다.
    const lf = clamp((a.speed / stall) ** 2, 0, 1),
      v = a.vd.clone().multiplyScalar(a.speed + push * dt),
      gPerp = V(0, -9.8, 0).addScaledVector(a.vd, 9.8 * a.vd.y); // 중력의 비행경로 수직 성분
    v.y -= 9.8 * dt;
    v.addScaledVector(gPerp, -lf * dt);
    const sp = v.length();
    if (sp > 1e-3) a.vd.copy(v).divideScalar(sp);
    a.speed = Math.max(3, sp);
  }
  a.pos.addScaledVector(a.vd, a.speed * dt);
  // 하중계수: 비행경로 곡률(법선 가속) + 중력 반작용을 기체 상방축에 투영한다.
  // 수평 비행 1G, 배면 수평 -1G, 푸시오버는 음의 G — 예전 식(1+gu)은 1G 아래로 내려가지 않아
  // 화면 효과의 음G 레드아웃이 절대 작동하지 않았다.
  // 양력 축(비행 방향에 수직인 기체 위쪽)으로 잰다. 예전에는 기체 상방축으로 재서 받음각(최대 ~30°)만큼
  // cos 으로 깎여, 최대로 당겨도 7G 언저리에서 멈췄다. 화면 표시·G 효과에만 쓰이고 비행 궤적은 그대로다.
  const up = V(0, 1, 0).applyQuaternion(a.q),
    lift = up.clone().addScaledVector(a.vd, -up.dot(a.vd));
  if (lift.lengthSq() > 1e-8) lift.normalize();
  else lift.copy(up);
  a.g =
    vd0
      .sub(a.vd)
      .multiplyScalar(-a.speed / dt)
      .dot(lift) /
      9.8 +
    lift.y;
  a.aoa = aoa;
}
// ---------- 플레이어 비행
function updP(dt) {
  const pr = p.prm,
    k = (a, b) => (K[a] ? 1 : 0) - (K[b] ? 1 : 0),
    sm = (c, v) => c + (v - c) * Math.min(1, 8 * dt);
  inp.p = sm(inp.p, k('ArrowUp', 'ArrowDown'));
  inp.r = sm(inp.r, k('ArrowRight', 'ArrowLeft'));
  inp.y = sm(inp.y, k('d', 'a'));
  p.thr = clamp(p.thr + k('w', 's') * 0.45 * dt, 0, 1);
  p.ab = K.Shift && p.thr > 0.85 ? 1 : 0;
  if (p.flap && p.speed > P.flapLim[p.flap] + 20) {
    p.flap--;
    msg('플랩 자동 수납 — 속도 초과', '#fa4');
  }
  const stall = stallSpeed(p);
  p.stl = p.speed < stall;
  p.ovs = p.speed > pr.maxV * 1.42;
  let ctl = clamp((p.speed - stall * 0.5) / (stall * 0.8), 0.2, 1);
  if (p.ovs) ctl *= 0.55;
  const aoa0 = Math.acos(clamp(p.fwd().dot(p.vd), -1, 1)),
    pl = inp.p > 0 ? clamp(1 - (aoa0 - 0.25) / 0.35, 0.15, 1) : 1;
  p.q
    .multiply(
      new T.Quaternion().setFromEuler(
        new T.Euler(
          inp.p * pr.pit * ctl * pl * (1 + 0.15 * p.flap) * dt,
          -inp.y * pr.yaw * ctl * dt,
          -inp.r * pr.rol * ctl * dt,
          'YXZ'
        )
      )
    )
    .normalize();
  if (p.stl) p.q.multiply(new T.Quaternion().setFromEuler(new T.Euler(-0.35 * dt, 0, 0)));
  phys(p, dt);
  const f = p.fwd();
  if (p.pos.y < 8 && !isAirbase()) {
    p.pos.y = 8;
    kill(p);
    msg('해면 충돌', '#f44');
  }
  if (hmd.on) {
    hmd.az = clamp(hmd.az + ((K.l ? 1 : 0) - (K.j ? 1 : 0)) * 70 * dt, -70, 70);
    hmd.el = clamp(hmd.el + ((K.i ? 1 : 0) - (K.k ? 1 : 0)) * 70 * dt, -25, 60);
  }
  if (p.chT > 0) p.chT -= dt;
  p.cd -= dt;
  // 기총: 남는 시간을 다음 발로 넘겨서(누산) 프레임 속도와 무관하게 정확히 rof 발/초를 쏜다.
  // 방아쇠를 놓으면 쌓인 시간을 버린다 (다시 당겼을 때 몰아서 나가지 않게).
  p.gc -= dt;
  if (!K.g && p.gc < 0) p.gc = 0;
  while (K.g && p.gun > 0 && p.gc <= 1e-6) {
    bullet(p, f);
    p.gun--;
    p.gc += 1 / p.prm.rof;
  }
  gunSnd(!!K.g && p.gun > 0); // 연사음 (31-audio-fx)
  if (AC) {
    engG.gain.value = 0.03 + 0.05 * p.thr + 0.06 * p.ab;
    eng.frequency.value = 45 + p.thr * 50 + p.ab * 25;
    engF.frequency.value = 300 + p.thr * 500 + p.ab * 400;
  }
}
