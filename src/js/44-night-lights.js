// ===== 야간 조명 · 광학 착함 장치 (V15.0.0-alpha.6) — 갑판 조명 · 전투기 등은 밤(02-weather WX.tod === 'night')에만,
//      광학 착함 장치는 실제 항모처럼 낮에도 켜져 있다 =====
// 사용자 요청 (2026-11-18): "유도등도 달고, 고증이라면 우리 전투기에게 밤에만 켜지는 신호등도 달자"
//
// 항모 (CV 의 자식이라 배와 같이 움직인다. 좌표는 CV 로컬 = 실측 m, 함수 −z · 우현 +x — claude/kuznetsov_model_spec.md):
//   착함축    좌현으로 7.5° 꺾인 착함 구역의 가운데 선. 함미(z 152.25)에서 x −1.25 로 시작한다.
//             모델의 와이어 4줄(착함축 47 · 60 · 73 · 86 m)이 이 선 위에 오도록 위에서 찍은 화면으로 맞췄다.
//   중심선등  착함축을 따라 흰색 10 m 간격 · 착함 구역 가장자리등 ±13.5 m · 갑판 가장자리 파란 유도등 ·
//             스키점프 끝 초록 · 함미 아래로 늘어진 정렬등(드롭 라이트, 주황) · 함교 꼭대기 붉은 장애물등
//   광학 착함 장치 (러시아 「루나」 계열 — 색 체계 세부 자료가 부족해 미 해군 FLOLS 관례를 따른다):
//             좌현 착함 지점 옆. 가로 초록 기준등(데이텀) + 가운데 '공(볼)'. 공이 기준등과 같은 높이면 정상 강하각(3.5°),
//             위면 높음, 아래면 낮음, 많이 낮으면 공이 빨갛게 · 아주 낮으면 양옆 빨간 복행등(웨이브오프)이 깜빡인다.
//             목표는 착함축 66 m (2 · 3번 와이어 사이). 실물 크기(alpha.7): 좌현 가장자리에 선 장치, 렌즈 상자 2.4 m · 공 ±0.9 m ·
//             기준등 팔 각 4.6 m. 멀리서는 HUD 의 LOC / GS 안내(33-carrier-defense carrierGuide — 같은 착함축 · 강하각)를 보고,
//             가까이 와서 공을 본다(실제 '콜 더 볼'처럼). alpha.6 에서는 1 km 밖에서도 읽히게 크게 띄웠다가 허공에 떠 보여 고쳤다.
// 전투기 (플레이어 MiG-29 / Su-33): 왼쪽 날개 끝 빨강 · 오른쪽 초록 · 꼬리 흰색 항법등(계속 켜짐) +
//   등 · 배의 빨간 충돌방지등(깜빡임). 자리는 모델 꼭짓점에서 찾는다(모델 파일은 건드리지 않는다).
// 전부 화면 크기가 고정된 빛 점(Points)이라 멀리서도 점으로 보이고, 실제 광원이 아니라서 셰이더 · 성능에 영향이 없다.
// 판정과 무관하다 (rnd 를 쓰지 않음 · p.pos 는 읽기만).
const NL = { deck: null, lens: null, ball: null, wave: null, acs: new Map(), t: 0, glow: null };
const NL_A = (7.5 * Math.PI) / 180,
  NL_S0 = V(-1.25, 0, 152.25), // 함미에서 착함축이 시작하는 점
  NL_D = V(-Math.sin(NL_A), 0, -Math.cos(NL_A)), // 착함축 방향 (함수 쪽)
  NL_N = V(Math.cos(NL_A), 0, -Math.sin(NL_A)), // 착함축의 우현 쪽 수직
  NL_GS = (3.5 * Math.PI) / 180, // 강하각
  NL_TD = 66; // 착함 목표: 착함축 66 m
const nlAxis = s => NL_S0.clone().addScaledVector(NL_D, s);

