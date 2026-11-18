/* ===== 지형 충돌 · 가상의 지상 위협(SAM) ===== */
function terrainHasLineOfSight(a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  for (let i = 1; i < 12; i++) {
    const f = i / 12,
      x = a.x + dx * f,
      y = a.y + dy * f,
      z = a.z + dz * f;
    if (terrainHeightAt(x, z) + 18 > y) return false;
  }
  return true;
}
function resetGroundThreats() {
  for (const q of SAM_PROJECTILES) disposeObject(q.mesh);
  SAM_PROJECTILES.length = 0;
  samRwr = { state: 'CLEAR', bearing: 0, range: 0, site: null };
  GROUND_THREATS.forEach(site => {
    site.cooldown = 8 + rnd() * 6;
    site.detected = false;
    site.tracked = false;
    site.masked = false;
    site.lamp.material.color.set(0x70d8a0);
  });
}
// SAM 발사: 동체 · 노즈콘 · 4핀 · 화염 형상의 미사일을 기지 위에 띄운다
function spawnGroundThreat(site) {
  const mesh = new THREE.Group(),
    mw = new THREE.MeshStandardMaterial({ color: 0xe8e8dc, roughness: 0.6, metalness: 0.2 }),
    md = new THREE.MeshStandardMaterial({ color: 0x3d4630, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 34, 10), mw);
  body.rotation.x = Math.PI / 2;
  mesh.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.6, 10, 10), md);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 22;
  mesh.add(nose);
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Group(),
      f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 7), md);
    f.position.set(0, 6, -13);
    w.add(f);
    w.rotation.z = (i * Math.PI) / 2;
    mesh.add(w);
  }
  const fl = new THREE.Mesh(
    new THREE.ConeGeometry(2.4, 24, 8),
    new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9 })
  );
  fl.rotation.x = -Math.PI / 2;
  fl.position.z = -29;
  mesh.add(fl);
  mesh.scale.setScalar(1.4);
  mesh.position.copy(site.origin).add(V(0, 28, 0));
  scene.add(mesh);
  SAM_PROJECTILES.push({ mesh, dir: V(0, 1, 0), speed: 205, age: 0, site, dead: false });
  site.cooldown = 15 + rnd() * 5;
  msg('지상 위협 이벤트 발생 — 미사일 발사! 회피하라', '#ff6a4d');
  tone(420, 0.16, 'sawtooth', 0.045, 240);
}
function terrainCollisionUpdate() {
  if (!isAirbase() || S !== 'play' || !p || airbaseOps.phase !== 'airborne') return;
  const ground = terrainHeightAt(p.pos.x, p.pos.z),
    clearance = p.pos.y - ground;
  if (clearance < 4.5 && p.speed > 25) {
    p.pos.y = ground + 4.5;
    msg('지형 충돌 — 지면 고도 초과', '#ff7373');
    kill(p);
  }
}
function groundThreatUpdate(dt) {
  if (!isAirbase() || !curM().samEnabled || S !== 'play' || !p) {
    samRwr = { state: 'CLEAR', bearing: 0, range: 0, site: null };
    return;
  }
  let best = null,
    masked = null;
  for (const site of GROUND_THREATS) {
    site.cooldown = Math.max(0, site.cooldown - dt);
    const delta = p.pos.clone().sub(site.origin),
      range = delta.length(),
      los = range < 13200 && terrainHasLineOfSight(site.origin, p.pos);
    const detected = range < 13200 && los,
      tracked = range < 8200 && los;
    if (detected) {
      if (!best || range < best.range)
        best = {
          site,
          range,
          bearing: (Math.atan2(delta.x, -delta.z) / D + 360) % 360,
          state: tracked ? 'TRACK' : 'SEARCH',
        };
    } else if (range < 13200 && !los && (!masked || range < masked.range)) masked = { site, range };
    if (site.detected && !detected) {
      site.masked = !los && range < 13200;
      if (site.masked) msg('지형 차폐 — 지상 위협 접촉 소실', '#9cf');
    }
    if (!site.detected && detected) msg('지상 위협 접촉 — ' + (tracked ? 'TRACK' : 'SEARCH'), '#ffd36b');
    if (!site.tracked && tracked) msg('가상 지상 위협 추적 상태', '#ffb36b');
    site.detected = detected;
    site.tracked = tracked;
    site.lamp.material.color.set(tracked ? 0xff654d : detected ? 0xffcf70 : 0x70d8a0);
    if (tracked && site.cooldown <= 0 && SAM_PROJECTILES.filter(q => !q.dead).length < 2) spawnGroundThreat(site);
  }
  if (best) {
    samRwr = { state: best.state, bearing: best.bearing, range: best.range, site: best.site.id };
  } else if (masked) {
    samRwr = { state: 'MASKED', bearing: 0, range: masked.range, site: masked.site.id };
  } else samRwr = { state: 'CLEAR', bearing: 0, range: 0, site: null };

  for (const q of SAM_PROJECTILES) {
    if (q.dead) continue;
    q.age += dt;
    const to = p.pos.clone().sub(q.mesh.position),
      range = to.length();
    if (range < 62) {
      q.dead = true;
      hurt(p, 0.13);
      puff(q.mesh.position, 0xffa15c, 32, 0.65, 2, 1);
      msg('가상 위협체 접촉 — 기체 손상', '#ff7b64');
      continue;
    }
    if (!terrainHasLineOfSight(q.mesh.position, p.pos)) {
      q.dead = true;
      puff(q.mesh.position, 0x9ab8c8, 24, 0.55, 1.8, 0);
      msg('능선 차폐 — 가상 추적체 소멸', '#9cf');
      continue;
    }
    q.dir.lerp(to.normalize(), clamp(dt * 0.85, 0, 1)).normalize();
    q.mesh.position.addScaledVector(q.dir, q.speed * dt);
    const ground = terrainHeightAt(q.mesh.position.x, q.mesh.position.z);
    if (q.mesh.position.y < ground + 8) {
      q.dead = true;
      puff(q.mesh.position, 0x9ab8c8, 25, 0.6, 1.8, 0);
      continue;
    }
    q.mesh.lookAt(q.mesh.position.clone().add(q.dir));
    // 연기 꼬리 (예전에는 100ms 타이머에서 생성 → 프레임·일시정지와 무관하게 쌓였다)
    if ((q.smokeT = (q.smokeT || 0) - dt) <= 0) {
      q.smokeT = 0.1;
      puff(q.mesh.position, 0xdcdcd0, 14, 0.9, 1.4, 0);
    }
    if (q.age > 18) q.dead = true;
  }
  for (let i = SAM_PROJECTILES.length - 1; i >= 0; i--)
    if (SAM_PROJECTILES[i].dead) {
      disposeObject(SAM_PROJECTILES[i].mesh);
      SAM_PROJECTILES.splice(i, 1);
    }
}
// 플레이어 플레어/채프: 3.5 km 안의 가상 지상 위협체를 각각 70% 확률로 기만한다
function samDecoy(a) {
  if (a !== p || !isAirbase()) return 0;
  let n = 0;
  for (const q of SAM_PROJECTILES)
    if (!q.dead && q.mesh.position.distanceTo(p.pos) < 3500 && rnd() < 0.7) {
      q.dead = true;
      n++;
      puff(q.mesh.position, 0xffe9a0, 22, 0.5, 1.6, 1);
    }
  if (n) msg('미사일 기만 성공', '#9cf');
  return n;
}
function drawGroundThreatHud() {
  if (!p || !isAirbase() || !curM().samEnabled) return;
  // 오른쪽 위(시간 · 격추 수 아래)에 둔다. 예전엔 화면 가운데 VH*0.22 에 있어 임무 안내 줄(opsHud)과 겹쳤다 (V14.6.0)
  const x = W - 22,
    y = 78,
    state = samRwr.state;
  const color =
    state === 'TRACK' ? '#ff6f58' : state === 'SEARCH' ? '#ffd36b' : state === 'MASKED' ? '#9cf' : '#a8d8c0';
  const agl = Math.max(0, p.pos.y - terrainHeightAt(p.pos.x, p.pos.z)),
    lines = state === 'TRACK' || state === 'MASKED' ? 3 : 2;
  g.fillStyle = 'rgba(0,12,8,.42)';
  g.fillRect(x - 200, y - 16, 210, lines * 17 + 8);
  tx(`GROUND ${state}${samRwr.site ? ' · ' + samRwr.site : ''}`, x, y, color, 'right', 12);
  tx(`AGL ${agl.toFixed(0)} m`, x, y + 17, '#cde4e8', 'right', 10);
  if (state === 'TRACK')
    tx(`BEARING ${samRwr.bearing.toFixed(0)}° · ${(samRwr.range / 1000).toFixed(1)} km`, x, y + 34, '#ff9a7d', 'right', 10);
  if (state === 'MASKED') tx('TERRAIN MASKING', x, y + 34, '#9cf', 'right', 10);
}

