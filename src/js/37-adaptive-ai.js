// ===== 난도 · 조종사 습관 기록 · 진화하는 적 (V16.0.0) =====
// 사용자 결정 (2026-11-20):
//   · 난도 시스템 — 무한모드(LEGACY)만. 쉬움 / 보통 / 어려움 / 진화. 보통 = 예전 게임 그대로(기본값).
//   · 습관 기록 — 스토리 · 무한 상관없이 모든 공중전에서 쌓는다 (훈련 TR · 멀티 제외). 기기에 저장(stPilot).
//   · 학습하는 적은 무한모드 '진화' 난도에서만 나온다. 두 가지를 같이 쓴다:
//       ① 수법 풀기 (에일리언: 아이솔레이션 방식) — 습관이 쌓이면 그걸 받아치는 수법이 하나씩 풀린다 (이 파일)
//       ② 실제 학습 — 진화 알고리즘(적 조종사 유전자) · 신경망 예측기 (다음 단계, 38-evo-learn)
// 판정에 들어가는 것: 난도 수치(DF)와 진화 수법(EVO.c). '보통'이면 DF 의 모든 값이 예전 상수와 정확히 같고
// EVO 는 꺼져 있어 rnd 를 더 당기지 않는다 → 예전 판정과 프레임 단위로 같다.
// 습관 기록은 읽기만 한다 (판정에 영향 없음).

// ---------- 난도
const DIFF = {
  easy: {
    ko: '쉬움',
    en: 'EASY',
    waveMax: 3, // 한 웨이브 최대 기수
    waveAdd: 0,
    react: 1.5, // 레이더 탐색 → 추적 → 락 시간 배율
    cd: 1.5, // 미사일 재발사 간격 배율
    flareP: 0.45, // IR 미사일이 오면 플레어를 뿌릴 확률
    flareR: 2600, // 그 거리 (m)
    chaffT: 4.5, // 락 당했을 때 채프 간격 (초)
    turn: 0.85, // 선회 빠르기 배율
    spd: 0.95, // 목표 속도 배율
    gunCone: 3, // 기총을 쏘는 조준 각 (도)
  },
  normal: { ko: '보통', en: 'NORMAL', waveMax: 5, waveAdd: 0, react: 1, cd: 1, flareP: 0.75, flareR: 3200, chaffT: 3, turn: 1, spd: 1, gunCone: 4 },
  hard: { ko: '어려움', en: 'HARD', waveMax: 6, waveAdd: 1, react: 0.7, cd: 0.8, flareP: 0.9, flareR: 3800, chaffT: 2, turn: 1.12, spd: 1.05, gunCone: 5 },
};
DIFF.evolve = Object.assign({}, DIFF.hard, { ko: '진화', en: 'EVOLVE' }); // 어려움 + 학습하는 적
const DIFF_KEYS = ['easy', 'normal', 'hard', 'evolve'];
const diffPick = () => {
  try {
    const k = localStorage.getItem('stDiff');
    return DIFF[k] ? k : 'normal';
  } catch (e) {
    return 'normal';
  }
};
const diffSetPick = k => {
  try {
    localStorage.setItem('stDiff', k);
  } catch (e) {}
};
// 지금 판의 난도 (init 에서 정한다). 무한모드가 아니면 언제나 보통
let DIFF_KEY = 'normal',
  DF = DIFF.normal;
function diffApply(M) {
  DIFF_KEY = M && M.id === 'LEGACY' ? diffPick() : 'normal';
  DF = DIFF[DIFF_KEY];
  EVO.on = DIFF_KEY === 'evolve';
  EVO.wave = 0;
  if (EVO.on) evoRefresh(false);
  else EVO.c = {};
}

