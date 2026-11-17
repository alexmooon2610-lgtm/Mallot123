// ---------- 무장 고르기 (V15.0.0-alpha.3): 레이더 유도(R-27R) · 열추적(R-73) 비율을 정한다
// 브리핑(싱글 · 캠페인)과 멀티 로비가 같은 부품을 쓴다. 값은 기체마다 localStorage 'stLoad' (00-core loadSarh / setLoadSarh).
// mountLoadPicker(el, { ac: () => 기체 키, lang: () => 'ko'|'en' }) → { paint() }
function mountLoadPicker(el, o) {
  const T = {
    ko: { sarh: '레이더 유도', ir: '열추적', bvr: '요격', std: '표준', wvr: '근접', more: '+ 레이더', less: '+ 열추적',
      hint: '레이더 유도는 멀리서 락을 유지해 맞히고, 열추적은 가까이서 쏘고 잊는다.' },
    en: { sarh: 'RADAR', ir: 'HEAT', bvr: 'INTERCEPT', std: 'STANDARD', wvr: 'DOGFIGHT', more: '+ RADAR', less: '+ HEAT',
      hint: 'Radar missiles hit from range while you hold the lock; heat-seekers are short-range fire-and-forget.' },
  };
  const set = (ac, n) => {
    const A = ACFT[ac];
    setLoadSarh(ac, Math.min(A.sarhMax, Math.max(A.sarhMin, n)));
    paint();
  };
  function paint() {
    const ac = o.ac(),
      A = ACFT[ac],
      L = loadFor(ac),
      t = T[o.lang() === 'en' ? 'en' : 'ko'],
      // 날개 그림: 레이더 유도는 안쪽, 열추적은 바깥쪽 칸에 단다 (가운데가 동체)
      half = A.msl / 2,
      side = i => (i < L.SARH / 2 ? 'sarh' : 'ir'),
      left = [...Array(half)].map((_, i) => side(i)).reverse(),
      right = [...Array(half)].map((_, i) => side(i)),
      pip = k => `<i class="mf-lp-pip ${k}"></i>`,
      def = A.load.SARH,
      presets = [
        [t.bvr, A.sarhMax],
        [t.std, def],
        [t.wvr, A.sarhMin],
      ];
    el.innerHTML = `
      <div class="mf-lp-head"><b>${A.short}</b> · ${A.msl}${o.lang() === 'en' ? ' missiles' : '발'}</div>
      <div class="mf-lp-wing" aria-hidden="true">${left.map(pip).join('')}<i class="mf-lp-body"></i>${right.map(pip).join('')}</div>
      <div class="mf-lp-row">
        <button class="mf-btn" data-lp="-1"${L.SARH <= A.sarhMin ? ' disabled' : ''}>${t.less}</button>
        <div class="mf-lp-count"><span class="sarh">R-27R ×${L.SARH}</span><small>${t.sarh}</small></div>
        <div class="mf-lp-count"><span class="ir">R-73 ×${L.IR}</span><small>${t.ir}</small></div>
        <button class="mf-btn" data-lp="1"${L.SARH >= A.sarhMax ? ' disabled' : ''}>${t.more}</button>
      </div>
      <div class="mf-lp-presets">${presets
        .map(([n, v]) => `<button class="mf-btn${v === L.SARH ? ' selected' : ''}" data-lps="${v}">${n} ${v}/${A.msl - v}</button>`)
        .join('')}</div>
      <p class="mf-loadout-note">${t.hint}</p>`;
  }
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-lp],[data-lps]');
    if (!b || b.disabled) return;
    const ac = o.ac();
    if (b.dataset.lps) set(ac, +b.dataset.lps);
    else set(ac, loadSarh(ac) + +b.dataset.lp);
  });
  paint();
  return { paint };
}