function opsHud() {
  if (isAirbase()) {
    const cx = W / 2,
      y0 = VH * 0.16;
    const label = {
      ready: 'READY — SHIFT: TAKEOFF ROLL',
      roll: 'TAKEOFF ROLL',
      airborne:
        curM().category === 'SANDBOX'
          ? 'FREE FLIGHT / TERRAIN TEST'
          : missionPhase === 'final'
            ? 'FINAL APPROACH'
            : isFinalPhase()
              ? 'RETURN TO AIRBASE'
              : missionPhase === 'approach'
                ? 'APPROACH — GATES'
                : 'CLIMB / NAVIGATION',
      landing: 'RUNWAY CAPTURE — AUTO TOUCHDOWN',
      landed: 'LANDED',
    }[airbaseOps.phase];
    if (label) tx(label, cx, y0, isFinalPhase() ? '#ffc857' : '#ffdf75', 'center', 17);
    if (airbaseOps.phase === 'ready') tx('W/S: THROTTLE  ·  SHIFT: START TAKEOFF', cx, y0 + 23, '#9cf', 'center', 11);
    if (airbaseOps.phase === 'airborne' && isFinalPhase())
      tx(
        'RUNWAY — ALIGN CENTERLINE (EITHER DIRECTION) · CONFIG ASSIST · AUTO TOUCHDOWN',
        cx,
        y0 + 23,
        '#9cf',
        'center',
        11
      );
    if (airbaseOps.phase === 'landing') tx('AUTOMATIC TOUCHDOWN AND ROLLOUT', cx, y0 + 23, '#52ffc0', 'center', 11);
    if (
      airbaseOps.phase === 'airborne' &&
      (missionPhase === 'waypoint' || missionPhase === 'approach' || isFinalPhase())
    ) {
      const cue = missionGuidanceText();
      if (cue) tx(exFit(cue, 10, W * 0.92), cx, y0 + 62, '#ffd36b', 'center', 10);
    }
    if (airbaseOps.phase === 'airborne' && airbaseOps.far) {
      const g = landingGuide();
      if (g) {
        const bad = Math.abs(g.x) > 45 || Math.abs(g.gs) > 35 || g.sink > 7;
        tx(
          `LOC ${g.x >= 0 ? 'R' : 'L'}${Math.abs(g.x).toFixed(0)}m   GS ${g.gs >= 0 ? '▲ HIGH ' : '▼ LOW '}${Math.abs(g.gs).toFixed(0)}m   SINK ${g.sink.toFixed(1)}m/s   DIST ${(Math.max(0, g.d) / 1000).toFixed(1)}km`,
          cx,
          y0 + (isFinalPhase() ? 42 : 23),
          bad ? '#ffca70' : '#a8f0c6',
          'center',
          11
        );
      }
    }
    return;
  }
  const cx = W / 2,
    y0 = VH * 0.17,
    B = {
      prep: '발진 준비 중…',
      deck: 'READY — Shift: 발진',
      run: 'TAKEOFF',
      land: 'ARRESTED',
      serve: '승조원 보급 중…',
    }[ops.st];
  if (B) tx(B, cx, y0, '#ff4', 'center', 18);
  const cp = CV.position.clone();
  cp.y = 70;
  const d = cp.distanceTo(p.pos),
    s = proj(cp);
  if (ops.st == 'fly') {
    if (s && d > 600) {
      g.strokeStyle = '#9cf';
      g.strokeRect(s.x - 9, s.y - 9, 18, 18);
      tx('CV ' + (d / 1000).toFixed(1) + 'km', s.x, s.y + 24, '#9cf', 'center', 11);
    }
    if (d < 7000) {
      tx(
        '착함: 후방 갑판 · 속도<590 km/h · 완만한 강하 · 기수 정렬 (기어·플랩 자동 보조)',
        cx,
        y0,
        '#9cf',
        'center',
        12
      );
      const g = carrierGuide();
      if (g) {
        const bad = Math.abs(g.x) > 60 || Math.abs(g.gs) > 40 || g.sink > 9;
        tx(
          `LOC ${g.x >= 0 ? 'R' : 'L'}${Math.abs(g.x).toFixed(0)}m   GS ${g.gs >= 0 ? '▲ HIGH ' : '▼ LOW '}${Math.abs(g.gs).toFixed(0)}m   SINK ${g.sink.toFixed(1)}m/s   DIST ${(g.d / 1000).toFixed(1)}km`,
          cx,
          y0 + 19,
          bad ? '#ffca70' : '#a8f0c6',
          'center',
          11
        );
      }
    }
  }
}