// ---------- 조종사 습관 기록 (모든 공중전, 저장 stPilot)
// 값은 판(출격)마다 0.85 배로 흐려진다 — 예전 습관은 잊히고, 플레이 방식을 바꾸면 적도 다시 따라와야 한다.
const PILOT_DECAY = 0.85;
const PILOT0 = () => ({
  v: 1,
  sorties: 0,
  combat: 0, // 공중전 시간 (초)
  ir: 0, // R-73 발사 수
  sarh: 0, // R-27R 발사 수
  sarhR: 0, // R-27R 발사 거리 합 (m)
  gun: 0, // 기총 사격 시간 (초)
  turnL: 0, // 강한 선회(3G 이상)로 돈 각도 합 (rad) — 왼쪽
  turnR: 0, // 오른쪽
  above: 0, // 가장 가까운 적보다 800 m 넘게 위에 있던 시간 (초)
  below: 0, // 800 m 넘게 아래
  cobra: 0, // 코브라 횟수
  traps: 0, // 착함 횟수
  flares: 0, // 미사일이 올 때 플레어 뿌린 수
  flareD: 0, // 그때 미사일 거리 합 (m)
});
let PILOT = (() => {
  try {
    const o = JSON.parse(localStorage.getItem('stPilot') || 'null');
    if (o && o.v === 1) return Object.assign(PILOT0(), o);
  } catch (e) {}
  return PILOT0();
})();
const PREC = { on: false, save: 0, lastF: null };
function pilotSave() {
  try {
    localStorage.setItem('stPilot', JSON.stringify(PILOT));
  } catch (e) {}
}
function pilotReset() {
  PILOT = PILOT0();
  pilotSave();
  evoPoolReset(); // 진화 개체군도 (37-evo-genes)
  if (EVO.on) evoRefresh(false);
}
// 출격할 때 (init): 기록할 판인지 정하고, 예전 기록을 한 번 흐린다
function pilotSortie(M) {
  PREC.on = !!M && !M.training && !/^TR/.test(M.id || '') && M.id !== 'VERSUS';
  PREC.lastF = null;
  if (!PREC.on) return;
  for (const k in PILOT) if (k !== 'v' && typeof PILOT[k] === 'number') PILOT[k] *= PILOT_DECAY;
  PILOT.sorties += 1;
  pilotSave();
}
// 공중전 중인가: 살아 있는 적 전투기(드론 · 원격 기체 제외)가 있다
const pilotFight = () => PREC.on && p && p.hp > 0 && es.some(e => e.hp > 0 && !e.drone && !e.net);
// 매 프레임 (90-main-loop, 판정 갱신 뒤). 읽기만 한다
function pilotRecord(dt) {
  if (!pilotFight() || !(dt > 0)) {
    PREC.lastF = null;
    return;
  }
  PILOT.combat += dt;
  const f = p.fwd(),
    fh = V(f.x, 0, f.z);
  if (fh.lengthSq() > 1e-4) {
    fh.normalize();
    if (PREC.lastF && p.g > 3) {
      const yaw = Math.asin(clamp(PREC.lastF.x * fh.z - PREC.lastF.z * fh.x, -1, 1)); // 위에서 본 회전 (오른쪽 +)
      if (yaw > 0) PILOT.turnR += yaw;
      else PILOT.turnL -= yaw;
    }
    PREC.lastF = fh;
  }
  let near = null,
    nd = 1e9;
  for (const e of es)
    if (e.hp > 0 && !e.drone && !e.net) {
      const d = e.pos.distanceTo(p.pos);
      if (d < nd) (nd = d), (near = e);
    }
  if (near && nd < 12000) {
    const dy = p.pos.y - near.pos.y;
    if (dy > 800) PILOT.above += dt;
    else if (dy < -800) PILOT.below += dt;
  }
  if ((PREC.save += dt) > 5) {
    PREC.save = 0;
    pilotSave();
  }
}
// 사건 (판정 코드에서 부른다 — 기록만 하고 아무것도 바꾸지 않는다)
function pilotEvent(kind, a, b) {
  if (!PREC.on || !p) return;
  if (kind === 'fire' && a === p) {
    if (b && b.type === 'IR') PILOT.ir++;
    else if (b && b.type === 'SARH') {
      PILOT.sarh++;
      if (b.tg) PILOT.sarhR += b.tg.pos.distanceTo(p.pos);
    }
  } else if (kind === 'gun' && a === p) PILOT.gun += 1 / (p.prm.rof || 30);
  else if (kind === 'flare' && a === p) {
    let d = 1e9;
    for (const m of ms) if (!m.dead && m.tg === p) d = Math.min(d, m.pos.distanceTo(p.pos));
    if (d < 12000) {
      PILOT.flares++;
      PILOT.flareD += d;
    }
  } else if (kind === 'cobra') PILOT.cobra++;
  else if (kind === 'trap') PILOT.traps++;
}

