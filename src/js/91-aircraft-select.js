// ---------- 기체 고르기 (V15.0.0-alpha.3): 설정 화면 05 / 기체 — MiG-29 · Su-33
// 고른 값은 localStorage 'stAc'. 실제 적용은 출격할 때 init() 이 pickedAc() 로 읽는다 (00-core · 20-game-init).
// 캠페인은 이야기 설정상 MiG-29 고정이라, 캠페인 모드를 고르면 안내만 바꾼다.
(() => {
  const $id = id => document.getElementById(id),
    btns = [$id('mf-ac-mig'), $id('mf-ac-su33')];
  if (!btns[0]) return;
  const en = () => $id('mf-lang-en')?.classList.contains('selected'),
    campaign = () => $id('mf-mode-campaign')?.classList.contains('selected');
  const NOTE = {
    mig: {
      ko: 'MiG-29 9.12 — 가볍고 가속이 빠르다 (추중비 1.09). 미사일 R-27R 4 · R-73 4 · 플레어/채프 각 30. 연료가 적어 오래 못 난다.',
      en: 'MiG-29 9.12 — light, quick to accelerate (T/W 1.09). R-27R ×4 · R-73 ×4 · 30 flares/chaff. Short legs.',
    },
    su33: {
      ko: 'Su-33 — 무겁고 가속이 느리다 (추중비 0.85). 대신 N001 레이더로 더 멀리 본다 (탐지 1.4배 · 락 유지 1.3배). 연료 1.7배 · R-27R 6 · R-73 4 · 플레어/채프 각 48. 덩치가 커서 맞기도 쉽다.',
      en: 'Su-33 — heavy, slower to accelerate (T/W 0.85), but the N001 radar sees farther (1.4× detection · 1.3× lock hold). 1.7× endurance · R-27R ×6 · R-73 ×4 · 48 flares/chaff. Bigger target.',
    },
  };
  function paint() {
    const ac = pickedAc(),
      L = en() ? 'en' : 'ko';
    btns.forEach(b => b.classList.toggle('selected', b.dataset.ac === ac));
    $id('mf-ac-h').textContent = L === 'en' ? '05 / AIRCRAFT' : '05 / 기체';
    $id('mf-ac-note').textContent = campaign()
      ? L === 'en'
        ? 'Campaign: MiG-29 fixed (story). Your pick applies to LEGACY · AIRBASE · MULTI.'
        : '캠페인은 이야기 설정상 MiG-29 고정. 고른 기체는 LEGACY · AIRBASE · 멀티에 쓰인다.'
      : NOTE[ac][L];
  }
  btns.forEach(b =>
    b.addEventListener('click', () => {
      try {
        localStorage.setItem('stAc', b.dataset.ac);
      } catch (e) {}
      paint();
    })
  );
  // 언어 · 모드가 바뀌면 안내 문구도 다시
  document.querySelectorAll('[data-lang],[data-mode]').forEach(b => b.addEventListener('click', () => setTimeout(paint, 0)));
  paint();
})();
