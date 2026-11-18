// ---------- 티저 영상 (타이틀 화면의 TEASER 버튼)
// 48초짜리 시네마틱을 480p 로 줄여 파일 안에 넣었다 (asset-teaser-mp4). 누르면 전체 화면으로 틀고,
// 끝나거나 아무 키 · 클릭이면 닫힌다. 트는 동안 메뉴 음악은 멈춘다.
(() => {
  const btn = document.getElementById('mf-teaser');
  if (!btn) return;
  let ov = null,
    url = null;
  function close() {
    if (!ov) return;
    ov.remove();
    ov = null;
    window.__stOpeningOpen = false; // 메뉴 음악 감시가 다시 곡을 건다
    removeEventListener('keydown', onKey, true);
  }
  function onKey(e) {
    e.preventDefault();
    e.stopPropagation();
    close();
  }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    if (ov) return;
    try {
      if (!url) {
        const bytes = assetBytes('asset-teaser-mp4');
        url = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
      }
    } catch (err) {
      console.error('[STEEL TEMPEST] teaser failed', err);
      return;
    }
    ov = document.createElement('div');
    ov.id = 'st-teaser';
    ov.innerHTML = '<video playsinline autoplay></video><span>ESC · CLICK TO CLOSE</span>';
    const v = ov.firstChild;
    v.src = url;
    v.addEventListener('ended', close);
    ov.addEventListener('click', close);
    document.body.appendChild(ov);
    window.__stOpeningOpen = true;
    try {
      musicCue(null, 0.6);
    } catch (e2) {}
    addEventListener('keydown', onKey, true);
    v.play().catch(() => {});
  });
})();
