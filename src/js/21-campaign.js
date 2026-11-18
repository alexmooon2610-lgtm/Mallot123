// =====================================================================
// 메인 캠페인: 임무 구성 · 진행 저장(PROG.camp)
//  - 장(chapter)과 임무 순서는 CAMPAIGN 한 곳에서 정한다. 잠금 해제도 이 순서를 따른다.
//  - 아직 만들지 않은 임무는 '개발 중'으로 표시된다. MISSIONS 에 같은 id 로 임무를
//    추가하면 자동으로 캠페인 임무가 되어 출격할 수 있다 (campaign 태그는 여기서 붙인다).
//  - 캠페인 진행(클리어 여부·분기·코어·시계)은 기록 점수와 따로 PROG.d['@campaign'] 에 저장된다.
//    그래서 '새 캠페인'을 시작해도 임무별 최고 기록은 남는다.
//  - 이름·날짜·임무 제목 중 기획서에서 [임시]인 것은 여기 값만 바꾸면 된다.
// =====================================================================
const CAMPAIGN = {
  id: 'MAIN',
  coreName: { ko: '크로노 코어', en: 'CHRONO CORE' }, // 시간 이동 장치 이름 (가제)
  carrier: 'ZARYA',
  clockStart: '1999-12-18T19:00', // 원래 시간선 기준 캠페인 시작 시각. 훈련+1장(35시간) 뒤 12-20 06:00 에 워프
  y2k: '2000-01-01T00:00', // 코어 영구 잠금 시각 (Y2K LOCKOUT)
  chapters: [
    {
      id: 'TR',
      label: { ko: '훈련', en: 'TRAINING' },
      missions: [
        {
          id: 'TR1',
          label: 'TR-1',
          title: { ko: '표적 드론 요격', en: 'TARGET DRONES' },
          sub: { ko: '레이더 · 락온 · 미사일 기본', en: 'Radar, lock-on and missile basics' },
          timeCost: 180,
        },
        {
          id: 'TR2',
          label: 'TR-2',
          title: { ko: '모의 도그파이트', en: 'MOCK DOGFIGHT' },
          sub: { ko: '기총 · 플레어 · 채프 회피', en: 'Guns, flares and chaff' },
          timeCost: 180,
        },
        {
          id: 'TR3',
          label: 'TR-3',
          title: { ko: '훈련장 방공망 돌파', en: 'SAM BELT' },
          sub: {
            ko: '지상 위협 회피와 타격 · 특수 화물 회수 작전 임박',
            en: 'Evade and strike ground threats · a special recovery op looms',
          },
          timeCost: 240,
        },
      ],
    },
    {
      id: 'C1',
      label: { ko: '1장 · 확보', en: 'CH.1 · ACQUISITION' },
      missions: [
        {
          id: 'C11',
          label: '1-1',
          title: { ko: '봉쇄선', en: 'BLOCKADE LINE' },
          sub: {
            ko: '서방 초계기를 요격하며 태평양으로 진출',
            en: 'Intercept Western patrols and push into the Pacific',
          },
          timeCost: 480,
        },
        {
          id: 'C12',
          label: '1-2',
          title: { ko: '연구시설', en: 'RESEARCH SITE' },
          sub: {
            ko: '섬 방공망을 부수고 시설을 급습해 코어 확보',
            en: 'Break the island air defences and seize the core',
          },
          timeCost: 600,
        },
        {
          id: 'C13',
          label: '1-3',
          title: { ko: '탈출', en: 'EXFIL' },
          sub: {
            ko: '코어 수송기 호위 · 추격 편대 저지 · 착함',
            en: 'Escort the core transport, stop the pursuit, recover aboard',
          },
          timeCost: 420,
        },
      ],
    },
    // 2장 · 분기는 미션 안의 행동으로 서서히 정해진다. 메뉴에는 지금 가는 길의 미션만 보인다.
    //  front: 2-3 이후의 전선 (JP 일본 전선 · US 미국 전선)
    //  routes: 확정 루트 (DEFEND 방어 · ATTACK_JP 일본 공격 · ATTACK_US 미국 공격)
    //  needsRoute: 루트가 확정된 뒤에만 열리는 공통 미션
    {
      id: 'C2',
      label: { ko: '2장 · 시공 폭풍', en: 'CH.2 · TEMPORAL STORM' },
      missions: [
        {
          id: 'C21',
          label: '2-1',
          title: { ko: '폭풍의 눈', en: 'EYE OF THE STORM' },
          sub: { ko: '추격 편대와 폭풍 속 교전', en: 'Fight the pursuers inside the storm' },
          timeCost: 360,
        },
        {
          id: 'C22',
          label: '2-2',
          title: { ko: '낯선 하늘', en: 'STRANGE SKIES' },
          sub: { ko: '정체불명의 프로펠러기 편대', en: 'Unidentified propeller formations' },
          timeCost: 720,
        },
        {
          id: 'C23',
          label: '2-3',
          title: { ko: '굶주린 항모', en: 'STARVING CARRIER' },
          sub: { ko: 'ZARYA의 연료를 확보하라', en: 'Secure fuel for ZARYA' },
          timeCost: 1080,
        },
        {
          id: 'C24',
          label: '2-4',
          front: 'JP',
          title: { ko: '그림자', en: 'SHADOW' },
          sub: { ko: '대규모 함대를 추적하라', en: 'Track a large fleet' },
          timeCost: 1440,
        },
        {
          id: 'C25',
          label: '2-5',
          front: 'JP',
          title: { ko: '잠항', en: 'RUN SILENT' },
          sub: { ko: '야간 대잠 작전', en: 'Night anti-submarine sweep' },
          timeCost: 1080,
        },
        {
          id: 'C26',
          label: '2-6',
          front: 'JP',
          title: { ko: '새벽의 파도', en: 'DAWN WAVE' },
          sub: { ko: '12월 7일 07:00', en: '7 December, 07:00' },
          timeCost: 720,
        },
        {
          id: 'C27D',
          label: '2-7',
          front: 'JP',
          routes: ['DEFEND'],
          title: { ko: '두 번째 파도', en: 'SECOND WAVE' },
          sub: { ko: '공습대를 요격하라', en: 'Intercept the strike force' },
          timeCost: 600,
        },
        {
          id: 'C28D',
          label: '2-8',
          front: 'JP',
          routes: ['DEFEND'],
          title: { ko: '정체불명기', en: 'BOGEY' },
          sub: { ko: '추격을 따돌려라', en: 'Shake off the pursuit' },
          timeCost: 840,
        },
        {
          id: 'C27J',
          label: '2-7',
          front: 'JP',
          routes: ['ATTACK_JP'],
          title: { ko: '기동부대', en: 'STRIKE FORCE' },
          sub: { ko: '항모 전단 타격', en: 'Strike the carrier group' },
          timeCost: 600,
        },
        {
          id: 'C28J',
          label: '2-8',
          front: 'JP',
          routes: ['ATTACK_JP'],
          title: { ko: '보복', en: 'RETRIBUTION' },
          sub: { ko: 'ZARYA를 지켜라', en: 'Defend ZARYA' },
          timeCost: 840,
        },
        {
          id: 'C24U',
          label: '2-4',
          front: 'US',
          routes: ['ATTACK_US'],
          title: { ko: '초계선', en: 'PICKET LINE' },
          sub: { ko: '초계기와 레이더 기지', en: 'Patrol planes and a radar station' },
          timeCost: 1440,
        },
        {
          id: 'C25U',
          label: '2-5',
          front: 'US',
          routes: ['ATTACK_US'],
          title: { ko: '동행', en: 'FELLOW TRAVELER' },
          sub: { ko: '함대에 접근하라', en: 'Close on the fleet' },
          timeCost: 1080,
        },
        {
          id: 'C26U',
          label: '2-6',
          front: 'US',
          routes: ['ATTACK_US'],
          title: { ko: '진주만', en: 'PEARL HARBOR' },
          sub: { ko: '12월 7일 07:55', en: '7 December, 07:55' },
          timeCost: 720,
        },
        {
          id: 'C27U',
          label: '2-7',
          front: 'US',
          routes: ['ATTACK_US'],
          title: { ko: '빈 항구', en: 'EMPTY HARBOR' },
          sub: { ko: '사라진 항모를 찾아라', en: 'Find the missing carriers' },
          timeCost: 600,
        },
        {
          id: 'C28U',
          label: '2-8',
          front: 'US',
          routes: ['ATTACK_US'],
          title: { ko: '포위', en: 'ENCIRCLED' },
          sub: { ko: 'ZARYA를 지켜라', en: 'Defend ZARYA' },
          timeCost: 840,
        },
        {
          id: 'C29',
          label: '2-9',
          needsRoute: true,
          title: { ko: '폭풍 재진입', en: 'RE-ENTRY' },
          sub: { ko: '폭풍이 다시 열린다', en: 'The storm opens again' },
          timeCost: 720,
        },
      ],
    },
    // 3장 · 루트마다 다른 미션. outcome: 미국 공격 루트의 결과 (A 공산 통일 · B 과거 종속)
    {
      id: 'C3',
      label: { ko: '3장 · 귀환', en: 'CH.3 · RETURN' },
      missions: [
        {
          id: 'C31D',
          label: '3-1',
          routes: ['DEFEND'],
          title: { ko: '귀환', en: 'HOMECOMING' },
          sub: { ko: '원래의 역사, 원래의 전쟁', en: 'The same history, the same war' },
          timeCost: 1440,
        },
        {
          id: 'C32D',
          label: '3-2',
          routes: ['DEFEND'],
          title: { ko: '철의 장막', en: 'IRON CURTAIN' },
          sub: { ko: '봉쇄선 방공망 제압', en: 'Suppress the blockade air defences' },
          timeCost: 1800,
        },
        {
          id: 'C33D',
          label: '3-3',
          routes: ['DEFEND'],
          title: { ko: '최종 돌파', en: 'FINAL BREAKTHROUGH' },
          sub: { ko: '원래 작전을 완수하라', en: 'Finish the original operation' },
          timeCost: 2160,
        },
        {
          id: 'C31J',
          label: '3-1',
          routes: ['ATTACK_JP'],
          title: { ko: '낯선 귀환', en: 'UNFAMILIAR SHORES' },
          sub: { ko: '무언가 달라진 현재', en: 'A present that has changed' },
          timeCost: 1440,
        },
        {
          id: 'C32J',
          label: '3-2',
          routes: ['ATTACK_JP'],
          title: { ko: '강철 함대', en: 'STEEL ARMADA' },
          sub: { ko: '더 두꺼운 함대, 더 새로운 기체', en: 'A heavier fleet, newer aircraft' },
          timeCost: 1800,
        },
        {
          id: 'C33J',
          label: '3-3',
          routes: ['ATTACK_JP'],
          title: { ko: '최종 돌파', en: 'FINAL BREAKTHROUGH' },
          sub: { ko: '원래 작전을 완수하라', en: 'Finish the original operation' },
          timeCost: 2160,
        },
        {
          id: 'C31A',
          label: '3-1',
          routes: ['ATTACK_US'],
          outcome: 'A',
          title: { ko: '붉은 새벽', en: 'RED DAWN' },
          sub: { ko: '붉은 깃발 아래의 1999년', en: '1999 beneath the red flag' },
          timeCost: 1440,
        },
        {
          id: 'C32A',
          label: '3-2',
          routes: ['ATTACK_US'],
          outcome: 'A',
          title: { ko: '마지막 저항', en: 'LAST RESISTANCE' },
          sub: { ko: '남은 저항군을 소탕하라', en: 'Crush the last resistance' },
          timeCost: 1800,
        },
        {
          id: 'C33A',
          label: '3-3',
          routes: ['ATTACK_US'],
          outcome: 'A',
          title: { ko: '붉은 지평선', en: 'RED HORIZON' },
          sub: { ko: '세계의 끝에서', en: 'At the edge of the world' },
          timeCost: 2160,
        },
        {
          id: 'C31B',
          label: '3-1',
          routes: ['ATTACK_US'],
          outcome: 'B',
          title: { ko: '고립', en: 'MAROONED' },
          sub: { ko: '돌아갈 길이 사라졌다', en: 'The way home is gone' },
          timeCost: 1440,
        },
        {
          id: 'C32B',
          label: '3-2',
          routes: ['ATTACK_US'],
          outcome: 'B',
          title: { ko: '마지막 연료', en: 'LAST FUEL' },
          sub: { ko: '남은 것으로 버텨라', en: 'Hold on with what is left' },
          timeCost: 1800,
        },
        {
          id: 'C33B',
          label: '3-3',
          routes: ['ATTACK_US'],
          outcome: 'B',
          title: { ko: '마지막 출격', en: 'LAST SORTIE' },
          sub: { ko: '보급 없는 마지막 전투', en: 'A last fight without resupply' },
          timeCost: 2160,
        },
      ],
    },
  ],
};
// 2장 루트 · 은닉 상태 · 코어 상태 (기획서 6장 기준)
const CAMP_ROUTES = {
  DEFEND: { ko: '방어', en: 'DEFEND' },
  ATTACK_JP: { ko: '일본 공격', en: 'STRIKE JAPAN' },
  ATTACK_US: { ko: '미국 공격', en: 'STRIKE U.S.' },
};
const CAMP_STEALTH = {
  HIDDEN: { ko: '은닉', en: 'HIDDEN' },
  EXPOSED: { ko: '노출', en: 'EXPOSED' },
  REVEALED: { ko: '공개', en: 'REVEALED' },
};
const CAMP_CORE = {
  NONE: { ko: '미확보', en: 'NOT SECURED' },
  SECURED: { ko: '확보', en: 'SECURED' },
  DAMAGED: { ko: '손상', en: 'DAMAGED' },
  REPAIRING: { ko: '복구 중', en: 'REPAIRING' },
  RESTORED: { ko: '복구 완료', en: 'RESTORED' },
  LOCKED: { ko: 'Y2K 잠금', en: 'Y2K LOCKOUT' },
  LOST: { ko: '소실', en: 'LOST' },
};
const CAMP_KEY = '@campaign';
const campPct = v => Math.min(100, Math.max(0, +v || 0));
// 원래 시간선 시각은 '1999-01-01 00:00 이후 경과 분'으로 저장한다.
const campParse = s => {
  const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)$/.exec(s);
  return m ? Math.round((Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]) - Date.UTC(1999, 0, 1)) / 60000) : 0;
};
const campEntries = () => CAMPAIGN.chapters.flatMap(c => c.missions.map(m => ({ ...m, chapter: c.id })));
const campEntry = id => campEntries().find(e => e.id === id) || null;
const campChapter = id => CAMPAIGN.chapters.find(c => c.id === id) || null;
const campReady = id => !!MISSIONS[id];
function campDefaults() {
  return {
    v: 1,
    started: false,
    crawlSeen: false,
    cleared: {},
    front: null,
    route: null,
    stealth: null,
    outcome: null, // 2장에서 정해진다 (front: 2-3, route: 일본 전선은 2-6 · 미국 전선은 2-3)
    core: { state: 'NONE', repair: 0 },
    clock: campParse(CAMPAIGN.clockStart),
    flags: {},
    history: [],
  };
}
// 저장 데이터를 읽을 때마다 빠진 칸을 채운다 (예전 저장 · 손상된 저장 대비).
function campState() {
  const d = campDefaults();
  let s = PROG.d[CAMP_KEY];
  if (!s || typeof s !== 'object') {
    s = PROG.d[CAMP_KEY] = d;
    return s;
  }
  for (const k in d) if (!(k in s) || s[k] === undefined) s[k] = d[k];
  if (!s.core || typeof s.core !== 'object') s.core = d.core;
  if (!(s.core.state in CAMP_CORE)) s.core.state = 'NONE';
  s.core.repair = campPct(s.core.repair);
  if (!Number.isFinite(s.clock)) s.clock = d.clock;
  if (!s.cleared || typeof s.cleared !== 'object') s.cleared = {};
  if (!Array.isArray(s.history)) s.history = [];
  return s;
}
const campSave = () => PROG.save();
function campReset() {
  PROG.d[CAMP_KEY] = campDefaults();
  campSave();
  return PROG.d[CAMP_KEY];
}
// 지금 가는 길 위의 미션인가 (전선 · 루트 · 결과가 정해진 것과 맞는가)
function campOnPath(e, s) {
  s = s || campState();
  if (e.front && s.front !== e.front) return false;
  if (e.routes && !e.routes.includes(s.route)) return false;
  if (e.outcome && s.outcome !== e.outcome) return false;
  if (e.needsRoute && !s.route) return false;
  return true;
}
// 아직 정해지지 않아서 나중에 길 위에 올라올 수 있는 미션인가
function campPending(e, s) {
  s = s || campState();
  return (e.front && !s.front) || (e.routes && !s.route) || (e.outcome && !s.outcome) || (e.needsRoute && !s.route);
}
// 앞선 임무: 길 위에서 바로 앞의 미션
function campPrev(id) {
  const s = campState(),
    L = campEntries(),
    i = L.findIndex(e => e.id === id);
  if (i <= 0) return null;
  for (let j = i - 1; j >= 0; j--) if (campOnPath(L[j], s)) return L[j].id;
  return null;
}
function campAvailable(id) {
  const e = campEntry(id);
  if (!e) return false;
  if (UNLOCK_ALL) return true;
  const s = campState();
  if (!campOnPath(e, s)) return false;
  const pv = campPrev(id);
  return !pv || !!s.cleared[pv];
}
// 메뉴에 보여도 되는가: 지금 가는 길 위의 미션만 보인다
const campRevealed = e => UNLOCK_ALL || campOnPath(e);
// 다음 출격 대상: 순서상 아직 클리어하지 않은 첫 가용 임무 (없으면 마지막 가용 임무)
function campCurrent() {
  const L = campEntries().filter(e => campAvailable(e.id));
  return (L.find(e => !campState().cleared[e.id]) || L[L.length - 1] || campEntries()[0]).id;
}
function campNext(id) {
  const L = campEntries(),
    i = L.findIndex(e => e.id === id);
  const n = L.slice(i + 1).find(e => campReady(e.id) && campAvailable(e.id));
  return n ? n.id : null;
}
// 진행도: 한 번의 플레이 길이는 루트와 상관없이 같다 (훈련 3 + 1장 3 + 2장 9 + 3장 3)
const CAMP_PATH_LEN = campEntries().filter(e => campOnPath(e, { front: 'JP', route: 'DEFEND', outcome: null })).length;
function campProgress() {
  const s = campState();
  return { done: campEntries().filter(e => campOnPath(e, s) && s.cleared[e.id]).length, total: CAMP_PATH_LEN };
}
// ---------- 원래 시간선 시계와 Y2K 카운트다운
function campClockText(min) {
  const d = new Date(Date.UTC(1999, 0, 1) + min * 60000),
    f = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${f(d.getUTCMonth() + 1)}-${f(d.getUTCDate())} ${f(d.getUTCHours())}:${f(d.getUTCMinutes())}`;
}
function campY2KLeft() {
  return campParse(CAMPAIGN.y2k) - campState().clock;
}
function campY2KText(lang) {
  const m = campY2KLeft();
  if (m <= 0) return lang === 'ko' ? 'Y2K 잠금' : 'Y2K LOCKOUT';
  const d = Math.floor(m / 1440),
    h = Math.floor((m % 1440) / 60),
    mm = m % 60;
  return lang === 'ko'
    ? `Y2K까지 ${d}일 ${h}시간${d ? '' : ' ' + mm + '분'}`
    : `Y2K IN ${d}D ${h}H${d ? '' : ' ' + mm + 'M'}`;
}
// 시간 경과: 2000년이 되면 코어는 영구 잠금 (복구 완료 · 소실 상태는 그대로)
function campAdvance(min) {
  const s = campState();
  s.clock += Math.max(0, Math.round(min || 0));
  if (campY2KLeft() <= 0 && !['NONE', 'RESTORED', 'LOST'].includes(s.core.state)) s.core.state = 'LOCKED';
  campSave();
  return s;
}
// ---------- 이야기 상태를 바꾸는 함수 (2단계 이후 임무 코드가 부른다)
function campSetCore(state, repair) {
  const s = campState();
  if (state in CAMP_CORE) s.core.state = state;
  if (repair != null) s.core.repair = campPct(repair);
  campSave();
  return s;
}
function campSetFront(f) {
  const s = campState();
  if (f === null || f === 'JP' || f === 'US') s.front = f;
  campSave();
  return s;
}
// 루트를 정하면 전선도 맞춰진다 (미국 공격 → 미국 전선, 그 외 → 일본 전선)
function campSetRoute(route, stealth) {
  const s = campState();
  if (route === null || route in CAMP_ROUTES) {
    s.route = route;
    if (route) s.front = route === 'ATTACK_US' ? 'US' : 'JP';
  }
  if (stealth !== undefined && (stealth === null || stealth in CAMP_STEALTH)) s.stealth = stealth;
  campSave();
  return s;
}
function campSetOutcome(o) {
  const s = campState();
  if (o === null || o === 'A' || o === 'B') s.outcome = o;
  campSave();
  return s;
}
function campFlag(k, v) {
  const s = campState();
  if (v === undefined) return s.flags[k];
  s.flags[k] = v;
  campSave();
  return v;
}
// 임무 성공 시 completeMission() 이 부른다. 새로 열린 캠페인 임무 목록을 돌려준다.
function campOnComplete(M, result) {
  const s = campState(),
    e = campEntry(M.id);
  if (!e) return { unlocked: [] };
  const before = new Set(
    campEntries()
      .filter(x => campAvailable(x.id))
      .map(x => x.id)
  );
  const first = !s.cleared[e.id];
  s.started = true;
  s.cleared[e.id] = true;
  s.history.push({ id: e.id, rank: (result && result.rank) || null, clock: s.clock });
  if (s.history.length > 200) s.history.shift();
  if (first) campAdvance(e.timeCost || 0);
  if (typeof M.onCampaignComplete === 'function') M.onCampaignComplete(s, result);
  campSave();
  return {
    unlocked: campEntries()
      .filter(x => !before.has(x.id) && campAvailable(x.id))
      .map(x => x.id),
  };
}
// 캠페인 임무를 MISSIONS 에 추가하면 여기서 태그를 붙인다 (requires 대신 캠페인 순서로 잠금).
function campTagMissions() {
  for (const e of campEntries()) {
    const m = MISSIONS[e.id];
    if (!m) continue;
    m.campaign = CAMPAIGN.id;
    m.chapter = e.chapter;
    m.requires = null;
    if (!m.label) m.label = e.label;
  }
}
campTagMissions();
campState();
// 브라우저 콘솔용 (테스트·디버그): ST_CAMP.state(), ST_CAMP.route('ATTACK_JP','HIDDEN') 등
window.ST_CAMP = {
  state: campState,
  reset: campReset,
  front: campSetFront,
  route: campSetRoute,
  outcome: campSetOutcome,
  core: campSetCore,
  advance: campAdvance,
  flag: campFlag,
  clear(id) {
    const s = campState();
    s.cleared[id] = true;
    campSave();
    return s;
  },
};
