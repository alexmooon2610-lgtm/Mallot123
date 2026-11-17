// ---------- 비행장 운용: 활주로 대기 · 이륙 · 착륙 판정과 접근 안내
function airbaseInit() {
  airbaseOps = {
    phase: 'ready',
    rollDistance: 0,
    elapsed: 0,
    landingT: 0,
    landingFrom: null,
    configAssist: false,
    touch: null,
    far: false,
    airT: 0,
  };
  const M = curM();
  if (M.start === 'air') {
    const s = M.spawn;
    p.pos.set(s.pos[0], s.pos[1], s.pos[2]);
    p.q.setFromAxisAngle(V(0, 1, 0), Math.PI);
    p.vd.copy(p.fwd());
    p.speed = s.speed;
    p.thr = s.thr;
    p.ab = 0;
    p.flap = s.flap;
    p.gearDown = s.gear;
    p.mesh?.userData.setGear?.(s.gear);
    p.hp = 1;
    airbaseOps.phase = 'airborne';
    airbaseOps.far = true;
    missionPhase = 'approach';
    msg(`${M.label} ${M.title} — 공중 시작. 접근 게이트를 순서대로 통과하라`, '#9cf');
    return;
  }
  p.pos.set(0, 5.2, 930);
  p.q.identity();
  p.vd.copy(p.fwd());
  p.speed = 0;
  p.thr = 0.88;
  p.ab = 0;
  p.flap = 1;
  p.gearDown = true;
  p.mesh?.userData.setGear?.(true);
  p.hp = 1;
  missionPhase = 'preflight';
  msg('비행장 29 — 활주로 대기 위치. Shift 로 이륙 활주 시작', '#9cf');
}
function airbaseUpdate(dt) {
  const st = airbaseOps.phase;
  airbaseOps.elapsed += dt;
  if (st !== 'airborne') p.g = 1;
  if (AC) {
    const power = st === 'ready' ? p.thr : st === 'roll' ? p.thr : st === 'airborne' ? p.thr : 0.1;
    engG.gain.value = 0.02 + 0.075 * power + 0.04 * p.ab;
    eng.frequency.value = 42 + power * 62 + p.ab * 24;
    engF.frequency.value = 280 + power * 560 + p.ab * 360;
  }
  // 정상 최종 접근 뒤에 이어지는 짧은 착륙 포착 연출.
  // This is a land-runway touchdown assist, not a carrier arresting hook.
  if (st === 'landing') {
    const duration = 2.6;
    airbaseOps.landingT = Math.min(duration, airbaseOps.landingT + dt);
    const k = clamp(airbaseOps.landingT / duration, 0, 1),
      ease = k * k * (3 - 2 * k);
    const from = airbaseOps.landingFrom;
    if (from) {
      const dir = from.dir || 1,
        remain = dir > 0 ? Math.max(0, 1325 - from.z) : Math.max(0, from.z + 1450);
      const rollDistance = Math.min(160, from.speed * duration * 0.5, remain);
      p.pos.set(from.x * (1 - ease), from.y + (5.2 - from.y) * ease, from.z + dir * rollDistance * (2 * k - k * k));
      const runwayQ = new T.Quaternion().setFromEuler(new T.Euler(0, dir > 0 ? Math.PI : 0, 0));
      p.q.copy(from.q).slerp(runwayQ, ease);
      p.vd.set(0, 0, dir);
      p.speed = from.speed * (1 - k);
    }
    p.thr = 0;
    p.ab = 0;
    p.gearDown = true;
    p.flap = Math.max(1, p.flap);
    p.mesh?.userData.setGear?.(true);
    if (k >= 1) {
      p.pos.y = 5.2;
      p.speed = 0;
      p.vd.set(0, 0, 0);
      p.thr = 0;
      p.ab = 0;
      p.gearDown = true;
      p.mesh?.userData.setGear?.(true);
      p.hp = 1;
      airbaseOps.phase = 'landed';
      airbaseOps.landingFrom = null;
      msg(`활주로 접지 및 감속 완료 — ${curM().label} 착륙 성공`, '#52ffc0');
      tone(520, 0.25, 'sine', 0.08, 780);
    }
    return 0;
  }
  if (st === 'ready') {
    p.thr = clamp(p.thr + ((K.w ? 1 : 0) - (K.s ? 1 : 0)) * 0.45 * dt, 0, 1);
    if (K.Shift) {
      if (p.thr < 0.55) {
        msg('이륙 불가 — 추력을 55% 이상으로 올리십시오', '#fa4');
      } else {
        airbaseOps.phase = 'roll';
        airbaseOps.rollDistance = 0;
        missionPhase = 'takeoff';
        p.ab = 1;
        msg('이륙 활주 시작 — 활주로 중심선을 유지하라', '#ff4');
      }
    }
    return 0;
  }
  if (st === 'roll') {
    p.thr = clamp(p.thr + ((K.w ? 1 : 0) - (K.s ? 1 : 0)) * 0.35 * dt, 0, 1);
    p.ab = K.Shift ? 1 : 0;
    const drag = 0.00045 * p.speed * p.speed;
    p.speed = Math.min(155, p.speed + Math.max(1.5, p.thr * 21 - drag) * dt);
    const travel = p.speed * dt;
    p.pos.z -= travel;
    airbaseOps.rollDistance += travel;
    p.pos.x += (0 - p.pos.x) * Math.min(1, dt * 2.5);
    if (p.speed >= 92 && airbaseOps.rollDistance >= 420) {
      airbaseOps.phase = 'airborne';
      p.pos.y = 6.2;
      p.q.setFromAxisAngle(V(1, 0, 0), 7 * D);
      p.vd.copy(p.fwd());
      p.ab = K.Shift ? 1 : 0;
      p.gearDown = true;
      p.mesh?.userData.setGear?.(true);
      missionBeginWaypoint();
      return 1;
    }
    if (p.pos.z < -1380) {
      msg('활주로 끝 도달 — 이륙 실패', '#f44');
      kill(p);
      return 0;
    }
    return 0;
  }
  if (st === 'airborne') {
    airbaseOps.airT = (airbaseOps.airT || 0) + dt;
    return 1;
  }
  return 0;
}
// 활주로 접근 안내(양방향): 방향·시작점까지 거리·활공각(3.5°) 오차 — HUD 와 평가에 사용
function landingGuide() {
  const f = p.fwd();
  if (Math.abs(f.z) < 0.35) return null;
  const dir = f.z > 0 ? 1 : -1,
    d = dir > 0 ? -1450 - p.pos.z : p.pos.z - 1325;
  if (d < -1800 || d > 9000 || Math.abs(p.pos.x) > 1500) return null;
  return { dir, d, x: p.pos.x, gs: p.pos.y - Math.max(0, d + 300) * 0.061, sink: Math.max(0, -p.vd.y * p.speed) };
}
function airbaseAfterPhysics() {
  if (!isAirbase() || airbaseOps.phase !== 'airborne' || S !== 'play') return;
  // 착륙 로직은 이륙 직후가 아니라 '한 번 멀리 나갔다 돌아온' 뒤부터 작동한다 (far).
  if (!airbaseOps.far && (Math.hypot(p.pos.x, p.pos.z) > 3200 || (airbaseOps.airT || 0) > 45)) airbaseOps.far = true;
  const f = p.fwd(),
    dir = f.z >= 0 ? 1 : -1;
  const aligned = Math.abs(f.z) > 0.5; // 활주로 축 ±60° — 양방향 착륙 허용
  const inLane = Math.abs(p.pos.x) < 170 && p.pos.z > -1850 && p.pos.z < 1725; // 활주로 앞뒤 여유 포함 (짧은/긴 접지 허용)
  const nearRwy = Math.abs(p.pos.x) < 260 && p.pos.z > -2800 && p.pos.z < 2675;
  const verticalApproach = p.vd.y > -0.45 && p.vd.y < 0.3;
  const landingMode = airbaseOps.far;
  // 최종 접근 형상 보조: 활주로 접근 회랑에서 낮고 정렬되면 기어와 플랩(MID)을 자동 설정
  if (landingMode && nearRwy && aligned && p.pos.y < 120) {
    if (!airbaseOps.configAssist) {
      airbaseOps.configAssist = true;
      msg('최종 접근 — 착륙장치 및 플랩 설정 보조', '#9cf');
    }
    if (!p.gearDown) {
      p.gearDown = true;
      p.mesh?.userData.setGear?.(true);
    }
    if (p.flap < 1 && p.speed <= P.flapLim[1]) p.flap = 1;
  }
  if (landingMode) {
    const g = landingGuide();
    if (g && g.d > 0 && g.gs < -45 && p.pos.y < 110 && aligned && t - (airbaseOps.lowT || -9) > 4) {
      airbaseOps.lowT = t;
      msg('고도 낮음 — 출력 올리고 기수 들어라 (GS LOW)', '#fa4');
      tone(300, 0.15, 'square', 0.05, 300);
    }
  }
  const validHeight = p.pos.y <= 18,
    validSpeed = p.speed >= 48 && p.speed <= 230,
    validConfig = p.gearDown && p.flap >= 1;
  if (landingMode && inLane && validHeight && verticalApproach && aligned && validSpeed && validConfig) {
    if (isFinalPhase()) {
      airbaseOps.phase = 'landing';
      airbaseOps.landingT = 0;
      airbaseOps.landingFrom = { x: p.pos.x, y: p.pos.y, z: p.pos.z, speed: p.speed, q: p.q.clone(), dir };
      airbaseOps.touch = { x: p.pos.x, y: p.pos.y, speed: p.speed, sink: Math.max(0, -p.vd.y * p.speed) };
      p.thr = 0;
      p.ab = 0;
      msg('RUNWAY CAPTURE — 자동 접지 보조 시작', '#52ffc0');
      tone(420, 0.18, 'sine', 0.06, 620);
      return;
    }
    // 임무 게이트를 다 지나기 전의 접지 시도: 추락시키지 않고 복행(go-around)
    p.pos.y = Math.max(p.pos.y, 28);
    p.vd.y = Math.max(p.vd.y, 0.14);
    p.vd.normalize();
    p.q.multiply(new T.Quaternion().setFromAxisAngle(V(1, 0, 0), 0.14));
    if (t - (airbaseOps.goT || -9) > 3) {
      airbaseOps.goT = t;
      msg('GO AROUND — 게이트를 모두 통과한 뒤 착륙하십시오', '#ffd36b');
    }
    return;
  }
  if (p.pos.y < 5.0) {
    const why = [];
    if (!aligned) why.push('활주로 정렬 불량');
    if (!inLane) why.push(Math.abs(p.pos.x) >= 170 ? '활주로 이탈(좌우)' : '활주로 밖 접지(짧거나 김)');
    if (!verticalApproach) why.push('강하각 과다');
    if (!validSpeed) why.push('속도 부적합');
    msg('지면 충돌 — ' + (why.join(' · ') || '착륙 조건 불충족'), '#f44');
    kill(p);
  }
}
