// ---------- 항모 운용 진행: 갑판 승조원 동작, 스키점프 발진, 착함 후 보급
function crewUpdate(dt, show) {
  const aircraft = ops.loc;
  ops.crew.forEach((crew, index) => {
    crew.visible = show;
    if (!show) {
      crew.position.set(11, DECK_Y, -14);
      return;
    }

    const offset = CREW_OFFSETS[index];
    const dx = aircraft.x + offset[0] - crew.position.x;
    const dz = aircraft.z + offset[1] - crew.position.z;
    const blend = Math.min(1, dt * 1.2);
    const moving = Math.hypot(dx, dz) > 0.6;
    const phase = ops.t * 8 + index;
    const [leftArm, rightArm] = crew.userData.arms;

    crew.position.set(crew.position.x + dx * blend, DECK_Y, crew.position.z + dz * blend);

    if (index === 0) {
      // 신호수는 조종석에서 보이도록 왼쪽 앞쪽에서 양팔 신호를 반복한다.
      leftArm.rotation.z = 2.5 + Math.sin(phase * 0.9) * 0.5;
      rightArm.rotation.z = -2.5 - Math.sin(phase * 0.9 + 1) * 0.5;
    } else if (moving) {
      leftArm.rotation.x = Math.sin(phase) * 0.7;
      rightArm.rotation.x = -Math.sin(phase) * 0.7;
      leftArm.rotation.z = rightArm.rotation.z = 0;
    } else {
      leftArm.rotation.x = rightArm.rotation.x = -1.2 + Math.sin(phase * 0.5) * 0.4;
    }

    if (!moving) {
      crew.rotation.y = Math.atan2(aircraft.x - crew.position.x, aircraft.z - crew.position.z);
    }
  });

  const hose = ops.hoseM;
  const start = ops.crew[3].position.clone().add(V(0, 1, 0));
  const end = V(aircraft.x - 3, DECK_Y + 1.5, aircraft.z + 1);
  const direction = end.clone().sub(start);
  hose.visible = !!ops.hose && show;
  hose.position.copy(start).addScaledVector(direction, 0.5);
  hose.scale.y = direction.length();
  hose.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
}
function launch() {
  setSt('fly');
  ops.safe = 5;
  p.q.copy(CV.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(SKI_EXIT_PITCH, 0, 0)));
  p.vd.copy(p.fwd());
  p.speed = Math.max(SHIP_V + ops.v, 112);
  p.thr = 1;
  p.ab = 1;
  p.gearDown = false;
  p.mesh?.userData.setGear?.(false);
  msg('스키점프 이륙 — 플랩 정리 후 상승', '#ff4');
}
function opsFly(dt) {
  if (ops.safe > 0) {
    ops.safe = Math.max(0, ops.safe - dt);
    return 1;
  }
  const l = CV.worldToLocal(p.pos.clone()),
    z = l.z;
  const sf = V(0, 0, -1).applyQuaternion(CV.quaternion),
    fw = p.fwd();
  const sfh = V(sf.x, 0, sf.z).normalize(),
    fh = V(fw.x, 0, fw.z).normalize(),
    align = fh.dot(sfh); // 수평 정렬(피치와 무관)
  // 착함 형상 보조: 항모 후방 접근 회랑에서 낮고 정렬되면 기어·플랩(MID) 자동 설정
  if (z > 152 && z < 1000 && Math.abs(l.x) < 140 && l.y < DECK_Y + EYE + 90 && align > 0.8) {
    if (!ops.ev.asst) {
      ops.ev.asst = 1;
      msg('착함 접근 — 착륙장치·플랩 설정 보조', '#9cf');
    }
    if (!p.gearDown) {
      p.gearDown = true;
      p.mesh?.userData.setGear?.(true);
    }
    if (p.flap < 1 && p.speed <= P.flapLim[1]) p.flap = 1;
  }
  if (ops.bolter > 0) {
    ops.bolter = Math.max(0, ops.bolter - dt);
    return 1;
  }
  if (z < -155 || z > 152 || l.y > DECK_Y + EYE + rampY(z) + 12 || l.y < -6) return 1;
  const e = CV.userData.deckEdges(z);
  if (l.x < e[0] - 8 || l.x > e[1] + 8) return 1;
  const dy = l.y - (DECK_Y + EYE + rampY(z));
  if (dy > 3 || (dy > 0.3 && p.vd.y > 0.04)) return 1; // 갑판 위 3 단위(≈9 m) 안에서 하강/수평이면 후크 포착 구간
  const okSpeed = p.speed < 165,
    okSink = p.vd.y > -0.22,
    okAlign = align > 0.85 && Math.abs(fw.y) < 0.5,
    okCfg = p.flap > 0 && p.gearDown;
  if (z > 10 && okSpeed && okSink && okAlign && okCfg) {
    ops.v0 = Math.max(p.speed - SHIP_V, 40);
    ops.loc.set(l.x, Math.max(DECK_Y + EYE, l.y), z);
    ops.pitch = 0;
    ops.hose = 0;
    setSt('land');
    p.thr = 0;
    p.ab = 0;
    msg('착함! 어레스팅 와이어 포착', '#ff4');
    tone(200, 0.6, 'sawtooth', 0.12, 60);
    boom(p.pos.clone().add(V(0, -8, 0)), 12);
    return 0;
  }
  const severe = p.vd.y < -0.45 || p.speed > 205 || align < 0.6;
  if (severe) {
    const why = [];
    if (!okSpeed) why.push('속도 과다');
    if (!okSink) why.push('강하 과다');
    if (align < 0.85) why.push('기수 정렬 불량');
    if (!okCfg) why.push('기어·플랩');
    msg('갑판 충돌 — 착함 실패 (' + (why.join(' · ') || '조건 불충족') + ')', '#f44');
    kill(p);
    return 0;
  }
  // 와이어를 놓친 경우(볼터): 추락 대신 재상승 — 다시 접근하면 된다
  const why = [];
  if (!okSpeed) why.push('속도');
  if (!okSink) why.push('강하각');
  if (!okAlign) why.push('정렬');
  if (z <= 10) why.push('착함 지점 초과');
  p.pos.y += 18;
  p.vd.y = Math.max(p.vd.y, 0.12);
  p.vd.normalize();
  p.q.multiply(new T.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.16));
  ops.bolter = 1.5;
  msg('BOLTER — 와이어 놓침 (' + (why.join(' · ') || '재접근') + ') · 재접근하라', '#ffd36b');
  return 1;
}
// 반환값: true 이면 정상 비행/전투 갱신을 진행
function opsUpdate(dt) {
  if (isAirbase()) return airbaseUpdate(dt);
  const st = ops.st;
  ops.t += dt;
  p.stl = 0;
  p.ovs = 0;
  p.g = 1;
  if (st == 'fly') return opsFly(dt);
  if (AC) {
    const e = st == 'run' ? 1 : st == 'prep' || st == 'deck' ? 0.35 : 0.15;
    engG.gain.value = 0.03 + 0.06 * e;
    eng.frequency.value = 40 + e * 60;
    engF.frequency.value = 300 + e * 600;
  }
  if (st == 'prep') {
    once('a', 0.2, () => msg('엔진 시동 · 점검 시작', '#9cf'));
    once('b', 1.8, () => {
      p.flap = 1;
      msg('플랩 MID — 갑판 요원 설정');
    });
    once('c', 3.4, () => msg(`무장 안전핀 제거 (SARH ${p.am.SARH} / IR ${p.am.IR})`));
    once('d', 5, () => msg('고임목 제거 · 조종면 점검 완료'));
    once('e', 6.2, () => {
      setSt('deck');
      msg('발진 준비 완료 — Shift 로 이륙 (스키점프)', '#ff4');
    });
  } else if (st == 'deck') {
    if (K.Shift) {
      msg('발진!', '#ff4');
      setSt('run');
      p.thr = 1;
      p.ab = 1;
      ops.v = 0;
      tone(300, 1.2, 'sawtooth', 0.1, 900);
    }
  } else if (st == 'run') {
    ops.v = Math.min(ops.v + 16 * dt, 100);
    ops.loc.z -= (ops.v / 3) * dt;
    ops.loc.y = DECK_Y + EYE + rampY(ops.loc.z);
    ops.pitch = rampPitch(ops.loc.z);
    p.speed = SHIP_V + ops.v;
    if (ops.loc.z <= -150) {
      launch();
      crewUpdate(dt, false);
      return 1;
    }
  } else if (st == 'land') {
    const k = Math.max(0, 1 - ops.t / 2.2);
    ops.v = ops.v0 * k;
    ops.loc.z -= (ops.v / 3) * dt;
    ops.loc.y += (DECK_Y + EYE - ops.loc.y) * Math.min(1, dt * 10);
    {
      const de = CV.userData.deckEdges(ops.loc.z),
        cxn = clamp(ops.loc.x, de[0] + 6, de[1] - 6);
      ops.loc.x += (cxn - ops.loc.x) * Math.min(1, dt * 3);
    }
    p.speed = SHIP_V + ops.v;
    if (k <= 0) {
      setSt('serve');
      msg('착함 성공 — 승조원 접근', '#9cf');
    }
  } else if (st == 'serve') {
    once('a', 1.5, () => {
      ops.hose = 1;
      msg('급유 시작');
    });
    once('b', 3.5, () => {
      ops.hose = 0;
      p.fuel = 100;
      p.fuelWarn = 0;
      const L = loadout();
      p.am.SARH = Math.max(p.am.SARH, L.SARH);
      p.am.IR = Math.max(p.am.IR, L.IR);
      msg(`급유 완료 · 연료 100% · 미사일 장착 (SARH ${L.SARH} / IR ${L.IR})`);
    });
    once('c', 5.5, () => {
      p.gun = Math.max(p.gun, 500);
      msg('기총탄 보충 (500)');
    });
    once('d', 7, () => {
      p.fl = Math.max(p.fl, 30);
      p.ch = Math.max(p.ch, 30);
      msg('플레어 · 채프 보충 (30 / 30)');
    });
    once('e', 8.5, () => {
      p.hp = 1;
      msg('기체 점검 · 수리 완료');
    });
    once('f', 10, () => {
      ops.loc.set(0, DECK_Y + EYE, -30);
      ops.crew.forEach(c => c.position.set(11, DECK_Y, -14));
      p.flap = 1;
      setSt('deck');
      msg('발진 위치로 견인 완료 — Shift 로 재발진', '#ff4');
    });
  }
  crewUpdate(dt, st == 'prep' || st == 'deck' || st == 'serve' || (st == 'land' && ops.t > 2));
  opsPlace();
  return 0;
}