// ---------- 진화 난도: 습관 → 대응 수법 (수법 풀기)
// 각 수법: 습관 점수(0~1, 1 이면 풀림) · 이름 · 무엇을 받아치는지. 점수는 기록에서 바로 계산한다.
const EVO_TACTICS = [
  {
    id: 'flare',
    ko: '플레어 조기 살포',
    en: 'Early flares',
    why: { ko: 'R-73(열추적) 위주 공격', en: 'You lean on R-73 IR shots' },
    score: P0 => Math.min(1, (P0.ir / 4) * clamp((P0.ir / Math.max(1, P0.ir + P0.sarh) - 0.4) / 0.2, 0, 1)),
  },
  {
    id: 'notch',
    ko: '빔 기동 · 채프 (노칭)',
    en: 'Notching & chaff',
    why: { ko: 'R-27R(레이더) 원거리 사격', en: 'You fire R-27R from long range' },
    score: P0 =>
      Math.min(
        1,
        (P0.sarh / 4) *
          clamp((P0.sarh / Math.max(1, P0.ir + P0.sarh) - 0.35) / 0.15, 0, 1) *
          clamp((P0.sarhR / Math.max(1, P0.sarh) - 5000) / 3000, 0, 1)
      ),
  },
  {
    id: 'cut',
    ko: '선회 방향 끊기',
    en: 'Cutting your turn',
    why: { ko: '한쪽으로만 선회', en: 'You always break the same way' },
    score: P0 => {
      const s = P0.turnL + P0.turnR;
      return Math.min(1, (s / 25) * clamp((Math.abs(P0.turnL - P0.turnR) / Math.max(1e-6, s) - 0.2) / 0.15, 0, 1));
    },
  },
  {
    id: 'lag',
    ko: '추월 안 하기 (래그 추적)',
    en: 'No overshoot (lag pursuit)',
    why: { ko: '코브라로 앞질러 보내기', en: 'You cobra to force overshoots' },
    score: P0 => Math.min(1, P0.cobra / 2),
  },
  {
    id: 'climb',
    ko: '고도 우위 잡기',
    en: 'Taking the high ground',
    why: { ko: '위에서 내리꽂는 공격', en: 'You dive in from above' },
    score: P0 => {
      const s = P0.above + P0.below;
      return Math.min(1, (s / 60) * clamp((P0.above / Math.max(1e-6, s) - 0.5) / 0.15, 0, 1));
    },
  },
  {
    id: 'ambush',
    ko: '착함 매복',
    en: 'Recovery ambush',
    why: { ko: '자주 착함해 보급', en: 'You land often to rearm' },
    score: P0 => Math.min(1, P0.traps / 2),
  },
];
const EVO = { on: false, c: {}, wave: 0, cut: 0, ambushNext: false };
// 풀린 수법을 다시 계산한다 (출격 · 웨이브마다). announce: 새로 풀린 것을 무전으로 알린다
function evoRefresh(announce) {
  const prev = EVO.c,
    c = {};
  for (const t of EVO_TACTICS) if (t.score(PILOT) >= 1) c[t.id] = true;
  // 선회 끊기: 습관 쪽 (+1 오른쪽, −1 왼쪽)
  EVO.cut = PILOT.turnR >= PILOT.turnL ? 1 : -1;
  EVO.c = c;
  if (announce)
    for (const t of EVO_TACTICS)
      if (c[t.id] && !prev[t.id]) msg(`적 정보: 적 편대가 '${t.ko}'을(를) 익혔다 — ${t.why.ko}`, '#f88');
}
// 웨이브가 나올 때 (spawnWave 앞)
function evoWave() {
  if (!EVO.on) return;
  EVO.wave++;
  evoRefresh(EVO.wave > 1);
}
// 스폰 자리 바꾸기 (spawnWave 안에서, 진화 난도만): 고도 우위 → 더 높이 · 착함 매복 → 항모 뒤 접근로
function evoSpawnPos(pos, i) {
  if (!EVO.on) return pos;
  if (EVO.ambushNext) {
    // 항모 뒤(함미 쪽) 22~30 km(게임 표시 거리), 낮게 — 착함 접근로를 노린다. 항모 방공권(21 km) 바로 밖에서 들어온다
    const back = V(0, 0, 1).applyQuaternion(CV.quaternion),
      side = V(1, 0, 0).applyQuaternion(CV.quaternion);
    return CV.position
      .clone()
      .addScaledVector(back, 22500 + i * 2000)
      .addScaledVector(side, (i % 2 ? 1 : -1) * (2000 + i * 2500))
      .setY(1500 + i * 300);
  }
  if (EVO.c.climb) pos.y += 2500;
  return pos;
}
// 웨이브 사이 (90-main-loop): 착함 매복 — 다음 웨이브를 기다리는 동안 착함 접근(비행 중 기어 내림 · 항모 15 km 안)을 하면 바로 나온다
function evoWaveTimer() {
  if (!EVO.on || !EVO.c.ambush || es.length || !(wt > 0) || wt > WAVE_GAP - 5) return;
  if (ops.st === 'fly' && p.gearDown && p.pos.distanceTo(CV.position) < 15000) {
    EVO.ambushNext = true;
    wt = 1e-6; // 이번 프레임에 나온다
    msg('경고: 착함 접근로에 적 편대!', '#f66');
  }
}
// 적 AI 안에서 (36-enemy-ai, 진화 난도만): 수법별 기동 · 대응. 보통 난도에서는 부르지 않는다
const EVOAI = {
  // IR 미사일이 오면 더 일찍 · 거의 반드시 플레어 (플레어 조기 살포)
  flareR: () => (EVO.c.flare ? 5200 : DF.flareR),
  flareP: () => (EVO.c.flare ? 0.97 : DF.flareP),
  // 꼬리에 붙으면 미리 플레어 (플레어 조기 살포)
  preFlare(e, A, f, d, r, dt) {
    if (!EVO.c.flare) return;
    A.pf = (A.pf || 0) - dt;
    if (r < 4500 && f.dot(d) < -0.6 && A.pf <= 0 && e.fl > 0) {
      flare(e);
      A.pf = 2.4;
    }
  },
  // 레이더 락을 받으면 더 멀리서부터 빔 기동 + 아래로 (노칭)
  notchR: () => (EVO.c.notch ? 16000 : 11000),
  notchDive: des => EVO.c.notch && (des.y -= 0.5), // 낮게 — 바다 반사(클러터) 속으로
  notchChaff: () => (EVO.c.notch ? 1.5 : DF.chaffT),
  // 추격 중: 플레이어가 늘 도는 쪽으로 앞질러 겨눈다 (선회 끊기) · 꼬리에서 속도를 맞춰 추월하지 않는다 (래그 추적) ·
  // 아래에 있으면 올라간다 (고도 우위)
  pursue(e, A, f, d, r, des, spd) {
    if (EVO.c.cut && r < 3500) {
      const right = V(1, 0, 0).applyQuaternion(p.q);
      right.y = 0;
      if (right.lengthSq() > 1e-4) {
        const aim = p.pos.clone().addScaledVector(p.vd, p.speed * clamp(r / 700, 0, 6));
        aim.addScaledVector(right.normalize(), EVO.cut * Math.min(r, 1500) * 0.6);
        des.copy(aim.sub(e.pos).normalize());
        if (r < 1800) des.y += 0.5;
      }
    }
    if (EVO.c.lag && r < 2500 && f.dot(d) > 0.8 && p.fwd().dot(d) > 0.5) {
      spd = Math.min(spd, p.speed * 0.95 + 10);
      des.y += 0.15;
    }
    if (EVO.c.climb && e.pos.y < p.pos.y - 500) des.y += 0.3;
    return spd;
  },
};

