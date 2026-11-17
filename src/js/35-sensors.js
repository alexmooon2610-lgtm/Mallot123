// ---------- 레이더 (플레이어)
function radarUpdate(dt) {
  if (!rd.on) return;
  const Mo = RM[rd.mode];
  rd.ph += dt * Mo.rate;
  rd.sweep = (Math.abs((((rd.ph % 2) + 2) % 2) - 1) * 2 - 1) * Mo.az;
  const inv = p.q.clone().invert();
  for (const tg of es) {
    if (tg.hp <= 0) continue;
    const rel = tg.pos.clone().sub(p.pos),
      rng = rel.length(),
      l = rel.applyQuaternion(inv),
      az = Math.atan2(l.x, -l.z) / D,
      el = Math.atan2(l.y, Math.hypot(l.x, l.z)) / D;
    let c = rd.ct.find(c => c.tg === tg);
    const fov = Math.abs(az) < Mo.az && Math.abs(el) < 40 && rng < rdRange() && l.z < 0,
      onLock = rd.lock && rd.lock.tg === tg,
      allowed = rd.mode == 2 && rd.sel ? c && rd.sel === c : true,
      beam = onLock || (rd.mode >= 2 && c && rd.sel === c) || Math.abs(az - rd.sweep) < 9;
    if (fov && beam && allowed) {
      if (!c) {
        c = { tg, tTrk: 0, st: 'DET' };
        rd.ct.push(c);
        if (!rd.sel) rd.sel = c;
        tone(1500, 0.05, 'sine', 0.06);
        msg('레이더 접촉 — 탐색(DET) 상태', '#9cf');
      }
      c.t = t;
      c.az = az;
      c.rng = rng;
      c.pos = tg.pos.clone().add(c.st == 'DET' ? V(rnd() * 300 - 150, rnd() * 200 - 100, rnd() * 300 - 150) : V());
      c.dr = c.st == 'TRK' ? rng : Math.round(rng / 1500) * 1500;
    }
    if (c) {
      if (rd.mode >= 1 && t - c.t < 1.2) c.tTrk += dt;
      else c.tTrk = 0;
      if (c.st == 'DET' && c.tTrk > 1.5) {
        c.st = 'TRK';
        tone(2000, 0.12, 'sine', 0.07);
        msg('표적 TRACK 확정 — Y 로 락 가능', '#9cf');
      }
      if (c.st == 'TRK' && (rd.mode == 0 || t - c.t > 2.5)) c.st = 'DET';
      if (t - c.t > 3.5) {
        rd.ct = rd.ct.filter(x => x !== c);
        if (rd.sel === c) rd.sel = null;
        if (rd.lock && rd.lock.c === c) rd.lock = null;
        msg('레이더 접촉 소실', '#fa4');
      }
    }
  }
  if (rd.lock) {
    const c = rd.lock.c;
    if (t - c.t > 0.6 || Math.abs(c.az) > 50 || c.rng > 14500) {
      rd.lock = null;
      c.st = 'DET';
      tone(600, 0.4, 'sine', 0.09, 250);
      msg('레이더 LOCK 상실!', '#f44');
    }
  }
  if (rd.mode == 3 && !rd.lock) {
    const q = rd.q;
    q.w -= dt;
    if (q.w > 0) return;
    if (!q.c || !rd.ct.includes(q.c)) {
      const c = rd.ct
        .filter(c => t - c.t < 1 && Math.abs(c.az) < 20)
        .sort((a, b) => Math.abs(a.az) - Math.abs(b.az))[0];
      if (c) {
        q.c = c;
        q.t = 0;
        q.st = 'ACQ';
        rd.sel = c;
      } else {
        q.st = 'SCAN';
        q.c = null;
        return;
      }
    }
    if (t - q.c.t < 0.8) {
      q.t += dt;
      if (q.t > 1.2) {
        rd.lock = { c: q.c, tg: q.c.tg };
        q.c.st = 'TRK';
        rd.mode = 2;
        q.st = '';
        q.c = null;
        tone(2400, 0.25, 'sine', 0.09);
        msg('QUICK-ACQ 성공 → 락', '#ff4');
      }
    } else {
      q.st = 'FAIL';
      q.w = 1.2;
      q.c = null;
      msg('QUICK-ACQ 실패', '#fa4');
    }
  }
}
function tryLock() {
  if (!rd.on) return rej('레이더 OFF (R)');
  if (rd.lock) {
    rd.lock = null;
    msg('락 해제');
    return;
  }
  const c = rd.sel;
  if (!c) return rej('선택 표적 없음 (Tab)');
  if (c.st != 'TRK') return rej('락 불가: TRACK 확정 필요 — T 로 MULTI-TRK 전환 후 대기');
  if (Math.abs(c.az) > 45 || t - c.t > 1) return rej('락 불가: 빔 범위 밖');
  rd.lock = { c, tg: c.tg };
  rd.mode = 2;
  tone(2400, 0.25, 'sine', 0.09);
  setTimeout(() => tone(2400, 0.2, 'sine', 0.09), 300);
  msg('레이더 LOCK 성공', '#ff4');
}
const rej = s => {
  msg(s, '#fa4');
  tone(180, 0.15, 'square', 0.05);
};
// ---------- IR 시커
function seekerUpdate(dt) {
  if (!sk.on) {
    sk.st = 'OFF';
    sk.tg = null;
    return;
  }
  const f = hmdDir(),
    cand = [...es, ...fl.filter(x => x.side == 'E')],
    lk = sk.st == 'LOCKED',
    sc = cand
      .map(o => [heatScore(o, p.pos, f, lk ? 30 : 12), o])
      .filter(a => a[0] > 0)
      .sort((a, b) => b[0] - a[0]);
  if (lk) {
    const cur = sc.find(a => a[1] === sk.tg);
    if (!cur || cur[0] < 0.1) {
      sk.st = 'SEARCH';
      sk.tg = null;
      msg('IR 락 상실 — 재탐색', '#f44');
      tone(500, 0.3, 'triangle', 0.08, 200);
    } else if (sc[0][1] !== sk.tg && sc[0][0] > cur[0] * 1.15) {
      sk.tg = sc[0][1];
      msg('IR 재획득 (신호 강한 열원)', '#fa4');
    }
  } else {
    const b = sc.find(a => a[0] > 0.2 && a[1].pos.distanceTo(p.pos) < P.IR.range);
    if (b) {
      if (sk.st != 'ACQUIRING' || sk.tg !== b[1]) {
        sk.st = 'ACQUIRING';
        sk.tg = b[1];
        sk.t = 0;
      }
      sk.t += dt;
      if (sk.t > 0.8) {
        sk.st = 'LOCKED';
        tone(900, 0.25, 'triangle', 0.1);
        msg('IR 시커 LOCK', '#ff4');
      }
    } else {
      sk.st = 'SEARCH';
      sk.tg = null;
    }
  }
  if (AC && t > sk.nx && sk.st != 'SEARCH') {
    tone(sk.st == 'LOCKED' ? 620 : 320, 0.1, 'triangle', 0.07);
    sk.nx = t + (sk.st == 'LOCKED' ? 0.13 : 0.3);
  }
}
// ---------- RWR (레이더 방사 신호만 탐지)
function rwrUpdate(dt) {
  let mx = 0;
  for (const x of es) {
    const d = x.pos.clone().sub(p.pos),
      r = d.length(),
      ang = Math.acos(clamp(x.fwd().dot(d.clone().negate().normalize()), -1, 1)) / D;
    let lvl = 0;
    if (ang < 75 && r < 30000) {
      lvl = 1;
      if (x.rd.phase != 'SEARCH') lvl = 2;
      if (x.rd.phase == 'LOCK' && ms.some(m => m.sh === x && m.type == 'SARH' && m.guided && !m.dead)) lvl = 3;
    }
    const l = d.applyQuaternion(p.q.clone().invert());
    x.brg = Math.atan2(l.x, -l.z) / D;
    if (lvl >= (x.rwl | 0)) {
      if (lvl > (x.rwl | 0))
        msg(
          ['', 'RWR: 레이더 신호 탐지', 'RWR: 추적 경고', 'RWR: 발사 경고!!'][lvl],
          ['', '#fe4', '#fa4', '#f44'][lvl]
        );
      x.rwl = lvl;
      x.rwh = 1.2;
    } else {
      x.rwh -= dt;
      if (x.rwh <= 0) x.rwl = lvl;
    }
    mx = Math.max(mx, x.rwl | 0);
  }
  rw.lvl = mx;
  if (rw.lvl && t >= rw.nx) {
    if (rw.lvl == 1) {
      tone(880, 0.1, 'square', 0.05);
      rw.nx = t + 2.2;
    } else if (rw.lvl == 2) {
      tone(1250, 0.07, 'square', 0.06);
      setTimeout(() => tone(1250, 0.07, 'square', 0.06), 130);
      rw.nx = t + 0.75;
    } else {
      tone(rw.alt ? 1900 : 1300, 0.1, 'sawtooth', 0.08);
      rw.alt = !rw.alt;
      rw.nx = t + 0.14;
    }
  }
}
