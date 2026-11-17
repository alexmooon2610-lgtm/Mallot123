// =====================================================================
// 미션 레지스트리: 임무 목록 · 기록(PROG) · 공용 임무 훅
//  - 모든 임무는 MISSIONS 의 한 항목. 환경(env)·날씨·브리핑·게이트·평가를 여기서 정의한다.
//  - env: 'AIRBASE' | 'CARRIER'.  weather: CLEAR/CLOUDY/RAIN/FOG (Phase 7 전까지는 표시용, CLEAR 고정)
//  - start: 'runway'(활주로 대기 후 이륙) | 'air'(공중 시작).  gates: 순서대로 통과할 항법/접근 게이트
//  - ?unlock 를 주소 뒤에 붙이면 모든 임무가 잠금 해제된다(테스트용).
// =====================================================================
const UNLOCK_ALL = /[?&]unlock/.test(location.search);
const WEATHER = {
  CLEAR: { ko: '맑음', en: 'CLEAR' },
  CLOUDY: { ko: '구름 많음', en: 'CLOUDY' },
  RAIN: { ko: '비', en: 'RAIN' },
  FOG: { ko: '안개', en: 'FOG' },
};
const RANKS = ['C', 'B', 'A', 'S'];
const rankOf = s => (s >= 90 ? 'S' : s >= 75 ? 'A' : s >= 55 ? 'B' : 'C');
const fmtTime = s =>
  Math.floor(s / 60)
    .toString()
    .padStart(2, '0') +
  ':' +
  Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
