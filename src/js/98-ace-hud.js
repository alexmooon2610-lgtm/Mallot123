// ===== ACE HUD: 전체 화면 비행 HUD (에이스 컴뱃 풍) =====
// 화면 아래 계기 패널을 없애고 3D 를 전체 화면으로 쓴다. 표시만 바꾸며 게임 판정은 그대로다.
// 콕핏/외부 시점 모두 같은 레이아웃: 위 방위 테이프 · 좌 속도 테이프 · 우 고도 테이프 · 오른쪽 아래 레이더 · 무장.
const AH = {
  c: '#8cffb4',
  dim: 'rgba(140,255,180,.5)',
  faint: 'rgba(140,255,180,.22)',
  red: '#ff5048',
  amb: '#ffc04d',
  cyan: '#8fd8ff',
  white: '#eef8f2',
  killT: -99,
  kills: 0,
  hitT: -99,
};
const ahFont = (s, w = 600) => `${w} ${s}px "Segoe UI","Roboto Condensed","Helvetica Neue",Arial,sans-serif`;
function aT(s, x, y, c = AH.c, al = 'left', sz = 14, w = 600) {
  g.fillStyle = c;
  g.textAlign = al;
  g.font = ahFont(sz, w);
  g.fillText(s, x, y);
}
function ahGlow(on, col = 'rgba(90,255,160,.55)') {
  g.shadowColor = on ? col : 'transparent';
  g.shadowBlur = on ? 7 : 0;
}
function ahLine(x0, y0, x1, y1) {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
}
// 화면 밖 표적: 화면 가장자리 화살표
function ahEdge(pos, col, label) {
  const q = pos.clone().project(cam),
    behind = q.z > 1;
  let x = q.x,
    y = q.y;
  if (behind) {
    x = -x;
    y = -y;
  }
  if (!behind && Math.abs(x) < 0.94 && Math.abs(y) < 0.9) return false;
  const a = Math.atan2(y, x),
    k = 0.9 / Math.max(Math.abs(Math.cos(a)) / 0.96, Math.abs(Math.sin(a)) / 0.88, 1e-3),
    sx = ((Math.cos(a) * k + 1) / 2) * W,
    sy = ((1 - Math.sin(a) * k) / 2) * VH;
  g.save();
  g.translate(sx, sy);
  g.rotate(-a);
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(14, 0);
  g.lineTo(-6, -9);
  g.lineTo(-2, 0);
  g.lineTo(-6, 9);
  g.closePath();
  g.fill();
  g.restore();
  if (label)
    aT(
      label,
      clamp(sx - Math.cos(a) * 30, 40, W - 40),
      clamp(sy + Math.sin(a) * 26 + 4, 20, VH - 10),
      col,
      'center',
      11
    );
  return true;
}
// 표적 브래킷 (네 모서리)
function ahBracket(x, y, z, col, lw = 1.6) {
  const k = z * 0.45;
  g.strokeStyle = col;
  g.lineWidth = lw;
  g.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    g.moveTo(x + sx * z, y + sy * (z - k));
    g.lineTo(x + sx * z, y + sy * z);
    g.lineTo(x + sx * (z - k), y + sy * z);
  }
  g.stroke();
}
// 세로 테이프 (속도/고도)
function ahTape(x, cy, val, step, major, label, unit, right, col) {
  const h = Math.min(250, VH * 0.36),
    pxPer = h / (step * 10);
  g.save();
  g.beginPath();
  g.rect(right ? x - 4 : x - 70, cy - h / 2, 74, h);
  g.clip();
  g.strokeStyle = AH.dim;
  g.lineWidth = 1;
  const base = Math.floor(val / step) * step;
  for (let v = base - step * 7; v <= base + step * 7; v += step) {
    if (v < 0) continue;
    const y = cy - (v - val) * pxPer,
      big = v % major === 0,
      len = big ? 12 : 6;
    ahLine(x, y, right ? x + len : x - len, y);
    if (big) aT(String(v), right ? x + 16 : x - 16, y + 4, AH.dim, right ? 'left' : 'right', 11, 500);
  }
  g.restore();
  g.strokeStyle = col;
  g.lineWidth = 1.2;
  ahLine(x, cy - h / 2, x, cy + h / 2);
  // 현재값 상자
  const bw = 78,
    bx = right ? x + 6 : x - 6 - bw;
  g.fillStyle = 'rgba(0,18,10,.55)';
  g.fillRect(bx, cy - 15, bw, 30);
  g.strokeStyle = col;
  g.lineWidth = 1.6;
  g.beginPath();
  if (right) {
    g.moveTo(x, cy);
    g.lineTo(bx, cy - 15);
    g.lineTo(bx + bw, cy - 15);
    g.lineTo(bx + bw, cy + 15);
    g.lineTo(bx, cy + 15);
  } else {
    g.moveTo(x, cy);
    g.lineTo(bx + bw, cy - 15);
    g.lineTo(bx, cy - 15);
    g.lineTo(bx, cy + 15);
    g.lineTo(bx + bw, cy + 15);
  }
  g.closePath();
  g.stroke();
  aT(String(Math.max(0, Math.round(val))), bx + bw / 2, cy + 7, col, 'center', 20, 700);
  aT(label, right ? bx : bx + bw, cy - h / 2 - 10, AH.c, right ? 'left' : 'right', 12, 700);
  aT(unit, right ? bx + bw : bx, cy + 30, AH.dim, right ? 'right' : 'left', 10, 500);
}
// 콕핏 HUD 용 작은 값 상자 (속도 · 고도)
function ahBox(x, y, val, label, right, col) {
  const bw = 62,
    bx = right ? x - bw : x;
  g.strokeStyle = col;
  g.lineWidth = 1.5;
  g.strokeRect(bx, y - 13, bw, 26);
  aT(String(Math.max(0, Math.round(val))), bx + bw / 2, y + 6, col, 'center', 17, 700);
  aT(label, right ? bx + bw : bx, y - 18, AH.c, right ? 'right' : 'left', 10, 700);
}
// 방위 테이프
function ahHeading(cx, y, hdg, wMax = 420) {
  const w = Math.min(wMax, W * 0.42),
    pxPer = w / 60;
  g.save();
  g.beginPath();
  g.rect(cx - w / 2, y - 22, w, 40);
  g.clip();
  g.strokeStyle = AH.dim;
  g.lineWidth = 1;
  const base = Math.floor(hdg / 5) * 5;
  for (let h = base - 40; h <= base + 40; h += 5) {
    const x = cx + (h - hdg) * pxPer,
      hh = ((h % 360) + 360) % 360,
      big = hh % 10 === 0;
    ahLine(x, y, x, y + (big ? 9 : 5));
    if (big) {
      const n = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[hh];
      aT(n || String(hh / 10).padStart(2, '0'), x, y - 4, n ? AH.c : AH.dim, 'center', n ? 13 : 11, n ? 700 : 500);
    }
  }
  g.restore();
  g.strokeStyle = AH.c;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx, y + 12);
  g.lineTo(cx - 6, y + 20);
  g.lineTo(cx + 6, y + 20);
  g.closePath();
  g.stroke();
  aT(String(Math.round(hdg) % 360).padStart(3, '0'), cx, y + 36, AH.c, 'center', 13, 700);
}
// 원형 레이더 미니맵 (기수 방향이 위)
function ahRadar(cx, cy, r) {
  const f = p.fwd(),
    hl = Math.hypot(f.x, f.z) || 1,
    hx = f.x / hl,
    hz = f.z / hl,
    range = rd && rd.on ? rdRange() : 12000,
    sc = r / range;
  const toMap = pos => {
    const dx = pos.x - p.pos.x,
      dz = pos.z - p.pos.z;
    return { x: cx + (dx * -hz + dz * hx) * sc, y: cy - (dx * hx + dz * hz) * sc };
  };
  g.save();
  g.fillStyle = 'rgba(0,16,10,.55)';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  g.clip();
  g.strokeStyle = AH.faint;
  g.lineWidth = 1;
  for (const k of [1 / 3, 2 / 3]) {
    g.beginPath();
    g.arc(cx, cy, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  ahLine(cx - r, cy, cx + r, cy);
  ahLine(cx, cy - r, cx, cy + r);
  // 레이더 탐색 범위 부채꼴
  if (rd && rd.on) {
    const az = RM[rd.mode].az * D;
    g.fillStyle = 'rgba(140,255,180,.07)';
    g.beginPath();
    g.moveTo(cx, cy);
    g.arc(cx, cy, r, -Math.PI / 2 - az, -Math.PI / 2 + az);
    g.closePath();
    g.fill();
  }
  // 항모 / 지상 위협
  if (!isAirbase() && CV) {
    const s = toMap(CV.position);
    g.fillStyle = AH.cyan;
    g.fillRect(s.x - 5, s.y - 3, 10, 6);
  }
  if (isAirbase())
    for (const site of GROUND_THREATS) {
      const s = toMap(site.origin);
      g.strokeStyle = AH.amb;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(s.x, s.y - 6);
      g.lineTo(s.x + 6, s.y + 5);
      g.lineTo(s.x - 6, s.y + 5);
      g.closePath();
      g.stroke();
    }
  // 적기
  for (const e of es) {
    const s = toMap(e.pos),
      ef = e.fwd(),
      a = Math.atan2(ef.x * -hz + ef.z * hx, ef.x * hx + ef.z * hz),
      locked = rd && rdLockedTg(e);
    g.save();
    g.translate(s.x, s.y);
    g.rotate(a);
    g.fillStyle = locked ? '#ff8a80' : AH.red;
    g.beginPath();
    g.moveTo(0, -7);
    g.lineTo(5, 5);
    g.lineTo(-5, 5);
    g.closePath();
    g.fill();
    g.restore();
  }
  // 미사일
  for (const m of ms) {
    if (m.dead) continue;
    const s = toMap(m.pos);
    g.fillStyle = m.side == 'P' ? AH.white : AH.red;
    g.beginPath();
    g.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.strokeStyle = AH.dim;
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.stroke();
  // 자기 기체
  g.fillStyle = AH.c;
  g.beginPath();
  g.moveTo(cx, cy - 7);
  g.lineTo(cx + 5, cy + 6);
  g.lineTo(cx, cy + 3);
  g.lineTo(cx - 5, cy + 6);
  g.closePath();
  g.fill();
  aT((range / 1000).toFixed(0) + ' km', cx + r - 4, cy + r - 4, AH.dim, 'right', 10, 500);
  aT(rd && rd.on ? RM[rd.mode].n : 'RDR OFF', cx, cy - r - 8, rd && rd.on ? AH.c : AH.dim, 'center', 11, 700);
}

function aceHud(mode) {
  g.clearRect(0, 0, W, H);
  if (!p) return;
  const cockpit = mode === 'cockpit',
    cx = W / 2,
    cy = VH / 2,
    small = W < 760,
    f = p.fwd(),
    up = V(0, 1, 0).applyQuaternion(p.q),
    rtv = V(1, 0, 0).applyQuaternion(p.q),
    pitch = Math.asin(clamp(f.y, -1, 1)) / D,
    hdg = (Math.atan2(f.x, -f.z) / D + 360) % 360,
    bank = Math.atan2(-rtv.y, up.y),
    blink = ((t * 4) | 0) % 2 === 0;
  g.save();
  g.lineCap = 'round';
  ahGlow(true);

  // ---------- 피치 사다리 (콕핏) / 기수 표시 (외부 시점)
  // 콕핏: HUD 결합유리의 화면 사각형 (60-cockpit). 비행 기호는 이 안에만 그린다
  const hr = cockpit ? ckHudRect() : null,
    hw = hr ? hr.x1 - hr.x0 : 0;
  if (cockpit) {
    // 사다리는 실제 수평선과 겹치도록 카메라 화각에 맞춘 도당 픽셀
    const ppd = (VH / 2 / Math.tan((cam.fov * Math.PI) / 360)) * (Math.PI / 180);
    g.save();
    g.beginPath();
    g.rect(hr.x0, hr.y0 + 30, hw, hr.y1 - hr.y0 - 30);
    g.clip();
    g.translate(cx, cy);
    g.rotate(-bank);
    g.strokeStyle = AH.c;
    g.lineWidth = 1.4;
    for (let a = -90; a <= 90; a += 5) {
      const y = -(a - pitch) * ppd;
      if (Math.abs(y) > VH * 0.5) continue;
      const w = a === 0 ? hw * 0.5 : a % 10 ? hw * 0.07 : hw * 0.17;
      g.setLineDash(a < 0 ? [7, 6] : []);
      g.beginPath();
      g.moveTo(-w, y);
      g.lineTo(-30, y);
      g.moveTo(30, y);
      g.lineTo(w, y);
      if (a !== 0 && a % 10 === 0) {
        const tick = a > 0 ? 8 : -8;
        g.moveTo(-w, y);
        g.lineTo(-w, y + tick);
        g.moveTo(w, y);
        g.lineTo(w, y + tick);
      }
      g.stroke();
      if (a && a % 10 === 0) {
        aT(String(Math.abs(a)), -w - 6, y + 4, AH.c, 'right', 11, 600);
        aT(String(Math.abs(a)), w + 6, y + 4, AH.c, 'left', 11, 600);
      }
    }
    g.setLineDash([]);
    g.restore();
    // 기수 고정 표시 (W 모양)
    g.strokeStyle = AH.c;
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(cx - 26, cy);
    g.lineTo(cx - 12, cy);
    g.lineTo(cx - 6, cy + 8);
    g.lineTo(cx, cy);
    g.lineTo(cx + 6, cy + 8);
    g.lineTo(cx + 12, cy);
    g.lineTo(cx + 26, cy);
    g.stroke();
  } else {
    const bs = proj(p.pos.clone().addScaledVector(f, 1500));
    if (bs) {
      g.strokeStyle = AH.c;
      g.lineWidth = 1.6;
      ahLine(bs.x - 16, bs.y, bs.x - 5, bs.y);
      ahLine(bs.x + 5, bs.y, bs.x + 16, bs.y);
      ahLine(bs.x, bs.y - 16, bs.x, bs.y - 5);
      ahLine(bs.x, bs.y + 5, bs.x, bs.y + 16);
    }
  }
  // 비행 경로 표시 (속도 벡터)
  {
    const s = proj(p.pos.clone().addScaledVector(p.vd, 2000));
    if (s && (!hr || (s.x > hr.x0 + 16 && s.x < hr.x1 - 16 && s.y > hr.y0 + 30 && s.y < hr.y1 - 8))) {
      g.strokeStyle = AH.c;
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(s.x, s.y, 7, 0, Math.PI * 2);
      g.stroke();
      ahLine(s.x - 7, s.y, s.x - 17, s.y);
      ahLine(s.x + 7, s.y, s.x + 17, s.y);
      ahLine(s.x, s.y - 7, s.x, s.y - 13);
    }
  }

  // ---------- 방위 / 속도 / 고도
  const spd0 = p.speed * MS2KMH,
    alt0 = p.pos.y,
    agl0 = isAirbase() ? p.pos.y - terrainHeightAt(p.pos.x, p.pos.z) : p.pos.y;
  if (cockpit) {
    ahHeading(cx, hr.y0 + 12, hdg, hw * 0.8);
    const yy = clamp(cy, hr.y0 + 70, hr.y1 - 30);
    ahBox(hr.x0 + 8, yy, spd0, 'SPEED KM/H', false, p.stl ? AH.red : p.ovs ? AH.amb : AH.c);
    ahBox(hr.x1 - 8, yy, alt0, 'ALT M', true, agl0 < 300 ? AH.amb : AH.c);
    aT(`${p.g.toFixed(1)} G`, hr.x0 + 8, yy + 34, p.g > p.prm.g * 0.85 ? AH.amb : AH.c, 'left', 11, 700);
    aT(`α ${(p.aoa / D) | 0}°`, hr.x1 - 8, yy + 34, p.aoa > 0.55 ? AH.amb : AH.c, 'right', 11, 700);
    aT(`THR ${(p.thr * 100) | 0}%${p.ab ? ' AB' : ''}`, hr.x0 + 8, hr.y1 - 8, p.ab ? AH.amb : AH.c, 'left', 11, 700);
    aT(`${p.gearDown ? 'GEAR' : ''}${p.flap ? ' FLAP' + p.flap : ''}`, hr.x1 - 8, hr.y1 - 8, AH.amb, 'right', 11, 700);
  } else ahHeading(cx, 34, hdg);
  const tapeDX = Math.min(330, W * 0.3);
  const spd = p.speed * MS2KMH,
    alt = p.pos.y,
    agl = isAirbase() ? p.pos.y - terrainHeightAt(p.pos.x, p.pos.z) : p.pos.y;
  if (!cockpit) {
    ahTape(cx - tapeDX, cy, spd, 20, 100, 'SPEED', 'KM/H', false, p.stl ? AH.red : p.ovs ? AH.amb : AH.c);
    ahTape(cx + tapeDX, cy, alt, 20, 100, 'ALT', 'M', true, agl < 300 ? AH.amb : AH.c);
    const tapeH = Math.min(250, VH * 0.36);
    aT(`THR ${(p.thr * 100) | 0}%`, cx - tapeDX - 6, cy + tapeH / 2 + 22, p.ab ? AH.amb : AH.c, 'right', 12, 700);
    if (p.ab) aT('AFTERBURNER', cx - tapeDX - 6, cy + tapeH / 2 + 38, AH.amb, 'right', 11, 700);
    aT(
      `${p.g.toFixed(1)} G`,
      cx - tapeDX - 6,
      cy - tapeH / 2 - 26,
      p.g > p.prm.g * 0.85 ? AH.amb : AH.c,
      'right',
      12,
      700
    );
    aT(`AOA ${(p.aoa / D) | 0}°`, cx + tapeDX + 6, cy - tapeH / 2 - 26, p.aoa > 0.55 ? AH.amb : AH.c, 'left', 12, 700);
    aT(
      `FLAP ${['UP', 'MID', 'FULL'][p.flap]}  GEAR ${p.gearDown ? 'DN' : 'UP'}`,
      cx + tapeDX + 6,
      cy + tapeH / 2 + 22,
      p.gearDown ? AH.amb : AH.dim,
      'left',
      11,
      600
    );
    if (hmd.on) aT(`HMD ${hmd.az | 0}/${hmd.el | 0}`, cx + tapeDX + 6, cy + tapeH / 2 + 38, AH.cyan, 'left', 11, 600);
  } else if (hmd.on) aT(`HMD ${hmd.az | 0}/${hmd.el | 0}`, hr.x1 - 8, hr.y1 - 24, AH.cyan, 'right', 11, 600);

  // ---------- 왼쪽 위: 임무 / 무전 기록
  let ly = 28;
  if (isAirbase() || curM().campaign) {
    aT(curM().label + '  ' + curM().title, 22, ly, AH.cyan, 'left', 13, 700);
    aT('OBJECTIVE  ' + missionObjectiveText(), 22, ly + 18, isFinalPhase() ? AH.amb : AH.c, 'left', 12, 600);
    const hh = missionHintText();
    if (hh) aT(hh, 22, ly + 34, AH.dim, 'left', 11, 500);
    ly += 56;
  }
  if (!small) {
    const vis = logs.filter(l => t - l.t < 6).slice(0, 4);
    vis.forEach((l, k) => {
      g.globalAlpha = clamp(1 - (t - l.t - 4.5) / 1.5, 0, 1);
      aT(l.s, 22, ly + k * 17, l.c || AH.c, 'left', 12, 500);
    });
    g.globalAlpha = 1;
  }
  // 오른쪽 위: 시간 · 격추
  const mm = String(Math.floor(t / 60)).padStart(2, '0'),
    ss = String(Math.floor(t % 60)).padStart(2, '0');
  aT(`TIME  ${mm}:${ss}`, W - 22, 28, AH.c, 'right', 14, 700);
  aT(
    isAirbase() || curM().waves === false ? `KILLS ${kills}` : `WAVE ${wv}   KILLS ${kills}`,
    W - 22,
    47,
    AH.c,
    'right',
    12,
    600
  );

  // ---------- 왼쪽 아래: 기체 상태
  {
    const x = 22,
      y = VH - 70,
      dmg = Math.round((1 - p.hp) * 100);
    // 받침판: 외부 시점에서도 깐다 (밝은 바다 · 구름 위에서 글씨가 묻혔다, V14.6.0)
    g.fillStyle = cockpit ? 'rgba(0,12,8,.5)' : 'rgba(0,12,8,.42)';
    g.fillRect(x - 10, y - 24, 210, 84);
    aT('DMG', x, y, AH.dim, 'left', 11, 600);
    aT(dmg + '%', x + 44, y, dmg >= 60 ? AH.red : dmg >= 30 ? AH.amb : AH.c, 'left', 22, 700);
    aT('FUEL', x, y + 26, AH.dim, 'left', 11, 600);
    g.strokeStyle = AH.dim;
    g.lineWidth = 1;
    g.strokeRect(x + 44, y + 17, 110, 9);
    g.fillStyle = p.fuel < 20 ? AH.amb : AH.c;
    g.fillRect(x + 45, y + 18, 108 * clamp(p.fuel / 100, 0, 1), 7);
    aT(p.fuel.toFixed(0) + '%', x + 162, y + 26, p.fuel < 20 ? AH.amb : AH.c, 'left', 11, 600);
    aT(`FLR ${p.fl}   CHF ${p.ch}`, x, y + 48, AH.cyan, 'left', 12, 600);
  }

  // ---------- 오른쪽 아래: 레이더 + 무장
  const rr = small ? 62 : Math.min(92, VH * 0.14),
    rcx = W - 22 - rr,
    rcy = VH - 22 - rr;
  ahRadar(rcx, rcy, rr);
  {
    // 콕핏에서는 계기판을 가리지 않게 레이더 위에 놓는다
    const fr = canFire(),
      x = cockpit ? W - 22 : rcx - rr - 20,
      y0 = cockpit ? rcy - rr - 96 : VH - 104;
    // 받침판: 외부 시점에서도 깐다 (밝은 바다 위에서 무장 칸 글씨가 묻혔다, V14.6.0)
    g.fillStyle = cockpit ? 'rgba(0,12,8,.5)' : 'rgba(0,12,8,.42)';
    g.fillRect(x - 134, y0 - 22, 144, 96);
    const row = (lab, val, on, i, col) => {
      const y = y0 + i * 22;
      if (on) {
        g.fillStyle = 'rgba(140,255,180,.16)';
        g.fillRect(x - 128, y - 15, 132, 20);
      }
      aT((on ? '▶ ' : '') + lab, x - 122, y, col || (on ? AH.white : AH.dim), 'left', 13, 700);
      aT(String(val), x, y, col || (on ? AH.white : AH.dim), 'right', 15, 700);
    };
    row('GUN', p.gun, false, 0, p.gun ? AH.c : AH.dim);
    row('MSL SARH', p.am.SARH, p.sel == 'SARH', 1);
    row('MSL IR', p.am.IR, p.sel == 'IR', 2);
    aT(fr[0] ? 'READY' : fr[1] || 'NOT READY', x, y0 + 66, fr[0] ? AH.amb : AH.dim, 'right', 11, 700);
    // 날아가는 내 미사일: 유도 상태 · 명중 예상 시간 (SARH 는 명중까지 레이더 락을 유지해야 한다)
    ms.filter(m => !m.dead && m.side === 'P')
      .slice(-3)
      .forEach((m, i) => {
        const [st, tti] = mslStatus(m),
          col = st === 'ILLUM' || st === 'TRACK' ? AH.white : st === 'MEMORY' || st === 'SEARCH' ? AH.amb : AH.dim;
        aT(
          `${m.type} ${st}${tti != null ? ' · ' + tti.toFixed(1) + 's' : ''}`,
          x,
          y0 - 30 - i * 16,
          col,
          'right',
          11,
          700
        );
      });
  }

  // ---------- 표적: 레이더 접촉 / 락온
  for (const c of rd.ct) {
    const L = rdLockedC(c),
      main = rd.lock && rd.lock.c === c,
      col = L ? AH.red : AH.c,
      lab = `${L ? (main || !rdMulti.length ? 'LOCK ' : 'LOCK2 ') : ''}${(c.dr / 1000).toFixed(1)}`;
    const s = proj(c.pos);
    if (!s || s.x < 0 || s.x > W || s.y < 0 || s.y > VH) {
      if (L || rd.sel === c) ahEdge(c.pos, col, lab);
      continue;
    }
    const z = L ? 20 : 15;
    g.setLineDash(c.st == 'DET' ? [4, 4] : []);
    ahBracket(s.x, s.y, z, col, L ? 2 : 1.5);
    g.setLineDash([]);
    if (L) {
      // 회전하는 락온 다이아몬드
      g.save();
      g.translate(s.x, s.y);
      g.rotate(Math.PI / 4 + Math.sin(t * 3) * 0.08);
      g.strokeStyle = AH.red;
      g.lineWidth = 1.6;
      g.strokeRect(-z - 6, -z - 6, (z + 6) * 2, (z + 6) * 2);
      g.restore();
    }
    aT(
      c.st == 'DET'
        ? 'UNKNOWN'
        : c.tg && c.tg.drone
          ? 'DRONE'
          : c.tg && c.tg.mock
            ? ACFT[c.tg.acType || 'mig'].short // 모의전 상대 · 멀티 상대 (acType 은 멀티 원격 기체만)
            : 'F-16',
      s.x + z + 6,
      s.y - z + 10,
      col,
      'left',
      11,
      700
    );
    aT(lab + (c.st == 'DET' ? ' ?' : ''), s.x + z + 6, s.y - z + 24, col, 'left', 11, 500);
    if (rd.sel === c && !L) aT('TGT', s.x, s.y - z - 6, AH.cyan, 'center', 11, 700);
  }
  // 레이더에 없는 적기는 가까우면 작은 표시만
  for (const e of es) {
    if (rd.ct.some(c => c.tg === e)) continue;
    const d = e.pos.distanceTo(p.pos);
    if (d > 6000) continue;
    const s = proj(e.pos);
    if (s && s.x > 0 && s.x < W && s.y > 0 && s.y < VH) {
      g.strokeStyle = AH.dim;
      g.lineWidth = 1;
      g.strokeRect(s.x - 6, s.y - 6, 12, 12);
    }
  }

  // ---------- 기총 조준점
  {
    let nb = null,
      nd = 2600;
    for (const q of es) {
      const d = q.pos.distanceTo(p.pos);
      if (d < nd && f.dot(q.pos.clone().sub(p.pos)) > 0) {
        nd = d;
        nb = q;
      }
    }
    if (nb) {
      let aim = nb.pos.clone();
      const ev = nb.vd.clone().multiplyScalar(nb.speed);
      for (let i = 0; i < 3; i++) aim = nb.pos.clone().addScaledVector(ev, aim.distanceTo(p.pos) / 1000);
      const s2 = proj(aim);
      if (s2) {
        g.strokeStyle = AH.amb;
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(s2.x, s2.y, 15, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.arc(s2.x, s2.y, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(1 - nd / 2600, 0, 1));
        g.lineWidth = 3;
        g.stroke();
        aT('GUN ' + (nd | 0), s2.x, s2.y + 30, AH.amb, 'center', 11, 600);
      }
    }
  }

  // ---------- IR 시커
  if (sk.on) {
    const cs = hmd.on
      ? proj(p.pos.clone().addScaledVector(hmdDir(), 1000)) || { x: cx, y: cy }
      : proj(p.pos.clone().addScaledVector(f, 1500)) || { x: cx, y: cy };
    cs.x = clamp(cs.x, 40, W - 40);
    cs.y = clamp(cs.y, 70, VH - 40);
    const r0 = 12 * (VH / 70),
      col = sk.st == 'LOCKED' ? AH.red : sk.st == 'ACQUIRING' ? AH.amb : AH.dim;
    g.strokeStyle = col;
    g.lineWidth = 1.5;
    g.setLineDash(sk.st == 'SEARCH' ? [6, 7] : []);
    g.beginPath();
    g.arc(cs.x, cs.y, r0 * (sk.st == 'ACQUIRING' ? 1 - 0.3 * ((t * 4) % 1) : 1), 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
    aT((hmd.on ? 'HMD ' : '') + 'IR ' + sk.st, cs.x, cs.y - r0 - 8, col, 'center', 11, 700);
    if (sk.tg && sk.st == 'LOCKED') {
      const s = proj(sk.tg.pos);
      if (s) {
        ahBracket(s.x, s.y, 18, AH.red, 2);
        ahLine(cs.x, cs.y, s.x, s.y);
      } else ahEdge(sk.tg.pos, AH.red, 'IR LOCK');
    }
  }

  // ---------- 미사일 표시
  let incoming = 0,
    inIR = 0,
    inRad = 0;
  for (const m of ms) {
    if (m.dead) continue;
    const d = m.pos.distanceTo(p.pos);
    if (m.side != 'P') {
      if (d < 9000) {
        incoming++;
        if (m.type === 'IR') inIR++;
        else inRad++;
      }
      if (d > 9000) continue;
      if (ahEdge(m.pos, AH.red, 'MSL ' + (d / 1000).toFixed(1))) continue;
      const s = proj(m.pos);
      if (!s) continue;
      g.strokeStyle = AH.red;
      g.lineWidth = 1.8;
      g.beginPath();
      g.moveTo(s.x - 10, s.y - 9);
      g.lineTo(s.x + 10, s.y - 9);
      g.lineTo(s.x, s.y + 9);
      g.closePath();
      g.stroke();
      aT('MSL ' + (d / 1000).toFixed(1), s.x + 14, s.y + 4, AH.red, 'left', 11, 700);
    } else if (d < 12000) {
      const s = proj(m.pos);
      if (!s) continue;
      g.strokeStyle = AH.white;
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(s.x, s.y, 5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  const samLive = typeof SAM_PROJECTILES !== 'undefined' ? SAM_PROJECTILES.filter(q => !q.dead).length : 0;

  // ---------- 경고
  const wr = [];
  // 어떤 대응수단이 먹히는지 경고에 같이 띄운다: 열추적(IR) → 플레어, 레이더(SARH·SAM) → 채프
  if (incoming || samLive || rw.lvl == 3) {
    const cm = [inIR ? 'IR → FLARE [X]' : '', inRad || samLive ? 'RADAR → CHAFF [C]' : ''].filter(Boolean).join('  ');
    wr.push(['MISSILE ALERT' + (cm ? '  ' + cm : ''), AH.red]);
  } else if (rw.lvl == 2) wr.push(['WARNING  RADAR LOCK', AH.amb]);
  if (p.stl) wr.push(['STALL', AH.red]);
  if (agl < 500 && p.vd.y < -0.1) wr.push(['PULL UP', AH.red]);
  if (p.ovs) wr.push(['OVERSPEED', AH.amb]);
  if (p.aoa > 0.55 && !p.stl) wr.push(['AOA LIMIT', AH.amb]);
  if (p.hp < 0.35) wr.push(['DAMAGE CRITICAL', AH.red]);
  if (wr.length && blink) {
    ahGlow(true, 'rgba(255,60,50,.6)');
    wr.forEach(([w, col], i) => {
      const y = (cockpit ? VH * 0.2 : cy + VH * 0.2) + i * 30;
      g.strokeStyle = col;
      g.lineWidth = 1.5;
      g.font = ahFont(20, 800);
      const tw = g.measureText(w).width + 28;
      g.strokeRect(cx - tw / 2, y - 21, tw, 29);
      aT(w, cx, y, col, 'center', 20, 800);
    });
    ahGlow(true);
  }
  if (!es.length && wt > 0 && !isAirbase()) {
    const held = ops.st !== 'fly'; // 갑판 위에서는 시계가 멈춘다
    aT('NEXT WAVE  ' + Math.ceil(wt) + 's' + (held ? '  ·  HOLD' : ''), cx, VH * 0.24, AH.amb, 'center', 16, 700);
    aT(held ? '발진하면 다시 흐른다' : '보급은 항모 착함 — 착함하면 시계가 멈춘다', cx, VH * 0.24 + 20, AH.dim, 'center', 11, 600);
  }
  if (cmHud.until > t)
    aT(cmHud.text, cx, VH - 26, cmHud.text.includes('NO EFFECT') ? AH.amb : AH.cyan, 'center', 13, 700);

  // ---------- 격추 / 명중 알림
  if (kills > AH.kills) {
    AH.kills = kills;
    AH.killT = t;
  } else if (kills < AH.kills) AH.kills = kills;
  if (t - AH.killT < 1.8 && t >= AH.killT) {
    const k = t - AH.killT;
    g.globalAlpha = k > 1.3 ? (1.8 - k) / 0.5 : 1;
    ahGlow(true, 'rgba(255,120,60,.7)');
    aT('DESTROYED', cx, cy - VH * 0.16, '#ff7a45', 'center', 30, 800);
    g.globalAlpha = 1;
  }
  g.restore();
  ahGlow(false);
  opsHud();
}
function drawHud() {
  aceHud('cockpit');
}
function drawExternalHud() {
  aceHud('external');
}
