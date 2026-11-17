/* ===== 지형 높이장 · AIRBASE 29 =====
   One deterministic height function drives the terrain mesh, aircraft ground clearance,
   and simplified line-of-sight masking. These are game-world units, not geographic data.
*/
function terrainHeightAt(x, z) {
  const r = Math.hypot(x, z);
  if (r < 5200) return 0; // level AIRBASE 29 runway / inner apron
  const fade = Math.min(1, Math.max(0, (r - 5200) / 9000));
  const wave =
    Math.sin(x * 0.00019 + Math.cos(z * 0.00011)) * 95 +
    Math.cos(z * 0.00023 - x * 0.00007) * 68 +
    Math.sin((x + z) * 0.00043) * 28;
  const rolling = fade * (Math.max(-18, wave) + Math.max(0, r - 18000) * 0.004);
  // Broad fictional landforms: an elongated ridge and a shallow valley.
  const ridgeAxis = x - 20500 + (z + 14000) * 0.28;
  const ridge = 190 * Math.exp(-((ridgeAxis / 4200) ** 2)) * Math.exp(-(((z + 14000) / 18000) ** 2));
  const valley = -115 * Math.exp(-(((x + 17500) / 6500) ** 2 + ((z - 15000) / 7000) ** 2));
  // The far perimeter slopes below the sea datum, creating a simple coastal shelf.
  const coastDrop = Math.max(0, r - 40000) * 0.085;
  return rolling + ridge + valley - coastDrop;
}