const GATE_R = 950; // 게이트 통과 반경(m, 3D)
const PROG = {
  d: {},
  load() {
    try {
      this.d = JSON.parse(localStorage.getItem('stProgress') || '{}') || {};
    } catch (e) {
      this.d = {};
    }
  },
  save() {
    try {
      localStorage.setItem('stProgress', JSON.stringify(this.d));
    } catch (e) {}
  },
  done(id) {
    return !!(this.d[id] && this.d[id].done);
  },
  record(id, rank, score, time) {
    const o = this.d[id] || (this.d[id] = {}),
      first = !o.done;
    const better = first || RANKS.indexOf(rank) > RANKS.indexOf(o.rank) || (rank === o.rank && score > (o.score || 0));
    o.done = true;
    if (better) {
      o.rank = rank;
      o.score = score;
      o.time = time;
    }
    o.plays = (o.plays || 0) + 1;
    this.save();
    return { first, better };
  },
};
PROG.load();
const MISSIONS = {
  T01: {
    id: 'T01',
    label: 'T-01',
    title: 'FIRST FLIGHT',
    category: 'TRAINING',
    env: 'AIRBASE',
    weather: 'CLEAR',
    requires: null,
    start: 'runway',
    finalPhase: 'return',
    sub: { ko: '이륙 → 항법 게이트 4개 → 귀환·착륙', en: 'Takeoff → 4 navigation gates → return & land' },
    intro: '활주로 이륙, 항법 게이트 4개 통과, 비행장 귀환 및 착륙',
    finalMsg: '비행장으로 귀환하라',
    par: [260, 330, 420],
    gates: [
      { p: [0, 700, -7000], alt: [550, 1e9], maneuver: 'CLIMB', ko: '상승 게이트', en: 'CLIMB GATE' },
      { p: [6000, 1100, -9500], maneuver: 'RIGHT TURN', ko: '우선회 게이트', en: 'RIGHT-TURN GATE' },
      { p: [9500, 900, -5500], spd: [110, 170], maneuver: 'SPEED HOLD', ko: '속도 유지 게이트', en: 'SPEED GATE' },
      { p: [3000, 450, -7000], alt: [0, 650], maneuver: 'DESCENT', ko: '강하 게이트', en: 'DESCENT GATE' },
    ],
    brief: {
      ko: {
        sum: 'AIRBASE 29에서 이륙해 항법 게이트 4개를 순서대로 통과한 뒤 비행장으로 귀환·착륙하는 기본 비행 훈련. 상승, 선회, 속도 유지, 강하를 한 번씩 연습한다.',
        obj: [
          'Shift 로 이륙 활주 시작 — 활주로 중심선 유지',
          '게이트 1 · 상승 (고도 550 m 이상)',
          '게이트 2 · 우선회',
          '게이트 3 · 속도 유지 (400–610 km/h)',
          '게이트 4 · 강하 (고도 650 m 이하)',
          '비행장으로 귀환해 활주로에 착륙',
        ],
        tips: [
          '게이트 조건은 통과를 막지 않지만 점수에 반영된다.',
          'W/S 추력 · F 플랩 · N 착륙장치. 활주로 접근 회랑에서는 장치·플랩을 자동 설정한다. 활주로는 어느 방향에서든 착륙할 수 있다.',
          '목표 시간 안에 완료하면 높은 랭크를 받는다.',
          'HUD 유도선에 목표 방향 전환량과 게이트별 고도·속도 상태가 표시된다.',
        ],
      },
      en: {
        sum: 'Take off from AIRBASE 29, fly four navigation gates in order, then return and land. A first lesson in climb, turn, speed control and descent.',
        obj: [
          'Press Shift to start the takeoff roll — hold the centerline',
          'Gate 1 · Climb (altitude 550 m or higher)',
          'Gate 2 · Right turn',
          'Gate 3 · Speed control (400–610 km/h)',
          'Gate 4 · Descent (altitude 650 m or lower)',
          'Return to the airbase and land on the runway',
        ],
        tips: [
          'Gate conditions never block progress, but they count toward your score.',
          'W/S throttle · F flaps · N gear. Gear and flaps are set automatically in the runway corridor. You may land from either direction.',
          'Finish within the par time for a higher rank.',
          'The HUD adds steering, altitude and speed cues for the active waypoint.',
        ],
      },
    },
    evaluate() {
      const s = missionStats,
        el = missionElapsed,
        gs = s.total ? (40 * s.met) / s.total : 40,
        ts = el <= this.par[0] ? 60 : el <= this.par[1] ? 45 : el <= this.par[2] ? 30 : 15,
        score = Math.round(gs + ts);
      return {
        score,
        rank: rankOf(score),
        lines: [
          ['게이트 통과', `${s.gates}/${this.gates.length}`],
          ['게이트 조건 충족', `${s.met}/${s.total}`],
          ['비행 시간', fmtTime(el) + '  (목표 ' + fmtTime(this.par[0]) + ')'],
          ['점수', score],
        ],
      };
    },
  },
  T02: {
    id: 'T02',
    label: 'T-02',
    title: 'LANDING',
    category: 'TRAINING',
    env: 'AIRBASE',
    weather: 'CLEAR',
    requires: 'T01',
    start: 'air',
    finalPhase: 'final',
    spawn: { pos: [900, 950, -10500], speed: 175, thr: 0.6, flap: 0, gear: false },
    sub: { ko: '접근 게이트 3개 → 최종 접근 → 착륙 평가', en: '3 approach gates → final → landing grade' },
    intro: '접근 게이트 3개를 통과해 활주로에 착륙 — 접지 위치·강하율·속도 평가',
    finalMsg: '최종 접근 — 활주로 중심선에 정렬해 착륙하라',
    gates: [
      {
        p: [0, 600, -7600],
        alt: [450, 750],
        spd: [130, 200],
        maneuver: 'APPROACH ENTRY',
        ko: '접근 진입 게이트',
        en: 'APPROACH ENTRY GATE',
      },
      {
        p: [0, 235, -5000], // 활공경로(3.5°, 접지점 활주로 끝+300 m) 위 고도
        spd: [110, 170],
        cfg: true,
        maneuver: 'LANDING CONFIG',
        ko: '착륙 형상 게이트',
        en: 'CONFIGURATION GATE',
      },
      {
        p: [0, 90, -2600], // 활공경로 위 고도 (alt 범위는 그대로)
        alt: [60, 220],
        spd: [95, 150],
        maneuver: 'FINAL APPROACH',
        ko: '최종 접근 게이트',
        en: 'FINAL APPROACH GATE',
      },
    ],
    brief: {
      ko: {
        sum: '비행장 29의 접근과 착륙만 집중 연습한다. 접근 게이트 3개로 활공 경로를 만들고, 접지 위치 · 강하율 · 접지 속도를 평가한다.',
        obj: [
          '게이트 1 · 접근 진입 (고도 450–750 m · 속도 470–720 km/h)',
          '게이트 2 · 기어 DOWN · 플랩 MID 이상 · 속도 400–610 km/h',
          '게이트 3 · 고도 60–220 m · 속도 340–540 km/h',
          '활주로 중심선에 정렬해 착륙 (자동 접지 보조 작동)',
        ],
        tips: [
          '평가: 중심선 오차 25 · 강하율 25 · 접지 속도 20 · 게이트 조건 30.',
          'N(기어)과 F(플랩)를 직접 설정해야 게이트 2 조건을 채울 수 있다.',
          'HUD 하단에 중심선 편차(LOC) · 강하율(SINK) · 고도가 표시된다.',
          'HUD 유도선에서 접근 게이트 방향·고도·속도와 기어·플랩 설정을 안내한다.',
        ],
      },
      en: {
        sum: 'Practice only the approach and landing at AIRBASE 29. Three approach gates shape the glide path; touchdown position, sink rate and speed are graded.',
        obj: [
          'Gate 1 · Approach entry (altitude 450–750 m · speed 470–720 km/h)',
          'Gate 2 · Gear DOWN · flaps MID or more · speed 400–610 km/h',
          'Gate 3 · Altitude 60–220 m · speed 340–540 km/h',
          'Align with the centerline and land (touchdown assist active)',
        ],
        tips: [
          'Grading: centerline 25 · sink rate 25 · touchdown speed 20 · gate conditions 30.',
          'Set gear (N) and flaps (F) yourself to satisfy Gate 2.',
          'The HUD shows localizer offset (LOC), sink rate (SINK) and altitude.',
          'HUD cues guide the active approach gate, altitude, speed and landing configuration.',
        ],
      },
    },
    evaluate() {
      const s = missionStats,
        tc = airbaseOps.touch || { x: 0, speed: 0, sink: 0 },
        ax = Math.abs(tc.x);
      const cl = ax <= 15 ? 25 : ax <= 40 ? 18 : ax <= 90 ? 10 : 4,
        sk = tc.sink <= 3 ? 25 : tc.sink <= 6 ? 18 : tc.sink <= 10 ? 10 : 4,
        sp = tc.speed >= 85 && tc.speed <= 135 ? 20 : tc.speed >= 70 && tc.speed <= 170 ? 12 : 5,
        gs = s.total ? (30 * s.met) / s.total : 30,
        score = Math.round(cl + sk + sp + gs);
      return {
        score,
        rank: rankOf(score),
        lines: [
          ['중심선 오차', `${ax.toFixed(0)} m  (${cl}/25)`],
          ['강하율', `${tc.sink.toFixed(1)} m/s  (${sk}/25)`],
          ['접지 속도', `${kmh(tc.speed)} km/h  (${sp}/20)`],
          ['게이트 조건', `${s.met}/${s.total}  (${gs.toFixed(0)}/30)`],
          ['점수', score],
        ],
      };
    },
  },
  S00: {
    id: 'S00',
    label: 'S-00',
    title: 'TERRAIN SANDBOX',
    category: 'SANDBOX',
    env: 'AIRBASE',
    weather: 'CLEAR',
    requires: null,
    start: 'air',
    samEnabled: true,
    spawn: { pos: [0, 2200, -12000], speed: 185, thr: 0.72, flap: 0, gear: false },
    sub: {
      ko: '자유비행 · 지형 확인 · 가상 지상 위협 체험',
      en: 'Free flight · terrain survey · fictional ground-threat test',
    },
    intro: '목표 제한 없는 자유비행 환경. 지형 고도와 가상 지상 위협 반응을 시험한다.',
    brief: {
      ko: {
        sum: 'AIRBASE 29 주변의 자유비행 샌드박스다. 임무 점수와 시간 제한 없이 산악·계곡·해안 지형을 확인하고, 게임용 지상 위협 표시와 지형 차폐를 시험할 수 있다.',
        obj: [
          '자유롭게 비행하며 지형 고도 변화를 확인한다.',
          '지상 위협 표시가 SEARCH / TRACK 상태로 바뀌는지 확인한다.',
          '능선이나 계곡 뒤에서 지상 위협 표시가 끊기는지 확인한다.',
          '충돌하지 않도록 비행하고 자유롭게 종료한다.',
        ],
        tips: [
          '이 임무는 기록 점수나 완료 조건이 없는 샌드박스다.',
          'AGL은 현재 지면으로부터의 상대 고도다.',
          '지상 위협은 실제 장비를 재현하지 않는 단순화된 게임 이벤트다.',
          'T-01과 T-02의 정규 채점·진행에는 영향을 주지 않는다.',
        ],
      },
      en: {
        sum: 'A free-flight sandbox around AIRBASE 29. Explore ridges, valleys and the coast, and test the game-only ground-threat indicator and terrain masking without score or time limits.',
        obj: [
          'Explore terrain elevation changes in free flight.',
          'Observe the ground-threat indicator changing between SEARCH and TRACK.',
          'Check whether a ridge or valley interrupts the threat indicator.',
          'Avoid terrain contact and end the flight when ready.',
        ],
        tips: [
          'This sandbox has no record score or completion condition.',
          'AGL is altitude above the local ground surface.',
          'Ground threats are simplified gameplay events, not simulations of real equipment.',
          'T-01 and T-02 progression and grading are unchanged.',
        ],
      },
    },
  },
  LEGACY: {
    id: 'LEGACY',
    label: 'LEGACY',
    title: 'COMBAT',
    category: 'COMBAT',
    env: 'CARRIER',
    weather: 'CLEAR',
    requires: null,
    start: 'deck',
    sub: { ko: '항모 발진·착함 + 웨이브 전투', en: 'Carrier launch/recovery + wave combat' },
    intro: '',
    brief: {
      ko: {
        sum: '기존 쿠즈네초프 항모 운용과 웨이브형 아케이드 전투를 즐기는 클래식 모드. 항모에서 발진해 적 편대를 격추하고, 착함해서 재보급을 받는다.',
        obj: [
          'Shift 로 갑판 발진',
          '레이더로 적 편대를 탐지·락온해 격추',
          '연료·탄약이 부족하면 항모에 착함해 보급',
          '최대한 많은 웨이브를 버텨라',
        ],
        tips: [
          'T 레이더 모드 · Tab 표적 선택 · Y 락온 · Space 발사. SARH 는 명중까지 락 유지, IR 은 발사 후 망각.',
          'X / C 로 플레어·채프를 사용해 미사일을 회피한다.',
          '착함: 후방 갑판 접근 · 속도 590 km/h 미만 · 완만한 강하. 기어·플랩은 자동 보조, 와이어를 놓치면 볼터(재접근).',
          '공중 재보급은 없다. 웨이브 사이 30초 — 갑판에 내려와 있는 동안은 다음 웨이브가 기다린다.',
        ],
      },
      en: {
        sum: 'The classic mode: Kuznetsov carrier operations with arcade wave combat. Launch, shoot down enemy flights, then recover aboard for resupply.',
        obj: [
          'Press Shift to launch from the deck',
          'Detect and lock enemies with radar, then shoot them down',
          'Recover aboard the carrier when fuel or ammo runs low',
          'Survive as many waves as you can',
        ],
        tips: [
          'T radar mode · Tab select · Y lock · Space fire. Hold the lock until a SARH hits; IR is fire-and-forget.',
          'Use X / C for flares and chaff to defeat missiles.',
          'Recovery: approach the stern · below 590 km/h · gentle descent. Gear/flaps are assisted; a missed wire is a bolter (go around).',
          'No airborne resupply. 30 s between waves — the next wave waits while you are on deck.',
        ],
      },
    },
  },
};
// 공용 임무 계약: 임무마다 init/update/hud/isComplete/isFailed/score 를 갖춘다.
// 아래 어댑터가 기존 레거시 임무 로직을 그대로 감싸므로 비행 거동은 바뀌지 않는다.
for (const m of Object.values(MISSIONS)) {
  m.init = function () {
    missionReset();
  };
  m.update = function (dt) {
    missionUpdate(dt);
  };
  m.hud = function (g) {
    return { objective: missionObjectiveTextLegacy(), hint: missionHintTextLegacy(), guidance: missionGuidanceText() };
  };
  m.isComplete = function () {
    return !!missionComplete;
  };
  m.isFailed = function () {
    return !!missionFailed;
  };
  m.score = function () {
    const r = typeof this.evaluate === 'function' ? this.evaluate() : { score: 0, rank: 'C', lines: [] };
    return { ...r, stats: { ...missionStats } };
  };
}
// MISSION_CATALOG is the public catalogue consumed by menus, progression and mission runtime.
const MISSION_CATALOG = MISSIONS;
const lastMission = { AIRBASE: 'T01', CARRIER: 'LEGACY' };
const missionsOf = env => Object.values(MISSION_CATALOG).filter(m => m.env === env && !m.campaign && !m.net); // net: 멀티 메뉴 전용
const curM = () => MISSION_CATALOG[activeMission] || MISSION_CATALOG.LEGACY;
const isAirbase = () => curM().env === 'AIRBASE';
const isFinalPhase = () => missionPhase === 'return' || missionPhase === 'final';
const isLocked = id => {
  const m = MISSIONS[id];
  if (m && m.campaign) return !campAvailable(id);
  return !!(m && m.requires && !UNLOCK_ALL && !PROG.done(m.requires));
};
const defaultMission = env => {
  const l = lastMission[env];
  return MISSION_CATALOG[l] && MISSION_CATALOG[l].env === env && !MISSION_CATALOG[l].campaign && !isLocked(l)
    ? l
    : missionsOf(env).find(m => !isLocked(m.id)).id;
};
function nextMissionId() {
  if (curM().campaign) return campNext(activeMission);
  const L = missionsOf(curM().env),
    i = L.findIndex(m => m.id === activeMission),
    n = L.slice(i + 1).find(m => m.category !== 'SANDBOX' && !isLocked(m.id));
  return n ? n.id : null;
}
