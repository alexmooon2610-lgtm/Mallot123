// ===== 미사일 비행운 · 폭발 연출 (에이스 컴뱃 풍) =====
// 화면 표현만 덧붙인다: 미사일 이동·명중 판정(updMsl)과 피해 처리(kill)는 그대로 호출한다.
const TRAILS = [];
const TRAIL_LIFE = 7,
  TRAIL_MAX = 480;
const trailMat = new T.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: T.DoubleSide,
  uniforms: { fogColor: { value: new T.Color() }, fogNear: { value: 6000 }, fogFar: { value: 62000 } },
  vertexShader: `attribute float alpha; attribute float side; varying float vA; varying float vD; varying float vS;
    void main(){ vA = alpha; vS = side; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 fogColor; uniform float fogNear, fogFar; varying float vA; varying float vD; varying float vS;
    void main(){ vec3 c = mix(vec3(0.93, 0.95, 0.97), fogColor, smoothstep(fogNear, fogFar, vD));
      float edge = 1.0 - vS * vS; // 리본 가장자리를 부드럽게: 납작한 띠가 아니라 연기 기둥처럼 보이게
      gl_FragColor = vec4(c, vA * 1.3 * edge * smoothstep(15.0, 140.0, vD) * (1.0 - smoothstep(fogNear, fogFar, vD) * 0.7));
      #include <tonemapping_fragment>
      #include <encodings_fragment>
    }`,
});
// o: { life 수명(초), w0 시작 폭, wk 초당 퍼짐, amax 최대 불투명도, done() 끝났는지 }
function makeTrail(o) {
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(new Float32Array(TRAIL_MAX * 2 * 3), 3));
  geo.setAttribute('alpha', new T.BufferAttribute(new Float32Array(TRAIL_MAX * 2), 1));
  const side = new Float32Array(TRAIL_MAX * 2);
  for (let i = 0; i < side.length; i++) side[i] = i % 2 ? -1 : 1;
  geo.setAttribute('side', new T.BufferAttribute(side, 1));
  const idx = [];
  for (let i = 0; i < TRAIL_MAX - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geo.setIndex(idx);
  geo.setDrawRange(0, 0);
  const mesh = new T.Mesh(geo, trailMat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const tr = Object.assign({ pts: [], mesh, life: TRAIL_LIFE, w0: 1.0, wk: 1.3, amax: 0.6, done: () => false }, o);
  TRAILS.push(tr);
  return tr;
}
function trailFor(m) {
  return m._trail || (m._trail = makeTrail({ done: () => m.dead || !ms.includes(m) }));
}
function trailPush(tr, pos, minGap = 8) {
  const last = tr.pts[tr.pts.length - 1];
  if (!last || last.p.distanceToSquared(pos) > minGap * minGap) {
    tr.pts.push({ p: pos.clone(), t });
    if (tr.pts.length > TRAIL_MAX) tr.pts.shift();
  }
}
// 날개 끝 베이퍼: 고G 선회 중에만 이어지는 가는 흰 줄
const VAPOR = {};
function vaporPush(side, pos) {
  let v = VAPOR[side];
  if (!v || t - v.lastT > 0.15) {
    if (v) v.tr.ended = true;
    const tr = makeTrail({ life: 2.4, w0: 0.45, wk: 1.6, amax: 0.62 });
    tr.done = () => tr.ended;
    v = VAPOR[side] = { tr, lastT: t };
  }
  v.lastT = t;
  trailPush(v.tr, pos, 4);
}
// ---------- 플레어 · 채프 (시야 가림 방지)
// 플레어: 흰빛 마그네슘 심지 + 깜빡이는 주황 광륜 + 굵게 퍼지는 흰 연기 + 떨어지는 불티.
// 위치·속도·수명(게임 판정용)은 건드리지 않고 그리는 것만 덧붙인다. 난수는 연출용 vrnd 만 쓴다.
const FLARE_SIZE = 15,
  CHAFF_SCALE = 0.55;
function flareTrail(f) {
  const halo = getSprite(0xff8a2a, true, FIRETX);
  halo.position.copy(f.pos);
  halo.scale.setScalar(1);
  halo.material.opacity = 0;
  f.s.material.color.set(0xfff6dc);
  f.viz = {
    halo,
    seed: vrnd() * 100,
    spark: vrnd() * 0.07,
    oc: 0,
    oh: 0,
    tr: makeTrail({ life: 2.4, w0: 1.0, wk: 2.6, amax: 0.6, done: () => !fl.includes(f) }),
  };
  // 사출 순간의 짧은 섬광
  const pop = getSprite(0xfff0c0, true, TX);
  pop.position.copy(f.pos);
  pop.scale.setScalar(24);
  fx.push({ s: pop, t: 0, life: 0.16, size: 24, grow: -0.5 });
}
function flareViz(f, dt) {
  const v = f.viz,
    a = f.age;
  // 점화 0.12초 → 수명의 60%까지 최대 연소 → 그 뒤 꺼져 감
  const burn = clamp(a / 0.12, 0, 1) * (1 - clamp((a / f.life - 0.6) / 0.4, 0, 1));
  const fk = 0.78 + 0.22 * Math.sin(a * 53 + v.seed) * Math.sin(a * 31 + v.seed * 2);
  v.oc = burn * (0.85 + 0.15 * fk);
  v.oh = burn * 0.6 * fk;
  f.s.scale.setScalar(FLARE_SIZE * (0.8 + 0.35 * fk));
  f.s.material.opacity = v.oc;
  v.halo.position.copy(f.pos);
  v.halo.scale.setScalar(FLARE_SIZE * (2.4 + 0.7 * fk) * (0.5 + 0.5 * burn));
  v.halo.material.opacity = v.oh;
  if (burn > 0.05) trailPush(v.tr, f.pos, 5);
  // 불티: 연기 속에 남아 잠깐 빛나다 사그라진다
  if ((v.spark += dt) > 0.07 && burn > 0.3) {
    v.spark = 0;
    const s = getSprite(vrnd() < 0.5 ? 0xffc070 : 0xfff0d0, true, TX);
    s.position.copy(f.pos).add(V(vrnd() - 0.5, vrnd() - 0.5, vrnd() - 0.5).multiplyScalar(7));
    const sz = 2.5 + vrnd() * 3;
    s.scale.setScalar(sz);
    fx.push({ s, t: 0, life: 0.35 + vrnd() * 0.35, size: sz, grow: -0.7 });
  }
}
function flareFree(f) {
  if (f.viz) freeSprite(f.viz.halo);
}
// 카메라가 스프라이트 반경 안으로 들어가면 흐리게 해서 화면 전체가 덮이지 않게 한다.
// 불투명도의 기준값(f.op)은 메인 루프가 매 프레임 갱신하고, 여기서는 곱하기만 한다.
function nearFade(s, k = 1) {
  const r = s.scale.x;
  if (r < 1) return 1;
  return clamp((s.position.distanceTo(cam.position) - r * 0.45 * k) / (r * 0.85 * k), 0, 1);
}
function fxNearFade() {
  // 플레어는 카메라 바로 앞을 지나가므로 더 일찍 흐려진다
  for (const f of fl) {
    if (f.viz) {
      f.s.material.opacity = f.viz.oc * nearFade(f.s, 3);
      f.viz.halo.material.opacity = f.viz.oh * nearFade(f.viz.halo, 1.5);
    } else if (f.op !== undefined) f.s.material.opacity = f.op * nearFade(f.s, 3);
  }
  for (const f of fx) if (f.op !== undefined) f.s.material.opacity = f.op * nearFade(f.s);
}
const _tA = V(),
  _tB = V(),
  _tC = V();
function trailsUpdate() {
  trailMat.uniforms.fogColor.value.copy(scene.fog.color);
  trailMat.uniforms.fogNear.value = scene.fog.near;
  trailMat.uniforms.fogFar.value = scene.fog.far;
  for (let k = TRAILS.length - 1; k >= 0; k--) {
    const tr = TRAILS[k];
    while (tr.pts.length && t - tr.pts[0].t > tr.life) tr.pts.shift();
    if (!tr.pts.length && tr.done()) {
      scene.remove(tr.mesh);
      tr.mesh.geometry.dispose();
      TRAILS.splice(k, 1);
      continue;
    }
    const n = tr.pts.length,
      pos = tr.mesh.geometry.attributes.position.array,
      al = tr.mesh.geometry.attributes.alpha.array;
    for (let i = 0; i < n; i++) {
      const pt = tr.pts[i],
        age = Math.max(0, t - pt.t),
        nx = tr.pts[Math.min(n - 1, i + 1)].p,
        pv = tr.pts[Math.max(0, i - 1)].p;
      _tA.subVectors(nx, pv);
      if (_tA.lengthSq() < 1e-6) _tA.set(0, 0, 1);
      _tB.subVectors(cam.position, pt.p);
      _tC.crossVectors(_tA, _tB).normalize();
      const w = tr.w0 + age * tr.wk,
        head = clamp((n - 1 - i) / 4, 0, 1);
      pos[i * 6] = pt.p.x + _tC.x * w;
      pos[i * 6 + 1] = pt.p.y + _tC.y * w;
      pos[i * 6 + 2] = pt.p.z + _tC.z * w;
      pos[i * 6 + 3] = pt.p.x - _tC.x * w;
      pos[i * 6 + 4] = pt.p.y - _tC.y * w;
      pos[i * 6 + 5] = pt.p.z - _tC.z * w;
      const a = Math.pow(clamp(1 - age / tr.life, 0, 1), 1.6) * tr.amax * head;
      al[i * 2] = al[i * 2 + 1] = a;
    }
    tr.mesh.geometry.attributes.position.needsUpdate = true;
    tr.mesh.geometry.attributes.alpha.needsUpdate = true;
    tr.mesh.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
  }
}

// ---------- 폭발: 섬광 + 불덩이 + 검은 연기 + 파편 불꽃
const FIRETX = canvTex((x, s) => {
  const r = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,250,220,1)');
  r.addColorStop(0.25, 'rgba(255,200,90,.95)');
  r.addColorStop(0.55, 'rgba(255,110,30,.55)');
  r.addColorStop(1, 'rgba(120,30,0,0)');
  x.fillStyle = r;
  x.fillRect(0, 0, s, s);
}, 128);
let _vfx = 12345;
const vrnd = () => (_vfx = (_vfx * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; // 연출 전용 난수 (게임 난수와 분리)
// 충격파 링 텍스처
const RINGTX = canvTex((x, s) => {
  const g = x.createRadialGradient(s / 2, s / 2, s * 0.3, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0)');
  g.addColorStop(0.78, 'rgba(255,240,220,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, s, s);
}, 128);
const C = (r, g, b) => new T.Color().setRGB(r, g, b); // 선형 · 1 을 넘으면 톤매핑에서 흰빛으로 탄다
// boom() 이 부르는 추가 연출 (게임 난수는 쓰지 않는다 — vrnd 만)
//  섬광 → 불덩이(흰 → 주황 → 검게 식음) → 충격파 링 → 파편(연기 꼬리) → 올라가는 연기 기둥
function boomVfx(pos, sz) {
  const sp = (col, add, tex) => getSprite(col, add, tex);
  // 섬광: 아주 밝고 아주 짧게
  const fl = sp(0xffffff, true, TX);
  fl.position.copy(pos);
  fl.material.color.setRGB(6, 5.5, 5);
  fx.push({ s: fl, t: 0, life: 0.22, size: sz * 4.5, grow: 0.8, fade: 2 });
  // 충격파 링: 0.45 초 만에 사방으로 퍼지고 사라진다
  const rg = sp(0xffffff, true, RINGTX);
  rg.position.copy(pos);
  rg.material.color.setRGB(2.2, 2.0, 1.8);
  fx.push({ s: rg, t: 0, life: 0.38, size: sz * 0.9, grow: 4.2, fade: 2.2, opMax: 0.5 });
  // 불덩이: 안쪽은 흰빛에 가까운 노랑, 바깥은 주황. 식으면서 검붉어지고 커진다
  for (let i = 0; i < 11; i++) {
    const inner = i < 5,
      s = sp(0xffffff, true, FIRETX);
    s.position.copy(pos).add(V(vrnd() - 0.5, vrnd() - 0.5, vrnd() - 0.5).multiplyScalar(sz * (inner ? 0.4 : 0.9)));
    const size = sz * (inner ? 0.9 + vrnd() * 0.5 : 0.6 + vrnd() * 0.7);
    fx.push({
      s,
      t: vrnd() * 0.06,
      life: 0.55 + vrnd() * 0.5,
      size,
      grow: 1.6,
      fade: 1.4,
      c0: inner ? C(4.5, 3.2, 1.6) : C(3.0, 1.1, 0.25),
      c1: C(0.6, 0.08, 0.02),
      cPow: 0.7,
      vel: V(vrnd() - 0.5, vrnd() - 0.2, vrnd() - 0.5).multiplyScalar(sz * 1.2),
      drag: 2.5,
    });
  }
  // 파편: 밝은 점이 튀어나가며 가는 연기 꼬리를 남긴다 (꼬리는 6개만 — 기하 비용)
  for (let i = 0; i < 14; i++) {
    const s = sp(0xffd27a, true, TX),
      dir = V(vrnd() - 0.5, vrnd() - 0.3, vrnd() - 0.5).normalize(),
      spd = sz * (5 + vrnd() * 7);
    s.position.copy(pos).addScaledVector(dir, sz * 0.3);
    s.material.color.setRGB(3, 2, 0.8);
    fx.push({
      s,
      t: 0,
      life: 0.9 + vrnd() * 1.1,
      size: sz * 0.14,
      grow: -0.4,
      fade: 0.8,
      c0: C(3, 2, 0.8),
      c1: C(0.9, 0.25, 0.05),
      vel: dir.multiplyScalar(spd),
      grav: 60,
      drag: 0.6,
      tr: i < 6 ? makeTrail({ life: 1.3, w0: sz * 0.05, wk: sz * 0.06, amax: 0.45, done: () => false }) : null,
    });
  }
  // 연기 기둥: 늦게 나타나 위로 올라가며 커지고 오래 남는다
  for (let i = 0; i < 9; i++) {
    const s = sp(0x1a1816, false, SMOKETX);
    s.position.copy(pos).add(V(vrnd() - 0.5, vrnd() * 0.4, vrnd() - 0.5).multiplyScalar(sz * 0.8));
    const size = sz * (0.9 + vrnd() * 0.8);
    fx.push({
      s,
      t: -0.3 - vrnd() * 0.45, // 불덩이가 먼저, 연기는 그 뒤에
      life: 3.5 + vrnd() * 3,
      size,
      grow: 2.2,
      fade: 1.3,
      opMax: 0.7,
      c0: C(0.22, 0.1, 0.04),
      c1: C(0.05, 0.05, 0.05),
      cPow: 0.5,
      vel: V((vrnd() - 0.5) * sz * 0.4, sz * (0.5 + vrnd() * 0.5), (vrnd() - 0.5) * sz * 0.4),
      drag: 0.35,
    });
  }
}
