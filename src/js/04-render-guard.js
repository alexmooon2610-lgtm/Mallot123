// ===== 렌더 점검 · 자동 복구 (V15.0.0-alpha.5) =====
// 사용자 보고(2026-11-17 · 11-18): 폰에서 항모 · 기체가 검게 나온다. PC · 폰 흉내 · SwiftShader 에서는 재현되지 않아
// 원인을 하나로 못 박을 수 없다. 그래서 게임이 스스로 확인하고 고친다:
//
//  1) 텍스처 확인: 모델 텍스처(GTEX, 00-core)마다 GPU 에 올린 결과를 작은 화면 밖 그림(64×16)으로 그려 읽어 본다.
//     원본 그림은 밝은데 GPU 결과가 새까마면 → 같은 크기 캔버스로 다시 올리기 → 절반 → 1/4 → 회색 한 점(검정 대신).
//  2) 조명 확인: 실제 재질(도색된 기체 · 항모)과 회색 표준 재질을, 실제 장면의 빛(해 · 하늘빛 · 환경맵 · 그림자)으로
//     그려 본다. 조명 없이 그린 같은 그림(기준)은 밝은데 조명 받은 쪽이 새까마면 → 안전 단계를 한 단 올린다:
//       1 그림자 끔 → 2 환경맵 대신 고른 주변광 → 3 모든 표준 재질을 램버트(가장 단순한 조명 셰이더)로.
//     단계는 기기에 기억해 두고(localStorage stGfxSafe) 다음부터 처음부터 그 단계로 켠다.
//  3) 언제: 로딩 끝(인트로 화면이 이 점검을 기다린다) · 출격할 때 · 화면 복구(컨텍스트 복원) · 앱으로 돌아왔을 때 ·
//     비행 중 20초마다. 한 번에 64×16 화소만 읽어서 가볍다.
//
// 점검용 판(probe)은 해 쪽으로 400 단위 떨어진 곳(그림자 상자 안)에 있고, 점검하는 순간에만 보인다 — 화면에는 안 나온다.
// 판정과 무관하다 (rnd 를 쓰지 않음). 결정론 하네스(window.__det)는 3D 렌더를 끄고 돌므로 점검하지 않는다.
const RG = { boot: false, bootReq: false, due: -1, every: 20, P: null, recheck: 0, fullTex: false, suspect: '' };
const rgOff = () => !!window.__det;

