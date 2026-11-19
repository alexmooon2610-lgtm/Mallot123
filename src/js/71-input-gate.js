// ===== 기기 확인 안내 (V15.0.0-alpha.8) — 사용자 요청 2026-11-19 =====
// "가로 전환을 안 하거나 키보드를 안 연결하면 못 해서, 그걸 알려 주는 기능을 넣어 달라"
// 이 게임에는 아직 터치 조작이 없다. 그래서 터치가 주 입력인 기기(폰 · 태블릿)에서는
//   1) 출격할 때(start): 가로 화면 · 키보드 두 가지를 확인하는 창을 띄운다. 둘 다 되면 저절로 출격한다.
//      키보드는 알아낼 표준 방법이 없어서 '키를 한 번 눌러 확인'한다 (한 번 확인되면 기기에 기억 — stKbd).
//      '그래도 출격'으로 넘어갈 수 있다.
//   2) 비행 중에 세로로 돌리면: 잠시 멈추고 '가로로 돌려 주세요'를 띄운다. 다시 가로가 되면 이어서 한다.
//   3) 메뉴 화면: 위쪽에 작은 안내 띠 (필요한 것이 남았을 때만).
// 마우스가 있는 PC(hover 가능)는 아무것도 하지 않는다 → 결정론 하네스 · 데스크톱은 그대로.
const IG = { kbd: false, open: false, then: null, autoPaused: false, el: null, band: null, skip: false };
try {
  IG.kbd = localStorage.getItem('stKbd') === '1';
} catch (e) {}
const igTouch = () =>
  (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && matchMedia('(hover: none)').matches;
const igPortrait = () => innerHeight > innerWidth;
const igKo = () => {
  const b = document.getElementById('mf-lang-ko');
  return !b || b.classList.contains('selected');
};
const igNeed = () => igTouch() && (igPortrait() || !IG.kbd);

function igBuild() {
  if (IG.el) return;
  const d = document.createElement('div');
  d.id = 'ig-gate';
  d.innerHTML = `<div class="ig-card">
      <div class="ig-title"></div>
      <div class="ig-row" data-k="rot"><span class="ig-ico ig-rot">▯</span><div><b></b><small></small></div><span class="ig-st"></span></div>
      <div class="ig-row" data-k="kbd"><span class="ig-ico">⌨</span><div><b></b><small></small></div><span class="ig-st"></span></div>
      <p class="ig-note"></p>
      <div class="ig-btns"><button class="mf-btn ig-skip"></button><button class="mf-btn ig-back"></button></div>
    </div>`;
  document.body.appendChild(d);
  d.querySelector('.ig-skip').addEventListener('click', () => igClose(true));
  d.querySelector('.ig-back').addEventListener('click', () => {
    igClose(false);
    const f = document.getElementById('mallot-front'); // 브리핑 화면으로 돌아간다 (출격 직전에 메뉴를 숨겼으므로)
    if (f && typeof S !== 'undefined' && S !== 'play') f.style.display = 'block';
  });
  IG.el = d;
  const b = document.createElement('div');
  b.id = 'ig-band';
  document.body.appendChild(b);
  IG.band = b;
}
function igRender() {
  const ko = igKo(),
    d = IG.el,
    rotOk = !igPortrait(),
    kbdOk = IG.kbd,
    playing = IG.mode === 'rotate';
  d.querySelector('.ig-title').textContent = playing
    ? ko
      ? '화면을 가로로 돌려 주세요'
      : 'ROTATE TO LANDSCAPE'
    : ko
      ? '출격 전 확인'
      : 'BEFORE YOU LAUNCH';
  const rows = {
    rot: [
      ko ? '가로 화면' : 'Landscape',
      ko ? '휴대폰 · 태블릿을 가로로 돌려 주세요 (화면 회전 잠금을 풀어야 할 수도 있어요)' : 'Turn your device sideways (unlock rotation if needed)',
      rotOk,
    ],
    kbd: [
      ko ? '키보드' : 'Keyboard',
      ko
        ? '아직 터치 조작이 없어요. 블루투스 키보드를 연결하고 아무 키나 눌러 확인해 주세요'
        : 'No touch controls yet. Connect a Bluetooth keyboard and press any key',
      kbdOk,
    ],
  };
  for (const k in rows) {
    const r = d.querySelector(`[data-k="${k}"]`),
      [t, s, ok] = rows[k];
    r.style.display = playing && k === 'kbd' ? 'none' : '';
    r.classList.toggle('ok', ok);
    r.querySelector('b').textContent = t;
    r.querySelector('small').textContent = s;
    r.querySelector('.ig-st').textContent = ok ? (ko ? '확인' : 'OK') : ko ? '필요' : 'NEEDED';
  }
  const all = rotOk && (playing || kbdOk);
  d.querySelector('.ig-note').textContent = all
    ? ko
      ? '준비 완료 — 출격합니다'
      : 'Ready — launching'
    : playing
      ? ko
        ? '게임은 잠시 멈춰 있어요. 가로가 되면 이어서 합니다'
        : 'Paused. Resumes when landscape'
      : ko
        ? '두 가지가 되면 저절로 출격해요'
        : 'Launches automatically when both are ready';
  d.querySelector('.ig-btns').style.display = playing ? 'none' : '';
  d.querySelector('.ig-skip').textContent = ko ? '그래도 출격' : 'LAUNCH ANYWAY';
  d.querySelector('.ig-back').textContent = ko ? '메뉴로' : 'MENU';
  return all;
}
function igClose(go) {
  IG.open = false;
  IG.el && IG.el.classList.remove('open');
  const t = IG.then;
  IG.then = null;
  if (go && t) {
    IG.skip = true;
    t();
    IG.skip = false;
  }
}
// start() 맨 앞에서 부른다. true 면 출격을 멈추고 확인 창을 띄운 것 — 확인되면 next() 로 이어서 출격한다
function inputGateBlock(next) {
  if (IG.skip || !igNeed()) return false;
  igBuild();
  IG.mode = 'launch';
  IG.then = next;
  IG.open = true;
  IG.el.classList.add('open');
  igRender();
  return true;
}
// 키를 한 번이라도 누르면 키보드가 있는 것 (실제 키 입력만 — 화면 키보드의 글자 입력은 메뉴에 입력칸이 없어 오지 않는다)
window.addEventListener(
  'keydown',
  ev => {
    if (!ev.isTrusted || IG.kbd) return;
    IG.kbd = true;
    try {
      localStorage.setItem('stKbd', '1');
    } catch (e) {}
  },
  true
);
// 0.3초마다: 확인 창 갱신 · 비행 중 세로 감지 · 메뉴 안내 띠
setInterval(() => {
  if (!igTouch()) return;
  igBuild();
  const playing = typeof S !== 'undefined' && (S === 'play' || (S === 'pause' && IG.autoPaused));
  if (IG.open && IG.mode === 'launch') {
    if (igRender() && !IG.closing) {
      IG.closing = true;
      setTimeout(() => {
        IG.closing = false;
        if (IG.open && igRender()) igClose(true);
      }, 700);
    }
  } else if (playing) {
    // 비행 중 세로로 돌렸다 → 잠시 멈춤 + 안내. 다시 가로 → 이어서
    if (igPortrait() && !IG.open) {
      IG.mode = 'rotate';
      IG.open = true;
      IG.el.classList.add('open');
      igRender();
      if (S === 'play' && typeof togglePause === 'function') {
        togglePause();
        IG.autoPaused = true;
      }
    } else if (!igPortrait() && IG.open && IG.mode === 'rotate') {
      igClose(false);
      if (IG.autoPaused && S === 'pause') togglePause();
      IG.autoPaused = false;
    }
  }
  // 메뉴 안내 띠
  const front = document.getElementById('mallot-front'),
    intro = document.getElementById('mf-intro'),
    inMenu = front && front.style.display === 'block' && !(intro && intro.classList.contains('active'));
  const need = [];
  if (igPortrait()) need.push('landscape');
  if (!IG.kbd) need.push('a keyboard');
  IG.band.classList.toggle('show', !!(inMenu && need.length && !IG.open));
  const ko = igKo(),
    rot = igPortrait();
  IG.band.textContent = ko
    ? `📱 이 게임은 ${rot && !IG.kbd ? '가로 화면과 키보드가' : rot ? '가로 화면이' : '키보드가'} 필요해요` +
      (!IG.kbd ? ' — 키보드를 연결했다면 아무 키나 눌러 주세요' : '')
    : `📱 This game needs ${need.join(' + ')}` + (!IG.kbd ? ' — press any key if a keyboard is connected' : '');
}, 300);
