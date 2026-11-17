// =====================================================================
// 캠페인 TR-2 · 모의 도그파이트 (MOCK DOGFIGHT)
//  - 1999-12-18, 「자랴」 훈련 공역. 편대 동료 "템페스트 투"의 MiG-29 와 1대1 근접전을 3판 2선승으로 겨룬다.
//  - 모의전이라 무기에 맞아도 터지지 않는다. 맞은 쪽이 그 판을 지고(격추 판정), 둘 다 다시 마주 보고 시작한다.
//    무기 명중은 mockKill 이 가로챈다 (30-hitbox-guns 의 hurt · 32-missiles 의 명중 처리).
//    바다 추락 · 공중 충돌은 진짜 사고라 그대로 임무 실패다.
//  - 상대는 적(E) 진영 AI 를 그대로 쓰지만 e.mock 으로 표시해 항모 방공이 쏘지 않는다.
// =====================================================================
const TR2_WIN = 2;
let tr2 = null;
function tr2Foe() {
  return es.find(e => e.mock);
}
// 상대기(어그레서) 생성: MiG-29 모델 + 적 AI. 무장은 R-73 2발과 기총.
function tr2Spawn() {
  const x = mkAc('E');
  x.mock = 1;
  x.am = { SARH: 0, IR: 2 };
  x.rd = { phase: 'SEARCH', t: 0, lost: 0, relock: 0 };
  x.ai = {
    hint: 3,
    goal: V(0, 0, -1),
    irT: 0,
    fd: 0,
    tick: 0,
    cvIgnore: 0,
    cvDecision: 0,
    cvEvade: 0,
    cvMissileResponseTimer: 0,
    cvMissileResponseChosen: 0,
  };
  x.mesh = createMiG29({ gearDown: false });
  x.mesh.scale.setScalar(3);
  scene.add(x.mesh);
  hbViz(x);
  es.push(x);
  return x;
}
// 한 판 시작: 7 km 떨어져 서로 마주 보고, 탄약과 기체 상태를 되돌린다
function tr2Merge() {
  const T2 = tr2,
    x = tr2Foe() || tr2Spawn(),
    { f, r } = tr1Frame(),
    up = V(0, 1, 0),
    face = d => new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(V(), d, up));
  // 날아다니던 탄 · 플레어 정리
  ms.forEach(m => scene.remove(m.mesh));
  ms = [];
  bl.forEach(b => scene.remove(b.m));
  bl = [];
  fl.forEach(q => {
    freeSprite(q.s);
    flareFree(q);
  });
  fl = [];
  // 플레이어: 지금 자리에서 수평으로, 구름층 위 고도
  p.pos.y = clamp(p.pos.y, 3800, 6000);
  p.q.copy(face(f));
  p.vd.copy(f);
  p.speed = 235;
  p.hp = 1;
  p.fl = p.ch = 30;
  p.gun = 500;
  p.am.SARH = loadout().SARH;
  p.am.IR = loadout().IR;
  rd.lock = null;
  rd.sel = null;
  rd.ct = [];
  // 상대: 정면 7 km, 살짝 옆 · 위
  x.pos
    .copy(p.pos)
    .addScaledVector(f, 7000)
    .addScaledVector(r, 600)
    .setY(p.pos.y + 150);
  x.q.copy(face(f.clone().negate()));
  x.vd.copy(x.fwd());
  x.speed = 235;
  x.hp = 1;
  x.ab = 0;
  x.am = { SARH: 0, IR: 2 };
  x.gun = 300;
  x.fl = x.ch = 12;
  x.rd = { phase: 'SEARCH', t: 0, lost: 0, relock: 0 };
  x.ai.fd = 0;
  x.ai.irT = 0;
  x.mesh.position.copy(x.pos);
  x.mesh.quaternion.copy(x.q);
  T2.live = true;
  T2.round++;
  missionPhase = 'fight';
  msg(`${T2.round}판 — FIGHT'S ON! (${T2.win} : ${T2.loss})`, '#ffd36b');
  tone(520, 0.12, 'sine', 0.05, 780);
}
MISSIONS.TR2 = {
  id: 'TR2',
  label: 'TR-2',
  title: 'MOCK DOGFIGHT',
  category: 'TRAINING',
  env: 'CARRIER',
  weather: 'CLEAR',
  requires: 'TR1',
  start: 'deck',
  waves: false,
  loadout: true,
  par: [420, 600, 840],
  sub: { ko: '기총 · 플레어/채프 회피', en: 'Guns and countermeasures' },
  intro: '동료기와 3판 2선승 모의 근접전 후 귀함',
  brief: {
    ko: {
      sum: '1999년 12월 18일, 북태평양. 편대 동료 「템페스트 투」의 MiG-29 와 1대1 모의 근접전을 벌인다. 3판 2선승. 모의전이라 맞아도 터지지 않고, 맞은 쪽이 그 판을 진다. 상대는 R-73 2발과 기총으로 실제처럼 덤빈다.',
      obj: [
        'Shift 로 스키점프 발진',
        '상대기와 정면으로 마주친 뒤 꼬리를 물어라',
        '기총(G) 또는 R-73(IR)으로 격추 판정을 2번 먼저 따내라',
        '상대 미사일은 플레어(X)·채프(C)와 급선회로 피하라',
        '항모로 귀함해 착함',
      ],
      tips: [
        '경보창이 대응수단을 알려 준다: IR → 플레어 [X], RADAR → 채프 [C]. 한 번에 안 먹히면 이어서 뿌려라.',
        '9G 로 오래 당기면 블랙아웃이 온다. 시야가 좁아지면 잠깐 풀어 줘라.',
        '바다 추락과 공중 충돌은 모의가 아니다. 그대로 임무 실패.',
        '평가: 승리 50 (2–0) / 40 (2–1) · 피격 판정 없음 20 · 비행 시간 15 · 착함 15.',
      ],
    },
    en: {
      sum: 'North Pacific, 18 December 1999. A one-on-one mock dogfight against your wingman TEMPEST 2 in a MiG-29, best of three. Nothing explodes: whoever gets hit loses the round. The opponent fights for real with two R-73s and the gun.',
      obj: [
        'Press Shift to launch off the ski jump',
        'Meet the opponent head-on, then get on the tail',
        'Score two kill calls first with the gun (G) or R-73 (IR)',
        'Beat incoming missiles with flares (X), chaff (C) and hard turns',
        'Return to the carrier and trap',
      ],
      tips: [
        'The alert names the counter: IR → FLARE [X], RADAR → CHAFF [C]. If one release fails, keep releasing.',
        'Holding 9 G brings blackout. Ease off when your vision narrows.',
        'Hitting the sea or the other jet is not simulated. That fails the mission.',
        'Grading: win 50 (2–0) / 40 (2–1) · never hit 20 · time 15 · trap 15.',
      ],
    },
  },
  init() {
    missionReset();
    tr2 = { stage: 'deck', win: 0, loss: 0, round: 0, wait: 0, live: false, bolters: 0, bolterOn: false };
    missionPhase = 'deck';
    msg('TR-2 MOCK DOGFIGHT — 발진 준비 후 훈련 공역으로', '#9cf');
  },
  update(dt) {
    if (S !== 'play' || missionComplete || missionFailed || !tr2) return;
    const T2 = tr2;
    const b = ops.bolter > 0;
    if (b && !T2.bolterOn) T2.bolters++;
    T2.bolterOn = b;
    if (T2.stage === 'deck') {
      if (ops.st === 'fly') {
        missionStartTime = t;
        T2.stage = 'wait';
        T2.wait = 8;
        missionPhase = 'transit';
        msg('발진 완료 — 구름층 위로 상승하라. 템페스트 투 접근 중', '#9cf');
      }
      return;
    }
    if (T2.stage === 'wait') {
      if (ops.st !== 'fly') return; // 갑판에 있는 동안은 판을 시작하지 않는다
      if ((T2.wait -= dt) <= 0) {
        T2.stage = 'fight';
        tr2Merge();
      }
      return;
    }
    if (T2.stage === 'return' && (ops.st === 'land' || ops.st === 'serve')) {
      missionElapsed = Math.max(0, t - missionStartTime);
      completeMission(this);
    }
  },
  // 무기 명중 가로채기: true 를 돌려주면 실제 격추(폭발)를 하지 않는다
  mockKill(a) {
    const T2 = tr2;
    if (!T2 || (a !== p && !a.mock)) return false;
    a.hp = 1;
    if (!T2.live) return true; // 판이 끝난 뒤의 유탄
    T2.live = false;
    if (a === p) {
      T2.loss++;
      msg(`피격 판정 — ${T2.round}판 패배 (${T2.win} : ${T2.loss})`, '#f66');
      tone(180, 0.4, 'sawtooth', 0.08, 90);
    } else {
      T2.win++;
      msg(`격추 판정 — ${T2.round}판 승리 (${T2.win} : ${T2.loss})`, '#52ffc0');
      tone(660, 0.14, 'sine', 0.05, 990);
    }
    if (T2.loss >= TR2_WIN) {
      failMission(`모의 공중전 패배 (${T2.win} : ${T2.loss})`);
    } else if (T2.win >= TR2_WIN) {
      // 상대기는 편대에서 이탈 (폭발 없이 사라진다)
      const x = tr2Foe();
      if (x) {
        scene.remove(x.mesh);
        es = es.filter(e => e !== x);
        rd.ct = rd.ct.filter(c => c.tg !== x);
        if (rd.lock && rd.lock.tg === x) rd.lock = null;
      }
      T2.stage = 'return';
      missionPhase = 'return';
      msg('모의전 승리 — 항모로 귀함해 착함하라', '#ffd36b');
    } else {
      T2.stage = 'wait';
      T2.wait = 4;
      missionPhase = 'transit';
    }
    return true;
  },
  hud() {
    const T2 = tr2 || { win: 0, loss: 0 };
    const obj = {
      deck: 'Shift — 스키점프 발진',
      transit: `다음 판 준비 — ${T2.win} : ${T2.loss}`,
      fight: `모의 공중전 ${T2.win} : ${T2.loss} — 2선승`,
      return: '항모로 귀함 — 착함하라',
      complete: '임무 완료',
      failed: '임무 실패',
    }[missionPhase];
    const hint = {
      transit: '구름층(2,600 m) 위에서 수평 비행으로 대기',
      fight: 'G 기총 · 2 IR → Space · X 플레어 · C 채프 — 꼬리를 물어라',
      return: '항모 후방 정렬 · 590 km/h 미만 · 완만한 강하 · 기어·플랩은 자동 보조',
    }[missionPhase];
    return { objective: obj || '임무 진행', hint: hint || '', guidance: '' };
  },
  isComplete() {
    return !!missionComplete;
  },
  isFailed() {
    return !!missionFailed;
  },
  score() {
    return { ...this.evaluate(), stats: { ...missionStats } };
  },
  evaluate() {
    const T2 = tr2 || { win: 0, loss: 0, bolters: 0 },
      el = missionElapsed,
      won = T2.win >= TR2_WIN,
      res = won ? (T2.loss ? 40 : 50) : T2.win * 10,
      clean = T2.loss === 0 ? 20 : T2.loss === 1 ? 10 : 0,
      ts = el <= this.par[0] ? 15 : el <= this.par[1] ? 10 : el <= this.par[2] ? 6 : 3,
      land = won ? Math.max(5, 15 - T2.bolters * 5) : 0,
      score = Math.round(res + clean + ts + land);
    return {
      score,
      rank: rankOf(score),
      lines: [
        ['모의전 결과', `${T2.win} : ${T2.loss}  (${res}/50)`],
        ['피격 판정', `${T2.loss}회  (${clean}/20)`],
        ['비행 시간', `${fmtTime(el)}  (목표 ${fmtTime(this.par[0])} · ${ts}/15)`],
        ['볼터', `${T2.bolters}회  (${land}/15)`],
        ['점수', score],
      ],
    };
  },
};