function rgProbe() {
  if (RG.P) return RG.P;
  const g = new T.Group(),
    geo = new T.PlaneGeometry(2, 1),
    cells = [];
  g.name = 'RenderGuardProbe';
  g.visible = false;
  for (let i = 0; i < 4; i++) {
    const lit = new T.Mesh(geo, null),
      ref = new T.Mesh(geo, new T.MeshBasicMaterial());
    lit.position.set(-3 + 2 * i, 0.5, 0);
    ref.position.set(-3 + 2 * i, -0.5, 0);
    lit.receiveShadow = true; // 실제 기체 · 항모와 같은 셰이더 갈래
    for (const m of [lit, ref]) {
      m.frustumCulled = false;
      m.castShadow = false;
    }
    g.add(lit, ref);
    cells.push({ lit, ref });
  }
  scene.add(g);
  const rt = new T.WebGLRenderTarget(64, 16, { depthBuffer: false, stencilBuffer: false });
  rt.texture.encoding = R.outputEncoding; // 화면과 같은 셰이더 (거울에서 배운 것 — 다르면 셰이더를 한 벌 더 굽는다)
  const ctrl = new T.MeshStandardMaterial({ color: 0xb4b4b4, roughness: 0.7, metalness: 0.1 });
  cells.forEach(c => (c.lit.material = ctrl));
  return (RG.P = { g, rt, cells, ctrl, cam: new T.OrthographicCamera(-4, 4, 1, -1, 0.05, 30), px: new Uint8Array(64 * 16 * 4) });
}
// 점검 판을 한 번 그려 칸별 밝기를 읽는다. 칸 (i 열, r 줄: 0 아래 = 기준(조명 없음), 1 위 = 조명)
function rgShot() {
  const P = rgProbe(),
    gl = R.getContext();
  if (!gl || gl.isContextLost()) return null;
  const at = sun.target.position.clone().addScaledVector(SUN_DIR, 400);
  P.g.position.copy(at);
  P.g.quaternion.setFromUnitVectors(V(0, 0, 1), SUN_DIR); // 판이 해(밤에는 달)를 정면으로 본다
  P.g.updateMatrixWorld(true);
  P.cam.position.copy(at).addScaledVector(SUN_DIR, 10);
  P.cam.quaternion.copy(P.g.quaternion);
  P.cam.updateMatrixWorld(true);
  const prev = R.getRenderTarget(),
    nu = R.shadowMap.needsUpdate;
  R.shadowMap.needsUpdate = false; // 그림자 지도는 메인 화면 것을 그대로 쓴다
  P.g.visible = true;
  try {
    R.setRenderTarget(P.rt);
    R.clear();
    R.render(scene, P.cam);
    R.readRenderTargetPixels(P.rt, 0, 0, 64, 16, P.px);
  } catch (e) {
    console.warn('[STEEL TEMPEST] render guard shot failed', e);
    return null;
  } finally {
    P.g.visible = false;
    R.setRenderTarget(prev);
    R.shadowMap.needsUpdate = nu;
  }
  if (gl.isContextLost()) return null;
  return (i, r) => {
    let m = 0,
      s = 0,
      n = 0;
    for (let y = r * 8 + 2; y < r * 8 + 6; y++)
      for (let x = i * 16 + 4; x < i * 16 + 12; x++) {
        const o = (y * 64 + x) * 4,
          v = Math.max(P.px[o], P.px[o + 1], P.px[o + 2]);
        m = Math.max(m, v);
        s += v;
        n++;
      }
    return { max: m, avg: s / n };
  };
}
const rgSetRef = (c, map, color) => {
  const m = c.ref.material;
  if (!!m.map !== !!map) m.needsUpdate = true;
  m.map = map || null;
  m.color.copy(color || new T.Color(1, 1, 1));
};
// 텍스처 원본 밝기 (한 번만 잰다. 다시 올리면 다시 잰다)
const rgCpu = e => (e.cpu >= 0 ? e.cpu : (e.cpu = e.tex.image ? texSourceMax(e.tex.image) : 0));

// 텍스처 다시 올리기: 같은 크기 캔버스 → 절반 → 1/4 → 회색 한 점
function rgFixTex(e) {
  const t = e.tex,
    src = t.image,
    w = (src && (src.naturalWidth || src.width)) || 1,
    h = (src && (src.naturalHeight || src.height)) || 1;
  e.tries++;
  const k = [1, 0.5, 0.25][e.tries - 1];
  const c = document.createElement('canvas');
  if (k && src) {
    c.width = Math.max(1, Math.round(w * k));
    c.height = Math.max(1, Math.round(h * k));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  } else {
    c.width = c.height = 4;
    const x = c.getContext('2d');
    x.fillStyle = '#8f989c'; // 텍스처가 오기 전 회색과 같은 색
    x.fillRect(0, 0, 4, 4);
    e.dead = true;
  }
  t.image = c;
  t.needsUpdate = true;
  e.cpu = -1;
  e.ok = false;
  GFX.texFix++;
  console.warn('[STEEL TEMPEST] render guard: texture re-uploaded', e.tries, c.width + 'x' + c.height);
}
// 1) 텍스처 확인 — 4장씩 기준 칸에 그려 본다
function rgCheckTextures(all) {
  const P = rgProbe(),
    list = GTEX.filter(e => all || !e.ok);
  let bad = 0;
  P.cells.forEach(c => (c.lit.visible = false));
  for (let i = 0; i < list.length; i += 4) {
    const batch = list.slice(i, i + 4);
    P.cells.forEach((c, j) => {
      c.ref.visible = j < batch.length;
      if (j < batch.length) rgSetRef(c, batch[j].tex);
    });
    const cell = rgShot();
    if (!cell) break;
    batch.forEach((e, j) => {
      const gpu = cell(j, 0).max;
      if (rgCpu(e) >= 20 && gpu <= 3 && !e.dead) {
        bad++;
        rgFixTex(e);
      } else e.ok = true;
    });
  }
  P.cells.forEach(c => (c.lit.visible = c.ref.visible = true));
  return bad;
}
// 지금 쓰이는 재질 (램버트로 바꿨으면 바꾼 쪽)
const rgLive = m => LAMB.get(m) || m;
// 2) 조명 확인 — 0열: 회색 표준 재질, 1~3열: 실제 도색 재질 (큰 텍스처부터)
function rgCheckLight() {
  const P = rgProbe(),
    real = GTEX.filter(e => e.mats.length && !e.dead)
      .sort((a, b) => (b.tex.image?.width || 0) * (b.tex.image?.height || 0) - (a.tex.image?.width || 0) * (a.tex.image?.height || 0))
      .slice(0, 3);
  const ctrl = GFX.level >= 3 ? rgLambert(P.ctrl) : P.ctrl;
  P.cells.forEach((c, i) => {
    const e = real[i - 1],
      m = i === 0 ? ctrl : e && rgLive(e.mats[0]);
    c.lit.visible = c.ref.visible = !!m;
    if (!m) return;
    c.lit.material = m;
    rgSetRef(c, i === 0 ? null : m.map, m.color);
  });
  const cell = rgShot();
  if (!cell) return null;
  const out = { dark: [], tex: [] };
  P.cells.forEach((c, i) => {
    if (!c.lit.visible) return;
    const lit = cell(i, 1),
      ref = cell(i, 0),
      e = real[i - 1];
    if (e && ref.max <= 3 && rgCpu(e) >= 20) out.tex.push(e); // 기준부터 검다 = 텍스처 문제
    else if (ref.max >= 20 && lit.max <= 3) out.dark.push(i === 0 ? 'ctrl' : e.tex.image?.width + 'px');
    // 맑은 낮에 해를 정면으로 받는 회색 판이 기준의 30% 도 안 되면 그림자 판정이 깨진 것 (전부 그늘)
    else if (i === 0 && WX.tod === 'day' && (WX.kind === 'clear' || WX.kind === 'overcast') && lit.avg < 0.3 * ref.avg)
      out.dark.push('shadow');
  });
  P.cells.forEach(c => (c.lit.visible = c.ref.visible = true));
  return out;
}