/* ===== LAND AIRBASE — DEV 02 =====
   Arcade environment for the land-based MiG-29 9.12 training sequence.
   Runway axis: takeoff toward -Z, landing toward +Z.
*/
function createAirbase() {
  const root = new T.Group();
  const std = (color, roughness = 0.86, metalness = 0.025) =>
    new T.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  const concrete = std(0x646b6d),
    runway = std(0x252c31),
    mark = std(0xe5e5dc),
    yellow = std(0xd0b34d),
    roof = std(0x59646a),
    wall = std(0xb9b9ad),
    glass = std(0x476874, 0.28, 0.18),
    dark = std(0x283238),
    light = new T.MeshBasicMaterial({ color: 0xa6ffd8 }),
    redLight = new T.MeshBasicMaterial({ color: 0xff5b4d });
  const add = (geo, mat, x = 0, y = 0, z = 0, par = root) => {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    par.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z, par = root) => add(new T.BoxGeometry(w, h, d), mat, x, y, z, par);

  // A new continental test range, not the old sea plane with an airstrip placed on it.
  // The airport's central 5.2 km radius is kept level; low rolling terrain begins outside it.
  const size = 100000,
    half = size / 2,
    seg = 180,
    positions = [],
    colors = [],
    indices = [];
  const cLow = new T.Color(0x687553),
    cMid = new T.Color(0x7c865c),
    cHigh = new T.Color(0x7e8174);
  function heightAt(x, z) {
    return terrainHeightAt(x, z);
  }
  for (let iz = 0; iz <= seg; iz++) {
    const z = -half + (size * iz) / seg;
    for (let ix = 0; ix <= seg; ix++) {
      const x = -half + (size * ix) / seg,
        h = heightAt(x, z);
      positions.push(x, h, z);
      const c =
        h < 60 ? cLow.clone().lerp(cMid, Math.max(0, h / 120)) : cMid.clone().lerp(cHigh, Math.min(1, (h - 60) / 260));
      const variation = 0.965 + 0.035 * Math.sin(x * 0.0017) * Math.cos(z * 0.0013);
      c.multiplyScalar(variation);
      colors.push(c.r, c.g, c.b);
      if (ix < seg && iz < seg) {
        const i = iz * (seg + 1) + ix;
        indices.push(i, i + seg + 1, i + 1, i + 1, i + seg + 1, i + seg + 2);
      }
    }
  }
  const terrainGeo = new T.BufferGeometry();
  terrainGeo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  terrainGeo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  terrainGeo.setIndex(indices);
  terrainGeo.computeVertexNormals();
  const terrainMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: false });
  // Terrain surface is the AIRBASE 29 ground datum (Y=0); runway slab and landing-gear contact are authored against this level.
  const terrain = add(terrainGeo, terrainMat, 0, 0, 0);
  terrain.receiveShadow = true;
  root.userData.terrain = terrain;
  // A water annulus sits outside the inland terrain and leaves the airbase basin unobstructed.
  const coastWater = new T.Mesh(
    new T.RingGeometry(40800, 80000, 128),
    new T.MeshStandardMaterial({ color: 0x1d6285, roughness: 0.42, metalness: 0.08, side: T.DoubleSide })
  );
  coastWater.rotation.x = -Math.PI / 2;
  coastWater.position.y = 0;
  root.add(coastWater);

  // Distant low-poly mountain ridges provide a distinct inland horizon.
  const mountainMat = std(0x737e7c),
    mountainFar = std(0x899594);
  for (let i = 0; i < 20; i++) {
    const ang = (i / 20) * Math.PI * 2 + (rnd() - 0.5) * 0.12,
      dist = 20500 + rnd() * 10500,
      r = 1400 + rnd() * 2200,
      h = 650 + rnd() * 1400;
    const m = add(
      new T.ConeGeometry(r, h, 7, 2),
      i % 3 ? mountainMat : mountainFar,
      Math.sin(ang) * dist,
      h * 0.48,
      Math.cos(ang) * dist
    );
    m.rotation.y = rnd() * Math.PI;
  }

  // Agricultural plots and rural access roads around the flat airport basin.
  const fieldMats = [std(0x66764b), std(0x74794a), std(0x888057), std(0x5d704e)];
  [
    [-3100, -3200, 1500, 900],
    [-1300, -3800, 950, 520],
    [2450, -3100, 1300, 740],
    [3300, -1100, 900, 1250],
    [-3500, 1500, 850, 1250],
    [3200, 2700, 1100, 780],
  ].forEach((q, i) => {
    const [x, z, w, d] = q;
    const y = heightAt(x, z) - 0.1;
    const patch = box(w, 0.22, d, fieldMats[i % fieldMats.length], x, y, z);
    patch.rotation.y = i % 2 ? 0.12 : -0.08;
    for (let k = 0; k < 5; k++) box(3, 0.28, d * 0.88, mark, x - w * 0.42 + k * w * 0.21, y + 0.15, z);
  });
  // Tree geometry is shared to keep the scene lightweight.
  const trunkGeo = new T.CylinderGeometry(1.3, 2, 12, 6),
    crownGeo = new T.ConeGeometry(8, 25, 7, 2),
    trunkMat = std(0x554535),
    crownMats = [std(0x405d42), std(0x4b6848), std(0x536d4a)];
  const treeRecords = [];
  for (let i = 0; i < 190; i++) {
    const ang = rnd() * Math.PI * 2,
      dist = 4300 + rnd() * 6500,
      x = Math.sin(ang) * dist,
      z = Math.cos(ang) * dist;
    if (Math.abs(x) < 1600 && Math.abs(z) < 2600) continue;
    treeRecords.push({
      x,
      z,
      y: heightAt(x, z),
      a: 0.75 + rnd() * 0.6,
      b: 1 + rnd() * 0.6,
      c: 0.9 + rnd() * 0.5,
      kind: i % 3,
    });
  }
  const dummy = new T.Object3D(),
    trunks = new T.InstancedMesh(trunkGeo, trunkMat, treeRecords.length),
    crowns = crownMats.map(mat => new T.InstancedMesh(crownGeo, mat, treeRecords.length));
  const crownCounts = [0, 0, 0];
  treeRecords.forEach((q, i) => {
    dummy.position.set(q.x, q.y + 4.5, q.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(q.a);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    const k = q.kind,
      j = crownCounts[k]++;
    dummy.position.set(q.x, q.y + 21.5, q.z);
    dummy.scale.set(q.b, q.c, q.b);
    dummy.updateMatrix();
    crowns[k].setMatrixAt(j, dummy.matrix);
  });
  trunks.instanceMatrix.needsUpdate = true;
  root.add(trunks);
  crowns.forEach((m, k) => {
    m.count = crownCounts[k];
    m.instanceMatrix.needsUpdate = true;
    root.add(m);
  });

  // Fictional arcade threat emitters. They are environmental gameplay objects, not replicas of real systems.
  const siteBase = std(0x4b5554),
    siteMetal = std(0x687778),
    siteDark = std(0x252f31);
  function addThreatSite(id, x, z) {
    const group = new T.Group();
    box(150, 14, 128, siteDark, 0, 8, 0, group);
    box(92, 26, 86, siteBase, 0, 27, 0, group);
    add(new T.CylinderGeometry(8, 13, 58, 8), siteMetal, 0, 68, 0, group);
    const dish = add(new T.TorusGeometry(25, 4, 6, 14), siteMetal, 0, 91, 0, group);
    dish.rotation.x = 0.62;
    add(new T.SphereGeometry(10, 8, 6), siteDark, 0, 91, 0, group);
    for (const sx of [-42, 42]) for (const sz of [-34, 34]) box(12, 18, 12, siteBase, sx, 23, sz, group);
    const lamp = add(new T.SphereGeometry(7, 8, 6), new T.MeshBasicMaterial({ color: 0x70d8a0 }), 0, 108, 0, group);
    const ground = heightAt(x, z);
    group.position.set(x, ground, z);
    root.add(group);
    GROUND_THREATS.push({
      id,
      root: group,
      origin: V(x, ground + 108, z),
      lamp,
      cooldown: 9 + rnd() * 5,
      detected: false,
      tracked: false,
      masked: false,
    });
  }
  addThreatSite('ECHO-1', 14500, -16000);
  addThreatSite('ECHO-2', -17500, 11500);
  addThreatSite('ECHO-3', 26000, 12000);

  // Flat military airfield basin.
  box(196, 0.55, 2760, concrete, 0, 0.32, 0);
  box(166, 0.34, 2700, runway, 0, 0.78, 0);
  box(2, 0.04, 2660, mark, -78, 0.97, 0);
  box(2, 0.04, 2660, mark, 78, 0.97, 0);
  for (let z = -1240; z <= 1240; z += 105) box(2, 0.045, 48, mark, 0, 0.98, z);
  for (const end of [-1, 1]) {
    const z = end * 1190;
    for (let x = -60; x <= 60; x += 20) box(8, 0.05, 58, mark, x, 0.99, z);
    if (end > 0)
      for (const x of [-88, 88])
        for (let dz = -1250; dz <= 1250; dz += 100) {
          const lamp = add(new T.SphereGeometry(3.1, 8, 6), light, x, 2.4, dz);
          lamp.scale.set(0.8, 0.45, 0.8);
        }
    for (const x of [-92, 92]) add(new T.SphereGeometry(4, 8, 6), redLight, x, 2.2, end * 1320);
  }
  // Taxiway and dispersal apron.
  box(62, 0.34, 650, concrete, 205, 0.55, 720);
  box(110, 0.34, 62, concrete, 150, 0.55, 415);
  box(110, 0.34, 62, concrete, 150, 0.55, 1010);
  box(600, 0.36, 480, concrete, 470, 0.56, 820);
  for (let i = 0; i < 4; i++) {
    const x = 280 + i * 125;
    box(2, 0.04, 190, mark, x, 0.77, 825);
    box(66, 0.04, 2, mark, x, 0.77, 730);
  }
  // Perimeter service road and a runway-side secondary road.
  box(2350, 0.18, 28, concrete, 0, 0.14, 1740);
  box(2350, 0.18, 28, concrete, 0, 0.14, -1740);
  box(28, 0.18, 3500, concrete, -1160, 0.14, 0);
  box(28, 0.18, 3500, concrete, 1160, 0.14, 0);
  box(28, 0.18, 1700, concrete, 340, 0.14, -2100);

  function hangar(x, z, shade = 0x59646a) {
    const g = new T.Group();
    root.add(g);
    g.position.set(x, 0, z);
    const hRoof = std(shade),
      hWall = std(0xb9b9ad);
    box(210, 74, 150, hWall, 0, 38, 0, g);
    box(226, 13, 166, hRoof, 0, 80, 0, g);
    box(152, 48, 4, dark, 0, 25, -77, g);
    box(8, 54, 8, hRoof, -78, 27, -78, g);
    box(8, 54, 8, hRoof, 78, 27, -78, g);
    for (let i = -2; i <= 2; i++) box(2, 74, 152, hRoof, i * 40, 38, 0, g);
    box(218, 5, 12, concrete, 0, 4, -82, g);
    for (let i = -3; i <= 3; i++) box(1.2, 1.2, 1.2, mark, i * 19, 5, -85, g);
  }
  hangar(-520, 850);
  hangar(-270, 850, 0x657078);
  hangar(-650, 1190, 0x4d585f);
  // Operations building, control tower, antenna mast and windsock.
  box(170, 34, 150, wall, 690, 18, 420);
  box(64, 118, 64, wall, 710, 92, 420);
  box(92, 30, 92, glass, 710, 158, 420);
  box(104, 7, 104, roof, 710, 177, 420);
  for (let y = 0; y < 3; y++) box(76, 2, 2, mark, 710, 145 + y * 9, 387);
  const mast = add(new T.CylinderGeometry(2, 3, 92, 8), roof, 900, 46, 520);
  const sock = add(new T.ConeGeometry(8, 58, 8, 1, true), yellow, 900, 94, 520);
  sock.rotation.z = Math.PI / 2;
  // Radar/communications mast and a compact vehicle apron (visual scenery only).
  add(new T.CylinderGeometry(2, 3, 125, 8), dark, -820, 62, 700);
  add(new T.SphereGeometry(14, 10, 8), concrete, -820, 128, 700);
  box(38, 18, 65, std(0x7a806f), 820, 9, 360);
  box(24, 12, 30, dark, 820, 24, 360);
  box(36, 2, 70, concrete, 820, 19, 360);
  // Boundary fence and gate posts.
  const fenceMat = std(0x8d9893, 0.55, 0.35);
  for (let x = -1060; x <= 1060; x += 70) {
    box(2, 13, 2, fenceMat, x, 6.5, 1600);
    box(2, 13, 2, fenceMat, x, 6.5, -1600);
  }
  for (let z = -1600; z <= 1600; z += 70) {
    box(2, 13, 2, fenceMat, -1060, 6.5, z);
    box(2, 13, 2, fenceMat, 1060, 6.5, z);
  }
  // AIRBASE 29 apron marking.
  const idCanvas = document.createElement('canvas');
  idCanvas.width = 256;
  idCanvas.height = 128;
  const ic = idCanvas.getContext('2d');
  ic.clearRect(0, 0, 256, 128);
  ic.fillStyle = '#f1f3ea';
  ic.font = 'bold 92px monospace';
  ic.textAlign = 'center';
  ic.fillText('29', 128, 98);
  const idTex = new T.CanvasTexture(idCanvas);
  idTex.encoding = T.sRGBEncoding;
  const idMat = new T.MeshBasicMaterial({ map: idTex, transparent: true, side: T.DoubleSide, depthWrite: false });
  const id = add(new T.PlaneGeometry(92, 46), idMat, 0, 1.01, 1090);
  id.rotation.x = -Math.PI / 2;
  root.userData.idTexture = idTex;
  root.userData.mapName = 'AIRBASE 29 — INLAND TEST RANGE';
  return root;
}
