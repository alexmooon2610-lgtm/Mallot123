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
// 카나드 기체(플레이어 Su-33)의 받음각 한계. 나머지는 예전 0.25 / 0.6 그대로
const aoaLim = a => (a === p && ACFT[playerAc].canard ? [0.3, 0.7] : [0.25, 0.6]);
// ---------- 코브라 (푸가초프 코브라) — 카나드 기체 전용, Q. V15.0.0-alpha.3
// 수평 비행 · 300~600 km/h 에서 기수를 비행 방향 위로 약 100° 까지 2.4초 동안 세웠다 내린다. 비행 경로는 거의 그대로 가고
// 받음각 항력으로 속도가 크게 준다 → 뒤에 붙은 적이 앞질러 나간다. 실기는 받음각 제한기를 끄고 한다.
// 상태는 p 가 아니라 전역 cobra 에 둔다 (하네스가 p 를 통째로 해시하므로 MiG 판정이 그대로이게).
let cobra = null,
  cobraCd = 0;
const COBRA = { up: 0.9, hold: 0.4, down: 1.1, peak: 1.75 };
function cobraStart() {
  if (!ACFT[playerAc].canard) return rej('코브라: 카나드 기체(Su-33)만 된다');
  if (cobra) return;
  if (cobraCd > 0) return rej('코브라: 다시 하려면 ' + cobraCd.toFixed(1) + '초');
  const kmh = p.speed * 3.6,
    up = V(0, 1, 0).applyQuaternion(p.q),
    bank = Math.acos(clamp(up.y, -1, 1)) / D;
  if ((typeof ops !== 'undefined' && ops.st !== 'fly') || p.gearDown) return rej('코브라: 비행 중 · 기어 올린 상태에서만');
  const lo = Math.max(300, Math.round(stallSpeed(p) * 3.6 * 1.3));
  if (kmh < lo || kmh > 600) return rej(`코브라: 속도 ${lo}~600 km/h 에서만 (지금 ${Math.round(kmh)})`);
  if (bank > 30 || Math.abs(p.vd.y) > 0.35) return rej('코브라: 날개를 수평으로 · 수평 비행에서만');
  cobra = { t: 0, v0: kmh };
  msg('코브라!', '#ff4');
  tone(300, 0.5, 'sawtooth', 0.05, 160);
}
// 지금 시각의 목표 받음각 (rad)
function cobraAoa(t) {
  const C = COBRA,
    s = x => x * x * (3 - 2 * x);
  if (t < C.up) return C.peak * s(t / C.up);
  if (t < C.up + C.hold) return C.peak;
  return C.peak * (1 - s(Math.min(1, (t - C.up - C.hold) / C.down)));
}
function phys(a, dt) {
  const pr = a.prm,
    [aoaL, aoaM] = aoaLim(a),
    rho = airDensity(a.pos.y),
    stall = stallSpeed(a),
    mk = acMassK(a), // 연료가 줄면 가벼워진다 (Su-33). MiG · 적기는 1
    vc = (pr.vc * (1 - 0.12 * a.flap)) / Math.sqrt(mk), // 가벼우면 익면하중이 줄어 더 느린 속도에서 최대 G
    vd0 = a.vd.clone(),
    cob = a === p && cobra; // 코브라 중에는 받음각 한계를 넘는다
  a.stl = a.speed < stall;
  let f = a.fwd(),
    aoa = Math.acos(clamp(f.dot(a.vd), -1, 1));
  if (aoa > aoaM && !cob) {
    a.q.premultiply(new T.Quaternion().setFromAxisAngle(V().crossVectors(f, a.vd).normalize(), aoa - aoaM));
    aoa = aoaM;
    f = a.fwd();
  }
  // 선회율: 양력은 밀도 × 속도² 에 비례 (V14.7.0 에서 밀도를 넣었다 — 높이서는 덜 돈다)
  // 받음각 한계를 넘으면(코브라) 날개가 실속해 양력이 무너진다 → 비행 경로는 거의 그대로 간다
  // 코브라 중에는 날개가 대부분 실속 · 와류 상태라 경로를 꺾는 힘이 약하다 (×0.3) — 경로가 거의 수평으로 유지된다
  const liftK = cob ? 0.3 * clamp(1 - (aoa - aoaM) / 0.5, 0.25, 1) : aoa > aoaM ? clamp(1 - (aoa - aoaM) / 0.5, 0.08, 1) : 1,
    rate = ((pr.g * clamp((a.speed / vc) ** 2 * rho, 0, 1) * 9.8) / a.speed) * clamp(aoa / aoaL, 0, 1) * liftK,
    turn = Math.min(aoa, rate * dt);
  if (aoa > 1e-4) a.vd.lerp(f, turn / aoa).normalize();
  const gu = ((turn / dt) * a.speed) / 9.8,
    kd = (pr.thr / (pr.maxV * pr.maxV)) * mk,
    // 추력: 높이 올라갈수록 줄어든다 (밀도^0.75). 항력: 밀도에 비례
    push =
      (a.thr * pr.thr + a.ab * pr.ab) * mk * rho ** 0.75 -
      kd * rho * a.speed * a.speed * (1 + 0.35 * a.flap + 3 * Math.max(0, aoa - aoaL)) -
      // 코브라: 기체 윗면이 바람을 정면으로 받는 평판 항력 (sin² 받음각) — 짧은 시간에 속도를 크게 버린다
      (cob ? kd * rho * a.speed * a.speed * 24 * Math.sin(aoa) ** 2 : 0) -
      (gu / pr.g) ** 2 * 9;
  if (!a.stl) {
    // 정상 비행: 중력의 진행 방향 성분만 속도를 바꾼다 (V14.7.0: 예전엔 0.8 배로 깎여 있었다)
    a.speed = Math.max(35, a.speed + (push - 9.8 * a.vd.y) * dt);
    if (cob) a.speed = Math.max(a.speed, stall * 1.05); // 코브라는 실속 직전 속도에서 끝난다 (실기도 최저 속도에서 빠져나온다)
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
  // 코브라: 받음각 100° 에서는 양력 축 기준 G 식이 맞지 않는다(음의 G 로 나와 레드아웃이 켜진다).
  // 기수를 세우는 동안 조종사가 받는 하중은 +2~3 G 정도라 받음각에 따라 1 → 2.5 G 로 둔다
  if (cob) a.g = 1 + 1.5 * Math.sin(Math.min(aoa, Math.PI / 2));
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
  const cn = ACFT[playerAc].canard,
    [aL, aM] = aoaLim(p);
  // 저속 조종력: 카나드 기체는 실속 속도 근처에서도 기수가 잘 돈다
  let ctl = cn
    ? clamp((p.speed - stall * 0.35) / (stall * 0.6), 0.35, 1)
    : clamp((p.speed - stall * 0.5) / (stall * 0.8), 0.2, 1);
  if (p.ovs) ctl *= 0.55;
  const aoa0 = Math.acos(clamp(p.fwd().dot(p.vd), -1, 1)),
    pl = inp.p > 0 ? clamp(1 - (aoa0 - aL) / (aM - aL), 0.15, 1) : 1;
  cobraCd = Math.max(0, cobraCd - dt);
  if (cobra) {
    // 코브라: 조종 입력 대신 정해진 받음각을 따라 기수만 세웠다 내린다 (날개 축 회전)
    cobra.t += dt;
    const want = cobraAoa(cobra.t);
    p.q.multiply(new T.Quaternion().setFromEuler(new T.Euler(clamp(want - aoa0, -3 * dt, 3 * dt), 0, 0))).normalize();
    if (cobra.t >= COBRA.up + COBRA.hold + COBRA.down) {
      msg(`코브라 끝 — ${Math.round(cobra.v0)} → ${Math.round(p.speed * 3.6)} km/h`, '#9cf');
      cobra = null;
      cobraCd = 4;
    }
  } else p.q
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
  if (p.stl && !cobra) p.q.multiply(new T.Quaternion().setFromEuler(new T.Euler(-0.35 * dt, 0, 0)));
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