// 3) 램버트로 바꾸기 (안전 단계 3) — 같은 재질은 같은 램버트 하나로
const LAMB = new WeakMap();
function rgLambert(m) {
  if (!m || !m.isMeshStandardMaterial) return m;
  let l = LAMB.get(m);
  if (l) return l;
  l = new T.MeshLambertMaterial({
    color: m.color,
    map: m.map,
    emissive: m.emissive,
    emissiveMap: m.emissiveMap,
    emissiveIntensity: m.emissiveIntensity,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
    alphaTest: m.alphaTest,
    vertexColors: m.vertexColors,
    depthWrite: m.depthWrite,
    depthTest: m.depthTest,
    fog: m.fog,
    toneMapped: m.toneMapped,
    polygonOffset: m.polygonOffset,
    polygonOffsetFactor: m.polygonOffsetFactor,
    polygonOffsetUnits: m.polygonOffsetUnits,
  });
  l.name = m.name;
  l.userData = m.userData;
  l.visible = m.visible;
  LAMB.set(m, l);
  return l;
}
function rgLambertize(root) {
  if (!root || !root.traverse) return;
  root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    o.material = Array.isArray(o.material) ? o.material.map(rgLambert) : rgLambert(o.material);
  });
}
function rgLambertizeAll() {
  const roots = [scene];
  [
    () => cockpitScene,
    () => mig29GLBTemplate,
    () => su33GLBTemplate,
    () => f16GLBTemplate,
    () => la17GLBTemplate,
    () => f16Merged,
    () => f16Proto,
    () => mslGLBTemplate.SARH,
    () => mslGLBTemplate.IR,
  ].forEach(f => {
    try {
      roots.push(f());
    } catch (e) {}
  });
  roots.forEach(rgLambertize);
  // 텍스처가 나중에 붙는 재질도 따라가게: 원래 재질의 map 이 바뀌면 램버트에도 옮긴다 (점검 때마다)
  GTEX.forEach(e =>
    e.mats.forEach(m => {
      const l = LAMB.get(m);
      if (l && l.map !== m.map) {
        l.map = m.map;
        l.color.copy(m.color);
        l.needsUpdate = true;
      }
    })
  );
}