function nlGlow() {
  if (NL.glow) return NL.glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d'),
    g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.16, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.42, 'rgba(255,255,255,0.3)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  return (NL.glow = t);
}
// [[x, y, z, 색], ...] → 빛 점 묶음 (그리기 호출 1번)
function nlPoints(list, size) {
  const pos = new Float32Array(list.length * 3),
    col = new Float32Array(list.length * 3);
  list.forEach((l, i) => {
    const c = new T.Color(l[3]);
    pos.set([l[0], l[1], l[2]], i * 3);
    col.set([c.r, c.g, c.b], i * 3);
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  const pt = new T.Points(
    g,
    new T.PointsMaterial({
      size,
      sizeAttenuation: false,
      map: nlGlow(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      fog: false,
      toneMapped: false,
    })
  );
  pt.frustumCulled = false;
  pt.renderOrder = 5;
  return pt;
}

// ---------- 항모 갑판 조명 · 광학 착함 장치 (처음 밤이 될 때 한 번 만든다)
function nlBuildCarrier() {
  if (NL.deck || !CV.userData.deckEdges) return;
  const L = [],
    DY = DECK_Y + 0.25,
    ramp = z => (typeof rampY === 'function' ? rampY(z) : 0);
  for (let s = 4; s <= 204; s += 10) {
    const q = nlAxis(s);
    L.push([q.x, DY, q.z, 0xfff1d6]); // 중심선 흰색
  }
  for (let s = 0; s <= 207; s += 15)
    for (const k of [-13.5, 13.5]) {
      const q = nlAxis(s).addScaledVector(NL_N, k);
      L.push([q.x, DY, q.z, 0xcfdcff]); // 착함 구역 가장자리
    }
  for (let z = -138; z <= 148; z += 18) {
    const e = CV.userData.deckEdges(z);
    for (const x of [e[0] + 1.2, e[1] - 1.2]) L.push([x, DECK_Y + ramp(z) + 0.25, z, 0x3a6dff]); // 갑판 가장자리 파란 유도등
  }
  const zl = -143,
    el = CV.userData.deckEdges(zl);
  for (let i = 0; i < 7; i++) L.push([el[0] + 3 + ((el[1] - el[0] - 6) * i) / 6, DECK_Y + ramp(zl) + 0.3, zl, 0x37ff6a]); // 스키점프 끝
  for (let i = 0; i < 5; i++) L.push([NL_S0.x, DECK_Y - 1.2 - i * 1.9, 152.6, 0xffb040]); // 함미 정렬등(드롭 라이트)
  // 함교 꼭대기 장애물등: 실측 모델에서 가장 높은 꼭짓점 (주기 기체 · 무장 제외)
  try {
    const inv = new T.Matrix4().copy(CV.matrixWorld).invert(),
      M = new T.Matrix4(),
      v = V(),
      top = V(0, -1, 0);
    CV.updateMatrixWorld(true);
    (typeof carrierGLB !== 'undefined' && carrierGLB ? carrierGLB : CV).traverse(o => {
      if (!o.isMesh || !o.geometry?.attributes?.position || /park|deck_aircraft/i.test(o.parent?.name || '')) return;
      M.multiplyMatrices(inv, o.matrixWorld);
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) {
        v.fromBufferAttribute(a, i).applyMatrix4(M);
        if (v.y > top.y && v.x > 5) top.copy(v); // 함교는 우현
      }
    });
    if (top.y > 30) L.push([top.x, top.y + 0.6, top.z, 0xff2a20]);
  } catch (e) {}
  NL.deck = nlPoints(L, 6);
  CV.add(NL.deck);
  // 광학 착함 장치 (alpha.7 — 사용자: "고증대로"): 좌현 갑판 가장자리, 착함 목표보다 조금 뒤에 선 실물 크기 장치.
  // 몸체(렌즈 상자 높이 2.4 m) 가운데가 갑판 위 1.8 m, 양옆 기준등 팔 각 4.6 m. 면은 착함축 뒤쪽(다가오는 기체)을 본다.
  // 공은 렌즈 상자 안에서만 움직인다(±0.9 m). 실물처럼 멀리서는 빛 덩어리로 보이고 가까이(수백 m) 와야 공의 높낮이가 읽힌다 —
  // 그 전까지는 HUD 의 LOC / GS 안내를 본다. 뒤나 옆에서는 몸체에 가려 빛이 안 보인다.
  const tz = nlAxis(NL_TD).z + 10,
    G = new T.Group(),
    housing = new T.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.8, metalness: 0.3 }),
    box = (w, h, d, x, y, z) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, d), housing);
      m.position.set(x, y, z);
      G.add(m);
    };
  G.name = 'OpticalLandingSystem';
  G.position.set(CV.userData.deckEdges(tz)[0] + 1.6, DECK_Y, tz);
  G.rotation.y = NL_A; // 앞면(+z)이 착함축 뒤쪽을 보게
  box(1.2, 2.4, 0.6, 0, 1.8, 0); // 렌즈 상자
  box(0.5, 0.6, 0.5, 0, 0.3, 0); // 받침
  for (const sg of [-1, 1]) box(4.6, 0.22, 0.3, sg * 3.0, 1.8, 0); // 기준등 팔
  const F = 0.34, // 앞면 바로 앞
    Y0 = 1.8,
    D = [];
  for (let i = 0; i < 5; i++) for (const sg of [-1, 1]) D.push([sg * (1.3 + i * 1.0), Y0, F, 0x2dff5a]);
  NL.lens = nlPoints(D, 7);
  NL.ball = nlPoints([[0, Y0, F + 0.02, 0xffffff]], 9);
  NL.ball.material.vertexColors = false;
  NL.ball.material.color.set(0xffb21e);
  NL.wave = nlPoints(
    [
      [-0.45, Y0 + 1.05, F, 0xff1a14],
      [0.45, Y0 + 1.05, F, 0xff1a14],
      [-0.45, Y0 - 1.05, F, 0xff1a14],
      [0.45, Y0 - 1.05, F, 0xff1a14],
    ],
    8
  );
  [NL.lens, NL.ball, NL.wave].forEach(o => (o.material.depthTest = true)); // 몸체 뒤에서는 가려진다
  G.add(NL.lens, NL.ball, NL.wave);
  NL.olsBody = G;
  CV.add(G);
}

