// ---------- 메뉴 연출: 표지 계기 판독값 · 비행 효과 선택 · 메뉴 효과음 · 설정 화면 방향키
(() => {
  const $id = i => document.getElementById(i),
    front = $id('mallot-front'),
    $$ = s => [...document.querySelectorAll(s)],
    ko = () => $id('mf-lang-ko').classList.contains('selected');
  let ro = 0;
  setInterval(() => {
    if (front.style.display !== 'block' || !$id('mf-cover').classList.contains('active')) return;
    ro++;
    // 표지 시네마틱 기체의 실제 고도 · 속도 · 방위 (89-title-cine) — 예전엔 아무 숫자나 흔들었다
    const R0 = typeof TCINE !== 'undefined' && TCINE.on && TCINE.ro;
    $id('mf-ro').textContent = R0
      ? `ALT ${String(R0.alt).padStart(5, '0')} M · SPD ${R0.kmh} KM/H · HDG ${String(R0.hdg).padStart(3, '0')}` +
        (typeof WX !== 'undefined' ? ` · WX ${WX_TOD[WX.tod].en} ${WX_KIND[WX.kind].en}` : '') // 표지 날씨 (alpha.8)
      : '';
  }, 120);
  // 비행 효과(진동 · 시야 · 항적) 단계 표시
  function sync() {
    $id('mf-fx-h').textContent = ko() ? '03 / 비행 효과' : '03 / FLIGHT EFFECTS';
    $$('[data-fx]').forEach(b => b.classList.toggle('selected', +b.dataset.fx === FXS.q));
    $id('mf-mus-h').textContent = ko() ? '04 / 음악' : '04 / MUSIC';
    $$('[data-mus]').forEach(b => b.classList.toggle('selected', +b.dataset.mus === MUS.level));
  }
  $$('[data-mus]').forEach(b =>
    b.addEventListener('click', () => {
      musicLevel(+b.dataset.mus);
      sync();
    })
  );
  $$('[data-fx]').forEach(b =>
    b.addEventListener('click', () => {
      FXS.q = +b.dataset.fx;
      try {
        localStorage.setItem('stFx', FXS.q);
      } catch (e) {}
      sync();
    })
  );
  $$('#mf-lang-ko,#mf-lang-en,#mf-mode-campaign,#mf-mode-carrier,#mf-mode-airbase,#mf-start').forEach(b =>
    b.addEventListener('click', () => setTimeout(sync, 0))
  );
  front.addEventListener('pointerdown', () => aud());
  front.addEventListener('click', e => {
    if (e.target.closest('.mf-btn')) tone(520, 0.07, 'square', 0.04, 780);
  });
  front.addEventListener('pointerover', e => {
    if (AC && e.target.closest?.('.mf-btn')) tone(900, 0.03, 'square', 0.015);
  });
  addEventListener(
    'keydown',
    e => {
      if (
        window.__stOpeningOpen ||
        front.style.display !== 'block' ||
        !$id('mf-settings').classList.contains('active') ||
        $id('mf-guide-modal').classList.contains('open')
      )
        return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const MB = ['mf-mode-campaign', 'mf-mode-carrier', 'mf-mode-airbase'],
          i = MB.findIndex(x => $id(x).classList.contains('selected'));
        $id(MB[Math.min(2, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))]).click();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        FXS.q = clamp(FXS.q + (e.key === 'ArrowUp' ? 1 : -1), 0, 2);
        try {
          localStorage.setItem('stFx', FXS.q);
        } catch (x) {}
        sync();
        tone(700, 0.05, 'square', 0.03);
      } else return;
      e.preventDefault();
    },
    true
  );
  sync();
})();
// 문자열을 폭 w(px) 안에 맞춰 자른다 (opsHud 안내 문구용)
function exFit(s, sz, w) {
  g.font = sz + 'px ui-monospace,Menlo,monospace';
  const c = Array.from(String(s));
  if (g.measureText(c.join('')).width <= w) return c.join('');
  while (c.length && g.measureText(c.join('') + '…').width > w) c.pop();
  return c.join('') + '…';
}