function rgApplyLevel() {
  if (GFX.level >= 1) sun.castShadow = false;
  if (GFX.level >= 2) {
    bakeEnvironment(); // 단계 2: 환경맵을 지우고 주변광
    wxAmbUpdate(); // 주변광 밝기를 지금 날씨에 맞춘다 (판정 상태는 건드리지 않는다)
  }
  if (GFX.level >= 3) rgLambertizeAll();
}
function rgEscalate(why) {
  if (GFX.level >= 3) {
    GFX.lastFail = why + ' (L3)';
    return false;
  }
  GFX.level++;
  GFX.lastFail = why;
  try {
    localStorage.setItem('stGfxSafe', String(GFX.level));
  } catch (e) {}
  rgApplyLevel();
  const what = ['', '그림자 끔', '환경맵 대신 주변광', '단순 조명'][GFX.level];
  console.warn('[STEEL TEMPEST] render guard: safe level', GFX.level, why);
  if (typeof S !== 'undefined' && S === 'play')
    msg(`그래픽 자동 복구 — 검은 물체를 찾아 안전 모드 ${GFX.level} (${what})`, '#9cf');
  return true;
}
// 한 번 점검: 텍스처 → 조명. 고친 게 있으면 잠시 뒤(새 셰이더 · 업로드가 끝난 뒤) 다시 본다
function rgCheck() {
  if (rgOff()) return true;
  GFX.checks++;
  if (GFX.level >= 3) rgLambertizeAll();
  const tb = rgCheckTextures(RG.fullTex);
  RG.fullTex = false;
  const L = rgCheckLight();
  if (!L) return false; // 컨텍스트를 잃었다 — 복원 뒤 다시
  L.tex.forEach(e => !e.dead && rgFixTex(e));
  let again = tb > 0 || L.tex.length > 0;
  if (L.dark.length) {
    // 한 번 검게 읽힌 것으로는 올리지 않는다 — 0.25초 뒤 한 번 더 검으면 그때 안전 단계를 올린다 (순간적인 읽기 실패 대비)
    if (RG.suspect === 'L' + GFX.level) {
      RG.suspect = '';
      again = rgEscalate(L.dark.join(',')) || again;
    } else {
      RG.suspect = 'L' + GFX.level;
      again = true;
    }
  } else {
    RG.suspect = '';
    if (!tb && !L.tex.length) GFX.lastFail = '';
  }
  if (again) RG.recheck = 0.25;
  return !again;
}
// 메인 루프에서 매 프레임 (90-main-loop). 화면을 다 그린 뒤 부른다.
function renderGuardTick(dt) {
  if (rgOff()) return (RG.boot = true);
  if (document.hidden) return;
  if (RG.recheck > 0) {
    RG.recheck -= Math.max(dt, 0.016);
    if (RG.recheck <= 0) {
      RG.recheck = 0;
      if (rgCheck() && RG.bootReq) RG.boot = true;
    }
    return;
  }
  if (RG.bootReq && !RG.boot) {
    RG.fullTex = true;
    if (rgCheck()) RG.boot = true;
    return;
  }
  if (RG.due > 0 && (RG.due -= dt) <= 0) {
    RG.due = S === 'play' ? RG.every : -1;
    rgCheck();
  } else if (RG.due <= 0 && S === 'play') RG.due = RG.every;
}
// 출격할 때 (20-game-init init 끝): 1초 뒤 점검 — 날씨 · 기체가 바뀐 뒤
function renderGuardSortie() {
  if (GFX.level >= 3) rgLambertizeAll();
  RG.due = 1;
}
// 렌더 점검 끝났나 (인트로가 기다린다)
const renderGuardReady = () => RG.boot || rgOff();
// 처음부터 안전 단계가 기억돼 있으면: 그림자 · 환경맵은 01-environment 가 처음부터 따르고, 램버트는 모델이 다 읽힌 뒤 점검 때.
// 화면 복구 · 앱으로 돌아옴: 환경맵은 렌더 타깃이라 컨텍스트를 잃으면 내용이 사라진다 → 다시 굽고 전부 다시 확인
R.domElement.addEventListener('webglcontextrestored', () => {
  setTimeout(() => {
    bakeEnvironment();
    GTEX.forEach(e => ((e.ok = false), (e.cpu = -1)));
    RG.fullTex = true;
    RG.recheck = 0.5;
  }, 0);
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !rgOff()) {
    RG.fullTex = true;
    RG.recheck = 0.8;
  }
});
