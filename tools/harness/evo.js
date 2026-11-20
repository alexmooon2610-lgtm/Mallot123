// 진화 난도 대응 수법 단위 시험 (V16) — 게임이 로드된 뒤 일반 <script> 로 주입된다.
// 적 한 대와 플레이어를 정해진 자리에 두고, 게임 루프 없이 aiUpdate(적)만 돌린다. 플레이어는 직진.
// 같은 상황을 '어려움'(수법 없음)과 '진화'(그 수법만 켬)로 돌려 행동이 기대대로 갈리는지 본다.
window.__evo = (() => {
  const DT = 1 / 60;
  const face = d => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(V(), d.clone().normalize(), V(0, 1, 0)));
  function setup(tactic) {
    if (rnd.seed) rnd.seed(7);
    activeMode = 'CARRIER';
    activeMission = 'LEGACY';
    start();
    es.forEach(e => scene.remove(e.mesh));
    es = [];
    ms.forEach(m => scene.remove(m.mesh));
    ms = [];
    wt = 1e9;
    setSt('fly');
    ops.safe = 0;
    p.pos.set(40000, 5000, 40000);
    p.q.copy(face(V(0, 0, -1)));
    p.vd.set(0, 0, -1);
    p.speed = 200;
    p.gearDown = false;
    rd.on = 1;
    rd.lock = null;
    DF = DIFF.hard;
    EVO.on = !!tactic;
    EVO.c = tactic ? { [tactic]: true } : {};
    EVO.cut = 1; // 시험: 플레이어는 늘 오른쪽으로 돈다
  }
  function enemy(rel, dir, speed, known = true) {
    const e = mkAc('E');
    e.pos.copy(p.pos).add(rel);
    e.vd.copy(dir).normalize();
    e.q.copy(face(e.vd));
    e.speed = speed;
    e.thr = 0.8;
    e.am = { SARH: 0, IR: 0 }; // 이 시험에서는 쏘지 않는다
    e.gun = 0;
    e.rd = { phase: known ? 'TRACK' : 'SEARCH', t: 0, lost: 0, relock: 0 };
    e.ai = { hint: 5, goal: e.fwd(), irT: 0, fd: 0, tick: 0, cvIgnore: 0, cvDecision: 0, cvEvade: 0, cvMissileResponseTimer: 0, cvMissileResponseChosen: 0 };
    e.mesh = new T.Object3D();
    es.push(e);
    return e;
  }
  function run(e, secs, each) {
    for (let i = 0; i < secs * 60; i++) {
      p.pos.addScaledVector(p.vd, p.speed * DT);
      aiUpdate(DT, e);
      if (each) each(i);
    }
  }
  const T0 = {
    // 플레어 조기 살포: 플레이어가 적 꼬리 3 km 에 붙어 있다 → 미사일이 없어도 미리 플레어
    flare(tac) {
      setup(tac);
      const e = enemy(V(0, 0, -3000), V(0, 0, -1), 200);
      const f0 = e.fl;
      run(e, 10);
      return { flares: f0 - e.fl };
    },
    // 노칭: 레이더 락을 14 km 에서 받는다 → 진화는 빔(옆으로) + 강하 + 채프, 어려움은 11 km 밖이라 그대로 다가온다
    notch(tac) {
      setup(tac);
      const e = enemy(V(0, 0, -14000), V(0, 0, 1), 250);
      rd.lock = { tg: e };
      const y0 = e.pos.y;
      let ch = 0;
      const _c = chaff;
      chaff = a => (ch++, _c(a));
      run(e, 6);
      chaff = _c;
      const los = p.pos.clone().sub(e.pos).normalize();
      return { aspectDeg: Math.round(Math.acos(clamp(e.fwd().dot(los), -1, 1)) / D), dive: Math.round(y0 - e.pos.y), chaff: ch };
    },
    // 선회 끊기: 적이 2.5 km 뒤에서 추격 → 진화는 플레이어가 늘 도는 쪽(오른쪽)으로 앞질러 겨눈다
    cut(tac) {
      setup(tac);
      const e = enemy(V(0, 0, 2500), V(0, 0, -1), 250);
      run(e, 4);
      return { rightOffset: Math.round(e.pos.x - p.pos.x) };
    },
    // 래그 추적: 적이 1.2 km 뒤에서 훨씬 빨리 다가온다 → 진화는 속도를 맞춰 앞지르지 않는다
    lag(tac) {
      setup(tac);
      p.speed = 140;
      const e = enemy(V(0, 0, 1200), V(0, 0, -1), 260);
      let minD = 1e9,
        passed = 0;
      run(e, 12, () => {
        minD = Math.min(minD, e.pos.distanceTo(p.pos));
        if (e.pos.z < p.pos.z - 50) passed = 1;
      });
      return { minDist: Math.round(minD), overshoot: !!passed };
    },
    // 고도 우위: 적이 1.5 km 아래 · 6 km 앞에 있다 → 진화는 더 가파르게 올라온다
    climb(tac) {
      setup(tac);
      const e = enemy(V(0, -1500, -6000), V(0, 0, 1), 240);
      const y0 = e.pos.y;
      run(e, 8);
      return { climb: Math.round(e.pos.y - y0) };
    },
  };
  // 기대: 진화 쪽 값이 어려움 쪽보다 확실히 '그 수법답게' 나와야 한다
  const EXPECT = {
    flare: (h, v) => v.flares >= 2 && h.flares === 0,
    notch: (h, v) => v.aspectDeg >= 60 && v.dive > h.dive + 100 && v.chaff > h.chaff,
    cut: (h, v) => v.rightOffset > h.rightOffset + 150,
    lag: (h, v) => !v.overshoot && v.minDist > h.minDist + 150,
    climb: (h, v) => v.climb > h.climb + 150,
  };
  // 진화 알고리즘 자체 시험: 가짜 성적(사격 거리 짧을수록 · 접근 고도 높을수록 좋음)으로 25세대를 돌려 개체군이 그쪽으로 옮겨 가는지
  function ga() {
    evoPoolReset();
    EVO.on = true;
    const iE = EVO_GI.eng,
      iA = EVO_GI.alt,
      mean = i => {
        const top = EVOP.pool.slice(0, 8);
        return top.reduce((s, c) => s + c.g[i], 0) / Math.max(1, top.length);
      };
    const hist = [];
    for (let gen = 0; gen < 25; gen++) {
      evoGeneration();
      for (let k = 0; k < 4; k++) {
        const e = {};
        evoAssign(e);
        const r = EVOG.get(e);
        r.f = (1 - r.g[iE]) * 3 + r.g[iA] * 3;
        evoFinalize(e, false);
      }
      if (gen === 3 || gen === 24) hist.push({ gen: gen + 1, eng: +mean(iE).toFixed(2), alt: +mean(iA).toFixed(2) });
    }
    const I = evoGeneIntel(true);
    evoPoolReset();
    return { hist, traits: I.traits };
  }
  return { T0, EXPECT, ga };
})();