// ---------- 전투기 항법등 · 충돌방지등 (모델 꼭짓점에서 자리를 찾는다)
function nlAircraftSpots(root) {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert(),
    M = new T.Matrix4(),
    v = V(),
    P = [];
  root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.transparent || m.blending === T.AdditiveBlending) return; // 애프터버너 불꽃 · 캐노피 유리 제외
    M.multiplyMatrices(inv, o.matrixWorld);
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i).applyMatrix4(M);
      P.push(v.x, v.y, v.z);
    }
  });
  if (P.length < 30) return null;
  let hs = 0,
    zmin = Infinity,
    zmax = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    hs = Math.max(hs, Math.abs(P[i]));
    zmin = Math.min(zmin, P[i + 2]);
    zmax = Math.max(zmax, P[i + 2]);
  }
  const Lz = zmax - zmin,
    zc = (zmin + zmax) / 2;
  const pick = (ok, score) => {
    let best = null,
      bs = -Infinity;
    for (let i = 0; i < P.length; i += 3)
      if (ok(P[i], P[i + 1], P[i + 2])) {
        const s = score(P[i], P[i + 1], P[i + 2]);
        if (s > bs) (bs = s), (best = V(P[i], P[i + 1], P[i + 2]));
      }
    return best;
  };
  const any = () => true,
    mid = (x, y, z) => Math.abs(x) < 0.08 * hs && z > zc - 0.15 * Lz && z < zc + 0.22 * Lz;
  const r = pick(any, x => x), // 오른쪽(+x) 날개 끝
    l = pick(any, x => -x),
    tail = pick((x, y, z) => Math.abs(x) < 0.15 * hs, (x, y, z) => z),
    top = pick(mid, (x, y) => y),
    bot = pick(mid, (x, y) => -y);
  if (!r || !l || !tail || !top || !bot) return null;
  return {
    green: r.add(V(0.12, 0, 0)),
    red: l.add(V(-0.12, 0, 0)),
    tail: tail.add(V(0, 0, 0.15)),
    top: top.add(V(0, 0.12, 0)),
    bot: bot.add(V(0, -0.12, 0)),
  };
}
// 기체 하나에 등을 단다 → [항법등, 충돌방지등] (자리를 못 찾으면 빈 배열 — 다시 찾지 않게 기억)
function nlAttachAircraft(root) {
  const s = nlAircraftSpots(root);
  if (!s) return [];
  const nav = nlPoints(
      [
        [s.red.x, s.red.y, s.red.z, 0xff2418],
        [s.green.x, s.green.y, s.green.z, 0x27ff4e],
        [s.tail.x, s.tail.y, s.tail.z, 0xffffff],
      ],
      11
    ),
    bcn = nlPoints(
      [
        [s.top.x, s.top.y, s.top.z, 0xff2a1a],
        [s.bot.x, s.bot.y, s.bot.z, 0xff2a1a],
      ],
      15
    );
  // 깊이 검사는 한다 (기체 뒤로 돌아간 날개 끝 빛은 가려진다). 빛 점은 표면에서 12 cm 밖에 둔다
  [nav, bcn].forEach(o => root.add(o));
  return [nav, bcn];
}

