// 게임 상태 해시 — 게임이 로드된 뒤 일반 <script> 로 주입된다 (그래야 최상위 let/const 를 읽을 수 있다).
// 판정에 관여하는 상태만 담는다. 연출 상태(FXS 화면 효과 · CVW 항모 무장 연출 · 입자 fx)는 뺀다.
window.__probe = (() => {
  const vec = v => (v.w !== undefined ? [v.x, v.y, v.z, v.w] : [v.x, v.y, v.z]);
  // 객체의 숫자 · 문자 · 참거짓 · 벡터 · 쿼터니언 필드만 1단계로 펼친다 (메시 같은 three 객체는 건너뜀)
  const flat = (o, d = 0) => {
    if (!o || typeof o !== 'object') return o;
    const r = {};
    for (const k of Object.keys(o).sort()) {
      const v = o[k];
      const ty = typeof v;
      if (ty === 'number' || ty === 'string' || ty === 'boolean') r[k] = v;
      else if (v && (v.isVector3 || v.isQuaternion || v.isVector2)) r[k] = vec(v);
      else if (Array.isArray(v) && v.every(x => typeof x === 'number')) r[k] = v;
      else if (d < 1 && v && Object.getPrototypeOf(v) === Object.prototype) r[k] = flat(v, d + 1); // am · cm 같은 작은 기록
    }
    return r;
  };
  const state = () => ({
    S,
    t,
    wv,
    wt,
    kills,
    activeMission,
    missionPhase,
    missionGate,
    missionComplete,
    missionFailed,
    missionStats: flat(missionStats),
    airbaseOps: flat(airbaseOps),
    ops: flat(ops),
    p: flat(p),
    rd: flat(rd),
    es: es.map(o => flat(o)),
    ms: ms.map(o => flat(o)),
    fl: fl.map(o => flat(o)),
    bl: bl.map(o => flat(o)),
  });
  // FNV-1a 32bit
  const fnv = s => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16).padStart(8, '0');
  };
  return {
    state,
    hash: () => fnv(JSON.stringify(state())),
    // 사람이 읽는 요약 (보고서용)
    brief: () => ({
      S,
      t: +t.toFixed(2),
      phase: missionPhase,
      deck: ops.st,
      gate: missionGate,
      kills,
      wave: wv,
      done: missionComplete,
      failed: missionFailed,
      over,
      alt: p ? Math.round(p.pos.y) : null, // m
      kmh: p ? kmh(p.speed) : null,
      hp: p ? +p.hp.toFixed(1) : null,
      enemies: es.length,
      missiles: ms.length,
    }),
  };
})();
