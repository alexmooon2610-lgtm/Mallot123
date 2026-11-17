// ---------- 선실 단말기 메뉴
//  표지에서 START 를 누르면 ZARYA 선실로 넘어가, 책상 위 단말기 화면에서 설정 · 임무 선택 · 브리핑을 한다.
//  기존 메뉴 화면(#mf-settings, #mf-brief)을 단말기 화면 안으로 옮길 뿐, 메뉴 기능과 키 조작은 그대로다.
//  선실은 1920×1080 기준 좌표로 그리고 창 크기에 맞춰 통째로 확대·축소한다.
(() => {
  const $id = i => document.getElementById(i),
    front = $id('mallot-front');
  if (!front || $id('st-cabin')) return;
  const RIG = { W: 1920, H: 1080, deskY: 872 };
  const porthole = `<svg viewBox="0 0 240 240" aria-hidden="true">
  <defs>
   <radialGradient id="stc-ring" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8c8a7c"/><stop offset=".6" stop-color="#55544a"/><stop offset="1" stop-color="#2c2c27"/></radialGradient>
   <linearGradient id="stc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05080d"/><stop offset=".55" stop-color="#16222e"/><stop offset="1" stop-color="#1d2b36"/></linearGradient>
   <linearGradient id="stc-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c161d"/><stop offset="1" stop-color="#03070a"/></linearGradient>
   <clipPath id="stc-glass"><circle cx="120" cy="120" r="84"/></clipPath>
  </defs>
  <circle cx="120" cy="120" r="119" fill="#1d201d"/>
  <circle cx="120" cy="120" r="106" fill="url(#stc-ring)"/>
  ${Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return `<circle cx="${(120 + Math.cos(a) * 112).toFixed(1)}" cy="${(120 + Math.sin(a) * 112).toFixed(1)}" r="4.2" fill="#3a3a33" stroke="#77756a" stroke-width="1.2"/>`;
  }).join('')}
  <circle cx="120" cy="120" r="88" fill="#0d0f0e"/>
  <g clip-path="url(#stc-glass)">
   <rect x="0" y="0" width="240" height="240" fill="url(#stc-sky)"/>
   <g class="stc-sea"><path d="M-40 128 Q 0 120 40 127 T 120 125 T 200 129 T 280 124 V 260 H -40 Z" fill="url(#stc-sea)"/><path d="M-40 140 Q 10 134 50 141 T 140 138 T 230 142 T 300 137" stroke="#2c3e4a" stroke-width="1.5" fill="none" opacity=".7"/><path d="M-40 156 Q 20 150 60 157 T 150 153 T 250 158" stroke="#22323d" stroke-width="1.2" fill="none" opacity=".6"/></g>
   <rect class="stc-flash" x="0" y="0" width="240" height="240" fill="#c9dcf0"/>
   <g class="stc-rain" stroke="#9fb6c8" stroke-width="1" opacity=".35">${Array.from({ length: 22 }, (_, i) => `<line x1="${(i * 11.3 + 7) % 240}" y1="${(i * 37) % 200}" x2="${(i * 11.3 + 3) % 240}" y2="${((i * 37) % 200) + 16}"/>`).join('')}</g>
   <path d="M60 70 A 80 80 0 0 1 150 44" stroke="#ffffff" stroke-opacity=".14" stroke-width="7" fill="none" stroke-linecap="round"/>
  </g>
  <circle cx="120" cy="120" r="86" fill="none" stroke="#000" stroke-opacity=".6" stroke-width="4"/>
 </svg>`;
  const chart = `<svg viewBox="0 0 300 230" aria-hidden="true">
  <rect x="0" y="0" width="300" height="230" fill="#cfc6aa"/>
  <g stroke="#9c9478" stroke-width=".6">${Array.from({ length: 9 }, (_, i) => `<line x1="${18 + i * 33}" y1="22" x2="${18 + i * 33}" y2="214"/>`).join('')}${Array.from({ length: 6 }, (_, i) => `<line x1="10" y1="${30 + i * 36}" x2="292" y2="${30 + i * 36}"/>`).join('')}</g>
  <path d="M10 40 Q 34 58 30 92 Q 44 110 36 140 Q 52 160 44 200 L 10 214 Z" fill="#a89f80"/>
  <path d="M60 24 Q 74 40 66 60 Q 58 72 64 84" stroke="#6f6850" stroke-width="1.4" fill="none"/>
  <path d="M248 110 l5 3 l-2 4 l-4 -2 z M262 120 l6 2 l-1 5 l-5 -1 z M274 130 l7 3 l-3 5 z" fill="#857c60"/>
  <path d="M58 70 C 110 80 150 96 196 104 S 240 112 252 118" stroke="#a3271f" stroke-width="2.2" stroke-dasharray="7 5" fill="none"/>
  <circle cx="58" cy="70" r="4" fill="#a3271f"/>
  <text x="150" y="20" text-anchor="middle" font-family="Georgia,serif" font-size="13" letter-spacing="3" fill="#4b4533">ТИХИЙ ОКЕАН</text>
  <text x="292" y="224" text-anchor="end" font-family="monospace" font-size="7" fill="#6f6850">ЛИСТ 14 · 1:10 000 000</text>
 </svg>`;
  const mug = `<svg viewBox="0 0 120 130" aria-hidden="true"><ellipse cx="54" cy="122" rx="48" ry="7" fill="#000" opacity=".45"/><path d="M14 30 h80 v78 q0 14 -14 14 h-52 q-14 0 -14 -14 z" fill="#d9d2c0"/><path d="M14 30 h80 v10 h-80 z" fill="#c8bfa9"/><ellipse cx="54" cy="30" rx="40" ry="7" fill="#e9e3d4"/><ellipse cx="54" cy="31" rx="34" ry="5" fill="#2a1a0e"/><path d="M94 50 q22 0 22 24 q0 24 -22 24" stroke="#cfc7b3" stroke-width="9" fill="none"/><rect x="34" y="62" width="40" height="22" fill="#a3271f" opacity=".85"/><text x="54" y="78" text-anchor="middle" font-family="Georgia,serif" font-size="12" font-weight="700" fill="#e9e3d4">ВМФ</text></svg>`;
  const phone = `<svg viewBox="0 0 200 130" aria-hidden="true"><ellipse cx="100" cy="122" rx="88" ry="8" fill="#000" opacity=".5"/><path d="M28 116 L46 52 h108 l18 64 z" fill="#1b1b19"/><path d="M46 52 h108 l4 14 h-116 z" fill="#2a2a27"/><circle cx="100" cy="88" r="24" fill="#2e2e2a" stroke="#4a4a44" stroke-width="2"/><circle cx="100" cy="88" r="8" fill="#c9c2ae"/>${Array.from(
    { length: 10 },
    (_, i) => {
      const a = ((i / 10) * 1.7 + 0.35) * Math.PI;
      return `<circle cx="${(100 + Math.cos(a) * 16).toFixed(1)}" cy="${(88 + Math.sin(a) * 16).toFixed(1)}" r="3.2" fill="#121211"/>`;
    }
  ).join(
    ''
  )}<path d="M18 40 q0 -22 26 -22 h112 q26 0 26 22 v6 q0 8 -10 8 h-12 q-8 0 -8 -8 v-4 h-92 v4 q0 8 -8 8 h-12 q-10 0 -12 -8 z" fill="#232321"/><path d="M40 22 h120" stroke="#3b3b37" stroke-width="2"/></svg>`;
  const lamp = `<svg viewBox="0 0 260 330" aria-hidden="true"><ellipse cx="170" cy="318" rx="70" ry="10" fill="#000" opacity=".5"/><path d="M118 312 h104 l-10 -18 h-84 z" fill="#2f3a33"/><rect x="164" y="190" width="10" height="106" fill="#3d4a41"/><path d="M169 196 L96 92" stroke="#3d4a41" stroke-width="10" stroke-linecap="round"/><circle cx="169" cy="196" r="9" fill="#55635a"/><circle cx="96" cy="92" r="8" fill="#55635a"/><path d="M96 92 L40 58 L18 112 Z" fill="#33433a"/><path d="M40 58 L18 112 L0 100 L30 46 Z" fill="#2a362f"/><ellipse cx="24" cy="108" rx="22" ry="8" transform="rotate(-58 24 108)" fill="#ffe2a8"/></svg>`;
  const html = `<div id="st-cabin" aria-hidden="false">
  <div class="stc-wall"></div><div class="stc-pipes"></div>
  <div class="stc-desk"></div><div class="stc-pool"></div>
  <div class="stc-rig" id="stc-rig">
   <div class="stc-porthole">${porthole}</div>
   <div class="stc-chart">${chart}<i class="stc-tape a"></i><i class="stc-tape b"></i></div>
   <div class="stc-plate"><b>ПОСТ 3</b><span>КАЮТА · CIC</span></div>
   <div class="stc-monitor">
    <div class="stc-bezel">
     <div class="stc-screen" id="stc-screen">
      <div class="stc-bar" id="stc-bar"><span class="stc-bar-l">ЗАРЯ-86 · ZARYA CIC TERMINAL</span><span class="stc-bar-r" id="stc-clock"></span></div>
      <div class="stc-boot" id="stc-boot" aria-hidden="true"></div>
     </div>
     <div class="stc-chin"><span class="stc-brand">ЗАРЯ-86<small>ЭВМ ТЕРМИНАЛ</small></span><span class="stc-knobs"><i></i><i></i></span><span class="stc-led"></span></div>
    </div>
    <div class="stc-neck"></div>
   </div>
   <div class="stc-folder"><b>СЕКРЕТНО</b><span>ОПЕРАЦИЯ «ЗАРЯ»</span></div>
   <div class="stc-keyboard"><i></i></div>
   <div class="stc-phone">${phone}</div>
   <div class="stc-mug">${mug}<i class="stc-steam"></i><i class="stc-steam b"></i></div>
   <div class="stc-lamp">${lamp}</div>
  </div>
  <div class="stc-vignette"></div>
 </div>`;
  front.insertAdjacentHTML('beforeend', html);
  const cabin = $id('st-cabin'),
    rig = $id('stc-rig'),
    screen = $id('stc-screen'),
    boot = $id('stc-boot');
  // 메뉴 화면을 단말기 안으로 옮긴다 (setStage 의 '#mallot-front .mf-screen' 선택자는 그대로 동작)
  ['mf-settings', 'mf-brief'].forEach(id => {
    const s = $id(id);
    if (s) screen.insertBefore(s, boot);
  });
  // 창 크기에 맞추기: 단말기가 다 보이도록 맞추고, 벽 · 책상은 화면 끝까지 늘린다
  function fit() {
    const w = innerWidth,
      h = innerHeight,
      s = Math.min(w / RIG.W, h / RIG.H);
    rig.style.transform = `translate(-50%,-50%) scale(${s})`;
    cabin.style.setProperty('--desk-y', h / 2 + (RIG.deskY - RIG.H / 2) * s + 'px');
    cabin.style.setProperty('--rig-s', s);
  }
  addEventListener('resize', fit);
  fit();
  // 상태줄: 원래 시간선 시계와 Y2K 남은 시간
  function clock() {
    const el = $id('stc-clock');
    if (!el || !cabin.classList.contains('on')) return;
    try {
      const s = campState(),
        ko = $id('mf-lang-ko').classList.contains('selected');
      el.textContent = `${campClockText(s.clock)}   ${campY2KText(ko ? 'ko' : 'en')}`;
      el.classList.toggle('warn', campY2KLeft() < 1440 * 3);
    } catch (e) {
      el.textContent = '';
    }
  }
  setInterval(clock, 1000);
  // 부팅: 선실에 처음 들어올 때 한 번
  let booted = false;
  const BOOT = [
    'ЗАРЯ-86 BIOS v2.11   (C) 1986 NPO VEGA',
    'MEMORY TEST ........ 640K OK',
    'CORE LINK .......... STANDBY',
    'DATE ............... 99-12-18',
    'WARNING: 2-DIGIT YEAR FIELD',
    'LOADING STEEL TEMPEST CIC SUITE',
  ];
  function runBoot() {
    if (booted || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      booted = true;
      return;
    }
    booted = true;
    screen.classList.add('booting');
    boot.textContent = '';
    let i = 0;
    const step = () => {
      if (i < BOOT.length) {
        boot.textContent += (i ? '\n' : '') + BOOT[i++];
        setTimeout(step, 170);
      } else setTimeout(() => screen.classList.remove('booting'), 380);
    };
    setTimeout(step, 420);
  }
  // 설정 · 브리핑 화면이 켜지면 선실을 보여준다
  const watch = () => {
    const on = ['mf-settings', 'mf-brief'].some(id => {
      const s = $id(id);
      return s && s.classList.contains('active');
    });
    if (on === cabin.classList.contains('on')) return;
    cabin.classList.toggle('on', on);
    front.classList.toggle('st-cabin-on', on);
    if (on) {
      fit();
      clock();
      runBoot();
    }
  };
  const mo = new MutationObserver(watch);
  ['mf-settings', 'mf-brief'].forEach(id => {
    const s = $id(id);
    if (s) mo.observe(s, { attributes: true, attributeFilter: ['class'] });
  });
  watch();
  // 단말기 키 소리
  screen.addEventListener('click', e => {
    if (!e.target.closest('.mf-btn')) return;
    try {
      aud();
      if (AC) tone(1900, 0.018, 'square', 0.018, 1600);
    } catch (err) {}
  });
  window.ST_CABIN = {
    fit,
    boot: () => {
      booted = false;
      runBoot();
    },
  };
})();
