// ---------- 3D 모델 (F-16 / 쿠즈네초프급)
/* ===== F-16 모델 (아케이드용 로우폴리) =====
   좌표: 기수 -Z, 위 +Y, 오른쪽 날개 +X, 길이 약 16.4
   const jet = createF16({tanks:true, scale:1});
   jet.userData.setAfterburner(true/false);  // 애프터버너 불꽃 */
function createF16(opts) {
  opts = opts || {};
  const g = new THREE.Group();
  const mk = c =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.65,
      metalness: 0.25,
      flatShading: true,
      side: THREE.DoubleSide,
    });
  const gray = mk(0x8d949c),
    dark = mk(0x5d646c),
    radome = mk(0x3e4349),
    white = mk(0xdfe3e6);
  const glass = new THREE.MeshStandardMaterial({
    color: 0xc9a24a,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.75,
  });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const v2 = a => a.map(p => new THREE.Vector2(p[0], p[1]));
  const grayS = new THREE.MeshStandardMaterial({
      color: 0x8d949c,
      roughness: 0.58,
      metalness: 0.3,
      side: THREE.DoubleSide,
    }),
    radomeS = new THREE.MeshStandardMaterial({
      color: 0x3e4349,
      roughness: 0.5,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

  // 동체
  const fus = new THREE.LatheGeometry(
    v2([
      [0, 8],
      [0.15, 7.6],
      [0.45, 6.5],
      [0.75, 5],
      [0.9, 3.5],
      [0.95, 1],
      [0.95, -2],
      [0.85, -4.5],
      [0.65, -6.3],
      [0.55, -7.2],
      [0.5, -7.5],
    ]),
    32
  );
  fus.rotateX(-Math.PI / 2);
  fus.scale(1, 0.88, 1);
  add(fus, grayS, 0, 0, 0);
  // 레이돔
  const rad = new THREE.ConeGeometry(0.47, 1.5, 28);
  rad.rotateX(-Math.PI / 2);
  rad.scale(1, 0.88, 1);
  add(rad, radomeS, 0, 0, -7.25);
  // 공기흡입구
  const intake = new THREE.CylinderGeometry(0.5, 0.5, 2.6, 28);
  intake.rotateX(Math.PI / 2);
  intake.scale(1.05, 0.8, 1);
  add(intake, grayS, 0, -0.82, -2.4);
  const mouth = new THREE.CircleGeometry(0.47, 28);
  mouth.rotateY(Math.PI);
  mouth.scale(1.05, 0.8, 1);
  add(mouth, radome, 0, -0.82, -3.72);
  // 캐노피 + 등 쪽 척추
  const can = new THREE.SphereGeometry(0.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  can.scale(0.9, 0.8, 3);
  add(can, glass, 0, 0.78, -3.0);
  add(new THREE.BoxGeometry(0.45, 0.3, 5.8), gray, 0, 0.82, 2.1);

  // 판형 부품 (위에서 본 윤곽 [x,z] -> 아래로 두께)
  const slab = (pts, th) => {
    const s = new THREE.Shape();
    pts.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    return geo;
  };
  const both = (pts, th, mat, y) =>
    [1, -1].forEach(sg =>
      add(
        slab(
          pts.map(p => [p[0] * sg, p[1]]),
          th
        ),
        mat,
        0,
        y,
        0
      )
    );
  both(
    [
      [0.8, -1.2],
      [4.9, 2.1],
      [4.9, 3.3],
      [0.8, 4.3],
    ],
    0.12,
    gray,
    -0.1
  ); // 주익
  both(
    [
      [0.5, -4.4],
      [1.0, -1.2],
      [1.0, 0.5],
      [0.5, 0.5],
    ],
    0.1,
    gray,
    -0.05
  ); // LERX
  both(
    [
      [0.7, 4.4],
      [2.9, 6.0],
      [2.9, 7.0],
      [0.7, 7.1],
    ],
    0.1,
    dark,
    -0.2
  ); // 수평 미익

  // 수직 미익
  const ts = new THREE.Shape();
  [
    [3.4, 0.55],
    [5.9, 3.3],
    [7.1, 3.3],
    [7.2, 0.55],
  ].forEach((p, i) => (i ? ts.lineTo(p[0], p[1]) : ts.moveTo(p[0], p[1])));
  const tail = new THREE.ExtrudeGeometry(ts, { depth: 0.1, bevelEnabled: false });
  tail.rotateY(-Math.PI / 2);
  tail.translate(0.05, 0, 0);
  add(tail, gray, 0, 0, 0);
  // 복부 핀
  [1, -1].forEach(sg => {
    const f = add(new THREE.BoxGeometry(0.05, 0.5, 1.2), dark, 0.55 * sg, -0.7, 5.2);
    f.rotation.z = -0.4 * sg;
  });

  // 엔진 노즐 + 애프터버너 불꽃
  const noz = new THREE.CylinderGeometry(0.62, 0.5, 0.9, 14, 1, true);
  noz.rotateX(Math.PI / 2);
  add(noz, dark, 0, 0, 7.95);
  const fl = new THREE.ConeGeometry(0.45, 3.2, 12, 1, true);
  fl.rotateX(Math.PI / 2);
  const flame = add(
    fl,
    new THREE.MeshBasicMaterial({
      color: 0xffa040,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    0,
    0,
    10.0
  );
  flame.visible = false;
  g.userData.flame = flame;
  g.userData.setAfterburner = on => {
    flame.visible = !!on;
  };

  // 날개 끝 AIM-9 + 날개 아래 연료탱크
  [1, -1].forEach(sg => {
    const m = new THREE.CylinderGeometry(0.07, 0.07, 2.9, 8);
    m.rotateX(Math.PI / 2);
    add(m, white, 5.0 * sg, -0.1, 2.7);
    const n = new THREE.ConeGeometry(0.07, 0.35, 8);
    n.rotateX(-Math.PI / 2);
    add(n, white, 5.0 * sg, -0.1, 1.08);
    add(new THREE.BoxGeometry(0.7, 0.02, 0.3), white, 5.0 * sg, -0.1, 4.0);
    add(new THREE.BoxGeometry(0.02, 0.7, 0.3), white, 5.0 * sg, -0.1, 4.0);
    if (opts.tanks !== false) {
      const tk = new THREE.LatheGeometry(
        v2([
          [0, -1.6],
          [0.2, -1.4],
          [0.33, -0.9],
          [0.35, 0],
          [0.33, 0.9],
          [0.2, 1.4],
          [0, 1.6],
        ]),
        12
      );
      tk.rotateX(Math.PI / 2);
      add(tk, grayS, 2.1 * sg, -0.67, 1.2);
      add(new THREE.BoxGeometry(0.08, 0.25, 1.2), dark, 2.1 * sg, -0.35, 1.2);
    }
  });
  if (opts.scale) g.scale.setScalar(opts.scale);
  return g;
}
