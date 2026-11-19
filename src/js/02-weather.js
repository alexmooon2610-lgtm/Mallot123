// ===== 날씨 · 시간대 (V15.0.0-alpha.4) — 무한모드(LEGACY) 전용, 출격 전 브리핑에서 고른다 =====
// 사용자 결정 (2026-11-17): 전투에도 영향 · 시간대(낮/석양/밤)와 날씨(맑음/흐림/비/소나기/폭풍)는 출격 전에 골라 한 판 동안 고정.
//
// 보이는 것 (판정과 무관, vrnd · arnd 만 쓴다):
//   하늘 · 안개 · 햇빛(밤에는 달빛) · 바다색 · 구름층 덮임과 색 · 별(밤) · 빗줄기 · 번개(폭풍) · 빗소리 · 천둥
// 판정에 들어가는 것 (WX.*, 기본 '낮 · 맑음' 이면 전부 1 · 0 이라 예전과 프레임 단위로 같다):
//   irK   열추적 감도 거리 배율 — 비 · 구름 속 수분이 적외선을 먹는다 (밤에는 배경이 차가워 조금 늘어난다)
//   radK  레이더 탐지 거리 배율 — 폭우 잡음(클러터)
//   wind  바람 (m/s, 서쪽에서) — 공중의 모든 기체가 같이 밀린다 → 항모 착함 때 옆바람을 잡아야 한다
//   turb  난기류 세기 (rad/s) — 플레이어 기체가 흔들린다 (판정 난수 rnd 로, 켜졌을 때만 당긴다)
const WX_TOD = {
  day: { ko: '낮', en: 'DAY' },
  dusk: { ko: '석양', en: 'DUSK' },
  night: { ko: '밤', en: 'NIGHT' },
};
const WX_KIND = {
  clear: { ko: '맑음', en: 'CLEAR', irK: 1, radK: 1, wind: 0, turb: 0, rain: 0, cover: 'CLEAR', dark: 0 },
  overcast: { ko: '흐림', en: 'OVERCAST', irK: 0.95, radK: 1, wind: 3, turb: 0, rain: 0, cover: 'CLOUDY', dark: 0.45 },
  rain: { ko: '비', en: 'RAIN', irK: 0.8, radK: 0.95, wind: 6, turb: 0.015, rain: 0.55, cover: 'RAIN', dark: 0.7 },
  shower: { ko: '소나기', en: 'SHOWERS', irK: 0.85, radK: 0.95, wind: 8, turb: 0.03, rain: 0.8, cover: 'RAIN', dark: 0.6 },
  storm: { ko: '폭풍', en: 'STORM', irK: 0.65, radK: 0.85, wind: 15, turb: 0.07, rain: 1, cover: 'STORM', dark: 0.88 },
};
// 지금 판의 날씨 (init 에서 weatherApply 가 채운다)
const WX = { tod: 'day', kind: 'clear', irK: 1, radK: 1, wind: V(0, 0, 0), turb: 0, rain: 0, sig: 'day|clear' };
const WX_WIND_DIR = V(1, 0, 0.25).normalize(); // 서남서에서 불어온다 (항모 진행 방향 −z 에 대해 옆바람)

// 고른 값 (localStorage 'stWx') — 무한모드에서만 쓰고, 나머지 임무는 언제나 낮 · 맑음
const wxPick = () => {
  try {
    const o = JSON.parse(localStorage.getItem('stWx') || '{}');
    return { tod: WX_TOD[o.tod] ? o.tod : 'day', kind: WX_KIND[o.kind] ? o.kind : 'clear' };
  } catch (e) {
    return { tod: 'day', kind: 'clear' };
  }
};
const wxSetPick = o => {
  try {
    localStorage.setItem('stWx', JSON.stringify(o));
  } catch (e) {}
};
const wxFor = M => (M && M.id === 'LEGACY' ? wxPick() : { tod: 'day', kind: 'clear' });

