/* ===== 쿠즈네초프급 항모 (아케이드용, 실제 크기 약 300m) =====
   좌표: 기수 -Z, 위 +Y, 수선(물에 닿는 선) y=0, 비행갑판 y=20, 함교는 우현(+X)
   const ship = createKuznetsov();  scene.add(ship);
   ship.userData.setSpeed(m/s);  // 물보라·航跡 세기
   ship.userData.update(dt);     // 매 프레임 호출 (레이더 회전, 물보라) */
function createKuznetsov() {
  const g = new THREE.Group();
  const mk = c =>
    new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.8,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });
  const gray = mk(0x8b949d),
    red = mk(0x7a2a24),
    dark = mk(0x474d54),
    light = mk(0xb9c0c7),
    black = mk(0x24282d);
  const add = (p, geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    p.add(m);
    return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const lerpT = (T, z) => {
    if (z <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++)
      if (z <= T[i][0]) {
        const a = T[i - 1],
          b = T[i];
        return a[1] + ((b[1] - a[1]) * (z - a[0])) / (b[0] - a[0]);
      }
    return T[T.length - 1][1];
  };
  const PORT = [
    [-152, 0],
    [-142, -5],
    [-128, -12],
    [-110, -19],
    [-92, -24],
    [-60, -28],
    [-20, -30],
    [10, -34],
    [70, -40],
    [130, -42],
    [150, -30],
  ];
  const STBD = [
    [-152, 0],
    [-142, 5],
    [-128, 12],
    [-110, 19],
    [-92, 24],
    [-60, 28],
    [120, 28],
    [150, 22],
  ];
  const HULLW = [
    [-148, 0],
    [-130, 11],
    [-95, 17],
    [-60, 18],
    [100, 18],
    [138, 16],
  ];
  const DY = 20,
    RZ = -92; // 갑판 높이, 스키점프 시작 z
  const rampY = z => (z < RZ ? 7.5 * Math.pow((RZ - z) / 60, 2) : 0); // 스키점프: 끝 각도 약 14도

  // 선체 (수중 붉은색 + 수상 회색), 평면 윤곽을 아래로 압출
  const slab = (pts, depth, sx) => {
    const s = new THREE.Shape();
    pts.forEach((p, i) => (i ? s.lineTo(p[0] * (sx || 1), p[1]) : s.moveTo(p[0] * (sx || 1), p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    return geo;
  };
  const hp = [
    [0, -148],
    [11, -130],
    [17, -95],
    [18, -60],
    [18, 100],
    [16, 138],
    [-16, 140],
    [-18, 100],
    [-18, -60],
    [-17, -95],
    [-11, -130],
  ];
  const fw = z => {
    const wd = Math.max(0.01, lerpT(HULLW, Math.min(z, 138)));
    return [wd, wd * (z < -90 ? 0.78 : 0.86)];
  };
  const hx = (z, y) => {
    const [wd, ww] = fw(z);
    return ww + ((wd - ww) * (y - 2.5)) / 17.35;
  };
  const ST = [-150, -142, -130, -115, -95, -70, -40, 0, 60, 100, 125, 138, 140];
  const ring = z => {
    const [wd, ww] = fw(z),
      wk = ww * 0.55,
      dk = 9.5 - (z < -95 ? 6.5 * Math.min(1, (-95 - z) / 55) : 0),
      yT = DY - 0.15;
    return [
      [-wd, yT],
      [wd, yT],
      [ww, 2.5],
      [wk, -dk],
      [-wk, -dk],
      [-ww, 2.5],
    ];
  };
  const loft = (edges, cap) => {
    const pos = [],
      idx = [];
    ST.forEach(z => ring(z).forEach(v => pos.push(v[0], v[1], z)));
    for (let i = 0; i < ST.length - 1; i++)
      edges.forEach(([a, b]) => {
        const r = i * 6,
          q = r + 6;
        idx.push(r + a, r + b, q + a, r + b, q + b, q + a);
      });
    const e = (ST.length - 1) * 6;
    cap.forEach(c => idx.push(e + c[0], e + c[1], e + c[2]));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  };
  add(
    g,
    loft(
      [
        [1, 2],
        [5, 0],
      ],
      [
        [0, 1, 2],
        [0, 2, 5],
      ]
    ),
    gray,
    0,
    0,
    0
  ); // 상부 선체: 함수 플레어 + 회색 측면
  const wnd = box(0.3, 1.1, 7); // 선체 측면 창문/포트 띠
  [1, -1].forEach(sd => {
    for (let z = -108; z <= 128; z += 12) add(g, wnd, black, sd * (hx(z, 16) + 0.1), 16, z);
  });
  add(
    g,
    loft(
      [
        [2, 3],
        [3, 4],
        [4, 5],
      ],
      [
        [5, 2, 3],
        [5, 3, 4],
      ]
    ),
    red,
    0,
    0,
    0
  ); // 하부 선체(적색)
  add(
    g,
    slab(
      [
        [-17, 10],
        [-34, 10],
        [-40, 70],
        [-41, 130],
        [-17, 135],
      ],
      4
    ),
    dark,
    0,
    19,
    0
  ); // 좌현 사각갑판 지지부

  // 비행갑판 (사각갑판 + 스키점프 곡면)
  const zs = [];
  for (let z = -152; z <= 148; z += 4) zs.push(z);
  [-135, -100, -92, 10, 70, 150].forEach(z => zs.push(z));
  zs.sort((a, b) => a - b);
  for (let i = zs.length - 1; i > 0; i--) if (zs[i] === zs[i - 1]) zs.splice(i, 1);
  const P = [],
    U = [],
    Q = [],
    I = [],
    J = [];
  zs.forEach(z => {
    const xl = lerpT(PORT, z),
      xr = lerpT(STBD, z),
      y = DY + rampY(z),
      v = 1 - (z + 152) / 302;
    P.push(xl, y, z, xr, y, z);
    U.push((xl + 45) / 90, v, (xr + 45) / 90, v);
    Q.push(xl, DY - 2, z, xr, DY - 2, z, xl, y, z, xr, y, z);
  });
  for (let i = 0; i < zs.length - 1; i++) {
    const a = 2 * i,
      b = a + 2,
      c = 4 * i,
      d = c + 4;
    I.push(a, a + 1, b, a + 1, b + 1, b);
    J.push(c, c + 1, d, c + 1, d + 1, d, c, c + 2, d, c + 2, d + 2, d, c + 1, c + 3, d + 1, c + 3, d + 3, d + 1);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  dg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  dg.setIndex(I);
  dg.computeVertexNormals();
  const tex = deckTexture();
  tex.anisotropy = 4;
  g.add(new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide })));
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute(Q, 3));
  bg.setIndex(J);
  bg.computeVertexNormals();
  g.add(new THREE.Mesh(bg, dark));

  // 함교(우현): 본체, 조타실, 마스트, 회전 레이더, 연돌, 마르스-파사트 평면 레이더
  const isl = new THREE.Group();
  isl.position.set(24, DY, 0);
  g.add(isl);
  add(isl, box(12, 13, 48), gray, 0, 6.5, 20);
  add(isl, box(10, 9, 26), light, 0, 17.5, 8);
  add(isl, box(10.2, 2.2, 0.4), black, 0, 19.5, -5.1);
  add(isl, box(4, 14, 4), gray, 0, 29, 10);
  add(isl, box(8, 0.8, 8), dark, 0, 36.4, 10);
  const radar = add(isl, box(9, 3, 0.5), light, 0, 38.8, 10);
  add(isl, box(8, 10, 12), dark, 0, 18, 34);
  add(isl, box(8.4, 0.6, 12.4), black, 0, 23.2, 34);
  [
    [5.3, 3],
    [5.3, 15],
    [-5.3, 3],
    [-5.3, 15],
  ].forEach(p => add(isl, box(0.5, 6, 6), black, p[0], 17.5, p[1]));
  // 함교 디테일: 브리지 윙, 창문띠, 평면 위상배열 레이더 4면, 구형 레이돔
  [-1, 1].forEach(sg => {
    add(isl, box(3, 0.5, 7), dark, sg * 6.5, 15.2, 8);
    add(isl, box(0.15, 1.6, 22), black, sg * 5.1, 19, 8);
    const pa = add(isl, box(5.2, 5.2, 0.5), light, sg * 2.9, 28, 8.4);
    pa.rotation.y = sg * 0.6;
    const pb = add(isl, box(5.2, 5.2, 0.5), light, sg * 2.9, 28, 11.6);
    pb.rotation.y = -sg * 0.6;
  });
  add(isl, new THREE.SphereGeometry(2.4, 16, 12), light, 0, 42.4, 10);
  // 갑판 가장자리 접이식 안테나 + 우현 X형 마스트
  const rod = new THREE.CylinderGeometry(0.13, 0.13, 7, 4);
  rod.rotateZ(Math.PI / 2);
  [1, -1].forEach(sd => {
    for (let z = -110; z <= 110; z += 16)
      if (!(sd > 0 && z > -12 && z < 50)) add(g, rod, black, lerpT(sd > 0 ? STBD : PORT, z) + sd * 3.3, DY - 0.6, z);
  });
  const xm = new THREE.Group();
  xm.position.set(lerpT(STBD, -31) - 1.5, DY, -31);
  g.add(xm);
  add(xm, new THREE.CylinderGeometry(0.3, 0.4, 24, 6), dark, 0, 12, 0);
  [-1, 1].forEach(sg => {
    const y = add(xm, box(0.25, 0.25, 13), light, 0, 19, 0);
    y.rotation.x = sg * 0.75;
  });

  // 칸쉬탄 CIWS 8기 (개략 배치)
  const kashtan = (sd, z) => {
    const k = new THREE.Group();
    k.position.set(lerpT(sd > 0 ? STBD : PORT, z) + sd * 2.5, DY - 2.5, z);
    g.add(k);
    add(k, box(5, 0.8, 6), dark, 0, -0.4, 0);
    {
      const gap = Math.abs(k.position.x) - lerpT(HULLW, z),
        w = gap + 2.5;
      add(k, box(w, 5, 5.6), dark, (-sd * (gap - 2.5)) / 2, -3.3, 0);
    } // 선체와 이어지는 스폰슨 받침
    add(k, new THREE.CylinderGeometry(1.4, 1.6, 1, 10), dark, 0, 0.5, 0);
    add(k, box(2.4, 2.2, 3), gray, 0, 2.1, 0);
    [-0.5, 0.5].forEach(o => {
      const b = new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6);
      b.rotateX(Math.PI / 2);
      add(k, b, black, o, 2.6, -2.8);
    });
    [-1.7, 1.7].forEach(o => add(k, box(0.9, 1.1, 2.2), light, o, 2.6, 0.2));
  };
  [-104, -40, 75, 130].forEach(z => kashtan(1, z));
  [-104, -48, 60, 125].forEach(z => kashtan(-1, z));
  // RBU-12000 대잠 로켓 발사기 2기 (함수 양측)
  [1, -1].forEach(sd => {
    const r = new THREE.Group();
    r.position.set(lerpT(sd > 0 ? STBD : PORT, -122) + sd * 2, DY - 1.5, -122);
    g.add(r);
    add(r, box(3.6, 1.2, 3.4), dark, 0, 0, 0);
    {
      const gap = Math.abs(r.position.x) - lerpT(HULLW, -122),
        w = gap + 1.8;
      add(r, box(w, 3, 3.4), dark, (-sd * (gap - 1.8)) / 2, -2.1, 0);
    }
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 2; j++) {
        const t = new THREE.CylinderGeometry(0.22, 0.22, 3, 6);
        t.rotateX(-0.9);
        add(r, t, black, -1.2 + i * 0.6, 1.2, -0.6 + j * 0.9);
      }
  });

  // 함번호 063
  const nc = document.createElement('canvas');
  nc.width = 256;
  nc.height = 128;
  const nx = nc.getContext('2d');
  nx.fillStyle = '#f2f2f2';
  nx.font = 'bold 96px sans-serif';
  nx.textAlign = 'center';
  nx.textBaseline = 'middle';
  nx.fillText('063', 128, 68);
  const nm = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(nc), transparent: true });
  [1, -1].forEach(sd => {
    const n = add(g, new THREE.PlaneGeometry(10, 5), nm, (hx(-100, 11) + 0.6) * sd, 11, -100);
    n.rotation.y = sd > 0 ? Math.PI / 2 : -Math.PI / 2;
  });

  // 航跡(항적) + 뱃머리 물보라
  const wake = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 620).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, depthWrite: false })
  );
  wake.position.set(0, 0.6, 140);
  wake.name = 'cv_wake'; // 13-carrier-glb 가 남겨두는 효과
  g.add(wake);
  const N = 600,
    pos = new Float32Array(N * 3).fill(-1000),
    vel = new Float32Array(N * 3),
    life = new Float32Array(N);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dc = document.createElement('canvas');
  dc.width = dc.height = 64;
  const dx = dc.getContext('2d'),
    gr = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  dx.fillStyle = gr;
  dx.fillRect(0, 0, 64, 64);
  const spray = new THREE.Points(
    pg,
    new THREE.PointsMaterial({
      map: new THREE.CanvasTexture(dc),
      size: 14,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  spray.frustumCulled = false;
  spray.name = 'cv_spray';
  g.add(spray);
  let speed = 14,
    acc = 0,
    cur = 0;
  g.userData.setSpeed = v => {
    speed = v;
    wake.visible = v > 0;
  };
  g.userData.update = dt => {
    radar.rotation.y += dt * 2.2;
    acc += speed > 0 ? dt * (30 + speed * 6) : 0;
    while (acc >= 1) {
      acc--;
      cur = (cur + 1) % N;
      const sd = Math.random() < 0.5 ? -1 : 1,
        z = -135 + Math.random() * 50,
        k = cur * 3;
      pos[k] = sd * (lerpT(HULLW, z) + 0.5);
      pos[k + 1] = 0.3;
      pos[k + 2] = z;
      vel[k] = sd * (2 + Math.random() * 4);
      vel[k + 1] = 5 + Math.random() * 6;
      vel[k + 2] = speed * 0.6 + Math.random() * 6;
      life[cur] = 1 + Math.random() * 0.8;
    }
    for (let i = 0; i < N; i++)
      if (life[i] > 0) {
        const k = i * 3;
        pos[k] += vel[k] * dt;
        pos[k + 1] += vel[k + 1] * dt;
        pos[k + 2] += vel[k + 2] * dt;
        vel[k + 1] -= 9.8 * dt;
        life[i] -= dt;
        if (life[i] <= 0 || pos[k + 1] < 0) {
          life[i] = 0;
          pos[k + 1] = -1000;
        }
      }
    pg.attributes.position.needsUpdate = true;
  };
  g.userData.deckEdges = z => [lerpT(PORT, z), lerpT(STBD, z)];
  g.userData.setSpeed(speed);
  return g;

  // 갑판 도색: 이륙선, 착함 중심선(7도), 착함줄 4개, 엘리베이터 2개, P-700 해치 12개, 킨잘 VLS 3기, 헬기 착륙원
  function deckTexture() {
    const W = 512,
      H = 1536,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const X = m => ((m + 45) / 90) * W,
      Z = m => ((m + 152) / 302) * H,
      S = W / 90;
    const line = (x1, z1, x2, z2, col, w) => {
      x.strokeStyle = col;
      x.lineWidth = w;
      x.beginPath();
      x.moveTo(X(x1), Z(z1));
      x.lineTo(X(x2), Z(z2));
      x.stroke();
    };
    x.fillStyle = '#5b6168';
    x.fillRect(0, 0, W, H);
    [
      [18, -45],
      [18, 95],
    ].forEach(e => {
      x.fillStyle = '#6c737a';
      x.fillRect(X(e[0] - 7), Z(e[1] - 10), 14 * S, (20 * H) / 302);
      x.strokeStyle = '#e0c040';
      x.lineWidth = 2;
      x.strokeRect(X(e[0] - 7), Z(e[1] - 10), 14 * S, (20 * H) / 302);
    });
    x.setLineDash([14, 10]);
    line(0, -152, 0, -60, '#eee', 3);
    line(-9, -92, -9, -60, '#eee', 2);
    line(9, -92, 9, -60, '#eee', 2);
    const t = Math.tan((7 * Math.PI) / 180);
    line(6, 150, 6 - t * 170, -20, '#fff', 3);
    x.setLineDash([]);
    [-12, 12].forEach(o => line(6 + o, 150, 6 + o - t * 170, -20, '#b83a2e', 3));
    [96, 108, 120, 132].forEach(z => {
      const cx = 6 - t * (150 - z);
      line(cx - 11, z + 1.3, cx + 11, z - 1.3, '#f4f4f4', 3);
    });
    x.fillStyle = '#262a2f';
    [-4.5, 4.5].forEach(cx => {
      for (let r = 0; r < 6; r++) x.fillRect(X(cx - 2), Z(-134 + r * 6 - 2), 4 * S, (4 * H) / 302);
    });
    [
      [-14, -70],
      [14, -70],
      [-22, -48],
    ].forEach(p => {
      x.fillStyle = '#33383e';
      x.beginPath();
      x.arc(X(p[0]), Z(p[1]), 4.5 * S, 0, 7);
      x.fill();
      x.fillStyle = '#8b939b';
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        x.beginPath();
        x.arc(X(p[0]) + Math.cos(a) * 2.6 * S, Z(p[1]) + Math.sin(a) * 2.6 * S, 1.1 * S, 0, 7);
        x.fill();
      }
    });
    [
      [20, 68],
      [-28, 40],
    ].forEach(p => {
      x.strokeStyle = '#f4f4f4';
      x.lineWidth = 3;
      x.beginPath();
      x.arc(X(p[0]), Z(p[1]), 6 * S, 0, 7);
      x.stroke();
      x.beginPath();
      x.arc(X(p[0]), Z(p[1]), 2 * S, 0, 7);
      x.stroke();
    });
    return new THREE.CanvasTexture(c);
  }
  function wakeTexture() {
    const W = 256,
      H = 1024,
      c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const x = c.getContext('2d');
    const X = m => ((m + 100) / 200) * W,
      Z = m => ((m + 170) / 620) * H;
    [
      [7, 0.12],
      [4, 0.25],
      [2, 0.45],
    ].forEach(([w, a]) =>
      [-1, 1].forEach(s => {
        x.strokeStyle = 'rgba(255,255,255,' + a + ')';
        x.lineWidth = w;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(X(s * 13), Z(-135));
        x.lineTo(X(s * 21), Z(-70));
        x.lineTo(X(s * 20), Z(60));
        x.lineTo(X(s * 18), Z(150));
        x.stroke();
        x.strokeStyle = 'rgba(255,255,255,' + a * 0.5 + ')';
        x.beginPath();
        x.moveTo(X(s * 20), Z(-100));
        x.lineTo(X(s * 98), Z(250));
        x.stroke();
      })
    );
    for (let i = 0; i < 1400; i++) {
      const z = 140 + Math.random() * 310,
        w = 12 + (z - 140) * 0.05,
        px = (Math.random() - 0.5) * 2 * w;
      x.fillStyle = 'rgba(255,255,255,' + 0.5 * (1 - (z - 140) / 310) + ')';
      x.beginPath();
      x.arc(X(px), Z(z), 1 + Math.random() * 3, 0, 7);
      x.fill();
    }
    return new THREE.CanvasTexture(c);
  }
}
