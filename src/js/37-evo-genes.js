// ===== 진화 알고리즘 — 적 조종사 유전자 (V16.0.0-alpha.2, 진화 난도만) =====
// 사용자 결정 (2026-11-20): 수법 풀기와 '실제 학습'을 같이 쓴다. 이 파일이 실제 학습 ①: 진화 알고리즘.
//
// 적 F-16 조종사마다 유전자 8개(0~1)가 있다. 0.5 = '어려움' 난도의 원래 행동. 웨이브에 나온 조종사는 살아 있는 동안 성적을 쌓고,
// 격추되거나 판이 끝나면 성적과 함께 '개체군'(최대 24명)에 들어간다. 다음 웨이브 조종사는 개체군에서 토너먼트로 부모 둘을 골라
// 유전자를 섞고(균등 교차) 조금 바꿔(변이) 만든다. 개체군의 성적은 세대마다 0.9 배로 낡는다 → 플레이어가 전술을 바꾸면
// 예전에 잘 먹히던 조종사도 밀려난다. 개체군은 기기에 저장(stEvo)되어 판을 넘어 계속 진화한다.
//
// 성적: 플레이어 미사일 명중 +4 · 기총 명중 +0.15 · 플레이어 미사일 피함 +1.5 · 레이더 락 +0.4(한 번) · 살아 있던 시간 초당 +0.02(120초까지) · 격추 −2
// 유전자는 반응 속도 · 선회 · G 를 바꾸지 않는다 (어려움을 넘지 않는다) — 언제 · 어디서 · 어떻게 싸울지만 바꾼다.
// 판정에 들어가지만 진화 난도에서만 쓰인다. 유전자 만들기는 판정 난수(rnd)가 아니라 개체군에 저장된 자체 난수를 쓴다
// → 같은 개체군 · 같은 시드면 같은 판이 나온다 (하네스 결정론).
const EVO_GENES = [
  // id, 이름, 0 일 때 · 1 일 때 (0.5 = 원래 값), 특징 문구(낮을 때 / 높을 때)
  { id: 'eng', ko: '레이더 미사일 사격 거리', lo: 0.55, mid: 1, hi: 1, t: ['근거리 사격', ''], te: ['close-range shooter', ''] },
  { id: 'irw', ko: 'IR 발사 뜸', lo: 0.4, mid: 1, hi: 1.8, t: ['IR 속사', 'IR 신중'], te: ['snap IR shots', 'patient IR shots'] },
  { id: 'brk', ko: '미사일 회피 시작 거리', lo: 0.7, mid: 1, hi: 1.4, t: ['늦은 회피', '이른 회피'], te: ['late break', 'early break'] },
  { id: 'dv', ko: '회피 때 강하', lo: -0.35, mid: 0, hi: 0.25, t: ['급강하 회피', '수평 회피'], te: ['diving break', 'level break'] },
  { id: 'flr', ko: '플레어 시점', lo: 0.75, mid: 1, hi: 1.6, t: ['늦은 플레어', '이른 플레어'], te: ['late flares', 'early flares'] },
  { id: 'alt', ko: '접근 고도', lo: -1500, mid: 0, hi: 2500, t: ['저고도 접근', '고고도 접근'], te: ['low approach', 'high approach'] },
  { id: 'lead', ko: '리드 추적', lo: 0.5, mid: 1, hi: 1.5, t: ['순수 추적', '깊은 리드'], te: ['pure pursuit', 'deep lead'] },
  { id: 'spd', ko: '추격 속도', lo: 0.92, mid: 1, hi: 1.08, t: ['느린 추격', '빠른 추격'], te: ['slow chase', 'fast chase'] },
];
const EVO_GI = Object.fromEntries(EVO_GENES.map((g, i) => [g.id, i]));
const EVO_POOL_MAX = 24,
  EVO_AGE = 0.9;
// 0~1 → 실제 값 (0.5 에서 원래 값, 양쪽으로 lo · hi)
const evoMap = (G, v) => (v < 0.5 ? G.lo + (G.mid - G.lo) * (v / 0.5) : G.mid + (G.hi - G.mid) * ((v - 0.5) / 0.5));
let EVOP = (() => {
  try {
    const o = JSON.parse(localStorage.getItem('stEvo') || 'null');
    if (o && o.v === 1 && Array.isArray(o.pool)) return o;
  } catch (e) {}
  return { v: 1, gen: 0, seed: 20261120, pool: [], best: 0 };
})();
function evoPoolSave() {
  try {
    localStorage.setItem('stEvo', JSON.stringify(EVOP));
  } catch (e) {}
}
function evoPoolReset() {
  EVOP = { v: 1, gen: 0, seed: 20261120, pool: [], best: 0 };
  evoPoolSave();
}
// 개체군 자체 난수 (mulberry32, 상태는 EVOP.seed 에 저장)
function evoRand() {
  let s = (EVOP.seed = (EVOP.seed + 0x6d2b79f5) | 0);
  s = Math.imul(s ^ (s >>> 15), s | 1);
  s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
  return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
}
const evoGauss = () => Math.sqrt(-2 * Math.log(1 - evoRand())) * Math.cos(2 * Math.PI * evoRand());
// 살아 있는 조종사 기록 (적 기체 객체에 필드를 더하지 않는다 — 하네스 해시가 기체 필드를 펼치므로)
const EVOG = new WeakMap(),
  EVOBUL = new WeakMap();