// ---------- 브리핑 '적 정보부 보고' (진화 난도) — 91-front-menu 가 그린다
function evoIntel(ko) {
  const P0 = PILOT,
    shots = P0.ir + P0.sarh,
    turn = P0.turnL + P0.turnR,
    alt = P0.above + P0.below,
    pct = v => Math.round(v * 100) + '%',
    rows = EVO_TACTICS.map(t => {
      const s = clamp(t.score(P0), 0, 1);
      return { name: ko ? t.ko : t.en, why: ko ? t.why.ko : t.why.en, s, on: s >= 1 };
    }),
    habits = [
      [ko ? '기록한 출격' : 'Sorties logged', Math.round(P0.sorties * 10) / 10],
      [ko ? '공중전 시간' : 'Combat time', Math.round(P0.combat) + (ko ? '초' : ' s')],
      [ko ? '미사일 R-73 : R-27R' : 'R-73 : R-27R', shots >= 1 ? `${pct(P0.ir / shots)} : ${pct(P0.sarh / shots)}` : '—'],
      [ko ? 'R-27R 평균 발사 거리' : 'Avg R-27R range', P0.sarh >= 1 ? (P0.sarhR / P0.sarh / 1000).toFixed(1) + ' km' : '—'],
      [ko ? '선회 왼쪽 : 오른쪽' : 'Turns L : R', turn > 1 ? `${pct(P0.turnL / turn)} : ${pct(P0.turnR / turn)}` : '—'],
      [ko ? '적보다 위 : 아래' : 'Above : below', alt > 1 ? `${pct(P0.above / alt)} : ${pct(P0.below / alt)}` : '—'],
      [ko ? '코브라 · 착함' : 'Cobras · traps', `${P0.cobra.toFixed(1)} · ${P0.traps.toFixed(1)}`],
    ];
  return { rows, habits, genes: evoGeneIntel(ko) };
}
