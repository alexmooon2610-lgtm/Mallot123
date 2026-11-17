// ---------- 열/IR 계산 (게임용)
function heatOf(o, from) {
  if (o.isF) return 3.2 * (1 - (0.5 * o.age) / o.life);
  const dv = from.clone().sub(o.pos).normalize();
  return (0.8 + 0.5 * o.thr + 0.9 * (o.ab ? 1 : 0)) * (0.4 + 0.6 * Math.max(0, -o.fwd().dot(dv)));
}
function heatScore(o, from, fwd, cone) {
  const d = o.pos.clone().sub(from),
    r = d.length();
  if (r < 1e-3) return 0;
  const a = Math.acos(clamp(fwd.dot(d.divideScalar(r)), -1, 1)) / D;
  return a > cone ? 0 : (heatOf(o, from) / (1 + (r / 3500) ** 2)) * (1 - (0.5 * a) / cone);
}
// ---------- 미사일 유도
//  - SARH(R-27R · AIM-7): 쏜 쪽 레이더가 표적을 계속 락(조사)하고 있어야 반사파를 따라간다.
//    조사가 끊기면 마지막으로 본 위치 · 속도로 MSL_MEM 초 동안 관성 비행하고, 그 뒤로는 직진한다.
//    락이 돌아오면 시커 시야 안에 있을 때 다시 따라간다.
//  - IR(R-73 · AIM-9): 발사 뒤에는 미사일 자체 시커로만 쫓는다 (쏜 쪽 IR 락은 더 필요 없다).
//    락 없이 쏘면 시커가 시야 안의 열원을 스스로 찾아 문다. 플레어에 속은 미사일은 다시 찾지 않는다.
//  - 두 시커 모두 시야(짐벌 한계) 밖의 표적은 볼 수 없다.
//  - 유도는 비례항법. 횡가속도는 P[type].g 로 제한하고, 느리거나 공기가 희박하면 그만큼 덜 꺾인다.
//    세게 꺾을수록 속도를 잃는다.
const GRAV = 9.81,
  MSL_PN = 4, // 비례항법 상수
  MSL_ARM = 0.35, // 발사 직후 기체에서 떨어지는 동안은 조종하지 않는다 (s)
  MSL_MEM = 2.5, // SARH 조사가 끊긴 뒤 관성 비행 시간 (s)
  MSL_IR_KEEP = 0.06, // IR 시커가 표적을 계속 무는 최소 열 신호
  MSL_IR_ACQ = 0.15, // IR 시커가 새로 표적을 무는 최소 열 신호
  MSL_IND_DRAG = 0.06; // 횡가속 1 m/s² 당 추가 감속 (m/s²)