// 유전자 하나의 실제 값 (유전자가 없는 기체 · 진화가 아니면 원래 값)
function evoGene(e, id) {
  const r = EVOG.get(e),
    G = EVO_GENES[EVO_GI[id]];
  return r ? evoMap(G, r.g[EVO_GI[id]]) : G.mid;
}
// 새 조종사: 개체군이 4명 넘으면 부모 둘(토너먼트 3) → 균등 교차 → 변이(유전자마다 35% · σ0.12), 아니면 무작위(0.5±0.25)
function evoBreed() {
  const P0 = EVOP.pool;
  if (P0.length < 4) return EVO_GENES.map(() => clamp(0.5 + (evoRand() - 0.5) * 0.5, 0, 1));
  const pick = () => {
    let b = null;
    for (let k = 0; k < 3; k++) {
      const c = P0[Math.floor(evoRand() * P0.length)];
      if (!b || c.f > b.f) b = c;
    }
    return b;
  };
  const a = pick(),
    b = pick();
  return EVO_GENES.map((_, i) => {
    let v = evoRand() < 0.5 ? a.g[i] : b.g[i];
    if (evoRand() < 0.35) v += evoGauss() * 0.12;
    return clamp(v, 0, 1);
  });
}
// 웨이브 조종사에게 유전자를 준다 (spawnWave, 진화 난도만)
function evoAssign(e) {
  if (!EVO.on) return;
  EVOG.set(e, { g: evoBreed(), f: 0, born: t, lock: false, gen: EVOP.gen });
}
// 성적 (판정 코드에서 부른다 — 진화 난도만 의미가 있다)
function evoCredit(e, kind) {
  const r = e && EVOG.get(e);
  if (!r || r.done) return;
  if (kind === 'mhit') r.f += 4;
  else if (kind === 'ghit') r.f += 0.15;
  else if (kind === 'evade') r.f += 1.5;
  else if (kind === 'lock' && !r.lock) (r.lock = true), (r.f += 0.4);
}
// 조종사의 생이 끝났다: 격추(dead) 또는 판이 끝날 때 살아 있음 → 개체군에 넣는다
function evoFinalize(e, dead) {
  const r = EVOG.get(e);
  if (!r || r.done) return;
  r.done = true;
  const f = r.f + Math.min(120, Math.max(0, t - r.born)) * 0.02 - (dead ? 2 : 0);
  EVOP.pool.push({ g: r.g.map(v => +v.toFixed(4)), f: +f.toFixed(3) });
  EVOP.pool.sort((a, b) => b.f - a.f);
  if (EVOP.pool.length > EVO_POOL_MAX) EVOP.pool.length = EVO_POOL_MAX;
  EVOP.best = Math.max(EVOP.best * EVO_AGE, f);
  evoPoolSave();
}
// 새 웨이브 = 새 세대: 개체군 성적을 낡게 한다
function evoGeneration() {
  if (!EVO.on) return;
  EVOP.gen++;
  for (const c of EVOP.pool) c.f *= EVO_AGE;
  evoPoolSave();
}
// 판이 끝날 때 (init 앞): 살아남은 조종사도 개체군에 넣는다
function evoSortieEnd() {
  if (typeof es === 'undefined') return;
  for (const e of es) if (e.hp > 0) evoFinalize(e, false);
}
// 플레이어 미사일이 사라졌는데 표적이 살아 있다 → 그 표적 조종사가 피한 것
function evoMissileGone(m) {
  if (EVO.on && m.side === 'P' && m.tg && m.tg.hp > 0) evoCredit(m.tg, 'evade');
}
// 브리핑 보고: 세대 · 개체군 · 상위 조종사들의 평균 유전자 특징
function evoGeneIntel(ko) {
  const P0 = EVOP.pool,
    top = P0.slice(0, 8),
    avg = EVO_GENES.map((_, i) => (top.length ? top.reduce((s, c) => s + c.g[i], 0) / top.length : 0.5)),
    traits = [];
  EVO_GENES.forEach((G, i) => {
    const d = avg[i] - 0.5,
      tx = (ko ? G.t : G.te)[d < 0 ? 0 : 1];
    if (Math.abs(d) > 0.08 && tx) traits.push({ tx, d });
  });
  traits.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return { gen: EVOP.gen, n: P0.length, best: P0.length ? P0[0].f : 0, traits: traits.slice(0, 4).map(x => x.tx), avg };
}
