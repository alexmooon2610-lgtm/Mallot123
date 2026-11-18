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
//             목표는 착함축 66 m (2 · 3번 와이어 사이). 게임에서 1 km 밖에서도 읽히게 실물보다 크게 만들었다
//             (기준등 반폭 약 16 m · 공 ±10 m — 게임 판단). HUD 의 LOC / GS 안내(33-carrier-defense carrierGuide)도 같은 착함축 · 강하각을 쓴다.
// 전투기 (플레이어 MiG-29 / Su-33): 왼쪽 날개 끝 빨강 · 오른쪽 초록 · 꼬리 흰색 항법등(계속 켜짐) +
//   등 · 배의 빨간 충돌방지등(깜빡임). 자리는 모델 꼭짓점에서 찾는다(모델 파일은 건드리지 않는다).
// 전부 화면 크기가 고정된 빛 점(Points)이라 멀리서도 점으로 보이고, 실제 광원이 아니라서 셰이더 · 성능에 영향이 없다.
// 판정과 무관하다 (rnd 를 쓰지 않음 · p.pos 는 읽기만).
const NL = { deck: null, lens: null, ball: null, wave: null, ac: null, acRoot: null, t: 0, glow: null, on: false };
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
  // 광학 착함 장치: 좌현 갑판 끝, 착함 목표보다 조금 뒤
  const tz = nlAxis(NL_TD).z + 10,
    ex = CV.userData.deckEdges(tz)[0] + 2.5,
    L0 = V(ex, DECK_Y + 13, tz), // 공이 기준등 아래로 10 m 내려가도 갑판 위에 있게
    D = [];
  for (let i = 0; i < 5; i++) for (const sg of [-1, 1]) D.push([L0.x + sg * (4 + i * 3.1), L0.y, L0.z, 0x2dff5a]);
  NL.lens = nlPoints(D, 10);
  NL.ball = nlPoints([[L0.x, L0.y, L0.z, 0xffffff]], 16);
  NL.ball.material.vertexColors = false;
  NL.ball.material.color.set(0xffb21e);
  NL.wave = nlPoints(
    [
      [L0.x - 3.5, L0.y + 12, L0.z, 0xff1a14],
      [L0.x + 3.5, L0.y + 12, L0.z, 0xff1a14],
      [L0.x - 3.5, L0.y - 12, L0.z, 0xff1a14],
      [L0.x + 3.5, L0.y - 12, L0.z, 0xff1a14],
    ],
    13
  );
  NL.lensY = L0.y;
  CV.add(NL.lens, NL.ball, NL.wave);
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
function nlAttachAircraft(root) {
  if (NL.ac) NL.ac.forEach(o => o.parent && o.parent.remove(o));
  NL.ac = null;
  NL.acRoot = root;
  const s = root && nlAircraftSpots(root);
  if (!s) return;
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
  NL.ac = [nav, bcn];
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
  NL.lens.visible = fade > 0; // 광학 착함 장치는 낮에도
  NL.deck.material.opacity = fade;
  NL.lens.material.opacity = Math.min(1, fade * 1.3);
  // 전투기 등 (밤만): 출격마다 기체가 새로 만들어지므로 바뀌면 다시 단다
  if (night && p && p.mesh !== NL.acRoot) nlAttachAircraft(p.mesh);
  if (NL.ac) {
    const ph = NL.t % 1.1;
    NL.ac[0].visible = night;
    NL.ac[1].visible = night && (ph < 0.1 || (ph > 0.55 && ph < 0.62)); // 충돌방지등: 1.1초에 두 번 번쩍
  }
  // 광학 착함 장치의 공: 플레이어가 착함축 뒤쪽 접근 구역에 있을 때만
  NL.ball.visible = false;
  NL.wave.visible = false;
  if (!p || p.dead || typeof ops === 'undefined' || ops.st !== 'fly' || fade <= 0) return;
  const { along, lat, h } = nlApproach(p.pos);
  if (!(along > 25 && along < 4500 && Math.abs(lat) < along * 0.5 + 40)) return;
  const dev = ((Math.atan2(h, along) - NL_GS) * 180) / Math.PI; // 정상 강하각과의 차이 (도)
  NL.ball.visible = true;
  NL.ball.position.y = clamp(dev / 1.5, -1, 1) * 10;
  NL.ball.material.color.set(dev < -0.75 ? 0xff2a1a : 0xffb21e);
  NL.wave.visible = dev < -1.3 && along < 1600 && NL.t % 0.4 < 0.22; // 너무 낮다 — 복행
}