// 대응수단 기만 확률 상한 (연속 살포로 오르는 확률이 100% 에 수렴하지 않게)
const CM_MAX_CHANCE = 0.65;
function velOf(o) {
  return o.vel ? o.vel.clone() : o.vd ? o.vd.clone().multiplyScalar(o.speed || 0) : V();
}
// 시커 시야 안인가 (미사일 진행 방향 기준 반각 gimbal°)
function mslInView(m, pos, gimbal) {
  const d = pos.clone().sub(m.pos),
    r = d.length();
  return r < 1 || m.dir.dot(d.divideScalar(r)) >= Math.cos(gimbal * D);
}
// 지금 낼 수 있는 최대 횡가속도 (m/s²): 동압(속도² × 공기 밀도)에 비례, 최대 g 까지
function mslMaxAcc(m, pr) {
  const rho = Math.exp(-Math.max(0, m.pos.y) / 8500);
  return pr.g * GRAV * clamp((m.spd / pr.vq) ** 2 * rho, 0.15, 1);
}
// 비례항법 명령 가속도: 시선(LOS)이 도는 쪽으로 N × 접근속도 × 시선각속도. 진행 방향 성분은 뺀다.
function pnAccel(m, tPos, tVel) {
  const rel = tPos.clone().sub(m.pos),
    r = rel.length();
  if (r < 1) return V();
  const los = rel.divideScalar(r),
    vrel = tVel.clone().addScaledVector(m.dir, -m.spd),
    vc = -los.dot(vrel),
    a = vrel.addScaledVector(los, vc).multiplyScalar((MSL_PN * Math.max(vc, 60)) / r);
  return a.addScaledVector(m.dir, -a.dot(m.dir));
}
// 플레이어 미사일의 유도 상태가 바뀔 때만 한 번 알린다
function mslNote(m, s, c = '#fa4') {
  if (m.note === s) return;
  m.note = s;
  if (m.side === 'P' && s) msg(s, c);
}
function sarhIlluminated(m) {
  const sh = m.sh,
    tg = m.tg;
  if (!sh || sh.hp <= 0 || !tg || tg.hp <= 0) return false;
  if (sh === p) return !!(rd.on && rd.lock && rd.lock.tg === tg);
  return tg === p && !!sh.rd && sh.rd.phase === 'LOCK';
}
// SARH: 조준점(위치 · 속도)을 돌려준다. 없으면 null (직진)
function sarhGuide(m, pr, dt) {
  m.guided = false;
  if (m.cmLost > 0) {
    m.cmLost = Math.max(0, m.cmLost - dt);
    return null;
  }
  const tg = m.tg;
  if (!tg || tg.hp <= 0) return null;
  if (!mslInView(m, tg.pos, pr.gimbal)) {
    m.tg = null;
    mslNote(m, 'SARH — 표적이 미사일 시커 시야를 벗어남');
    return null;
  }
  if (sarhIlluminated(m)) {
    m.guided = true;
    m.memT = 0;
    m.memPos = tg.pos.clone();
    m.memVel = velOf(tg);
    mslNote(m, '');
    return { pos: tg.pos, vel: m.memVel };
  }
  if (!m.memPos) return null;
  m.memT += dt;
  if (m.memT > MSL_MEM) {
    mslNote(m, 'SARH — 레이더 조사 끊김, 유도 상실');
    return null;
  }
  mslNote(m, 'SARH — 레이더 조사 끊김, 관성 비행 중 (락을 되찾아라)');
  return { pos: m.memPos.clone().addScaledVector(m.memVel, m.memT), vel: m.memVel };
}
// IR: 미사일 자체 시커. 표적을 물고 있으면 따라가고, 없으면 시야 안에서 찾는다
function irGuide(m, pr, dt) {
  if (m.decoyTarget) {
    const f = m.decoyTarget;
    if (m.decoyUntil > t && f.age < f.life && mslInView(m, f.pos, pr.gimbal)) return { pos: f.pos, vel: velOf(f) };
    m.decoyTarget = null;
    m.tg = null;
    m.guided = false;
    m.seduced = true;
  }
  const tg = m.tg;
  if (tg && tg.hp > 0 && mslInView(m, tg.pos, pr.gimbal) && heatScore(tg, m.pos, m.dir, pr.gimbal) > MSL_IR_KEEP) {
    m.guided = true;
    return { pos: tg.pos, vel: velOf(tg) };
  }
  if (tg) mslNote(m, 'IR — 표적이 미사일 시커 시야를 벗어남');
  m.tg = null;
  m.guided = false;
  if (m.seduced || (m.scanT -= dt) > 0) return null;
  m.scanT = 0.1;
  let best = null,
    bs = MSL_IR_ACQ;
  for (const a of [p, ...es]) {
    if (a.side === m.side || a.hp <= 0 || a.pos.distanceTo(m.pos) > pr.seek) continue;
    const sc = heatScore(a, m.pos, m.dir, pr.gimbal);
    if (sc > bs) {
      bs = sc;
      best = a;
    }
  }
  if (!best) return null;
  m.tg = best;
  m.guided = true;
  mslNote(m, 'IR — 미사일 시커가 표적을 물었다', '#ff4');
  return { pos: best.pos, vel: velOf(best) };
}
// 명중 예상 시간 (s). 표적이 없거나 멀어지고 있으면 null
function mslTTI(m) {
  const tg = m.tg;
  if (!tg) return null;
  const rel = tg.pos.clone().sub(m.pos),
    r = rel.length(),
    vc = m.spd - velOf(tg).dot(rel.divideScalar(Math.max(r, 1)));
  return vc > 30 ? r / vc : null;
}
// HUD 용 유도 상태: [상태, 명중 예상 시간]
function mslStatus(m) {
  if (m.type === 'SARH') {
    if (m.guided) return ['ILLUM', mslTTI(m)];
    if (m.cmLost > 0) return ['CHAFF', null];
    if (m.tg && m.memPos && m.memT <= MSL_MEM) return ['MEMORY', null];
    return ['LOST', null];
  }
  if (m.decoyTarget) return ['DECOYED', null];
  if (m.guided && m.tg) return ['TRACK', mslTTI(m)];
  return [m.seduced ? 'LOST' : 'SEARCH', null];
}
function fire(ac, ty, tg) {
  // 발사 때 넘겨받은 표적은 시작점일 뿐이다. 그 뒤로는 시커가 보는 대로 따라간다 (sarhGuide · irGuide).
  const lockedTarget = tg && tg.hp > 0 ? tg : null;
  const startPos = ac.pos
    .clone()
    .addScaledVector(ac.fwd(), 28)
    .add(V(0, -3, 0));
  const m = {
    sh: ac,
    side: ac.side,
    type: ty,
    pos: startPos.clone(),
    startPos: startPos.clone(),
    dir: ac.fwd(),
    spd: ac.speed + 20,
    age: 0,
    tg: lockedTarget,
    originalTarget: lockedTarget,
    mesh: mslMesh(ac, ty),
    tp: 0,
    guided: !!lockedTarget,
    gNow: 0,
    memPos: lockedTarget ? lockedTarget.pos.clone() : null,
    memVel: lockedTarget ? velOf(lockedTarget) : V(),
    memT: 0,
    scanT: 0,
    note: '',
    seduced: false,
    cmN: 0,
    cmLast: -Infinity,
    decoyTarget: null,
    decoyUntil: 0,
    cmLost: 0,
  };
  scene.add(m.mesh);
  ms.push(m);
  ac.am[ty]--;
  ac.cd = 1.5;
  if (ac === p) {
    tone(300, 0.35, 'sawtooth', 0.04, 90);
    launchSnd();
    msg(
      ty === 'SARH'
        ? 'SARH 발사 — 명중까지 레이더 락을 유지하라'
        : lockedTarget
          ? 'IR 발사 — 발사 후 망각, 미사일 시커가 추적'
          : 'IR 무락 발사 — 미사일 시커가 표적 탐색'
    );
  }
}
function updMsl(m, dt) {
  const pr = P[m.type];
  m.age += dt;
  m.spd = m.age < pr.boost ? Math.min(pr.v, m.spd + 220 * dt) : m.spd * (1 - 0.05 * dt);
  const aim = m.type === 'IR' ? irGuide(m, pr, dt) : sarhGuide(m, pr, dt);
  m.gNow = 0;
  if (aim && m.age > MSL_ARM) {
    const a = pnAccel(m, aim.pos, aim.vel),
      lim = mslMaxAcc(m, pr),
      mag = a.length();
    if (mag > lim) a.multiplyScalar(lim / mag);
    const lat = Math.min(mag, lim);
    m.dir.multiplyScalar(m.spd).addScaledVector(a, dt).normalize();
    m.spd -= lat * MSL_IND_DRAG * dt;
    m.gNow = lat / GRAV;
  }
  m.pp = m.pos.clone();
  m.pos.addScaledVector(m.dir, m.spd * dt);
  m.mesh.position.copy(m.pos);
  m.mesh.quaternion.setFromUnitVectors(V(0, 0, -1), m.dir);
  if ((m.tp -= dt) <= 0) {
    m.tp = 0.05;
    puff(m.pos.clone().addScaledVector(m.dir, -6), 0xd6dce0, m.side == 'P' ? 12 : 14, 0.6, 1.4); // 비행운은 38-trails-fx
  }
  for (const a of [p, ...es])
    if (a.side != m.side && a.hp > 0 && segHit(a, m.pp, m.pos, 16)) {
      boom(m.pos, 60);
      m.dead = 1;
      if (a !== p) msg('명중!', '#ff4');
      if (a.drone) a.lastHit = m.type;
      weaponKill(a);
      return;
    }
  if (m.type === 'IR')
    for (const f of fl)
      if (f.side != m.side && m.pos.distanceTo(f.pos) < 40) {
        boom(m.pos, 25);
        f.age = 99;
        m.dead = 1;
        if (m.side === 'P') msg('IR 미사일이 플레어에 속음', '#fa4');
        return;
      }
  if (m.age > pr.life || (m.age > pr.boost && m.spd < 170) || m.pos.y < 0) {
    m.dead = 1;
    puff(m.pos, 0xb7bec4, 44, 1.4, 1.65);
    if (m.side === 'P') msg(m.type + ' 비행 종료 — 빗나감', '#fa4');
  }
}
// 무기에 맞아 격추될 때: 모의전 임무(mockKill)는 폭발 대신 판정만 낸다. 추락·충돌은 kill 을 바로 부른다.
function weaponKill(a) {
  if (curM().mockKill && curM().mockKill(a)) return;
  kill(a);
}
function kill(a) {
  if (a.dead) return;
  a.hp = 0;
  a.dead = 1;
  boom(a.pos, 130);
  if (a === p) {
    if (isAirbase() || curM().campaign) failMission('기체 손실');
    else end(`SHOT DOWN — WAVE ${wv} · KILLS ${kills}`);
  } else {
    kills++;
    scene.remove(a.mesh);
    es = es.filter(x => x !== a);
    rd.ct = rd.ct.filter(c => c.tg !== a);
    if (rd.sel && rd.sel.tg === a) rd.sel = null;
    if (rd.lock && rd.lock.tg === a) rd.lock = null;
    if (sk.tg === a) {
      sk.st = 'SEARCH';
      sk.tg = null;
    }
    if (curM().onKill) curM().onKill(a);
    if (!es.length && curM().waves !== false) {
      // V14.8.0: 공중 재보급 삭제 (예전엔 웨이브마다 미사일 +2 · 기총 +50 · 플레어/채프 +8 · 체력 +30%, 미사일은 6발까지).
      // 보급은 항모 착함(42-carrier-ops 의 serve)으로만 받는다. 다음 웨이브까지 WAVE_GAP 초 — 비행 중에만 흐른다(90-main-loop).
      wt = WAVE_GAP;
      msg(`WAVE ${wv} 격파 — 다음 웨이브까지 ${WAVE_GAP}초 · 보급은 항모 착함`, '#ff4');
    }
  }
}
// 웨이브 사이 시간 (초). 착함해 보급받는 동안(갑판 위)은 멈춘다 — 보급이 끝나고 다시 발진해야 흐른다
const WAVE_GAP = 30;
function end(s) {
  S = 'over';
  over = s;
  showOv();
}
function countermeasureAttempt(a, type) {
  const result = { engaged: 0, success: 0, failed: 0 };
  for (const m of ms) {
    if (m.dead || m.tg !== a || m.side === a.side || m.type !== type) continue;
    // 이미 채프로 표적을 놓친 SARH 는 다시 판정하지 않는다 (예전에는 살포할 때마다 4.5초 블라인드가
    // 계속 연장돼, 0.7초마다 채프를 뿌리는 적기에게 SARH 가 사실상 명중할 수 없었다)
    if (type === 'SARH' && m.cmLost > 0) continue;
    let decoy = null;
    if (type === 'IR') {
      decoy = fl
        .filter(f => f.side === a.side && f.isF && f.pos.distanceTo(m.pos) < 9000 && mslInView(m, f.pos, P.IR.gimbal))
        .sort((u, v) => u.pos.distanceTo(m.pos) - v.pos.distanceTo(m.pos))[0];
      if (!decoy) continue;
    }
    result.engaged++;
    if (m.cmN === undefined || t - m.cmLast > 2.5) m.cmN = 0;
    m.cmN++;
    m.cmLast = t;
    // 연달아 뿌릴수록 기만 확률이 오른다 (첫 발 45% → 다음부터 65%).
    // 예전에는 주사위를 첫 살포 때 한 번만 굴리고 고정해서, 그 값이 0.65 를 넘은 미사일(약 35%)은
    // 플레어·채프를 아무리 뿌려도 절대 속지 않았다. 이제 살포마다 새로 굴린다.
    const chance = Math.min(CM_MAX_CHANCE, 1 - Math.pow(0.55, m.cmN));
    if (rnd() < chance) {
      if (type === 'IR') {
        m.decoyTarget = decoy;
        m.decoyUntil = t + 4;
        m.tg = decoy;
        m.guided = true;
      } else {
        m.guided = false;
        m.cmLost = 4.5;
      }
      result.success++;
      m.cmN = 0;
      m.cmLast = -Infinity;
    } else result.failed++;
  }
  return result;
}
function reportCountermeasure(a, type, result) {
  if (a !== p) return;
  const label = type === 'IR' ? 'FLARE' : 'CHAFF',
    left = type === 'IR' ? a.fl : a.ch;
  let detail = 'NO MATCHED THREAT';
  if (result.engaged && result.success === result.engaged)
    detail = `DECOY EFFECTIVE ${result.success}/${result.engaged}`;
  else if (result.success) detail = `PARTIAL EFFECT ${result.success}/${result.engaged}`;
  else if (result.engaged) detail = `NO EFFECT ${result.failed}/${result.engaged}`;
  cmHud = { type: label, until: t + 2.8, text: `${label} · ${detail} · ${left} LEFT` };
  const color = result.success ? '#9cf' : result.engaged ? '#fa4' : '#9cf';
  msg(`${label} RELEASED · ${detail} · ${left} LEFT`, color);
}
function flare(a) {
  if (a.fl <= 0) return false;
  a.fl--;
  for (let i = 0; i < 3; i++) {
    const s = getSprite(0xffd06a, 1);
    s.scale.set(FLARE_SIZE, FLARE_SIZE, 1);
    fl.push({
      side: a.side,
      isF: 1,
      pos: a.pos
        .clone()
        .addScaledVector(a.fwd(), -28)
        .add(V(rnd() * 26 - 13, -10 - rnd() * 10, rnd() * 26 - 13)),
      vel: a
        .fwd()
        .multiplyScalar(a.speed * 0.58)
        .add(V(rnd() * 42 - 21, -12 - rnd() * 8, rnd() * 42 - 21)),
      age: 0,
      life: 6,
      s,
    });
    flareTrail(fl[fl.length - 1]);
  }
  const result = countermeasureAttempt(a, 'IR');
  if (a === p) {
    tone(1200, 0.08, 'square', 0.04);
    reportCountermeasure(a, 'IR', result);
    samDecoy(a);
  }
  return true;
}
function chaff(a) {
  if (a.ch <= 0) return false;
  a.ch--;
  a.chT = 4;
  for (let i = 0; i < 18; i++) {
    const spread = V(rnd() * 110 - 55, rnd() * 75 - 37.5, rnd() * 110 - 55);
    // 크기만 줄였다 (rnd 호출 순서·횟수는 그대로 → 게임 난수 불변)
    puff(
      a.pos.clone().addScaledVector(a.fwd(), -34).add(spread),
      0xd8e0e0,
      (42 + rnd() * 34) * CHAFF_SCALE,
      3.8 + rnd() * 0.8,
      1.4
    );
  }
  const result = countermeasureAttempt(a, 'SARH');
  if (a === p) {
    tone(700, 0.1, 'square', 0.04);
    reportCountermeasure(a, 'SARH', result);
    samDecoy(a);
  }
  return true;
}
