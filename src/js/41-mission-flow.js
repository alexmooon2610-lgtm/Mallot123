// ---------- 임무 진행: 게이트·웨이포인트 판정, 성공/실패 처리, HUD 안내 문구
function missionReset() {
  clearMissionMarker();
  missionTarget = null;
  missionComplete = false;
  missionFailed = false;
  missionStartTime = 0;
  missionElapsed = 0;
  missionResult = null;
  missionGate = 0;
  missionStats = { met: 0, total: 0, gates: 0, hits: 0 };
  const M = curM();
  missionPhase = M.env === 'AIRBASE' ? (M.start === 'air' ? 'approach' : 'preflight') : 'idle';
  if (M.env === 'AIRBASE') msg(`${M.label} ${M.title} — ${M.intro}`, '#9cf');
}
function placeMissionMarker(pos, color = 0x52ffc0) {
  clearMissionMarker();
  const ring = new T.Mesh(
    new T.TorusGeometry(260, 14, 10, 36),
    new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })
  );
  ring.position.copy(pos);
  ring.quaternion.setFromUnitVectors(V(0, 0, 1), V(0, 0, 1));
  const beacon = new T.Mesh(new T.SphereGeometry(28, 10, 8), new T.MeshBasicMaterial({ color }));
  beacon.position.copy(pos);
  beacon.userData.isBeacon = true;
  missionMarker = new T.Group();
  missionMarker.add(ring, beacon);
  scene.add(missionMarker);
}
function setGateTarget() {
  const g = curM().gates[missionGate];
  missionTarget = V(g.p[0], g.p[1], g.p[2]);
  placeMissionMarker(missionTarget, 0x52ffc0);
}
function missionBeginWaypoint() {
  const M = curM();
  if (M.env !== 'AIRBASE' || !M.gates) return;
  missionStartTime = t;
  missionGate = 0;
  missionPhase = M.start === 'air' ? 'approach' : 'waypoint';
  setGateTarget();
  msg(M.start === 'air' ? '접근 경로 진입 — 첫 게이트를 향하라' : '이륙 완료 — 첫 항법 게이트를 통과하라', '#9cf');
}
function gateCheck(g) {
  let met = 0,
    total = 0;
  if (g.alt) {
    total++;
    if (p.pos.y >= g.alt[0] && p.pos.y <= g.alt[1]) met++;
  }
  if (g.spd) {
    total++;
    if (p.speed >= g.spd[0] && p.speed <= g.spd[1]) met++;
  }
  if (g.cfg) {
    total++;
    if (p.gearDown && p.flap >= 1) met++;
  }
  return { met, total };
}
function gatePassed(M) {
  const g = M.gates[missionGate],
    c = gateCheck(g),
    n = M.gates.length,
    ok = c.met === c.total;
  missionStats.gates++;
  missionStats.met += c.met;
  missionStats.total += c.total;
  const note = c.total ? (ok ? ' · 조건 충족' : ` · 조건 ${c.met}/${c.total}`) : '';
  missionGate++;
  if (missionGate < n) {
    setGateTarget();
    msg(`게이트 ${missionGate}/${n} 통과${note} — 다음: ${M.gates[missionGate].ko}`, ok ? '#52ffc0' : '#ffd36b');
    tone(660, 0.12, 'sine', 0.05, 880);
  } else {
    missionPhase = M.finalPhase;
    missionTarget = V(0, 180, 0);
    placeMissionMarker(missionTarget, 0xffc857);
    msg(`게이트 ${n}/${n} 통과${note} — ${M.finalMsg}`, '#ff4');
    tone(660, 0.12, 'sine', 0.05, 880);
  }
}
function completeMission(M) {
  missionComplete = true;
  missionElapsed = Math.max(0, t - missionStartTime);
  missionPhase = 'complete';
  missionResult = M.score();
  missionResult.lines.push(['피격 횟수', missionStats.hits]);
  missionResult.rec = PROG.record(M.id, missionResult.rank, missionResult.score, missionElapsed);
  if (M.campaign) missionResult.camp = campOnComplete(M, missionResult);
  msg(`${M.label} 성공 — 랭크 ${missionResult.rank}`, '#52ffc0');
  end(`${M.label} ${M.title} — COMPLETE`);
}
function failMission(reason = '기체 손실') {
  if (missionFailed || missionComplete || (!isAirbase() && !curM().campaign)) return;
  missionFailed = true;
  missionElapsed = Math.max(0, t - (missionStartTime || 0));
  missionPhase = 'failed';
  missionResult = {
    score: 0,
    rank: 'C',
    lines: [
      ['결과', '실패'],
      ['실패 사유', reason],
      ['비행 시간', fmtTime(missionElapsed)],
      ['피격 횟수', missionStats.hits],
      ['점수', 0],
    ],
    rec: { first: false, better: false },
  };
  msg(`${curM().label} 실패 — ${reason}`, '#ff8b7a');
  end(`${curM().label} ${curM().title} — FAILED`);
}
function missionUpdate(dt) {
  const M = curM();
  if (M.env !== 'AIRBASE' || M.isComplete() || M.isFailed() || S !== 'play') return;
  if (missionMarker) missionMarker.rotation.z += dt * 0.35;
  if (
    (missionPhase === 'waypoint' || missionPhase === 'approach') &&
    missionTarget &&
    p.pos.distanceTo(missionTarget) < (M.gates[missionGate].r || GATE_R)
  )
    gatePassed(M);
  if (isFinalPhase() && airbaseOps.phase === 'landed' && !missionComplete) completeMission(M);
}
function gateReq(g) {
  const a = [];
  if (g.alt)
    a.push(
      g.alt[1] > 1e8 ? `고도 ≥${g.alt[0]}m` : g.alt[0] <= 0 ? `고도 ≤${g.alt[1]}m` : `고도 ${g.alt[0]}–${g.alt[1]}m`
    );
  if (g.spd) a.push(`속도 ${kmh(g.spd[0])}–${kmh(g.spd[1])} km/h`);
  if (g.cfg) a.push('기어 DOWN · 플랩 MID+');
  return a.join(' · ');
}
// 현재 웨이포인트 · 진입 게이트에 대한 짧은 실시간 안내.
// These are game HUD cues only; they do not alter flight physics or gate scoring.
function missionGuidanceText() {
  const M = curM();
  if (!p || M.env !== 'AIRBASE' || !missionTarget || missionComplete || missionFailed) return '';
  const dx = missionTarget.x - p.pos.x,
    dz = missionTarget.z - p.pos.z;
  const bearing = (Math.atan2(dx, -dz) / D + 360) % 360,
    f = p.fwd();
  const heading = (Math.atan2(f.x, -f.z) / D + 360) % 360;
  const delta = ((bearing - heading + 540) % 360) - 180;
  const steer = Math.abs(delta) <= 7 ? '방향 유지' : `선회 ${delta > 0 ? '우' : '좌'} ${Math.round(Math.abs(delta))}°`;
  const range = p.pos.distanceTo(missionTarget) / 1000;
  const cues = [steer, `목표 ${range.toFixed(1)}km`];
  const active = missionPhase === 'waypoint' || missionPhase === 'approach' ? M.gates?.[missionGate] : null;
  if (active) {
    if (active.alt) {
      const lo = active.alt[0],
        hi = active.alt[1];
      if (p.pos.y < lo) cues.push(`상승 ${Math.ceil(lo - p.pos.y)}m`);
      else if (hi < 1e8 && p.pos.y > hi) cues.push(`강하 ${Math.ceil(p.pos.y - hi)}m`);
      else cues.push('고도 충족');
    }
    if (active.spd) {
      if (p.speed < active.spd[0]) cues.push('속도 증가');
      else if (p.speed > active.spd[1]) cues.push('속도 감소');
      else cues.push('속도 충족');
    }
    if (active.cfg) {
      const missing = [];
      if (!p.gearDown) missing.push('기어 DOWN');
      if (p.flap < 1) missing.push('플랩 MID+');
      cues.push(missing.length ? missing.join(' · ') : '착륙 형상 충족');
    }
  } else if (isFinalPhase()) {
    cues.push(M.id === 'T02' ? '활주로 최종 접근' : '비행장 귀환');
  }
  return cues.join('  |  ');
}
function missionHintTextLegacy() {
  const M = curM();
  if (M.env !== 'AIRBASE') return '';
  if (missionPhase === 'waypoint' || missionPhase === 'approach') {
    const g = M.gates && M.gates[missionGate]; // S-00 샌드박스는 게이트가 없다
    return g ? gateReq(g) : '';
  }
  return '';
}
function missionObjectiveTextLegacy() {
  const M = curM();
  if (M.env !== 'AIRBASE') return '';
  if (M.category === 'SANDBOX') return '자유비행 — 지형·지상 위협 시스템 테스트';
  if ((missionPhase === 'waypoint' || missionPhase === 'approach') && M.gates && M.gates[missionGate])
    return `게이트 ${missionGate + 1}/${M.gates.length} — ${M.gates[missionGate].ko}`;
  return (
    {
      'preflight': '활주로 점검 — Shift 이륙',
      'takeoff': '이륙 활주',
      'return': '비행장 귀환 및 활주로 착륙',
      'final': '최종 접근 — 중심선 정렬 후 착륙',
      'complete': '임무 완료',
      'failed': '임무 실패',
    }[missionPhase] || '임무 진행'
  );
}
function missionHintText() {
  return curM().hud().hint || '';
}
function missionObjectiveText() {
  return curM().hud().objective || '';
}