// ---------- 기본값 (01-environment 가 정한 '낮 · 맑음') 을 한 번 기억해 둔다
const WX_BASE = (() => {
  const hemi = scene.children.find(o => o.isHemisphereLight),
    su = skyDome.material.uniforms,
    se = sea.material.uniforms;
  return {
    sunDir: SUN_DIR.clone(),
    sunCol: sun.color.clone(),
    sunI: sun.intensity,
    hemiSky: hemi.color.clone(),
    hemiGround: hemi.groundColor.clone(),
    hemiI: hemi.intensity,
    skyTop: su.top.value.clone(),
    skySun: su.sunCol.value.clone(),
    seaDeep: se.deep.value.clone(),
    seaShallow: se.shallow.value.clone(),
    seaSky: se.skyCol.value.clone(),
    seaSun: se.sunCol.value.clone(),
    cloudMats: cloudLayer.mats.map(m => m.color.clone()),
    spriteCol: clouds[0] ? clouds[0].material.color.clone() : new T.Color(1, 1, 1),
    exposure: R.toneMappingExposure,
    hemi,
  };
})();
// 시간대별 기본 빛 (색은 코드에 쓴 16진수 = sRGB)
const WX_TOD_LOOK = {
  dusk: {
    sunDir: V(0.78, 0.1, -0.62),
    sunCol: 0xffb37a,
    sunI: 1.55,
    hemiSky: 0xffc8a0,
    hemiGround: 0x3a3040,
    hemiI: 0.36,
    skyTop: 0x253a72,
    skySun: 0xffa060,
    fog: 0xe5a374,
    seaDeep: 0x0a1c30,
    seaShallow: 0x2b4560,
    seaSky: 0xc98a66,
    seaSun: 0xffb37a,
    cloudBottom: 0x8a7584,
    cloudTop: 0xffd2b0,
    sprite: 0xffd8bc,
    exposure: 0.85,
  },
  night: {
    // 달빛: 높이 뜬 차가운 빛. 하늘 셰이더의 태양 번짐이 달무리 노릇을 한다
    sunDir: V(-0.35, 0.62, -0.5),
    sunCol: 0x9fb6ff,
    sunI: 0.5,
    hemiSky: 0x2b3f6a,
    hemiGround: 0x05080f,
    hemiI: 0.3,
    skyTop: 0x02050d,
    skySun: 0x8094c8,
    fog: 0x0c1628,
    seaDeep: 0x01050b,
    seaShallow: 0x061424,
    seaSky: 0x0c1a32,
    seaSun: 0x9fb6ff,
    cloudBottom: 0x1b2333,
    cloudTop: 0x3c4b68,
    sprite: 0x3c4b68,
    exposure: 1.2,
  },
};
// 회색으로 끌어당기기 (흐림 · 비): 밝기는 남기고 채도를 뺀 뒤 어둡게
const wxGrey = (c, amt, darken) => {
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  return c.clone().lerp(new T.Color(l, l * 1.02, l * 1.06), amt).multiplyScalar(1 - darken);
};
// 장면 배치용 난수 (불러올 때 한 번 — vrnd 는 38-trails-fx 에서 정의되어 아직 못 쓴다)
let _wxs = 20261118;
const wxr = () => (_wxs = (_wxs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
// 별 (밤): 하늘 돔처럼 카메라를 따라다니는 점들. 연출 난수(vrnd)
const wxStars = (() => {
  const n = 900,
    pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = wxr() * 2 - 1,
      th = wxr() * Math.PI * 2,
      y = Math.abs(u) * 0.95 + 0.05,
      r = Math.sqrt(1 - y * y);
    pos.set([Math.cos(th) * r * 900, y * 900, Math.sin(th) * r * 900], i * 3);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  const s = new T.Points(
    g,
    new T.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false, depthWrite: false })
  );
  s.renderOrder = -999;
  s.frustumCulled = false;
  s.visible = false;
  s.onBeforeRender = (r, sc, c) => {
    s.position.copy(c.position);
    s.updateMatrixWorld();
  };
  scene.add(s);
  return s;
})();
// 빗줄기: 카메라 둘레 상자 안의 짧은 선분들. 떨어지는 속도 + 바람 − 카메라 속도로 흘러 속도감이 난다
const WX_RAIN_N = LOWGPU ? 900 : 2200,
  WX_RAIN_BOX = 70;
const wxRain = (() => {
  const off = new Float32Array(WX_RAIN_N * 3),
    pos = new Float32Array(WX_RAIN_N * 6);
  for (let i = 0; i < off.length; i++) off[i] = (wxr() - 0.5) * WX_RAIN_BOX;
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(pos, 3));
  const m = new T.LineSegments(
    g,
    new T.LineBasicMaterial({ color: 0xb8c6d6, transparent: true, opacity: 0.35, fog: false, depthWrite: false })
  );
  m.frustumCulled = false;
  m.visible = false;
  scene.add(m);
  return { m, g, off, pos, lastCam: new T.Vector3(), vel: new T.Vector3() };
})();
let wxFlash = null; // 번개 화면 번쩍임 (DOM — 셰이더를 바꾸지 않는다)
const wxRt = { t: 0, nextBolt: 6, bolt: 0, rainG: null, rainSrc: null, show: 0, turbP: 0, turbR: 0 };

