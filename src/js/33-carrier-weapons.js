/* ===== 항모 방공 무장 (보이는 것만) =====
   실함 「아드미랄 쿠즈네초프」 배치를 줄여서 옮겼다. 비행갑판보다 낮은 현측 포좌 4곳(함수 좌·우, 함미 좌·우)에
     - 3K95 킨잘 수직발사기 24기 (포좌마다 6기, 한 기에 8발)
     - 코르티크(카슈탄) 근접방어 8기 (30 mm 개틀링 2문 + 미사일 8발 + 추적 레이더)
     - AK-630 30 mm 개틀링 6기 (함미 포좌에 2기씩, 함수 포좌에 1기씩)
   를 놓고, 스키점프 밑동 갑판에는 P-700 그라니트 발사구 덮개 12개를 그렸다.
   판정(33-carrier-defense)은 그대로다. 여기서는 포탑이 표적을 따라 돌고, 예광탄이 포구에서 나가고,
   방공 미사일이 수직발사 → 점화 → 표적 쪽으로 꺾이는 모션만 덧씌운다. 게임 난수는 쓰지 않는다.
   좌표는 항모 로컬(m): X 우현 · Y 위 · −Z 함수. 포좌 바닥 y 14.0 (비행갑판 16.56 보다 낮다).
*/
const CVW = { guns: [], cells: [], sams: [], flashes: [], next: 0, built: false };
const CVW_Y = 14;
function cvBuildWeapons() {
  if (CVW.built || !carrierGLB) return;
  CVW.built = true;
  const root = new T.Group();
  root.name = 'cv_weapons';
  CV.add(root);
  CVW.root = root; // 거리 컬링 · 거울에서 끄기 (13-carrier-glb deckParkingUpdate · 81-rear-mirror)
  const std = (color, rough = 0.7, metal = 0.25) =>
      new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal }),
    grey = std(0x8a949b),
    dgrey = std(0x565f66),
    dark = std(0x2c3236, 0.6, 0.5),
    white = std(0xdde3e6, 0.6, 0.1),
    lid = std(0x737d84),
    mesh = (geo, mat, x, y, z, parent = root) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
  const G = {
    ring: new T.CylinderGeometry(1.3, 1.45, 0.5, 20),
    body: new T.BoxGeometry(1.5, 1.5, 1.7),
    barrel: new T.CylinderGeometry(0.17, 0.17, 2.3, 10),
    tubes: new T.BoxGeometry(0.55, 0.55, 2.0),
    dish: new T.CylinderGeometry(0.55, 0.55, 0.14, 16),
    neck: new T.BoxGeometry(0.5, 0.5, 0.5),
    akBase: new T.CylinderGeometry(0.85, 0.95, 0.4, 16),
    akDome: new T.SphereGeometry(0.78, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    akBarrel: new T.CylinderGeometry(0.12, 0.14, 1.7, 10),
    cell: new T.CylinderGeometry(1.05, 1.05, 0.3, 20),
    cellLid: new T.CylinderGeometry(0.92, 0.92, 0.1, 20),
    granit: new T.BoxGeometry(2.6, 0.04, 5.2),
  };
  G.barrel.rotateX(Math.PI / 2);
  G.akBarrel.rotateX(Math.PI / 2);
  // 포탑: yaw(좌우) · pitch(상하) 축을 따로 둔다. 포신은 +z 를 본다.
  const turret = (kind, x, z, side) => {
    const base = new T.Group();
    base.position.set(x, CVW_Y, z);
    root.add(base);
    const yaw = new T.Group(),
      pitch = new T.Group();
    base.add(yaw);
    yaw.add(pitch);
    if (kind === 'kortik') {
      mesh(G.ring, dgrey, 0, 0.25, 0, base);
      mesh(G.body, grey, 0, 1.3, 0, yaw);
      mesh(G.neck, dgrey, 0, 2.25, -0.2, yaw);
      const d = mesh(G.dish, white, 0, 2.7, 0.1, yaw);
      d.rotation.x = Math.PI / 2 - 0.35;
      pitch.position.y = 1.35;
      for (const s of [-1, 1]) {
        mesh(G.barrel, dark, s * 1.0, 0, 1.1, pitch);
        mesh(G.tubes, grey, s * 1.42, 0.5, 0.5, pitch);
      }
    } else {
      mesh(G.akBase, dgrey, 0, 0.2, 0, base);
      mesh(G.akDome, grey, 0, 0.4, 0, yaw);
      pitch.position.y = 0.75;
      mesh(G.akBarrel, dark, 0, 0, 0.95, pitch);
    }
    const rest = side > 0 ? Math.PI / 2 : -Math.PI / 2; // 평소엔 바깥쪽을 본다
    yaw.rotation.y = rest;
    pitch.rotation.x = -0.25;
    CVW.guns.push({ kind, base, yaw, pitch, side, rest, muzzle: kind === 'kortik' ? 2.3 : 1.8 });
  };
  // 수직발사기 한 기: 받침 + 한쪽으로 젖혀지는 덮개
  const cell = (x, z, side) => {
    mesh(G.cell, dgrey, x, CVW_Y + 0.15, z);
    const hinge = new T.Group();
    hinge.position.set(x - side * 0.92, CVW_Y + 0.32, z);
    root.add(hinge);
    mesh(G.cellLid, lid, side * 0.92, 0.05, 0, hinge);
    CVW.cells.push({ pos: V(x, CVW_Y + 0.4, z), hinge, side, open: 0, hold: 0 });
  };
  // 포좌 4곳: [현측(−1 좌 / +1 우), 앞끝 z, 뒤끝 z, 갑판 밑으로 물리는 안쪽 x, 바깥 x, 무장 줄 x]
  const BATTERIES = [
    { side: -1, z0: -93, z1: -71, xi: 19, xo: 31.5, xw: 27.6, fwd: true },
    { side: 1, z0: -93, z1: -71, xi: 19, xo: 31.5, xw: 27.6, fwd: true },
    { side: -1, z0: 119, z1: 146, xi: 24, xo: 36.2, xw: 32.3, fwd: false },
    { side: 1, z0: 119, z1: 146, xi: 21, xo: 33.6, xw: 29.8, fwd: false },
  ];
  for (const b of BATTERIES) {
    const len = b.z1 - b.z0,
      wid = b.xo - b.xi,
      cx = b.side * (b.xi + wid / 2),
      cz = (b.z0 + b.z1) / 2;
    mesh(new T.BoxGeometry(wid, 1.4, len), grey, cx, CVW_Y - 0.7, cz); // 포좌 바닥
    mesh(new T.BoxGeometry(0.25, 0.9, len), dgrey, b.side * b.xo, CVW_Y + 0.45, cz); // 바깥 난간벽
    const x = b.side * b.xw;
    turret('kortik', x, b.z0 + 2.4, b.side);
    turret('kortik', x, b.z1 - 2.4, b.side);
    const zc = b.z0 + 6.2; // 킨잘 2×3
    for (let i = 0; i < 3; i++) for (const dx of [-1.25, 1.25]) cell(x + dx, zc + i * 2.5, b.side);
    turret('ak630', x + b.side * 0.9, b.z1 - 6, b.side);
    if (!b.fwd) turret('ak630', x + b.side * 0.9, b.z1 - 9.2, b.side);
  }
  // P-700 그라니트 발사구 덮개 12개 (스키점프 밑동, 갑판에 묻힌 덮개 2열 × 6)
  const gm = std(0x4c555b, 0.8, 0.2);
  for (let i = 0; i < 6; i++) for (const sx of [-1, 1]) mesh(G.granit, gm, sx * 1.7, CV_DECK_Y + 0.03, -99 + i * 5.6);
}
// 표적에 가장 가까운(그리고 그쪽 현측에 있는) 포탑을 고른다
function cvPickGun(worldTarget) {
  const tl = CV.worldToLocal(worldTarget.clone());
  let best = null,
    bd = Infinity;
  for (const g of CVW.guns) {
    const d = g.base.position.distanceTo(tl) + (Math.sign(tl.x) === g.side ? 0 : 60);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}
// 근접 함포 사격: 예광탄이 나갈 포구 위치(월드)를 돌려주고 포구 섬광을 낸다. 포탑이 없으면 null.
function cvGunFire(worldTarget) {
  const g = cvPickGun(worldTarget);
  if (!g) return null;
  g.hot = 0.9; // 이 포탑이 표적을 붙잡고 있는 시간
  g.aim = worldTarget;
  const m = g.pitch.localToWorld(V(0, 0, g.muzzle));
  const s = getSprite(0xffd890, true, TX);
  s.position.copy(m);
  s.scale.setScalar(14);
  fx.push({ s, t: 0, life: 0.09, size: 14, grow: -0.5 });
  if (p && p.pos.distanceTo(m) < 2500) tone(95, 0.05, 'square', 0.03);
  return m;
}
// 방공 미사일 발사: 판정용 탄(q.line)은 그대로 두고, 수직발사 모션을 그릴 겉모습을 붙인다.
function cvSamLaunch(q) {
  if (!CVW.cells.length) return false;
  const tl = CV.worldToLocal(q.target.pos.clone());
  // 표적 쪽 현측의 발사기를 차례로 쓴다
  const side = tl.x >= 0 ? 1 : -1,
    pool = CVW.cells.filter(c => c.side === side),
    c = pool[CVW.next++ % pool.length];
  c.hold = 2.2;
  const g = new T.Group(),
    body = new T.Mesh(
      new T.CylinderGeometry(0.75, 0.75, 9.5, 10),
      new T.MeshStandardMaterial({ color: 0xe6eaec, roughness: 0.5, metalness: 0.2 })
    ),
    nose = new T.Mesh(
      new T.ConeGeometry(0.75, 2.6, 10),
      new T.MeshStandardMaterial({ color: 0x9aa3a8, roughness: 0.5 })
    ),
    glow = new T.Sprite(
      new T.SpriteMaterial({ map: TX, color: 0xffb060, blending: T.AdditiveBlending, depthWrite: false })
    );
  body.rotation.x = Math.PI / 2;
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -6;
  glow.position.z = 6;
  glow.scale.setScalar(16);
  glow.visible = false;
  g.add(body, nose, glow);
  const from = CV.localToWorld(c.pos.clone());
  g.position.copy(from);
  g.quaternion.setFromUnitVectors(V(0, 0, -1), V(0, 1, 0));
  scene.add(g);
  const v = { q, g, glow, from, age: 0, lit: false, prev: from.clone(), trail: null };
  v.trail = makeTrail({ life: 2.6, w0: 1.4, wk: 4.5, amax: 0.7, done: () => !CVW.sams.includes(v) });
  CVW.sams.push(v);
  q.line.visible = false;
  puff(from, 0xeef2f4, 16, 1.1, 2.4); // 가스 사출 연기
  if (p && p.pos.distanceTo(from) < 3000) noiseSnd(0.35, 0.05, 900, 300, 'lowpass');
  return true;
}
const CVW_POP = 0.34, // 사출만으로 떠오르는 시간(초)
  CVW_TIP = 0.55, // 점화 뒤 표적 쪽으로 꺾이는 시간(초)
  CVW_RISE = 66; // 사출 높이 (월드 단위 ≈ 22 m)
function cvWeaponsUpdate(dt) {
  if (!CVW.built) return;
  // 포탑 추적: 사격 중인 포탑은 표적을, 나머지는 바깥쪽을 본다
  for (const g of CVW.guns) {
    let yaw = g.rest,
      pit = -0.25;
    if (g.hot > 0 && g.aim) {
      g.hot -= dt;
      const d = CV.worldToLocal(g.aim.clone()).sub(g.base.position);
      yaw = Math.atan2(d.x, d.z);
      pit = -Math.atan2(d.y, Math.hypot(d.x, d.z));
    }
    let dy = yaw - g.yaw.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    g.yaw.rotation.y += clamp(dy, -3.2 * dt, 3.2 * dt);
    g.pitch.rotation.x += clamp(pit - g.pitch.rotation.x, -2.4 * dt, 2.4 * dt);
  }
  // 발사기 덮개: 쏠 때 젖혀졌다가 닫힌다
  for (const c of CVW.cells) {
    if (c.hold > 0) c.hold -= dt;
    c.open = clamp(c.open + (c.hold > 0 ? 6 : -1.6) * dt, 0, 1);
    c.hinge.rotation.z = c.side * c.open * 1.75;
  }
  // 방공 미사일 겉모습
  CVW.sams = CVW.sams.filter(v => {
    if (!v.q.line.parent) {
      scene.remove(v.g);
      v.g.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      return false;
    }
    v.age += dt;
    const top = v.from.clone().add(V(0, CVW_RISE, 0)),
      real = v.q.line.position;
    let pos;
    if (v.age < CVW_POP) {
      // ① 콜드 런치: 가스로 밀려 올라간다. 엔진은 아직 꺼져 있다.
      pos = v.from.clone().lerp(top, Math.pow(v.age / CVW_POP, 0.75));
    } else {
      if (!v.lit) {
        // ② 공중 점화
        v.lit = true;
        v.glow.visible = true;
        const s = getSprite(0xfff0c0, true, TX);
        s.position.copy(top);
        s.scale.setScalar(46);
        fx.push({ s, t: 0, life: 0.2, size: 46, grow: -0.4 });
        puff(top, 0xf2f4f5, 20, 1.3, 2.2);
        if (p && p.pos.distanceTo(top) < 3000) launchSnd();
      }
      // ③ 표적 쪽으로 꺾이며 판정용 탄의 궤적에 올라탄다
      const k = clamp((v.age - CVW_POP) / CVW_TIP, 0, 1),
        s = k * k * (3 - 2 * k);
      pos = top.clone().lerp(real, s);
      trailPush(v.trail, pos, 12);
    }
    const d = pos.clone().sub(v.prev);
    if (d.lengthSq() > 1e-6)
      v.g.quaternion.slerp(new T.Quaternion().setFromUnitVectors(V(0, 0, -1), d.normalize()), 0.5);
    v.g.position.copy(pos);
    v.prev.copy(pos);
    return true;
  });
}
