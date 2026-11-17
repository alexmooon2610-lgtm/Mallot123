// 무장 단위 시험 (미사일 유도 · 기총 · 대응수단) — 게임이 로드된 뒤 일반 <script> 로 주입된다 (최상위 let/const 를 읽으려고).
// 직접 시험(direct): 게임 루프 없이 updMsl / updBul 만 돌린다. 표적은 정해진 대로 움직인다.
// 대응수단 시험(cm): 실제 게임 루프(__det.step)로 돌려 플레어 물리 · 기만 판정까지 포함한다.
window.__wpn = (() => {
  const DT = 1 / 60;
  const face = d => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(V(), d.clone().normalize(), V(0, 1, 0)));

  // 깨끗한 판: LEGACY 로 시작해 적 · 미사일 · 탄을 비우고, 플레이어를 고도 5000 m 수평 비행(북쪽 = -z)에 둔다
  function setup(seed) {
    if (rnd.seed) rnd.seed(seed);
    activeMode = 'CARRIER';
    activeMission = 'LEGACY';
    start();
    es.forEach(e => scene.remove(e.mesh));
    es = [];
    ms.forEach(m => scene.remove(m.mesh));
    ms = [];
    wt = 1e9; // 다음 웨이브가 오지 않게
    setSt('fly');
    ops.safe = 0;
    p.pos.set(0, 5000, 0);
    p.q.copy(face(V(0, 0, -1)));
    p.vd.set(0, 0, -1);
    p.speed = 250;
    p.thr = 0.8;
    p.ab = 0;
    p.gearDown = false;
    p.flap = 0;
    rd.on = 1;
    rd.lock = null;
  }
  function enemy(pos, dir, speed) {
    const e = mkAc('E');
    e.pos.copy(pos);
    e.vd.copy(dir).normalize();
    e.q.copy(face(e.vd));
    e.speed = speed;
    e.thr = 0.8;
    es.push(e);
    return e;
  }
  // 표적을 직접 움직이고 미사일만 갱신한다. turnAt 이후 표적은 수평으로 g 만큼 선회한다
  function fly(e, m, { secs = 25, dropAt = Infinity, turnAt = Infinity, turnG = 0 } = {}) {
    for (let i = 0; i < secs * 60; i++) {
      t += DT;
      if (t >= dropAt) rd.lock = null;
      if (t >= turnAt && turnG) {
        const w = (turnG * 9.81) / e.speed; // 각속도 rad/s
        e.vd.applyAxisAngle(V(0, 1, 0), w * DT).normalize();
        e.q.copy(face(e.vd));
      }
      e.pos.addScaledVector(e.vd, e.speed * DT);
      p.pos.addScaledVector(p.vd, p.speed * DT);
      updMsl(m, DT);
      if (e.hp <= 0) return { hit: true, t: +t.toFixed(2) };
      if (m.dead) return { hit: false, t: +t.toFixed(2), why: m.note || 'expired' };
    }
    return { hit: false, t: +t.toFixed(2), why: 'timeout' };
  }

  const direct = {
    // SARH: 꼬리 추격 4 km, 명중까지 락 유지 → 명중해야 한다 (7 km 꼬리 추격은 운동 에너지가 모자라 원래 안 닿는다)
    sarh_lock() {
      setup(1);
      t = 0;
      const e = enemy(V(0, 5000, -4000), V(0, 0, -1), 250);
      rd.lock = { tg: e };
      fire(p, 'SARH', e);
      return fly(e, ms[ms.length - 1]);
    },
    // SARH: 1초 뒤 락을 놓고, 표적은 2초부터 5 G 선회 → 관성 비행 뒤 빗나가야 한다
    sarh_drop() {
      setup(1);
      t = 0;
      const e = enemy(V(0, 5000, -4000), V(0, 0, -1), 250);
      rd.lock = { tg: e };
      fire(p, 'SARH', e);
      return fly(e, ms[ms.length - 1], { dropAt: 1, turnAt: 2, turnG: 5 });
    },
    // IR: 락 없이 발사, 정면 20° 오른쪽 3.5 km 의 멀어지는 적 → 스스로 물고 명중해야 한다
    ir_nolock_20() {
      setup(1);
      t = 0;
      const a = 20 * D,
        e = enemy(V(Math.sin(a) * 3500, 5000, -Math.cos(a) * 3500), V(0, 0, -1), 250);
      fire(p, 'IR', null);
      return fly(e, ms[ms.length - 1]);
    },
    // IR: 락 없이 발사, 90° 옆 3 km → 시커 시야(±60°) 밖이라 못 찾아야 한다
    ir_nolock_90() {
      setup(1);
      t = 0;
      const e = enemy(V(3000, 5000, 0), V(0, 0, -1), 250);
      fire(p, 'IR', null);
      return fly(e, ms[ms.length - 1]);
    },
    // IR: 락 걸고 발사 직후 플레이어 IRST 를 꺼도 (발사 후 망각) 명중해야 한다
    ir_fire_forget() {
      setup(1);
      t = 0;
      const e = enemy(V(0, 5000, -3500), V(0, 0, -1), 250);
      fire(p, 'IR', e);
      sk.st = 'OFF';
      sk.tg = null;
      return fly(e, ms[ms.length - 1]);
    },
  };
  const EXPECT = { sarh_lock: true, sarh_drop: false, ir_nolock_20: true, ir_nolock_90: false, ir_fire_forget: true };

  // 기총: 400 m 앞에서 같은 속도로 나란히 나는 적에게 30발/초로 쏴서, 격추까지 맞힌 발 수를 센다
  function gunHits() {
    setup(1);
    t = 0;
    const e = enemy(V(0, 5000, -400), V(0, 0, -1), 250);
    let hits = 0,
      shots = 0;
    const orig = window.hurt;
    window.hurt = (a, d) => {
      if (a === e) hits++;
      return orig(a, d);
    };
    try {
      for (let i = 0; i < 20 * 60 && e.hp > 0; i++) {
        t += DT;
        e.pos.addScaledVector(e.vd, e.speed * DT);
        p.pos.addScaledVector(p.vd, p.speed * DT);
        if (i % 2 === 0) {
          bullet(p, p.fwd());
          shots++;
        }
        updBul(DT);
      }
    } finally {
      window.hurt = orig;
    }
    return { killed: e.hp <= 0, hits, shots };
  }

  // 대응수단: 적이 플레이어 꼬리 3 km 에서 IR 을 쏜다. 플레이어는 직진하며 flares 번 플레어를 뿌린다 (0.5초 간격, 1초부터)
  // 시드 seed 로 한 번 돌려 피격 여부를 돌려준다. 실제 게임 루프로 돈다.
  function cmTrial(seed, flares) {
    setup(seed);
    const e = enemy(V(0, 5000, 3000), V(0, 0, -1), 250);
    fire(e, 'IR', p);
    es = []; // 쏜 적은 빼서 더 쏘지 않게 (미사일은 혼자 날아간다)
    scene.remove(e.mesh);
    const inputs = {},
      f0 = __det.frame;
    for (let i = 0; i < flares; i++) {
      const f = f0 + 60 + i * 30;
      inputs[f] = [['KeyX', true]];
      inputs[f + 2] = [['KeyX', false]];
    }
    for (let i = 0; i < 12 * 60 && S === 'play'; i++) __det.step(1, inputs);
    return p.hp <= 0;
  }
  return { direct, EXPECT, cmTrial, gunHits };
})();