// ---------- 판 시작 때 (20-game-init init) — 고른 날씨를 장면에 입힌다
function weatherApply(sel) {
  const tod = sel.tod,
    K = WX_KIND[sel.kind],
    B = WX_BASE,
    L = WX_TOD_LOOK[tod];
  WX.tod = tod;
  WX.kind = sel.kind;
  // 판정 배율 (밤에는 배경이 차가워 열원이 잘 보인다 ×1.1)
  WX.irK = K.irK * (tod === 'night' ? 1.1 : 1);
  WX.radK = K.radK;
  WX.wind.copy(WX_WIND_DIR).multiplyScalar(K.wind);
  WX.turb = K.turb;
  WX.rain = K.rain;
  // 판정에 쓰이는 난기류 상태는 판마다 0 에서 (같은 시드 = 같은 판)
  wxRt.turbP = wxRt.turbR = 0;
  wxRt.t = 0;
  wxRt.nextBolt = 6;
  wxRt.bolt = 0;
  // 장면 값은 매번 처음부터 다시 입힌다 (init 이 안개를 기본값으로 되돌리므로). 환경맵만 날씨가 바뀔 때 굽는다
  const sig = tod + '|' + sel.kind,
    rebake = sig !== WX.sig;
  WX.sig = sig;
  const su = skyDome.material.uniforms,
    se = sea.material.uniforms,
    c = h => new T.Color(h);
  // 1) 시간대 기본 빛
  SUN_DIR.copy(L ? L.sunDir.clone().normalize() : B.sunDir);
  sun.color.copy(L ? c(L.sunCol) : B.sunCol);
  sun.intensity = L ? L.sunI : B.sunI;
  B.hemi.color.copy(L ? c(L.hemiSky) : B.hemiSky);
  B.hemi.groundColor.copy(L ? c(L.hemiGround) : B.hemiGround);
  B.hemi.intensity = L ? L.hemiI : B.hemiI;
  su.top.value.copy(L ? c(L.skyTop) : B.skyTop);
  su.sunCol.value.copy(L ? c(L.skySun) : B.skySun);
  if (L) scene.fog.color.set(L.fog);
  scene.background.copy(scene.fog.color);
  se.deep.value.copy(L ? c(L.seaDeep) : B.seaDeep);
  se.shallow.value.copy(L ? c(L.seaShallow) : B.seaShallow);
  se.skyCol.value.copy(L ? c(L.seaSky) : B.seaSky);
  se.sunCol.value.copy(L ? c(L.seaSun) : B.seaSun);
  cloudLayer.mats[0].color.copy(L ? c(L.cloudBottom) : B.cloudMats[0]);
  cloudLayer.mats[1].color.copy(L ? c(L.cloudTop) : B.cloudMats[1]);
  const spr = L ? c(L.sprite) : B.spriteCol;
  clouds.forEach(cl => cl.material.color.copy(spr));
  R.toneMappingExposure = L ? L.exposure : B.exposure;
  // 2) 날씨: 회색으로 · 어둡게 · 안개를 당기고 · 해를 가린다
  const d = K.dark;
  if (d > 0) {
    scene.fog.color.copy(wxGrey(scene.fog.color, 0.75 * d, 0.55 * d));
    scene.background.copy(scene.fog.color);
    scene.fog.near *= 1 - 0.75 * d;
    scene.fog.far *= 1 - 0.68 * d;
    su.top.value.copy(wxGrey(su.top.value, 0.85 * d, 0.5 * d));
    su.sunCol.value.multiplyScalar(1 - 0.92 * d);
    sun.intensity *= 1 - 0.75 * d;
    B.hemi.intensity *= 1 + 0.35 * d; // 흐린 날은 빛이 고르게 퍼진다
    se.skyCol.value.copy(wxGrey(se.skyCol.value, 0.8 * d, 0.35 * d));
    se.sunCol.value.multiplyScalar(1 - 0.9 * d);
    se.shallow.value.copy(wxGrey(se.shallow.value, 0.6 * d, 0.4 * d));
    se.deep.value.copy(wxGrey(se.deep.value, 0.5 * d, 0.3 * d));
    cloudLayer.mats.forEach(m => m.color.copy(wxGrey(m.color, 0.7 * d, 0.45 * d)));
    clouds.forEach(cl => cl.material.color.copy(wxGrey(cl.material.color, 0.7 * d, 0.45 * d)));
  }
  cloudLayer.setWeather(K.cover);
  wxStars.visible = tod === 'night' && d < 0.5; // 구름이 두꺼우면 별이 안 보인다
  if (typeof ckSun !== 'undefined') {
    ckSun.color.copy(sun.color);
    ckSun.intensity = 0.8 * (sun.intensity / B.sunI);
    ckHemi.intensity = 0.72 * Math.max(0.45, B.hemi.intensity / B.hemiI); // 계기 조명이 있어 너무 어두워지지는 않는다
  }
  WX.hemiI = B.hemi.intensity; // 번개가 끝나면 되돌릴 값
  wxAmbUpdate();
  if (rebake) bakeEnvironment(); // 기체 · 캐노피에 비치는 하늘도 바꾼다
}

