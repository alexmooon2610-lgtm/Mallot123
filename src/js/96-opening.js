// ---------- 오프닝 (V13.1): 다큐멘터리식
//  1막 실제 역사(흑백) → 일시정지 → 노이즈와 함께 테이프 역재생 → 2막 가상 역사(붉은 색조) → 타이틀
//  캠페인을 처음 시작할 때 재생되고, 설정 화면의 '오프닝 보기'로 다시 볼 수 있다.
//  Enter · Space · Esc 또는 SKIP 으로 건너뛴다.
//
//  사진 넣는 법 (둘 중 하나)
//   1) 플레이용 HTML 옆에 opening 폴더를 만들고 r1.jpg, a1.png 처럼 장면 id 로 이름을 붙여 넣는다. (빌드 불필요)
//   2) src/assets/opening/ 에 같은 이름으로 넣고 build.py 를 돌리면 HTML 안에 들어간다.
//  사진이 없는 장면은 어떤 사진이 들어갈 자리인지 보여주는 임시 화면이 나온다.
//  실제 사진을 쓸 때 저작자 표시가 필요하면 그 장면의 credit 에 적는다.
const OPENING = {
  scenes: [
    {
      id: 'r1',
      era: 'real',
      date: '1989.11.09',
      place: { ko: '베를린', en: 'BERLIN' },
      credit: '',
      slot: { ko: '베를린 장벽 위에 올라선 시민들', en: 'Crowds standing on the Berlin Wall' },
      text: { ko: '1989년 11월, 베를린 장벽이 무너졌다.', en: 'November 1989. The Berlin Wall fell.' },
    },
    {
      id: 'r2',
      era: 'real',
      date: '1991.08.19',
      place: { ko: '모스크바', en: 'MOSCOW' },
      credit: '',
      slot: { ko: '모스크바 거리에 들어선 전차', en: 'Tanks on the streets of Moscow' },
      text: {
        ko: '1991년 8월 19일, 모스크바에 전차가 들어섰다. 강경파가 권력을 되찾으려 했다.',
        en: '19 August 1991. Tanks rolled into Moscow. Hardliners tried to take back power.',
      },
    },
    {
      id: 'r3',
      era: 'real',
      date: '1991.08.21',
      place: { ko: '모스크바', en: 'MOSCOW' },
      credit: '',
      slot: { ko: '전차를 막아선 시민들과 바리케이드', en: 'Citizens and barricades blocking the tanks' },
      text: {
        ko: '사흘 뒤, 시도는 실패했다. 시민들이 전차를 막아섰다.',
        en: 'Three days later, it failed. Citizens stood in front of the tanks.',
      },
    },
    {
      id: 'r4',
      era: 'real',
      date: '1991.12.25',
      place: { ko: '크렘린', en: 'KREMLIN' },
      credit: '',
      pause: true,
      keepColor: true,
      slot: { ko: '크렘린 위에서 내려가는 붉은 깃발', en: 'The red flag lowered over the Kremlin' },
      text: {
        ko: '그해 12월, 붉은 깃발이 내려갔다. 냉전은 그렇게 끝났다.',
        en: 'That December, the red flag came down. And so the Cold War ended.',
      },
    },
    {
      id: 'a1',
      era: 'alt',
      date: '1991.08.21',
      place: { ko: '모스크바', en: 'MOSCOW' },
      credit: '',
      slot: { ko: '군중이 가득한 광장으로 들어선 전차', en: 'Tanks entering a crowded square' },
      text: { ko: '그러나 이 세계에서, 전차는 멈추지 않았다.', en: 'But in this world, the tanks did not stop.' },
    },
    {
      id: 'a2',
      era: 'alt',
      date: '1991.08.22',
      place: { ko: '모스크바', en: 'MOSCOW' },
      credit: '',
      slot: { ko: '광장을 메운 시위대와 그 앞을 막은 군 병력', en: 'Protesters in a square facing a line of troops' },
      text: {
        ko: '광장의 시위는 진압되었다. 군부가 나라를 손에 넣었다.',
        en: 'The protests were crushed. The generals took the country.',
      },
    },
    {
      id: 'a3',
      era: 'alt',
      date: '1992 — 1998',
      place: { ko: '동방 연합', en: 'EASTERN ALLIANCE' },
      credit: '',
      slot: { ko: '광장을 지나는 군사 퍼레이드와 미사일 차량', en: 'A military parade with missile carriers' },
      text: {
        ko: '붉은 깃발은 내려가지 않았다. 냉전은 끝나지 않았고, 동방 연합은 무장을 멈추지 않았다.',
        en: 'The red flag never came down. The Cold War never ended, and the Eastern Alliance never stopped arming.',
      },
    },
    {
      id: 'a4',
      era: 'alt',
      date: '1999.09',
      place: { ko: '모스크바', en: 'MOSCOW' },
      credit: '',
      slot: { ko: '작전 지도 앞에 모인 장군들', en: 'Generals gathered over a war map' },
      text: {
        ko: '1999년, 세기말. 군부는 선언했다. 2000년이 오기 전에 자본주의를 무너뜨리겠다고.',
        en: '1999, the end of the century. The generals declared they would bring down capitalism before the year 2000.',
      },
    },
    {
      id: 'a5',
      era: 'alt',
      date: '1999.11',
      place: { ko: '유럽 전선', en: 'EUROPEAN FRONT' },
      credit: '',
      slot: { ko: '불타는 지평선 위를 나는 전투기 편대', en: 'Fighter formations over a burning horizon' },
      text: { ko: '제3차 세계대전이 시작되었다.', en: 'The Third World War had begun.' },
    },
    {
      id: 'y2k',
      era: 'card',
      date: '1999.12',
      place: { ko: '기밀', en: 'CLASSIFIED' },
      text: {
        ko: '동방 연합의 마지막 카드는 적의 연구시설에 잠든 시공 이동 장치. 그러나 그 장치는 2000년을 읽지 못한다.',
        en: 'The Alliance’s last card: a time-displacement device inside an enemy research site. But the device cannot read the year 2000.',
      },
    },
    {
      id: 'a6',
      era: 'alt',
      date: '1999.12.18',
      place: { ko: '북태평양', en: 'NORTH PACIFIC' },
      credit: '',
      slot: { ko: '거친 바다를 가르는 대형 항모', en: 'A large carrier cutting through rough seas' },
      text: {
        ko: '항모 ZARYA가 태평양을 가로지른다. 남은 시간은 얼마 없다.',
        en: 'The carrier ZARYA crosses the Pacific. Time is running out.',
      },
    },
  ],
  whatIf: { ko: '만약 그날, 전차가 멈추지 않았다면.', en: 'What if, that day, the tanks had not stopped?' },
  skip: { ko: '건너뛰기', en: 'SKIP' },
  sceneSec: 6.2, // 장면 하나의 길이(초)
};
// 사진 찾기: HTML 안에 넣은 것 → opening 폴더의 파일 순서. 없으면 null.
function opImage(id) {
  const el = document.getElementById('asset-op-' + id);
  if (el)
    return Promise.resolve(`data:${el.dataset.mime || 'image/jpeg'};base64,${el.textContent.replace(/\s+/g, '')}`);
  const ex = ['jpg', 'jpeg', 'png', 'webp'];
  return new Promise(res => {
    let i = 0;
    const tryNext = () => {
      if (i >= ex.length) return res(null);
      const src = `opening/${id}.${ex[i++]}`,
        im = new Image();
      im.onload = () => res(src);
      im.onerror = tryNext;
      im.src = src;
    };
    tryNext();
  });
}
function playOpening(lang, onDone) {
  if (window.__stOpeningOpen) return;
  const L = lang === 'en' ? 'en' : 'ko',
    O = OPENING,
    esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const root = document.createElement('div');
  root.id = 'st-op';
  root.lang = L;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'STEEL TEMPEST opening');
  root.innerHTML = `<div class="op-stage"></div><canvas class="op-noise" width="240" height="135" aria-hidden="true"></canvas><div class="op-vig" aria-hidden="true"></div>
  <div class="op-bar op-bar-t" aria-hidden="true"></div><div class="op-bar op-bar-b" aria-hidden="true"></div>
  <div class="op-stamp" aria-hidden="true"><b></b><span></span></div><div class="op-osd" aria-hidden="true"></div>
  <p class="op-sub" aria-live="polite"></p><div class="op-credit"></div>
  <button class="op-skip" type="button">${esc(O.skip[L])} ▸▸</button>`;
  document.body.appendChild(root);
  window.__stOpeningOpen = true;
  const $q = s => root.querySelector(s),
    stage = $q('.op-stage'),
    sub = $q('.op-sub'),
    osd = $q('.op-osd'),
    stampB = $q('.op-stamp b'),
    stampS = $q('.op-stamp span'),
    credit = $q('.op-credit');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const imgs = {};
  O.scenes.forEach(s => {
    if (s.era !== 'card') imgs[s.id] = opImage(s.id);
  });
  let closed = false,
    raf = 0;
  const timers = new Set();
  const wait = ms =>
    new Promise(r => {
      const id = setTimeout(() => {
        timers.delete(id);
        r();
      }, ms);
      timers.add(id);
    });
  // ---- 필름 그레인 / 테이프 노이즈 (한 캔버스를 투명도만 바꿔 쓴다)
  const nc = $q('.op-noise'),
    nx = nc.getContext('2d'),
    nd = nx.createImageData(nc.width, nc.height);
  let noiseOn = true;
  const noiseFrame = () => {
    if (closed) return;
    if (noiseOn) {
      const d = nd.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      nx.putImageData(nd, 0, 0);
    }
    raf = requestAnimationFrame(noiseFrame);
  };
  noiseFrame();
  // ---- 소리 (게임의 오디오 컨텍스트를 빌린다. 소리가 꺼져 있으면 조용히 넘어간다)
  const snd = {
    noise(d, v = 0.05) {
      try {
        aud();
        if (!AC) return;
        const n = (AC.sampleRate * d) | 0,
          b = AC.createBuffer(1, n, AC.sampleRate),
          c = b.getChannelData(0);
        for (let i = 0; i < n; i++) c[i] = Math.random() * 2 - 1;
        const s = AC.createBufferSource(),
          g = AC.createGain(),
          f = AC.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2400;
        s.buffer = b;
        g.gain.setValueAtTime(v, AC.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0005, AC.currentTime + d);
        s.connect(f)
          .connect(g)
          .connect(ACOUT || AC.destination);
        s.start();
      } catch (e) {}
    },
    click() {
      try {
        aud();
        tone(140, 0.06, 'square', 0.05, 60);
      } catch (e) {}
    },
    rewind(d) {
      try {
        aud();
        if (!AC) return;
        const o = AC.createOscillator(),
          l = AC.createOscillator(),
          lg = AC.createGain(),
          g = AC.createGain(),
          c = AC.currentTime;
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(700, c);
        o.frequency.linearRampToValueAtTime(1500, c + d);
        l.frequency.value = 13;
        lg.gain.value = 60;
        l.connect(lg).connect(o.frequency);
        g.gain.setValueAtTime(0.018, c);
        g.gain.linearRampToValueAtTime(0, c + d);
        o.connect(g).connect(ACOUT || AC.destination);
        o.start(c);
        l.start(c);
        o.stop(c + d);
        l.stop(c + d);
      } catch (e) {}
    },
    hit() {
      try {
        aud();
        tone(62, 1.8, 'sawtooth', 0.04, 38);
      } catch (e) {}
    },
  };
  // ---- 장면 그리기
  const setEra = e => {
    root.classList.remove('era-real', 'era-alt', 'era-card');
    root.classList.add('era-' + e);
  };
  const setStamp = sc => {
    stampB.textContent = sc.date;
    stampS.textContent = sc.place[L];
  };
  const setSub = t => {
    sub.classList.remove('on');
    void sub.offsetWidth;
    sub.textContent = t || '';
    if (t) sub.classList.add('on');
  };
  const layer = async (sc, { instant = false } = {}) => {
    const el = document.createElement('div');
    el.className = 'op-layer' + (instant ? ' on' : '');
    if (sc.era === 'card') {
      el.innerHTML = `<div class="op-card"><div class="op-clock"><span class="op-c1">99.12.31 23:59:59</span><span class="op-c2">00.01.01 00:00:00</span></div><div class="op-card-err">TEMPORAL REFERENCE ROLLOVER · Y2K LOCKOUT</div></div>`;
    } else {
      const src = await imgs[sc.id];
      if (src) {
        // 세로로 긴 사진은 자르지 않고 가운데에 두고, 뒤는 같은 사진을 흐리게 깐다
        const im = new Image();
        im.src = src;
        try {
          await im.decode();
        } catch (e) {}
        const kb = reduce ? '' : ' kb' + (O.scenes.indexOf(sc) % 2),
          tall = im.naturalWidth && im.naturalWidth / im.naturalHeight < 1.3;
        el.innerHTML = tall
          ? `<img class="op-bg" alt="" src="${src}"><img class="op-img op-fit${kb}" alt="" src="${src}">`
          : `<img class="op-img${kb}" alt="" src="${src}">`;
      } else {
        // 사진이 없는 장면: 빈칸 대신 한 줄 농담. 무엇이 들어갈 자리인지와 파일 이름은 그대로 남긴다.
        const nap =
          L === 'ko'
            ? '종군 사진기자가 낮잠 자는 바람에 이 장면은 필름에 안 담겼다.'
            : 'The war photographer dozed off. This frame never made it onto film.';
        el.innerHTML = `<div class="op-ph"><b>ARCHIVE · ${esc(sc.id.toUpperCase())}</b><span>${esc(nap)}</span><span>[ ${esc(sc.slot[L])} ]</span><small>opening/${esc(sc.id)}.jpg</small></div>`;
      }
    }
    stage.appendChild(el);
    if (!instant) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on')));
    [...stage.children].slice(0, -1).forEach(o => {
      o.classList.remove('on');
      setTimeout(() => o.remove(), 900);
    });
    credit.textContent = sc.credit ? 'PHOTO · ' + sc.credit : '';
    return el;
  };
  const scene = async sc => {
    setEra(sc.era);
    musicCue(sc.era === 'real' ? 'op-real' : 'op-alt', 1.6); // 39-music
    root.classList.toggle('keep-color', !!sc.keepColor);
    setStamp(sc);
    setSub('');
    await layer(sc);
    if (closed) return;
    await wait(700);
    if (closed) return;
    setSub(sc.text[L]);
    await wait(O.sceneSec * 1000 - 700);
  };
  // ---- 일시정지 → 노이즈 → 역재생 → 재생
  const rewind = async () => {
    const real = O.scenes.filter(s => s.era === 'real').reverse(),
      to = O.scenes.find(s => s.era === 'alt');
    root.classList.add('paused');
    noiseOn = false;
    osd.textContent = '❚❚ PAUSE';
    osd.className = 'op-osd on';
    musicCue(null, 0.3);
    snd.click();
    await wait(1500);
    if (closed) return;
    setSub('');
    root.classList.remove('paused');
    root.classList.add('burst');
    noiseOn = true;
    snd.noise(0.7, 0.06);
    await wait(650);
    if (closed) return;
    root.classList.remove('burst');
    root.classList.add('rew');
    osd.textContent = '◀◀ REW';
    snd.rewind(2.6);
    const d0 = Date.UTC(1991, 11, 25),
      d1 = Date.UTC(1991, 7, 21),
      T0 = performance.now(),
      RD = 2600;
    const tick = () => {
      if (closed || !root.classList.contains('rew')) return;
      const k = Math.min(1, (performance.now() - T0) / RD),
        d = new Date(d0 + (d1 - d0) * k * k);
      stampB.textContent = `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}`;
      requestAnimationFrame(tick);
    };
    tick();
    for (let i = 0; i < real.length * 2; i++) {
      if (closed) return;
      await layer(real[i % real.length], { instant: true });
      await wait(RD / (real.length * 2));
    }
    if (closed) return;
    root.classList.remove('rew');
    root.classList.add('burst');
    snd.noise(0.35, 0.05);
    await wait(380);
    if (closed) return;
    root.classList.remove('burst');
    stage.innerHTML = '';
    credit.textContent = '';
    osd.textContent = '▶ PLAY';
    stampB.textContent = to.date;
    stampS.textContent = to.place[L];
    root.classList.add('whatif');
    setSub(O.whatIf[L]);
    snd.hit();
    musicCue('op-alt', 0.2);
    await wait(3000);
    if (closed) return;
    root.classList.remove('whatif');
    osd.className = 'op-osd';
  };
  const title = async () => {
    setSub('');
    stage.innerHTML = '';
    credit.textContent = '';
    stampB.textContent = stampS.textContent = '';
    root.classList.add('titled');
    const t = document.createElement('div');
    t.className = 'op-title';
    t.innerHTML = '<b>STEEL <em>TEMPEST</em></b><span>1999</span>';
    root.appendChild(t);
    await wait(4200);
  };
  const finish = () => {
    if (closed) return;
    closed = true;
    musicCue(null, 0.8);
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey, true);
    root.classList.add('op-out');
    setTimeout(() => {
      root.remove();
      window.__stOpeningOpen = false;
      if (onDone) onDone();
    }, 450);
  };
  const onKey = e => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') finish();
  };
  addEventListener('keydown', onKey, true);
  $q('.op-skip').addEventListener('click', finish);
  (async () => {
    try {
      for (const sc of O.scenes) {
        if (closed) return;
        await scene(sc);
        if (sc.pause) await rewind();
      }
      if (!closed) await title();
    } catch (e) {
      console.warn('[OPENING]', e);
    }
    finish();
  })();
}
