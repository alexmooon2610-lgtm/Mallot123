// =====================================================================
// 캠페인 TR-3 · 방공망 돌파 (SAM BELT)
//  - 본토 훈련장 AIRBASE 29. 가상 지대공 포대 ECHO-1 · ECHO-3 의 사거리 안으로 난 항로를 게이트 4개로 통과한 뒤
//    비행장으로 돌아와 착륙한다. 공중에서 시작한다.
//  - 지상 위협 · 게이트 · 착륙 판정은 비행장 임무 공용 체계(41-mission-flow · 43-airbase-ops · 50-ground-threats)를 그대로 쓴다.
//  - 포대는 8.2 km 안에서 추적 · 발사한다. 맞으면 기체 손상 13%. 채프/플레어(3.5 km 안에서 70%)와 저공 · 급선회로 피한다.
// =====================================================================
MISSIONS.TR3 = {
  id: 'TR3',
  label: 'TR-3',
  title: 'SAM BELT',
  category: 'TRAINING',
  env: 'AIRBASE',
  weather: 'CLEAR',
  requires: 'TR2',
  start: 'air',
  samEnabled: true,
  finalPhase: 'return',
  spawn: { pos: [10000, 1400, -30000], speed: 230, thr: 0.8, flap: 0, gear: false },
  sub: { ko: '지대공 위협 회피 · 저공 침투', en: 'SAM evasion and low-level penetration' },
  intro: '지대공 포대 사이 항로의 게이트 4개를 통과하고 비행장에 착륙',
  finalMsg: '방공망 돌파 — 비행장으로 귀환해 착륙하라',
  par: [420, 520, 640],
  gates: [
    { p: [11000, 650, -22000], alt: [0, 900], maneuver: 'LOW INGRESS', ko: '저공 진입 게이트', en: 'LOW INGRESS GATE' },
    { p: [8500, 500, -13500], alt: [0, 750], maneuver: 'LOW RUN', ko: '저공 돌파 게이트', en: 'LOW RUN GATE' },
    {
      p: [19000, 900, 2000],
      spd: [215, 400],
      maneuver: 'FAST TRANSIT',
      ko: '고속 통과 게이트',
      en: 'FAST TRANSIT GATE',
    },
    { p: [20500, 450, 9000], alt: [0, 700], maneuver: 'LOW EGRESS', ko: '저공 이탈 게이트', en: 'LOW EGRESS GATE' },
  ],
  brief: {
    ko: {
      sum: '1999년 12월 18일, 본토 훈련장 AIRBASE 29. 가상 지대공 포대 ECHO-1 · ECHO-3 의 사거리를 지나는 항로를 돌파한다. 게이트 4개를 순서대로 통과하고 비행장에 착륙하면 끝난다. 공중에서 시작한다.',
      obj: [
        '게이트 1 · 2 · 저공으로 ECHO-1 사거리 통과 (고도 900 m · 750 m 이하)',
        '게이트 3 · 고속 통과 (770 km/h 이상)',
        '게이트 4 · 저공으로 ECHO-3 사거리 이탈 (고도 700 m 이하)',
        '비행장으로 귀환해 착륙',
      ],
      tips: [
        '포대는 8 km 안에서 추적하고 미사일을 쏜다. 경보가 뜨면 채프 [C] 를 이어서 뿌리고 미사일과 직각으로 꺾어라.',
        '능선 뒤로 숨으면 추적이 끊긴다. 다만 이 항로는 평지가 많아 숨을 곳이 적다.',
        '미사일에 맞으면 손상 13%. 여러 발 맞으면 추락한다.',
        '평가: 게이트 조건 30 · 무피격 30 (한 발에 −15) · 비행 시간 40.',
      ],
    },
    en: {
      sum: 'AIRBASE 29 range, 18 December 1999. Run a route that crosses the engagement zones of two simulated SAM sites, ECHO-1 and ECHO-3. Pass four gates in order, then land at the airfield. You start in the air.',
      obj: [
        'Gates 1 · 2 · cross ECHO-1 at low level (below 900 m · 750 m)',
        'Gate 3 · fast transit (770 km/h or more)',
        'Gate 4 · leave ECHO-3 at low level (below 700 m)',
        'Return to the airfield and land',
      ],
      tips: [
        'Sites track and fire inside 8 km. On an alert, keep releasing chaff [C] and turn across the missile.',
        'A ridge between you and the site breaks the track, but this route is mostly flat.',
        'Each hit costs 13% damage. Several hits will bring you down.',
        'Grading: gate conditions 30 · no hits 30 (−15 each) · time 40.',
      ],
    },
  },
  init() {
    missionReset();
  },
  update(dt) {
    missionUpdate(dt);
  },
  hud() {
    return { objective: missionObjectiveTextLegacy(), hint: missionHintTextLegacy(), guidance: missionGuidanceText() };
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
    const s = missionStats,
      el = missionElapsed,
      gs = Math.round(s.total ? (30 * s.met) / s.total : 30),
      hit = Math.max(0, 30 - s.hits * 15),
      ts = el <= this.par[0] ? 40 : el <= this.par[1] ? 30 : el <= this.par[2] ? 20 : 10,
      score = Math.round(gs + hit + ts);
    return {
      score,
      rank: rankOf(score),
      lines: [
        ['게이트 통과', `${s.gates}/${this.gates.length}`],
        ['게이트 조건 충족', `${s.met}/${s.total}  (${gs}/30)`],
        ['피격', `${s.hits}발  (${hit}/30)`],
        ['비행 시간', `${fmtTime(el)}  (목표 ${fmtTime(this.par[0])} · ${ts}/40)`],
        ['점수', score],
      ],
    };
  },
};
