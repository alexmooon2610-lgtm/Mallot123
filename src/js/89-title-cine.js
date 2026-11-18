// ---------- 타이틀 시네마틱 (V15.0.0-alpha.3): 표지 배경을 게임 엔진이 실시간으로 그린다
// 예전 표지는 588×312 짜리 MiG-29 사진을 화면 전체로 늘려서 흐리고 뭉개졌다.
// 이제 우리 기체(설정에서 고른 MiG-29 / Su-33)가 항모 자랴 둘레를 크게 돌고, 카메라는 선회 바깥쪽에 붙어
// 기체 너머로 항모가 보이게 천천히 각도를 바꾼다. 해상도와 무관하고, 사진 저작권 표시도 필요 없다.
//  - 메인 루프는 메뉴에서도 장면을 그리고 있었다(앞 화면이 불투명하게 덮고 있었을 뿐) → 그리는 비용은 늘지 않는다.
//  - 판정과 무관: 카메라와 장식용 기체만 움직인다. rnd 를 쓰지 않는다. 출격(S === 'play')하면 저절로 꺼진다.
const TCINE = { on: false, jet: null, ac: null, t: 0, fov: 70 };
const TCINE_R = 2600, // 선회 반지름 (항모 중심에서)
  TCINE_ALT = 420,
  TCINE_V = 150, // m/s
  TCINE_BANK = 0.38; // 선회 경사 (rad, 약 22°)
function titleCine(on) {
  if (on === TCINE.on) return;
  TCINE.on = on;
  if (on) {
    const ac = typeof pickedAc === 'function' ? pickedAc() : 'mig';
    if (!TCINE.jet || TCINE.ac !== ac) {
      if (TCINE.jet) scene.remove(TCINE.jet);
      const j = ac === 'su33' ? createSu33({ gearDown: false }) : createMiG29({ gearDown: false });
      if (ac !== 'su33' && typeof paintMiG29 === 'function') paintMiG29(j);
      j.scale.setScalar(3);
      j.name = 'title_cine_jet';
      j.userData.setAfterburner?.(true);
      TCINE.jet = j;
      TCINE.ac = ac;
    }
    scene.add(TCINE.jet);
    TCINE.jet.visible = true;
    TCINE.fov = cam.fov;
    // 매번 같은 장면부터: 항모가 기체 너머로 보이는 각도에서 시작한다
    TCINE.t = 0;
    hud && hud.getContext('2d').clearRect(0, 0, hud.width, hud.height); // 남아 있던 HUD 를 지운다
  } else if (TCINE.jet) {
    scene.remove(TCINE.jet);
    cam.fov = TCINE.fov;
    cam.up.set(0, 1, 0);
    cam.updateProjectionMatrix();
  }
}
// 메인 루프가 카메라를 정한 뒤, 그리기 직전에 부른다 (90-main-loop)
function titleCineUpdate(dt) {
  if (S === 'play' || !TCINE.jet || typeof CV === 'undefined') return titleCine(false);
  const T0 = (TCINE.t += dt),
    c = CV.position,
    a = 0.6 + (T0 * TCINE_V) / TCINE_R, // 항모 둘레 각도
    pos = V(c.x + Math.cos(a) * TCINE_R, TCINE_ALT + Math.sin(T0 * 0.23) * 10, c.z + Math.sin(a) * TCINE_R),
    f = V(-Math.sin(a), Math.sin(T0 * 0.23) * 0.02, Math.cos(a)).normalize(), // 진행 방향
    inward = V(c.x - pos.x, 0, c.z - pos.z).normalize(), // 선회 안쪽 (항모 쪽)
    bank = TCINE_BANK + Math.sin(T0 * 0.31) * 0.05,
    up = V(0, 1, 0).multiplyScalar(Math.cos(bank)).addScaledVector(inward, Math.sin(bank));
  up.addScaledVector(f, -up.dot(f)).normalize();
  const right = new T.Vector3().crossVectors(f, up).normalize(), // 기체 오른쪽
    m = new T.Matrix4().makeBasis(right, up, f.clone().negate()); // 기체 앞은 -z
  const jet = TCINE.jet;
  jet.position.copy(pos);
  jet.quaternion.setFromRotationMatrix(m);
  // 카메라: 선회 바깥쪽(항모 반대편)에서 기체를 본다 → 기체 뒤로 항모가 보인다.
  // 앞쪽 비스듬한 각도 ↔ 옆 각도를 40초 주기로 오가며, 거리도 조금씩 숨 쉬듯 바뀐다
  const phi = 1.05 + 0.6 * Math.sin(T0 * 0.155),
    D = 118 + 14 * Math.sin(T0 * 0.09),
    outward = inward.clone().negate(),
    off = f
      .clone()
      .multiplyScalar(Math.cos(phi) * D)
      .addScaledVector(outward, Math.sin(phi) * D)
      .add(V(0, -2 + 3 * Math.sin(T0 * 0.13), 0)); // 기체보다 살짝 아래 — 하늘이 더 보이게
  cam.position.copy(pos).add(off);
  cam.up.copy(V(0, 1, 0).lerp(up, 0.3).normalize());
  cam.fov = 34; // 망원 — 기체가 크게, 배경이 압축돼 보인다
  // 구도: 왼쪽에는 제목이 있으므로 기체를 화면 오른쪽(가로 약 +30%)에 둔다. 넓은 화면만 — 세로 화면은 가운데 위쪽
  const look = pos.clone().addScaledVector(f, 10).add(V(0, 5, 0)),
    toJet = look.clone().sub(cam.position),
    dist = toJet.length(),
    camRight = toJet.clone().normalize().cross(cam.up).normalize(),
    halfW = Math.tan((cam.fov * Math.PI) / 360) * dist * cam.aspect,
    wide = cam.aspect > 1.1;
  look.addScaledVector(camRight, wide ? -0.2 * halfW : 0).add(V(0, wide ? 0 : -0.25 * halfW / cam.aspect, 0));
  cam.lookAt(look);
  cam.updateProjectionMatrix();
  // 표지 아래 띠의 계기 판독값 (93-menu-fx)
  TCINE.ro = {
    alt: Math.round(pos.y),
    kmh: Math.round(TCINE_V * 3.6),
    hdg: Math.round(((Math.atan2(f.x, -f.z) * 180) / Math.PI + 360) % 360),
  };
  // 바다 · 구름층 · 하늘은 카메라를 따라간다 (메뉴에서는 메인 루프가 플레이어 위치로 맞춰 두므로 여기서 다시)
  sea.position.set(Math.floor(cam.position.x / 1000) * 1000, 0, Math.floor(cam.position.z / 1000) * 1000);
  if (typeof deckParkingUpdate === 'function') deckParkingUpdate(cam.position);
}