// 안전 단계 2(04-render-guard)의 주변광: 날씨 · 시간대만큼 어둡게 (낮 · 맑음 0.35)
function wxAmbUpdate() {
  if (!gfxAmb) return;
  const B = WX_BASE;
  gfxAmb.intensity = 0.35 * (WX.hemiI / B.hemiI) * ((sun.intensity / B.sunI + 0.3) / 1.3);
}

// ---------- 매 프레임 (90-main-loop) — 보이는 것 · 소리만. 판정은 34-flight 의 weatherPhys
// 표지 · 메뉴 (alpha.8 — 사용자: "정식으로 굳혀"): 무한모드에서 마지막으로 고른 날씨 · 시간대를 표지 배경에도 입힌다.
// 판정 배율도 같이 바뀌지만 메뉴에서는 판정이 돌지 않고, 출격하면 init 이 그 임무의 날씨로 다시 입힌다.
function weatherMenu() {
  if (typeof S !== 'undefined' && S === 'play') return;
  weatherApply(wxPick());
}
function weatherUpdate(dt, playing, title) {
  const live = playing || title; // 표지 시네마틱에서도 번개 · 빗소리
  const K = WX_KIND[WX.kind];
  wxRt.t += dt;
  // 소나기: 45초 주기로 퍼붓다 그친다 (보이는 비만 — 판정 배율은 평균값으로 고정)
  let amt = K.rain;
  if (WX.kind === 'shower') amt *= clamp(0.5 + 0.9 * Math.sin((wxRt.t * Math.PI * 2) / 45), 0, 1);
  wxRt.show += (amt - wxRt.show) * Math.min(1, dt * 0.8);
  const r = wxRain;
  r.m.visible = wxRt.show > 0.02;
  if (r.m.visible) {
    // 카메라 속도 (이번 프레임 이동량)
    if (dt > 0) r.vel.copy(cam.position).sub(r.lastCam).divideScalar(dt);
    if (r.vel.lengthSq() > 1e6) r.vel.set(0, 0, 0); // 순간 이동(재출격)은 무시
    r.lastCam.copy(cam.position);
    const fall = V(WX.wind.x, -11 - 6 * K.rain, WX.wind.z).sub(r.vel),
      fl = fall.length(),
      streak = fall.clone().multiplyScalar(Math.min(4, 0.6 + fl * 0.012) / Math.max(1, fl)),
      H = WX_RAIN_BOX / 2,
      n = Math.round(WX_RAIN_N * Math.min(1, wxRt.show));
    for (let i = 0; i < WX_RAIN_N; i++) {
      const o = i * 3;
      let x = r.off[o] + fall.x * dt,
        y = r.off[o + 1] + fall.y * dt,
        z = r.off[o + 2] + fall.z * dt;
      x = ((((x + H) % WX_RAIN_BOX) + WX_RAIN_BOX) % WX_RAIN_BOX) - H;
      y = ((((y + H) % WX_RAIN_BOX) + WX_RAIN_BOX) % WX_RAIN_BOX) - H;
      z = ((((z + H) % WX_RAIN_BOX) + WX_RAIN_BOX) % WX_RAIN_BOX) - H;
      r.off[o] = x;
      r.off[o + 1] = y;
      r.off[o + 2] = z;
      const p6 = i * 6,
        on = i < n ? 1 : 0;
      r.pos[p6] = cam.position.x + x;
      r.pos[p6 + 1] = cam.position.y + y;
      r.pos[p6 + 2] = cam.position.z + z;
      r.pos[p6 + 3] = cam.position.x + x - streak.x * on;
      r.pos[p6 + 4] = cam.position.y + y - streak.y * on;
      r.pos[p6 + 5] = cam.position.z + z - streak.z * on;
    }
    r.g.attributes.position.needsUpdate = true;
    r.m.material.opacity = 0.18 + 0.32 * wxRt.show * (WX.tod === 'night' ? 0.6 : 1);
  } else r.lastCam.copy(cam.position);
  // 폭풍: 번개 (6~18초마다) — 화면 번쩍임 + 하늘빛 + 잠시 뒤 천둥
  if (WX.kind === 'storm' && live) {
    if ((wxRt.nextBolt -= dt) <= 0) {
      wxRt.nextBolt = 6 + vrnd() * 12;
      wxRt.bolt = 1;
      const delay = 0.4 + vrnd() * 2.2; // 번개와 천둥 사이 (거리)
      setTimeout(() => typeof noiseSnd === 'function' && AC && noiseSnd(2.6, 0.55, 260, 40, 'lowpass', 0.02), delay * 1000);
    }
  }
  if (wxRt.bolt > 0) {
    wxRt.bolt = Math.max(0, wxRt.bolt - dt * 3.2);
    const k = wxRt.bolt > 0.75 || (wxRt.bolt > 0.35 && wxRt.bolt < 0.5) ? wxRt.bolt : wxRt.bolt * 0.3; // 두 번 번쩍
    if (!wxFlash) {
      wxFlash = document.createElement('div');
      wxFlash.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;background:#dfe7ff;opacity:0;mix-blend-mode:screen';
      document.body.appendChild(wxFlash);
    }
    wxFlash.style.opacity = (0.45 * k).toFixed(3);
    WX_BASE.hemi.intensity = WX.hemiI * (1 + 5 * k); // 순간적으로 장면 전체가 밝아진다
    if (wxRt.bolt === 0) {
      wxFlash.style.opacity = '0';
      WX_BASE.hemi.intensity = WX.hemiI;
    }
  }
  // 빗소리: 갈색 잡음을 높은 대역으로 걸러 빗줄기 양만큼
  if (typeof AC !== 'undefined' && AC && typeof NOISE !== 'undefined' && NOISE) {
    if (!wxRt.rainG) {
      try {
        const s = AC.createBufferSource(),
          f = AC.createBiquadFilter(),
          g = AC.createGain();
        s.buffer = NOISE;
        s.loop = true;
        f.type = 'highpass';
        f.frequency.value = 900;
        g.gain.value = 0;
        s.connect(f).connect(g).connect(ACOUT);
        s.start();
        wxRt.rainG = g;
      } catch (e) {
        wxRt.rainG = { gain: { value: 0 } };
      }
    }
    const want = live ? 0.22 * wxRt.show * (title ? 0.6 : cameraMode === 'cockpit' ? 0.7 : 1) : 0;
    wxRt.rainG.gain.value += (want - wxRt.rainG.gain.value) * Math.min(1, dt * 3);
  }
}

