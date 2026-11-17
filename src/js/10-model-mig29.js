/* ===== MiG-29 9.12 절차적 모델 (GLB 로드 실패 시 쓰는 대체 기체) =====
   Coordinate convention matches the existing game: nose -Z, +Y up, +X right.
   This is a game-oriented silhouette, not a metrology-accurate replica. */
function createMiG29Procedural(opts = {}) {
  // MiG-29 9.12 visual pass: prioritize the broad blended fuselage,
  // rounded wing-root shoulders and separated twin-engine layout.
  // No gameplay, flight, collision or weapon systems are changed here.
  const root = new T.Group();
  const mat = (color, metalness = 0.18, roughness = 0.72) =>
    new T.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      flatShading: false,
      side: T.DoubleSide,
    });
  const skin = mat(0x89939b, 0.22, 0.76);
  const skinLight = mat(0x9aa3a9, 0.2, 0.72);
  const underside = mat(0x68737b, 0.16, 0.82);
  const radome = mat(0x4e5962, 0.12, 0.8);
  const dark = mat(0x20282e, 0.12, 0.84);
  const metal = mat(0x9ca6ad, 0.55, 0.52);
  const rubber = mat(0x171b1f, 0.05, 0.92);
  const canopy = new T.MeshPhysicalMaterial({
    color: 0x506873,
    metalness: 0.34,
    roughness: 0.2,
    transparent: true,
    opacity: 0.82,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    side: T.DoubleSide,
  });
  const add = (geo, material, x = 0, y = 0, z = 0, parent = root) => {
    const mesh = new T.Mesh(geo, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // Smooth elliptical loft: stations are [z, halfWidth, halfHeight, centreY].
  // Catmull-Rom interpolation avoids the cylindrical, segmented appearance
  // of the previous fuselage and engine bodies.
  function loft(stations, material, centreX = 0, axialSteps = 7, radialSteps = 40) {
    const vertices = [],
      indices = [];
    const cat = (p0, p1, p2, p3, t) =>
      0.5 *
      (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    const count = (stations.length - 1) * axialSteps;
    for (let i = 0; i <= count; i++) {
      const f = i / axialSteps,
        seg = Math.min(stations.length - 2, Math.floor(f)),
        t = i === count ? 1 : f - seg;
      const a = stations[Math.max(0, seg - 1)],
        b = stations[seg],
        c = stations[Math.min(stations.length - 1, seg + 1)],
        d = stations[Math.min(stations.length - 1, seg + 2)];
      const rx = Math.max(0, cat(a[1], b[1], c[1], d[1], t));
      const ry = Math.max(0, cat(a[2], b[2], c[2], d[2], t));
      const cy = cat(a[3], b[3], c[3], d[3], t);
      const z = b[0] + (c[0] - b[0]) * t;
      for (let j = 0; j < radialSteps; j++) {
        const ang = (j / radialSteps) * Math.PI * 2;
        vertices.push(centreX + Math.cos(ang) * rx, cy + Math.sin(ang) * ry, z);
      }
    }
    for (let i = 0; i < count; i++)
      for (let j = 0; j < radialSteps; j++) {
        const a = i * radialSteps + j,
          b = i * radialSteps + ((j + 1) % radialSteps),
          c = (i + 1) * radialSteps + j,
          d = (i + 1) * radialSteps + ((j + 1) % radialSteps);
        indices.push(a, b, c, b, d, c);
      }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = add(geo, material, 0, 0, 0);
    return mesh;
  }

  // Front radome and the central fuselage. The central body becomes broad
  // behind the cockpit, then narrows smoothly into the tail section.
  loft(
    [
      [-9.8, 0.018, 0.018, 0.04],
      [-9.25, 0.105, 0.105, 0.04],
      [-8.2, 0.27, 0.25, 0.045],
      [-7.2, 0.39, 0.34, 0.04],
    ],
    radome,
    0,
    9,
    40
  );
  loft(
    [
      [-7.35, 0.39, 0.34, 0.04],
      [-6.15, 0.51, 0.43, 0.03],
      [-4.7, 0.69, 0.55, -0.005],
      [-3.0, 0.91, 0.68, -0.045],
      [-1.0, 1.13, 0.78, -0.075],
      [1.1, 1.27, 0.82, -0.085],
      [3.2, 1.16, 0.76, -0.09],
      [5.1, 0.92, 0.65, -0.09],
      [6.6, 0.62, 0.49, -0.08],
      [7.55, 0.18, 0.2, -0.07],
    ],
    skin,
    0,
    8,
    48
  );

  // The RD-33 nacelles sit low beneath the wing-root shoulders. Their upper
  // contours blend into the broad centre body; only the compact lower lips
  // and two exhaust outlets remain visually distinct. Exhaust centres rise
  // back to the rear-fuselage centreline, as on the 9.12 silhouette.
  const engineGroups = [];
  for (const sign of [-1, 1]) {
    const cx = sign * 1.08,
      eg = new T.Group();
    eg.position.x = cx;
    root.add(eg);
    engineGroups.push(eg);
    loft(
      [
        [-3.15, 0.025, 0.025, -0.25],
        [-2.75, 0.27, 0.23, -0.42],
        [-2.15, 0.43, 0.36, -0.48],
        [-1.0, 0.52, 0.43, -0.5],
        [1.5, 0.55, 0.46, -0.49],
        [4.4, 0.53, 0.44, -0.4],
        [6.2, 0.48, 0.4, -0.22],
        [7.25, 0.4, 0.34, -0.08],
        [7.75, 0.32, 0.27, 0],
      ],
      skin,
      0,
      8,
      40
    ); // create loft, then attach it to this engine group
    const nacelle = root.children[root.children.length - 1];
    root.remove(nacelle);
    eg.add(nacelle);
    nacelle.position.x = 0;

    // Recessed intake opening is smaller and lower, beneath the wing root.
    const mouth = add(new T.CircleGeometry(0.425, 32), dark, 0, -0.43, -2.72, eg);
    mouth.scale.set(0.99, 0.76, 1);
    const lip = add(new T.TorusGeometry(0.405, 0.027, 8, 36), metal, 0, -0.43, -2.735, eg);
    lip.scale.set(1, 0.77, 1);

    // Exhaust outlets stay near the rear-fuselage centreline rather than
    // following the lowered front/middle nacelle body.
    const nozzle = add(new T.CylinderGeometry(0.395, 0.435, 0.58, 32, 1, true), dark, 0, 0, 7.48, eg);
    nozzle.rotation.x = Math.PI / 2;
    add(new T.TorusGeometry(0.405, 0.03, 8, 32), metal, 0, 0, 7.79, eg);
    const inner = add(new T.CircleGeometry(0.36, 32), dark, 0, 0, 7.8, eg);
    const flame = add(
      new T.ConeGeometry(0.28, 2.2, 16, 1, true),
      new T.MeshBasicMaterial({
        color: 0xffa34a,
        transparent: true,
        opacity: 0.76,
        blending: T.AdditiveBlending,
        depthWrite: false,
        side: T.DoubleSide,
      }),
      0,
      0,
      9.0,
      eg
    );
    flame.rotation.x = Math.PI / 2;
    flame.visible = false;
    eg.userData.flame = flame;

    // Paired lower anti-spin fins remain discreet and close to the underside.
    const vfShape = new T.Shape();
    vfShape.moveTo(0, 0);
    vfShape.lineTo(0.95, 0);
    vfShape.lineTo(0.62, -0.52);
    vfShape.lineTo(0.22, -0.43);
    vfShape.closePath();
    const vf = add(new T.ShapeGeometry(vfShape), underside, sign * 0.82, -0.7, 5.18);
    vf.rotation.y = Math.PI;
  }

  // Canopy: a low, elongated bubble integrated into the upper fuselage.
  const canopyGeo = new T.SphereGeometry(1, 40, 24, 0, Math.PI * 2, 0, Math.PI / 2);
  canopyGeo.scale(0.62, 0.52, 1.58);
  add(canopyGeo, canopy, 0, 0.59, -3.42);
  // Fine canopy sill only; avoid oversized frames and external boxes.
  const sill = add(new T.TorusGeometry(0.58, 0.025, 8, 48), metal, 0, 0.49, -3.42);
  sill.scale.set(1, 0.35, 2.65);
  sill.rotation.x = Math.PI / 2;

  // Curved, swept wings with a subtle bevel. The planform carries the
  // recognisable MiG-29 sweep and broad root extensions without extra slabs.
  function wing(sign, pointsFn, material, y, bevel = 0.075) {
    const s = new T.Shape();
    pointsFn(s, sign);
    const geo = new T.ExtrudeGeometry(s, {
      depth: 0.15,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: 0.055,
      curveSegments: 12,
    });
    geo.rotateX(Math.PI / 2);
    const mesh = add(geo, material, 0, y, 0);
    return mesh;
  }
  const wingOutline = (s, sign) => {
    s.moveTo(sign * 0.72, -3.45);
    s.quadraticCurveTo(sign * 1.65, -2.05, sign * 4.68, 0.62);
    s.quadraticCurveTo(sign * 5.12, 1.02, sign * 5.0, 1.52);
    s.quadraticCurveTo(sign * 4.92, 1.78, sign * 4.48, 1.72);
    s.quadraticCurveTo(sign * 2.72, 1.35, sign * 1.12, 0.93);
    s.quadraticCurveTo(sign * 0.72, 0.65, sign * 0.72, -3.45);
    s.closePath();
  };
  wing(-1, wingOutline, skin, -0.1, 0.09);
  wing(1, wingOutline, skin, -0.1, 0.09);

  // Horizontal stabilators: smaller, clean swept surfaces aft of the wings.
  const tailOutline = (s, sign) => {
    s.moveTo(sign * 0.65, 4.72);
    s.quadraticCurveTo(sign * 1.2, 4.9, sign * 2.85, 6.05);
    s.quadraticCurveTo(sign * 3.1, 6.24, sign * 2.94, 6.48);
    s.quadraticCurveTo(sign * 2.72, 6.6, sign * 2.48, 6.47);
    s.quadraticCurveTo(sign * 1.25, 5.98, sign * 0.68, 5.72);
    s.closePath();
  };
  wing(-1, tailOutline, skinLight, -0.03, 0.045);
  wing(1, tailOutline, skinLight, -0.03, 0.045);

  // Two separately constructed, lightly canted vertical stabilizers.
  // Extrusion gives each fin a visible root/edge so neither disappears as a
  // single zero-thickness plane at common chase-camera angles.
  const finProfile = new T.Shape();
  finProfile.moveTo(-4.45, 0.12); // local x maps to -world Z
  finProfile.lineTo(-7.45, 0.18);
  finProfile.quadraticCurveTo(-7.18, 1.45, -6.25, 2.52);
  finProfile.lineTo(-5.18, 2.32);
  finProfile.quadraticCurveTo(-4.85, 1.1, -4.45, 0.12);
  finProfile.closePath();
  const finGeometry = new T.ExtrudeGeometry(finProfile, {
    depth: 0.085,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.018,
    bevelThickness: 0.012,
    curveSegments: 16,
  });
  finGeometry.translate(0, 0, -0.0425);
  for (const sign of [-1, 1]) {
    const fin = add(finGeometry.clone(), skin, sign * 1.58, 0.02, 0);
    fin.name = sign < 0 ? 'vertical_tail_left' : 'vertical_tail_right';
    fin.rotation.order = 'XYZ';
    fin.rotation.y = Math.PI / 2;
    fin.rotation.z = -sign * 0.085;
  }

  // No dummy service blocks, conspicuous pylons, tanks or oversized fittings.
  // Only discreet wingtip lamps remain as small readability cues.
  for (const sign of [-1, 1]) {
    add(new T.SphereGeometry(0.045, 10, 8), mat(sign > 0 ? 0x3bbd78 : 0xd95750, 0.05, 0.36), sign * 4.91, -0.005, 1.47);
  }

  // Restrained nose probe and compact, functional-looking landing gear.
  const probe = add(new T.CylinderGeometry(0.014, 0.009, 0.58, 8), metal, 0, 0.035, -10.0);
  probe.rotation.x = -Math.PI / 2;
  const gear = new T.Group();
  root.add(gear);
  function wheel(x, y, z, r = 0.15) {
    add(new T.CylinderGeometry(0.035, 0.05, 0.66, 10), metal, x, y + 0.28, z, gear);
    const tyre = add(new T.CylinderGeometry(r, r, 0.12, 16), rubber, x, y - 0.08, z, gear);
    tyre.rotation.z = Math.PI / 2;
    const hub = add(new T.CylinderGeometry(r * 0.48, r * 0.48, 0.125, 12), metal, x, y - 0.08, z, gear);
    hub.rotation.z = Math.PI / 2;
  }
  wheel(0, -0.89, -5.25, 0.13);
  wheel(-1.04, -0.83, 2.35, 0.17);
  wheel(1.04, -0.83, 2.35, 0.17);
  gear.visible = !!opts.gearDown;
  root.userData.setGear = on => {
    gear.visible = !!on;
  };
  root.userData.setAfterburner = on =>
    engineGroups.forEach(g => {
      if (g.userData.flame) g.userData.flame.visible = !!on;
    });
  root.userData.parts = { gear, engineGroups };
  if (opts.scale) root.scale.setScalar(opts.scale);
  return root;
}
// MiG-29 GLB 데이터는 파일 맨 아래 <script id="asset-mig29-glb"> 블록에 있음 (readAsset 로 읽음)