// ---------- 매 프레임 (90-main-loop, 보이는 것만)
// 착함축 기준 위치: 목표 뒤쪽 거리 along · 우현 쪽 옆 거리 lat · 착함 높이 위 h (CV 로컬 m) — HUD 안내와 같이 쓴다
function nlApproach(pos) {
  const l = CV.worldToLocal(pos.clone()),
    rel = l.clone().sub(nlAxis(NL_TD));
  return { along: -rel.dot(NL_D), lat: rel.dot(NL_N), h: l.y - (DECK_Y + EYE) };
}
function nightLightsUpdate(dt) {
  NL.t += dt;
  const carrier = !isAirbase(),
    night = carrier && typeof WX !== 'undefined' && WX.tod === 'night';
  if (carrier && !NL.deck) nlBuildCarrier();
  if (!NL.deck) return;
  // 멀리서는 흐려진다 (빛 점은 크기가 고정이라 아주 멀어도 보이므로)
  const dCv = cam.position.distanceTo(CV.position),
    fade = carrier ? clamp((30000 - dCv) / 16000, 0, 1) : 0;
  NL.deck.visible = night && fade > 0;
  NL.lens.visible = NL.olsBody.visible = fade > 0; // 광학 착함 장치는 낮에도
  NL.deck.material.opacity = fade;
  NL.lens.material.opacity = Math.min(1, fade * 1.3);
  // 전투기 등 (밤만): 플레이어 기체 + 표지 시네마틱 기체(alpha.8). 출격마다 기체가 새로 만들어지므로 새 기체면 다시 단다
  const want = [p && p.mesh, typeof TCINE !== 'undefined' && TCINE.on && TCINE.jet].filter(Boolean),
    ph = NL.t % 1.1,
    flash = ph < 0.1 || (ph > 0.55 && ph < 0.62); // 충돌방지등: 1.1초에 두 번 번쩍
  if (night) want.forEach(r => NL.acs.has(r) || NL.acs.set(r, nlAttachAircraft(r)));
  NL.acs.forEach((objs, r) => {
    const on = night && want.includes(r);
    if (!on && r !== (typeof TCINE !== 'undefined' && TCINE.jet)) {
      objs.forEach(o => o.parent && o.parent.remove(o)); // 지나간 출격의 기체 — 버린다
      NL.acs.delete(r);
      return;
    }
    if (objs[0]) objs[0].visible = on;
    if (objs[1]) objs[1].visible = on && flash;
  });
  // 광학 착함 장치의 공: 플레이어가 착함축 뒤쪽 접근 구역에 있을 때만
  NL.ball.visible = false;
  NL.wave.visible = false;
  if (!p || p.dead || typeof ops === 'undefined' || ops.st !== 'fly' || fade <= 0) return;
  const { along, lat, h } = nlApproach(p.pos);
  if (!(along > 25 && along < 4500 && Math.abs(lat) < along * 0.5 + 40)) return;
  const dev = ((Math.atan2(h, along) - NL_GS) * 180) / Math.PI; // 정상 강하각과의 차이 (도)
  NL.ball.visible = true;
  NL.ball.position.y = clamp(dev / 1.5, -1, 1) * 0.9; // 렌즈 상자 안에서만
  NL.ball.material.color.set(dev < -0.75 ? 0xff2a1a : 0xffb21e);
  NL.wave.visible = dev < -1.3 && along < 1600 && NL.t % 0.4 < 0.22; // 너무 낮다 — 복행
}