// ---------- 판정: 바람에 밀림 · 난기류 (34-flight phys / updP 에서 부른다). 낮 · 맑음이면 아무것도 안 한다
function weatherDrift(a, dt) {
  if (WX.wind.x === 0 && WX.wind.z === 0) return;
  if (a === p && typeof ops !== 'undefined' && ops.st !== 'fly') return; // 갑판 위에서는 밀리지 않는다
  a.pos.addScaledVector(WX.wind, dt);
}
function weatherTurb(dt) {
  if (!WX.turb || (typeof ops !== 'undefined' && ops.st !== 'fly')) return;
  // 부드러운 무작위 흔들림 (판정 난수 — 같은 시드면 같은 흔들림). 세기는 속도가 빠를수록 조금 더
  const k = Math.min(1, dt * 1.6);
  wxRt.turbP += ((rnd() - 0.5) * 2 * WX.turb - wxRt.turbP) * k;
  wxRt.turbR += ((rnd() - 0.5) * 2 * WX.turb * 1.6 - wxRt.turbR) * k;
  const s = 0.6 + Math.min(1, p.speed / 250) * 0.6;
  p.q.multiply(new T.Quaternion().setFromEuler(new T.Euler(wxRt.turbP * s * dt * 6, 0, wxRt.turbR * s * dt * 6))).normalize();
}
